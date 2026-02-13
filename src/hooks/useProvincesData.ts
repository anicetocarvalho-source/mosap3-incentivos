import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbProvince {
  id: string;
  name: string;
  slug: string;
  capital: string;
}

export interface DbMunicipality {
  id: string;
  name: string;
  province_id: string;
}

export interface DbSchool {
  id: string;
  name: string;
  province_id: string;
  municipality_id: string;
  village: string | null;
  technician: string | null;
  technician_phone: string | null;
  status: string;
  total_farmers: number;
  total_area: string | null;
  active_cycles: number;
  created_at: string;
  municipality?: DbMunicipality;
}

export function useProvincesData() {
  const [provinces, setProvinces] = useState<DbProvince[]>([]);
  const [municipalities, setMunicipalities] = useState<DbMunicipality[]>([]);
  const [schools, setSchools] = useState<DbSchool[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [provRes, munRes, schRes] = await Promise.all([
      supabase.from("provinces").select("*").order("name"),
      supabase.from("municipalities").select("*").order("name"),
      supabase.from("schools").select("*").order("name"),
    ]);

    if (provRes.data) setProvinces(provRes.data as DbProvince[]);
    if (munRes.data) setMunicipalities(munRes.data as DbMunicipality[]);
    if (schRes.data) setSchools(schRes.data as DbSchool[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getMunicipalitiesByProvince = useCallback(
    (provinceId: string) => municipalities.filter((m) => m.province_id === provinceId),
    [municipalities]
  );

  const getSchoolsByProvince = useCallback(
    (provinceId: string) => schools.filter((s) => s.province_id === provinceId),
    [schools]
  );

  // Mutations
  const addMunicipality = async (name: string, provinceId: string) => {
    const { data, error } = await supabase
      .from("municipalities")
      .insert({ name, province_id: provinceId })
      .select()
      .single();
    if (error) throw error;
    setMunicipalities((prev) => [...prev, data as DbMunicipality]);
    return data as DbMunicipality;
  };

  const updateMunicipality = async (id: string, name: string) => {
    const { error } = await supabase.from("municipalities").update({ name }).eq("id", id);
    if (error) throw error;
    setMunicipalities((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
  };

  const deleteMunicipality = async (id: string) => {
    const { error } = await supabase.from("municipalities").delete().eq("id", id);
    if (error) throw error;
    setMunicipalities((prev) => prev.filter((m) => m.id !== id));
  };

  const addSchool = async (school: {
    name: string;
    province_id: string;
    municipality_id: string;
    village?: string;
    technician?: string;
    technician_phone?: string;
  }) => {
    const { data, error } = await supabase
      .from("schools")
      .insert(school)
      .select()
      .single();
    if (error) throw error;
    setSchools((prev) => [...prev, data as DbSchool]);
    return data as DbSchool;
  };

  const deleteSchool = async (id: string) => {
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) throw error;
    setSchools((prev) => prev.filter((s) => s.id !== id));
  };

  return {
    provinces,
    municipalities,
    schools,
    loading,
    getMunicipalitiesByProvince,
    getSchoolsByProvince,
    addMunicipality,
    updateMunicipality,
    deleteMunicipality,
    addSchool,
    deleteSchool,
    refetch: fetchAll,
  };
}
