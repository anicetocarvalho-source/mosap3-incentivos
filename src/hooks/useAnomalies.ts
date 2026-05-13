import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveScope, type ResolvedScope } from "@/lib/farmerScope";

export type AnomalyType = "duplicado" | "saldo_negativo" | "valor_fora_escalao" | "telefone_partilhado" | "bi_partilhado";

export interface Anomaly {
  anomaly_type: AnomalyType;
  severity: "alta" | "media" | "baixa";
  anomaly_key: string;
  farmer_code: string;
  farmer_name: string;
  province: string | null;
  municipality: string | null;
  school: string | null;
  details: Record<string, any>;
  related_codes: string[];
  resolved: boolean;
  resolved_notes: string | null;
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  duplicado: "Produtor duplicado",
  saldo_negativo: "Saldo negativo",
  valor_fora_escalao: "Valor fora do escalão",
  telefone_partilhado: "Telefone partilhado",
  bi_partilhado: "BI partilhado",
};

export function useAnomalies(includeResolved: boolean) {
  const { user, roles } = useAuth();
  const [data, setData] = useState<Anomaly[]>([]);
  const [scope, setScope] = useState<ResolvedScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refresh = useCallback(() => setRefreshIndex((i) => i + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const sc = await resolveScope(user.id, roles);
        if (cancelled) return;
        setScope(sc);
        const { data, error } = await supabase.rpc("detect_farmer_anomalies", {
          p_scope: sc.scope,
          p_provinces: sc.provinces,
          p_ecas: sc.ecas,
          p_include_resolved: includeResolved,
        });
        if (cancelled) return;
        if (error) throw error;
        const mapped: Anomaly[] = (data ?? []).map((r: any) => ({
          anomaly_type: r.out_anomaly_type,
          severity: r.out_severity,
          anomaly_key: r.out_anomaly_key,
          farmer_code: r.out_farmer_code,
          farmer_name: r.out_farmer_name,
          province: r.out_province,
          municipality: r.out_municipality,
          school: r.out_school,
          details: r.out_details ?? {},
          related_codes: r.out_related_codes ?? [],
          resolved: r.out_resolved,
          resolved_notes: r.out_resolved_notes,
        }));
        setData(mapped);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erro ao carregar anomalias");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user, roles, includeResolved, refreshIndex]);

  return { data, scope, loading, error, refresh };
}
