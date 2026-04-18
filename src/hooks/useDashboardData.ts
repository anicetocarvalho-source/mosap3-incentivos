import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const GLOBAL_ROLES: AppRole[] = ["admin", "gestor_incentivos"];
const PROVINCE_ROLES: AppRole[] = [
  "senior_agricultura", "senior_monitoria", "senior_agronegocio",
  "junior_agricultura", "junior_monitoria", "junior_agronegocio",
];
const ECA_ROLES: AppRole[] = ["tecnico_extensionista"];

type FilterScope = "global" | "province" | "eca";

function getFilterScope(roles: AppRole[]): FilterScope {
  if (roles.some((r) => GLOBAL_ROLES.includes(r))) return "global";
  if (roles.some((r) => PROVINCE_ROLES.includes(r))) return "province";
  if (roles.some((r) => ECA_ROLES.includes(r))) return "eca";
  return "global";
}

async function fetchUserProvinces(userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_provinces").select("province").eq("user_id", userId);
  return data?.map((d) => d.province) ?? [];
}

async function fetchUserEcas(userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_ecas").select("eca_name").eq("user_id", userId);
  return data?.map((d) => d.eca_name) ?? [];
}

export interface DashboardKpis {
  totalFarmers: number;
  totalApproved: number;
  totalTransactions: number;
  totalCompanies: number;
  totalSchools: number;
  totalParcels: number;
  totalAreaHa: number;
  totalProduction: number;
  totalLivestock: number;
  totalLivestockProducers: number;
  volumeTransactions: number;
  totalRecebido: number;
  totalGasto: number;
  utilizationRate: number;
  avgYieldPerHa: number;
  criticalStockCount: number;
  totalFemale: number;
  femaleWithIncentive: number;
  femaleWithIncentivePct: number;
  incentiveFunnel: { stage: string; value: number }[];
  filterScope: FilterScope;
  filterLabel: string;
}

export interface DashboardCharts {
  farmersByProvince: { name: string; value: number }[];
  genderData: { name: string; value: number; color: string }[];
  transactionsByProvince: { name: string; value: number }[];
  productionByCulture: { name: string; area: number; producao: number }[];
  livestockBySpecies: { name: string; quantidade: number; produtores: number }[];
  posSalesTrend: { month: string; valor: number; vendas: number }[];
}

async function resolveScope(userId: string, roles: AppRole[]) {
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

async function fetchKpis(userId: string, roles: AppRole[]): Promise<DashboardKpis> {
  const { scope, provinces, ecas, filterLabel } = await resolveScope(userId, roles);

  const { data, error } = await supabase.rpc("dashboard_kpis" as any, {
    p_scope: scope,
    p_provinces: provinces,
    p_ecas: ecas,
  });
  if (error) throw error;
  const k = (data ?? {}) as any;

  const totalRecebido = Number(k.total_recebido) || 0;
  const totalGasto = Number(k.total_gasto) || 0;
  const totalReconciliado = Number(k.total_reconciliado) || 0;

  return {
    totalFarmers: Number(k.total_farmers) || 0,
    totalApproved: Number(k.total_approved) || 0,
    totalTransactions: Number(k.total_transactions) || 0,
    totalCompanies: Number(k.total_companies) || 0,
    totalSchools: Number(k.total_schools) || 0,
    totalParcels: Number(k.total_parcels) || 0,
    totalAreaHa: Number(k.total_area_ha) || 0,
    totalProduction: Number(k.total_production) || 0,
    totalLivestock: Number(k.total_livestock) || 0,
    totalLivestockProducers: Number(k.total_livestock_producers) || 0,
    volumeTransactions: Number(k.volume_transactions) || 0,
    totalRecebido,
    totalGasto,
    utilizationRate: Number(k.utilization_rate) || 0,
    avgYieldPerHa: Number(k.avg_yield_per_ha) || 0,
    criticalStockCount: Number(k.critical_stock_count) || 0,
    totalFemale: Number(k.total_female) || 0,
    femaleWithIncentive: Number(k.female_with_incentive) || 0,
    femaleWithIncentivePct: Number(k.female_with_incentive_pct) || 0,
    incentiveFunnel: [
      { stage: "Atribuído", value: Math.round(totalRecebido) },
      { stage: "Recebido", value: Math.round(totalRecebido) },
      { stage: "Gasto", value: Math.round(totalGasto) },
      { stage: "Reconciliado", value: Math.round(totalReconciliado) },
    ],
    filterScope: scope,
    filterLabel,
  };
}

async function fetchCharts(userId: string, roles: AppRole[]): Promise<DashboardCharts> {
  const { scope, provinces, ecas } = await resolveScope(userId, roles);

  const { data, error } = await supabase.rpc("dashboard_charts" as any, {
    p_scope: scope,
    p_provinces: provinces,
    p_ecas: ecas,
  });
  if (error) throw error;
  const c = (data ?? {}) as any;

  return {
    farmersByProvince: c.farmers_by_province ?? [],
    genderData: c.gender_data ?? [],
    transactionsByProvince: c.transactions_by_province ?? [],
    productionByCulture: c.production_by_culture ?? [],
    livestockBySpecies: c.livestock_by_species ?? [],
    posSalesTrend: c.pos_sales_trend ?? [],
  };
}

export function useDashboardKpis() {
  const { user, roles, authReady } = useAuth();
  return useQuery({
    queryKey: ["dashboard-kpis", user?.id, roles],
    queryFn: () => fetchKpis(user!.id, roles as AppRole[]),
    enabled: !!user && authReady && roles.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useDashboardCharts() {
  const { user, roles, authReady } = useAuth();
  return useQuery({
    queryKey: ["dashboard-charts", user?.id, roles],
    queryFn: () => fetchCharts(user!.id, roles as AppRole[]),
    enabled: !!user && authReady && roles.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Backwards-compat shape (unused by Dashboard.tsx after refactor, kept for safety)
export interface DashboardStats extends DashboardKpis, DashboardCharts {}
export function useDashboardData() {
  const kpis = useDashboardKpis();
  const charts = useDashboardCharts();
  return {
    data: kpis.data && charts.data ? { ...kpis.data, ...charts.data } as DashboardStats : undefined,
    isLoading: kpis.isLoading || charts.isLoading,
    isError: kpis.isError || charts.isError,
    refetch: () => Promise.all([kpis.refetch(), charts.refetch()]),
  };
}
