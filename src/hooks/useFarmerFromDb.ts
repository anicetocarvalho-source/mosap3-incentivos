import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

async function signUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  // Extract storage path from old full URLs
  const marker = "/object/public/farmer-media/";
  const idx = path.indexOf(marker);
  const cleanPath = idx !== -1 ? path.substring(idx + marker.length) : path;
  const { data, error } = await supabase.storage
    .from("farmer-media")
    .createSignedUrl(cleanPath, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

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
  valor_recebido: string | null;
  total_gasto: string | null;
  saldo_final: string | null;
  patec: number | null;
  registered_by: string | null;
  created_at: string;
  updated_at: string;
}


/**
 * Fetches farmer data from the database by code (e.g. "AGR-001").
 */
export function useFarmerFromDb(code: string | undefined) {
  const [farmer, setFarmer] = useState<FarmerDbRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

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
  }, [code, fetchKey]);

  // Fetch the extensionist (profile) who registered this farmer
  const [registeredBy, setRegisteredBy] = useState<{ name: string | null; phone: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!farmer?.registered_by) { setRegisteredBy(null); return () => { cancelled = true; }; }
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", farmer.registered_by)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRegisteredBy({
          name: (data as any)?.full_name || null,
          phone: (data as any)?.phone || null,
        });
      });
    return () => { cancelled = true; };
  }, [farmer?.registered_by]);


  // Sign photo URLs
  const [signedPhotos, setSignedPhotos] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let photoCancelled = false;

    if (!farmer) {
      setSignedPhotos(null);
      return () => { photoCancelled = true; };
    }

    const photoMap: Record<string, string | null> = {
      frontal: farmer.photo_frontal_url,
      perfilEsq: farmer.photo_profile_left_url,
      perfilDir: farmer.photo_profile_right_url,
    };

    Promise.all(
      Object.entries(photoMap).map(async ([key, path]) => {
        const url = await signUrl(path);
        return [key, url] as const;
      })
    ).then((results) => {
      if (photoCancelled) return;
      const signed: Record<string, string> = {};
      for (const [key, url] of results) {
        if (url) signed[key] = url;
      }
      setSignedPhotos(Object.keys(signed).length > 0 ? signed : null);
    });

    return () => { photoCancelled = true; };
  }, [farmer]);

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
    photos: signedPhotos || undefined,
    biometrics: dbBiometrics,
  } : null;

  // Raw paths for reference
  const dbPhotos = farmer ? {
    ...(farmer.photo_frontal_url && { frontal: farmer.photo_frontal_url }),
    ...(farmer.photo_profile_left_url && { perfilEsq: farmer.photo_profile_left_url }),
    ...(farmer.photo_profile_right_url && { perfilDir: farmer.photo_profile_right_url }),
  } : null;

  return { farmer, loading, dbPhotos, dbBiometrics, farmerInfo, refetch };
}
