import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatecSeasonLink {
  patec_id: string;
  season_id: string;
}

export function useSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [links, setLinks] = useState<PatecSeasonLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [sRes, lRes] = await Promise.all([
      supabase.from("agricultural_seasons" as any).select("*").order("start_date", { ascending: false }),
      supabase.from("patec_seasons" as any).select("*"),
    ]);
    setSeasons((sRes.data as unknown as Season[]) || []);
    setLinks((lRes.data as unknown as PatecSeasonLink[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { seasons, links, loading, refetch: fetchAll };
}
