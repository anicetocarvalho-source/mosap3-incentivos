import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Patec {
  id: string;
  code: string;
  name: string;
  description: string | null;
  cultures: string | null;
  icon: string;
  color_token: string;
  is_active: boolean;
  sort_order: number;
  legacy_number: number | null;
  created_at: string;
  updated_at: string;
}

export function usePatecs(opts: { activeOnly?: boolean } = {}) {
  const [patecs, setPatecs] = useState<Patec[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatecs = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("patecs" as any).select("*").order("sort_order").order("code");
    if (opts.activeOnly) q = q.eq("is_active", true);
    const { data } = await q;
    setPatecs((data as unknown as Patec[]) || []);
    setLoading(false);
  }, [opts.activeOnly]);

  useEffect(() => { fetchPatecs(); }, [fetchPatecs]);

  return { patecs, loading, refetch: fetchPatecs };
}
