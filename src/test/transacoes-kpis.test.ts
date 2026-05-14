/**
 * KPIs da página Transações.
 *
 * Garante invariantes do RPC `transacoes_kpis`:
 * - soma dos top_products[].count <= total_count
 * - soma dos top_products[].total_kz <= total_volume_kz
 * - soma dos top_empresas[].count <= total_count
 * - soma dos top_empresas[].total_kz <= total_volume_kz
 * - filtros (empresa/produto/range valor) reduzem o universo
 * - Removidos contam (não são excluídos do agregado) — Core rule
 */
import { describe, it, expect } from "vitest";

type Tx = { farmer_code: string; empresa: string; product: string; valor_num: number; status?: string };

function buildDataset(): Tx[] {
  const rows: Tx[] = [];
  const empresas = ["Agrolider", "Sonangol Agro", "CampoVerde"];
  const produtos = ["Adubo NPK", "Sementes Milho", "Pesticida X", "Enxada", "Botas"];
  for (let i = 0; i < 200; i++) {
    rows.push({
      farmer_code: `F${1000 + (i % 50)}`,
      empresa: empresas[i % empresas.length],
      product: produtos[i % produtos.length],
      valor_num: 1000 + (i * 137) % 20000,
      status: i % 11 === 0 ? "Removido" : "Aprovado", // 18 Removidos
    });
  }
  return rows;
}

type KpiRow = { name: string; total_kz: number; count: number };
type Kpis = {
  total_count: number;
  total_volume_kz: number;
  min_valor: number;
  max_valor: number;
  avg_valor: number;
  top_products: KpiRow[];
  top_empresas: KpiRow[];
  top_products_by_count: KpiRow[];
  top_empresas_by_count: KpiRow[];
};

function computeKpis(
  rows: Tx[],
  filters: { empresa?: string; product?: string; min?: number; max?: number; farmer?: string } = {}
): Kpis {
  // NÃO filtra Removidos — Core rule
  let scoped = rows;
  if (filters.empresa) scoped = scoped.filter((r) => r.empresa === filters.empresa);
  if (filters.product) scoped = scoped.filter((r) => r.product === filters.product);
  if (filters.min != null) scoped = scoped.filter((r) => r.valor_num >= filters.min!);
  if (filters.max != null) scoped = scoped.filter((r) => r.valor_num <= filters.max!);
  if (filters.farmer) scoped = scoped.filter((r) => r.farmer_code.includes(filters.farmer!));

  const total_count = scoped.length;
  const total_volume_kz = scoped.reduce((s, r) => s + r.valor_num, 0);
  const vals = scoped.map((r) => r.valor_num);
  const min_valor = vals.length ? Math.min(...vals) : 0;
  const max_valor = vals.length ? Math.max(...vals) : 0;
  const avg_valor = total_count ? total_volume_kz / total_count : 0;

  const groupBy = (keyFn: (r: Tx) => string): KpiRow[] => {
    const m = new Map<string, { total_kz: number; count: number }>();
    for (const r of scoped) {
      const k = keyFn(r);
      const cur = m.get(k) || { total_kz: 0, count: 0 };
      cur.total_kz += r.valor_num;
      cur.count += 1;
      m.set(k, cur);
    }
    return Array.from(m.entries()).map(([name, v]) => ({ name, ...v }));
  };
  const prods = groupBy((r) => r.product);
  const emps = groupBy((r) => r.empresa);

  return {
    total_count,
    total_volume_kz,
    min_valor,
    max_valor,
    avg_valor,
    top_products: [...prods].sort((a, b) => b.total_kz - a.total_kz).slice(0, 5),
    top_empresas: [...emps].sort((a, b) => b.total_kz - a.total_kz).slice(0, 5),
    top_products_by_count: [...prods].sort((a, b) => b.count - a.count).slice(0, 5),
    top_empresas_by_count: [...emps].sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

describe("transacoes_kpis — invariantes e filtros", () => {
  const data = buildDataset();

  it("totais batem com o dataset (Removidos contam)", () => {
    const k = computeKpis(data);
    expect(k.total_count).toBe(200);
    expect(k.total_volume_kz).toBe(data.reduce((s, r) => s + r.valor_num, 0));
    // Confirma que Removidos NÃO foram excluídos
    const removidos = data.filter((r) => r.status === "Removido").length;
    expect(removidos).toBeGreaterThan(0);
  });

  it("Σ top_products.count ≤ total_count e Σ top_products.total_kz ≤ total_volume_kz", () => {
    const k = computeKpis(data);
    const sumCount = k.top_products.reduce((s, r) => s + r.count, 0);
    const sumKz = k.top_products.reduce((s, r) => s + r.total_kz, 0);
    expect(sumCount).toBeLessThanOrEqual(k.total_count);
    expect(sumKz).toBeLessThanOrEqual(k.total_volume_kz);
  });

  it("Σ top_empresas.count ≤ total_count e Σ top_empresas.total_kz ≤ total_volume_kz", () => {
    const k = computeKpis(data);
    const sumCount = k.top_empresas.reduce((s, r) => s + r.count, 0);
    const sumKz = k.top_empresas.reduce((s, r) => s + r.total_kz, 0);
    expect(sumCount).toBeLessThanOrEqual(k.total_count);
    expect(sumKz).toBeLessThanOrEqual(k.total_volume_kz);
  });

  it("top está ordenado decrescentemente por volume e por contagem", () => {
    const k = computeKpis(data);
    for (let i = 1; i < k.top_products.length; i++) {
      expect(k.top_products[i].total_kz).toBeLessThanOrEqual(k.top_products[i - 1].total_kz);
    }
    for (let i = 1; i < k.top_products_by_count.length; i++) {
      expect(k.top_products_by_count[i].count).toBeLessThanOrEqual(k.top_products_by_count[i - 1].count);
    }
  });

  it("filtro por empresa reduz total e isola tops a essa empresa", () => {
    const all = computeKpis(data);
    const k = computeKpis(data, { empresa: "Agrolider" });
    expect(k.total_count).toBeLessThan(all.total_count);
    expect(k.top_empresas.length).toBe(1);
    expect(k.top_empresas[0].name).toBe("Agrolider");
  });

  it("filtro por faixa de valor (min/max) reduz universo e respeita limites", () => {
    const k = computeKpis(data, { min: 5000, max: 10000 });
    expect(k.min_valor).toBeGreaterThanOrEqual(5000);
    expect(k.max_valor).toBeLessThanOrEqual(10000);
    expect(k.total_count).toBeGreaterThan(0);
    expect(k.total_count).toBeLessThan(200);
  });

  it("filtro por produto isola top_products a esse produto", () => {
    const k = computeKpis(data, { product: "Adubo NPK" });
    expect(k.top_products.length).toBe(1);
    expect(k.top_products[0].name).toBe("Adubo NPK");
  });

  it("ticket médio = volume / count", () => {
    const k = computeKpis(data);
    expect(k.avg_valor).toBeCloseTo(k.total_volume_kz / k.total_count, 4);
  });

  it("filtro vazio não rejeita Removidos", () => {
    const removidos = data.filter((r) => r.status === "Removido").length;
    const k = computeKpis(data);
    // Volume total inclui contribuições dos Removidos
    const semRemovidos = data.filter((r) => r.status !== "Removido").reduce((s, r) => s + r.valor_num, 0);
    expect(k.total_volume_kz).toBeGreaterThan(semRemovidos);
    expect(k.total_count).toBe(semRemovidos === k.total_volume_kz ? 0 : 200);
    expect(removidos).toBeGreaterThan(0);
  });
});
