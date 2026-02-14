import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, MapPin, Phone, CreditCard, Wheat, ShoppingCart, Gift, Calendar, FileText, Users, Sprout, Sun, Droplets, CheckCircle2, Camera, ChevronDown, ChevronUp, Clock, Printer, Beef, Plus, Fingerprint } from "lucide-react";
import { useFarmerFromDb } from "@/hooks/useFarmerFromDb";
import { useFarmerEnrichedData } from "@/hooks/useFarmerEnrichedData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import LivestockRegistrationForm from "@/components/LivestockRegistrationForm";
import ParcelRegistrationForm from "@/components/ParcelRegistrationForm";
import DependentRegistrationForm from "@/components/DependentRegistrationForm";
import TransactionRegistrationForm from "@/components/TransactionRegistrationForm";
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
  "Sementeira": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Crescimento": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Floração": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Colheita": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Pós-Colheita": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const FarmerProfile = () => {
  const { id } = useParams();
  const { farmerInfo, farmer: farmerRaw, loading: dbLoading } = useFarmerFromDb(id);
  const [expandedProduction, setExpandedProduction] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; label: string } | null>(null);
  const [parcelDialogOpen, setParcelDialogOpen] = useState(false);
  const [dependentDialogOpen, setDependentDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { parcels, production, incentives, transactions, dependents, loading: enrichedLoading } = useFarmerEnrichedData(id, refreshKey);

  // Fetch livestock from DB
  const [livestock, setLivestock] = useState<any[]>([]);
  const [livestockLoaded, setLivestockLoaded] = useState(false);

  useState(() => {
    if (!id) return;
    supabase.from("livestock").select("*").eq("farmer_id", id).then(({ data }) => {
      setLivestock(data || []);
      setLivestockLoaded(true);
    });
  });

  const farmer = farmerInfo;

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

  const valorRecebido = farmerRaw?.valor_recebido || "0,00";
  const totalGasto = farmerRaw?.total_gasto || "0,00";
  const saldoFinal = farmerRaw?.saldo_final || "0,00";

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link to="/agricultores">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="page-title">{farmer.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{farmer.id} · Registado em {farmer.registeredAt}</p>
        </div>
        <Link to={`/agricultores/${farmer.id}/ficha`}>
          <Button variant="outline" className="gap-2"><Printer className="h-4 w-4" />Ficha</Button>
        </Link>
        <span className={
          farmer.status === "Ativo" ? "badge-active" :
          farmer.status === "Pendente" || farmer.status === "Validado" ? "badge-pending" : "badge-suspended"
        }>{farmer.status}</span>
      </div>

      {/* Profile Summary Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          <div className="flex items-start gap-6">
            {farmer.photos?.frontal ? (
              <img src={farmer.photos.frontal} alt={farmer.name} className="h-20 w-20 rounded-2xl object-cover flex-shrink-0 border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setZoomedImage({ src: farmer.photos!.frontal, label: farmer.name })} />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-10 w-10 text-primary" />
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 flex-1">
              <div><p className="text-xs text-muted-foreground font-medium">Nome Completo</p><p className="text-sm font-semibold mt-0.5">{farmer.name}</p></div>
              <div><p className="text-xs text-muted-foreground font-medium">Nº BI</p><p className="text-sm font-semibold mt-0.5 font-mono">{farmer.bi}</p></div>
              <div><p className="text-xs text-muted-foreground font-medium">Telefone</p><p className="text-sm font-semibold mt-0.5">{farmer.phone}</p></div>
              <div><p className="text-xs text-muted-foreground font-medium">Género</p><p className="text-sm font-semibold mt-0.5">{farmer.gender}</p></div>
              <div><p className="text-xs text-muted-foreground font-medium">Data de Nascimento</p><p className="text-sm font-semibold mt-0.5">{farmer.birthDate}</p></div>
              <div><p className="text-xs text-muted-foreground font-medium">Província / Município</p><p className="text-sm font-semibold mt-0.5">{farmer.province}, {farmer.municipality}</p></div>
              <div><p className="text-xs text-muted-foreground font-medium">Aldeia</p><p className="text-sm font-semibold mt-0.5">—</p></div>
              <div><p className="text-xs text-muted-foreground font-medium">Escola de Campo</p><p className="text-sm font-semibold mt-0.5">{farmer.school}</p></div>
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
          <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="parcelas" className="gap-2 data-[state=active]:bg-card">
              <MapPin className="h-4 w-4" /> Parcelas ({parcels.length})
            </TabsTrigger>
            <TabsTrigger value="producao" className="gap-2 data-[state=active]:bg-card">
              <Wheat className="h-4 w-4" /> Produção ({production.length})
            </TabsTrigger>
            <TabsTrigger value="pecuaria" className="gap-2 data-[state=active]:bg-card">
              <Beef className="h-4 w-4" /> Pecuária ({livestock.length})
            </TabsTrigger>
            <TabsTrigger value="incentivos" className="gap-2 data-[state=active]:bg-card">
              <Gift className="h-4 w-4" /> Incentivos ({incentives.length})
            </TabsTrigger>
            <TabsTrigger value="dependentes" className="gap-2 data-[state=active]:bg-card">
              <Users className="h-4 w-4" /> Dependentes ({dependents.length})
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
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
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
                  <div className="p-5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedProduction(isExpanded ? null : p.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                          <Wheat className="h-6 w-6 text-accent-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading font-semibold">{p.culture}</h3>
                            <Badge variant="outline" className="text-xs">{p.area}</Badge>
                            <span className={p.status === "Colhida" ? "badge-active" : p.status === "Em Crescimento" ? "badge-pending" : "badge-suspended"}>{p.status}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Plantio: {p.planted_date}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Colheita prev.: {p.expected_harvest}</span>
                            <span>Est: {p.estimated_yield} | Real: {p.actual_yield}</span>
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

                    <div className="mt-2 flex items-center gap-1">
                      {allPhases.map((phase, i) => {
                        const completed = i <= phaseIndex;
                        const isCurrent = phase === p.current_phase;
                        return (
                          <div key={phase} className="flex-1 flex flex-col items-center">
                            <div className={`h-1.5 w-full rounded-full ${completed ? "bg-primary" : "bg-muted"} ${isCurrent ? "ring-1 ring-primary ring-offset-1" : ""}`} />
                            <span className={`text-[10px] mt-1 ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>{phase}</span>
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

          {/* Incentivos Tab */}
          <TabsContent value="incentivos" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor Recebido</p>
                <p className="text-2xl font-bold font-heading text-primary mt-1">{valorRecebido} kz</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Gasto</p>
                <p className="text-2xl font-bold font-heading text-destructive mt-1">{totalGasto} kz</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Saldo Final</p>
                <p className="text-2xl font-bold font-heading mt-1" style={{ color: "hsl(var(--success))" }}>{saldoFinal} kz</p>
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-lg">Transações do Produtor</h3>
                </div>
                <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Nova Transação</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Registar Transação — {farmer.name}</DialogTitle>
                    </DialogHeader>
                    <TransactionRegistrationForm
                      farmerCode={farmer.id}
                      onSuccess={() => { setTransactionDialogOpen(false); setRefreshKey((k) => k + 1); }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produto</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Empresa</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Nenhuma transação registada</td></tr>
                    ) : transactions.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-medium">{t.product}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[300px]">{t.empresa}</td>
                        <td className="px-4 py-3 text-right font-semibold">{t.valor} kz</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{t.transaction_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

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
              <div className="overflow-x-auto">
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
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
      {/* Image Zoom Modal */}
      <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-2xl p-2">
          <DialogHeader className="px-4 pt-2">
            <DialogTitle className="text-sm">{zoomedImage?.label}</DialogTitle>
          </DialogHeader>
          {zoomedImage && (
            <img src={zoomedImage.src} alt={zoomedImage.label} className="w-full max-h-[75vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FarmerProfile;
