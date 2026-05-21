// Tests for pos-otp-verify logic.
// Focus: idempotent replay does not duplicate side-effects,
// and the pendente→usado transition is atomic under concurrent calls.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sha256, verifyOtp, type OtpRow, type OtpStore } from "./verify-logic.ts";

/** In-memory store that models Postgres row-level atomicity for the CAS. */
function makeStore(initial: OtpRow) {
  const rows = new Map<string, OtpRow>([[initial.id, { ...initial }]]);
  /** Records every state mutation, so tests can assert no double-processing. */
  const writes: Array<{ id: string; patch: Partial<OtpRow>; op: "cas" | "update" }> = [];

  const store: OtpStore = {
    async get(id) {
      const r = rows.get(id);
      return r ? { ...r } : null;
    },
    async casPendingToUsed(id, patch) {
      // Microtask gap to simulate the await boundary of a real DB round-trip.
      await Promise.resolve();
      const row = rows.get(id);
      if (!row || row.status !== "pendente") return null;
      const next = { ...row, ...patch } as OtpRow;
      rows.set(id, next);
      writes.push({ id, patch, op: "cas" });
      return { ...next };
    },
    async update(id, patch) {
      await Promise.resolve();
      const row = rows.get(id);
      if (!row) return;
      rows.set(id, { ...row, ...patch } as OtpRow);
      writes.push({ id, patch, op: "update" });
    },
  };

  return { store, rows, writes };
}

const CODE = "123456";

async function baseRow(overrides: Partial<OtpRow> = {}): Promise<OtpRow> {
  return {
    id: "otp-1",
    code_hash: await sha256(CODE),
    status: "pendente",
    attempts: 0,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    used_at: null,
    idempotency_key: null,
    idempotency_expires_at: null,
    last_result: null,
    farmer_code: "F-001",
    amount: 1000,
    ...overrides,
  };
}

Deno.test("idempotent replay: same key returns cached result without re-processing", async () => {
  const { store, rows, writes } = makeStore(await baseRow());

  const r1 = await verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-A" });
  assertEquals(r1.status, 200);
  assertEquals(r1.body.success, true);
  assertEquals(r1.body.idempotent_replay, undefined);
  assertEquals(rows.get("otp-1")?.status, "usado");
  const writesAfterFirst = writes.length;

  const r2 = await verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-A" });
  assertEquals(r2.status, 200);
  assertEquals(r2.body.success, true);
  assertEquals(r2.body.idempotent_replay, true);

  // No additional writes on replay → no duplicated sale.
  assertEquals(writes.length, writesAfterFirst, "replay must not mutate state");
});

Deno.test("idempotent replay: different key after success is rejected as 'used'", async () => {
  const { store } = makeStore(await baseRow());

  await verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-A" });
  const r2 = await verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-B" });

  assertEquals(r2.status, 400);
  assertEquals(r2.body.reason, "used");
  assertEquals(r2.body.idempotent_replay, undefined);
});

Deno.test("idempotent replay: expired idempotency TTL is rejected", async () => {
  const { store } = makeStore(await baseRow());

  // Use a tiny TTL so the second call is past expiry.
  const t0 = Date.now();
  const r1 = await verifyOtp(store, {
    otp_id: "otp-1", code: CODE, idempotency_key: "key-A", now: t0, ttlMs: 1000,
  });
  assertEquals(r1.body.success, true);

  const r2 = await verifyOtp(store, {
    otp_id: "otp-1", code: CODE, idempotency_key: "key-A", now: t0 + 5000,
  });
  assertEquals(r2.status, 400);
  assertEquals(r2.body.reason, "used");
  assertEquals(r2.body.idempotent_replay, undefined);
});

Deno.test("CAS atomicity: concurrent verifies → exactly one success, the other is idempotent replay", async () => {
  const { store, rows, writes } = makeStore(await baseRow());

  // Two simultaneous calls with the SAME idempotency_key (double-click scenario).
  const [a, b] = await Promise.all([
    verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-A" }),
    verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-A" }),
  ]);

  const successes = [a, b].filter((r) => r.body.success === true && !r.body.idempotent_replay);
  const replays = [a, b].filter((r) => r.body.idempotent_replay === true);

  assertEquals(successes.length, 1, "exactly one call wins the CAS");
  assertEquals(replays.length, 1, "the loser must get idempotent_replay");
  assertEquals(rows.get("otp-1")?.status, "usado");
  // Exactly one CAS write should have taken effect.
  assertEquals(writes.filter((w) => w.op === "cas").length, 1);
});

