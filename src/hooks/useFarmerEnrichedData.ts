import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FarmerParcel {
  id: string;
  parcel_code: string;
  culture: string;
  area: string;
  lat: string | null;
  lon: string | null;
  status: string;
}

export interface FarmerProductionPhase {
  id: string;
  phase: string;
  phase_date: string | null;
  notes: string | null;
  tech_note: string | null;
  photos: string[];
}

export interface FarmerProduction {
  id: string;
  production_code: string;
  culture: string;
  area: string | null;
  planted_date: string | null;
  expected_harvest: string | null;
  estimated_yield: string | null;
  actual_yield: string | null;
  status: string;
  current_phase: string | null;
  technician: string | null;
  escola: string | null;
  phases: FarmerProductionPhase[];
}

export interface FarmerIncentive {
  id: string;
  incentive_code: string;
  type: string;
  amount: string;
  method: string | null;
  status: string;
  incentive_date: string | null;
}

export interface FarmerTransaction {
  id: string;
  product: string;
  empresa: string;
  valor: string;
  transaction_date: string | null;
}

export interface FarmerDependent {
  id: string;
  name: string;
  relationship: string;
  gender: string | null;
  birth_date: string | null;
  age: number | null;
  education: string | null;
  occupation: string | null;
}

export function useFarmerEnrichedData(farmerCode: string | undefined, refreshKey?: number) {
  const [parcels, setParcels] = useState<FarmerParcel[]>([]);
  const [production, setProduction] = useState<FarmerProduction[]>([]);
  const [incentives, setIncentives] = useState<FarmerIncentive[]>([]);
  const [transactions, setTransactions] = useState<FarmerTransaction[]>([]);
  const [dependents, setDependents] = useState<FarmerDependent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmerCode) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);

      const [parcelsRes, prodRes, incRes, txRes, depRes] = await Promise.all([
        supabase.from("farmer_parcels").select("*").eq("farmer_code", farmerCode).order("parcel_code"),
        supabase.from("farmer_production").select("*").eq("farmer_code", farmerCode).order("production_code"),
        supabase.from("farmer_incentives").select("*").eq("farmer_code", farmerCode).order("incentive_date", { ascending: false }),
        supabase.from("farmer_transactions").select("*").eq("farmer_code", farmerCode).order("transaction_date", { ascending: false }),
        supabase.from("farmer_dependents").select("*").eq("farmer_code", farmerCode).order("name"),
      ]);

      if (cancelled) return;

      setParcels((parcelsRes.data as FarmerParcel[]) || []);
      setIncentives((incRes.data as FarmerIncentive[]) || []);
      setTransactions((txRes.data as FarmerTransaction[]) || []);
      setDependents((depRes.data as FarmerDependent[]) || []);

      // Fetch phases for each production
      const prodData = (prodRes.data || []) as any[];
      if (prodData.length > 0) {
        const prodIds = prodData.map((p) => p.id);
        const { data: phasesData } = await supabase
          .from("farmer_production_phases")
          .select("*")
          .in("production_id", prodIds)
          .order("created_at");

        if (!cancelled) {
          const phasesMap = new Map<string, FarmerProductionPhase[]>();
          for (const ph of (phasesData || []) as any[]) {
            const list = phasesMap.get(ph.production_id) || [];
            list.push({
              id: ph.id,
              phase: ph.phase,
              phase_date: ph.phase_date,
              notes: ph.notes,
              tech_note: ph.tech_note,
              photos: ph.photos || [],
            });
            phasesMap.set(ph.production_id, list);
          }

          const enrichedProd: FarmerProduction[] = prodData.map((p) => ({
            id: p.id,
            production_code: p.production_code,
            culture: p.culture,
            area: p.area,
            planted_date: p.planted_date,
            expected_harvest: p.expected_harvest,
            estimated_yield: p.estimated_yield,
            actual_yield: p.actual_yield,
            status: p.status,
            current_phase: p.current_phase,
            technician: p.technician,
            escola: p.escola,
            phases: phasesMap.get(p.id) || [],
          }));
          setProduction(enrichedProd);
        }
      } else {
        setProduction([]);
      }

      if (!cancelled) setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [farmerCode, refreshKey]);

  return { parcels, production, incentives, transactions, dependents, loading };
}
