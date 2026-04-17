import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
}

export function useFarmersList() {
  const [farmers, setFarmers] = useState<FarmerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFarmers = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("farmers")
      .select("id, code, full_name, bi, phone, province, municipality, school, status, photo_frontal_url, patec, created_at")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err as unknown as Error);
      setFarmers([]);
    } else {
      setFarmers((data as FarmerListItem[]) || []);
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
