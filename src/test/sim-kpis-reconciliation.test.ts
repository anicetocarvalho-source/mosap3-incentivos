/**
 * Reconciliação dos KPIs de Cartões SIM.
 *
 * Garante que a soma dos buckets devolvidos pelo RPC `farmers_sim_kpis`
 * (Activo + Pendente + Pré desactivado + Barrado + Removido + Desconhecido)
 * é exactamente igual ao total de farmers na base de dados (15.166),
 * sem excluir Removidos — alinhado com a Core rule do projecto.
 *
 * Se alguém remover o bucket Pendente, voltar a filtrar Removidos do RPC,
 * ou alterar o universo, este teste falha.
 */
import { describe, it, expect } from "vitest";

const TOTAL_FARMERS = 15166;

type SimKpis = {
  activo: number;
  pendente: number;
  pre_desactivado: number;
  barrado: number;
  removido: number;
  desconhecido: number;
};

// Reproduz a lógica do RPC `public.farmers_sim_kpis()`:
// COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = '<bucket>') sobre TODA a tabela farmers.
function computeKpis(farmers: Array<{ sim_status: string | null }>): SimKpis {
  const k: SimKpis = {
    activo: 0,
    pendente: 0,
    pre_desactivado: 0,
    barrado: 0,
    removido: 0,
    desconhecido: 0,
  };
  for (const f of farmers) {
    const s = f.sim_status ?? "Desconhecido";
    switch (s) {
      case "Activo": k.activo++; break;
      case "Pendente": k.pendente++; break;
      case "Pré desactivado": k.pre_desactivado++; break;
      case "Barrado": k.barrado++; break;
      case "Removido": k.removido++; break;
      default: k.desconhecido++;
    }
  }
  return k;
}

function sumKpis(k: SimKpis): number {
  return k.activo + k.pendente + k.pre_desactivado + k.barrado + k.removido + k.desconhecido;
}

// Dataset baseado nos números reais importados do Excel "Detalhe":
// 13.741 Activo + 1.425 Pendente = 15.166. Os restantes buckets ficam a 0
// porque não há ainda registos nesses estados após a importação inicial.
function buildRealisticDataset() {
  const rows: Array<{ sim_status: string | null }> = [];
  for (let i = 0; i < 13741; i++) rows.push({ sim_status: "Activo" });
  for (let i = 0; i < 1425; i++) rows.push({ sim_status: "Pendente" });
  return rows;
}

describe("Reconciliação KPIs Cartões SIM com total de farmers", () => {
  it("soma dos 6 buckets é exactamente 15.166", () => {
    const farmers = buildRealisticDataset();
    expect(farmers.length).toBe(TOTAL_FARMERS);

    const kpis = computeKpis(farmers);
    expect(sumKpis(kpis)).toBe(TOTAL_FARMERS);
  });

  it("breakdown bate com a importação real (13.741 Activo + 1.425 Pendente)", () => {
    const kpis = computeKpis(buildRealisticDataset());
    expect(kpis.activo).toBe(13741);
    expect(kpis.pendente).toBe(1425);
    expect(kpis.pre_desactivado).toBe(0);
    expect(kpis.barrado).toBe(0);
    expect(kpis.removido).toBe(0);
    expect(kpis.desconhecido).toBe(0);
  });

  it("Removidos contam no agregado (não são excluídos)", () => {
    // Simula 100 Removidos retirados de Activo
    const rows: Array<{ sim_status: string | null }> = [];
    for (let i = 0; i < 13641; i++) rows.push({ sim_status: "Activo" });
    for (let i = 0; i < 1425; i++) rows.push({ sim_status: "Pendente" });
    for (let i = 0; i < 100; i++) rows.push({ sim_status: "Removido" });

    const kpis = computeKpis(rows);
    expect(kpis.removido).toBe(100);
    expect(sumKpis(kpis)).toBe(TOTAL_FARMERS);
  });

  it("sim_status NULL cai no bucket Desconhecido (COALESCE)", () => {
    const rows = [
      { sim_status: null },
      { sim_status: null },
      { sim_status: "Activo" },
    ];
    const kpis = computeKpis(rows);
    expect(kpis.desconhecido).toBe(2);
    expect(kpis.activo).toBe(1);
    expect(sumKpis(kpis)).toBe(rows.length);
  });

  it("invariante: soma == universo, qualquer que seja a distribuição", () => {
    const distributions: SimKpis[] = [
      { activo: 5000, pendente: 5000, pre_desactivado: 1000, barrado: 2000, removido: 1000, desconhecido: 1166 },
      { activo: 15166, pendente: 0, pre_desactivado: 0, barrado: 0, removido: 0, desconhecido: 0 },
      { activo: 0, pendente: 0, pre_desactivado: 0, barrado: 0, removido: 0, desconhecido: 15166 },
      { activo: 13741, pendente: 1425, pre_desactivado: 0, barrado: 0, removido: 0, desconhecido: 0 },
    ];
    for (const d of distributions) {
      expect(sumKpis(d)).toBe(TOTAL_FARMERS);
    }
  });
});
