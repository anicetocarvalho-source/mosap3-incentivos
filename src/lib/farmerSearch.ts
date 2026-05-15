/**
 * Lógica pura para pesquisa de agricultores no POS.
 * Mantida fora do componente para ser testável e reutilizável.
 */

export const FARMER_PAGE_SIZE = 50;

/** Mínimo de caracteres antes de disparar pesquisa (1 para puramente numérico, 2 para texto). */
export const minSearchLength = (q: string): number => (/^\d+$/.test(q) ? 1 : 2);

/** True se o termo (após trim) tem comprimento suficiente para pesquisar. */
export const shouldSearch = (q: string): boolean => {
  const t = q.trim();
  return t.length >= minSearchLength(t);
};

/**
 * Sanitiza um termo livre removendo caracteres que partem o operador `.or()`
 * do PostgREST (vírgula e parênteses). Substitui por espaço para preservar
 * separação de palavras.
 */
export const sanitizeForOr = (q: string): string => q.replace(/[(),]/g, " ");

/**
 * Normaliza telefones PT-AO. Devolve `{ digits, alt }`:
 * - `digits` = só dígitos do termo
 * - `alt` = variante alternativa: sem `244` se começar com 244,
 *   ou com `244` prepended se forem 9 dígitos a começar por 9.
 *   String vazia se não houver alternativa relevante.
 */
export const normalizePhone = (q: string): { digits: string; alt: string } => {
  const digits = q.replace(/\D/g, "");
  let alt = "";
  if (digits.length >= 3) {
    if (digits.startsWith("244")) alt = digits.slice(3);
    else if (digits.length === 9 && digits.startsWith("9")) alt = "244" + digits;
  }
  return { digits, alt };
};

/**
 * Constrói os ramos do `.or()` para pesquisa de agricultor por
 * nome/código/BI/telefone (com normalização PT-AO).
 */
export const buildFarmerOrParts = (q: string): string[] => {
  const safe = sanitizeForOr(q);
  const { digits, alt } = normalizePhone(q);
  const parts = [
    `full_name.ilike.%${safe}%`,
    `code.ilike.%${safe}%`,
    `bi.ilike.%${safe}%`,
  ];
  if (digits.length >= 3) parts.push(`phone.ilike.%${digits}%`);
  if (alt && alt !== digits) parts.push(`phone.ilike.%${alt}%`);
  return parts;
};

/** Range PostgREST [from, to] para a página `pageIndex` (0-based) com `FARMER_PAGE_SIZE`. */
export const farmerPageRange = (pageIndex: number): { from: number; to: number } => {
  const from = Math.max(0, pageIndex) * FARMER_PAGE_SIZE;
  return { from, to: from + FARMER_PAGE_SIZE - 1 };
};
