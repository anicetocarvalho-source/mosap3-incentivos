import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FarmerTracking, SchoolVisit } from "@/data/escolasData";

export interface SchoolDetail {
  id: string;
  name: string;
  province: string;
  provinceSlug: string;
  municipality: string;
  village: string;
  technician: string;
  technicianPhone: string;
  status: string;
  createdAt: string;
  totalFarmers: number;
  totalArea: string;
  activeCycles: number;
  farmers: FarmerTracking[];
  visits: SchoolVisit[];
}

export function useSchoolDetail(id: string | undefined) {
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchSchool = async () => {
      // Try DB first
      const { data: dbSchool } = await supabase
        .from("schools")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (dbSchool) {
        const [provRes, munRes] = await Promise.all([
          supabase.from("provinces").select("name, slug").eq("id", dbSchool.province_id).single(),
          supabase.from("municipalities").select("name").eq("id", dbSchool.municipality_id).single(),
        ]);

        setSchool({
          id: dbSchool.id,
          name: dbSchool.name,
          province: provRes.data?.name || "",
          provinceSlug: provRes.data?.slug || "",
          municipality: munRes.data?.name || "",
          village: dbSchool.village || "",
          technician: dbSchool.technician || "",
          technicianPhone: dbSchool.technician_phone || "",
          status: dbSchool.status,
          createdAt: new Date(dbSchool.created_at).toISOString().split("T")[0],
          totalFarmers: dbSchool.total_farmers,
          totalArea: dbSchool.total_area || "0 ha",
          activeCycles: dbSchool.active_cycles,
          farmers: [],
          visits: [],
        });
      }

      setLoading(false);
    };

    fetchSchool();
  }, [id]);

  return { school, loading };
}
