import { describe, it, expect, vi, beforeEach } from "vitest";
import { validatePatecAssignment, type PatecLike } from "@/lib/patecAssignmentGuard";

/**
 * Cobertura dos guards usados por `handleSavePatec` (individual) e
 * `handleBulkSave` (em lote) em `src/pages/Patec.tsx`.
 *
 * Verifica que, quando não existem PATECs válidos para a época
 * seleccionada, a gravação é bloqueada e o toast de erro aparece.
 */

const MILHO: PatecLike = { code: "PATEC-MILHO", legacy_number: 1 };
const MASSANGO: PatecLike = { code: "PATEC-MASSANGO", legacy_number: 2 };
const SEM_LEGADO: PatecLike = { code: "PATEC-NOVO", legacy_number: null };

describe("validatePatecAssignment — guard de atribuição PATEC", () => {
  describe("Época sem PATECs vinculados", () => {
    it("bloqueia quando patecsForSeason está vazio", () => {
      const result = validatePatecAssignment(MILHO, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("no_patecs_for_season");
      expect(result.message).toMatch(/Não existem PATECs disponíveis/);
    });

    it("bloqueia quando o PATEC seleccionado não está entre os da época", () => {
      const result = validatePatecAssignment(MILHO, [MASSANGO]);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("no_patecs_for_season");
    });
  });

  describe("PATEC válido na época", () => {
    it("permite gravar quando o PATEC está vinculado à época e tem legacy_number", () => {
      const result = validatePatecAssignment(MILHO, [MILHO, MASSANGO]);
      expect(result.ok).toBe(true);
    });
  });

  describe("Atribuição vazia (remover PATEC)", () => {
    it("permite gravar mesmo sem PATECs vinculados à época", () => {
      expect(validatePatecAssignment(null, []).ok).toBe(true);
      expect(validatePatecAssignment(undefined, [MILHO]).ok).toBe(true);
    });
  });

  describe("Inconsistência farmers.patec vs patec_code", () => {
    it("bloqueia quando o PATEC seleccionado não tem legacy_number", () => {
      const result = validatePatecAssignment(SEM_LEGADO, [SEM_LEGADO]);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("legacy_mismatch");
    });
  });
});

/**
 * Simulações de `handleSavePatec` e `handleBulkSave`: garantem que,
 * quando o guard falha, o toast é chamado e a chamada ao Supabase
 * (`update`) NÃO acontece.
 */
describe("handleSavePatec / handleBulkSave — bloqueio quando época sem PATECs", () => {
  const toastError = vi.fn();
  const supabaseUpdate = vi.fn();

  beforeEach(() => {
    toastError.mockClear();
    supabaseUpdate.mockClear();
  });

  async function handleSavePatec(opts: {
    editFarmer: { id: string; full_name: string } | null;
    selected: PatecLike | null;
    patecsForSeason: PatecLike[];
  }) {
    if (!opts.editFarmer) return;
    const guard = validatePatecAssignment(opts.selected, opts.patecsForSeason);
    if (!guard.ok) {
      toastError(guard.message);
      return;
    }
    supabaseUpdate({ id: opts.editFarmer.id, patec_code: opts.selected?.code });
  }

  async function handleBulkSave(opts: {
    selectedIds: string[];
    selected: PatecLike | null;
    patecsForSeason: PatecLike[];
  }) {
    if (!opts.selected || opts.selectedIds.length === 0) return;
    const guard = validatePatecAssignment(opts.selected, opts.patecsForSeason);
    if (!guard.ok) {
      toastError(guard.message);
      return;
    }
    supabaseUpdate({ ids: opts.selectedIds, patec_code: opts.selected.code });
  }

  it("handleSavePatec não chama supabase e mostra toast quando a época não tem PATECs", async () => {
    await handleSavePatec({
      editFarmer: { id: "f-1", full_name: "João" },
      selected: MILHO,
      patecsForSeason: [],
    });
    expect(supabaseUpdate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toMatch(/Não existem PATECs disponíveis/);
  });

  it("handleSavePatec grava normalmente quando o PATEC está disponível na época", async () => {
    await handleSavePatec({
      editFarmer: { id: "f-1", full_name: "João" },
      selected: MILHO,
      patecsForSeason: [MILHO],
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(supabaseUpdate).toHaveBeenCalledWith({ id: "f-1", patec_code: "PATEC-MILHO" });
  });

  it("handleBulkSave não chama supabase e mostra toast quando a época não tem PATECs", async () => {
    await handleBulkSave({
      selectedIds: ["f-1", "f-2", "f-3"],
      selected: MILHO,
      patecsForSeason: [MASSANGO], // não inclui MILHO
    });
    expect(supabaseUpdate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toMatch(/Não existem PATECs disponíveis/);
  });

  it("handleBulkSave grava em lote quando o PATEC está disponível na época", async () => {
    await handleBulkSave({
      selectedIds: ["f-1", "f-2"],
      selected: MILHO,
      patecsForSeason: [MILHO],
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(supabaseUpdate).toHaveBeenCalledWith({ ids: ["f-1", "f-2"], patec_code: "PATEC-MILHO" });
  });
});
