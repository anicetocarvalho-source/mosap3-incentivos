// Pure verification logic for pos-otp-verify.
// Extracted from index.ts so it can be unit-tested with an in-memory store.
// All side-effects (DB reads/writes) go through the OtpStore interface.

export type OtpStatus = "pendente" | "usado" | "falhado" | "expirado";

export interface OtpRow {
  id: string;
  code_hash: string;
  status: OtpStatus;
  attempts: number | null;
  expires_at: string;
  used_at?: string | null;
  idempotency_key?: string | null;
  idempotency_expires_at?: string | null;
  last_result?: Record<string, unknown> | null;
  farmer_code?: string | null;
  amount?: number | null;
}

export interface OtpStore {
  /** Read the OTP row. */
  get(id: string): Promise<OtpRow | null>;
  /** Atomic compare-and-set: applies `patch` only if current status is 'pendente'.
   *  Returns the new row on success, or null if the row was no longer pendente. */
  casPendingToUsed(id: string, patch: Partial<OtpRow>): Promise<OtpRow | null>;
  /** Non-atomic update used for attempts/expired/locked transitions. */
  update(id: string, patch: Partial<OtpRow>): Promise<void>;
}

export interface VerifyInput {
  otp_id: string;
  code: string;
  idempotency_key: string | null;
  now?: number; // override for tests
  ttlMs?: number; // override for tests; default 24h
}

export interface VerifyResult {
  status: number;
  body: Record<string, unknown>;
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const MAX_ATTEMPTS = 5;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export async function verifyOtp(
  store: OtpStore,
  input: VerifyInput,
): Promise<VerifyResult> {
  const { otp_id, code, idempotency_key } = input;
  const now = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;

  if (!otp_id || !/^\d{6}$/.test(code)) {
    return { status: 400, body: { success: false, error: "Código OTP inválido.", reason: "invalid_input" } };
  }

  const otp = await store.get(otp_id);
  if (!otp) {
    return { status: 404, body: { success: false, error: "OTP não encontrado.", reason: "not_found" } };
  }

  // Idempotent replay (within TTL).
  const idemValid =
    otp.idempotency_expires_at == null ||
    new Date(otp.idempotency_expires_at).getTime() > now;
  if (
    idempotency_key &&
    otp.idempotency_key === idempotency_key &&
    otp.status === "usado" &&
    otp.last_result &&
    idemValid
  ) {
    return { status: 200, body: { ...(otp.last_result as Record<string, unknown>), idempotent_replay: true } };
  }

  if (otp.status === "usado") {
    return { status: 400, body: { success: false, error: "Este código já foi usado.", reason: "used" } };
  }
  if (otp.status === "falhado") {
    return { status: 400, body: { success: false, error: "Demasiadas tentativas. Solicite um novo código.", reason: "locked" } };
  }
  if (new Date(otp.expires_at).getTime() < now) {
    await store.update(otp_id, { status: "expirado" });
    return { status: 400, body: { success: false, error: "Código expirado. Solicite um novo.", reason: "expired" } };
  }
  if ((otp.attempts ?? 0) >= MAX_ATTEMPTS) {
    await store.update(otp_id, { status: "falhado" });
    return { status: 400, body: { success: false, error: "Demasiadas tentativas. Solicite um novo código.", reason: "locked" } };
  }

  const hash = await sha256(code);
  if (hash !== otp.code_hash) {
    const newAttempts = (otp.attempts ?? 0) + 1;
    const newStatus: OtpStatus = newAttempts >= MAX_ATTEMPTS ? "falhado" : "pendente";
    await store.update(otp_id, { attempts: newAttempts, status: newStatus });
    return {
      status: 400,
      body: {
        success: false,
        error: "Código incorrecto.",
        reason: newStatus === "falhado" ? "locked" : "invalid",
        attempts_left: Math.max(0, MAX_ATTEMPTS - newAttempts),
      },
    };
  }

  const result: Record<string, unknown> = { success: true };
  const idempotency_expires_at = idempotency_key
    ? new Date(now + ttlMs).toISOString()
    : null;

  const updated = await store.casPendingToUsed(otp_id, {
    status: "usado",
    used_at: new Date(now).toISOString(),
    attempts: (otp.attempts ?? 0) + 1,
    idempotency_key,
    idempotency_expires_at,
    last_result: result,
  });

  if (!updated) {
    // Lost the race; re-read for idempotent response.
    const fresh = await store.get(otp_id);
    const freshIdemValid =
      !fresh?.idempotency_expires_at ||
      new Date(fresh.idempotency_expires_at).getTime() > now;
    if (
      fresh?.status === "usado" &&
      idempotency_key &&
      fresh.idempotency_key === idempotency_key &&
      fresh.last_result &&
      freshIdemValid
    ) {
      return { status: 200, body: { ...(fresh.last_result as Record<string, unknown>), idempotent_replay: true } };
    }
    return { status: 409, body: { success: false, error: "Este código já foi usado.", reason: "used" } };
  }

  return { status: 200, body: result };
}
