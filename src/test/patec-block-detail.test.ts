/**
 * Testes da lógica que alimenta o Alert do POS quando o PATEC bloqueia a venda.
 *
 * Verifica que:
 *  1. `computePatecAvailability` devolve o motivo correcto (com title/message/hint)
 *     para cada cenário (inactivo, fora de época futura/encerrada, sem épocas, etc.).
 *  2. `isPaymentBlocked(block)` — usada como `disabled={!!patecBlock}` no botão
 *     "Processar Pagamento" / "Emitir FT" — devolve `true` em qualquer cenário
 *     bloqueado, garantindo que o utilizador NÃO consegue clicar para finalizar.
 */
import { describe, it, expect } from "vitest";
import {
  computePatecAvailability,
  isPaymentBlocked,
  type PatecRow,
  type SeasonRow,
  type PatecSeasonLink,
} from "@/lib/patecAvailability";

const REF_DATE = new Date("2026-05-15");

const patecActive: PatecRow = { id: "p1", code: "PATEC-MILHO", name: "Milho", is_active: true };
const patecInactive: PatecRow = { id: "p1", code: "PATEC-MILHO", name: "Milho", is_active: false };

const seasonOpen: SeasonRow = { id: "s1", name: "2025/26", is_active: true, start_date: "2026-01-01", end_date: "2026-12-31" };
const seasonFuture: SeasonRow = { id: "s2", name: "2026/27", is_active: true, start_date: "2026-09-01", end_date: "2027-03-31" };
const seasonClosed: SeasonRow = { id: "s3", name: "2024/25", is_active: true, start_date: "2024-01-01", end_date: "2025-12-31" };
const seasonInactive: SeasonRow = { ...seasonOpen, id: "s4", is_active: false };

const link = (sid: string): PatecSeasonLink => ({ patec_id: "p1", season_id: sid });

describe("computePatecAvailability — motivo do Alert no POS", () => {
  it("permite venda quando há época em curso (ok: true)", () => {
    const r = computePatecAvailability("PATEC-MILHO", patecActive, [link("s1")], [seasonOpen], REF_DATE);
    expect(r.ok).toBe(true);
    expect(isPaymentBlocked(r.ok ? null : r.detail)).toBe(false);
  });

  it("legacy (patec_code = null) não bloqueia", () => {
    const r = computePatecAvailability(null, null, [], [], REF_DATE);
    expect(r.ok).toBe(true);
  });

  it("código desconhecido → reason='unknown_code' e botão desactivado", () => {
    const r = computePatecAvailability("PATEC-NADA", null, [], [], REF_DATE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail.reason).toBe("unknown_code");
      expect(r.detail.title).toContain("Pacote não encontrado");
      expect(r.detail.message).toContain("PATEC-NADA");
      expect(isPaymentBlocked(r.detail)).toBe(true);
    }
  });

  it("PATEC inactivo → reason='inactive_patec' com nome no título", () => {
    const r = computePatecAvailability("PATEC-MILHO", patecInactive, [link("s1")], [seasonOpen], REF_DATE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail.reason).toBe("inactive_patec");
      expect(r.detail.title).toContain("desactivado");
      expect(r.detail.message).toContain("Milho");
      expect(r.detail.hint).toContain("suspensas");
      expect(isPaymentBlocked(r.detail)).toBe(true);
    }
  });

  it("sem links a épocas → reason='no_seasons'", () => {
    const r = computePatecAvailability("PATEC-MILHO", patecActive, [], [], REF_DATE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail.reason).toBe("no_seasons");
      expect(isPaymentBlocked(r.detail)).toBe(true);
    }
  });

  it("todas as épocas inactivas → reason='no_active_seasons'", () => {
    const r = computePatecAvailability("PATEC-MILHO", patecActive, [link("s4")], [seasonInactive], REF_DATE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail.reason).toBe("no_active_seasons");
      expect(isPaymentBlocked(r.detail)).toBe(true);
    }
  });

  it("época futura → reason='season_future' com nextSeason", () => {
    const r = computePatecAvailability("PATEC-MILHO", patecActive, [link("s2")], [seasonFuture], REF_DATE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail.reason).toBe("season_future");
      expect(r.detail.nextSeason?.name).toBe("2026/27");
      expect(r.detail.nextSeason?.start_date).toBe("2026-09-01");
      expect(r.detail.message).toContain("2026/27");
      expect(isPaymentBlocked(r.detail)).toBe(true);
    }
  });

  it("época encerrada → reason='season_closed' com lastSeason", () => {
    const r = computePatecAvailability("PATEC-MILHO", patecActive, [link("s3")], [seasonClosed], REF_DATE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail.reason).toBe("season_closed");
      expect(r.detail.lastSeason?.name).toBe("2024/25");
      expect(r.detail.lastSeason?.end_date).toBe("2025-12-31");
      expect(isPaymentBlocked(r.detail)).toBe(true);
    }
  });

  it("múltiplas épocas com pelo menos uma em curso → permite venda", () => {
    const r = computePatecAvailability(
      "PATEC-MILHO",
      patecActive,
      [link("s1"), link("s2"), link("s3")],
      [seasonOpen, seasonFuture, seasonClosed],
      REF_DATE,
    );
    expect(r.ok).toBe(true);
  });

  it("inicio de época (boundary) é considerado em curso", () => {
    const r = computePatecAvailability("PATEC-MILHO", patecActive, [link("s1")], [seasonOpen], new Date("2026-01-01"));
    expect(r.ok).toBe(true);
  });

  it("fim de época (boundary) é considerado em curso", () => {
    const r = computePatecAvailability("PATEC-MILHO", patecActive, [link("s1")], [seasonOpen], new Date("2026-12-31"));
    expect(r.ok).toBe(true);
  });
});

describe("isPaymentBlocked — regra do botão Processar Pagamento / Emitir FT", () => {
  it("null/undefined → não bloqueia (clique permitido)", () => {
    expect(isPaymentBlocked(null)).toBe(false);
    expect(isPaymentBlocked(undefined)).toBe(false);
  });

  it("qualquer detail → bloqueia (clique impedido)", () => {
    const reasons = [
      "inactive_patec", "no_seasons", "no_active_seasons",
      "season_future", "season_closed", "unknown_code",
    ] as const;
    for (const reason of reasons) {
      expect(
        isPaymentBlocked({ reason, title: "x", message: "y", hint: "z" }),
      ).toBe(true);
    }
  });
});
