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
  error?: string;
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
}

let dbInstance: IDBPDatabase<MOSAP3DB> | null = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<MOSAP3DB>("mosap3-offline", 2, {
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
    },
  });
  return dbInstance;
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
    try {
      await executeSyncItem(item);
      item.synced = true;
      item.error = undefined;
      await db.put("syncQueue", item);
      synced++;
    } catch (err: any) {
      item.error = err?.message || "Erro desconhecido";
      await db.put("syncQueue", item);
      failed++;
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

// ─── Auto-sync when coming back online ─────────────────────────────────────

export function setupAutoSync() {
  window.addEventListener("online", async () => {
    const pending = await getPendingCount();
    if (pending > 0) {
      const result = await syncAll();
      window.dispatchEvent(
        new CustomEvent("mosap3-sync", { detail: result })
      );
    }
  });
}
