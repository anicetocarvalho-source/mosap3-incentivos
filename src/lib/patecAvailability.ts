/**
 * Réplica em TypeScript do predicado SQL `public.is_patec_available(_code, _at)`
 * + lógica de construção do "motivo de bloqueio" usado pelo POS para
 * apresentar Alerts/Toasts ao utilizador.
 *
 * Mantemos esta lógica isolada (sem dependências de Supabase) para permitir
 * testes unitários determinísticos. Qualquer alteração ao predicado SQL ou
 * à mensagem mostrada ao utilizador DEVE ser reflectida aqui (e nos testes).
 */
export interface PatecRow {
  id: string;
  code: string;
  name?: string;
  is_active: boolean;
}

export interface SeasonRow {
  id: string;
  name?: string;
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

// ===================== Bloqueio detalhado para o POS =====================

export type PatecBlockReason =
  | "inactive_patec"
  | "no_seasons"
  | "no_active_seasons"
  | "season_future"
  | "season_closed"
  | "unknown_code";

export interface PatecBlockDetail {
  reason: PatecBlockReason;
  title: string;
  message: string;
  hint: string;
  patecName?: string;
  nextSeason?: { name: string; start_date: string };
  lastSeason?: { name: string; end_date: string };
}

export type PatecAvailability = { ok: true } | { ok: false; detail: PatecBlockDetail };

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("pt-AO"); } catch { return d; }
};

/**
 * Constrói o resultado de disponibilidade (incluindo motivo legível) com base
 * em dados já carregados. É a lógica usada pelo Alert do POS — quando devolve
 * `ok: false`, o botão "Processar Pagamento" / "Emitir FT" deve ficar desactivado.
 *
 * @param patecCode  Código do PATEC do produtor (null = legacy → não bloqueia).
 * @param patec      Linha do catálogo `patecs` ou null se não encontrado.
 * @param links      Links `patec_seasons` para o patec.
 * @param seasons    Linhas `agricultural_seasons` referenciadas pelos links.
 * @param at         Data de avaliação (default: hoje).
 */
export function computePatecAvailability(
  patecCode: string | null,
  patec: PatecRow | null,
  links: PatecSeasonLink[],
  seasons: SeasonRow[],
  at: Date | string = new Date(),
): PatecAvailability {
  if (!patecCode) return { ok: true };
  const today = (typeof at === "string" ? at : at.toISOString()).slice(0, 10);

  if (!patec) {
    return {
      ok: false,
      detail: {
        reason: "unknown_code",
        title: "Pacote não encontrado",
        message: `O código de PATEC "${patecCode}" não existe no catálogo.`,
        hint: "Verifique a configuração do produtor ou contacte um gestor.",
      },
    };
  }
  if (!patec.is_active) {
    return {
      ok: false,
      detail: {
        reason: "inactive_patec",
        title: `Pacote ${patec.code} desactivado`,
        message: `O pacote "${patec.name ?? patec.code}" está actualmente desactivado pela administração.`,
        hint: "Compras com este pacote estão suspensas até nova ativação.",
        patecName: patec.name,
      },
    };
  }
  const linkedIds = new Set(links.filter((l) => l.patec_id === patec.id).map((l) => l.season_id));
  if (linkedIds.size === 0) {
    return {
      ok: false,
      detail: {
        reason: "no_seasons",
        title: `Sem período agrícola para ${patec.code}`,
        message: `O pacote "${patec.name ?? patec.code}" não está associado a nenhum período agrícola.`,
        hint: "Peça ao gestor para vincular este pacote ao período agrícola actual.",
        patecName: patec.name,
      },
    };
  }
  const linked = seasons.filter((s) => linkedIds.has(s.id));
  const active = linked.filter((s) => s.is_active);
  if (active.length === 0) {
    return {
      ok: false,
      detail: {
        reason: "no_active_seasons",
        title: `Períodos inactivos para ${patec.code}`,
        message: `Todos os períodos agrícolas associados a "${patec.name ?? patec.code}" estão inactivos.`,
        hint: "Peça ao gestor para activar um período ou vincular um novo.",
        patecName: patec.name,
      },
    };
  }
  const inWindow = active.find((s) => s.start_date <= today && today <= s.end_date);
  if (inWindow) return { ok: true };
  const future = active
    .filter((s) => s.start_date > today)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : 1))[0];
  if (future) {
    return {
      ok: false,
      detail: {
        reason: "season_future",
        title: `Fora de período — ${patec.code}`,
        message: `O próximo período para "${patec.name ?? patec.code}" (${future.name ?? future.id}) só inicia em ${fmtDate(future.start_date)}.`,
        hint: "As vendas só serão possíveis a partir dessa data.",
        patecName: patec.name,
        nextSeason: { name: future.name ?? future.id, start_date: future.start_date },
      },
    };
  }
  const last = active
    .filter((s) => s.end_date < today)
    .sort((a, b) => (a.end_date > b.end_date ? -1 : 1))[0];
  return {
    ok: false,
    detail: {
      reason: "season_closed",
      title: `Período encerrado — ${patec.code}`,
      message: last
        ? `O período "${last.name ?? last.id}" para o pacote "${patec.name ?? patec.code}" terminou em ${fmtDate(last.end_date)}.`
        : `O período agrícola para "${patec.name ?? patec.code}" já terminou.`,
      hint: "Aguarde a abertura de um novo período para retomar as compras.",
      patecName: patec.name,
      lastSeason: last ? { name: last.name ?? last.id, end_date: last.end_date } : undefined,
    },
  };
}

/**
 * Regra usada pelo POS para decidir se o botão "Processar Pagamento" /
 * "Emitir FT" deve estar desactivado. Mantida aqui para que os testes
 * possam validar o comportamento sem renderizar a UI completa.
 */
export function isPaymentBlocked(block: PatecBlockDetail | null | undefined): boolean {
  return !!block;
}
