import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PriceAlertReview {
  id: string;
  product_id: string;
  supplier_id: string;
  reviewed_price: number;
  reviewed_by: string;
  reviewer_name: string | null;
  notes: string | null;
  reviewed_at: string;
}

export function usePriceAlertReviews() {
  return useQuery({
    queryKey: ["price-alert-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_alert_reviews")
        .select("*")
        .order("reviewed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriceAlertReview[];
    },
    staleTime: 30_000,
  });
}

export function useUpsertPriceAlertReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      product_id: string;
      supplier_id: string;
      reviewed_price: number;
      notes?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Sessão expirada.");
      const reviewerName =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        user.email ||
        null;
      const { data, error } = await supabase
        .from("price_alert_reviews")
        .upsert(
          {
            product_id: payload.product_id,
            supplier_id: payload.supplier_id,
            reviewed_price: payload.reviewed_price,
            reviewed_by: user.id,
            reviewer_name: reviewerName,
            notes: payload.notes ?? null,
            reviewed_at: new Date().toISOString(),
          },
          { onConflict: "product_id,supplier_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as PriceAlertReview;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-alert-reviews"] }),
  });
}

export function useDeletePriceAlertReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_alert_reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["price-alert-reviews"] }),
  });
}

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
