/**
 * Helper unificado para contagens de produtores em todos os módulos.
 *
 * Aplica duas regras consistentes:
 *  1. Exclui produtores soft-deleted (status = 'Removido') por defeito.
 *  2. Filtra por permissões geográficas do utilizador (províncias / ECAs).
 *
 * Admin e gestor de incentivos vêem o âmbito global. Séniores/juniores são
 * limitados às províncias atribuídas em `user_provinces`. Técnicos
 * extensionistas são limitados às ECAs (escolas) atribuídas em `user_ecas`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type FilterScope = "global" | "province" | "eca";

const GLOBAL_ROLES: AppRole[] = ["admin", "gestor_incentivos"];
const PROVINCE_ROLES: AppRole[] = [
  "senior_agricultura", "senior_monitoria", "senior_agronegocio",
  "junior_agricultura", "junior_monitoria", "junior_agronegocio",
];
const ECA_ROLES: AppRole[] = ["tecnico_extensionista"];

export interface ResolvedScope {
  scope: FilterScope;
  provinces: string[];
  ecas: string[];
  filterLabel: string;
}

export function getFilterScope(roles: AppRole[]): FilterScope {
  if (roles.some((r) => GLOBAL_ROLES.includes(r))) return "global";
  if (roles.some((r) => PROVINCE_ROLES.includes(r))) return "province";
  if (roles.some((r) => ECA_ROLES.includes(r))) return "eca";
  return "global";
}

export async function fetchUserProvinces(userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_provinces").select("province").eq("user_id", userId);
  return data?.map((d) => d.province) ?? [];
}

export async function fetchUserEcas(userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_ecas").select("eca_name").eq("user_id", userId);
  return data?.map((d) => d.eca_name) ?? [];
}

export async function resolveScope(userId: string, roles: AppRole[]): Promise<ResolvedScope> {
  let scope = getFilterScope(roles);
  let provinces: string[] = [];
  let ecas: string[] = [];
  if (scope === "province") {
    provinces = await fetchUserProvinces(userId);
    if (provinces.length === 0) scope = "global";
  } else if (scope === "eca") {
    ecas = await fetchUserEcas(userId);
    if (ecas.length === 0) scope = "global";
  }
  let filterLabel = "Todas as províncias";
  if (scope === "province") filterLabel = provinces.join(", ");
  else if (scope === "eca") filterLabel = ecas.join(", ");
  return { scope, provinces, ecas, filterLabel };
}

/**
 * Aplica filtro consistente a uma query do PostgREST sobre `farmers`:
 *  - exclui status = 'Removido' (a menos que `includeRemoved` seja true)
 *  - aplica IN sobre `province` ou `school` conforme o scope do utilizador
 *
 * Devolve o builder modificado (mesma referência, encadeável).
 */
export function applyFarmerScopeFilter(
  query: any,
  scope: ResolvedScope,
  opts: { includeRemoved?: boolean } = {}
) {
  let q = query;
  if (!opts.includeRemoved) q = q.neq("status", "Removido");
  if (scope.scope === "province" && scope.provinces.length) q = q.in("province", scope.provinces);
  else if (scope.scope === "eca" && scope.ecas.length) q = q.in("school", scope.ecas);
  return q;
}
