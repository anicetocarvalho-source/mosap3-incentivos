// Helpers puros para o fluxo OTP do POS Mosap3Pay.
// Extraídos para permitir testes unitários sem montar o componente inteiro.

export type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Decrementa o cooldown do botão "Reenviar SMS" garantindo que não passa abaixo de 0. */
export function tickCooldown(current: number): number {
  return Math.max(0, current - 1);
}

/** Indica se o botão de reenviar pode ser pressionado. */
export function canResend(cooldown: number, sending: boolean, verifying: boolean): boolean {
  return cooldown <= 0 && !sending && !verifying;
}

const processingKey = (id: string) => `pos_otp_processing_${id}`;
const idempotencyKey = (id: string) => `pos_otp_idem_${id}`;

/** Marca o OTP como "em processamento" no sessionStorage (sobrevive a refresh). */
export function markOtpProcessing(storage: SessionStorageLike, id: string | null, now = Date.now()): void {
  if (!id) return;
  try { storage.setItem(processingKey(id), String(now)); } catch { /* noop */ }
}

/** Lê se o OTP indicado está marcado como em processamento. */
export function hasOtpProcessing(storage: SessionStorageLike, id: string | null): boolean {
  if (!id) return false;
  try { return !!storage.getItem(processingKey(id)); } catch { return false; }
}

/** Limpa lock de processamento e chave de idempotência (após sucesso ou erro). */
export function clearOtpLocks(storage: SessionStorageLike, id: string | null): void {
  if (!id) return;
  try {
    storage.removeItem(idempotencyKey(id));
    storage.removeItem(processingKey(id));
  } catch { /* noop */ }
}

export interface ResendResetState {
  otpCode: string;
  otpExpired: boolean;
  otpIdempotentReplay: boolean;
  otpAttemptsLeft: number | null;
  otpProcessingLocked: boolean;
  otpId: string | null;
  otpExpiresAt: string | null;
  otpMaskedPhone: string;
  otpDevCode: string | null;
}

/** Estado limpo a aplicar imediatamente antes de chamar a edge function de envio. */
export function resetStateForResend(): ResendResetState {
  return {
    otpCode: "",
    otpExpired: false,
    otpIdempotentReplay: false,
    otpAttemptsLeft: null,
    otpProcessingLocked: false,
    otpId: null,
    otpExpiresAt: null,
    otpMaskedPhone: "",
    otpDevCode: null,
  };
}
