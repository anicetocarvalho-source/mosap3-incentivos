import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProvinceOption {
  id: string;
  name: string;
  slug: string;
}

export interface MunicipalityOption {
  id: string;
  name: string;
  province_id: string;
}

export function useProvinceMunicipalities(selectedProvinceId?: string) {
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("provinces")
        .select("id, name, slug")
        .order("name");
      setProvinces(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  useEffect(() => {
    if (!selectedProvinceId) {
      setMunicipalities([]);
      return;
    }
    const fetch = async () => {
      const { data } = await supabase
        .from("municipalities")
        .select("id, name, province_id")
        .eq("province_id", selectedProvinceId)
        .order("name");
      setMunicipalities(data || []);
    };
    fetch();
  }, [selectedProvinceId]);

  return { provinces, municipalities, loading };
}
