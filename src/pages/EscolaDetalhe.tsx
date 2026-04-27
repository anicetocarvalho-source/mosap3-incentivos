import { useParams, Link } from "react-router-dom";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Search } from "lucide-react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, User, Users, Sprout, Droplets, Sun, Wheat, CheckCircle2, AlertTriangle, Plus, ClipboardEdit, AlertCircle, Camera, X, Send, FileText, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { phaseOrder, type ProductionPhase, type FarmerTracking } from "@/data/escolasData";
import { useSchoolDetail } from "@/hooks/useSchoolDetail";
import { toast } from "@/hooks/use-toast";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

const getPhaseProgress = (phase: ProductionPhase) => {
  const idx = phaseOrder.indexOf(phase);
  return ((idx + 1) / phaseOrder.length) * 100;
};

const statusIcon = (status: string) => {
  if (status === "No Prazo") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "Atrasado") return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  return <CheckCircle2 className="h-4 w-4 text-primary" />;
};

type PhaseLog = {
  farmerId: string;
  farmerName: string;
  parcel: string;
  phase: ProductionPhase;
  date: string;
  observations: string;
  techNote: string;
  hasIssue: boolean;
  issueType?: string;
  issueDescription?: string;
  issueSeverity?: string;
  photos: string[];
};

