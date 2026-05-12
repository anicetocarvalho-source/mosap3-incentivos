import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveScope as resolveScopeShared, type FilterScope, type AppRole } from "@/lib/farmerScope";

export type DashboardDeltas = Partial<Record<
  | "totalFarmers" | "totalApproved" | "totalCompanies" | "totalSchools"
  | "totalParcels" | "totalAreaHa" | "totalProduction" | "totalLivestock"
  | "totalLivestockProducers" | "totalRecebido" | "totalGasto"
  | "utilizationRate" | "avgYieldPerHa" | "criticalStockCount"
  | "totalTransactions" | "volumeTransactions" | "totalReconciliado"
  | "totalFemale" | "femaleWithIncentive" | "femaleWithIncentivePct",
  number | null
>>;

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
  deltas: DashboardDeltas | null;
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

const toIsoDate = (d?: Date) => (d ? d.toISOString().slice(0, 10) : null);

function mapKpisFromJson(k: any, deltasRaw: any | null): Omit<DashboardKpis, "filterScope" | "filterLabel"> {
  const totalRecebido = Number(k.total_recebido) || 0;
  const totalGasto = Number(k.total_gasto) || 0;
  const totalReconciliado = Number(k.total_reconciliado) || 0;

  const deltaNum = (key: string): number | null => {
    if (!deltasRaw) return null;
    const v = deltasRaw[key];
    return v === null || v === undefined ? null : Number(v);
  };

  const deltas: DashboardDeltas | null = deltasRaw
    ? {
        totalFarmers: deltaNum("total_farmers"),
        totalApproved: deltaNum("total_approved"),
        totalCompanies: deltaNum("total_companies"),
        totalSchools: deltaNum("total_schools"),
        totalParcels: deltaNum("total_parcels"),
        totalAreaHa: deltaNum("total_area_ha"),
        totalProduction: deltaNum("total_production"),
        totalLivestock: deltaNum("total_livestock"),
        totalLivestockProducers: deltaNum("total_livestock_producers"),
        totalRecebido: deltaNum("total_recebido"),
        totalGasto: deltaNum("total_gasto"),
        utilizationRate: deltaNum("utilization_rate"),
        avgYieldPerHa: deltaNum("avg_yield_per_ha"),
        criticalStockCount: deltaNum("critical_stock_count"),
        totalTransactions: deltaNum("total_transactions"),
        volumeTransactions: deltaNum("volume_transactions"),
        totalReconciliado: deltaNum("total_reconciliado"),
        totalFemale: deltaNum("total_female"),
        femaleWithIncentive: deltaNum("female_with_incentive"),
        femaleWithIncentivePct: deltaNum("female_with_incentive_pct"),
      }
    : null;

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
    deltas,
  };
}

async function fetchKpis(
  userId: string,
  roles: AppRole[],
  period: { from?: Date; to?: Date },
): Promise<DashboardKpis> {
  const { scope, provinces, ecas, filterLabel } = await resolveScope(userId, roles);
  const p_from = toIsoDate(period.from);
  const p_to = toIsoDate(period.to);
  const hasPeriod = !!p_from && !!p_to;

  if (hasPeriod) {
    const { data, error } = await supabase.rpc("dashboard_kpis_yoy" as any, {
      p_scope: scope,
      p_provinces: provinces,
      p_ecas: ecas,
      p_from,
      p_to,
    });
    if (error) throw error;
    const d = (data ?? {}) as any;
    return {
      ...mapKpisFromJson(d.current ?? {}, d.deltas ?? null),
      filterScope: scope,
      filterLabel,
    };
  }

  const { data, error } = await supabase.rpc("dashboard_kpis" as any, {
    p_scope: scope,
    p_provinces: provinces,
    p_ecas: ecas,
  });
  if (error) throw error;
  return {
    ...mapKpisFromJson(data ?? {}, null),
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

export function useDashboardKpis(period?: { from?: Date; to?: Date }) {
  const { user, roles, authReady } = useAuth();
  const p = period ?? {};
  return useQuery({
    queryKey: ["dashboard-kpis", user?.id, roles, toIsoDate(p.from), toIsoDate(p.to)],
    queryFn: () => fetchKpis(user!.id, roles as AppRole[], p),
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
