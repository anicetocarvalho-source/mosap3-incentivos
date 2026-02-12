import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Gift, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, TrendingUp, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

const incentivesData = [
  { id: "INC-001", farmer: "João Mateus", farmerId: "AGR-001", phone: "923 456 789", type: "Insumos Agrícolas", amount: 45000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "12/02/2026", empresa: "AgroTech Lda", provincia: "Benguela", escola: "EC Caimbambo" },
  { id: "INC-002", farmer: "Maria Silva", farmerId: "AGR-002", phone: "924 567 890", type: "Sementes", amount: 30000, campaign: "2025/2026", method: "Unitel Money", status: "Pendente", date: "11/02/2026", empresa: "SemAngola", provincia: "Benguela", escola: "EC Caimbambo" },
  { id: "INC-003", farmer: "Pedro Neto", farmerId: "AGR-003", phone: "925 678 901", type: "Mecanização", amount: 60000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "10/02/2026", empresa: "MecaField", provincia: "Huambo", escola: "EC Longonjo" },
  { id: "INC-004", farmer: "Ana Luísa Gomes", farmerId: "AGR-004", phone: "926 789 012", type: "Fertilizantes", amount: 25000, campaign: "2025/2026", method: "Unitel Money", status: "Processando", date: "09/02/2026", empresa: "FertilSul", provincia: "Huíla", escola: "EC Lubango" },
  { id: "INC-005", farmer: "Carlos Manuel", farmerId: "AGR-005", phone: "927 890 123", type: "Insumos Agrícolas", amount: 40000, campaign: "2025/2026", method: "Unitel Money", status: "Rejeitado", date: "08/02/2026", empresa: "AgroTech Lda", provincia: "Bié", escola: "EC Cuemba" },
  { id: "INC-006", farmer: "Teresa Domingos", farmerId: "AGR-006", phone: "928 901 234", type: "Sementes", amount: 35000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "07/02/2026", empresa: "SemAngola", provincia: "Benguela", escola: "EC Lobito" },
  { id: "INC-007", farmer: "Francisco Luís", farmerId: "AGR-007", phone: "929 012 345", type: "Fertilizantes", amount: 28000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "06/02/2026", empresa: "FertilSul", provincia: "Malanje", escola: "EC Cacuso" },
  { id: "INC-008", farmer: "Isabel Fernandes", farmerId: "AGR-008", phone: "930 123 456", type: "Mecanização", amount: 55000, campaign: "2025/2026", method: "Unitel Money", status: "Pendente", date: "05/02/2026", empresa: "MecaField", provincia: "Huambo", escola: "EC Longonjo" },
  { id: "INC-009", farmer: "Domingos Campos", farmerId: "AGR-040", phone: "931 234 567", type: "Insumos Agrícolas", amount: 38000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "04/02/2026", empresa: "AgroTech Lda", provincia: "Bié", escola: "EC Cuemba" },
  { id: "INC-010", farmer: "Jorge Caetano", farmerId: "AGR-050", phone: "932 345 678", type: "Sementes", amount: 32000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "03/02/2026", empresa: "SemAngola", provincia: "Huíla", escola: "EC Lubango" },
  { id: "INC-011", farmer: "Alberto Nascimento", farmerId: "AGR-060", phone: "933 456 789", type: "Fertilizantes", amount: 22000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "02/02/2026", empresa: "FertilSul", provincia: "Malanje", escola: "EC Cacuso" },
  { id: "INC-012", farmer: "Rosa Mateus", farmerId: "AGR-011", phone: "934 567 890", type: "Insumos Agrícolas", amount: 48000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "01/02/2026", empresa: "AgroTech Lda", provincia: "Huambo", escola: "EC Longonjo" },
  { id: "INC-013", farmer: "Pedro Gaspar", farmerId: "AGR-010", phone: "935 678 901", type: "Mecanização", amount: 65000, campaign: "2025/2026", method: "Unitel Money", status: "Pendente", date: "31/01/2026", empresa: "MecaField", provincia: "Huambo", escola: "EC Longonjo" },
  { id: "INC-014", farmer: "Carlos Mendes", farmerId: "AGR-020", phone: "936 789 012", type: "Sementes", amount: 27000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "30/01/2026", empresa: "SemAngola", provincia: "Benguela", escola: "EC Lobito" },
  { id: "INC-015", farmer: "Luísa Bernardo", farmerId: "AGR-021", phone: "937 890 123", type: "Fertilizantes", amount: 31000, campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "29/01/2026", empresa: "FertilSul", provincia: "Benguela", escola: "EC Lobito" },
];

const ITEMS_PER_PAGE = 8;

const formatKz = (value: number) => `${value.toLocaleString("pt-AO")} Kz`;

