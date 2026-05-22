import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Search, MapPin, Maximize2, Eye, Layers, Map, ChevronLeft, ChevronRight, Crosshair } from "lucide-react";
import ParcelasMap from "@/components/ParcelasMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowsSkeleton, CardListSkeleton } from "@/components/ui/loading-skeletons";
import StatCard from "@/components/StatCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

const Parcelas = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Form state
  const [formFarmer, setFormFarmer] = useState("");
  const [formArea, setFormArea] = useState("");
  const [formCulture, setFormCulture] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLon, setFormLon] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  const handleFocusOnMap = () => {
    const lat = parseFloat(formLat);
    const lon = parseFloat(formLon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      toast({ title: "Coordenadas inválidas", description: "Introduza latitude e longitude válidas.", variant: "destructive" });
      return;
    }
    setShowMap(true);
    setFocusCoords({ lat, lon, zoom: 16 });
    setDialogOpen(false);
    setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const { data: parcels = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["farmer_parcels"],
    queryFn: async () => {
      return await fetchAllPages<any>(() =>
        supabase
          .from("farmer_parcels")
          .select(
            "*, farmers!farmer_parcels_farmer_code_fkey(full_name, province, municipality)",
            { count: "exact" }
          )
          .order("created_at", { ascending: false })
      );
    },
  });

  const { data: farmersList = [] } = useQuery({
    queryKey: ["farmers_list_select"],
    queryFn: async () => {
      return await fetchAllPages<any>(() =>
        supabase.from("farmers").select("code, full_name", { count: "exact" }).neq("status","Removido").order("full_name")
      );
    },
  });

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const filtered = parcels.filter((p: any) => {
    const name = p.farmers?.full_name || "";
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      p.parcel_code.toLowerCase().includes(search.toLowerCase()) ||
      p.culture.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalArea = parcels.reduce((sum: number, p: any) => sum + (parseFloat(p.area) || 0), 0);
  const totalVerificadas = parcels.filter((p: any) => p.status === "Verificada").length;
  const cultures = [...new Set(parcels.map((p: any) => p.culture))];

  // Map data
  const mapData = parcels.filter((p: any) => p.lat && p.lon).map((p: any) => ({
    id: p.parcel_code,
    farmer: p.farmers?.full_name || "—",
    farmerId: p.farmer_code,
    province: p.farmers?.province || "",
    municipality: p.farmers?.municipality || "",
    village: "",
    area: p.area,
    culture: p.culture,
    lat: p.lat,
    lon: p.lon,
    status: p.status,
    season: "",
  }));

  const handleSubmit = async () => {
    if (!formFarmer || !formArea || !formCulture) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    const code = `PRC-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("farmer_parcels").insert({
      parcel_code: code,
      farmer_code: formFarmer,
      area: formArea + " ha",
      culture: formCulture,
      lat: formLat || null,
      lon: formLon || null,
    });
    if (error) { toast({ title: "Erro ao registar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Parcela registada com sucesso" });
    queryClient.invalidateQueries({ queryKey: ["farmer_parcels"] });
    setDialogOpen(false);
    setFormFarmer(""); setFormArea(""); setFormCulture(""); setFormLat(""); setFormLon(""); setFormNotes("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Parcelas de Terreno</h1>
          <p className="text-muted-foreground text-sm mt-1">Georreferenciamento e gestão de parcelas agrícolas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Parcela</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">Registar Parcela</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Produtor</Label>
                <Select value={formFarmer} onValueChange={setFormFarmer}>
                  <SelectTrigger><SelectValue placeholder="Selecionar produtor" /></SelectTrigger>
                  <SelectContent>
                    {farmersList.map((f: any) => (
                      <SelectItem key={f.code} value={f.code}>{f.full_name} ({f.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Área (hectares)</Label>
                  <Input placeholder="0.0" type="number" step="0.1" value={formArea} onChange={(e) => setFormArea(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Cultura</Label>
                  <Select value={formCulture} onValueChange={setFormCulture}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Milho">Milho</SelectItem>
                      <SelectItem value="Feijão">Feijão</SelectItem>
                      <SelectItem value="Mandioca">Mandioca</SelectItem>
                      <SelectItem value="Soja">Soja</SelectItem>
                      <SelectItem value="Amendoim">Amendoim</SelectItem>
                      <SelectItem value="Batata Doce">Batata Doce</SelectItem>
                      <SelectItem value="Massango">Massango</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input placeholder="-12.0000" value={formLat} onChange={(e) => setFormLat(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input placeholder="14.0000" value={formLon} onChange={(e) => setFormLon(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea placeholder="Informações adicionais..." rows={3} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
              </div>
              <Button onClick={handleSubmit}>Registar Parcela</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Parcelas" value={String(parcels.length)} change="Registadas no sistema" icon={Layers} />
        <StatCard title="Área Total" value={`${totalArea.toFixed(1)} ha`} change="Hectares georreferenciados" changeType="positive" icon={Maximize2} iconBg="hsl(var(--success) / 0.15)" />
        <StatCard title="Verificadas" value={String(totalVerificadas)} change={parcels.length > 0 ? `${Math.round(totalVerificadas / parcels.length * 100)}% do total` : "—"} changeType="positive" icon={MapPin} iconBg="hsl(var(--info) / 0.15)" />
        <StatCard title="Culturas" value={String(cultures.length)} change="Tipos de cultura" changeType="neutral" icon={Layers} iconBg="hsl(var(--warning) / 0.15)" />
      </div>

      {/* Map */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Map className="h-4 w-4" /> Mapa de Parcelas</h2>
          <Button variant="outline" size="sm" onClick={() => setShowMap(!showMap)}>{showMap ? "Ocultar Mapa" : "Mostrar Mapa"}</Button>
        </div>
        {showMap && <ParcelasMap parcelas={mapData} />}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por produtor, cultura..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="verificada">Verificada</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="rejeitada">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {isError ? (
          <Card><ErrorState onRetry={() => refetch()} /></Card>
        ) : (
        <Card className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produtor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cultura</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Área</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Coordenadas</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableRowsSkeleton rows={6} cols={6} />
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={6} className="p-0"><EmptyState size="sm" icon={MapPin} /></td></tr>
                ) : paginated.map((p: any) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.parcel_code}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{p.farmers?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.farmer_code} · {p.farmers?.province || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{p.culture}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{p.area}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{p.lat && p.lon ? `${p.lat}, ${p.lon}` : "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={
                        p.status === "Verificada" ? "badge-active" :
                        p.status === "Pendente" ? "badge-pending" : "badge-suspended"
                      }>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              <CardListSkeleton count={5} />
            ) : paginated.length === 0 ? (
              <EmptyState size="sm" icon={MapPin} />
            ) : paginated.map((p: any) => (
              <div key={p.id} className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">{p.farmers?.full_name || "—"}</p>
                  <span className={`text-[10px] flex-shrink-0 ${
                    p.status === "Verificada" ? "badge-active" :
                    p.status === "Pendente" ? "badge-pending" : "badge-suspended"
                  }`}>{p.status}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{p.parcel_code}</span>
                  <span>•</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{p.culture}</span>
                  <span>•</span>
                  <span className="font-semibold text-foreground">{p.area}</span>
                </div>
                {p.lat && p.lon && (
                  <p className="text-[10px] text-muted-foreground font-mono">{p.lat}, {p.lon}</p>
                )}
              </div>
            ))}
          </div>

          <div className="px-4 md:px-6 py-3 border-t border-border flex items-center justify-between text-xs md:text-sm text-muted-foreground">
            <span>{filtered.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} parcelas</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium">{page} / {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>
        )}
      </motion.div>
    </div>
  );
};

export default Parcelas;
