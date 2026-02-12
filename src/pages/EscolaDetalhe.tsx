import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, User, Users, Sprout, Droplets, Sun, Wheat, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type ProductionPhase = "Preparação" | "Sementeira" | "Crescimento" | "Floração" | "Colheita" | "Pós-Colheita";

const phaseOrder: ProductionPhase[] = ["Preparação", "Sementeira", "Crescimento", "Floração", "Colheita", "Pós-Colheita"];

const phaseIcons: Record<ProductionPhase, any> = {
  "Preparação": Sprout,
  "Sementeira": Sprout,
  "Crescimento": Sun,
  "Floração": Droplets,
  "Colheita": Wheat,
  "Pós-Colheita": CheckCircle2,
};

const phaseColors: Record<ProductionPhase, string> = {
  "Preparação": "bg-muted text-muted-foreground",
  "Sementeira": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Crescimento": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Floração": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Colheita": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Pós-Colheita": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

interface FarmerTracking {
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
}

const schoolsData: Record<string, {
  id: string;
  name: string;
  province: string;
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
  visits: { date: string; type: string; observations: string; farmersPresent: number }[];
}> = {
  "ec-caimbambo": {
    id: "ec-caimbambo",
    name: "EC Caimbambo",
    province: "Benguela",
    municipality: "Caimbambo",
    village: "Aldeia Saca",
    technician: "José Fernandes",
    technicianPhone: "+244 923 456 789",
    status: "Ativa",
    createdAt: "2024-03-15",
    totalFarmers: 45,
    totalArea: "128 ha",
    activeCycles: 12,
    farmers: [
      { id: "AGR-001", name: "João Manuel Silva", culture: "Milho", area: "2.5 ha", currentPhase: "Crescimento", startDate: "2025-01-10", expectedHarvest: "2025-06-15", status: "No Prazo", visits: 4, lastVisit: "2026-02-05", notes: "Bom desenvolvimento vegetativo" },
      { id: "AGR-002", name: "Maria da Conceição", culture: "Feijão", area: "1.8 ha", currentPhase: "Floração", startDate: "2024-12-20", expectedHarvest: "2025-05-01", status: "No Prazo", visits: 5, lastVisit: "2026-02-08", notes: "Floração abundante, sem pragas" },
      { id: "AGR-003", name: "António Domingos", culture: "Mandioca", area: "3.0 ha", currentPhase: "Crescimento", startDate: "2024-11-05", expectedHarvest: "2025-08-20", status: "Atrasado", visits: 3, lastVisit: "2026-01-20", notes: "Necessita adubação adicional" },
      { id: "AGR-004", name: "Teresa Baptista", culture: "Amendoim", area: "1.2 ha", currentPhase: "Sementeira", startDate: "2026-01-28", expectedHarvest: "2026-06-10", status: "No Prazo", visits: 1, lastVisit: "2026-02-01", notes: "Sementeira em curso, sementes de qualidade" },
      { id: "AGR-005", name: "Francisco Lopes", culture: "Milho", area: "2.0 ha", currentPhase: "Colheita", startDate: "2024-09-15", expectedHarvest: "2025-02-10", status: "Concluído", visits: 7, lastVisit: "2026-02-10", notes: "Colheita finalizada, rendimento acima da média" },
      { id: "AGR-006", name: "Ana Cristina Pedro", culture: "Soja", area: "1.5 ha", currentPhase: "Preparação", startDate: "2026-02-01", expectedHarvest: "2026-07-15", status: "No Prazo", visits: 1, lastVisit: "2026-02-03", notes: "Terreno em preparação, lavoura concluída" },
      { id: "AGR-007", name: "Manuel José Vaz", culture: "Feijão", area: "2.2 ha", currentPhase: "Crescimento", startDate: "2025-01-05", expectedHarvest: "2025-05-20", status: "Atrasado", visits: 3, lastVisit: "2026-01-25", notes: "Crescimento lento, falta de chuva" },
      { id: "AGR-008", name: "Isabel Fernandes", culture: "Batata-doce", area: "1.0 ha", currentPhase: "Pós-Colheita", startDate: "2024-08-10", expectedHarvest: "2025-01-15", status: "Concluído", visits: 8, lastVisit: "2026-02-09", notes: "Armazenamento em curso, boa conservação" },
    ],
    visits: [
      { date: "2026-02-10", type: "Acompanhamento", observations: "Visita geral às parcelas do grupo. Milho em bom estado.", farmersPresent: 38 },
      { date: "2026-02-03", type: "Formação", observations: "Capacitação sobre controlo de pragas e uso de pesticidas orgânicos.", farmersPresent: 42 },
      { date: "2026-01-25", type: "Acompanhamento", observations: "Verificação das sementeiras tardias. Necessidade de irrigação.", farmersPresent: 30 },
      { date: "2026-01-15", type: "Distribuição", observations: "Entrega de sementes melhoradas de feijão e milho.", farmersPresent: 45 },
      { date: "2026-01-05", type: "Formação", observations: "Workshop sobre técnicas de conservação do solo.", farmersPresent: 40 },
    ],
  },
  "ec-longonjo": {
    id: "ec-longonjo",
    name: "EC Longonjo",
    province: "Huambo",
    municipality: "Longonjo",
    village: "Aldeia Chiva",
    technician: "Ana Pereira",
    technicianPhone: "+244 912 345 678",
    status: "Ativa",
    createdAt: "2024-04-20",
    totalFarmers: 38,
    totalArea: "95 ha",
    activeCycles: 10,
    farmers: [
      { id: "AGR-010", name: "Pedro Gaspar", culture: "Milho", area: "3.0 ha", currentPhase: "Floração", startDate: "2024-12-01", expectedHarvest: "2025-05-15", status: "No Prazo", visits: 5, lastVisit: "2026-02-07", notes: "Excelente desenvolvimento" },
      { id: "AGR-011", name: "Rosa Mateus", culture: "Feijão", area: "1.5 ha", currentPhase: "Crescimento", startDate: "2025-01-10", expectedHarvest: "2025-06-01", status: "No Prazo", visits: 3, lastVisit: "2026-02-04", notes: "Crescimento normal" },
      { id: "AGR-012", name: "Carlos Henriques", culture: "Mandioca", area: "2.5 ha", currentPhase: "Crescimento", startDate: "2024-10-15", expectedHarvest: "2025-07-30", status: "No Prazo", visits: 4, lastVisit: "2026-02-06", notes: "Sem problemas identificados" },
    ],
    visits: [
      { date: "2026-02-07", type: "Acompanhamento", observations: "Verificação geral das parcelas.", farmersPresent: 32 },
      { date: "2026-01-28", type: "Formação", observations: "Técnicas de irrigação por gotejamento.", farmersPresent: 35 },
    ],
  },
};

// Map school names to IDs
const schoolNameToId: Record<string, string> = {
  "EC Caimbambo": "ec-caimbambo",
  "EC Longonjo": "ec-longonjo",
  "EC Cuemba": "ec-cuemba",
  "EC Lobito": "ec-lobito",
  "EC Bailundo": "ec-bailundo",
  "EC Lubango": "ec-lubango",
  "EC Ganda": "ec-ganda",
  "EC Cacuso": "ec-cacuso",
};

const getPhaseProgress = (phase: ProductionPhase) => {
  const idx = phaseOrder.indexOf(phase);
  return ((idx + 1) / phaseOrder.length) * 100;
};

const statusIcon = (status: string) => {
  if (status === "No Prazo") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "Atrasado") return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  return <CheckCircle2 className="h-4 w-4 text-primary" />;
};

