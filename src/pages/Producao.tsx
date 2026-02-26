import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Wheat, Sprout, TrendingUp, Calendar, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

const Producao = () => {
  const [search, setSearch] = useState("");
  const [cultureFilter, setCultureFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Form state
  const [formFarmer, setFormFarmer] = useState("");
  const [formCulture, setFormCulture] = useState("");
  const [formPlanted, setFormPlanted] = useState("");
  const [formExpected, setFormExpected] = useState("");
  const [formEstimate, setFormEstimate] = useState("");
  const [formArea, setFormArea] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: production = [], isLoading } = useQuery({
    queryKey: ["farmer_production"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farmer_production")
        .select("*, farmers!farmer_production_farmer_code_fkey(full_name, province)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: farmersList = [] } = useQuery({
    queryKey: ["farmers_list_select"],
    queryFn: async () => {
      const { data } = await supabase.from("farmers").select("code, full_name").order("full_name");
      return data || [];
    },
  });

  useEffect(() => { setPage(1); }, [search, cultureFilter, statusFilter]);

  const filtered = production.filter((p: any) => {
    const name = p.farmers?.full_name || "";
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      p.production_code.toLowerCase().includes(search.toLowerCase()) ||
      p.culture.toLowerCase().includes(search.toLowerCase());
    const matchesCulture = cultureFilter === "all" || p.culture.toLowerCase() === cultureFilter;
    const matchesStatus = statusFilter === "all" || p.status.toLowerCase().replace(/\s/g, "") === statusFilter;
    return matchesSearch && matchesCulture && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalColhida = production.filter((p: any) => p.status === "Colhida").length;
  const totalCrescimento = production.filter((p: any) => p.status === "Em Crescimento").length;
  const cultures = [...new Set(production.map((p: any) => p.culture))];

  // Chart data
  const cultureMap = new Map<string, { estimada: number; real: number }>();
  production.forEach((p: any) => {
    const est = parseFloat((p.estimated_yield || "0").replace(/\./g, "").replace(",", ".")) || 0;
    const act = parseFloat((p.actual_yield || "0").replace(/\./g, "").replace(",", ".")) || 0;
    const prev = cultureMap.get(p.culture) || { estimada: 0, real: 0 };
    cultureMap.set(p.culture, { estimada: prev.estimada + est, real: prev.real + act });
  });
  const chartData = Array.from(cultureMap.entries()).map(([name, v]) => ({ name, ...v }));

  const handleSubmit = async () => {
    if (!formFarmer || !formCulture) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const code = `PRD-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("farmer_production").insert({
      production_code: code,
      farmer_code: formFarmer,
      culture: formCulture,
      planted_date: formPlanted || null,
      expected_harvest: formExpected || null,
      estimated_yield: formEstimate || null,
      area: formArea ? formArea + " ha" : null,
    });
    if (error) { toast({ title: "Erro ao registar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Produção registada com sucesso" });
    queryClient.invalidateQueries({ queryKey: ["farmer_production"] });
    setDialogOpen(false);
    setFormFarmer(""); setFormCulture(""); setFormPlanted(""); setFormExpected(""); setFormEstimate(""); setFormArea(""); setFormNotes("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Gestão da Produção</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhamento do ciclo produtivo por cultura e parcela</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Produção</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">Registar Produção</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produtor</Label>
                  <Select value={formFarmer} onValueChange={setFormFarmer}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {farmersList.map((f: any) => (
                        <SelectItem key={f.code} value={f.code}>{f.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="Massango">Massango</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Plantio</Label>
                  <Input type="date" value={formPlanted} onChange={(e) => setFormPlanted(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Área (ha)</Label>
                  <Input placeholder="0.0" type="number" step="0.1" value={formArea} onChange={(e) => setFormArea(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produção Estimada (kg)</Label>
                  <Input placeholder="0" value={formEstimate} onChange={(e) => setFormEstimate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Prevista Colheita</Label>
                  <Input type="date" value={formExpected} onChange={(e) => setFormExpected(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleSubmit}>Registar Produção</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Registos" value={String(production.length)} change="Registados no sistema" icon={Wheat} />
        <StatCard title="Colhidas" value={String(totalColhida)} change={production.length > 0 ? `${Math.round(totalColhida / production.length * 100)}% concluídas` : "—"} changeType="positive" icon={Sprout} iconBg="hsl(var(--success) / 0.15)" />
        <StatCard title="Em Crescimento" value={String(totalCrescimento)} change="Monitorização activa" changeType="neutral" icon={TrendingUp} iconBg="hsl(var(--warning) / 0.15)" />
        <StatCard title="Culturas" value={String(cultures.length)} change="Tipos registados" changeType="positive" icon={Calendar} iconBg="hsl(var(--info) / 0.15)" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6">
            <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-6">
              Produção Estimada vs Real por Cultura (kg)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="estimada" name="Estimada" fill="hsl(130, 55%, 30%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="real" name="Real" fill="hsl(45, 95%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por produtor, cultura..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={cultureFilter} onValueChange={setCultureFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Cultura" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {cultures.map((c: string) => (
                <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="semeada">Semeada</SelectItem>
              <SelectItem value="emcrescimento">Em Crescimento</SelectItem>
              <SelectItem value="colhida">Colhida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produtor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cultura</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Área</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Plantio</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Est. (kg)</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Real (kg)</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">Nenhum registo de produção encontrado</td></tr>
                ) : paginated.map((p: any) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.production_code}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{p.farmers?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.farmer_code} · {p.farmers?.province || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{p.culture}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{p.area || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.planted_date || "—"}</td>
                    <td className="px-4 py-3 text-right">{p.estimated_yield || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{p.actual_yield || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={
                        p.status === "Colhida" ? "badge-active" :
                        p.status === "Em Crescimento" ? "badge-pending" : "badge-suspended"
                      }>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>A mostrar {filtered.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} registos</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium">{page} / {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Producao;