Deno.test("CAS atomicity: concurrent verifies with DIFFERENT keys → one success, the other 409 'used'", async () => {
  const { store, writes } = makeStore(await baseRow());

  const [a, b] = await Promise.all([
    verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-A" }),
    verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-B" }),
  ]);

  const results = [a, b].sort((x, y) => x.status - y.status);
  assertEquals(results[0].status, 200);
  assertEquals(results[0].body.success, true);
  assertEquals(results[1].status, 409);
  assertEquals(results[1].body.reason, "used");

  assertEquals(writes.filter((w) => w.op === "cas").length, 1, "only one CAS commit");
});

Deno.test("invalid code increments attempts but does not transition to 'usado'", async () => {
  const { store, rows } = makeStore(await baseRow());

  const r = await verifyOtp(store, { otp_id: "otp-1", code: "000000", idempotency_key: "key-A" });
  assertEquals(r.status, 400);
  assertEquals(r.body.reason, "invalid");
  assertEquals(rows.get("otp-1")?.status, "pendente");
  assertEquals(rows.get("otp-1")?.attempts, 1);
});

Deno.test("expired OTP cannot be consumed", async () => {
  const row = await baseRow({ expires_at: new Date(Date.now() - 1000).toISOString() });
  const { store, rows } = makeStore(row);

  const r = await verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: "key-A" });
  assertEquals(r.status, 400);
  assertEquals(r.body.reason, "expired");
  assertEquals(rows.get("otp-1")?.status, "expirado");
});

Deno.test("input inválido: código não-numérico devolve 400 sem tocar no estado", async () => {
  const { store, rows, writes } = makeStore(await baseRow());

  const r = await verifyOtp(store, { otp_id: "otp-1", code: "abc123", idempotency_key: "k" });
  assertEquals(r.status, 400);
  assertEquals(r.body.reason, "invalid_input");
  assertEquals(rows.get("otp-1")?.status, "pendente");
  assertEquals(writes.length, 0);
});

Deno.test("OTP não encontrado devolve 404", async () => {
  const { store } = makeStore(await baseRow());
  const r = await verifyOtp(store, { otp_id: "missing", code: CODE, idempotency_key: null });
  assertEquals(r.status, 404);
  assertEquals(r.body.reason, "not_found");
});

Deno.test("max tentativas: 5.ª tentativa errada bloqueia OTP como 'falhado'", async () => {
  const { store, rows } = makeStore(await baseRow({ attempts: 4 }));

  const r = await verifyOtp(store, { otp_id: "otp-1", code: "000000", idempotency_key: null });
  assertEquals(r.status, 400);
  assertEquals(r.body.reason, "locked");
  assertEquals(r.body.attempts_left, 0);
  assertEquals(rows.get("otp-1")?.status, "falhado");
});

Deno.test("OTP já em estado 'falhado' rejeita imediatamente sem incrementar tentativas", async () => {
  const { store, writes } = makeStore(await baseRow({ status: "falhado", attempts: 5 }));

  const r = await verifyOtp(store, { otp_id: "otp-1", code: CODE, idempotency_key: null });
  assertEquals(r.status, 400);
  assertEquals(r.body.reason, "locked");
  assertEquals(writes.length, 0, "estado terminal não deve gerar escritas");
});

Deno.test("após reenvio (novo otp_id), o OTP antigo continua independente do novo", async () => {
  // Simula sendOtp: criamos um segundo OTP novo após o primeiro ter sido usado/expirado.
  const oldRow = await baseRow({ id: "otp-old", status: "expirado" });
  const newRow = await baseRow({ id: "otp-new" });

  const oldStore = makeStore(oldRow);
  const newStore = makeStore(newRow);

  // Tentar usar o antigo continua falhando (estado terminal — código não consumido novamente).
  const rOld = await verifyOtp(oldStore.store, { otp_id: "otp-old", code: CODE, idempotency_key: "k1" });
  assert(rOld.status >= 400, "OTP antigo em estado terminal não deve devolver 200");
  assertEquals(rOld.body.success, false);

  // O novo OTP aceita o código correcto com nova chave de idempotência.
  const rNew = await verifyOtp(newStore.store, { otp_id: "otp-new", code: CODE, idempotency_key: "k2" });
  assertEquals(rNew.status, 200);
  assertEquals(rNew.body.success, true);
  assert(newStore.rows.get("otp-new")?.status === "usado");
});
