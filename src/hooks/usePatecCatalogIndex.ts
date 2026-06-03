import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Carrega de patec_items todos os nomes (normalizados) e devolve estruturas
 * para classificar produtos do catálogo / stock como "Em PATEC" vs "Fora de PATEC".
 *
 * Comparação: case-insensitive, sem acentos, sem espaços extra.
 * Chave: nome do item.
 */
export interface PatecCatalogIndex {
  loading: boolean;
  /** Set de nomes (normalizados) que existem em algum PATEC. */
  names: Set<string>;
  /** Mapa nome normalizado → lista de patec_codes (ordenada). */
  patecsByName: Record<string, string[]>;
  /** Helper: lista de patec_codes para um produto, ou []. */
  getPatecCodes: (name: string | null | undefined) => string[];
  /** Helper: true se nome existe em algum PATEC. */
  isInAnyPatec: (name: string | null | undefined) => boolean;
}

const norm = (s: string | null | undefined) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

let _cache: { names: Set<string>; patecsByName: Record<string, string[]>; ts: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export function usePatecCatalogIndex(): PatecCatalogIndex {
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<Set<string>>(new Set());
  const [patecsByName, setPatecsByName] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (_cache && Date.now() - _cache.ts < TTL_MS) {
        if (cancelled) return;
        setNames(_cache.names);
        setPatecsByName(_cache.patecsByName);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("patec_items" as any)
        .select("name, patec_code");
      if (cancelled) return;
      const map: Record<string, Set<string>> = {};
      for (const row of (data as any[]) || []) {
        const key = norm(row.name);
        if (!key) continue;
        (map[key] ||= new Set()).add(row.patec_code || "");
      }
      const finalMap: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(map)) {
        finalMap[k] = Array.from(v).filter(Boolean).sort();
      }
      const set = new Set(Object.keys(finalMap));
      _cache = { names: set, patecsByName: finalMap, ts: Date.now() };
      setNames(set);
      setPatecsByName(finalMap);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    names,
    patecsByName,
    getPatecCodes: (name) => patecsByName[norm(name)] || [],
    isInAnyPatec: (name) => names.has(norm(name)),
  };
}
