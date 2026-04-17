import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Roles that see ALL data (no geographic filter) */
const GLOBAL_ROLES: AppRole[] = ["admin", "gestor_incentivos"];
/** Roles filtered by province */
const PROVINCE_ROLES: AppRole[] = [
  "senior_agricultura", "senior_monitoria", "senior_agronegocio",
  "junior_agricultura", "junior_monitoria", "junior_agronegocio",
];
/** Roles filtered by ECA */
const ECA_ROLES: AppRole[] = ["tecnico_extensionista"];

type FilterScope = "global" | "province" | "eca";

function getFilterScope(roles: AppRole[]): FilterScope {
  if (roles.some((r) => GLOBAL_ROLES.includes(r))) return "global";
  if (roles.some((r) => PROVINCE_ROLES.includes(r))) return "province";
  if (roles.some((r) => ECA_ROLES.includes(r))) return "eca";
  return "global"; // fallback
}

async function fetchUserProvinces(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_provinces")
    .select("province")
    .eq("user_id", userId);
  return data?.map((d) => d.province) ?? [];
}

async function fetchUserEcas(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_ecas")
    .select("eca_name")
    .eq("user_id", userId);
  return data?.map((d) => d.eca_name) ?? [];
}

export interface DashboardStats {
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
  farmersByProvince: { name: string; value: number }[];
  genderData: { name: string; value: number; color: string }[];
  transactionsByProvince: { name: string; value: number }[];
  productionByCulture: { name: string; area: number; producao: number }[];
  livestockBySpecies: { name: string; quantidade: number; produtores: number }[];
  filterScope: FilterScope;
  filterLabel: string;
  // ─── Impacto ───
  totalRecebido: number;
  totalGasto: number;
  utilizationRate: number; // %
  avgYieldPerHa: number; // kg/ha
  criticalStockCount: number;
  // Funil do incentivo
  incentiveFunnel: { stage: string; value: number }[];
  // Vendas POS últimos 12 meses
  posSalesTrend: { month: string; valor: number; vendas: number }[];
}

const parseValor = (s: string | null | undefined): number => {
  if (!s) return 0;
  const v = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(v) ? 0 : v;
};

