import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook genérico para listagens com paginação, pesquisa e filtros NO SERVIDOR.
 *
 * Em vez de carregar todas as linhas, faz apenas o `range()` da página atual,
 * obtendo a contagem total via `count: 'exact'`. Pesquisa usa `or(ilike...)`
 * apoiada em índices trigram (pg_trgm) — quase instantânea mesmo com 100k+ linhas.
 */

export type SortDir = "asc" | "desc";

export interface ServerTableOptions<F extends Record<string, any> = Record<string, any>> {
  /** Nome da tabela no schema public */
  table: string;
  /** Colunas a seleccionar (igual a supabase select). Default '*' */
  columns?: string;
  /** Página actual (1-based) */
  page: number;
  /** Linhas por página */
  pageSize: number;
  /** Termo de pesquisa livre */
  search?: string;
  /** Colunas onde aplicar a pesquisa via ILIKE (com pg_trgm) */
  searchColumns?: string[];
  /** Filtros de igualdade — { column: value | undefined }. undefined/'all' são ignorados. */
  filters?: F;
  /** Ordenação */
  sort?: { column: string; dir: SortDir; nullsFirst?: boolean };
  /** Coluna a excluir (ex.: status != 'Removido'). { column, value } */
  excludeEq?: { column: string; value: string };
  /** Filtros de intervalo numérico/temporal (gte/lte). undefined/null são ignorados. */
  rangeFilters?: Array<{ column: string; gte?: number | string | null; lte?: number | string | null }>;
  /** Filtro OR genérico (ex.: para pesquisa de produtor por código OU nome). */
  orFilter?: string;
  /** Permite desactivar enquanto não há contexto (ex.: auth) */
  enabled?: boolean;
  /** Chave extra para o cache (scope, role, etc.) */
  cacheKey?: unknown[];
}

export interface ServerTableResult<T> {
  rows: T[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
}

const escapeIlike = (s: string) => s.replace(/[%,()*]/g, " ").trim();

export function useServerTable<T = any>(opts: ServerTableOptions): ServerTableResult<T> {
  const {
    table,
    columns = "*",
    page,
    pageSize,
    search = "",
    searchColumns = [],
    filters = {},
    sort,
    excludeEq,
    enabled = true,
    cacheKey = [],
  } = opts;

  const filtersKey = useMemo(
    () =>
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== "" && v !== "all")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("|"),
    [filters]
  );

  const q = useQuery<{ rows: T[]; total: number }>({
    queryKey: [
      "srvTable",
      table,
      columns,
      page,
      pageSize,
      escapeIlike(search),
      filtersKey,
      sort?.column,
      sort?.dir,
      excludeEq?.column,
      excludeEq?.value,
      ...cacheKey,
    ],
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      let query: any = (supabase as any).from(table).select(columns, { count: "exact" });

      // Filtros de igualdade
      for (const [k, v] of Object.entries(filters)) {
        if (v === undefined || v === "" || v === "all") continue;
        query = query.eq(k, v);
      }

      if (excludeEq) query = query.neq(excludeEq.column, excludeEq.value);

      const term = escapeIlike(search);
      if (term && searchColumns.length) {
        const ors = searchColumns.map((c) => `${c}.ilike.%${term}%`).join(",");
        query = query.or(ors);
      }

      if (sort?.column) {
        query = query.order(sort.column, {
          ascending: sort.dir === "asc",
          nullsFirst: sort.nullsFirst,
        });
      }

      const from = Math.max(0, (page - 1) * pageSize);
      const to = from + pageSize - 1;
      const { data, count, error } = await query.range(from, to);
      if (error) throw error;
      return { rows: (data || []) as T[], total: count ?? 0 };
    },
  });

  return {
    rows: q.data?.rows ?? [],
    total: q.data?.total ?? 0,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError,
    refetch: q.refetch,
  };
}

/** Pequeno hook auxiliar para debouncar a pesquisa */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
