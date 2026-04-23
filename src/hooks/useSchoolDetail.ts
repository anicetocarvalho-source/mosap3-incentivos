import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FarmerTracking, SchoolVisit, ProductionPhase } from "@/data/escolasData";

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
      const { data: dbSchool } = await supabase
        .from("schools")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!dbSchool) {
        setLoading(false);
        return;
      }

      const [provRes, munRes] = await Promise.all([
        supabase.from("provinces").select("name, slug").eq("id", dbSchool.province_id).single(),
        supabase.from("municipalities").select("name").eq("id", dbSchool.municipality_id).single(),
      ]);

      const provinceName = provRes.data?.name || "";

      // Carregar agricultores reais que pertencem a esta escola.
      // O campo farmers.school guarda o nome da escola — comparar normalizado.
      const schoolNameNorm = dbSchool.name.trim().toLowerCase();
      const provinceNameNorm = provinceName.trim().toLowerCase();

      let farmers: FarmerTracking[] = [];
      if (schoolNameNorm) {
        // .ilike é case-insensitive; usamos match exato com escape mínimo.
        const { data: farmerRows } = await supabase
          .from("farmers")
          .select("code, full_name, school, province, status")
          .ilike("school", dbSchool.name)
          .neq("status", "Removido")
          .order("full_name", { ascending: true })
          .limit(5000);

        farmers = (farmerRows || [])
          .filter((f) => {
            const fSchool = (f.school || "").trim().toLowerCase();
            const fProv = (f.province || "").trim().toLowerCase();
            return fSchool === schoolNameNorm && (provinceNameNorm === "" || fProv === provinceNameNorm);
          })
          .map((f) => ({
            id: f.code,
            name: f.full_name,
            culture: "—",
            area: "—",
            currentPhase: "Preparação" as ProductionPhase,
            startDate: "—",
            expectedHarvest: "—",
            status: "No Prazo" as const,
            visits: 0,
            lastVisit: "—",
            notes: "",
            parcels: [],
          }));
      }

      setSchool({
        id: dbSchool.id,
        name: dbSchool.name,
        province: provinceName,
        provinceSlug: provRes.data?.slug || "",
        municipality: munRes.data?.name || "",
        village: dbSchool.village || "",
        technician: dbSchool.technician || "",
        technicianPhone: dbSchool.technician_phone || "",
        status: dbSchool.status,
        createdAt: new Date(dbSchool.created_at).toISOString().split("T")[0],
        totalFarmers: farmers.length || dbSchool.total_farmers,
        totalArea: dbSchool.total_area || "0 ha",
        activeCycles: dbSchool.active_cycles,
        farmers,
        visits: [],
      });

      setLoading(false);
    };

    fetchSchool();
  }, [id]);

  return { school, loading };
}