async function fetchDashboardData(
  userId: string,
  roles: AppRole[],
): Promise<DashboardStats> {
  const scope = getFilterScope(roles);

  let provinces: string[] = [];
  let ecas: string[] = [];

  if (scope === "province") {
    provinces = await fetchUserProvinces(userId);
  } else if (scope === "eca") {
    ecas = await fetchUserEcas(userId);
  }

  // Build farmer query
  let farmerQuery = supabase.from("farmers").select("code, full_name, gender, province, school, status, saldo_final, valor_recebido, total_gasto");

  if (scope === "province" && provinces.length > 0) {
    farmerQuery = farmerQuery.in("province", provinces);
  } else if (scope === "eca" && ecas.length > 0) {
    farmerQuery = farmerQuery.in("school", ecas);
  }

  const { data: farmers = [] } = await farmerQuery;
  const farmerCodes = farmers.map((f) => f.code);

  const totalFarmers = farmers.length;
  const totalApproved = farmers.filter((f) => f.status === "Aprovado").length;

  // Gender
  const maleCount = farmers.filter((f) => f.gender === "Masculino").length;
  const femaleCount = farmers.filter((f) => f.gender === "Feminino").length;
  const totalGender = maleCount + femaleCount || 1;
  const genderData = [
    { name: "Masculino", value: Math.round((maleCount / totalGender) * 1000) / 10, color: "hsl(65, 70%, 40%)" },
    { name: "Feminino", value: Math.round((femaleCount / totalGender) * 1000) / 10, color: "hsl(0, 60%, 55%)" },
  ];

  // By province
  const provMap: Record<string, number> = {};
  farmers.forEach((f) => {
    if (f.province) provMap[f.province] = (provMap[f.province] || 0) + 1;
  });
  const farmersByProvince = Object.entries(provMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Transactions
  let txQuery = supabase.from("farmer_transactions").select("farmer_code, valor, empresa");
  if (farmerCodes.length > 0 && scope !== "global") {
    txQuery = txQuery.in("farmer_code", farmerCodes);
  }
  const { data: transactions = [] } = await txQuery;
  const totalTransactions = transactions.length;

  // Volume
  const volumeTransactions = transactions.reduce((sum, t) => {
    const val = parseFloat(t.valor?.replace(/\./g, "").replace(",", ".") || "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Transactions by province (join with farmers)
  const farmerProvMap: Record<string, string> = {};
  farmers.forEach((f) => { if (f.province) farmerProvMap[f.code] = f.province; });
  const txByProv: Record<string, number> = {};
  transactions.forEach((t) => {
    const prov = farmerProvMap[t.farmer_code] || "Outro";
    txByProv[prov] = (txByProv[prov] || 0) + 1;
  });
  const transactionsByProvince = Object.entries(txByProv)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Unique companies
  const uniqueEmpresas = new Set(transactions.map((t) => t.empresa));
  const totalCompanies = uniqueEmpresas.size;

  // Schools
  let schoolQuery = supabase.from("schools").select("id, name, province_id");
  if (scope === "eca" && ecas.length > 0) {
    schoolQuery = schoolQuery.in("name", ecas);
  }
  // For province filter we can't easily filter schools by province name (they use province_id)
  // We'll count schools that have farmers in the filtered set
  const { data: schools = [] } = await schoolQuery;
  const totalSchools = scope === "province" && provinces.length > 0
    ? new Set(farmers.map((f) => f.school).filter(Boolean)).size
    : schools.length;

  // Parcels
  let parcelQuery = supabase.from("farmer_parcels").select("area, culture, farmer_code");
  if (farmerCodes.length > 0 && scope !== "global") {
    parcelQuery = parcelQuery.in("farmer_code", farmerCodes);
  }
  const { data: parcels = [] } = await parcelQuery;
  const totalParcels = parcels.length;
  const totalAreaHa = parcels.reduce((sum, p) => {
    const val = parseFloat(p.area?.replace(",", ".") || "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Production
  let prodQuery = supabase.from("farmer_production").select("culture, area, actual_yield, farmer_code");
  if (farmerCodes.length > 0 && scope !== "global") {
    prodQuery = prodQuery.in("farmer_code", farmerCodes);
  }
  const { data: production = [] } = await prodQuery;

  const cultureMap: Record<string, { area: number; producao: number }> = {};
  production.forEach((p) => {
    if (!cultureMap[p.culture]) cultureMap[p.culture] = { area: 0, producao: 0 };
    const area = parseFloat(p.area?.replace(",", ".") || "0");
    const yield_ = parseFloat(p.actual_yield?.replace(",", ".") || "0");
    cultureMap[p.culture].area += isNaN(area) ? 0 : area;
    cultureMap[p.culture].producao += isNaN(yield_) ? 0 : yield_;
  });
  const productionByCulture = Object.entries(cultureMap)
    .map(([name, v]) => ({ name, area: Math.round(v.area * 10) / 10, producao: Math.round(v.producao * 10) / 10 }))
    .sort((a, b) => b.producao - a.producao);

  const totalProduction = productionByCulture.reduce((s, c) => s + c.producao, 0);

  // Livestock
  let livestockQuery = supabase.from("livestock").select("species, quantity, farmer_id");
  if (farmerCodes.length > 0 && scope !== "global") {
    livestockQuery = livestockQuery.in("farmer_id", farmerCodes);
  }
  const { data: livestock = [] } = await livestockQuery;

  const speciesMap: Record<string, { quantidade: number; produtores: Set<string> }> = {};
  livestock.forEach((l) => {
    if (!speciesMap[l.species]) speciesMap[l.species] = { quantidade: 0, produtores: new Set() };
    speciesMap[l.species].quantidade += l.quantity;
    speciesMap[l.species].produtores.add(l.farmer_id);
  });
  const livestockBySpecies = Object.entries(speciesMap)
    .map(([name, v]) => ({ name, quantidade: v.quantidade, produtores: v.produtores.size }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const totalLivestock = livestock.reduce((s, l) => s + l.quantity, 0);
  const totalLivestockProducers = new Set(livestock.map((l) => l.farmer_id)).size;

  // Filter label
  let filterLabel = "Todas as províncias";
  if (scope === "province") {
    filterLabel = provinces.length > 0 ? provinces.join(", ") : "Sem províncias atribuídas";
  } else if (scope === "eca") {
    filterLabel = ecas.length > 0 ? ecas.join(", ") : "Sem ECAs atribuídas";
  }

  return {
    totalFarmers,
    totalApproved,
    totalTransactions,
    totalCompanies,
    totalSchools,
    totalParcels,
    totalAreaHa: Math.round(totalAreaHa * 10) / 10,
    totalProduction: Math.round(totalProduction * 10) / 10,
    totalLivestock,
    totalLivestockProducers,
    volumeTransactions,
    farmersByProvince,
    genderData,
    transactionsByProvince,
    productionByCulture,
    livestockBySpecies,
    filterScope: scope,
    filterLabel,
  };
}

export function useDashboardData() {
  const { user, roles, authReady } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats", user?.id, roles],
    queryFn: () => fetchDashboardData(user!.id, roles as AppRole[]),
    enabled: !!user && authReady && roles.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
