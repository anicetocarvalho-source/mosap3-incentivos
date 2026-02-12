export interface FarmerParcel {
  label: string; // P1, P2, ...
  area: string;
  lat: string;
  lon: string;
  culture: string;
}

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

export type ProductionPhase = "Preparação" | "Sementeira" | "Crescimento" | "Floração" | "Colheita" | "Pós-Colheita";

export const phaseOrder: ProductionPhase[] = ["Preparação", "Sementeira", "Crescimento", "Floração", "Colheita", "Pós-Colheita"];

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

export const provinces: ProvinceInfo[] = [
  { name: "Bengo", slug: "bengo", capital: "Caxito", schools: 3, farmers: 85, municipalities: ["Caxito", "Dande", "Ambriz", "Nambuangongo", "Bula Atumba"] },
  { name: "Benguela", slug: "benguela", capital: "Benguela", schools: 5, farmers: 152, municipalities: ["Benguela", "Lobito", "Caimbambo", "Ganda", "Cubal", "Baía Farta", "Balombo", "Chongoroi", "Bocoio", "Catumbela"] },
  { name: "Bié", slug: "bie", capital: "Cuíto", schools: 4, farmers: 120, municipalities: ["Cuíto", "Cuemba", "Andulo", "Camacupa", "Catabola", "Chinguar", "Chitembo", "Cunhinga", "Nharea"] },
  { name: "Cabinda", slug: "cabinda", capital: "Cabinda", schools: 2, farmers: 48, municipalities: ["Cabinda", "Cacongo", "Buco-Zau", "Belize"] },
  { name: "Cuando Cubango", slug: "cuando-cubango", capital: "Menongue", schools: 3, farmers: 72, municipalities: ["Menongue", "Cuangar", "Cuchi", "Cuito Cuanavale", "Dirico", "Mavinga", "Nancova", "Rivungo", "Calai"] },
  { name: "Cuanza Norte", slug: "cuanza-norte", capital: "N'dalatando", schools: 4, farmers: 95, municipalities: ["N'dalatando", "Cazengo", "Golungo Alto", "Cambambe", "Ambaca", "Banga", "Bolongongo", "Lucala", "Quiculungo", "Samba Caju"] },
  { name: "Cuanza Sul", slug: "cuanza-sul", capital: "Sumbe", schools: 5, farmers: 135, municipalities: ["Sumbe", "Porto Amboim", "Amboim", "Conda", "Cela", "Ebo", "Libolo", "Mussende", "Quibala", "Quilenda", "Seles", "Cassongue"] },
  { name: "Cunene", slug: "cunene", capital: "Ondjiva", schools: 3, farmers: 68, municipalities: ["Ondjiva", "Cuanhama", "Cahama", "Curoca", "Namacunde", "Ombadja"] },
  { name: "Huambo", slug: "huambo", capital: "Huambo", schools: 6, farmers: 180, municipalities: ["Huambo", "Bailundo", "Caála", "Catchiungo", "Ecunha", "Longonjo", "Londuimbali", "Mungo", "Tchicala-Tcholoanga", "Ucuma", "Chinjenje"] },
  { name: "Huíla", slug: "huila", capital: "Lubango", schools: 5, farmers: 145, municipalities: ["Lubango", "Cacula", "Caluquembe", "Chibia", "Chipindo", "Cuvango", "Gambos", "Humpata", "Jamba", "Matala", "Quilengues", "Quipungo", "Caconda"] },
  { name: "Icolo e Bengo", slug: "icolo-e-bengo", capital: "Catete", schools: 2, farmers: 42, municipalities: ["Catete", "Icolo e Bengo"] },
  { name: "Lunda Norte", slug: "lunda-norte", capital: "Dundo", schools: 3, farmers: 65, municipalities: ["Dundo", "Cambulo", "Capenda-Camulemba", "Caungula", "Chitato", "Cuango", "Cuílo", "Lóvua", "Lubalo", "Xá-Muteba"] },
  { name: "Lunda Sul", slug: "lunda-sul", capital: "Saurimo", schools: 2, farmers: 50, municipalities: ["Saurimo", "Cacolo", "Dala", "Muconda"] },
  { name: "Luanda", slug: "luanda", capital: "Luanda", schools: 2, farmers: 35, municipalities: ["Luanda", "Belas", "Cacuaco", "Cazenga", "Ícolo e Bengo", "Quiçama", "Talatona", "Viana"] },
  { name: "Malanje", slug: "malanje", capital: "Malanje", schools: 4, farmers: 98, municipalities: ["Malanje", "Cacuso", "Calandula", "Cambundi-Catembo", "Cangandala", "Cuaba Nzoji", "Cunda-Dia-Baze", "Luquembo", "Massango", "Marimba", "Mucari", "Quela", "Quirima", "Kiwaba Nzoji"] },
  { name: "Moxico", slug: "moxico", capital: "Luena", schools: 3, farmers: 75, municipalities: ["Luena", "Alto Zambeze", "Bundas", "Camanongue", "Léua", "Luacano", "Luchazes", "Lumeje", "Moxico"] },
  { name: "Namibe", slug: "namibe", capital: "Moçâmedes", schools: 2, farmers: 38, municipalities: ["Moçâmedes", "Bibala", "Camucuio", "Tômbwa", "Virei"] },
  { name: "Uíge", slug: "uige", capital: "Uíge", schools: 4, farmers: 110, municipalities: ["Uíge", "Ambuila", "Bembe", "Buengas", "Bungo", "Damba", "Macocola", "Mucaba", "Negage", "Puri", "Quimbele", "Quitexe", "Sanza Pombo", "Songo", "Zombo"] },
  { name: "Zaire", slug: "zaire", capital: "M'banza Kongo", schools: 3, farmers: 58, municipalities: ["M'banza Kongo", "Cuimba", "Nóqui", "N'zeto", "Soyo", "Tomboco"] },
];

