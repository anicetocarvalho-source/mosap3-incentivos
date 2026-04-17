// Tipos partilhados para o módulo de Escolas de Campo.
// Os dados reais são carregados da base de dados (Supabase).

export interface FarmerParcel {
  label: string;
  area: string;
  lat: string;
  lon: string;
  culture: string;
}

export type ProductionPhase =
  | "Preparação"
  | "Sementeira"
  | "Crescimento"
  | "Floração"
  | "Colheita"
  | "Pós-Colheita";

export const phaseOrder: ProductionPhase[] = [
  "Preparação",
  "Sementeira",
  "Crescimento",
  "Floração",
  "Colheita",
  "Pós-Colheita",
];

export interface FarmerTracking {
  id: string;
  name: string;
  culture: string;
  area: string;
  currentPhase: ProductionPhase;
  startDate: string;
  expectedHarvest: string;
  status: "No Prazo" | "Atrasado" | "Concluído";
  visits: number;
  lastVisit: string;
  notes: string;
  parcels: FarmerParcel[];
}

export interface SchoolVisit {
  date: string;
  type: string;
  observations: string;
  farmersPresent: number;
}

export interface School {
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

export interface ProvinceInfo {
  name: string;
  slug: string;
  capital: string;
  schools: number;
  farmers: number;
  municipalities: string[];
}
