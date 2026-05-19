import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Package,
  Loader2,
  FileDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

const fmtKz = (n: number) =>
  new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString().slice(0, 10);
};

const PRESETS: Record<string, () => { start: string; end: string }> = {
  "7d": () => ({ start: daysAgoISO(6), end: todayISO() }),
  "30d": () => ({ start: daysAgoISO(29), end: todayISO() }),
  "90d": () => ({ start: daysAgoISO(89), end: todayISO() }),
  mtd: () => {
    const d = new Date();
    return { start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10), end: todayISO() };
  },
  ytd: () => ({ start: `${new Date().getFullYear()}-01-01`, end: todayISO() }),
};

const Mosap3PayPainelVendas = () => {
  const [preset, setPreset] = useState("30d");
  const [start, setStart] = useState(PRESETS["30d"]().start);
  const [end, setEnd] = useState(PRESETS["30d"]().end);
  const [supplierId, setSupplierId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (preset !== "custom") {
      const r = PRESETS[preset]();
      setStart(r.start); setEnd(r.end);
    }
  }, [preset]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["pv-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const range = useMemo(() => {
    const s = `${start}T00:00:00`;
    const e = `${end}T23:59:59`;
    return { s, e };
  }, [start, end]);

  const salesQuery = useQuery({
    queryKey: ["pv-sales", range.s, range.e, supplierId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("pos_sales")
        .select("id, supplier_id, created_at, subtotal, iva_total, total, payment_status")
        .gte("created_at", range.s)
        .lte("created_at", range.e)
        .order("created_at", { ascending: true })
        .limit(10000);
      if (supplierId !== "all") q = q.eq("supplier_id", supplierId);
      if (statusFilter !== "all") q = q.eq("payment_status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["pv-items", range.s, range.e, supplierId, statusFilter],
    enabled: !!salesQuery.data,
    queryFn: async () => {
      const ids = (salesQuery.data || []).map((s) => s.id);
      if (!ids.length) return [];
      // chunk to avoid URL length issues
      const out: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data, error } = await supabase
          .from("pos_sale_items")
          .select("product_name, quantity, line_total, sale_id")
          .in("sale_id", chunk);
        if (error) throw error;
        out.push(...(data || []));
      }
      return out;
    },
  });

  const sales = salesQuery.data || [];
  const items = itemsQuery.data || [];

  const kpis = useMemo(() => {
    const totalVendido = sales.reduce((s, x) => s + Number(x.total || 0), 0);
    const totalIva = sales.reduce((s, x) => s + Number(x.iva_total || 0), 0);
    const totalSubtotal = sales.reduce((s, x) => s + Number(x.subtotal || 0), 0);
    const nVendas = sales.length;
    const ticketMedio = nVendas ? totalVendido / nVendas : 0;
    return { totalVendido, totalIva, totalSubtotal, nVendas, ticketMedio };
  }, [sales]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, { date: string; total: number; iva: number; count: number }>();
    for (const s of sales) {
      const d = String(s.created_at).slice(0, 10);
      const prev = map.get(d) || { date: d, total: 0, iva: 0, count: 0 };
      prev.total += Number(s.total || 0);
      prev.iva += Number(s.iva_total || 0);
      prev.count += 1;
      map.set(d, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of items) {
      const k = it.product_name || "—";
      const prev = map.get(k) || { name: k, qty: 0, revenue: 0 };
      prev.qty += Number(it.quantity || 0);
      prev.revenue += Number(it.line_total || 0);
      map.set(k, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [items]);

  const topSuppliers = useMemo(() => {
    const map = new Map<string, { id: string; total: number; count: number }>();
    for (const s of sales) {
      const k = s.supplier_id;
      const prev = map.get(k) || { id: k, total: 0, count: 0 };
      prev.total += Number(s.total || 0);
      prev.count += 1;
      map.set(k, prev);
    }
    const nameById = new Map(suppliers.map((x: any) => [x.id, x.name]));
    return Array.from(map.values())
      .map((x) => ({ ...x, name: nameById.get(x.id) || "—" }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [sales, suppliers]);

  const exportCSV = () => {
    const rows = [
      ["Data", "Vendas", "Subtotal", "IVA", "Total"],
      ...dailySeries.map((d) => [d.date, String(d.count), fmtKz((d as any).total - d.iva), fmtKz(d.iva), fmtKz(d.total)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `painel-vendas_${start}_${end}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const loading = salesQuery.isLoading || itemsQuery.isLoading;
  const error = salesQuery.error || itemsQuery.error;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Painel de Vendas</h1>
            <p className="text-sm text-muted-foreground">
              Análise de vendas com filtros por fornecedor e período
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!sales.length}>
          <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label>Período</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="mtd">Mês actual</SelectItem>
                <SelectItem value="ytd">Ano actual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data Início</Label>
            <Input type="date" value={start} onChange={(e) => { setStart(e.target.value); setPreset("custom"); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Data Fim</Label>
            <Input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setPreset("custom"); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {suppliers.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado pagamento</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState title="Erro ao carregar dados" description={(error as Error).message} />
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Total Vendido" value={`${fmtKz(kpis.totalVendido)} Kz`} />
            <KpiCard icon={<Receipt className="h-5 w-5" />} label="IVA Total" value={`${fmtKz(kpis.totalIva)} Kz`} />
            <KpiCard icon={<ShoppingCart className="h-5 w-5" />} label="N.º Vendas" value={String(kpis.nVendas)} />
            <KpiCard icon={<Package className="h-5 w-5" />} label="Subtotal" value={`${fmtKz(kpis.totalSubtotal)} Kz`} />
            <KpiCard icon={<BarChart3 className="h-5 w-5" />} label="Ticket Médio" value={`${fmtKz(kpis.ticketMedio)} Kz`} />
          </div>

          {/* Trend */}
          <Card>
            <CardHeader><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader>
            <CardContent>
              {dailySeries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período seleccionado.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${fmtKz(Number(v))} Kz`} />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} name="Total" dot={false} />
                    <Line type="monotone" dataKey="iva" stroke="hsl(var(--warning))" strokeWidth={2} name="IVA" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 produtos mais vendidos</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem itens.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                        <Tooltip formatter={(v: any) => `${fmtKz(Number(v))} Kz`} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Receita (Kz)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topProducts.map((p) => (
                            <TableRow key={p.name}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="text-right">{p.qty}</TableCell>
                              <TableCell className="text-right">{fmtKz(p.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Top Suppliers */}
            <Card>
              <CardHeader><CardTitle className="text-base">Fornecedores por receita</CardTitle></CardHeader>
              <CardContent>
                {topSuppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                        <TableHead className="text-right">Total (Kz)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topSuppliers.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{s.count}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{fmtKz(s.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const KpiCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold mt-2 break-words">{value}</p>
    </CardContent>
  </Card>
);

export default Mosap3PayPainelVendas;
