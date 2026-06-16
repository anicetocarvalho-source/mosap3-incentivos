import { useMemo } from "react";
import { usePatecs, type Patec } from "./usePatecs";

/**
 * Formato unificado de nome de PATEC em todo o sistema.
 * Espelha o que /patec (PatecsTab) mostra: `{code} — {cultures || name}`.
 */
export function formatPatecLabel(p: Patec | undefined | null, fallback?: string) {
  if (!p) return fallback ?? "PATEC";
  const desc = (p.cultures || p.name || "").trim();
  return desc ? `${p.code} — ${desc}` : p.code;
}

/**
 * Hook utilitário: devolve a lista de PATECs activos + helpers para mostrar/
 * encontrar pacotes em qualquer ecrã (POS, Perfil, Agricultores, etc.).
 *
 * Garante que o que aparece é exactamente o catálogo `/patec`.
 */
export function usePatecLabel(opts: { activeOnly?: boolean } = { activeOnly: true }) {
  const { patecs, loading, refetch } = usePatecs({ activeOnly: opts.activeOnly });

  const byLegacy = useMemo(() => {
    const m = new Map<number, Patec>();
    for (const p of patecs) if (p.legacy_number != null) m.set(p.legacy_number, p);
    return m;
  }, [patecs]);

  const byCode = useMemo(() => {
    const m = new Map<string, Patec>();
    for (const p of patecs) m.set(p.code, p);
    return m;
  }, [patecs]);

  const labelByLegacy = (n: number | null | undefined): string => {
    if (n == null) return "Sem PATEC";
    return formatPatecLabel(byLegacy.get(n), `PATEC ${n}`);
  };

  const labelByCode = (code: string | null | undefined): string => {
    if (!code) return "Sem PATEC";
    return formatPatecLabel(byCode.get(code), code);
  };

  return { patecs, loading, refetch, byLegacy, byCode, labelByLegacy, labelByCode };
}
