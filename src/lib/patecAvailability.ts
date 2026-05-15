/**
 * Réplica em TypeScript do predicado SQL `public.is_patec_available(_code, _at)`.
 *
 * Contrato (espelha exactamente a função SQL):
 *   Devolve `true` SE E SÓ SE existe pelo menos um link patec→época onde:
 *     - patec.is_active = true
 *     - patec.code = _code
 *     - season.is_active = true
 *     - _at::date BETWEEN season.start_date AND season.end_date  (inclusivo, ambos os lados)
 *
 * Esta função é usada para testes unitários da lógica de disponibilidade
 * sem depender de uma ligação à base de dados. Qualquer alteração ao
 * predicado SQL DEVE ser reflectida aqui (e nos testes).
 */
export interface PatecRow {
  id: string;
  code: string;
  is_active: boolean;
}

export interface SeasonRow {
  id: string;
  is_active: boolean;
  start_date: string; // ISO yyyy-mm-dd
  end_date: string;   // ISO yyyy-mm-dd
}

export interface PatecSeasonLink {
  patec_id: string;
  season_id: string;
}

/** Compara apenas a parte de DATA (sem horas/timezone), à imagem de `_at::date`. */
function toDate(d: string | Date): Date {
  if (d instanceof Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  // string yyyy-mm-dd ou ISO completa — usa a parte da data
  const iso = d.length >= 10 ? d.slice(0, 10) : d;
  const [y, m, day] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, day || 1);
}

export function isPatecAvailable(
  code: string,
  at: Date | string,
  patecs: PatecRow[],
  seasons: SeasonRow[],
  links: PatecSeasonLink[],
): boolean {
  const atDate = toDate(at);

  const patec = patecs.find((p) => p.code === code && p.is_active);
  if (!patec) return false;

  const linkedSeasonIds = new Set(
    links.filter((l) => l.patec_id === patec.id).map((l) => l.season_id),
  );
  if (linkedSeasonIds.size === 0) return false;

  return seasons.some((s) => {
    if (!linkedSeasonIds.has(s.id)) return false;
    if (!s.is_active) return false;
    const start = toDate(s.start_date);
    const end = toDate(s.end_date);
    return atDate.getTime() >= start.getTime() && atDate.getTime() <= end.getTime();
  });
}
