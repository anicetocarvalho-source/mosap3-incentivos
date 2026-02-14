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

  // Build photos object from DB data
  const dbPhotos = farmer ? {
    ...(farmer.photo_frontal_url && { frontal: farmer.photo_frontal_url }),
    ...(farmer.photo_profile_left_url && { perfilEsq: farmer.photo_profile_left_url }),
    ...(farmer.photo_profile_right_url && { perfilDir: farmer.photo_profile_right_url }),
  } : null;

  // Build biometrics status object (true/false for each)
  const dbBiometrics = farmer ? {
    polegarDir: !!farmer.biometric_thumb_right_url,
    indicadorDir: !!farmer.biometric_index_right_url,
    polegarEsq: !!farmer.biometric_thumb_left_url,
    indicadorEsq: !!farmer.biometric_index_left_url,
  } : null;

  // Build a normalized farmer info object matching what the UI expects
  const formatDate = (d: string | null) => {
    if (!d) return "";
    try {
      const date = new Date(d);
      return date.toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return d; }
  };

  const farmerInfo = farmer ? {
    id: farmer.code,
    name: farmer.full_name,
    bi: farmer.bi || "",
    phone: farmer.phone || "",
    gender: farmer.gender === "M" ? "Masculino" : farmer.gender === "F" ? "Feminino" : farmer.gender || "",
    birthDate: formatDate(farmer.birth_date),
    province: farmer.province || "",
    municipality: farmer.municipality || "",
    school: farmer.school || "",
    status: farmer.status,
    registeredAt: formatDate(farmer.created_at),
    photos: dbPhotos && Object.keys(dbPhotos).length > 0 ? dbPhotos : undefined,
    biometrics: dbBiometrics,
  } : null;

  return { farmer, loading, dbPhotos, dbBiometrics, farmerInfo };
}
