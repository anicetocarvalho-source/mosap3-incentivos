import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { parseAmount } from "@/lib/numberFormat";

export interface FinancialSummary {
  recebido: number;
  gasto: number;
  saldo: number;
  beneficiarios: number;
  totalFarmers: number;
  utilizationPct: number;
}

export interface FinancialSummaryFilters {
  province?: string;
  school?: string;
  enabled?: boolean;
}

type FarmerRow = {
  code: string;
  valor_recebido: string | null;
  total_gasto: string | null;
};

const EMPTY: FinancialSummary = {
  recebido: 0,
  gasto: 0,
  saldo: 0,
  beneficiarios: 0,
  totalFarmers: 0,
  utilizationPct: 0,
};

/**
 * Resumo financeiro agregado dos agricultores filtrados por província e/ou ECA.
 * - Soma valor_recebido, total_gasto e saldo_final (formato PT-AO).
 * - Conta beneficiários (valor_recebido > 0) e calcula taxa de utilização.
 * - Exclui produtores com status = 'Removido'.
 */
export function useFinancialSummary(filters: FinancialSummaryFilters) {
  const { province, school, enabled = true } = filters;
  const isEnabled = enabled && !!(province || school);

  return useQuery<FinancialSummary>({
    queryKey: ["financial-summary", { province: province || null, school: school || null }],
    enabled: isEnabled,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const rows = await fetchAllPages<FarmerRow>(() => {
        let q = supabase
          .from("farmers")
          .select("code, valor_recebido, total_gasto", { count: "exact" })
          .neq("status", "Removido");
        if (province) q = q.eq("province", province);
        if (school) q = q.ilike("school", school);
        return q;
      });

      if (rows.length === 0) return EMPTY;

      let recebido = 0;
      let gasto = 0;
      let beneficiarios = 0;
      for (const r of rows) {
        const vr = parseAmount(r.valor_recebido);
        const tg = parseAmount(r.total_gasto);
        recebido += vr;
        gasto += tg;
        if (vr > 0) beneficiarios += 1;
      }

      // Saldo derivado: recebido − gasto, nunca negativo
      const saldo = Math.max(0, recebido - gasto);
      const utilizationPct = recebido > 0 ? (gasto / recebido) * 100 : 0;

      return {
        recebido,
        gasto,
        saldo,
        beneficiarios,
        totalFarmers: rows.length,
        utilizationPct: Math.round(utilizationPct * 10) / 10,
      };
    },
  });
}
