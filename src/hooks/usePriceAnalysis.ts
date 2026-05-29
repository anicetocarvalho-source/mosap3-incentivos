import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PriceAlertRow {
  product_key: string;
  product_id: string;
  product_name: string;
  category: string;
  unit: string;
  supplier_id: string;
  supplier_name: string;
  current_price: number;
  avg_price: number;
  median_price: number;
  min_price: number;
  max_price: number;
  stddev_price: number;
  suppliers_count: number;
  deviation_pct: number;
  severity: "alta" | "media" | "baixa" | "normal";
  last_changed_at: string | null;
}

export interface AbruptChangeRow {
  id: string;
  product_id: string;
  product_name: string;
  supplier_id: string;
  supplier_name: string;
  previous_price: number;
  new_price: number;
  delta: number;
  change_pct: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export function usePriceAnalysis(params?: {
  minSuppliers?: number;
  highPct?: number;
  mediumPct?: number;
}) {
  const minSuppliers = params?.minSuppliers ?? 3;
  const highPct = params?.highPct ?? 40;
  const mediumPct = params?.mediumPct ?? 25;

  return useQuery({
    queryKey: ["price-analysis", minSuppliers, highPct, mediumPct],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analyze_supplier_prices", {
        p_min_suppliers: minSuppliers,
        p_high_pct: highPct,
        p_medium_pct: mediumPct,
      });
      if (error) throw error;
      return (data ?? []) as PriceAlertRow[];
    },
    staleTime: 60_000,
  });
}

export function useAbruptPriceChanges(params?: { days?: number; thresholdPct?: number }) {
  const days = params?.days ?? 90;
  const thresholdPct = params?.thresholdPct ?? 25;

  return useQuery({
    queryKey: ["abrupt-price-changes", days, thresholdPct],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("detect_abrupt_price_changes", {
        p_days: days,
        p_threshold_pct: thresholdPct,
      });
      if (error) throw error;
      return (data ?? []) as AbruptChangeRow[];
    },
    staleTime: 60_000,
  });
}
