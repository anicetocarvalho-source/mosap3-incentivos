// Teste de integração do fluxo OTP do POS Mosap3Pay.
// Simula end-to-end: sendOtp → verificação errada → reenvio → tentativa com
// o código antigo (superseded) → validação com o código novo, confirmando
// que os locks do sessionStorage são limpos e o botão "Reenviar SMS" volta
// a estar habilitado.
//
// As edge functions pos-otp-send e pos-otp-verify são substituídas por um
// "fake backend" em memória que reproduz a semântica relevante (supersedir
// pendentes no resend; devolver 409 'superseded' quando o código antigo é
// submetido). Os helpers do cliente vêm directamente de @/lib/pos-otp-client.

import { describe, it, expect, beforeEach } from "vitest";
import {
  tickCooldown,
  canResend,
  markOtpProcessing,
  hasOtpProcessing,
  clearOtpLocks,
  resetStateForResend,
} from "@/lib/pos-otp-client";

// ---------------------- Storage em memória ----------------------
function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    _raw: map,
  };
}

// ---------------------- Fake backend OTP ----------------------
type Status = "pendente" | "usado" | "falhado" | "expirado";

interface OtpRow {
  id: string;
  farmer_code: string;
  code: string; // plaintext só para o fake (no real é hash)
  status: Status;
  attempts: number;
  expires_at: number;
}

interface VerifyResp {
  status: number;
  body: { success: boolean; reason?: string; attempts_left?: number };
}

function makeFakeBackend() {
  const rows = new Map<string, OtpRow>();
  let seq = 0;
  const MAX_ATTEMPTS = 5;
  const TTL_MS = 5 * 60_000;

  function sendOtp(farmer_code: string): { otp_id: string; code: string } {
    // Supersede TODOS os pendentes deste farmer (independente de expires_at).
    for (const r of rows.values()) {
      if (r.farmer_code === farmer_code && r.status === "pendente") {
        r.status = "expirado";
      }
    }
    const id = `otp-${++seq}`;
    const code = String(100000 + seq).padStart(6, "0");
    rows.set(id, {
      id, farmer_code, code,
      status: "pendente",
      attempts: 0,
      expires_at: Date.now() + TTL_MS,
    });
    return { otp_id: id, code };
  }

  function verifyOtp(otp_id: string, code: string): VerifyResp {
    const row = rows.get(otp_id);
    if (!row) return { status: 404, body: { success: false, reason: "not_found" } };
    if (row.status === "usado") return { status: 400, body: { success: false, reason: "used" } };
    if (row.status === "falhado") return { status: 400, body: { success: false, reason: "locked" } };
    if (row.status === "expirado") {
      // Caso superseded por reenvio: 409 (alinhado com verify-logic.ts).
      return { status: 409, body: { success: false, reason: "superseded" } };
    }
    if (Date.now() > row.expires_at) {
      row.status = "expirado";
      return { status: 400, body: { success: false, reason: "expired" } };
    }
    if (row.code !== code) {
      row.attempts += 1;
      if (row.attempts >= MAX_ATTEMPTS) {
        row.status = "falhado";
        return { status: 400, body: { success: false, reason: "locked", attempts_left: 0 } };
      }
      return { status: 400, body: { success: false, reason: "invalid", attempts_left: MAX_ATTEMPTS - row.attempts } };
    }
    row.status = "usado";
    return { status: 200, body: { success: true } };
  }

  return { sendOtp, verifyOtp, rows };
}

