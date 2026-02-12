import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, MapPin, User, Users, School, Wheat, Phone, Calendar, AlertTriangle, CheckCircle2, XCircle, UserMinus, UserPlus, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSchoolById, phaseOrder, type ProductionPhase } from "@/data/escolasData";

type FarmerStatus = "Em produção" | "Abandono" | "Doente" | "Falecido" | "Substituído";

interface FarmerWithStatus {
  id: string;
  name: string;
  culture: string;
  area: string;
  currentPhase: ProductionPhase;
  status: string;
  estadoProdutor: FarmerStatus;
  substituto?: string;
  observacoes?: string;
  visits: number;
  lastVisit: string;
}

const estadoColors: Record<FarmerStatus, string> = {
  "Em produção": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Abandono": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Doente": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Falecido": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Substituído": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const estadoIcons: Record<FarmerStatus, any> = {
  "Em produção": CheckCircle2,
  "Abandono": UserMinus,
  "Doente": HeartPulse,
  "Falecido": XCircle,
  "Substituído": UserPlus,
};

// Simulated extended farmer data with statuses for each school
const schoolFarmerStatuses: Record<string, FarmerWithStatus[]> = {
  "ec-caimbambo": [
    { id: "AGR-001", name: "João Manuel Silva", culture: "Milho", area: "2.5 ha", currentPhase: "Crescimento", status: "No Prazo", estadoProdutor: "Em produção", visits: 4, lastVisit: "2026-02-05" },
    { id: "AGR-002", name: "Maria da Conceição", culture: "Feijão", area: "1.8 ha", currentPhase: "Floração", status: "No Prazo", estadoProdutor: "Em produção", visits: 5, lastVisit: "2026-02-08" },
    { id: "AGR-003", name: "António Domingos", culture: "Mandioca", area: "3.0 ha", currentPhase: "Crescimento", status: "Atrasado", estadoProdutor: "Doente", observacoes: "Produtor com problemas de saúde, parcela parcialmente acompanhada pelo filho", visits: 3, lastVisit: "2026-01-20" },
    { id: "AGR-004", name: "Teresa Baptista", culture: "Amendoim", area: "1.2 ha", currentPhase: "Sementeira", status: "No Prazo", estadoProdutor: "Em produção", visits: 1, lastVisit: "2026-02-01" },
    { id: "AGR-005", name: "Francisco Lopes", culture: "Milho", area: "2.0 ha", currentPhase: "Colheita", status: "Concluído", estadoProdutor: "Em produção", visits: 7, lastVisit: "2026-02-10" },
    { id: "AGR-006", name: "Ana Cristina Pedro", culture: "Soja", area: "1.5 ha", currentPhase: "Preparação", status: "No Prazo", estadoProdutor: "Em produção", visits: 1, lastVisit: "2026-02-03" },
    { id: "AGR-007", name: "Manuel José Vaz", culture: "Feijão", area: "2.2 ha", currentPhase: "Crescimento", status: "Atrasado", estadoProdutor: "Abandono", observacoes: "Produtor abandonou a parcela por motivos pessoais", visits: 3, lastVisit: "2026-01-25" },
    { id: "AGR-008", name: "Isabel Fernandes", culture: "Batata-doce", area: "1.0 ha", currentPhase: "Pós-Colheita", status: "Concluído", estadoProdutor: "Falecido", observacoes: "Faleceu a 01/02/2026. Parcela assumida pelo cônjuge Jorge Fernandes.", substituto: "Jorge Fernandes (Cônjuge)", visits: 8, lastVisit: "2026-02-09" },
  ],
  "ec-longonjo": [
    { id: "AGR-010", name: "Pedro Gaspar", culture: "Milho", area: "3.0 ha", currentPhase: "Floração", status: "No Prazo", estadoProdutor: "Em produção", visits: 5, lastVisit: "2026-02-07" },
    { id: "AGR-011", name: "Rosa Mateus", culture: "Feijão", area: "1.5 ha", currentPhase: "Crescimento", status: "No Prazo", estadoProdutor: "Em produção", visits: 3, lastVisit: "2026-02-04" },
    { id: "AGR-012", name: "Carlos Henriques", culture: "Mandioca", area: "2.5 ha", currentPhase: "Crescimento", status: "No Prazo", estadoProdutor: "Substituído", substituto: "Ana Henriques (Filha)", observacoes: "Produtor migrou para Luanda. Filha assumiu a parcela.", visits: 4, lastVisit: "2026-02-06" },
  ],
  "ec-cuemba": [
    { id: "AGR-040", name: "Domingos Campos", culture: "Milho", area: "2.8 ha", currentPhase: "Sementeira", status: "No Prazo", estadoProdutor: "Em produção", visits: 2, lastVisit: "2026-02-08" },
    { id: "AGR-041", name: "Esperança Matos", culture: "Feijão", area: "1.6 ha", currentPhase: "Crescimento", status: "No Prazo", estadoProdutor: "Em produção", visits: 4, lastVisit: "2026-02-06" },
  ],
};

const FichaEscola = () => {
  const { id } = useParams();
  const school = id ? getSchoolById(id) : null;

  if (!school) {
    return (
      <div className="space-y-6">
        <Link to="/escolas"><Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button></Link>
        <p className="text-muted-foreground">Escola não encontrada.</p>
      </div>
    );
  }

  const farmersWithStatus = schoolFarmerStatuses[school.id] || school.farmers.map((f) => ({
    ...f,
    estadoProdutor: "Em produção" as FarmerStatus,
  }));

  const statusCounts = {
    "Em produção": farmersWithStatus.filter((f) => f.estadoProdutor === "Em produção").length,
    "Abandono": farmersWithStatus.filter((f) => f.estadoProdutor === "Abandono").length,
    "Doente": farmersWithStatus.filter((f) => f.estadoProdutor === "Doente").length,
    "Falecido": farmersWithStatus.filter((f) => f.estadoProdutor === "Falecido").length,
    "Substituído": farmersWithStatus.filter((f) => f.estadoProdutor === "Substituído").length,
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      {/* Screen-only header */}
      <div className="flex items-center justify-between print:hidden">
        <Link to={`/escolas/${school.id}`}>
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar à escola</Button>
        </Link>
        <Button onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" />Imprimir Ficha</Button>
      </div>

      {/* Printable content */}
      <div className="bg-card border rounded-lg p-8 print:border-0 print:shadow-none print:p-4 space-y-6 text-sm" id="ficha-escola">
        {/* Header */}
        <div className="text-center border-b border-border pb-4">
          <h1 className="text-xl font-bold font-heading">FICHA DA ESCOLA DE CAMPO</h1>
          <p className="text-xs text-muted-foreground mt-1">Programa MOSAP III — Ficha de Acompanhamento da ECA</p>
        </div>

        {/* Section 1: School Info */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <School className="h-4 w-4 text-primary" />1. Dados da Escola
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground text-xs">Nome:</span><p className="font-semibold">{school.name}</p></div>
            <div><span className="text-muted-foreground text-xs">Estado:</span><Badge variant={school.status === "Ativa" ? "default" : "secondary"} className="mt-0.5">{school.status}</Badge></div>
            <div><span className="text-muted-foreground text-xs">Data de Criação:</span><p className="font-semibold">{school.createdAt}</p></div>
            <div><span className="text-muted-foreground text-xs">Província:</span><p className="font-semibold">{school.province}</p></div>
            <div><span className="text-muted-foreground text-xs">Município:</span><p className="font-semibold">{school.municipality}</p></div>
            <div><span className="text-muted-foreground text-xs">Aldeia:</span><p className="font-semibold">{school.village}</p></div>
          </div>
        </div>

        {/* Section 2: Technician */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />2. Técnico Responsável
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground text-xs">Nome:</span><p className="font-semibold">{school.technician}</p></div>
            <div><span className="text-muted-foreground text-xs">Telefone:</span><p className="font-semibold">{school.technicianPhone}</p></div>
            <div><span className="text-muted-foreground text-xs">Total de Visitas:</span><p className="font-semibold">{school.visits.length}</p></div>
          </div>
        </div>

        {/* Section 3: Summary */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />3. Resumo Geral
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Agricultores</p>
              <p className="text-xl font-bold">{school.totalFarmers}</p>
            </div>
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Área Total</p>
              <p className="text-xl font-bold">{school.totalArea}</p>
            </div>
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Ciclos Activos</p>
              <p className="text-xl font-bold">{school.activeCycles}</p>
            </div>
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Culturas</p>
              <p className="text-xl font-bold">{[...new Set(farmersWithStatus.map((f) => f.culture))].length}</p>
            </div>
          </div>

          {/* Status summary */}
          <div className="flex flex-wrap gap-3">
            {(Object.entries(statusCounts) as [FarmerStatus, number][]).map(([estado, count]) => {
              const Icon = estadoIcons[estado];
              return (
                <div key={estado} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${estadoColors[estado]}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {estado}: {count}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 4: Farmers List */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <Wheat className="h-4 w-4 text-primary" />4. Lista de Produtores e Estado
          </h2>
          <table className="w-full text-xs border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-2 py-2 border-b border-border">Nº</th>
                <th className="text-left px-2 py-2 border-b border-border">ID</th>
                <th className="text-left px-2 py-2 border-b border-border">Nome do Produtor</th>
                <th className="text-left px-2 py-2 border-b border-border">Cultura</th>
                <th className="text-right px-2 py-2 border-b border-border">Área</th>
                <th className="text-left px-2 py-2 border-b border-border">Fase</th>
                <th className="text-left px-2 py-2 border-b border-border">Prod.</th>
                <th className="text-left px-2 py-2 border-b border-border">Estado Produtor</th>
                <th className="text-left px-2 py-2 border-b border-border">Substituto</th>
                <th className="text-left px-2 py-2 border-b border-border">Observações</th>
                <th className="text-center px-2 py-2 border-b border-border">Visitas</th>
              </tr>
            </thead>
            <tbody>
              {farmersWithStatus.map((farmer, i) => {
                const EstadoIcon = estadoIcons[farmer.estadoProdutor];
                return (
                  <tr key={farmer.id} className={`border-b border-border last:border-0 ${farmer.estadoProdutor === "Falecido" ? "bg-red-50/50 dark:bg-red-950/20" : farmer.estadoProdutor === "Abandono" ? "bg-orange-50/50 dark:bg-orange-950/20" : ""}`}>
                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2 font-mono">{farmer.id}</td>
                    <td className="px-2 py-2 font-medium">{farmer.name}</td>
                    <td className="px-2 py-2">{farmer.culture}</td>
                    <td className="px-2 py-2 text-right">{farmer.area}</td>
                    <td className="px-2 py-2">
                      <span className="text-[10px]">{farmer.currentPhase}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-[10px]">{farmer.status}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${estadoColors[farmer.estadoProdutor]}`}>
                        <EstadoIcon className="h-3 w-3" />
                        {farmer.estadoProdutor}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[10px]">{farmer.substituto || "—"}</td>
                    <td className="px-2 py-2 text-[10px] text-muted-foreground max-w-[200px]">{farmer.observacoes || "—"}</td>
                    <td className="px-2 py-2 text-center">{farmer.visits}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Section 5: Visits */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />5. Histórico de Visitas
          </h2>
          <table className="w-full text-xs border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 border-b border-border">Data</th>
                <th className="text-left px-3 py-2 border-b border-border">Tipo</th>
                <th className="text-center px-3 py-2 border-b border-border">Presentes</th>
                <th className="text-left px-3 py-2 border-b border-border">Observações</th>
              </tr>
            </thead>
            <tbody>
              {school.visits.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Sem visitas registadas</td></tr>
              ) : school.visits.map((v, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{v.date}</td>
                  <td className="px-3 py-2">{v.type}</td>
                  <td className="px-3 py-2 text-center">{v.farmersPresent}</td>
                  <td className="px-3 py-2 text-muted-foreground">{v.observations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-4 mt-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-muted-foreground mb-8">Assinatura do Técnico Responsável</p>
              <div className="border-b border-border" />
              <p className="text-xs text-muted-foreground mt-1">{school.technician}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-8">Assinatura do Supervisor</p>
              <div className="border-b border-border" />
              <p className="text-xs text-muted-foreground mt-1">Supervisor provincial</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-6">Documento gerado automaticamente pelo MOSAP III — {new Date().toLocaleDateString("pt-AO")}</p>
        </div>
      </div>
    </div>
  );
};

export default FichaEscola;
