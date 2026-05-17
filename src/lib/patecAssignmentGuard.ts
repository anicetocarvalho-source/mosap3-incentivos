/**
 * Guards puros para a atribuição de PATEC (individual ou em lote).
 * Extraído de `handleSavePatec` / `handleBulkSave` em `src/pages/Patec.tsx`
 * para permitir testes unitários sem renderizar a página.
 */

export interface PatecLike {
  code: string;
  legacy_number?: number | null;
}

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: "no_patecs_for_season" | "legacy_mismatch"; message: string };

const MSG_NO_PATECS =
  "Não existem PATECs disponíveis para a época seleccionada. Seleccione uma época com pacotes vinculados.";

export function validatePatecAssignment(
  selected: PatecLike | null | undefined,
  patecsForSeason: PatecLike[],
): GuardResult {
  // Atribuição "vazia" (remover PATEC) é sempre permitida.
  if (!selected) return { ok: true };

  if (!patecsForSeason.some((p) => p.code === selected.code)) {
    return { ok: false, reason: "no_patecs_for_season", message: MSG_NO_PATECS };
  }

  if (selected.legacy_number === null || selected.legacy_number === undefined) {
    return {
      ok: false,
      reason: "legacy_mismatch",
      message: `Inconsistência detectada: o PATEC ${selected.code} não tem número legado (farmers.patec) associado. Actualize o pacote antes de gravar.`,
    };
  }

  return { ok: true };
}
