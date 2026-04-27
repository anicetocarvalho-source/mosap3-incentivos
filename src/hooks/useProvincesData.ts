import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { enqueueOperation } from "@/lib/offlineDb";
import { fetchAllPages } from "@/lib/supabaseFetchAll";

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
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prov, mun, sch] = await Promise.all([
        fetchAllPages<DbProvince>(() => supabase.from("provinces").select("*", { count: "exact" }).order("name")),
        fetchAllPages<DbMunicipality>(() => supabase.from("municipalities").select("*", { count: "exact" }).order("name")),
        fetchAllPages<DbSchool>(() => supabase.from("schools").select("*", { count: "exact" }).order("name")),
      ]);
      setProvinces(prov);
      setMunicipalities(mun);
      setSchools(sch);
    } catch (err) {
      console.error("[useProvincesData] Failed to load:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Listen for sync events to refetch
  useEffect(() => {
    const handler = () => {
      fetchAll();
    };
    window.addEventListener("mosap3-sync", handler);
    return () => window.removeEventListener("mosap3-sync", handler);
  }, [fetchAll]);

  const getMunicipalitiesByProvince = useCallback(
    (provinceId: string) => municipalities.filter((m) => m.province_id === provinceId),
    [municipalities]
  );

  const getSchoolsByProvince = useCallback(
    (provinceId: string) => schools.filter((s) => s.province_id === provinceId),
    [schools]
  );

  // ─── Offline-aware mutations ─────────────────────────────────────────────

  const addMunicipality = async (name: string, provinceId: string) => {
    const tempId = crypto.randomUUID();
    const record = { id: tempId, name, province_id: provinceId };

    if (navigator.onLine) {
      const { data, error } = await supabase
        .from("municipalities")
        .insert({ name, province_id: provinceId })
        .select()
        .single();
      if (error) throw error;
      setMunicipalities((prev) => [...prev, data as DbMunicipality]);
      return data as DbMunicipality;
    } else {
      await enqueueOperation("municipalities", "insert", { id: tempId, name, province_id: provinceId });
      const optimistic: DbMunicipality = record;
      setMunicipalities((prev) => [...prev, optimistic]);
      return optimistic;
    }
  };

  const updateMunicipality = async (id: string, name: string) => {
    if (navigator.onLine) {
      const { error } = await supabase.from("municipalities").update({ name }).eq("id", id);
      if (error) throw error;
    } else {
      await enqueueOperation("municipalities", "update", { name }, "id", id);
    }
    setMunicipalities((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
  };

  const deleteMunicipality = async (id: string) => {
    if (navigator.onLine) {
      const { error } = await supabase.from("municipalities").delete().eq("id", id);
      if (error) throw error;
    } else {
      await enqueueOperation("municipalities", "delete", {}, "id", id);
    }
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
    const tempId = crypto.randomUUID();

    if (navigator.onLine) {
      const { data, error } = await supabase
        .from("schools")
        .insert(school)
        .select()
        .single();
      if (error) throw error;
      setSchools((prev) => [...prev, data as DbSchool]);
      return data as DbSchool;
    } else {
      const record = { id: tempId, ...school, status: "Ativa", total_farmers: 0, active_cycles: 0 };
      await enqueueOperation("schools", "insert", record as Record<string, unknown>);
      const optimistic: DbSchool = {
        id: tempId,
        name: school.name,
        province_id: school.province_id,
        municipality_id: school.municipality_id,
        village: school.village || null,
        technician: school.technician || null,
        technician_phone: school.technician_phone || null,
        status: "Ativa",
        total_farmers: 0,
        total_area: null,
        active_cycles: 0,
        created_at: new Date().toISOString(),
      };
      setSchools((prev) => [...prev, optimistic]);
      return optimistic;
    }
  };

  const deleteSchool = async (id: string) => {
    if (navigator.onLine) {
      const { error } = await supabase.from("schools").delete().eq("id", id);
      if (error) throw error;
    } else {
      await enqueueOperation("schools", "delete", {}, "id", id);
    }
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
