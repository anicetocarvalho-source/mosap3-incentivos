/**
 * Helper para contornar o limite de 1000 linhas do PostgREST.
 *
 * Recebe uma factory que devolve um query builder novo (necessário porque
 * cada `.range()` consome o builder). Faz o primeiro pedido com count exato,
 * calcula quantas páginas faltam e busca o resto em paralelo (chunks de 4).
 */
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const PARALLEL_CHUNK = 4;

type QueryFactory<T> = () => PromiseLike<PostgrestSingleResponse<T[]>> & {
  range: (from: number, to: number) => any;
};

export async function fetchAllPages<T>(
  buildQuery: () => any,
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  // Primeiro pedido: contagem exata + página 0
  const first = await buildQuery().range(0, pageSize - 1);
  if (first.error) throw first.error;

  const all: T[] = [...((first.data as T[]) || [])];
  const total = (first.count as number | null) ?? all.length;

  if (total <= pageSize) return all;

  const totalPages = Math.ceil(total / pageSize);
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 1);

  for (let i = 0; i < remainingPages.length; i += PARALLEL_CHUNK) {
    const chunk = remainingPages.slice(i, i + PARALLEL_CHUNK);
    const results = await Promise.all(
      chunk.map((pageIdx) => {
        const from = pageIdx * pageSize;
        const to = from + pageSize - 1;
        return buildQuery().range(from, to);
      })
    );
    for (const res of results) {
      if (res.error) throw res.error;
      if (res.data) all.push(...(res.data as T[]));
    }
  }

  return all;
}

/**
 * Versão "streaming" — chama `onPage(rows, pageIdx, totalPages)` para cada página
 * sem nunca acumular todos os dados em memória. Páginas são processadas
 * sequencialmente para garantir back-pressure (a CPU consome antes da próxima
 * descarga). Ideal para datasets grandes onde só interessam agregados.
 */
export async function streamAllPages<T>(
  buildQuery: () => any,
  onPage: (rows: T[], pageIdx: number, totalPages: number) => void | Promise<void>,
  pageSize: number = PAGE_SIZE
): Promise<{ totalRows: number; pages: number }> {
  const first = await buildQuery().range(0, pageSize - 1);
  if (first.error) throw first.error;
  const total = (first.count as number | null) ?? (first.data?.length ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  await onPage((first.data as T[]) || [], 0, totalPages);

  for (let pageIdx = 1; pageIdx < totalPages; pageIdx++) {
    const from = pageIdx * pageSize;
    const to = from + pageSize - 1;
    const res = await buildQuery().range(from, to);
    if (res.error) throw res.error;
    await onPage((res.data as T[]) || [], pageIdx, totalPages);
  }
  return { totalRows: total, pages: totalPages };
}
