import { describe, it, expect } from "vitest";
import {
  isPatecAvailable,
  type PatecRow,
  type SeasonRow,
  type PatecSeasonLink,
} from "@/lib/patecAvailability";

/**
 * Testes do predicado `is_patec_available` (replicado em TS a partir do SQL).
 * Cobre:
 *  - época em curso
 *  - época futura
 *  - época encerrada
 *  - época inactiva
 *  - pacote inactivo
 *  - pacote sem épocas associadas
 *  - múltiplas épocas (uma válida, outras não)
 *  - bordos (data exactamente igual a start/end)
 */
describe("is_patec_available — disponibilidade de PATEC", () => {
  const baseDate = new Date("2026-05-15"); // referência fixa

  // PATECs de teste
  const milho: PatecRow = { id: "p-milho", code: "PATEC-MILHO", is_active: true };
  const massango: PatecRow = { id: "p-massango", code: "PATEC-MASSANGO", is_active: true };
  const arquivado: PatecRow = { id: "p-arquiv", code: "PATEC-ARQUIVO", is_active: false };

  const patecs: PatecRow[] = [milho, massango, arquivado];

  // Épocas
  const epocaCurrente: SeasonRow = {
    id: "s-curr", is_active: true,
    start_date: "2026-04-01", end_date: "2026-09-30",
  };
  const epocaFutura: SeasonRow = {
    id: "s-fut", is_active: true,
    start_date: "2027-01-01", end_date: "2027-08-31",
  };
  const epocaEncerrada: SeasonRow = {
    id: "s-end", is_active: true,
    start_date: "2024-04-01", end_date: "2024-09-30",
  };
  const epocaInactiva: SeasonRow = {
    id: "s-inact", is_active: false,
    start_date: "2026-01-01", end_date: "2026-12-31",
  };

  const seasons: SeasonRow[] = [epocaCurrente, epocaFutura, epocaEncerrada, epocaInactiva];

  describe("Época em curso", () => {
    it("permite venda quando o pacote tem época em curso", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaCurrente.id }];
      expect(isPatecAvailable("PATEC-MILHO", baseDate, patecs, seasons, links)).toBe(true);
    });

    it("permite venda no primeiro dia da época (limite inferior inclusivo)", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaCurrente.id }];
      expect(isPatecAvailable("PATEC-MILHO", "2026-04-01", patecs, seasons, links)).toBe(true);
    });

    it("permite venda no último dia da época (limite superior inclusivo)", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaCurrente.id }];
      expect(isPatecAvailable("PATEC-MILHO", "2026-09-30", patecs, seasons, links)).toBe(true);
    });
  });

  describe("Época futura", () => {
    it("bloqueia venda quando a única época do pacote ainda não começou", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaFutura.id }];
      expect(isPatecAvailable("PATEC-MILHO", baseDate, patecs, seasons, links)).toBe(false);
    });

    it("bloqueia venda um dia antes do início da época", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaCurrente.id }];
      expect(isPatecAvailable("PATEC-MILHO", "2026-03-31", patecs, seasons, links)).toBe(false);
    });
  });

  describe("Época encerrada", () => {
    it("bloqueia venda quando todas as épocas do pacote já terminaram", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaEncerrada.id }];
      expect(isPatecAvailable("PATEC-MILHO", baseDate, patecs, seasons, links)).toBe(false);
    });

    it("bloqueia venda um dia depois do fim da época", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaCurrente.id }];
      expect(isPatecAvailable("PATEC-MILHO", "2026-10-01", patecs, seasons, links)).toBe(false);
    });
  });

  describe("Época inactiva", () => {
    it("bloqueia venda quando a época cobre a data mas está marcada como inactiva", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaInactiva.id }];
      expect(isPatecAvailable("PATEC-MILHO", baseDate, patecs, seasons, links)).toBe(false);
    });
  });

  describe("Pacote inactivo", () => {
    it("bloqueia venda mesmo com época em curso quando o PATEC está desactivado", () => {
      const links: PatecSeasonLink[] = [{ patec_id: arquivado.id, season_id: epocaCurrente.id }];
      expect(isPatecAvailable("PATEC-ARQUIVO", baseDate, patecs, seasons, links)).toBe(false);
    });
  });

  describe("Pacote sem épocas associadas", () => {
    it("bloqueia venda quando não há nenhum link patec_seasons", () => {
      expect(isPatecAvailable("PATEC-MILHO", baseDate, patecs, seasons, [])).toBe(false);
    });

    it("bloqueia venda quando o link aponta para outro pacote", () => {
      const links: PatecSeasonLink[] = [{ patec_id: massango.id, season_id: epocaCurrente.id }];
      expect(isPatecAvailable("PATEC-MILHO", baseDate, patecs, seasons, links)).toBe(false);
    });
  });

  describe("Múltiplas épocas associadas", () => {
    it("permite venda se PELO MENOS UMA das épocas associadas estiver válida", () => {
      const links: PatecSeasonLink[] = [
        { patec_id: milho.id, season_id: epocaEncerrada.id },
        { patec_id: milho.id, season_id: epocaFutura.id },
        { patec_id: milho.id, season_id: epocaCurrente.id }, // a válida
      ];
      expect(isPatecAvailable("PATEC-MILHO", baseDate, patecs, seasons, links)).toBe(true);
    });

    it("bloqueia venda quando todas as épocas associadas estão fora-de-data ou inactivas", () => {
      const links: PatecSeasonLink[] = [
        { patec_id: milho.id, season_id: epocaEncerrada.id },
        { patec_id: milho.id, season_id: epocaFutura.id },
        { patec_id: milho.id, season_id: epocaInactiva.id },
      ];
      expect(isPatecAvailable("PATEC-MILHO", baseDate, patecs, seasons, links)).toBe(false);
    });
  });

  describe("Código de PATEC inexistente", () => {
    it("bloqueia venda quando o código não corresponde a nenhum PATEC", () => {
      const links: PatecSeasonLink[] = [{ patec_id: milho.id, season_id: epocaCurrente.id }];
      expect(isPatecAvailable("PATEC-INEXISTENTE", baseDate, patecs, seasons, links)).toBe(false);
    });
  });
});