// ---------------------- Testes ----------------------
describe("POS OTP — integração send → verify-errado → reenvio → superseded → verify-novo", () => {
  let storage: ReturnType<typeof makeStorage>;
  let backend: ReturnType<typeof makeFakeBackend>;

  beforeEach(() => {
    storage = makeStorage();
    backend = makeFakeBackend();
  });

  it("ciclo completo: locks são limpos e o pagamento pode prosseguir com o novo OTP", () => {
    // 1) Envio inicial → cliente marca processing lock.
    const first = backend.sendOtp("F-001");
    markOtpProcessing(storage, first.otp_id);
    expect(hasOtpProcessing(storage, first.otp_id)).toBe(true);

    // 2) Utilizador digita código errado → 400 invalid, lock continua activo.
    const wrong = backend.verifyOtp(first.otp_id, "000000");
    expect(wrong.status).toBe(400);
    expect(wrong.body.reason).toBe("invalid");
    expect(wrong.body.attempts_left).toBe(4);
    expect(hasOtpProcessing(storage, first.otp_id)).toBe(true);

    // 3) Cooldown chega a 0 → utilizador clica "Reenviar SMS".
    //    Cliente: limpa locks do antigo, faz reset de estado e envia novo OTP.
    let cooldown = 3;
    for (let i = 0; i < 5; i++) cooldown = tickCooldown(cooldown);
    expect(cooldown).toBe(0);
    expect(canResend(cooldown, false, false)).toBe(true);

    clearOtpLocks(storage, first.otp_id);
    const fresh = resetStateForResend();
    expect(fresh.otpProcessingLocked).toBe(false);
    expect(hasOtpProcessing(storage, first.otp_id)).toBe(false);
    expect(storage.getItem(`pos_otp_idem_${first.otp_id}`)).toBeNull();

    const second = backend.sendOtp("F-001");
    expect(second.otp_id).not.toBe(first.otp_id);
    expect(second.code).not.toBe(first.code);
    markOtpProcessing(storage, second.otp_id);

    // 4) O OTP antigo foi supersedido — qualquer tentativa devolve 409 'superseded'.
    const oldAttempt = backend.verifyOtp(first.otp_id, first.code);
    expect(oldAttempt.status).toBe(409);
    expect(oldAttempt.body.reason).toBe("superseded");

    // 5) O novo OTP aceita o código correcto → 200, pagamento prossegue.
    const ok = backend.verifyOtp(second.otp_id, second.code);
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);

    // 6) Após sucesso, cliente limpa locks do novo OTP.
    clearOtpLocks(storage, second.otp_id);
    expect(hasOtpProcessing(storage, second.otp_id)).toBe(false);
    expect(storage._raw.size).toBe(0);
  });

  it("max tentativas no OTP antigo + reenvio: bloqueio do antigo não impede o novo", () => {
    const first = backend.sendOtp("F-002");
    markOtpProcessing(storage, first.otp_id);

    // 5 tentativas erradas → 'locked'.
    let last: VerifyResp | null = null;
    for (let i = 0; i < 5; i++) last = backend.verifyOtp(first.otp_id, "000000");
    expect(last!.status).toBe(400);
    expect(last!.body.reason).toBe("locked");

    // Reenvio: limpa locks e envia novo OTP.
    clearOtpLocks(storage, first.otp_id);
    resetStateForResend();
    const second = backend.sendOtp("F-002");
    markOtpProcessing(storage, second.otp_id);

    // O antigo agora está 'expirado' (foi supersedido pelo resend), não 'falhado',
    // porque o resend marca todos os pendentes — mas este já era terminal 'falhado'
    // e mantém-se 'falhado'. Tentativa devolve 'locked'.
    const oldAttempt = backend.verifyOtp(first.otp_id, first.code);
    expect(oldAttempt.status).toBe(400);
    expect(oldAttempt.body.reason).toBe("locked");

    // Novo OTP funciona normalmente.
    const ok = backend.verifyOtp(second.otp_id, second.code);
    expect(ok.status).toBe(200);

    clearOtpLocks(storage, second.otp_id);
    expect(storage._raw.size).toBe(0);
  });

  it("reenvios múltiplos consecutivos: apenas o último OTP é válido", () => {
    const a = backend.sendOtp("F-003");
    const b = backend.sendOtp("F-003");
    const c = backend.sendOtp("F-003");

    expect(backend.verifyOtp(a.otp_id, a.code).body.reason).toBe("superseded");
    expect(backend.verifyOtp(b.otp_id, b.code).body.reason).toBe("superseded");
    const ok = backend.verifyOtp(c.otp_id, c.code);
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
  });
});
