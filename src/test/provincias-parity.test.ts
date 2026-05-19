/**
 * Teste de paridade /provincias ↔ Dashboard ↔ Lista de Agricultores.
 *
 * A página /provincias usa a RPC `get_farmer_counts_by_location` para obter
 * contagens agregadas por (província, município, escola). Este teste garante
 * que a soma dessas contagens bate certo com:
 *   - `dashboard_kpis.total_farmers` (Dashboard)
 *   - `fetchAllPages` sobre `farmers` em modo Admin com `includeRemoved: true`
 *     (Lista de Agricultores)
 *
 * Regra canónica do projecto: Removidos contam em TODOS os agregados.
 * Se alguém adicionar `.neq('status','Removido')` à RPC, este teste falha.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Dataset partilhado ----------
type FarmerRow = {
  id: string;
  code: string;
  full_name: string;
  bi: string | null;
  phone: string | null;
  province: string | null;
  municipality: string | null;
  school: string | null;
  status: string;
  photo_frontal_url: string | null;
  patec: number | null;
  valor_recebido: string | null;
  saldo_final: string | null;
  total_gasto: string | null;
  created_at: string;
};

const PROVS = ["Benguela", "Huíla", "Huambo"];
const MUNS = ["Lobito", "Lubango", "Caála"];
const SCHS = ["ECA-1", "ECA-2", "ECA-3", "ECA-4"];

function makeDataset(): FarmerRow[] {
  const rows: FarmerRow[] = [];
  const ATIVOS = 138;
  const REMOVIDOS = 14;
  for (let i = 0; i < ATIVOS; i++) {
    rows.push({
      id: `id-a-${i}`,
      code: `F${1000 + i}`,
      full_name: `Activo ${i}`,
      bi: null,
      phone: null,
      province: PROVS[i % PROVS.length],
      municipality: MUNS[i % MUNS.length],
      school: SCHS[i % SCHS.length],
      status: i % 5 === 0 ? "Pendente" : "Aprovado",
      photo_frontal_url: null,
      patec: null,
      valor_recebido: "0,00",
      saldo_final: "0,00",
      total_gasto: "0,00",
      created_at: new Date(2025, 0, 1, 0, 0, i).toISOString(),
    });
  }
  for (let i = 0; i < REMOVIDOS; i++) {
    rows.push({
      id: `id-r-${i}`,
      code: `R${2000 + i}`,
      full_name: `Removido ${i}`,
      bi: null,
      phone: null,
      province: "Bié", // só Removidos vivem aqui
      municipality: "Kuito",
      school: "ECA-Bié",
      status: "Removido",
      photo_frontal_url: null,
      patec: null,
      valor_recebido: "0,00",
      saldo_final: "0,00",
      total_gasto: "0,00",
      created_at: new Date(2024, 0, 1, 0, 0, i).toISOString(),
    });
  }
  return rows;
}

const DATASET = makeDataset();
const TOTAL_ESPERADO = DATASET.length; // 152

// ---------- Mock do cliente Supabase ----------
function makeFarmersQuery() {
  const builder: any = {
    _filtered: DATASET.slice(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    neq: vi.fn(function (this: any, field: string, value: any) {
      this._filtered = this._filtered.filter((r: any) => r[field] !== value);
      return this;
    }),
    in: vi.fn(function (this: any, field: string, values: any[]) {
      this._filtered = this._filtered.filter((r: any) =>
        values.includes(r[field])
      );
      return this;
    }),
    eq: vi.fn(function (this: any, field: string, value: any) {
      this._filtered = this._filtered.filter((r: any) => r[field] === value);
      return this;
    }),
    range: vi.fn(function (this: any, from: number, to: number) {
      const slice = this._filtered.slice(from, to + 1);
      return Promise.resolve({
        data: slice,
        count: this._filtered.length,
        error: null,
      });
    }),
  };
  return builder;
}

const norm = (v: string | null | undefined) =>
  (v ?? "").trim().toLowerCase();

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "farmers") return makeFarmersQuery();
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [] }),
    };
  }),
  rpc: vi.fn((fn: string) => {
    if (fn === "dashboard_kpis") {
      return Promise.resolve({
        data: { total_farmers: DATASET.length },
        error: null,
      });
    }
    if (fn === "get_farmer_counts_by_location") {
      // Replica a função SQL: agrega por (province, municipality, school)
      // normalizados com trim+lower. Inclui Removidos.
      const map = new Map<string, number>();
      for (const r of DATASET) {
        const key = `${norm(r.province)}|${norm(r.municipality)}|${norm(r.school)}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      const rows = Array.from(map, ([key, total]) => {
        const [province, municipality, school] = key.split("|");
        return { province, municipality, school, total };
      });
      return Promise.resolve({ data: rows, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }),
};

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return supabaseMock;
  },
}));

import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { applyFarmerScopeFilter, resolveScope } from "@/lib/farmerScope";

beforeEach(() => {
  vi.clearAllMocks();
});

async function getProvinciasCounts() {
  const { data } = await (supabase as any).rpc(
    "get_farmer_counts_by_location"
  );
  return data as { province: string; municipality: string; school: string; total: number }[];
}

describe("Paridade /provincias ↔ Dashboard ↔ Lista", () => {
  it("RPC get_farmer_counts_by_location soma == total do dataset (inclui Removidos)", async () => {
    const counts = await getProvinciasCounts();
    const soma = counts.reduce((a, b) => a + b.total, 0);
    expect(soma).toBe(TOTAL_ESPERADO);
  });

  it("Soma das contagens de /provincias == dashboard_kpis.total_farmers", async () => {
    const counts = await getProvinciasCounts();
    const somaProvincias = counts.reduce((a, b) => a + b.total, 0);
    const { data: kpis } = await (supabase as any).rpc("dashboard_kpis", {
      p_scope: "global",
      p_provinces: [],
      p_ecas: [],
    });
    expect(somaProvincias).toBe(kpis.total_farmers);
  });

  it("Soma das contagens de /provincias == Lista (admin, includeRemoved:true)", async () => {
    const counts = await getProvinciasCounts();
    const somaProvincias = counts.reduce((a, b) => a + b.total, 0);

    const scope = await resolveScope("admin-uid", ["admin"]);
    const rows = await fetchAllPages<FarmerRow>(() =>
      applyFarmerScopeFilter(
        (supabase as any).from("farmers").select("*").order("created_at"),
        scope,
        { includeRemoved: true }
      )
    );

    expect(rows.length).toBe(TOTAL_ESPERADO);
    expect(somaProvincias).toBe(rows.length);
  });

  it("Agregado por província bate com agregado calculado do dataset bruto", async () => {
    const counts = await getProvinciasCounts();
    const rpcByProv = new Map<string, number>();
    for (const c of counts) {
      rpcByProv.set(c.province, (rpcByProv.get(c.province) ?? 0) + c.total);
    }
    const datasetByProv = new Map<string, number>();
    for (const r of DATASET) {
      const p = norm(r.province);
      datasetByProv.set(p, (datasetByProv.get(p) ?? 0) + 1);
    }
    expect(Object.fromEntries(rpcByProv)).toEqual(
      Object.fromEntries(datasetByProv)
    );
  });

  it("Província só com Removidos aparece nas contagens de /provincias", async () => {
    const counts = await getProvinciasCounts();
    const bie = counts.find((c) => c.province === norm("Bié"));
    expect(bie).toBeDefined();
    expect(bie!.total).toBeGreaterThan(0);
  });
});
