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
  let scope = getFilterScope(roles);

  let provinces: string[] = [];
  let ecas: string[] = [];

  if (scope === "province") {
    provinces = await fetchUserProvinces(userId);
    // Fallback: se não tem províncias atribuídas, ver tudo (supervisão nacional)
    if (provinces.length === 0) scope = "global";
  } else if (scope === "eca") {
    ecas = await fetchUserEcas(userId);
    if (ecas.length === 0) scope = "global";
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

  // Fornecedores activos (fonte oficial: tabela suppliers)
  const { count: suppliersCount } = await supabase
    .from("suppliers")
    .select("id", { count: "exact", head: true })
    .eq("status", "Ativo");
  const totalCompanies = suppliersCount ?? 0;

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

  // ─── Impacto: Utilização de Incentivos ───
  const totalRecebido = farmers.reduce((s, f) => s + parseValor(f.valor_recebido), 0);
  const totalGasto = farmers.reduce((s, f) => s + parseValor(f.total_gasto), 0);
  const utilizationRate = totalRecebido > 0 ? (totalGasto / totalRecebido) * 100 : 0;

  // Produtividade kg/ha (actual_yield em ton → *1000 = kg)
  const totalAreaProd = production.reduce((s, p) => s + parseValor(p.area), 0);
  const totalYieldKg = production.reduce((s, p) => s + parseValor(p.actual_yield) * 1000, 0);
  const avgYieldPerHa = totalAreaProd > 0 ? totalYieldKg / totalAreaProd : 0;

  // Stock crítico (global — não filtra por geo, é responsabilidade dos fornecedores)
  let criticalStockCount = 0;
  if (scope === "global") {
    const { count } = await supabase
      .from("supplier_products")
      .select("id", { count: "exact", head: true })
      .filter("stock", "lte", "min_stock" as any);
    // Supabase não suporta comparar colunas no filter — fallback a query manual
    const { data: prodStock } = await supabase
      .from("supplier_products")
      .select("stock, min_stock");
    criticalStockCount = (prodStock || []).filter((p) => p.stock <= p.min_stock).length;
  }

  // Funil do incentivo (em AOA)
  const totalAtribuido = totalRecebido; // proxy: valor_recebido representa o atribuído pago
  const totalReconciliado = transactions.reduce((s, t) => s + parseValor(t.valor), 0);
  const incentiveFunnel = [
    { stage: "Atribuído", value: Math.round(totalAtribuido) },
    { stage: "Recebido", value: Math.round(totalRecebido) },
    { stage: "Gasto", value: Math.round(totalGasto) },
    { stage: "Reconciliado", value: Math.round(totalReconciliado) },
  ];

  // Tendência POS últimos 12 meses
  let posQuery = supabase
    .from("pos_sales")
    .select("total, created_at, farmer_code")
    .gte("created_at", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
  if (farmerCodes.length > 0 && scope !== "global") {
    posQuery = posQuery.in("farmer_code", farmerCodes);
  }
  const { data: posSales = [] } = await posQuery;
  const monthMap: Record<string, { valor: number; vendas: number }> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = { valor: 0, vendas: 0 };
  }
  posSales.forEach((s) => {
    const d = new Date(s.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap[key]) {
      monthMap[key].valor += Number(s.total) || 0;
      monthMap[key].vendas += 1;
    }
  });
  const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const posSalesTrend = Object.entries(monthMap).map(([key, v]) => {
    const [, m] = key.split("-");
    return { month: monthLabels[parseInt(m, 10) - 1], valor: Math.round(v.valor), vendas: v.vendas };
  });

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
    totalRecebido,
    totalGasto,
    utilizationRate: Math.round(utilizationRate * 10) / 10,
    avgYieldPerHa: Math.round(avgYieldPerHa),
    criticalStockCount,
    incentiveFunnel,
    posSalesTrend,
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