const EscolaDetalhe = () => {
  const { id } = useParams();
  const school = id ? schoolsData[id] : null;

  if (!school) {
    return (
      <div className="space-y-6">
        <Link to="/escolas">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
        <p className="text-muted-foreground">Escola não encontrada.</p>
      </div>
    );
  }

  const phaseStats = phaseOrder.map((phase) => ({
    phase,
    count: school.farmers.filter((f) => f.currentPhase === phase).length,
  }));

  const atrasados = school.farmers.filter((f) => f.status === "Atrasado").length;
  const concluidos = school.farmers.filter((f) => f.status === "Concluído").length;
  const noPrazo = school.farmers.filter((f) => f.status === "No Prazo").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/escolas">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{school.name}</h1>
            <Badge variant={school.status === "Ativa" ? "default" : "secondary"}>{school.status}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{school.village}, {school.municipality}, {school.province}</span>
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Técnico: {school.technician}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Agricultores</p>
            <p className="text-2xl font-bold">{school.totalFarmers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Área Total</p>
            <p className="text-2xl font-bold">{school.totalArea}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ciclos Activos</p>
            <p className="text-2xl font-bold">{school.activeCycles}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Visitas do Mês</p>
            <p className="text-2xl font-bold">{school.visits.filter((v) => v.date.startsWith("2026-02")).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Phase Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Distribuição por Fase de Produção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {phaseStats.map(({ phase, count }) => {
              const Icon = phaseIcons[phase];
              return (
                <div key={phase} className={`rounded-lg p-3 text-center ${phaseColors[phase]}`}>
                  <Icon className="h-5 w-5 mx-auto mb-1" />
                  <p className="text-xs font-medium">{phase}</p>
                  <p className="text-xl font-bold">{count}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="acompanhamento">
        <TabsList>
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          <TabsTrigger value="visitas">Visitas</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        {/* Tab: Acompanhamento dos Agricultores */}
        <TabsContent value="acompanhamento" className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />{noPrazo} No Prazo</Badge>
            <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3 text-yellow-600" />{atrasados} Atrasados</Badge>
            <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-primary" />{concluidos} Concluídos</Badge>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produtor</TableHead>
                  <TableHead>Cultura</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Fase Actual</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Visitas</TableHead>
                  <TableHead>Última Visita</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {school.farmers.map((farmer, i) => (
                  <motion.tr
                    key={farmer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link to={`/agricultores/${farmer.id}`} className="font-medium text-primary hover:underline">
                        {farmer.name}
                      </Link>
                    </TableCell>
                    <TableCell>{farmer.culture}</TableCell>
                    <TableCell>{farmer.area}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${phaseColors[farmer.currentPhase]}`}>
                        {farmer.currentPhase}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={getPhaseProgress(farmer.currentPhase)} className="h-2" />
                        <span className="text-xs text-muted-foreground">{Math.round(getPhaseProgress(farmer.currentPhase))}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {statusIcon(farmer.status)}
                        <span className="text-xs">{farmer.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{farmer.visits}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{farmer.lastVisit}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{farmer.notes}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab: Visitas */}
        <TabsContent value="visitas" className="space-y-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Agricultores Presentes</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {school.visits.map((visit, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">{visit.date}</TableCell>
                    <TableCell>
                      <Badge variant={visit.type === "Formação" ? "default" : visit.type === "Distribuição" ? "secondary" : "outline"}>
                        {visit.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{visit.farmersPresent}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{visit.observations}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab: Resumo */}
        <TabsContent value="resumo" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Informações da Escola</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Província:</span><span className="font-medium">{school.province}</span>
                  <span className="text-muted-foreground">Município:</span><span className="font-medium">{school.municipality}</span>
                  <span className="text-muted-foreground">Aldeia:</span><span className="font-medium">{school.village}</span>
                  <span className="text-muted-foreground">Data Criação:</span><span className="font-medium">{school.createdAt}</span>
                  <span className="text-muted-foreground">Estado:</span><span className="font-medium">{school.status}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Técnico Responsável</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Nome:</span><span className="font-medium">{school.technician}</span>
                  <span className="text-muted-foreground">Telefone:</span><span className="font-medium">{school.technicianPhone}</span>
                  <span className="text-muted-foreground">Total Visitas:</span><span className="font-medium">{school.visits.length}</span>
                  <span className="text-muted-foreground">Agricultores:</span><span className="font-medium">{school.totalFarmers}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Culturas Acompanhadas</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(school.farmers.map((f) => f.culture))].map((culture) => {
                    const count = school.farmers.filter((f) => f.culture === culture).length;
                    return (
                      <Badge key={culture} variant="outline" className="gap-1 px-3 py-1">
                        <Wheat className="h-3 w-3" />
                        {culture} ({count})
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export { schoolNameToId };
export default EscolaDetalhe;
