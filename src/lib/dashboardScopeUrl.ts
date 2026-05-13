/**
 * Constrói uma query string com o âmbito (scope/províncias/ECAs) e período
 * actuais do Dashboard, para ser anexada a links de navegação para outras
 * páginas. As páginas destino podem ler estes parâmetros para pré-aplicar
 * os mesmos filtros.
 *
 * Parâmetros gerados (todos opcionais):
 *  - scope=global|province|eca
 *  - province=<nome>      (apenas quando scope=province e há 1 só)
 *  - provinces=<a,b,c>    (apenas quando scope=province e há vários)
 *  - eca=<nome>           (apenas quando scope=eca e há 1 só)
 *  - ecas=<a,b,c>         (apenas quando scope=eca e há vários)
 *  - from=YYYY-MM-DD
 *  - to=YYYY-MM-DD
 */
import type { FilterScope } from "@/lib/farmerScope";

export interface ScopeUrlInput {
  scope?: FilterScope;
  provinces?: string[];
  ecas?: string[];
  period?: { from?: Date; to?: Date };
}

const toIso = (d?: Date) => (d ? d.toISOString().slice(0, 10) : null);

export function buildScopedSearch(input: ScopeUrlInput): string {
  const params = new URLSearchParams();
  const { scope, provinces = [], ecas = [], period } = input;

  if (scope && scope !== "global") params.set("scope", scope);

  if (scope === "province" && provinces.length === 1) {
    params.set("province", provinces[0]);
  } else if (scope === "province" && provinces.length > 1) {
    params.set("provinces", provinces.join(","));
  }

  if (scope === "eca" && ecas.length === 1) {
    params.set("eca", ecas[0]);
  } else if (scope === "eca" && ecas.length > 1) {
    params.set("ecas", ecas.join(","));
  }

  const from = toIso(period?.from);
  const to = toIso(period?.to);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Helper: anexa o âmbito a um path. */
export function withScope(path: string, input: ScopeUrlInput): string {
  return `${path}${buildScopedSearch(input)}`;
}
