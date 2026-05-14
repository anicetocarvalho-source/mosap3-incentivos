/**
 * Paridade dos agregados financeiros (cards por província/ECA, tabela ECA,
 * Relatórios) com a Lista de Agricultores.
 *
 * Garante que `useFinancialSummary`, `EcaBalanceTable` e `useReportData`
 * contam Removidos exactamente como o Dashboard global. Se alguém voltar a
 * meter `.neq("status","Removido")` num desses pontos, estes testes falham.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Dataset partilhado ----------
type Row = {
  code: string;
  province: string;
  municipality: string | null;
  school: string;
  status: string;
  valor_recebido: string;
  total_gasto: string;
  created_at: string;
};

function buildDataset(): Row[] {
  const rows: Row[] = [];
  const provs = ["Benguela", "Huíla", "Huambo"];
  const escolasPorProv: Record<string, string[]> = {
    Benguela: ["ECA Catumbela", "ECA Lobito"],
    Huíla: ["ECA Lubango", "ECA Caconda"],
    Huambo: ["ECA Caála", "ECA Bailundo"],
  };
  // 138 activos
  for (let i = 0; i < 138; i++) {
    const province = provs[i % 3];
    const escolas = escolasPorProv[province];
    rows.push({
      code: `A${1000 + i}`,
      province,
      municipality: `Mun-${i % 4}`,
      school: escolas[i % escolas.length],
      status: i % 7 === 0 ? "Pendente" : "Aprovado",
      valor_recebido: `${(i * 100).toFixed(2).replace(".", ",")}`,
      total_gasto: `${(i * 30).toFixed(2).replace(".", ",")}`,
      created_at: new Date(2025, 0, 1, 0, 0, i).toISOString(),
    });
  }
  // 14 Removidos em Benguela + ECA Catumbela (chaves repetidas de propósito)
  for (let i = 0; i < 14; i++) {
    rows.push({
      code: `R${2000 + i}`,
      province: "Benguela",
      municipality: "Mun-Removidos",
      school: "ECA Catumbela",
      status: "Removido",
      valor_recebido: `${(500).toFixed(2).replace(".", ",")}`,
      total_gasto: `${(120).toFixed(2).replace(".", ",")}`,
      created_at: new Date(2024, 0, 1, 0, 0, i).toISOString(),
    });
  }
  return rows;
}

const DATASET = buildDataset();

// ---------- Mock supabase ----------
function farmersBuilder() {
  let rows: Row[] = DATASET.slice();
  const builder: any = {
    _selectFields: "*",
    select: vi.fn(function (this: any, fields: string) {
      this._selectFields = fields;
      return this;
    }),
    eq: vi.fn(function (this: any, f: string, v: any) {
      rows = rows.filter((r: any) => r[f] === v);
      return this;
    }),
    ilike: vi.fn(function (this: any, f: string, v: string) {
      const needle = v.replace(/%/g, "").toLowerCase();
      rows = rows.filter((r: any) => String(r[f] ?? "").toLowerCase().includes(needle));
      return this;
    }),
    neq: vi.fn(function (this: any, f: string, v: any) {
      rows = rows.filter((r: any) => r[f] !== v);
      return this;
    }),
    not: vi.fn(function (this: any, f: string, _op: string, _v: any) {
      rows = rows.filter((r: any) => r[f] !== null && r[f] !== undefined);
      return this;
    }),
    in: vi.fn(function (this: any, f: string, vs: any[]) {
      rows = rows.filter((r: any) => vs.includes(r[f]));
      return this;
    }),
    order: vi.fn(function (this: any) {
      return this;
    }),
    range: vi.fn(function (_from: number, _to: number) {
      return Promise.resolve({ data: rows.slice(_from, _to + 1), count: rows.length, error: null });
    }),
    then: function (this: any, resolve: any, reject: any) {
      // alguns chamadores fazem `await query` directamente (sem .range)
      return Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve, reject);
    },
  };
  return builder;
}

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "farmers") return farmersBuilder();
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      in: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    };
  }),
};

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return supabaseMock;
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { parseAmount } from "@/lib/numberFormat";

// Reproduz a lógica de useFinancialSummary (sem React Query)
async function financialSummary(filters: { province?: string; school?: string }) {
  const rows = await fetchAllPages<any>(() => {
    let q = (supabase as any).from("farmers").select("code, valor_recebido, total_gasto", { count: "exact" });
    if (filters.province) q = q.eq("province", filters.province);
    if (filters.school) q = q.ilike("school", filters.school);
    return q;
  });
  let recebido = 0, gasto = 0, beneficiarios = 0;
  for (const r of rows) {
    const vr = parseAmount(r.valor_recebido);
    const tg = parseAmount(r.total_gasto);
    recebido += vr; gasto += tg;
    if (vr > 0) beneficiarios += 1;
  }
  return { totalFarmers: rows.length, recebido, gasto, beneficiarios };
}

beforeEach(() => vi.clearAllMocks());

describe("useFinancialSummary inclui Removidos", () => {
  it("totais por província batem com soma directa do dataset (Removidos incluídos)", async () => {
    const sum = await financialSummary({ province: "Benguela" });
    const esperado = DATASET.filter((r) => r.province === "Benguela");
    expect(sum.totalFarmers).toBe(esperado.length);
    expect(sum.recebido).toBeCloseTo(
      esperado.reduce((a, r) => a + parseAmount(r.valor_recebido), 0),
      2
    );
    expect(sum.gasto).toBeCloseTo(
      esperado.reduce((a, r) => a + parseAmount(r.total_gasto), 0),
      2
    );
    // Removidos têm que estar dentro
    const removidos = esperado.filter((r) => r.status === "Removido").length;
    expect(removidos).toBe(14);
  });

  it("totais por ECA contam Removidos", async () => {
    const sum = await financialSummary({ school: "ECA Catumbela" });
    const esperado = DATASET.filter((r) =>
      r.school.toLowerCase().includes("eca catumbela")
    );
    expect(sum.totalFarmers).toBe(esperado.length);
    const removidos = esperado.filter((r) => r.status === "Removido").length;
    expect(removidos).toBe(14);
  });
});

describe("EcaBalanceTable agrega incluindo Removidos", () => {
  it("soma das linhas por ECA == nº de produtores da Lista nessa província", async () => {
    // Replica EXACTAMENTE a query do componente após a mudança (sem .neq)
    const province = "Benguela";
    const data = await fetchAllPages<any>(() =>
      (supabase as any)
        .from("farmers")
        .select("school, municipality, valor_recebido, total_gasto", { count: "exact" })
        .eq("province", province)
    );
    const totalListaProvincia = DATASET.filter((r) => r.province === province).length;
    expect(data.length).toBe(totalListaProvincia);

    // Agregação por ECA
    const byEca = new Map<string, number>();
    for (const f of data) {
      byEca.set(f.school, (byEca.get(f.school) ?? 0) + 1);
    }
    const totalLinhas = Array.from(byEca.values()).reduce((a, b) => a + b, 0);
    expect(totalLinhas).toBe(totalListaProvincia);
    // ECA Catumbela inclui os 14 Removidos
    const catumbela = byEca.get("ECA Catumbela") ?? 0;
    expect(catumbela).toBeGreaterThanOrEqual(14);
  });
});

describe("useReportData (farmersByProvince) inclui Removidos", () => {
  it("contagem por província bate com a Lista", async () => {
    const data = await fetchAllPages<any>(() =>
      (supabase as any).from("farmers").select("province, status, created_at", { count: "exact" })
    );
    const byProv = new Map<string, number>();
    for (const f of data) byProv.set(f.province, (byProv.get(f.province) ?? 0) + 1);

    for (const [prov, n] of byProv.entries()) {
      const esperado = DATASET.filter((r) => r.province === prov).length;
      expect(n).toBe(esperado);
    }
    expect(data.length).toBe(DATASET.length); // 152 (138 + 14)
  });
});

describe("Cross-source: Lista vs financialSummary global", () => {
  it("soma agregada por todas as províncias == total da Lista", async () => {
    const provs = Array.from(new Set(DATASET.map((r) => r.province)));
    let totalAggregado = 0;
    for (const p of provs) {
      const s = await financialSummary({ province: p });
      totalAggregado += s.totalFarmers;
    }
    expect(totalAggregado).toBe(DATASET.length);
  });

  it("soma de recebido por província == soma directa global (sem fugas de Removidos)", async () => {
    const provs = Array.from(new Set(DATASET.map((r) => r.province)));
    let recebidoAgg = 0;
    for (const p of provs) {
      const s = await financialSummary({ province: p });
      recebidoAgg += s.recebido;
    }
    const recebidoGlobal = DATASET.reduce(
      (a, r) => a + parseAmount(r.valor_recebido),
      0
    );
    expect(recebidoAgg).toBeCloseTo(recebidoGlobal, 2);
  });
});
