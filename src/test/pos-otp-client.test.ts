import { describe, it, expect, beforeEach } from "vitest";
import {
  tickCooldown,
  canResend,
  markOtpProcessing,
  hasOtpProcessing,
  clearOtpLocks,
  resetStateForResend,
} from "@/lib/pos-otp-client";

/** Implementação mínima em memória de sessionStorage para isolar os testes. */
function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    _raw: map,
  };
}

describe("POS OTP — cooldown do botão Reenviar SMS", () => {
  it("decrementa até zero e nunca abaixo", () => {
    expect(tickCooldown(3)).toBe(2);
    expect(tickCooldown(1)).toBe(0);
    expect(tickCooldown(0)).toBe(0);
    expect(tickCooldown(-5)).toBe(0);
  });

  it("simulação de countdown 30→0 termina exactamente em 0", () => {
    let c = 30;
    for (let i = 0; i < 40; i++) c = tickCooldown(c);
    expect(c).toBe(0);
  });

  it("canResend só permite quando cooldown=0 e nenhuma operação em curso", () => {
    expect(canResend(0, false, false)).toBe(true);
    expect(canResend(1, false, false)).toBe(false);
    expect(canResend(0, true, false)).toBe(false);
    expect(canResend(0, false, true)).toBe(false);
  });
});

describe("POS OTP — locks de processamento em sessionStorage", () => {
  let storage: ReturnType<typeof makeStorage>;
  beforeEach(() => { storage = makeStorage(); });

  it("marca e detecta lock para um otp_id", () => {
    expect(hasOtpProcessing(storage, "otp-1")).toBe(false);
    markOtpProcessing(storage, "otp-1", 1000);
    expect(hasOtpProcessing(storage, "otp-1")).toBe(true);
    expect(storage.getItem("pos_otp_processing_otp-1")).toBe("1000");
  });

  it("locks são isolados por otp_id", () => {
    markOtpProcessing(storage, "otp-A");
    expect(hasOtpProcessing(storage, "otp-A")).toBe(true);
    expect(hasOtpProcessing(storage, "otp-B")).toBe(false);
  });

  it("clearOtpLocks remove tanto idempotência como processing", () => {
    storage.setItem("pos_otp_idem_otp-1", "key-A");
    markOtpProcessing(storage, "otp-1");
    clearOtpLocks(storage, "otp-1");
    expect(storage.getItem("pos_otp_idem_otp-1")).toBeNull();
    expect(storage.getItem("pos_otp_processing_otp-1")).toBeNull();
    expect(hasOtpProcessing(storage, "otp-1")).toBe(false);
  });

  it("operações com id nulo são no-op (não criam chaves espúrias)", () => {
    markOtpProcessing(storage, null);
    clearOtpLocks(storage, null);
    expect(hasOtpProcessing(storage, null)).toBe(false);
    expect(storage._raw.size).toBe(0);
  });

  it("erros no sessionStorage não propagam", () => {
    const brokenStorage = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };
    expect(() => markOtpProcessing(brokenStorage, "otp-1")).not.toThrow();
    expect(hasOtpProcessing(brokenStorage, "otp-1")).toBe(false);
    expect(() => clearOtpLocks(brokenStorage, "otp-1")).not.toThrow();
  });
});

describe("POS OTP — reset de estado ao Reenviar SMS", () => {
  it("zera todos os campos relevantes para começar OTP novo", () => {
    const s = resetStateForResend();
    expect(s).toEqual({
      otpCode: "",
      otpExpired: false,
      otpIdempotentReplay: false,
      otpAttemptsLeft: null,
      otpProcessingLocked: false,
      otpId: null,
      otpExpiresAt: null,
      otpMaskedPhone: "",
      otpDevCode: null,
    });
  });

  it("clearOtpLocks + reset deixam o utilizador apto a reenviar (canResend=true)", () => {
    const storage = makeStorage();
    markOtpProcessing(storage, "otp-old");
    storage.setItem("pos_otp_idem_otp-old", "key-old");

    clearOtpLocks(storage, "otp-old");
    const s = resetStateForResend();
    const cooldown = 0; // após cooldown ter chegado a 0

    expect(canResend(cooldown, false, false)).toBe(true);
    expect(s.otpProcessingLocked).toBe(false);
    expect(hasOtpProcessing(storage, "otp-old")).toBe(false);
  });
});
