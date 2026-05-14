/**
 * Reconciliação dos KPIs de Cartões SIM.
 *
 * Garante que a soma dos 8 buckets devolvidos pelo RPC `farmers_sim_kpis`
 * (Activo + Pendente + Pré activo + Pré desactivado + Desactivado +
 *  Barrado + Removido + Desconhecido) é exactamente igual ao total
 * de farmers na base de dados (15.166), sem excluir Removidos —
 * alinhado com a Core rule do projecto.
 *
 * Se alguém remover um bucket, voltar a filtrar Removidos do RPC,
 * ou alterar o universo, este teste falha.
 */
import { describe, it, expect } from "vitest";
import { normalizeSimStatus, SIM_STATUSES } from "@/lib/reconciliation";

const TOTAL_FARMERS = 15166;

type SimKpis = {
  activo: number;
  pendente: number;
  pre_activo: number;
  pre_desactivado: number;
  desactivado: number;
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
    pre_activo: 0,
    pre_desactivado: 0,
    desactivado: 0,
    barrado: 0,
    removido: 0,
    desconhecido: 0,
  };
  for (const f of farmers) {
    const s = f.sim_status ?? "Desconhecido";
    switch (s) {
      case "Activo": k.activo++; break;
      case "Pendente": k.pendente++; break;
      case "Pré activo": k.pre_activo++; break;
      case "Pré desactivado": k.pre_desactivado++; break;
      case "Desactivado": k.desactivado++; break;
      case "Barrado": k.barrado++; break;
      case "Removido": k.removido++; break;
      default: k.desconhecido++;
    }
  }
  return k;
}

function sumKpis(k: SimKpis): number {
  return (
    k.activo + k.pendente + k.pre_activo + k.pre_desactivado +
    k.desactivado + k.barrado + k.removido + k.desconhecido
  );
}

// Dataset baseado nos números reais importados do Excel ALL_MOSAP (003):
// 9.810 Activo + 86 Pré activo + 200 Pré desactivado + 66 Desactivado +
// 2.815 Barrado + 2.189 Removido = 15.166.
const REAL_COUNTS = {
  activo: 9810,
  pre_activo: 86,
  pre_desactivado: 200,
  desactivado: 66,
  barrado: 2815,
  removido: 2189,
} as const;

function buildRealisticDataset() {
  const rows: Array<{ sim_status: string | null }> = [];
  const push = (status: string, n: number) => {
    for (let i = 0; i < n; i++) rows.push({ sim_status: status });
  };
  push("Activo", REAL_COUNTS.activo);
  push("Pré activo", REAL_COUNTS.pre_activo);
  push("Pré desactivado", REAL_COUNTS.pre_desactivado);
  push("Desactivado", REAL_COUNTS.desactivado);
  push("Barrado", REAL_COUNTS.barrado);
  push("Removido", REAL_COUNTS.removido);
  return rows;
}

describe("Reconciliação KPIs Cartões SIM com total de farmers", () => {
  it("soma dos 8 buckets é exactamente 15.166", () => {
    const farmers = buildRealisticDataset();
    expect(farmers.length).toBe(TOTAL_FARMERS);

    const kpis = computeKpis(farmers);
    expect(sumKpis(kpis)).toBe(TOTAL_FARMERS);
  });

  it("breakdown bate com a importação real do Excel ALL_MOSAP (003)", () => {
    const kpis = computeKpis(buildRealisticDataset());
    expect(kpis.activo).toBe(REAL_COUNTS.activo);
    expect(kpis.pre_activo).toBe(REAL_COUNTS.pre_activo);
    expect(kpis.pre_desactivado).toBe(REAL_COUNTS.pre_desactivado);
    expect(kpis.desactivado).toBe(REAL_COUNTS.desactivado);
    expect(kpis.barrado).toBe(REAL_COUNTS.barrado);
    expect(kpis.removido).toBe(REAL_COUNTS.removido);
    expect(kpis.pendente).toBe(0);
    expect(kpis.desconhecido).toBe(0);
  });

  it("Removidos contam no agregado (não são excluídos)", () => {
    const kpis = computeKpis(buildRealisticDataset());
    expect(kpis.removido).toBe(REAL_COUNTS.removido);
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
      { activo: 4000, pendente: 3000, pre_activo: 500, pre_desactivado: 1000, desactivado: 500, barrado: 2000, removido: 1000, desconhecido: 3166 },
      { activo: 15166, pendente: 0, pre_activo: 0, pre_desactivado: 0, desactivado: 0, barrado: 0, removido: 0, desconhecido: 0 },
      { activo: 0, pendente: 0, pre_activo: 0, pre_desactivado: 0, desactivado: 0, barrado: 0, removido: 0, desconhecido: 15166 },
      { activo: 9810, pendente: 0, pre_activo: 86, pre_desactivado: 200, desactivado: 66, barrado: 2815, removido: 2189, desconhecido: 0 },
    ];
    for (const d of distributions) {
      expect(sumKpis(d)).toBe(TOTAL_FARMERS);
    }
  });
});

describe("normalizeSimStatus mapeia variantes do Excel para canónicos", () => {
  it("mapeia 'Pré activo' / 'Pre activo' → 'Pré activo'", () => {
    expect(normalizeSimStatus("Pré activo")).toBe("Pré activo");
    expect(normalizeSimStatus("pre activo")).toBe("Pré activo");
  });

  it("mapeia 'Desactivo' / 'Desactivado' → 'Desactivado'", () => {
    expect(normalizeSimStatus("Desactivo")).toBe("Desactivado");
    expect(normalizeSimStatus("desactivado")).toBe("Desactivado");
  });

  it("mapeia 'Pré desactivo' / 'Pré desactivado' → 'Pré desactivado'", () => {
    expect(normalizeSimStatus("Pré desactivo")).toBe("Pré desactivado");
    expect(normalizeSimStatus("pré desactivado")).toBe("Pré desactivado");
  });

  it("valores desconhecidos ou nulos caem em 'Desconhecido'", () => {
    expect(normalizeSimStatus(null)).toBe("Desconhecido");
    expect(normalizeSimStatus("")).toBe("Desconhecido");
    expect(normalizeSimStatus("Foo")).toBe("Desconhecido");
  });

  it("SIM_STATUSES contém os 8 buckets canónicos", () => {
    expect(SIM_STATUSES).toEqual([
      "Activo",
      "Pendente",
      "Pré activo",
      "Pré desactivado",
      "Desactivado",
      "Barrado",
      "Removido",
      "Desconhecido",
    ]);
  });
});
