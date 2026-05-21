import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { useAuth } from "@/hooks/useAuth";
import { resolveScope, applyFarmerScopeFilter } from "@/lib/farmerScope";

export interface FarmerListItem {
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
  registered_by: string | null;
  created_at: string;
}


export function useFarmersList(opts: { includeRemoved?: boolean } = {}) {
  const { user, roles, authReady } = useAuth();
  const [farmers, setFarmers] = useState<FarmerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFarmers = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const scope = await resolveScope(user.id, roles);
      const data = await fetchAllPages<FarmerListItem>(() =>
        applyFarmerScopeFilter(
          supabase
            .from("farmers")
            .select(
              "id, code, full_name, bi, phone, province, municipality, school, status, photo_frontal_url, patec, valor_recebido, saldo_final, total_gasto, registered_by, created_at",
              { count: "exact" }
            )
            .order("created_at", { ascending: false }),
          scope,
          { includeRemoved: opts.includeRemoved }
        )
      );
      setFarmers(data);
    } catch (err) {
      setError(err as Error);
      setFarmers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authReady || !user) return;
    fetchFarmers();

    const handler = () => fetchFarmers();
    window.addEventListener("mosap3-saved", handler);
    return () => window.removeEventListener("mosap3-saved", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.id, roles.join(","), opts.includeRemoved]);

  return { farmers, loading, error, refetch: fetchFarmers };
}