const EscolaDetalhe = () => {
  const { id } = useParams();
  const { school, loading } = useSchoolDetail(id);

  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerTracking | null>(null);

  // Phase update form
  const [phaseForm, setPhaseForm] = useState({
    parcel: "" as string,
    phase: "" as string,
    date: new Date().toISOString().split("T")[0],
    observations: "",
    techNote: "",
    hasIssue: false,
    issueType: "",
    issueDescription: "",
    issueSeverity: "Baixa",
  });

  // New parcel form
  const [isNewParcel, setIsNewParcel] = useState(false);
  const [newParcelForm, setNewParcelForm] = useState({
    area: "",
    lat: "",
    lon: "",
    culture: "",
  });

  // Issue report form
  const [issueForm, setIssueForm] = useState({
    type: "",
    severity: "Média",
    description: "",
    affectedArea: "",
    actionTaken: "",
    needsSupport: false,
  });

  // Phase logs
  const [phaseLogs, setPhaseLogs] = useState<PhaseLog[]>([]);

  // Search + pagination for farmers list
  const [farmerSearch, setFarmerSearch] = useState("");
  const [farmerPage, setFarmerPage] = useState(1);
  const PAGE_SIZE = 50;
  const deferredSearch = useDeferredValue(farmerSearch);
  const isFiltering = deferredSearch !== farmerSearch;

  const filteredFarmers = useMemo(() => {
    if (!school) return [];
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return school.farmers;
    return school.farmers.filter(
      (f) => f.name.toLowerCase().includes(term) || f.id.toLowerCase().includes(term)
    );
  }, [school, deferredSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredFarmers.length / PAGE_SIZE));
  const currentPage = Math.min(farmerPage, totalPages);
  const pagedFarmers = filteredFarmers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Clamp the stored page if filtering reduced totalPages, preserving the page otherwise.
  useEffect(() => {
    if (farmerPage > totalPages) setFarmerPage(totalPages);
  }, [totalPages, farmerPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

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

  const openPhaseDialog = (farmer: FarmerTracking) => {
    setSelectedFarmer(farmer);
    const nextPhaseIdx = phaseOrder.indexOf(farmer.currentPhase) + 1;
    const nextPhase = nextPhaseIdx < phaseOrder.length ? phaseOrder[nextPhaseIdx] : farmer.currentPhase;
    setPhaseForm({
      parcel: farmer.parcels.length === 1 ? farmer.parcels[0].label : "",
      phase: nextPhase,
      date: new Date().toISOString().split("T")[0],
      observations: "",
      techNote: "",
      hasIssue: false,
      issueType: "",
      issueDescription: "",
      issueSeverity: "Baixa",
    });
    setIsNewParcel(false);
    setNewParcelForm({ area: "", lat: "", lon: "", culture: "" });
    setPhaseDialogOpen(true);
  };

  const openIssueDialog = (farmer: FarmerTracking) => {
    setSelectedFarmer(farmer);
    setIssueForm({
      type: "",
      severity: "Média",
      description: "",
      affectedArea: "",
      actionTaken: "",
      needsSupport: false,
    });
    setIssueDialogOpen(true);
  };

  const submitPhaseUpdate = () => {
    if (!selectedFarmer || !phaseForm.phase || !phaseForm.observations) {
      toast({ title: "Campos obrigatórios", description: "Preencha a fase, data e observações.", variant: "destructive" });
      return;
    }

    let parcelLabel = phaseForm.parcel;
    let parcelInfo = "";

    if (isNewParcel) {
      if (!newParcelForm.area || !newParcelForm.lat || !newParcelForm.lon || !newParcelForm.culture) {
        toast({ title: "Campos obrigatórios", description: "Preencha todos os campos da nova parcela (dimensão, coordenadas e cultura).", variant: "destructive" });
        return;
      }
      const nextLabel = `P${selectedFarmer.parcels.length + 1}`;
      parcelLabel = nextLabel;
      parcelInfo = `${nextLabel} (${newParcelForm.area} — ${newParcelForm.lat}, ${newParcelForm.lon})`;
      // Add new parcel to farmer's parcels array (in-memory)
      selectedFarmer.parcels.push({
        label: nextLabel,
        area: newParcelForm.area,
        lat: newParcelForm.lat,
        lon: newParcelForm.lon,
        culture: newParcelForm.culture,
      });
    } else {
      if (!phaseForm.parcel) {
        toast({ title: "Campos obrigatórios", description: "Seleccione uma parcela.", variant: "destructive" });
        return;
      }
      const selectedParcel = selectedFarmer.parcels.find(p => p.label === phaseForm.parcel);
      parcelInfo = `${phaseForm.parcel} (${selectedParcel?.area || ""} — ${selectedParcel?.lat}, ${selectedParcel?.lon})`;
    }

    const newLog: PhaseLog = {
      farmerId: selectedFarmer.id,
      farmerName: selectedFarmer.name,
      parcel: parcelInfo,
      phase: phaseForm.phase as ProductionPhase,
      date: phaseForm.date,
      observations: phaseForm.observations,
      techNote: phaseForm.techNote,
      hasIssue: phaseForm.hasIssue,
      issueType: phaseForm.issueType,
      issueDescription: phaseForm.issueDescription,
      issueSeverity: phaseForm.issueSeverity,
      photos: [],
    };

    setPhaseLogs((prev) => [newLog, ...prev]);
    setPhaseDialogOpen(false);
    toast({
      title: isNewParcel ? "Parcela criada e fase registada" : "Fase actualizada",
      description: `${selectedFarmer.name} — ${parcelLabel} — ${phaseForm.phase} registada com sucesso.`,
    });
  };

  const submitIssueReport = () => {
    if (!selectedFarmer || !issueForm.type || !issueForm.description) {
      toast({ title: "Campos obrigatórios", description: "Preencha o tipo de problema e descrição.", variant: "destructive" });
      return;
    }

    const newLog: PhaseLog = {
      farmerId: selectedFarmer.id,
      farmerName: selectedFarmer.name,
      parcel: "Todas",
      phase: selectedFarmer.currentPhase,
      date: new Date().toISOString().split("T")[0],
      observations: `PROBLEMA: ${issueForm.type}`,
      techNote: issueForm.actionTaken || "",
      hasIssue: true,
      issueType: issueForm.type,
      issueDescription: issueForm.description,
      issueSeverity: issueForm.severity,
      photos: [],
    };

    setPhaseLogs((prev) => [newLog, ...prev]);
    setIssueDialogOpen(false);
    toast({
      title: "Problema reportado",
      description: `Problema reportado para ${selectedFarmer.name} — ${issueForm.type}`,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/escolas/provincia/${school.provinceSlug}`}>
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
        <Link to={`/escolas/${school.id}/ficha`}>
          <Button variant="outline" className="gap-2"><Printer className="h-4 w-4" />Ficha da Escola</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Agricultores</p><p className="text-2xl font-bold">{school.totalFarmers}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Área Total</p><p className="text-2xl font-bold">{school.totalArea}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ciclos Activos</p><p className="text-2xl font-bold">{school.activeCycles}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Visitas do Mês</p><p className="text-2xl font-bold">{school.visits.filter((v) => v.date.startsWith("2026-02")).length}</p></CardContent></Card>
      </div>

      {/* Phase Overview */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Distribuição por Fase de Produção</CardTitle></CardHeader>
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
          <TabsTrigger value="registos">Registos do Técnico ({phaseLogs.length})</TabsTrigger>
          <TabsTrigger value="visitas">Visitas</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        {/* Acompanhamento Tab */}
        <TabsContent value="acompanhamento" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />{noPrazo} No Prazo</Badge>
              <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3 text-yellow-600" />{atrasados} Atrasados</Badge>
              <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-primary" />{concluidos} Concluídos</Badge>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome ou código..."
                value={farmerSearch}
                onChange={(e) => setFarmerSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {isFiltering ? (
            <div className="rounded-md border p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredFarmers.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">
                {school.farmers.length === 0
                  ? "Esta escola ainda não tem agricultores associados"
                  : "Nenhum agricultor encontrado"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {school.farmers.length === 0
                  ? "Os agricultores aparecem aqui quando registados com esta escola no perfil."
                  : "Tente ajustar a pesquisa."}
              </p>
            </Card>
          ) : (
            <>
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
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-center">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedFarmers.map((farmer, i) => (
                      <motion.tr key={farmer.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }} className="border-b transition-colors hover:bg-muted/50">
                        <TableCell>
                          <Link to={`/agricultores/${farmer.id}`} className="font-medium text-primary hover:underline">{farmer.name}</Link>
                          <div className="text-xs text-muted-foreground">{farmer.id}</div>
                        </TableCell>
                        <TableCell>{farmer.culture}</TableCell>
                        <TableCell>{farmer.area}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${phaseColors[farmer.currentPhase]}`}>{farmer.currentPhase}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={getPhaseProgress(farmer.currentPhase)} className="h-2" />
                            <span className="text-xs text-muted-foreground">{Math.round(getPhaseProgress(farmer.currentPhase))}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">{statusIcon(farmer.status)}<span className="text-xs">{farmer.status}</span></div>
                        </TableCell>
                        <TableCell className="text-center">{farmer.visits}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{farmer.notes}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => openPhaseDialog(farmer)}>
                              <ClipboardEdit className="h-3.5 w-3.5" />
                              Fase
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => openIssueDialog(farmer)}>
                              <AlertCircle className="h-3.5 w-3.5" />
                              Problema
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">
                    A mostrar {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredFarmers.length)} de {filteredFarmers.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFarmerPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">Pág. {currentPage} de {totalPages}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFarmerPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Seguinte <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Registos do Técnico Tab */}
        <TabsContent value="registos" className="space-y-4">
          {phaseLogs.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Nenhum registo do técnico</p>
              <p className="text-sm text-muted-foreground mt-1">Use os botões "Fase" ou "Problema" na tab Acompanhamento para registar informações.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {phaseLogs.map((log, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className={`p-4 ${log.hasIssue ? "border-destructive/30" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${log.hasIssue ? "bg-destructive/10" : phaseColors[log.phase]}`}>
                        {log.hasIssue ? <AlertCircle className="h-4 w-4 text-destructive" /> : (() => { const Icon = phaseIcons[log.phase]; return <Icon className="h-4 w-4" />; })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{log.farmerName}</span>
                          {log.hasIssue ? (
                            <Badge variant="destructive" className="text-xs">{log.issueType}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">{log.phase}</Badge>
                          )}
                          {log.hasIssue && log.issueSeverity && (
                            <Badge variant={log.issueSeverity === "Alta" || log.issueSeverity === "Crítica" ? "destructive" : "secondary"} className="text-xs">
                              {log.issueSeverity}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{log.date}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />Parcela: {log.parcel}</p>
                        <p className="text-sm text-muted-foreground mt-1">{log.hasIssue ? log.issueDescription : log.observations}</p>
                        {log.techNote && (
                          <p className="text-xs mt-1 flex items-center gap-1"><FileText className="h-3 w-3 text-primary" /><span className="text-primary font-medium">Nota:</span> {log.techNote}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Visitas Tab */}
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
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">{visit.date}</TableCell>
                    <TableCell>
                      <Badge variant={visit.type === "Formação" ? "default" : visit.type === "Distribuição" ? "secondary" : "outline"}>{visit.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" /><span>{visit.farmersPresent}</span></div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{visit.observations}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Resumo Tab */}
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
                  {[...new Set(school.farmers.map((f) => f.culture))].map((culture: string) => {
                    const count = school.farmers.filter((f) => f.culture === culture).length;
                    return (
                      <Badge key={culture} variant="outline" className="gap-1 px-3 py-1">
                        <Wheat className="h-3 w-3" />{culture} ({count})
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Actualizar Fase de Produção */}
      <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardEdit className="h-5 w-5 text-primary" />
              Actualizar Fase de Produção
            </DialogTitle>
          </DialogHeader>

          {selectedFarmer && (
            <div className="space-y-4">
              {/* Farmer info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedFarmer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedFarmer.culture} • {selectedFarmer.area} • Fase actual: {selectedFarmer.currentPhase}</p>
                </div>
              </div>
              {/* Parcel select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Parcela *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setIsNewParcel(!isNewParcel);
                      if (!isNewParcel) {
                        setPhaseForm((f) => ({ ...f, parcel: "" }));
                      } else {
                        setNewParcelForm({ area: "", lat: "", lon: "", culture: "" });
                      }
                    }}
                  >
                    {isNewParcel ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    {isNewParcel ? "Cancelar" : "Nova Parcela"}
                  </Button>
                </div>

                {!isNewParcel ? (
                  <>
                    <Select value={phaseForm.parcel} onValueChange={(v) => setPhaseForm((f) => ({ ...f, parcel: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar parcela" /></SelectTrigger>
                      <SelectContent>
                        {selectedFarmer.parcels.map((p) => (
                          <SelectItem key={p.label} value={p.label}>
                            {p.label} — {p.area} ({p.culture})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {phaseForm.parcel && (() => {
                      const sel = selectedFarmer.parcels.find(p => p.label === phaseForm.parcel);
                      return sel ? (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span><strong>{sel.label}</strong> • {sel.area} • {sel.culture} • GPS: {sel.lat}, {sel.lon}</span>
                        </div>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Plus className="h-4 w-4" />
                      Nova Parcela — P{selectedFarmer.parcels.length + 1}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Dimensão (ha) *</Label>
                        <Input
                          placeholder="Ex: 1.5 ha"
                          value={newParcelForm.area}
                          onChange={(e) => setNewParcelForm((f) => ({ ...f, area: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cultura *</Label>
                        <Input
                          placeholder="Ex: Milho"
                          value={newParcelForm.culture}
                          onChange={(e) => setNewParcelForm((f) => ({ ...f, culture: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Latitude (GPS) *</Label>
                        <Input
                          placeholder="Ex: -12.5678"
                          value={newParcelForm.lat}
                          onChange={(e) => setNewParcelForm((f) => ({ ...f, lat: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Longitude (GPS) *</Label>
                        <Input
                          placeholder="Ex: 14.2345"
                          value={newParcelForm.lon}
                          onChange={(e) => setNewParcelForm((f) => ({ ...f, lon: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Phase select */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nova Fase *</Label>
                  <Select value={phaseForm.phase} onValueChange={(v) => setPhaseForm((f) => ({ ...f, phase: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar fase" /></SelectTrigger>
                    <SelectContent>
                      {phaseOrder.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={phaseForm.date} onChange={(e) => setPhaseForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              {/* Observations */}
              <div className="space-y-2">
                <Label>Observações do campo *</Label>
                <Textarea
                  placeholder="Descreva o estado actual da cultura, condições do terreno, etc."
                  value={phaseForm.observations}
                  onChange={(e) => setPhaseForm((f) => ({ ...f, observations: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Tech note */}
              <div className="space-y-2">
                <Label>Nota técnica / Recomendação</Label>
                <Textarea
                  placeholder="Recomendações técnicas para o produtor..."
                  value={phaseForm.techNote}
                  onChange={(e) => setPhaseForm((f) => ({ ...f, techNote: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Issue checkbox */}
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border">
                <Checkbox
                  id="hasIssue"
                  checked={phaseForm.hasIssue}
                  onCheckedChange={(checked) => setPhaseForm((f) => ({ ...f, hasIssue: checked === true }))}
                />
                <Label htmlFor="hasIssue" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Reportar problema nesta fase
                </Label>
              </div>

              {/* Issue details (conditional) */}
              {phaseForm.hasIssue && (
                <div className="space-y-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Tipo de Problema</Label>
                      <Select value={phaseForm.issueType} onValueChange={(v) => setPhaseForm((f) => ({ ...f, issueType: v }))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pragas">Pragas</SelectItem>
                          <SelectItem value="Doenças">Doenças</SelectItem>
                          <SelectItem value="Seca">Seca / Falta de água</SelectItem>
                          <SelectItem value="Inundação">Inundação</SelectItem>
                          <SelectItem value="Ervas daninhas">Ervas daninhas</SelectItem>
                          <SelectItem value="Solo pobre">Solo pobre / Nutrientes</SelectItem>
                          <SelectItem value="Animais">Danos por animais</SelectItem>
                          <SelectItem value="Vento">Danos por vento</SelectItem>
                          <SelectItem value="Sementes">Qualidade das sementes</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Severidade</Label>
                      <Select value={phaseForm.issueSeverity} onValueChange={(v) => setPhaseForm((f) => ({ ...f, issueSeverity: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Baixa">Baixa</SelectItem>
                          <SelectItem value="Média">Média</SelectItem>
                          <SelectItem value="Alta">Alta</SelectItem>
                          <SelectItem value="Crítica">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Descrição do problema</Label>
                    <Textarea
                      placeholder="Descreva o problema observado em detalhe..."
                      value={phaseForm.issueDescription}
                      onChange={(e) => setPhaseForm((f) => ({ ...f, issueDescription: e.target.value }))}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Photo placeholder */}
              <div className="space-y-2">
                <Label className="text-xs">Fotos (opcional)</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 transition-colors">
                  <Camera className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Clique para anexar fotos do campo</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submitPhaseUpdate} className="gap-2">
              <Send className="h-4 w-4" />
              Registar Fase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reportar Problema */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Reportar Problema na Produção
            </DialogTitle>
          </DialogHeader>

          {selectedFarmer && (
            <div className="space-y-4">
              {/* Farmer info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedFarmer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedFarmer.culture} • {selectedFarmer.area} • Fase: {selectedFarmer.currentPhase}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Problema *</Label>
                  <Select value={issueForm.type} onValueChange={(v) => setIssueForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pragas">Pragas</SelectItem>
                      <SelectItem value="Doenças">Doenças</SelectItem>
                      <SelectItem value="Seca">Seca / Falta de água</SelectItem>
                      <SelectItem value="Inundação">Inundação</SelectItem>
                      <SelectItem value="Ervas daninhas">Ervas daninhas</SelectItem>
                      <SelectItem value="Solo pobre">Solo pobre / Nutrientes</SelectItem>
                      <SelectItem value="Danos por animais">Danos por animais</SelectItem>
                      <SelectItem value="Perda total">Perda total da cultura</SelectItem>
                      <SelectItem value="Qualidade das sementes">Qualidade das sementes</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severidade *</Label>
                  <Select value={issueForm.severity} onValueChange={(v) => setIssueForm((f) => ({ ...f, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baixa">Baixa — Impacto mínimo</SelectItem>
                      <SelectItem value="Média">Média — Redução parcial</SelectItem>
                      <SelectItem value="Alta">Alta — Risco de perda significativa</SelectItem>
                      <SelectItem value="Crítica">Crítica — Perda total iminente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição detalhada do problema *</Label>
                <Textarea
                  placeholder="Descreva os sintomas observados, extensão do dano, partes da parcela afectadas..."
                  value={issueForm.description}
                  onChange={(e) => setIssueForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Área afectada (estimativa)</Label>
                <Input
                  placeholder="Ex: 30% da parcela, 0.5 ha..."
                  value={issueForm.affectedArea}
                  onChange={(e) => setIssueForm((f) => ({ ...f, affectedArea: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Acções já tomadas</Label>
                <Textarea
                  placeholder="Que medidas foram tomadas pelo produtor ou técnico..."
                  value={issueForm.actionTaken}
                  onChange={(e) => setIssueForm((f) => ({ ...f, actionTaken: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border">
                <Checkbox
                  id="needsSupport"
                  checked={issueForm.needsSupport}
                  onCheckedChange={(checked) => setIssueForm((f) => ({ ...f, needsSupport: checked === true }))}
                />
                <Label htmlFor="needsSupport" className="text-sm cursor-pointer">
                  Necessita apoio adicional / intervenção urgente
                </Label>
              </div>

              {/* Photo placeholder */}
              <div className="space-y-2">
                <Label className="text-xs">Fotos do problema (recomendado)</Label>
                <div className="border-2 border-dashed border-destructive/30 rounded-lg p-4 text-center cursor-pointer hover:border-destructive/50 transition-colors">
                  <Camera className="h-6 w-6 text-destructive/60 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Anexar fotos mostrando o problema</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={submitIssueReport} className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Reportar Problema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EscolaDetalhe;
