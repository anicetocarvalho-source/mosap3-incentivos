import { openDB, DBSchema, IDBPDatabase } from "idb";

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

interface MOSAP3DB extends DBSchema {
  farmers: {
    key: string;
    value: FarmerRecord;
    indexes: {
      "by-synced": number;
      "by-timestamp": number;
    };
  };
}

let dbInstance: IDBPDatabase<MOSAP3DB> | null = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<MOSAP3DB>("mosap3-offline", 1, {
    upgrade(db) {
      const store = db.createObjectStore("farmers", { keyPath: "id" });
      store.createIndex("by-synced", "synced");
      store.createIndex("by-timestamp", "timestamp");
    },
  });
  return dbInstance;
}

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

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingFarmers();
  return pending.length;
}

// Sync logic — will push to server when online
export async function syncPendingFarmers(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingFarmers();
  let synced = 0;
  let failed = 0;

  for (const record of pending) {
    try {
      // TODO: Replace with actual API call when backend is connected
      // await fetch('/api/farmers', { method: 'POST', body: JSON.stringify(record) });
      
      // Simulate successful sync
      await markAsSynced(record.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// Auto-sync when coming back online
export function setupAutoSync() {
  window.addEventListener("online", async () => {
    const pending = await getPendingCount();
    if (pending > 0) {
      const result = await syncPendingFarmers();
      if (result.synced > 0) {
        window.dispatchEvent(
          new CustomEvent("mosap3-sync", { detail: result })
        );
      }
    }
  });
}
