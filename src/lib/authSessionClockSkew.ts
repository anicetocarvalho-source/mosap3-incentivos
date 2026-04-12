import type { Session } from "@supabase/supabase-js";

type SessionShape = Partial<Session> & Record<string, unknown>;
type StoredPayload = Record<string, unknown> | unknown[];

interface SessionContainer {
  payload: StoredPayload;
  key: string | number | null;
  session: SessionShape;
}

const DEFAULT_SESSION_TTL = 60 * 60;
const CLOCK_SKEW_THRESHOLD = 5 * 60;
const MAX_CLOCK_SKEW_ADJUSTMENT = 12 * 60 * 60;

function getAuthStorageKey(): string | null {
  if (typeof window === "undefined") return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const projectRef = (() => {
    try {
      return supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : null;
    } catch {
      return null;
    }
  })();

  const exactKey = projectRef ? `sb-${projectRef}-auth-token` : null;
  if (exactKey && window.localStorage.getItem(exactKey)) return exactKey;

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
      return key;
    }
  }

  return exactKey;
}

function isSessionShape(value: unknown): value is SessionShape {
  return Boolean(
    value &&
      typeof value === "object" &&
      "access_token" in (value as Record<string, unknown>) &&
      "refresh_token" in (value as Record<string, unknown>),
  );
}

function readStoredPayload(): unknown | null {
  const storageKey = getAuthStorageKey();
  if (!storageKey || typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeStoredPayload(value: unknown): void {
  const storageKey = getAuthStorageKey();
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function extractStoredSession(payload: unknown): SessionContainer | null {
  if (!payload) return null;

  if (isSessionShape(payload)) {
    return {
      payload: payload as StoredPayload,
      key: null,
      session: payload,
    };
  }

  if (Array.isArray(payload) && isSessionShape(payload[0])) {
    return {
      payload,
      key: 0,
      session: payload[0],
    };
  }

  if (typeof payload !== "object") return null;

  const objectPayload = payload as Record<string, unknown>;
  if (isSessionShape(objectPayload.currentSession)) {
    return {
      payload: objectPayload,
      key: "currentSession",
      session: objectPayload.currentSession,
    };
  }

  return null;
}

function normalizeSessionShape<T extends SessionShape>(session: T): { session: T; adjusted: boolean } {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = typeof session.expires_at === "number" ? session.expires_at : null;

  if (!session.refresh_token || !expiresAt) {
    return { session, adjusted: false };
  }

  const skew = now - expiresAt;
  if (skew <= CLOCK_SKEW_THRESHOLD || skew > MAX_CLOCK_SKEW_ADJUSTMENT) {
    return { session, adjusted: false };
  }

  const ttl =
    typeof session.expires_in === "number" && session.expires_in > 0 && session.expires_in <= DEFAULT_SESSION_TTL
      ? session.expires_in
      : DEFAULT_SESSION_TTL;

  return {
    session: {
      ...session,
      expires_at: now + ttl,
      expires_in: ttl,
    } as T,
    adjusted: true,
  };
}

export function normalizeStoredAuthSessionClockSkew(): void {
  const payload = readStoredPayload();
  const extracted = extractStoredSession(payload);

  if (!payload || !extracted) return;

  const { session, adjusted } = normalizeSessionShape(extracted.session);
  if (!adjusted) return;

  if (extracted.key === null) {
    writeStoredPayload(session);
    return;
  }

  if (Array.isArray(extracted.payload) && typeof extracted.key === "number") {
    extracted.payload[extracted.key] = session;
    writeStoredPayload(extracted.payload);
    return;
  }

  if (!Array.isArray(extracted.payload) && typeof extracted.key === "string") {
    extracted.payload[extracted.key] = session;
    writeStoredPayload(extracted.payload);
  }
}

export function normalizeAuthSessionClockSkew(session: Session | null): Session | null {
  if (!session) return null;

  const { session: normalizedSession, adjusted } = normalizeSessionShape(session as SessionShape);
  if (adjusted) {
    writeStoredPayload(normalizedSession);
  }

  return normalizedSession as Session;
}

normalizeStoredAuthSessionClockSkew();