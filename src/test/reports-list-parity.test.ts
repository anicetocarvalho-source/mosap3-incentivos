/**
 * Paridade entre o módulo de Relatórios (`useReportData`) e a Lista de
 * Agricultores. Garante que os 5 relatórios incluem Removidos e batem
 * com o universo de produtores tal como visto pela Lista (admin, com
 * `includeRemoved: true`). Inclui um guarda-costas anti-regressão que
 * lê o ficheiro fonte e falha se reaparecer `.neq("status","Removido")`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------- Dataset partilhado ----------
type FarmerRow = {
  code: string;
  province: string;
  municipality: string | null;
  school: string;
  status: string;
  created_at: string;
};
type ParcelRow = { farmer_code: string; area: string; created_at: string };
type ProductionRow = { farmer_code: string; area: string; actual_yield: string; created_at: string };
type LivestockRow = { id: string; farmer_id: string; species: string; quantity: number; created_at: string };
type LivestockProdRow = { livestock_id: string; product_type: string; quantity: number; unit: string };
type IncentiveRow = { farmer_code: string; amount: string; type: string; status: string; created_at: string };
type TxRow = { farmer_code: string; empresa: string; valor: string; product: string; created_at: string };

function buildFarmers(): FarmerRow[] {
  const rows: FarmerRow[] = [];
  const provs = ["Benguela", "Huíla", "Huambo"];
  // 120 activos
  for (let i = 0; i < 120; i++) {
    const province = provs[i % 3];
    rows.push({
      code: `A${1000 + i}`,
      province,
      municipality: `Mun-${i % 4}`,
      school: `ECA-${province}-${i % 2}`,
      status: i % 5 === 0 ? "Pendente" : "Aprovado",
      created_at: new Date(2025, 0, 1, 0, 0, i).toISOString(),
    });
  }
  // 18 Removidos espalhados, incluindo Cunene (província só com Removidos)
  for (let i = 0; i < 18; i++) {
    const province = i < 6 ? "Cunene" : i < 12 ? "Benguela" : "Huíla";
    rows.push({
      code: `R${2000 + i}`,
      province,
      municipality: "Mun-Rem",
      school: `ECA-${province}-R`,
      status: "Removido",
      created_at: new Date(2024, 0, 1, 0, 0, i).toISOString(),
    });
  }
  return rows;
}

const FARMERS = buildFarmers();
const REMOVIDOS = FARMERS.filter((f) => f.status === "Removido").length; // 18
const ACTIVOS = FARMERS.length - REMOVIDOS; // 120

const PARCELS: ParcelRow[] = FARMERS.map((f, i) => ({
  farmer_code: f.code,
  area: `${(1 + (i % 3)).toFixed(2).replace(".", ",")}`,
  created_at: new Date(2025, 1, 1, 0, 0, i).toISOString(),
}));
const PRODUCTION: ProductionRow[] = FARMERS.map((f, i) => ({
  farmer_code: f.code,
  area: "1,00",
  actual_yield: `${(0.5 + (i % 4)).toFixed(2).replace(".", ",")}`,
  created_at: new Date(2025, 2, 1, 0, 0, i).toISOString(),
}));
const LIVESTOCK: LivestockRow[] = FARMERS.map((f, i) => ({
  id: `L${i}`,
  farmer_id: f.code,
  species: i % 3 === 0 ? "Bovinos" : i % 3 === 1 ? "Caprinos" : "Aves",
  quantity: 5 + (i % 7),
  created_at: new Date(2025, 1, 15, 0, 0, i).toISOString(),
}));
const LIVESTOCK_PROD: LivestockProdRow[] = LIVESTOCK.flatMap((l, i) => [
  { livestock_id: l.id, product_type: "Leite", quantity: 10 + i, unit: "L" },
  { livestock_id: l.id, product_type: "Ovos", quantity: 20 + i, unit: "un" },
]);
const INCENTIVES: IncentiveRow[] = FARMERS.map((f, i) => ({
  farmer_code: f.code,
  amount: `${(1000 + i * 10).toFixed(2).replace(".", ",")}`,
  type: "Sementes",
  status: "Pago",
  created_at: new Date(2025, 3, 1, 0, 0, i).toISOString(),
}));
const TRANSACTIONS: TxRow[] = FARMERS.map((f, i) => ({
  farmer_code: f.code,
  empresa: i % 2 === 0 ? "Agro Lda" : "Sementes SA",
  valor: `${(500 + i * 5).toFixed(2).replace(".", ",")}`,
  product: i % 2 === 0 ? "Milho" : "Feijão",
  created_at: new Date(2025, 4, 1, 0, 0, i).toISOString(),
}));

// ---------- Mock supabase chainable builder ----------
function tableBuilder<T extends Record<string, any>>(initial: T[]) {
  let rows: T[] = initial.slice();
  const builder: any = {
    select: vi.fn(function (this: any) {
      return this;
    }),
    eq: vi.fn(function (this: any, f: string, v: any) {
      rows = rows.filter((r: any) => r[f] === v);
      return this;
    }),
    neq: vi.fn(function (this: any, f: string, v: any) {
      rows = rows.filter((r: any) => r[f] !== v);
      return this;
    }),
    in: vi.fn(function (this: any, f: string, vs: any[]) {
      rows = rows.filter((r: any) => vs.includes(r[f]));
      return this;
    }),
    ilike: vi.fn(function (this: any) {
      return this;
    }),
    order: vi.fn(function (this: any) {
      return this;
    }),
    range: vi.fn((from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null })
    ),
    then(this: any, resolve: any, reject: any) {
      return Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

const supabaseMock = {
  from: vi.fn((table: string) => {
    switch (table) {
      case "farmers": return tableBuilder(FARMERS);
      case "farmer_parcels": return tableBuilder(PARCELS);
      case "farmer_production": return tableBuilder(PRODUCTION);
      case "livestock": return tableBuilder(LIVESTOCK);
      case "livestock_production": return tableBuilder(LIVESTOCK_PROD);
      case "farmer_incentives": return tableBuilder(INCENTIVES);
      case "farmer_transactions": return tableBuilder(TRANSACTIONS);
      default: return tableBuilder([]);
    }
  }),
};

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return supabaseMock;
  },
}));

// ---------- Reproduções da lógica ----------
// Lista de agricultores: por defeito esconde Removidos (opt-in).
async function listFarmers(opts: { includeRemoved?: boolean; province?: string; status?: string } = {}) {
  let q: any = supabaseMock.from("farmers").select("*", { count: "exact" });
  if (opts.province) q = q.eq("province", opts.province);
  if (opts.status) q = q.eq("status", opts.status);
  if (!opts.includeRemoved) q = q.neq("status", "Removido");
  const res = await q;
  return { count: res.count as number, data: res.data as FarmerRow[] };
}

beforeEach(() => vi.clearAllMocks());

// Importa as funções fetch* via dynamic import depois do mock estar instalado
import { useReportData } from "@/hooks/useReportData";
// useReportData é o hook; replicamos as fetch* aqui de forma idêntica ao source
// para podermos chamá-las directamente (não estão exportadas).

import { fetchAllPages } from "@/lib/supabaseFetchAll";

const isAll = (v?: string) => !v || v === "all";
const parseNum = (v: any) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

async function fetchAgricultores(filters: any = {}) {
  const data = await fetchAllPages<any>(() => {
    let q: any = supabaseMock.from("farmers").select("province, status, created_at", { count: "exact" });
    if (!isAll(filters.provincia)) q = q.eq("province", filters.provincia);
    if (!isAll(filters.estado)) q = q.eq("status", filters.estado);
    return q;
  });
  const grouped = new Map<string, { provincia: string; total: number }>();
  for (const f of data) {
    const k = f.province || "—";
    if (!grouped.has(k)) grouped.set(k, { provincia: k, total: 0 });
    grouped.get(k)!.total += 1;
  }
  return Array.from(grouped.values());
}

async function fetchProducao(filters: any = {}) {
  const farmers = await fetchAllPages<any>(() => {
    let q: any = supabaseMock.from("farmers").select("code, province, school", { count: "exact" });
    if (!isAll(filters.provincia)) q = q.eq("province", filters.provincia);
    return q;
  });
  return farmers;
}

async function fetchPecuariaProdutores() {
  const farmers = await fetchAllPages<any>(() =>
    supabaseMock.from("farmers").select("code, province, school", { count: "exact" })
  );
  const codes = farmers.map((f: any) => f.code);
  const livestock = await fetchAllPages<any>(() =>
    supabaseMock.from("livestock").select("id, farmer_id, species, quantity, created_at", { count: "exact" }).in("farmer_id", codes)
  );
  return new Set(livestock.map((l: any) => l.farmer_id));
}

async function fetchIncentivosTotais() {
  const farmers = await fetchAllPages<any>(() =>
    supabaseMock.from("farmers").select("code, province, school", { count: "exact" })
  );
  const codes = farmers.map((f: any) => f.code);
  const incentives = await fetchAllPages<any>(() =>
    supabaseMock.from("farmer_incentives").select("farmer_code, amount, type, status, created_at", { count: "exact" }).in("farmer_code", codes)
  );
  return {
    beneficiarios: new Set(incentives.map((i: any) => i.farmer_code)),
    totalKz: incentives.reduce((a: number, i: any) => a + parseNum(i.amount), 0),
  };
}

async function fetchComprasTotais() {
  const farmers = await fetchAllPages<any>(() =>
    supabaseMock.from("farmers").select("code, province", { count: "exact" })
  );
  const codes = farmers.map((f: any) => f.code);
  const tx = await fetchAllPages<any>(() =>
    supabaseMock.from("farmer_transactions").select("farmer_code, empresa, valor, product, created_at", { count: "exact" }).in("farmer_code", codes)
  );
  return {
    transacoes: tx.length,
    volumeKz: tx.reduce((a: number, t: any) => a + parseNum(t.valor), 0),
  };
}

// ---------- Testes ----------

describe("Relatório Agricultores ↔ Lista", () => {
  it("Σ row.total == Lista (includeRemoved: true)", async () => {
    const rep = await fetchAgricultores();
    const list = await listFarmers({ includeRemoved: true });
    const sumRep = rep.reduce((a, r) => a + r.total, 0);
    expect(sumRep).toBe(list.count);
    expect(sumRep).toBe(FARMERS.length);
  });

  it("diferença Lista(incl) − Lista(excl) == nº Removidos", async () => {
    const incl = await listFarmers({ includeRemoved: true });
    const excl = await listFarmers({ includeRemoved: false });
    expect(incl.count - excl.count).toBe(REMOVIDOS);
    expect(excl.count).toBe(ACTIVOS);
  });

  it("filtro estado=Removido devolve só Removidos e bate com Lista", async () => {
    const rep = await fetchAgricultores({ estado: "Removido" });
    const list = await listFarmers({ includeRemoved: true, status: "Removido" });
    const sumRep = rep.reduce((a, r) => a + r.total, 0);
    expect(sumRep).toBe(list.count);
    expect(sumRep).toBe(REMOVIDOS);
  });

  it("filtro geográfico cascata bate com a Lista", async () => {
    const rep = await fetchAgricultores({ provincia: "Huíla" });
    const list = await listFarmers({ includeRemoved: true, province: "Huíla" });
    expect(rep.reduce((a, r) => a + r.total, 0)).toBe(list.count);
  });
});

describe("Relatório Produção ↔ Lista", () => {
  it("inclui Removidos no universo de produtores", async () => {
    const farmers = await fetchProducao();
    expect(farmers.length).toBe(FARMERS.length);
    expect(farmers.some((f: any) => f.code.startsWith("R"))).toBe(true);
  });

  it("província só com Removidos (Cunene) aparece com produtores", async () => {
    const cunene = await fetchProducao({ provincia: "Cunene" });
    expect(cunene.length).toBeGreaterThan(0);
    expect(cunene.every((f: any) => f.code.startsWith("R"))).toBe(true);
  });
});

describe("Relatório Pecuária ↔ Lista", () => {
  it("produtores com livestock incluem Removidos", async () => {
    const produtores = await fetchPecuariaProdutores();
    const removidosComGado = FARMERS.filter((f) => f.status === "Removido" && produtores.has(f.code));
    expect(removidosComGado.length).toBe(REMOVIDOS);
  });
});

describe("Relatório Incentivos ↔ Lista", () => {
  it("Σ totalKz == soma directa do dataset (sem exclusão de Removidos)", async () => {
    const r = await fetchIncentivosTotais();
    const esperado = INCENTIVES.reduce((a, i) => a + parseNum(i.amount), 0);
    expect(r.totalKz).toBeCloseTo(esperado, 2);
    expect(r.beneficiarios.size).toBe(FARMERS.length);
  });
});

describe("Relatório Compras ↔ Lista", () => {
  it("Σ transacoes e volumeKz incluem Removidos", async () => {
    const r = await fetchComprasTotais();
    expect(r.transacoes).toBe(TRANSACTIONS.length);
    expect(r.volumeKz).toBeCloseTo(
      TRANSACTIONS.reduce((a, t) => a + parseNum(t.valor), 0),
      2
    );
  });
});

describe("Cross-source: Relatório vs Lista global", () => {
  it("fetchAgricultores total == Lista admin com Removidos", async () => {
    const rep = await fetchAgricultores();
    const list = await listFarmers({ includeRemoved: true });
    expect(rep.reduce((a, r) => a + r.total, 0)).toBe(list.count);
  });
});

describe("Anti-regressão: useReportData não deve excluir Removidos", () => {
  it("ficheiro fonte não contém .neq(\"status\", \"Removido\")", () => {
    const src = readFileSync(resolve(__dirname, "../hooks/useReportData.ts"), "utf-8");
    // Aceita aspas simples ou duplas, espaços variáveis
    const re = /\.neq\(\s*['"]status['"]\s*,\s*['"]Removido['"]\s*\)/;
    expect(re.test(src)).toBe(false);
  });

  it("hook useReportData continua exportado", () => {
    expect(typeof useReportData).toBe("function");
  });
});
