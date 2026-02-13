import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Printer, Filter, Calendar, MapPin, School, Users, ShoppingCart, Gift, Wheat, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ReportPreview from "@/components/reports/ReportPreview";

const reportTypes = [
  { id: "producao_provincia", label: "Produção por Província", icon: Wheat, description: "Cruzar dados de produção com províncias e escolas de campo" },
  { id: "agricultores_estado", label: "Agricultores por Estado", icon: Users, description: "Agricultores agrupados por estado e província" },
  { id: "incentivos_distribuidos", label: "Incentivos Distribuídos", icon: Gift, description: "Incentivos por região, escola e período" },
  { id: "compras_transacoes", label: "Compras e Transações", icon: ShoppingCart, description: "Resumo de compras e transações por empresa e período" },
];

const provincias = ["Benguela", "Huambo", "Bié", "Huíla", "Malanje"];
const municipios: Record<string, string[]> = {
  Benguela: ["Caimbambo", "Lobito", "Ganda", "Benguela"],
  Huambo: ["Longonjo", "Bailundo", "Huambo"],
  Bié: ["Cuemba", "Kuíto"],
  Huíla: ["Lubango", "Matala"],
  Malanje: ["Cacuso", "Malanje"],
};
const escolas = ["EC Caimbambo", "EC Longonjo", "EC Cuemba", "EC Lobito", "EC Bailundo", "EC Lubango", "EC Cacuso", "EC Ganda"];
const estados = ["Ativo", "Pendente", "Suspenso", "Validado"];

const Relatorios = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [provincia, setProvincia] = useState<string>("");
  const [municipio, setMunicipio] = useState<string>("");
  const [escola, setEscola] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    if (!selectedReport) return;
    setShowPreview(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setProvincia("");
    setMunicipio("");
    setEscola("");
    setEstado("");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const activeFilters = {
    provincia,
    municipio,
    escola,
    estado,
    dateFrom,
    dateTo,
  };

  const selectedReportData = reportTypes.find((r) => r.id === selectedReport);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Geração de relatórios cruzados com impressão em PDF</p>
        </div>
        {showPreview && (
          <Button className="gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Imprimir PDF
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Report type + Filters */}
        <div className="lg:col-span-1 space-y-4 print:hidden">
          {/* Report type selection */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Tipo de Relatório
            </div>
            <div className="space-y-2">
              {reportTypes.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => { setSelectedReport(rt.id); setShowPreview(false); }}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3",
                    selectedReport === rt.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    selectedReport === rt.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <rt.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{rt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Filters */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4 text-primary" />
                Filtros
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearFilters}>
                Limpar
              </Button>
            </div>

            {/* Date range */}
            <div className="space-y-2">
              <Label className="text-xs">Período</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("justify-start text-left text-xs h-9", !dateFrom && "text-muted-foreground")}>
                      <Calendar className="h-3 w-3 mr-1" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("justify-start text-left text-xs h-9", !dateTo && "text-muted-foreground")}>
                      <Calendar className="h-3 w-3 mr-1" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Provincia */}
            <div className="space-y-2">
              <Label className="text-xs">Província</Label>
              <Select value={provincia} onValueChange={(v) => { setProvincia(v); setMunicipio(""); }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todas as províncias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {provincias.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Municipio */}
            {provincia && provincia !== "all" && (
              <div className="space-y-2">
                <Label className="text-xs">Município</Label>
                <Select value={municipio} onValueChange={setMunicipio}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Todos os municípios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(municipios[provincia] || []).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Escola */}
            <div className="space-y-2">
              <Label className="text-xs">Escola de Campo</Label>
              <Select value={escola} onValueChange={setEscola}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todas as escolas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {escolas.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <Label className="text-xs">Estado do Agricultor</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {estados.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full gap-2" onClick={handleGenerate} disabled={!selectedReport}>
              <FileText className="h-4 w-4" />
              Gerar Relatório
            </Button>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2">
          {showPreview && selectedReportData ? (
            <div ref={printRef}>
              <ReportPreview reportType={selectedReport!} reportLabel={selectedReportData.label} filters={activeFilters} />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-heading font-semibold text-lg">Selecione um relatório</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                  Escolha o tipo de relatório no painel à esquerda, aplique os filtros desejados e clique em "Gerar Relatório" para visualizar a pré-visualização.
                </p>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Relatorios;