const Incentivos = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = incentivesData.filter((inc) => {
    const matchesSearch = inc.farmer.toLowerCase().includes(search.toLowerCase()) || inc.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || inc.status.toLowerCase() === statusFilter;
    const matchesType = typeFilter === "all" || inc.type.toLowerCase().replace(/\s/g, "") === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Stats
  const totalDistribuido = incentivesData.reduce((sum, i) => sum + i.amount, 0);
  const totalGasto = incentivesData.filter(i => i.status === "Pago").reduce((sum, i) => sum + i.amount, 0);
  const totalRemanescente = totalDistribuido - totalGasto;
  const totalPendente = incentivesData.filter(i => i.status === "Pendente" || i.status === "Processando").length;

  // Chart: vendas por empresa
  const empresaMap = new Map<string, number>();
  incentivesData.filter(i => i.status === "Pago").forEach(i => {
    empresaMap.set(i.empresa, (empresaMap.get(i.empresa) || 0) + i.amount);
  });
  const empresaData = Array.from(empresaMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Chart: vendas por província
  const provinciaMap = new Map<string, number>();
  incentivesData.filter(i => i.status === "Pago").forEach(i => {
    provinciaMap.set(i.provincia, (provinciaMap.get(i.provincia) || 0) + i.amount);
  });
  const provinciaData = Array.from(provinciaMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ECA que mais gastou
  const ecaMap = new Map<string, number>();
  incentivesData.filter(i => i.status === "Pago").forEach(i => {
    ecaMap.set(i.escola, (ecaMap.get(i.escola) || 0) + i.amount);
  });
  const ecaData = Array.from(ecaMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const topEca = ecaData[0];

  const CHART_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(142 71% 45%)",
    "hsl(38 92% 50%)",
    "hsl(280 65% 60%)",
    "hsl(200 80% 50%)",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Gestão de Incentivos</h1>
          <p className="text-muted-foreground text-sm mt-1">Distribuição e acompanhamento de incentivos via Unitel Money</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Incentivo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Registar Incentivo</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Agricultor</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecionar agricultor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agr-001">João Mateus (AGR-001)</SelectItem>
                    <SelectItem value="agr-002">Maria Silva (AGR-002)</SelectItem>
                    <SelectItem value="agr-003">Pedro Neto (AGR-003)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Incentivo</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insumos">Insumos Agrícolas</SelectItem>
                      <SelectItem value="sementes">Sementes</SelectItem>
                      <SelectItem value="fertilizantes">Fertilizantes</SelectItem>
                      <SelectItem value="mecanizacao">Mecanização</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor (Kz)</Label>
                  <Input placeholder="0.00" type="number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campanha</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Campanha" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025-2026">2025/2026</SelectItem>
                      <SelectItem value="2024-2025">2024/2025</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Método de Pagamento</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unitel">Unitel Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => setDialogOpen(false)}>Registar Incentivo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Distribuído" value={formatKz(totalDistribuido)} change="Campanha 2025/2026" icon={Gift} />
        <StatCard title="Total Gasto" value={formatKz(totalGasto)} change={`${Math.round(totalGasto / totalDistribuido * 100)}% do total distribuído`} changeType="positive" icon={CheckCircle2} iconBg="hsl(var(--success) / 0.15)" />
        <StatCard title="Total Remanescente" value={formatKz(totalRemanescente)} change={`${Math.round(totalRemanescente / totalDistribuido * 100)}% por utilizar`} changeType="neutral" icon={Clock} iconBg="hsl(var(--warning) / 0.15)" />
        <StatCard title="Pendentes / Rejeitados" value={`${totalPendente} / 1`} change="Aguardando processamento" changeType="negative" icon={XCircle} iconBg="hsl(var(--destructive) / 0.15)" />
      </div>

      {/* ECA destaque */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por Empresa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Gastos por Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={empresaData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                <Tooltip formatter={(value: number) => formatKz(value)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Total Gasto">
                  {empresaData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Por Província */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Gastos por Província
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={provinciaData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
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
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por agricultor ou ID..."
              className="pl-10"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="insumosagrícolas">Insumos Agrícolas</SelectItem>
              <SelectItem value="sementes">Sementes</SelectItem>
              <SelectItem value="fertilizantes">Fertilizantes</SelectItem>
              <SelectItem value="mecanização">Mecanização</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Agricultor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Província</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((inc) => (
                  <tr key={inc.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{inc.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{inc.farmer}</p>
                        <p className="text-xs text-muted-foreground">{inc.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{inc.type}</td>
                    <td className="px-4 py-3 font-semibold">{formatKz(inc.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inc.empresa}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inc.provincia}</td>
                    <td className="px-4 py-3">
                      <span className={
                        inc.status === "Pago" ? "badge-active" :
                        inc.status === "Pendente" || inc.status === "Processando" ? "badge-pending" : "badge-suspended"
                      }>{inc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inc.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>A mostrar {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} incentivos</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{page} / {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Incentivos;
