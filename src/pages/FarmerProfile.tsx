import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, MapPin, Phone, CreditCard, Wheat, ShoppingCart, Gift, Calendar, FileText, Users, Sprout, Sun, Droplets, CheckCircle2, Camera, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock, Printer, Beef, Plus, Fingerprint, Package, FolderOpen, Trash2, RotateCcw, Edit, Scale, ArrowUpRight, ArrowDownRight } from "lucide-react";
import FarmerRegistrationForm from "@/components/FarmerRegistrationForm";
import InlineEditableField from "@/components/InlineEditableField";
import { useProvinceMunicipalities } from "@/hooks/useProvinceMunicipalities";
import { useFarmerFromDb } from "@/hooks/useFarmerFromDb";
import { useFarmerEnrichedData } from "@/hooks/useFarmerEnrichedData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import LivestockRegistrationForm from "@/components/LivestockRegistrationForm";
import ParcelRegistrationForm from "@/components/ParcelRegistrationForm";
import DependentRegistrationForm from "@/components/DependentRegistrationForm";
import TransactionRegistrationForm from "@/components/TransactionRegistrationForm";
import FarmerDocuments from "@/components/FarmerDocuments";
import { supabase } from "@/integrations/supabase/client";

const allPhases = ["Preparação", "Sementeira", "Crescimento", "Floração", "Colheita", "Pós-Colheita"];

const phaseIcons: Record<string, any> = {
  "Preparação": Sprout,
  "Sementeira": Sprout,
  "Crescimento": Sun,
  "Floração": Droplets,
  "Colheita": Wheat,
  "Pós-Colheita": CheckCircle2,
};

const phaseColors: Record<string, string> = {
  "Preparação": "bg-muted text-muted-foreground",
  "Sementeira": "bg-info/10 text-info",
  "Crescimento": "bg-success/10 text-success",
  "Floração": "bg-warning/10 text-warning",
  "Colheita": "bg-secondary/20 text-secondary-foreground",
  "Pós-Colheita": "bg-accent text-accent-foreground",
};

const FarmerProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { farmerInfo, farmer: farmerRaw, loading: dbLoading, refetch: refetchFarmer } = useFarmerFromDb(id);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [posSales, setPosSales] = useState<any[]>([]);
  const [posSalesLoaded, setPosSalesLoaded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [expandedProduction, setExpandedProduction] = useState<string | null>(null);
  const [zoomedImageIndex, setZoomedImageIndex] = useState<number | null>(null);
  const [parcelDialogOpen, setParcelDialogOpen] = useState(false);
  const [dependentDialogOpen, setDependentDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { parcels, production, incentives, transactions, dependents, loading: enrichedLoading } = useFarmerEnrichedData(id, refreshKey);

  // Province/municipality options for inline editing
  const { provinces: allProvinces } = useProvinceMunicipalities(undefined);

  // Fetch livestock from DB
  const [livestock, setLivestock] = useState<any[]>([]);
  const [livestockLoaded, setLivestockLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase.from("livestock").select("*").eq("farmer_id", id).then(({ data }) => {
      if (cancelled) return;
      setLivestock(data || []);
      setLivestockLoaded(true);
    });
    supabase.from("pos_sales").select("*, pos_sale_items(*)").eq("farmer_code", id).order("created_at", { ascending: false }).then(({ data }) => {
      if (cancelled) return;
      setPosSales(data || []);
      setPosSalesLoaded(true);
    });
    return () => { cancelled = true; };
  }, [id]);

  const farmer = farmerInfo;

  // Build list of all zoomable images for navigation
  const allImages: { src: string; label: string }[] = [];
  if (farmer) {
    if (farmer.photos?.frontal) allImages.push({ src: farmer.photos.frontal, label: "Frontal" });
    if (farmer.photos?.perfilEsq) allImages.push({ src: farmer.photos.perfilEsq, label: "Perfil Esq." });
    if (farmer.photos?.perfilDir) allImages.push({ src: farmer.photos.perfilDir, label: "Perfil Dir." });
    production.forEach((p) => {
      (p as any).farmer_production_phases?.forEach((phase: any) => {
        phase.photos?.forEach((photo: string, pi: number) => {
          allImages.push({ src: photo, label: `${p.culture} – ${phase.phase} foto ${pi + 1}` });
        });
      });
    });
  }

  const zoomedImage = zoomedImageIndex !== null ? allImages[zoomedImageIndex] : null;
  const setZoomedImage = (img: { src: string; label: string }) => {
    const idx = allImages.findIndex((i) => i.src === img.src && i.label === img.label);
    setZoomedImageIndex(idx >= 0 ? idx : null);
  };
  const navigateImage = (dir: 1 | -1) => {
    if (zoomedImageIndex === null) return;
    const next = (zoomedImageIndex + dir + allImages.length) % allImages.length;
    setZoomedImageIndex(next);
  };

  if (dbLoading || enrichedLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="space-y-6">
        <Link to="/agricultores">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
        <Card className="p-12 text-center">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading font-semibold text-lg">Produtor não encontrado</h2>
          <p className="text-muted-foreground text-sm mt-1">O produtor com ID {id} não foi encontrado.</p>
        </Card>
      </div>
    );
  }

  const updateFarmerField = async (field: string, value: string) => {
    const { error } = await supabase.from("farmers").update({ [field]: value || null }).eq("code", farmer.id);
    if (error) { toast.error("Erro ao guardar"); throw error; }
    toast.success("Campo atualizado");
    refetchFarmer();
  };

  const provinceOptions = allProvinces.map((p) => ({ value: p.name, label: p.name }));
  const genderOptions = [{ value: "M", label: "Masculino" }, { value: "F", label: "Feminino" }];
  const patecOptions = [
    { value: "1", label: "PATEC 1" },
    { value: "2", label: "PATEC 2" },
    { value: "3", label: "PATEC 3" },
  ];

  const valorRecebido = farmerRaw?.valor_recebido || "0,00";
  const totalGasto = farmerRaw?.total_gasto || "0,00";
  const saldoFinal = farmerRaw?.saldo_final || "0,00";

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <Link to="/agricultores">
          <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10"><ArrowLeft className="h-4 w-4 md:h-5 md:w-5" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="page-title text-lg md:text-2xl truncate">{farmer.name}</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5 truncate">{farmer.id} · {farmer.registeredAt}</p>
        </div>
        <Link to={`/agricultores/${farmer.id}/ficha`}>
          <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex"><Printer className="h-4 w-4" />Ficha</Button>
          <Button variant="outline" size="icon" className="h-8 w-8 sm:hidden"><Printer className="h-4 w-4" /></Button>
        </Link>
        <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={() => setEditDialogOpen(true)}>
          <Edit className="h-4 w-4" />Editar
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 sm:hidden" onClick={() => setEditDialogOpen(true)}>
          <Edit className="h-4 w-4" />
        </Button>
        <FarmerRegistrationForm
          open={editDialogOpen}
          onOpenChange={(open) => { setEditDialogOpen(open); if (!open) refetchFarmer(); }}
          editData={{
            id: farmer.id,
            name: farmer.name,
            bi: farmerRaw?.bi || "",
            phone: farmerRaw?.phone || "",
            province: farmerRaw?.province || "",
            municipality: farmerRaw?.municipality || "",
            school: farmerRaw?.school || "",
            patec: farmerRaw?.patec || null,
          }}
        />
        {farmer.status === "Removido" ? (
          <Button variant="outline" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={async () => {
            const { error } = await supabase.from("farmers").update({ status: "Ativo" }).eq("code", farmer.id);
            if (error) { toast.error("Erro ao restaurar"); } else { toast.success(`${farmer.name} restaurado como Ativo`); refetchFarmer(); }
          }} title="Restaurar agricultor">
            <RotateCcw className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)} title="Remover agricultor">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <span className={`text-[10px] md:text-xs ${
          farmer.status === "Ativo" ? "badge-active" :
          farmer.status === "Pendente" || farmer.status === "Validado" ? "badge-pending" : "badge-suspended"
        }`}>{farmer.status}</span>
      </div>

      {/* Profile Summary Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6">
            {farmer.photos?.frontal ? (
              <img src={farmer.photos.frontal} alt={farmer.name} className="h-16 w-16 md:h-20 md:w-20 rounded-2xl object-cover flex-shrink-0 border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setZoomedImage({ src: farmer.photos!.frontal, label: farmer.name })} />
            ) : (
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-8 w-8 md:h-10 md:w-10 text-primary" />
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 md:gap-x-8 gap-y-3 md:gap-y-4 flex-1 w-full">
              <InlineEditableField label="Nome Completo" value={farmer.name} onSave={(v) => updateFarmerField("full_name", v)} />
              <InlineEditableField label="Nº BI" value={farmerRaw?.bi || ""} onSave={(v) => updateFarmerField("bi", v)} mono />
              <InlineEditableField label="Telefone" value={farmerRaw?.phone || ""} onSave={(v) => updateFarmerField("phone", v)} />
              <InlineEditableField label="Género" value={farmerRaw?.gender || ""} onSave={(v) => updateFarmerField("gender", v)} type="select" options={genderOptions} />
              <InlineEditableField label="Data Nascimento" value={farmerRaw?.birth_date || ""} onSave={(v) => updateFarmerField("birth_date", v)} type="date" />
              <InlineEditableField label="Província" value={farmerRaw?.province || ""} onSave={(v) => updateFarmerField("province", v)} type="select" options={provinceOptions} />
              <InlineEditableField label="Município" value={farmerRaw?.municipality || ""} onSave={(v) => updateFarmerField("municipality", v)} />
              <InlineEditableField label="Escola de Campo" value={farmerRaw?.school || ""} onSave={(v) => updateFarmerField("school", v)} />
              <InlineEditableField label="Pacote Tecnológico" value={farmerRaw?.patec?.toString() || ""} onSave={(v) => updateFarmerField("patec", v)} type="select" options={patecOptions} />
            </div>
          </div>

          {/* Photos & Biometrics row */}
          {(farmer.photos || farmer.biometrics) && (
            <div className="mt-5 pt-5 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {farmer.photos && Object.keys(farmer.photos).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" /> Fotografias
                    </h3>
                    <div className="flex gap-3">
                      {[
                        { key: "frontal", label: "Frontal" },
                        { key: "perfilEsq", label: "Perfil Esq." },
                        { key: "perfilDir", label: "Perfil Dir." },
                      ].map((slot) => (
                        <div key={slot.key} className="text-center">
                          {farmer.photos?.[slot.key] ? (
                            <img src={farmer.photos[slot.key]} alt={slot.label} className="h-20 w-16 rounded-lg object-cover border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setZoomedImage({ src: farmer.photos![slot.key], label: slot.label })} />
                          ) : (
                            <div className="h-20 w-16 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
                              <Camera className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">{slot.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {farmer.biometrics && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Fingerprint className="h-3.5 w-3.5" /> Biometria
                    </h3>
                    <div className="flex gap-3">
                      {[
                        { key: "polegarDir", label: "Polegar Dir." },
                        { key: "indicadorDir", label: "Indicador Dir." },
                        { key: "polegarEsq", label: "Polegar Esq." },
                        { key: "indicadorEsq", label: "Indicador Esq." },
                      ].map((slot) => (
                        <div key={slot.key} className="text-center">
                          <div className={`h-14 w-14 rounded-lg border flex items-center justify-center ${
                            farmer.biometrics?.[slot.key]
                              ? "bg-primary/10 border-primary/30"
                              : "bg-muted/30 border-dashed border-border"
                          }`}>
                            <Fingerprint className={`h-6 w-6 ${
                              farmer.biometrics?.[slot.key] ? "text-primary" : "text-muted-foreground/30"
                            }`} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{slot.label}</p>
                          {farmer.biometrics?.[slot.key] && (
                            <p className="text-[9px] text-primary font-medium">✓ Capturada</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Tabs defaultValue="parcelas" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto overflow-x-auto flex-nowrap scrollbar-hide">
            <TabsTrigger value="parcelas" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-card whitespace-nowrap">
              <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">Parcelas</span> ({parcels.length})
            </TabsTrigger>
            <TabsTrigger value="producao" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-card whitespace-nowrap">
              <Wheat className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">Produção</span> ({production.length})
            </TabsTrigger>
            <TabsTrigger value="pecuaria" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-card whitespace-nowrap">
              <Beef className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">Pecuária</span> ({livestock.length})
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-card whitespace-nowrap">
              <Gift className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">Financeiro</span> ({incentives.length + posSales.length + transactions.length})
            </TabsTrigger>
            <TabsTrigger value="dependentes" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-card whitespace-nowrap">
              <Users className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">Dependentes</span> ({dependents.length})
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-card whitespace-nowrap">
              <FolderOpen className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
            <TabsTrigger value="patec" className="gap-1.5 text-xs md:text-sm data-[state=active]:bg-card whitespace-nowrap">
              <Package className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">PATEC</span>
            </TabsTrigger>
          </TabsList>

          {/* Parcelas Tab */}
          <TabsContent value="parcelas" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-lg">Parcelas</h3>
              <Dialog open={parcelDialogOpen} onOpenChange={setParcelDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Nova Parcela</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Registar Parcela — {farmer.name}</DialogTitle>
                  </DialogHeader>
                  <ParcelRegistrationForm
                    farmerCode={farmer.id}
                    onSuccess={() => { setParcelDialogOpen(false); setRefreshKey((k) => k + 1); }}
                  />
                </DialogContent>
              </Dialog>
            </div>
            {/* Mobile: card layout, Desktop: table */}
            <Card className="p-0 overflow-hidden">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cultura</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Área</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Coordenadas</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Nenhuma parcela registada</td></tr>
                    ) : parcels.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.parcel_code}</td>
                        <td className="px-4 py-3"><span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{p.culture}</span></td>
                        <td className="px-4 py-3 text-right font-semibold">{p.area}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.lat}, {p.lon}</td>
                        <td className="px-4 py-3"><span className={p.status === "Verificada" ? "badge-active" : "badge-pending"}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-border">
                {parcels.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhuma parcela registada</div>
                ) : parcels.map((p) => (
                  <div key={p.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{p.culture}</span>
                      <span className={p.status === "Verificada" ? "badge-active" : "badge-pending"}>{p.status}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground font-mono">{p.parcel_code}</span>
                      <span className="font-semibold">{p.area}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.lat}, {p.lon}</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Produção Tab */}
          <TabsContent value="producao" className="mt-4 space-y-4">
            {production.length === 0 ? (
              <Card className="p-12 text-center">
                <Wheat className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma produção registada</p>
              </Card>
            ) : production.map((p) => {
              const isExpanded = expandedProduction === p.id;
              const phaseIndex = allPhases.indexOf(p.current_phase || "");
              const progress = ((phaseIndex + 1) / allPhases.length) * 100;

              return (
                <Card key={p.id} className="overflow-hidden">
                   <div className="p-3 md:p-5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedProduction(isExpanded ? null : p.id)}>
                    <div className="flex items-start md:items-center justify-between gap-2">
                      <div className="flex items-start md:items-center gap-3 md:gap-4 min-w-0">
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                          <Wheat className="h-5 w-5 md:h-6 md:w-6 text-accent-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-heading font-semibold text-sm md:text-base">{p.culture}</h3>
                            <Badge variant="outline" className="text-[10px] md:text-xs">{p.area}</Badge>
                            <span className={`text-[10px] md:text-xs ${p.status === "Colhida" ? "badge-active" : p.status === "Em Crescimento" ? "badge-pending" : "badge-suspended"}`}>{p.status}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{p.planted_date}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.expected_harvest}</span>
                            <span className="hidden sm:inline">Est: {p.estimated_yield} | Real: {p.actual_yield}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${phaseColors[p.current_phase || ""] || "bg-muted"}`}>
                            {p.current_phase}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">Técnico: {p.technician}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground font-medium">{Math.round(progress)}%</span>
                    </div>

                     <div className="mt-2 flex items-center gap-1 overflow-x-auto">
                      {allPhases.map((phase, i) => {
                        const completed = i <= phaseIndex;
                        const isCurrent = phase === p.current_phase;
                        return (
                          <div key={phase} className="flex-1 min-w-[40px] flex flex-col items-center">
                            <div className={`h-1.5 w-full rounded-full ${completed ? "bg-primary" : "bg-muted"} ${isCurrent ? "ring-1 ring-primary ring-offset-1" : ""}`} />
                            <span className={`text-[8px] md:text-[10px] mt-1 whitespace-nowrap ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>{phase}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {isExpanded && p.phases && p.phases.length > 0 && (
                    <div className="border-t border-border">
                      <div className="px-5 py-3 bg-muted/30 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-primary" /><span className="font-medium">{p.technician}</span></span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{p.escola}</span>
                      </div>
                      <div className="p-5 space-y-0">
                        {p.phases.map((phase, i) => {
                          const PhaseIcon = phaseIcons[phase.phase] || Sprout;
                          const isLast = i === p.phases.length - 1;
                          return (
                            <div key={i} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${phaseColors[phase.phase]}`}>
                                  <PhaseIcon className="h-4 w-4" />
                                </div>
                                {!isLast && <div className="w-0.5 flex-1 bg-border min-h-[20px]" />}
                              </div>
                              <div className={`flex-1 ${!isLast ? "pb-5" : "pb-2"}`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{phase.phase}</span>
                                  <span className="text-xs text-muted-foreground">{phase.phase_date}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{phase.notes}</p>
                                {phase.tech_note && (
                                  <div className="mt-1.5 flex items-start gap-1.5 text-xs">
                                    <FileText className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                    <span className="text-primary font-medium">Nota do técnico: </span>
                                    <span className="text-muted-foreground">{phase.tech_note}</span>
                                  </div>
                                )}
                                {phase.photos && phase.photos.length > 0 && (
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    {phase.photos.map((photo, pi) => (
                                      <div key={pi} className="relative group cursor-pointer" onClick={() => setZoomedImage({ src: photo, label: `${phase.phase} - foto ${pi + 1}` })}>
                                        <img src={photo} alt={`${phase.phase} - foto ${pi + 1}`} className="h-20 w-28 object-cover rounded-lg border border-border" />
                                        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 rounded-lg transition-colors flex items-center justify-center">
                                          <Camera className="h-4 w-4 text-background opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          {/* Pecuária Tab */}
          <TabsContent value="pecuaria" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-lg">Pecuária</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Registar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registar Pecuária — {farmer.name}</DialogTitle>
                  </DialogHeader>
                  <LivestockRegistrationForm
                    farmerId={farmer.id}
                    schoolId={undefined}
                    existingLivestock={livestock.map((a) => ({
                      id: a.id,
                      species: a.species,
                      breed: a.breed || null,
                      quantity: a.quantity,
                    }))}
                    onSuccess={() => {
                      toast.success("Dados actualizados!");
                      supabase.from("livestock").select("*").eq("farmer_id", id).then(({ data }) => setLivestock(data || []));
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
            {livestock.length === 0 ? (
              <Card className="p-12 text-center">
                <Beef className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Nenhum registo pecuário</p>
                <p className="text-sm text-muted-foreground mt-1">Os dados de pecuária deste produtor serão apresentados aqui.</p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">Total Animais</p>
                    <p className="text-2xl font-bold">{livestock.reduce((s, a) => s + a.quantity, 0)}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">Espécies</p>
                    <p className="text-2xl font-bold">{livestock.length}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">Área Pastagem</p>
                    <p className="text-2xl font-bold">{livestock[0]?.pasture_area || "—"}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">Machos / Fêmeas</p>
                    <p className="text-2xl font-bold">{livestock.reduce((s, a) => s + a.male_count, 0)} / {livestock.reduce((s, a) => s + a.female_count, 0)}</p>
                  </Card>
                </div>
                {livestock.map((animal) => (
                  <Card key={animal.id} className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
                          <Beef className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                          <h3 className="font-heading font-semibold">{animal.species}</h3>
                          {animal.breed && <p className="text-xs text-muted-foreground">Raça: {animal.breed}</p>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">{animal.quantity} cabeças</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="text-xs text-muted-foreground">Machos</span><p className="font-semibold">{animal.male_count}</p></div>
                      <div><span className="text-xs text-muted-foreground">Fêmeas</span><p className="font-semibold">{animal.female_count}</p></div>
                      <div><span className="text-xs text-muted-foreground">Crias</span><p className="font-semibold">{animal.young_count}</p></div>
                      <div><span className="text-xs text-muted-foreground">Infraestrutura</span><p className="font-semibold">{animal.infrastructure_notes || "—"}</p></div>
                    </div>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* (Aba "Incentivos" antiga removida — fundida em "Financeiro") */}

          {/* Dependentes Tab */}
          <TabsContent value="dependentes" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-lg">Agregado Familiar</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Membros do agregado familiar do produtor</p>
                </div>
                <Dialog open={dependentDialogOpen} onOpenChange={setDependentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo Dependente</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Registar Dependente — {farmer.name}</DialogTitle>
                    </DialogHeader>
                    <DependentRegistrationForm
                      farmerCode={farmer.id}
                      onSuccess={() => { setDependentDialogOpen(false); setRefreshKey((k) => k + 1); }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Nome</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Parentesco</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Género</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data Nasc.</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Idade</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Escolaridade</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Ocupação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dependents.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Nenhum dependente registado</td></tr>
                    ) : dependents.map((d) => (
                      <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{d.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{d.relationship}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.gender}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{d.birth_date}</td>
                        <td className="px-4 py-3 text-center font-semibold">{d.age}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.education}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.occupation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-border">
                {dependents.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum dependente registado</div>
                ) : dependents.map((d) => (
                  <div key={d.id} className="p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="font-medium text-sm">{d.name}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">{d.relationship}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>{d.gender}</span>
                      <span>{d.age} anos</span>
                      <span>{d.education || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Documentos Tab */}
          <TabsContent value="documentos" className="mt-4 space-y-4">
            <FarmerDocuments farmerCode={farmer.id} />
          </TabsContent>

          {/* Conformação Tab */}
          {/* Financeiro Tab — incentivos + compras POS + transações manuais (substitui as antigas abas Incentivos e Conformação) */}
          <TabsContent value="financeiro" className="mt-4 space-y-6">
            {(() => {
              // Parser pt-AO: "198.700,00" → 198700
              const parsePtAo = (s: string | null | undefined) => {
                if (!s) return 0;
                return parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
              };

              // Incentivos: novos (farmer_incentives) + legado (farmers.valor_recebido) como fallback
              const totalIncentivosNovos = incentives.reduce((sum, inc) => sum + parseFloat(inc.amount || "0"), 0);
              const totalIncentivosLegado = parsePtAo(farmer?.valor_recebido);
              const totalIncentivos = totalIncentivosNovos + (totalIncentivosNovos === 0 ? totalIncentivosLegado : 0);

              // Compras: POS + transações manuais legadas (sempre somadas, nunca perder histórico)
              const totalComprasPos = posSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
              const totalComprasManuais = transactions.reduce((sum, t) => sum + parsePtAo(t.valor), 0);
              const totalCompras = totalComprasPos + totalComprasManuais;

              const saldo = totalIncentivos - totalCompras;
              const percentUsado = totalIncentivos > 0 ? Math.min((totalCompras / totalIncentivos) * 100, 100) : 0;
              const totalComprasCount = posSales.length + transactions.length;

              // Build unified timeline (incentivos + compras POS + transações manuais legadas)
              const timeline: { date: string; type: "incentivo" | "compra" | "manual"; description: string; value: number; status: string }[] = [];
              incentives.forEach((inc) => {
                timeline.push({
                  date: inc.incentive_date || "",
                  type: "incentivo",
                  description: `Incentivo ${inc.incentive_code}`,
                  value: parseFloat(inc.amount || "0"),
                  status: inc.status,
                });
              });
              posSales.forEach((sale) => {
                const items = (sale.pos_sale_items || []).map((i: any) => i.product_name).join(", ");
                timeline.push({
                  date: sale.created_at?.split("T")[0] || "",
                  type: "compra",
                  description: items || `Venda ${sale.sale_code}`,
                  value: Number(sale.total || 0),
                  status: sale.payment_status,
                });
              });
              transactions.forEach((t) => {
                timeline.push({
                  date: t.transaction_date || "",
                  type: "manual",
                  description: `${t.product}${t.empresa ? ` — ${t.empresa}` : ""}`,
                  value: parseFloat((t.valor || "0").toString().replace(/\./g, "").replace(",", ".")) || 0,
                  status: "Manual",
                });
              });
              timeline.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

              return (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <Card className="p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowDownRight className="h-4 w-4 text-primary" />
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Incentivos Recebidos</p>
                      </div>
                      <p className="text-2xl font-bold font-heading text-primary">{totalIncentivos.toLocaleString("pt-AO")} Kz</p>
                      <p className="text-xs text-muted-foreground mt-1">{incentives.length} distribuição(ões)</p>
                    </Card>
                    <Card className="p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpRight className="h-4 w-4 text-destructive" />
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Compras Realizadas</p>
                      </div>
                      <p className="text-2xl font-bold font-heading text-destructive">{totalCompras.toLocaleString("pt-AO")} Kz</p>
                      <p className="text-xs text-muted-foreground mt-1">{posSales.length} compra(s)</p>
                    </Card>
                    <Card className="p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="h-4 w-4" style={{ color: "hsl(var(--success))" }} />
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Saldo Disponível</p>
                      </div>
                      <p className="text-2xl font-bold font-heading" style={{ color: saldo >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>
                        {saldo.toLocaleString("pt-AO")} Kz
                      </p>
                    </Card>
                    <Card className="p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Taxa de Utilização</p>
                      </div>
                      <p className="text-2xl font-bold font-heading">{percentUsado.toFixed(1)}%</p>
                      <Progress value={percentUsado} className="h-2 mt-2" />
                    </Card>
                  </div>

                  {/* Conformação Status */}
                  <Card className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        saldo >= 0 ? "bg-primary/10" : "bg-destructive/10"
                      }`}>
                        <Scale className={`h-5 w-5 ${saldo >= 0 ? "text-primary" : "text-destructive"}`} />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-base">Estado da Conformação</h3>
                        <p className="text-xs text-muted-foreground">
                          {saldo >= 0 && totalCompras === 0 && "Incentivo recebido, sem compras registadas."}
                          {saldo >= 0 && totalCompras > 0 && "Conformado — O produtor tem saldo positivo."}
                          {saldo < 0 && "Não conformado — O produtor gastou mais do que o valor recebido."}
                          {totalIncentivos === 0 && totalCompras === 0 && "Sem movimentos financeiros registados."}
                        </p>
                      </div>
                      <Badge className={`ml-auto ${
                        totalIncentivos === 0 && totalCompras === 0 ? "bg-muted text-muted-foreground" :
                        saldo >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                      }`}>
                        {totalIncentivos === 0 && totalCompras === 0 ? "Sem Dados" : saldo >= 0 ? "Conformado" : "Não Conformado"}
                      </Badge>
                    </div>
                  </Card>

                  {/* Timeline */}
                  <Card className="p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-heading font-semibold text-lg">Movimentos Financeiros</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Histórico cronológico de incentivos, compras POS e transações manuais</p>
                      </div>
                      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> Nova Transação</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Registar Transação Manual — {farmer.name}</DialogTitle>
                          </DialogHeader>
                          <TransactionRegistrationForm
                            farmerCode={farmer.id}
                            onSuccess={() => { setTransactionDialogOpen(false); setRefreshKey((k) => k + 1); }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Tipo</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Descrição</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeline.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Nenhum movimento registado</td></tr>
                          ) : timeline.map((item, idx) => (
                            <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-6 py-3 text-xs text-muted-foreground">{item.date || "—"}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className={`text-[10px] ${
                                  item.type === "incentivo" ? "border-primary/30 text-primary" :
                                  item.type === "compra" ? "border-destructive/30 text-destructive" :
                                  "border-muted-foreground/30 text-muted-foreground"
                                }`}>
                                  {item.type === "incentivo" ? "↓ Incentivo" : item.type === "compra" ? "↑ Compra POS" : "≡ Manual"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 font-medium max-w-[300px] truncate">{item.description}</td>
                              <td className={`px-4 py-3 text-right font-semibold ${
                                item.type === "incentivo" ? "text-primary" :
                                item.type === "compra" ? "text-destructive" : "text-foreground"
                              }`}>
                                {item.type === "incentivo" ? "+" : "−"}{item.value.toLocaleString("pt-AO")} Kz
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] ${
                                  item.status === "Aprovado" || item.status === "pago" ? "badge-active" :
                                  item.status === "Pendente" || item.status === "pendente" ? "badge-pending" : "badge-suspended"
                                }`}>{item.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile */}
                    <div className="md:hidden divide-y divide-border">
                      {timeline.length === 0 ? (
                        <div className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum movimento registado</div>
                      ) : timeline.map((item, idx) => (
                        <div key={idx} className="p-4 space-y-1">
                          <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              {item.type === "incentivo" ? (
                                <ArrowDownRight className="h-4 w-4 text-primary" />
                              ) : item.type === "compra" ? (
                                <ArrowUpRight className="h-4 w-4 text-destructive" />
                              ) : (
                                <Scale className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium text-sm truncate max-w-[200px]">{item.description}</span>
                            </div>
                            <span className={`font-semibold text-sm ${
                              item.type === "incentivo" ? "text-primary" :
                              item.type === "compra" ? "text-destructive" : "text-foreground"
                            }`}>
                              {item.type === "incentivo" ? "+" : "−"}{item.value.toLocaleString("pt-AO")} Kz
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.date || "—"}</span>
                            <span className={`text-[10px] ${
                              item.status === "Aprovado" || item.status === "pago" ? "badge-active" : "badge-pending"
                            }`}>{item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="patec" className="mt-4 space-y-4">
            {(() => {
              const patecNum = farmerRaw?.patec;
              const patecData: Record<number, { title: string; cultura: string; insumos: string[]; servicos: string[]; animal: string[]; qtd: string }> = {
                1: {
                  title: "PATEC 1 — Milho + Feijão + Gado",
                  cultura: "Milho",
                  insumos: ["Semente de milho", "Semente de feijão", "Adubo composto", "Adubo simples", "Inseticida", "Fungicida", "Enxada", "Catana", "Lima", "Ancinho", "Machado", "Carro de mão"],
                  animal: ["Cabra", "Ovelha", "Galinha", "Boi", "Ração animal", "Vitaminas", "Antibióticos", "Brincos", "Rede galinheiro", "Pregos", "Chapas"],
                  servicos: ["Preparação de terra mecanizada", "Amanhos culturais", "Transporte para escoamento da produção"],
                  qtd: "10.800 produtores",
                },
                2: {
                  title: "PATEC 2 — Massango + Feijão + Gado",
                  cultura: "Massango",
                  insumos: ["Semente de massango", "Semente de feijão", "Adubo composto", "Adubo simples", "Inseticida", "Fungicida", "Enxada", "Catana", "Lima", "Ancinho", "Machado", "Carro de mão"],
                  animal: ["Cabra", "Ovelha", "Galinha", "Boi", "Ração animal", "Vitaminas", "Antibióticos", "Brincos", "Rede galinheiro", "Pregos", "Chapas"],
                  servicos: ["Preparação de terra mecanizada", "Amanhos culturais", "Transporte para escoamento da produção"],
                  qtd: "3.600 produtores",
                },
                3: {
                  title: "PATEC 3 — Massambala + Feijão + Gado",
                  cultura: "Massambala",
                  insumos: ["Semente de massambala", "Semente de feijão", "Adubo composto", "Adubo simples", "Inseticida", "Fungicida", "Enxada", "Catana", "Lima", "Ancinho", "Machado", "Carro de mão"],
                  animal: ["Cabra", "Ovelha", "Galinha", "Boi", "Ração animal", "Vitaminas", "Antibióticos", "Brincos", "Rede galinheiro", "Pregos", "Chapas"],
                  servicos: ["Preparação de terra mecanizada", "Amanhos culturais", "Transporte para escoamento da produção"],
                  qtd: "3.600 produtores",
                },
              };

              if (!patecNum || !patecData[patecNum]) {
                return (
                  <Card className="p-12 text-center">
                    <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum pacote tecnológico atribuído a este produtor</p>
                  </Card>
                );
              }

              const p = patecData[patecNum];

              return (
                <>
                  <Card className="p-4 md:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-base md:text-lg">{p.title}</h3>
                        <p className="text-xs text-muted-foreground">Ano de Arranque — MOSAP III · {p.qtd}</p>
                      </div>
                      <Badge className="ml-auto text-xs">PATEC {patecNum}</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                      {/* Insumos Agrícolas */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Sprout className="h-3.5 w-3.5" /> Insumos Agrícolas
                        </h4>
                        <ul className="space-y-1">
                          {p.insumos.map((item) => (
                            <li key={item} className="text-sm flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Pecuária e Materiais */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Beef className="h-3.5 w-3.5" /> Pecuária e Materiais
                        </h4>
                        <ul className="space-y-1">
                          {p.animal.map((item) => (
                            <li key={item} className="text-sm flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Serviços */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Gift className="h-3.5 w-3.5" /> Serviços Incluídos
                        </h4>
                        <ul className="space-y-1">
                          {p.servicos.map((item) => (
                            <li key={item} className="text-sm flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                </>
              );
            })()}
          </TabsContent>
        </Tabs>
      </motion.div>
      {/* Image Zoom Modal with Navigation */}
      <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImageIndex(null)}>
        <DialogContent className="max-w-2xl p-2">
          <DialogHeader className="px-4 pt-2">
            <DialogTitle className="text-sm">{zoomedImage?.label}</DialogTitle>
          </DialogHeader>
          {zoomedImage && (
            <div className="relative">
              <img src={zoomedImage.src} alt={zoomedImage.label} className="w-full max-h-[75vh] object-contain rounded-lg" />
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => navigateImage(-1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors shadow-md"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => navigateImage(1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors shadow-md"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <p className="text-center text-xs text-muted-foreground mt-2">
                {(zoomedImageIndex ?? 0) + 1} / {allImages.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover agricultor?</AlertDialogTitle>
            <AlertDialogDescription>
              O produtor <strong>{farmer.name}</strong> ({farmer.id}) será marcado como <strong>Removido</strong>. Os dados associados serão mantidos. Esta ação pode ser revertida alterando o estado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const { error } = await supabase
                  .from("farmers")
                  .update({ status: "Removido" })
                  .eq("code", farmer.id);
                if (error) {
                  toast.error("Erro ao remover agricultor");
                } else {
                  toast.success(`${farmer.name} marcado como Removido`);
                  navigate("/agricultores");
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FarmerProfile;
