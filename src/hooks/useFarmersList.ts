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

  const fetchFarmers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("farmers")
      .select("id, code, full_name, bi, phone, province, municipality, school, status, photo_frontal_url, patec, created_at")
      .order("created_at", { ascending: false });
    setFarmers((data as FarmerListItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchFarmers();

    const handler = () => fetchFarmers();
    window.addEventListener("mosap3-saved", handler);
    return () => window.removeEventListener("mosap3-saved", handler);
  }, []);

  return { farmers, loading, refetch: fetchFarmers };
}
