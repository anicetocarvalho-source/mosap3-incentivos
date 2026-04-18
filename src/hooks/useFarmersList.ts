import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";

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
  created_at: string;
}

export function useFarmersList() {
  const [farmers, setFarmers] = useState<FarmerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFarmers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllPages<FarmerListItem>(() =>
        supabase
          .from("farmers")
          .select(
            "id, code, full_name, bi, phone, province, municipality, school, status, photo_frontal_url, patec, valor_recebido, saldo_final, created_at",
            { count: "exact" }
          )
          .order("created_at", { ascending: false })
      );
      setFarmers(data);
    } catch (err) {
      setError(err as Error);
      setFarmers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFarmers();

    const handler = () => fetchFarmers();
    window.addEventListener("mosap3-saved", handler);
    return () => window.removeEventListener("mosap3-saved", handler);
  }, []);

  return { farmers, loading, error, refetch: fetchFarmers };
}
