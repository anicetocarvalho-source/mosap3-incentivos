import { openDB } from "idb";

export interface CachedSession {
  id: string; // always "current"
  email: string;
  userId: string;
  profile: { full_name: string; phone: string | null } | null;
  roles: string[];
  passwordHash: string; // simple hash for offline verification
  cachedAt: number;
}

const DB_NAME = "mosap3-auth";
const DB_VERSION = 1;
const STORE = "session";

async function getAuthDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    },
  });
}

/** Simple hash for offline password verification (NOT cryptographic security) */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "mosap3-salt");
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Save session after successful online login */
export async function cacheSession(
  email: string,
  password: string,
  userId: string,
  profile: CachedSession["profile"],
  roles: string[],
): Promise<void> {
  const db = await getAuthDb();
  const passwordHash = await hashPassword(password);
  await db.put(STORE, {
    id: email.toLowerCase(),
    email: email.toLowerCase(),
    userId,
    profile,
    roles,
    passwordHash,
    cachedAt: Date.now(),
  } satisfies CachedSession);
}

/** Attempt offline login by verifying cached credentials */
export async function offlineLogin(
  email: string,
  password: string,
): Promise<CachedSession | null> {
  const db = await getAuthDb();
  const cached = await db.get(STORE, email.toLowerCase());
  if (!cached) return null;

  const hash = await hashPassword(password);
  if (hash !== cached.passwordHash) return null;

  return cached as CachedSession;
}

/** Get any cached session for the given email */
export async function getCachedSession(email: string): Promise<CachedSession | null> {
  const db = await getAuthDb();
  return (await db.get(STORE, email.toLowerCase())) as CachedSession | null;
}

/** Get the most recent cached session (for auto-restore) */
export async function getLastSession(): Promise<CachedSession | null> {
  const db = await getAuthDb();
  const all = await db.getAll(STORE);
  if (all.length === 0) return null;
  // Return the most recently cached
  return all.sort((a, b) => b.cachedAt - a.cachedAt)[0] as CachedSession;
}

/** Clear cached session on logout */
export async function clearCachedSession(): Promise<void> {
  const db = await getAuthDb();
  await db.clear(STORE);
}
