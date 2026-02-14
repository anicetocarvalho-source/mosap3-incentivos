import { openDB } from "idb";

export interface CachedSession {
  id: string;
  email: string;
  userId: string;
  profile: { full_name: string; phone: string | null } | null;
  roles: string[];
  passwordHash: string;
  salt: string; // per-user random salt
  cachedAt: number;
}

const DB_NAME = "mosap3-auth";
const DB_VERSION = 2; // bumped for salt field
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

/** Derive key using PBKDF2 with per-user salt (100k iterations) */
async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as ArrayBuffer, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function uint8ToHex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
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
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  await db.put(STORE, {
    id: email.toLowerCase(),
    email: email.toLowerCase(),
    userId,
    profile,
    roles,
    passwordHash,
    salt: uint8ToHex(salt),
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

  const salt = hexToUint8(cached.salt);
  const hash = await hashPassword(password, salt);
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
  return all.sort((a, b) => b.cachedAt - a.cachedAt)[0] as CachedSession;
}

/** Clear cached session on logout */
export async function clearCachedSession(): Promise<void> {
  const db = await getAuthDb();
  await db.clear(STORE);
}
