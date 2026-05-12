import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";

export type ReportFilters = {
  provincia: string;
  municipio: string;
  escola: string;
  estado: string;
  dateFrom?: Date;
  dateTo?: Date;
};

const isAll = (v?: string) => !v || v === "all";

const parseNum = (v: string | null | undefined): number => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const inDateRange = (iso: string | null | undefined, from?: Date, to?: Date): boolean => {
  if (!iso) return true;
  const d = new Date(iso);
  if (from && d < from) return false;
  if (to) {
    const end = new Date(to); end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
};

// ---------------- Producao ----------------
export type ProducaoRow = {
  provincia: string; escola: string; agricultores: number; parcelas: number;
  areaTotalHa: number; producaoTon: number; mediaHa: number;
};

async function fetchProducao(filters: ReportFilters): Promise<ProducaoRow[]> {
  const farmers = await fetchAllPages<any>(() => {
    let q = supabase.from("farmers").select("code, province, school", { count: "exact" }).neq("status", "Removido");
    if (!isAll(filters.provincia)) q = q.eq("province", filters.provincia);
    if (!isAll(filters.municipio)) q = q.eq("municipality", filters.municipio);
    if (!isAll(filters.escola)) q = q.eq("school", filters.escola);
    return q;
  });
  const codes = farmers.map(f => f.code);
  if (codes.length === 0) return [];

  const [parcelsRaw, prodRaw] = await Promise.all([
    fetchAllPages<any>(() =>
      supabase.from("farmer_parcels").select("farmer_code, area, created_at", { count: "exact" }).in("farmer_code", codes)
    ),
    fetchAllPages<any>(() =>
      supabase.from("farmer_production").select("farmer_code, area, actual_yield, created_at", { count: "exact" }).in("farmer_code", codes)
    ),
  ]);

  const parcels = parcelsRaw.filter(p =>
    inDateRange((p as any).created_at, filters.dateFrom, filters.dateTo));
  const prod = prodRaw.filter(p =>
    inDateRange(p.created_at, filters.dateFrom, filters.dateTo));

  const farmerInfo = new Map(farmers.map(f => [f.code, { province: f.province || "—", school: f.school || "—" }]));
  const grouped = new Map<string, ProducaoRow>();

  for (const f of farmers) {
    const key = `${f.province || "—"}||${f.school || "—"}`;
    if (!grouped.has(key)) grouped.set(key, {
      provincia: f.province || "—", escola: f.school || "—",
      agricultores: 0, parcelas: 0, areaTotalHa: 0, producaoTon: 0, mediaHa: 0,
    });
    grouped.get(key)!.agricultores += 1;
  }
  for (const p of parcels) {
    const info = farmerInfo.get(p.farmer_code); if (!info) continue;
    const row = grouped.get(`${info.province}||${info.school}`); if (!row) continue;
    row.parcelas += 1;
    row.areaTotalHa += parseNum(p.area);
  }
  for (const p of prod) {
    const info = farmerInfo.get(p.farmer_code); if (!info) continue;
    const row = grouped.get(`${info.province}||${info.school}`); if (!row) continue;
    row.producaoTon += parseNum(p.actual_yield);
  }
  return Array.from(grouped.values()).map(r => ({
    ...r, mediaHa: r.areaTotalHa > 0 ? r.producaoTon / r.areaTotalHa : 0,
  })).sort((a, b) => b.producaoTon - a.producaoTon);
}

// ---------------- Pecuaria ----------------
export type PecuariaRow = {
  provincia: string; escola: string; produtores: number;
  bovinos: number; caprinos: number; suinos: number; aves: number;
  leiteL: number; ovosUn: number;
};

async function fetchPecuaria(filters: ReportFilters): Promise<PecuariaRow[]> {
  const farmers = await fetchAllPages<any>(() => {
    let q = supabase.from("farmers").select("code, province, school", { count: "exact" }).neq("status", "Removido");
    if (!isAll(filters.provincia)) q = q.eq("province", filters.provincia);
    if (!isAll(filters.municipio)) q = q.eq("municipality", filters.municipio);
    if (!isAll(filters.escola)) q = q.eq("school", filters.escola);
    return q;
  });
  const codes = farmers.map(f => f.code);
  if (codes.length === 0) return [];

  const livestock = await fetchAllPages<any>(() =>
    supabase.from("livestock").select("id, farmer_id, species, quantity, created_at", { count: "exact" }).in("farmer_id", codes)
  );
  const filteredLivestock = livestock.filter(l => inDateRange(l.created_at, filters.dateFrom, filters.dateTo));

  const livestockIds = filteredLivestock.map(l => l.id);
  const production = livestockIds.length > 0
    ? await fetchAllPages<any>(() =>
        supabase.from("livestock_production").select("livestock_id, product_type, quantity, unit", { count: "exact" }).in("livestock_id", livestockIds)
      )
    : [];

  const farmerInfo = new Map(farmers.map(f => [f.code, { province: f.province || "—", school: f.school || "—" }]));
  const grouped = new Map<string, PecuariaRow>();
  const producers = new Map<string, Set<string>>();

  for (const l of filteredLivestock) {
    const info = farmerInfo.get(l.farmer_id); if (!info) continue;
    const key = `${info.province}||${info.school}`;
    if (!grouped.has(key)) {
      grouped.set(key, { provincia: info.province, escola: info.school, produtores: 0, bovinos: 0, caprinos: 0, suinos: 0, aves: 0, leiteL: 0, ovosUn: 0 });
      producers.set(key, new Set());
    }
    const row = grouped.get(key)!;
    producers.get(key)!.add(l.farmer_id);
    const sp = (l.species || "").toLowerCase();
    if (sp.includes("bovin")) row.bovinos += l.quantity;
    else if (sp.includes("caprin")) row.caprinos += l.quantity;
    else if (sp.includes("suín") || sp.includes("suin")) row.suinos += l.quantity;
    else if (sp.includes("av") || sp.includes("galin")) row.aves += l.quantity;
  }
  const livestockToKey = new Map(filteredLivestock.map(l => {
    const info = farmerInfo.get(l.farmer_id);
    return [l.id, info ? `${info.province}||${info.school}` : null];
  }));
  for (const p of production) {
    const key = livestockToKey.get(p.livestock_id); if (!key) continue;
    const row = grouped.get(key); if (!row) continue;
    const pt = (p.product_type || "").toLowerCase();
    if (pt.includes("leite")) row.leiteL += Number(p.quantity) || 0;
    else if (pt.includes("ovo")) row.ovosUn += Number(p.quantity) || 0;
  }
  for (const [key, set] of producers) grouped.get(key)!.produtores = set.size;
  return Array.from(grouped.values()).sort((a, b) => b.produtores - a.produtores);
}

// ---------------- Agricultores ----------------
export type AgricultoresRow = {
  provincia: string; ativo: number; pendente: number; suspenso: number; validado: number; total: number;
};

async function fetchAgricultores(filters: ReportFilters): Promise<AgricultoresRow[]> {
  const data = await fetchAllPages<any>(() => {
    let q = supabase.from("farmers").select("province, status, created_at", { count: "exact" }).neq("status", "Removido");
    if (!isAll(filters.provincia)) q = q.eq("province", filters.provincia);
    if (!isAll(filters.municipio)) q = q.eq("municipality", filters.municipio);
    if (!isAll(filters.escola)) q = q.eq("school", filters.escola);
    if (!isAll(filters.estado)) q = q.eq("status", filters.estado);
    return q;
  });
  const filtered = data.filter(f => inDateRange(f.created_at, filters.dateFrom, filters.dateTo));

  const grouped = new Map<string, AgricultoresRow>();
  for (const f of filtered) {
    const key = f.province || "—";
    if (!grouped.has(key)) grouped.set(key, { provincia: key, ativo: 0, pendente: 0, suspenso: 0, validado: 0, total: 0 });
    const row = grouped.get(key)!;
    row.total += 1;
    const s = (f.status || "").toLowerCase();
    if (s.includes("ativ") || s.includes("aprov")) row.ativo += 1;
    else if (s.includes("pend")) row.pendente += 1;
    else if (s.includes("susp")) row.suspenso += 1;
    else if (s.includes("valid")) row.validado += 1;
  }
  return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
}

// ---------------- Incentivos ----------------
export type IncentivosRow = {
  provincia: string; escola: string; beneficiarios: number; totalKz: number; kitsEntregues: number; sementesKg: number;
};

async function fetchIncentivos(filters: ReportFilters): Promise<IncentivosRow[]> {
  const farmers = await fetchAllPages<any>(() => {
    let q = supabase.from("farmers").select("code, province, school", { count: "exact" }).neq("status", "Removido");
    if (!isAll(filters.provincia)) q = q.eq("province", filters.provincia);
    if (!isAll(filters.municipio)) q = q.eq("municipality", filters.municipio);
    if (!isAll(filters.escola)) q = q.eq("school", filters.escola);
    return q;
  });
  const codes = farmers.map(f => f.code);
  if (codes.length === 0) return [];

  const incentives = await fetchAllPages<any>(() =>
    supabase.from("farmer_incentives").select("farmer_code, amount, type, status, created_at", { count: "exact" }).in("farmer_code", codes)
  );
  const filtered = incentives.filter(i => inDateRange(i.created_at, filters.dateFrom, filters.dateTo));

  const farmerInfo = new Map(farmers.map(f => [f.code, { province: f.province || "—", school: f.school || "—" }]));
  const grouped = new Map<string, IncentivosRow>();
  const beneficiaries = new Map<string, Set<string>>();

  for (const i of filtered) {
    const info = farmerInfo.get(i.farmer_code); if (!info) continue;
    const key = `${info.province}||${info.school}`;
    if (!grouped.has(key)) {
      grouped.set(key, { provincia: info.province, escola: info.school, beneficiarios: 0, totalKz: 0, kitsEntregues: 0, sementesKg: 0 });
      beneficiaries.set(key, new Set());
    }
    const row = grouped.get(key)!;
    beneficiaries.get(key)!.add(i.farmer_code);
    row.totalKz += parseNum(i.amount);
  }
  for (const [key, set] of beneficiaries) grouped.get(key)!.beneficiarios = set.size;
  return Array.from(grouped.values()).sort((a, b) => b.totalKz - a.totalKz);
}

// ---------------- Compras / Transacoes ----------------
export type ComprasRow = {
  empresa: string; provincia: string; transacoes: number; volumeKz: number; produtosComprados: string;
};

async function fetchCompras(filters: ReportFilters): Promise<ComprasRow[]> {
  const farmers = await fetchAllPages<any>(() => {
    let q = supabase.from("farmers").select("code, province", { count: "exact" }).neq("status", "Removido");
    if (!isAll(filters.provincia)) q = q.eq("province", filters.provincia);
    if (!isAll(filters.municipio)) q = q.eq("municipality", filters.municipio);
    if (!isAll(filters.escola)) q = q.eq("school", filters.escola);
    return q;
  });
  const codes = farmers.map(f => f.code);
  if (codes.length === 0) return [];

  const tx = await fetchAllPages<any>(() =>
    supabase.from("farmer_transactions").select("farmer_code, empresa, valor, product, created_at", { count: "exact" }).in("farmer_code", codes)
  );
  const filtered = tx.filter(t => inDateRange(t.created_at, filters.dateFrom, filters.dateTo));

  const farmerProv = new Map(farmers.map(f => [f.code, f.province || "—"]));
  const grouped = new Map<string, { empresa: string; provincias: Set<string>; transacoes: number; volumeKz: number; produtos: Set<string> }>();
  for (const t of filtered) {
    const key = t.empresa;
    if (!grouped.has(key)) grouped.set(key, { empresa: key, provincias: new Set(), transacoes: 0, volumeKz: 0, produtos: new Set() });
    const g = grouped.get(key)!;
    g.transacoes += 1;
    g.volumeKz += parseNum(t.valor);
    const prov = farmerProv.get(t.farmer_code); if (prov) g.provincias.add(prov);
    if (t.product) g.produtos.add(t.product);
  }
  return Array.from(grouped.values()).map(g => ({
    empresa: g.empresa,
    provincia: Array.from(g.provincias).join(", ") || "—",
    transacoes: g.transacoes,
    volumeKz: g.volumeKz,
    produtosComprados: Array.from(g.produtos).slice(0, 4).join(", ") || "—",
  })).sort((a, b) => b.volumeKz - a.volumeKz);
}

// ---------------- Hook ----------------
export function useReportData(reportType: string, filters: ReportFilters) {
  return useQuery({
    queryKey: ["report", reportType, filters],
    queryFn: async () => {
      switch (reportType) {
        case "producao_provincia": return await fetchProducao(filters);
        case "pecuaria_provincia": return await fetchPecuaria(filters);
        case "agricultores_estado": return await fetchAgricultores(filters);
        case "incentivos_distribuidos": return await fetchIncentivos(filters);
        case "compras_transacoes": return await fetchCompras(filters);
        default: return [];
      }
    },
    staleTime: 2 * 60 * 1000,
  });
}
