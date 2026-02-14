import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FarmerDbRecord {
  id: string;
  code: string;
  full_name: string;
  bi: string | null;
  birth_date: string | null;
  gender: string | null;
  phone: string | null;
  province: string | null;
  municipality: string | null;
  school: string | null;
  status: string;
  photo_frontal_url: string | null;
  photo_profile_left_url: string | null;
  photo_profile_right_url: string | null;
  biometric_thumb_right_url: string | null;
  biometric_index_right_url: string | null;
  biometric_thumb_left_url: string | null;
  biometric_index_left_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches farmer data from the database by code (e.g. "AGR-001").
 * Returns null if not found or not yet loaded.
 */
export function useFarmerFromDb(code: string | undefined) {
  const [farmer, setFarmer] = useState<FarmerDbRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from("farmers")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (!cancelled) {
        setFarmer(data as FarmerDbRecord | null);
        setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [code]);

  // Build photos/biometrics objects from DB data
  const dbPhotos = farmer ? {
    ...(farmer.photo_frontal_url && { frontal: farmer.photo_frontal_url }),
    ...(farmer.photo_profile_left_url && { perfilEsq: farmer.photo_profile_left_url }),
    ...(farmer.photo_profile_right_url && { perfilDir: farmer.photo_profile_right_url }),
  } : null;

  const dbBiometrics = farmer ? {
    ...(farmer.biometric_thumb_right_url && { polegarDir: farmer.biometric_thumb_right_url }),
    ...(farmer.biometric_index_right_url && { indicadorDir: farmer.biometric_index_right_url }),
    ...(farmer.biometric_thumb_left_url && { polegarEsq: farmer.biometric_thumb_left_url }),
    ...(farmer.biometric_index_left_url && { indicadorEsq: farmer.biometric_index_left_url }),
  } : null;

  return { farmer, loading, dbPhotos, dbBiometrics };
}
