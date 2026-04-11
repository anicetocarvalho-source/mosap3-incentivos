import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import BatchDistributionDialog from "@/components/incentivos/BatchDistributionDialog";
import { Plus, Search, Gift, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, TrendingUp, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ITEMS_PER_PAGE = 10;
const formatKz = (value: number) => `${value.toLocaleString("pt-AO")} Kz`;

const Incentivos = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Form state
  const [formFarmer, setFormFarmer] = useState("");
  const [formType, setFormType] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState("Unitel Money");

  const { data: incentives = [], isLoading } = useQuery({
    queryKey: ["farmer_incentives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farmer_incentives")
        .select("*, farmers!farmer_incentives_farmer_code_fkey(full_name, phone, province, school)")
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

  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter]);

  const filtered = incentives.filter((inc: any) => {
    const name = inc.farmers?.full_name || "";
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || inc.incentive_code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || inc.status.toLowerCase() === statusFilter;
    const matchesType = typeFilter === "all" || inc.type.toLowerCase().replace(/\s/g, "") === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Stats
  const parseAmount = (a: string) => parseFloat(a.replace(/\./g, "").replace(",", ".")) || 0;
  const totalDistribuido = incentives.reduce((sum: number, i: any) => sum + parseAmount(i.amount), 0);
  const totalGasto = incentives.filter((i: any) => i.status === "Pago").reduce((sum: number, i: any) => sum + parseAmount(i.amount), 0);
  const totalRemanescente = totalDistribuido - totalGasto;
  const totalPendente = incentives.filter((i: any) => i.status === "Pendente" || i.status === "Processando").length;

  // Charts
  const provinciaMap = new Map<string, number>();
  incentives.filter((i: any) => i.status === "Pago").forEach((i: any) => {
    const prov = i.farmers?.province || "Desconhecida";
    provinciaMap.set(prov, (provinciaMap.get(prov) || 0) + parseAmount(i.amount));
  });
  const provinciaData = Array.from(provinciaMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const ecaMap = new Map<string, number>();
  incentives.filter((i: any) => i.status === "Pago").forEach((i: any) => {
    const eca = i.farmers?.school || "Sem Escola";
    ecaMap.set(eca, (ecaMap.get(eca) || 0) + parseAmount(i.amount));
  });
  const ecaData = Array.from(ecaMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const topEca = ecaData[0];

  const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(280 65% 60%)", "hsl(200 80% 50%)"];

  const handleSubmit = async () => {
    if (!formFarmer || !formType || !formAmount) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    const code = `INC-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("farmer_incentives").insert({
      incentive_code: code,
      farmer_code: formFarmer,
      type: formType,
      amount: formAmount,
      method: formMethod,
      incentive_date: new Date().toLocaleDateString("pt-AO"),
    });
    if (error) { toast({ title: "Erro ao registar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Incentivo registado com sucesso" });
    queryClient.invalidateQueries({ queryKey: ["farmer_incentives"] });
    setDialogOpen(false);
    setFormFarmer(""); setFormType(""); setFormAmount("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Gestão de Incentivos</h1>
          <p className="text-muted-foreground text-sm mt-1">Distribuição e acompanhamento de incentivos via Unitel Money</p>
        </div>
        <div className="flex items-center gap-2">
          <BatchDistributionDialog />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Incentivo</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">Registar Incentivo</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Agricultor</Label>
                <Select value={formFarmer} onValueChange={setFormFarmer}>
                  <SelectTrigger><SelectValue placeholder="Selecionar agricultor" /></SelectTrigger>
                  <SelectContent>
                    {farmersList.map((f: any) => (
                      <SelectItem key={f.code} value={f.code}>{f.full_name} ({f.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                  <Label>Valor (Kz)</Label>
                  <Input placeholder="0.00" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
                </div>
              <Button onClick={handleSubmit}>Registar Incentivo</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Distribuído" value={formatKz(totalDistribuido)} change="Todos os incentivos" icon={Gift} />
        <StatCard title="Total Gasto" value={formatKz(totalGasto)} change={totalDistribuido > 0 ? `${Math.round(totalGasto / totalDistribuido * 100)}% do total` : "—"} changeType="positive" icon={CheckCircle2} iconBg="hsl(var(--success) / 0.15)" />
        <StatCard title="Total Remanescente" value={formatKz(totalRemanescente)} change={totalDistribuido > 0 ? `${Math.round(totalRemanescente / totalDistribuido * 100)}% por utilizar` : "—"} changeType="neutral" icon={Clock} iconBg="hsl(var(--warning) / 0.15)" />
        <StatCard title="Pendentes" value={String(totalPendente)} change="Aguardando processamento" changeType="negative" icon={XCircle} iconBg="hsl(var(--destructive) / 0.15)" />
      </div>

      {topEca && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ECA com maior gasto em incentivos</p>
                <p className="text-lg font-bold">{topEca.name}</p>
              </div>
              <Badge className="ml-auto text-base px-4 py-1">{formatKz(topEca.value)}</Badge>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Chart */}
      {provinciaData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Gastos por Província
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={provinciaData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                <Tooltip formatter={(value: number) => formatKz(value)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Total Gasto">
                  {provinciaData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por agricultor ou código..." className="pl-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Agricultor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Província</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Nenhum incentivo encontrado</td></tr>
                ) : paginated.map((inc: any) => (
                  <tr key={inc.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{inc.incentive_code}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{inc.farmers?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{inc.farmers?.phone || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{inc.type}</td>
                    <td className="px-4 py-3 font-semibold">{inc.amount} Kz</td>
                    <td className="px-4 py-3 text-muted-foreground">{inc.farmers?.province || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={
                        inc.status === "Pago" ? "badge-active" :
                        inc.status === "Pendente" || inc.status === "Processando" ? "badge-pending" : "badge-suspended"
                      }>{inc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inc.incentive_date || new Date(inc.created_at).toLocaleDateString("pt-AO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum incentivo encontrado</div>
            ) : paginated.map((inc: any) => (
              <div key={inc.id} className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">{inc.farmers?.full_name || "—"}</p>
                  <span className={`text-[10px] flex-shrink-0 ${
                    inc.status === "Pago" ? "badge-active" :
                    inc.status === "Pendente" || inc.status === "Processando" ? "badge-pending" : "badge-suspended"
                  }`}>{inc.status}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{inc.incentive_code}</span>
                  <span>•</span>
                  <span>{inc.type}</span>
                  <span>•</span>
                  <span className="font-semibold text-foreground">{inc.amount} Kz</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{inc.farmers?.province || "—"}</span>
                  <span>•</span>
                  <span>{inc.incentive_date || new Date(inc.created_at).toLocaleDateString("pt-AO")}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 md:px-6 py-3 border-t border-border flex items-center justify-between text-xs md:text-sm text-muted-foreground">
            <span>{filtered.length > 0 ? (page - 1) * ITEMS_PER_PAGE + 1 : 0}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
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

export default Incentivos;
