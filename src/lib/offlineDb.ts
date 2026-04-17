import { openDB, DBSchema, IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

// ─── Farmer records (legacy) ───────────────────────────────────────────────

export interface FarmerRecord {
  id: string;
  timestamp: number;
  synced: boolean;
  data: {
    nome: string;
    bi: string;
    dataNascimento: string;
    genero: string;
    telefone: string;
    provincia: string;
    municipio: string;
    escolaCampo: string;
  };
  photos: {
    frontal?: string;
    perfilEsq?: string;
    perfilDir?: string;
  };
  biometrics: {
    polegarDir?: string;
    indicadorDir?: string;
    polegarEsq?: string;
    indicadorEsq?: string;
  };
}

// ─── Generic sync queue ────────────────────────────────────────────────────

export type SyncOperation = "insert" | "update" | "delete";

export interface SyncQueueItem {
  id: string;
  table: string;
  operation: SyncOperation;
  data: Record<string, unknown>;
  /** For update/delete — the column+value used in .eq() */
  matchColumn?: string;
  matchValue?: string;
  timestamp: number;
  synced: boolean;
  retries: number;
  error?: string;
}

// ─── Offline cache ─────────────────────────────────────────────────────────

export interface CachedQuery {
  id: string; // table:key
  table: string;
  data: unknown[];
  cachedAt: number;
}

// ─── DB Schema ─────────────────────────────────────────────────────────────

interface MOSAP3DB extends DBSchema {
  farmers: {
    key: string;
    value: FarmerRecord;
    indexes: {
      "by-synced": number;
      "by-timestamp": number;
    };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      "by-synced": number;
      "by-timestamp": number;
    };
  };
  offlineCache: {
    key: string;
    value: CachedQuery;
    indexes: {
      "by-table": string;
    };
  };
}

let dbInstance: IDBPDatabase<MOSAP3DB> | null = null;
let dbPromise: Promise<IDBPDatabase<MOSAP3DB>> | null = null;

async function getDb(): Promise<IDBPDatabase<MOSAP3DB>> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;
  dbPromise = openDB<MOSAP3DB>("mosap3-offline", 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("farmers", { keyPath: "id" });
        store.createIndex("by-synced", "synced");
        store.createIndex("by-timestamp", "timestamp");
      }
      if (oldVersion < 2) {
        const queue = db.createObjectStore("syncQueue", { keyPath: "id" });
        queue.createIndex("by-synced", "synced");
        queue.createIndex("by-timestamp", "timestamp");
      }
      if (oldVersion < 3) {
        const cache = db.createObjectStore("offlineCache", { keyPath: "id" });
        cache.createIndex("by-table", "table");
      }
    },
    blocked() {
      console.warn("[offlineDb] connection blocked by another tab");
    },
    blocking() {
      // Another tab is requesting an upgrade — close so it can proceed
      try { dbInstance?.close(); } catch {}
      dbInstance = null;
      dbPromise = null;
    },
    terminated() {
      dbInstance = null;
      dbPromise = null;
    },
  }).then((db) => {
    db.addEventListener("close", () => {
      dbInstance = null;
      dbPromise = null;
    });
    dbInstance = db;
    return db;
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

/** Run an IDB operation with one auto-retry if the connection was closing. */
async function withDb<T>(fn: (db: IDBPDatabase<MOSAP3DB>) => Promise<T>): Promise<T> {
  try {
    const db = await getDb();
    return await fn(db);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes("closing") || msg.includes("closed") || err?.name === "InvalidStateError") {
      dbInstance = null;
      dbPromise = null;
      const db = await getDb();
      return await fn(db);
    }
    throw err;
  }
}

// ─── Farmer helpers (legacy, kept for compatibility) ───────────────────────

export async function saveFarmerOffline(record: FarmerRecord): Promise<void> {
  const db = await getDb();
  await db.put("farmers", record);
}

export async function getPendingFarmers(): Promise<FarmerRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("farmers", "by-synced", 0);
  return all.filter((r) => !r.synced);
}

export async function markAsSynced(id: string): Promise<void> {
  const db = await getDb();
  const record = await db.get("farmers", id);
  if (record) {
    record.synced = true;
    await db.put("farmers", record);
  }
}

export async function getAllFarmers(): Promise<FarmerRecord[]> {
  const db = await getDb();
  return db.getAll("farmers");
}

// ─── Generic sync queue helpers ────────────────────────────────────────────

export async function enqueueOperation(
  table: string,
  operation: SyncOperation,
  data: Record<string, unknown>,
  matchColumn?: string,
  matchValue?: string,
): Promise<SyncQueueItem> {
  const db = await getDb();
  const item: SyncQueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    table,
    operation,
    data,
    matchColumn,
    matchValue,
    timestamp: Date.now(),
    synced: false,
    retries: 0,
  };
  await db.put("syncQueue", item);
  window.dispatchEvent(new CustomEvent("mosap3-saved"));
  return item;
}

export async function getPendingQueueItems(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  const all = await db.getAll("syncQueue");
  return all.filter((r) => !r.synced).sort((a, b) => a.timestamp - b.timestamp);
}