export const allSchools: School[] = [
  {
    id: "ec-caimbambo", name: "EC Caimbambo", province: "Benguela", provinceSlug: "benguela", municipality: "Caimbambo", village: "Aldeia Saca",
    technician: "José Fernandes", technicianPhone: "+244 923 456 789", status: "Ativa", createdAt: "2024-03-15",
    totalFarmers: 45, totalArea: "128 ha", activeCycles: 12,
    farmers: [
      { id: "AGR-001", name: "João Manuel Silva", culture: "Milho", area: "2.5 ha", currentPhase: "Crescimento", startDate: "2025-01-10", expectedHarvest: "2025-06-15", status: "No Prazo", visits: 4, lastVisit: "2026-02-05", notes: "Bom desenvolvimento vegetativo", parcels: [{ label: "P1", area: "1.5 ha", lat: "-12.5678", lon: "14.2345", culture: "Milho" }, { label: "P2", area: "1.0 ha", lat: "-12.5690", lon: "14.2360", culture: "Milho" }] },
      { id: "AGR-002", name: "Maria da Conceição", culture: "Feijão", area: "1.8 ha", currentPhase: "Floração", startDate: "2024-12-20", expectedHarvest: "2025-05-01", status: "No Prazo", visits: 5, lastVisit: "2026-02-08", notes: "Floração abundante, sem pragas", parcels: [{ label: "P1", area: "1.8 ha", lat: "-12.5700", lon: "14.2370", culture: "Feijão" }] },
      { id: "AGR-003", name: "António Domingos", culture: "Mandioca", area: "3.0 ha", currentPhase: "Crescimento", startDate: "2024-11-05", expectedHarvest: "2025-08-20", status: "Atrasado", visits: 3, lastVisit: "2026-01-20", notes: "Necessita adubação adicional", parcels: [{ label: "P1", area: "2.0 ha", lat: "-12.5710", lon: "14.2380", culture: "Mandioca" }, { label: "P2", area: "1.0 ha", lat: "-12.5720", lon: "14.2390", culture: "Mandioca" }] },
      { id: "AGR-004", name: "Teresa Baptista", culture: "Amendoim", area: "1.2 ha", currentPhase: "Sementeira", startDate: "2026-01-28", expectedHarvest: "2026-06-10", status: "No Prazo", visits: 1, lastVisit: "2026-02-01", notes: "Sementeira em curso", parcels: [{ label: "P1", area: "1.2 ha", lat: "-12.5730", lon: "14.2400", culture: "Amendoim" }] },
      { id: "AGR-005", name: "Francisco Lopes", culture: "Milho", area: "2.0 ha", currentPhase: "Colheita", startDate: "2024-09-15", expectedHarvest: "2025-02-10", status: "Concluído", visits: 7, lastVisit: "2026-02-10", notes: "Colheita finalizada", parcels: [{ label: "P1", area: "2.0 ha", lat: "-12.5740", lon: "14.2410", culture: "Milho" }] },
      { id: "AGR-006", name: "Ana Cristina Pedro", culture: "Soja", area: "1.5 ha", currentPhase: "Preparação", startDate: "2026-02-01", expectedHarvest: "2026-07-15", status: "No Prazo", visits: 1, lastVisit: "2026-02-03", notes: "Terreno em preparação", parcels: [{ label: "P1", area: "0.8 ha", lat: "-12.5750", lon: "14.2420", culture: "Soja" }, { label: "P2", area: "0.7 ha", lat: "-12.5760", lon: "14.2430", culture: "Soja" }] },
      { id: "AGR-007", name: "Manuel José Vaz", culture: "Feijão", area: "2.2 ha", currentPhase: "Crescimento", startDate: "2025-01-05", expectedHarvest: "2025-05-20", status: "Atrasado", visits: 3, lastVisit: "2026-01-25", notes: "Crescimento lento, falta de chuva", parcels: [{ label: "P1", area: "1.2 ha", lat: "-12.5770", lon: "14.2440", culture: "Feijão" }, { label: "P2", area: "1.0 ha", lat: "-12.5780", lon: "14.2450", culture: "Feijão" }] },
      { id: "AGR-008", name: "Isabel Fernandes", culture: "Batata-doce", area: "1.0 ha", currentPhase: "Pós-Colheita", startDate: "2024-08-10", expectedHarvest: "2025-01-15", status: "Concluído", visits: 8, lastVisit: "2026-02-09", notes: "Armazenamento em curso", parcels: [{ label: "P1", area: "1.0 ha", lat: "-12.5790", lon: "14.2460", culture: "Batata-doce" }] },
    ],
    visits: [
      { date: "2026-02-10", type: "Acompanhamento", observations: "Visita geral às parcelas do grupo.", farmersPresent: 38 },
      { date: "2026-02-03", type: "Formação", observations: "Capacitação sobre controlo de pragas.", farmersPresent: 42 },
      { date: "2026-01-25", type: "Acompanhamento", observations: "Verificação das sementeiras tardias.", farmersPresent: 30 },
      { date: "2026-01-15", type: "Distribuição", observations: "Entrega de sementes melhoradas.", farmersPresent: 45 },
      { date: "2026-01-05", type: "Formação", observations: "Workshop sobre conservação do solo.", farmersPresent: 40 },
    ],
  },
  {
    id: "ec-lobito", name: "EC Lobito", province: "Benguela", provinceSlug: "benguela", municipality: "Lobito", village: "Aldeia Hanha",
    technician: "Teresa Luís", technicianPhone: "+244 924 111 222", status: "Ativa", createdAt: "2024-05-10",
    totalFarmers: 31, totalArea: "78 ha", activeCycles: 8,
    farmers: [
      { id: "AGR-020", name: "Carlos Mendes", culture: "Milho", area: "2.0 ha", currentPhase: "Floração", startDate: "2024-12-10", expectedHarvest: "2025-05-20", status: "No Prazo", visits: 4, lastVisit: "2026-02-06", notes: "Desenvolvimento normal", parcels: [{ label: "P1", area: "1.2 ha", lat: "-12.3600", lon: "13.5400", culture: "Milho" }, { label: "P2", area: "0.8 ha", lat: "-12.3610", lon: "13.5410", culture: "Milho" }] },
      { id: "AGR-021", name: "Luísa Bernardo", culture: "Feijão", area: "1.5 ha", currentPhase: "Crescimento", startDate: "2025-01-15", expectedHarvest: "2025-06-10", status: "No Prazo", visits: 3, lastVisit: "2026-02-04", notes: "Boa germinação", parcels: [{ label: "P1", area: "1.5 ha", lat: "-12.3620", lon: "13.5420", culture: "Feijão" }] },
    ],
    visits: [
      { date: "2026-02-06", type: "Acompanhamento", observations: "Verificação das parcelas.", farmersPresent: 25 },
      { date: "2026-01-20", type: "Formação", observations: "Técnicas de adubação orgânica.", farmersPresent: 28 },
    ],
  },
  {
    id: "ec-ganda", name: "EC Ganda", province: "Benguela", provinceSlug: "benguela", municipality: "Ganda", village: "Aldeia Ebanga",
    technician: "Francisco Miguel", technicianPhone: "+244 925 333 444", status: "Ativa", createdAt: "2024-06-01",
    totalFarmers: 36, totalArea: "92 ha", activeCycles: 9,
    farmers: [
      { id: "AGR-030", name: "Pedro Alves", culture: "Mandioca", area: "3.0 ha", currentPhase: "Crescimento", startDate: "2024-11-01", expectedHarvest: "2025-08-15", status: "No Prazo", visits: 4, lastVisit: "2026-02-05", notes: "Bom desenvolvimento", parcels: [{ label: "P1", area: "1.5 ha", lat: "-12.9800", lon: "14.6500", culture: "Mandioca" }, { label: "P2", area: "1.5 ha", lat: "-12.9810", lon: "14.6510", culture: "Mandioca" }] },
    ],
    visits: [
      { date: "2026-02-05", type: "Acompanhamento", observations: "Parcelas em bom estado.", farmersPresent: 30 },
    ],
  },
  {
    id: "ec-longonjo", name: "EC Longonjo", province: "Huambo", provinceSlug: "huambo", municipality: "Longonjo", village: "Aldeia Chiva",
    technician: "Ana Pereira", technicianPhone: "+244 912 345 678", status: "Ativa", createdAt: "2024-04-20",
    totalFarmers: 38, totalArea: "95 ha", activeCycles: 10,
    farmers: [
      { id: "AGR-010", name: "Pedro Gaspar", culture: "Milho", area: "3.0 ha", currentPhase: "Floração", startDate: "2024-12-01", expectedHarvest: "2025-05-15", status: "No Prazo", visits: 5, lastVisit: "2026-02-07", notes: "Excelente desenvolvimento", parcels: [{ label: "P1", area: "1.5 ha", lat: "-12.8500", lon: "15.7800", culture: "Milho" }, { label: "P2", area: "1.5 ha", lat: "-12.8510", lon: "15.7810", culture: "Milho" }] },
      { id: "AGR-011", name: "Rosa Mateus", culture: "Feijão", area: "1.5 ha", currentPhase: "Crescimento", startDate: "2025-01-10", expectedHarvest: "2025-06-01", status: "No Prazo", visits: 3, lastVisit: "2026-02-04", notes: "Crescimento normal", parcels: [{ label: "P1", area: "1.5 ha", lat: "-12.8520", lon: "15.7820", culture: "Feijão" }] },
      { id: "AGR-012", name: "Carlos Henriques", culture: "Mandioca", area: "2.5 ha", currentPhase: "Crescimento", startDate: "2024-10-15", expectedHarvest: "2025-07-30", status: "No Prazo", visits: 4, lastVisit: "2026-02-06", notes: "Sem problemas", parcels: [{ label: "P1", area: "1.5 ha", lat: "-12.8530", lon: "15.7830", culture: "Mandioca" }, { label: "P2", area: "1.0 ha", lat: "-12.8540", lon: "15.7840", culture: "Mandioca" }] },
    ],
    visits: [
      { date: "2026-02-07", type: "Acompanhamento", observations: "Verificação geral.", farmersPresent: 32 },
      { date: "2026-01-28", type: "Formação", observations: "Irrigação por gotejamento.", farmersPresent: 35 },
    ],
  },
  {
    id: "ec-bailundo", name: "EC Bailundo", province: "Huambo", provinceSlug: "huambo", municipality: "Bailundo", village: "Aldeia Bimbe",
    technician: "Carlos Dias", technicianPhone: "+244 913 555 666", status: "Inativa", createdAt: "2024-02-10",
    totalFarmers: 27, totalArea: "65 ha", activeCycles: 0,
    farmers: [],
    visits: [],
  },
  {
    id: "ec-cuemba", name: "EC Cuemba", province: "Bié", provinceSlug: "bie", municipality: "Cuemba", village: "Aldeia Soqui",
    technician: "Manuel Costa", technicianPhone: "+244 914 777 888", status: "Ativa", createdAt: "2024-04-01",
    totalFarmers: 52, totalArea: "140 ha", activeCycles: 14,
    farmers: [
      { id: "AGR-040", name: "Domingos Campos", culture: "Milho", area: "2.8 ha", currentPhase: "Sementeira", startDate: "2026-01-20", expectedHarvest: "2026-06-30", status: "No Prazo", visits: 2, lastVisit: "2026-02-08", notes: "Sementeira em curso", parcels: [{ label: "P1", area: "1.4 ha", lat: "-12.3456", lon: "17.0500", culture: "Milho" }, { label: "P2", area: "1.4 ha", lat: "-12.3466", lon: "17.0510", culture: "Milho" }] },
      { id: "AGR-041", name: "Esperança Matos", culture: "Feijão", area: "1.6 ha", currentPhase: "Crescimento", startDate: "2025-01-05", expectedHarvest: "2025-05-25", status: "No Prazo", visits: 4, lastVisit: "2026-02-06", notes: "Crescimento satisfatório", parcels: [{ label: "P1", area: "1.6 ha", lat: "-12.3476", lon: "17.0520", culture: "Feijão" }] },
    ],
    visits: [
      { date: "2026-02-08", type: "Acompanhamento", observations: "Acompanhamento das sementeiras.", farmersPresent: 45 },
    ],
  },
  {
    id: "ec-lubango", name: "EC Lubango", province: "Huíla", provinceSlug: "huila", municipality: "Lubango", village: "Aldeia Chibia",
    technician: "Isabel Santos", technicianPhone: "+244 916 999 000", status: "Ativa", createdAt: "2024-03-25",
    totalFarmers: 41, totalArea: "105 ha", activeCycles: 11,
    farmers: [
      { id: "AGR-050", name: "Jorge Caetano", culture: "Batata", area: "2.0 ha", currentPhase: "Crescimento", startDate: "2025-01-08", expectedHarvest: "2025-05-10", status: "No Prazo", visits: 4, lastVisit: "2026-02-07", notes: "Bom desenvolvimento", parcels: [{ label: "P1", area: "1.2 ha", lat: "-14.9200", lon: "13.5000", culture: "Batata" }, { label: "P2", area: "0.8 ha", lat: "-14.9210", lon: "13.5010", culture: "Batata" }] },
    ],
    visits: [
      { date: "2026-02-07", type: "Acompanhamento", observations: "Parcelas em bom estado.", farmersPresent: 35 },
    ],
  },
  {
    id: "ec-cacuso", name: "EC Cacuso", province: "Malanje", provinceSlug: "malanje", municipality: "Cacuso", village: "Aldeia Pungo",
    technician: "Rita Domingos", technicianPhone: "+244 917 111 222", status: "Ativa", createdAt: "2024-05-15",
    totalFarmers: 29, totalArea: "72 ha", activeCycles: 7,
    farmers: [
      { id: "AGR-060", name: "Alberto Nascimento", culture: "Amendoim", area: "1.8 ha", currentPhase: "Floração", startDate: "2024-12-15", expectedHarvest: "2025-05-05", status: "No Prazo", visits: 5, lastVisit: "2026-02-09", notes: "Floração abundante", parcels: [{ label: "P1", area: "1.0 ha", lat: "-9.2000", lon: "16.0000", culture: "Amendoim" }, { label: "P2", area: "0.8 ha", lat: "-9.2010", lon: "16.0010", culture: "Amendoim" }] },
    ],
    visits: [
      { date: "2026-02-09", type: "Acompanhamento", observations: "Acompanhamento da floração.", farmersPresent: 24 },
    ],
  },
];

export const getSchoolsByProvince = (provinceSlug: string) =>
  allSchools.filter((s) => s.provinceSlug === provinceSlug);

export const getSchoolById = (id: string) =>
  allSchools.find((s) => s.id === id);

export const getProvinceBySlug = (slug: string) =>
  provinces.find((p) => p.slug === slug);