export async function getPendingCount(): Promise<number> {
  const farmers = await getPendingFarmers();
  const queue = await getPendingQueueItems();
  return farmers.length + queue.length;
}

const MAX_RETRIES = 5;

function getBackoffMs(retries: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
  return Math.min(1000 * Math.pow(2, retries), 16000);
}

async function executeSyncItem(item: SyncQueueItem): Promise<void> {
  const { table, operation, data, matchColumn, matchValue } = item;

  if (operation === "insert") {
    const { error } = await (supabase.from as any)(table).insert(data);
    if (error) throw error;
  } else if (operation === "update") {
    if (!matchColumn || !matchValue) throw new Error("Missing match for update");
    const { error } = await (supabase.from as any)(table).update(data).eq(matchColumn, matchValue);
    if (error) throw error;
  } else if (operation === "delete") {
    if (!matchColumn || !matchValue) throw new Error("Missing match for delete");
    const { error } = await (supabase.from as any)(table).delete().eq(matchColumn, matchValue);
    if (error) throw error;
  }
}

export async function syncPendingQueue(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingQueueItems();
  let synced = 0;
  let failed = 0;
  const db = await getDb();

  for (const item of pending) {
    // Skip items that exceeded max retries
    if (item.retries >= MAX_RETRIES) {
      failed++;
      continue;
    }

    try {
      await executeSyncItem(item);
      item.synced = true;
      item.error = undefined;
      await db.put("syncQueue", item);
      synced++;
    } catch (err: any) {
      item.retries = (item.retries || 0) + 1;
      item.error = err?.message || "Erro desconhecido";
      await db.put("syncQueue", item);
      failed++;

      // If retryable, wait with backoff before continuing
      if (item.retries < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, getBackoffMs(item.retries)));
      }
    }
  }

  return { synced, failed };
}

// ─── Sync all (farmers + queue) ────────────────────────────────────────────

export async function syncAll(): Promise<{ synced: number; failed: number }> {
  // Sync legacy farmers
  const farmerPending = await getPendingFarmers();
  let farmerSynced = 0;
  let farmerFailed = 0;
  for (const record of farmerPending) {
    try {
      await markAsSynced(record.id);
      farmerSynced++;
    } catch {
      farmerFailed++;
    }
  }

  // Sync generic queue
  const queueResult = await syncPendingQueue();

  return {
    synced: farmerSynced + queueResult.synced,
    failed: farmerFailed + queueResult.failed,
  };
}

// ─── Offline cache helpers ─────────────────────────────────────────────────

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function setCachedData(table: string, key: string, data: unknown[]): Promise<void> {
  const db = await getDb();
  await db.put("offlineCache", {
    id: `${table}:${key}`,
    table,
    data,
    cachedAt: Date.now(),
  });
}

export async function getCachedData(table: string, key: string): Promise<unknown[] | null> {
  const db = await getDb();
  const cached = await db.get("offlineCache", `${table}:${key}`);
  if (!cached) return null;
  // Return even if stale — offline needs something
  return cached.data;
}

export async function isCacheFresh(table: string, key: string): Promise<boolean> {
  const db = await getDb();
  const cached = await db.get("offlineCache", `${table}:${key}`);
  if (!cached) return false;
  return Date.now() - cached.cachedAt < CACHE_TTL;
}

export async function clearCacheForTable(table: string): Promise<void> {
  const db = await getDb();
  const items = await db.getAllFromIndex("offlineCache", "by-table", table);
  const tx = db.transaction("offlineCache", "readwrite");
  for (const item of items) {
    await tx.store.delete(item.id);
  }
  await tx.done;
}

// ─── Auto-sync when coming back online + periodic sync ─────────────────────

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

async function performSync() {
  if (isSyncing || !navigator.onLine) return;
  const pending = await getPendingCount();
  if (pending === 0) return;

  isSyncing = true;
  try {
    const result = await syncAll();
    window.dispatchEvent(
      new CustomEvent("mosap3-sync", { detail: result })
    );
  } finally {
    isSyncing = false;
  }
}

export function setupAutoSync() {
  // Sync on reconnection
  window.addEventListener("online", () => {
    performSync();
  });

  // Periodic sync every 30 seconds when online
  if (syncIntervalId) clearInterval(syncIntervalId);
  syncIntervalId = setInterval(() => {
    if (navigator.onLine) {
      performSync();
    }
  }, 30_000);
}

// ─── Helper: optimistic operation (try online, fallback to queue) ──────────

export async function optimisticInsert(
  table: string,
  data: Record<string, unknown>,
): Promise<{ online: boolean; error?: string }> {
  if (navigator.onLine) {
    try {
      const { error } = await (supabase.from as any)(table).insert(data);
      if (error) throw error;
      return { online: true };
    } catch (err: any) {
      // If online but failed (e.g. network flake), queue it
      await enqueueOperation(table, "insert", data);
      return { online: false, error: err.message };
    }
  } else {
    await enqueueOperation(table, "insert", data);
    return { online: false };
  }
}
