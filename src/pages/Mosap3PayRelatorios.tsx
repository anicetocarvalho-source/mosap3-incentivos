import { useState, useEffect, useMemo } from "react";
import {
  BarChart3, TrendingUp, DollarSign, ShoppingCart, Users, Printer,
  Calendar, Filter, FileText, Package, CreditCard, Download,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from "recharts";

interface Sale {
  id: string;
  supplier_id: string;
  farmer_code: string;
  farmer_name: string;
  subtotal: number;
  iva_total: number;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

interface SaleItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  iva_amount: number;
  iva_rate: number;
  line_total: number;
  sale_id: string;
}

interface CreditNote {
  id: string;
  supplier_id: string;
  subtotal: number;
  iva_total: number;
  total: number;
  status: string;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
  nif: string | null;
  province: string | null;
}

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--info))",
  "hsl(var(--destructive))", "hsl(var(--accent-foreground))", "hsl(var(--warning))",
  "hsl(var(--success))", "hsl(var(--muted-foreground))",
];

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const QUARTERS = [
  { label: "Ano Completo", value: "all", months: [0,1,2,3,4,5,6,7,8,9,10,11] },
  { label: "T1 (Jan-Mar)", value: "q1", months: [0,1,2] },
  { label: "T2 (Abr-Jun)", value: "q2", months: [3,4,5] },
  { label: "T3 (Jul-Set)", value: "q3", months: [6,7,8] },
  { label: "T4 (Out-Dez)", value: "q4", months: [9,10,11] },
];

const Mosap3PayRelatorios = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear().toString());
  const [filterQuarter, setFilterQuarter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [salesRes, suppliersRes, cnRes] = await Promise.all([
        supabase.from("pos_sales").select("*").order("created_at", { ascending: true }),
        supabase.from("suppliers").select("id, name, nif, province").order("name"),
        supabase.from("credit_notes").select("id, supplier_id, subtotal, iva_total, total, status, created_at").order("created_at"),
      ]);
      const allSales = (salesRes.data as Sale[]) || [];
      setSales(allSales);
      setSuppliers(suppliersRes.data || []);
      setCreditNotes((cnRes.data as CreditNote[]) || []);

      const saleIds = allSales.map(s => s.id);
      if (saleIds.length > 0) {
        // Fetch in batches to avoid 1000 row limit
        const allItems: SaleItem[] = [];
        for (let i = 0; i < saleIds.length; i += 500) {
          const batch = saleIds.slice(i, i + 500);
          const { data: items } = await supabase
            .from("pos_sale_items")
            .select("product_name, quantity, unit_price, iva_amount, iva_rate, line_total, sale_id")
            .in("sale_id", batch);
          if (items) allItems.push(...(items as SaleItem[]));
        }
        setSaleItems(allItems);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const quarterMonths = QUARTERS.find(q => q.value === filterQuarter)?.months || [];

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.created_at);
      if (d.getFullYear().toString() !== filterYear) return false;
      if (filterQuarter !== "all" && !quarterMonths.includes(d.getMonth())) return false;
      if (filterSupplier !== "all" && s.supplier_id !== filterSupplier) return false;
      return true;
    });
  }, [sales, filterSupplier, filterYear, filterQuarter, quarterMonths]);

  const filteredCN = useMemo(() => {
    return creditNotes.filter(cn => {
      const d = new Date(cn.created_at);
      if (d.getFullYear().toString() !== filterYear) return false;
      if (filterQuarter !== "all" && !quarterMonths.includes(d.getMonth())) return false;
      if (filterSupplier !== "all" && cn.supplier_id !== filterSupplier) return false;
      return cn.status === "emitida";
    });
  }, [creditNotes, filterSupplier, filterYear, filterQuarter, quarterMonths]);

  // Previous period for comparison
  const prevFiltered = useMemo(() => {
    const prevYear = (parseInt(filterYear) - 1).toString();
    return sales.filter(s => {
      const d = new Date(s.created_at);
      if (d.getFullYear().toString() !== prevYear) return false;
      if (filterQuarter !== "all" && !quarterMonths.includes(d.getMonth())) return false;
      if (filterSupplier !== "all" && s.supplier_id !== filterSupplier) return false;
      return true;
    });
  }, [sales, filterSupplier, filterYear, filterQuarter, quarterMonths]);

  const years = useMemo(() => {
    const set = new Set(sales.map(s => new Date(s.created_at).getFullYear()));
    if (set.size === 0) set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [sales]);

  // KPIs
  const totalRevenue = filtered.reduce((s, sale) => s + Number(sale.total), 0);
  const totalIVA = filtered.reduce((s, sale) => s + Number(sale.iva_total), 0);
  const totalSubtotal = filtered.reduce((s, sale) => s + Number(sale.subtotal), 0);
  const prevRevenue = prevFiltered.reduce((s, sale) => s + Number(sale.total), 0);
  const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const paidCount = filtered.filter(s => s.payment_status === "pago").length;
  const pendingCount = filtered.filter(s => s.payment_status === "pendente").length;
  const uniqueFarmers = new Set(filtered.map(s => s.farmer_code)).size;
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0;
  const totalCNValue = filteredCN.reduce((s, cn) => s + Number(cn.total), 0);
  const totalCNIva = filteredCN.reduce((s, cn) => s + Number(cn.iva_total), 0);
  const netRevenue = totalRevenue - totalCNValue;

  // Monthly data
  const monthlyData = useMemo(() => {
    const months = filterQuarter === "all" ? Array.from({ length: 12 }, (_, i) => i) : quarterMonths;
    const map = new Map<number, { revenue: number; iva: number; count: number; cn: number }>();
    months.forEach(i => map.set(i, { revenue: 0, iva: 0, count: 0, cn: 0 }));
    for (const sale of filtered) {
      const month = new Date(sale.created_at).getMonth();
      const cur = map.get(month);
      if (cur) { cur.revenue += Number(sale.total); cur.iva += Number(sale.iva_total); cur.count++; }
    }
    for (const cn of filteredCN) {
      const month = new Date(cn.created_at).getMonth();
      const cur = map.get(month);
      if (cur) cur.cn += Number(cn.total);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([month, data]) => ({
      month: MONTHS_PT[month],
      receita: Math.round(data.revenue),
      iva: Math.round(data.iva),
      vendas: data.count,
      nc: Math.round(data.cn),
      liquido: Math.round(data.revenue - data.cn),
    }));
  }, [filtered, filteredCN, filterQuarter, quarterMonths]);

  // Payment method distribution
  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of filtered) {
      const method = sale.payment_method === "unitel_money" ? "Unitel Money" : sale.payment_method === "saldo_incentivo" ? "Saldo Incentivo" : sale.payment_method;
      map.set(method, (map.get(method) || 0) + Number(sale.total));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [filtered]);

  // Category distribution (from items)
  const categoryData = useMemo(() => {
    const filteredIds = new Set(filtered.map(s => s.id));
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const item of saleItems) {
      if (!filteredIds.has(item.sale_id)) continue;
      // Use product_name first word as category proxy
      const name = item.product_name;
      const cur = map.get(name) || { qty: 0, revenue: 0 };
      cur.qty += Number(item.quantity);
      cur.revenue += Number(item.line_total);
      map.set(name, cur);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filtered, saleItems]);

  // IVA by rate
  const ivaByRate = useMemo(() => {
    const filteredIds = new Set(filtered.map(s => s.id));
    const map = new Map<number, { base: number; iva: number; count: number }>();
    for (const item of saleItems) {
      if (!filteredIds.has(item.sale_id)) continue;
      const rate = Number(item.iva_rate) || 14;
      const cur = map.get(rate) || { base: 0, iva: 0, count: 0 };
      cur.base += Number(item.unit_price) * Number(item.quantity);
      cur.iva += Number(item.iva_amount);
      cur.count++;
      map.set(rate, cur);
    }
    return Array.from(map.entries())
      .map(([rate, data]) => ({ rate, ...data, total: data.base + data.iva }))
      .sort((a, b) => b.base - a.base);
  }, [filtered, saleItems]);

  // Top products
  const topProducts = useMemo(() => {
    const filteredIds = new Set(filtered.map(s => s.id));
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const item of saleItems) {
      if (!filteredIds.has(item.sale_id)) continue;
      const cur = map.get(item.product_name) || { qty: 0, revenue: 0 };
      cur.qty += Number(item.quantity);
      cur.revenue += Number(item.line_total);
      map.set(item.product_name, cur);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filtered, saleItems]);

  // Supplier revenue
  const supplierRevenue = useMemo(() => {
    const map = new Map<string, { revenue: number; iva: number; count: number }>();
    for (const sale of filtered) {
      const supplier = suppliers.find(s => s.id === sale.supplier_id);
      const name = supplier?.name || "Desconhecido";
      const cur = map.get(name) || { revenue: 0, iva: 0, count: 0 };
      cur.revenue += Number(sale.total);
      cur.iva += Number(sale.iva_total);
      cur.count++;
      map.set(name, cur);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, suppliers]);

  // Top farmers
  const topFarmers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const sale of filtered) {
      const cur = map.get(sale.farmer_code) || { name: sale.farmer_name, total: 0, count: 0 };
      cur.total += Number(sale.total);
      cur.count++;
      map.set(sale.farmer_code, cur);
    }
    return Array.from(map.entries())
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filtered]);

  const handlePrint = () => window.print();

  const exportCSV = () => {
    const headers = ["Data", "Factura", "Fornecedor", "Produtor", "Código", "Subtotal", "IVA", "Total", "Pagamento", "Estado"];
    const rows = filtered.map(s => [
      new Date(s.created_at).toLocaleDateString("pt-AO"),
      s.id.slice(0, 8),
      suppliers.find(sup => sup.id === s.supplier_id)?.name || "",
      s.farmer_name,
      s.farmer_code,
      Number(s.subtotal).toFixed(2),
      Number(s.iva_total).toFixed(2),
      Number(s.total).toFixed(2),
      s.payment_method,
      s.payment_status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas_${filterYear}_${filterQuarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado para CSV");
  };

  const supplierLabel = filterSupplier !== "all"
    ? suppliers.find(s => s.id === filterSupplier)?.name || ""
    : "Todos os Fornecedores";
  const periodLabel = QUARTERS.find(q => q.value === filterQuarter)?.label || "Ano Completo";

  const fmtKz = (v: number) => v.toLocaleString("pt-AO", { maximumFractionDigits: 2 }) + " Kz";
  const GrowthBadge = ({ value }: { value: number }) => (
    <Badge variant="outline" className={`text-[9px] gap-0.5 ${value >= 0 ? "text-primary border-primary/30" : "text-destructive border-destructive/30"}`}>
      {value >= 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(value).toFixed(1)}% vs {parseInt(filterYear) - 1}
    </Badge>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Relatórios Avançados
          </h1>
          <p className="text-muted-foreground text-sm">Análise de receita, IVA, categorias e conformidade AGT</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[100px]"><Calendar className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterQuarter} onValueChange={setFilterQuarter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUARTERS.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="w-[180px]"><Filter className="h-4 w-4 mr-1" /><SelectValue placeholder="Fornecedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Fornecedores</SelectItem>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1" onClick={exportCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <div className="text-center border-b pb-4 mb-4">
          <h1 className="text-2xl font-bold">MOSAP3Pay — Relatório de Vendas</h1>
          <p className="text-lg">{supplierLabel} • {periodLabel} {filterYear}</p>
          <p className="text-sm text-muted-foreground">Gerado em {new Date().toLocaleString("pt-AO")}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">Receita Bruta</span>
            </div>
            <p className="text-lg font-bold">{fmtKz(totalRevenue)}</p>
            {prevRevenue > 0 && <GrowthBadge value={revenueGrowth} />}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">Notas de Crédito</span>
            </div>
            <p className="text-lg font-bold text-destructive">-{fmtKz(totalCNValue)}</p>
            <span className="text-[9px] text-muted-foreground">{filteredCN.length} NC emitidas</span>
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">Receita Líquida</span>
            </div>
            <p className="text-lg font-bold">{fmtKz(netRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">IVA Liquidado</span>
            </div>
            <p className="text-lg font-bold">{fmtKz(totalIVA)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">Vendas</span>
            </div>
            <p className="text-lg font-bold">{filtered.length}</p>
            <div className="flex gap-1">
              <Badge variant="default" className="text-[8px]">{paidCount} pagos</Badge>
              {pendingCount > 0 && <Badge variant="secondary" className="text-[8px]">{pendingCount} pend.</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">Produtores</span>
            </div>
            <p className="text-lg font-bold">{uniqueFarmers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">Ticket Médio</span>
            </div>
            <p className="text-lg font-bold">{fmtKz(avgTicket)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList className="print:hidden">
          <TabsTrigger value="charts" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Gráficos</TabsTrigger>
          <TabsTrigger value="rankings" className="gap-1"><TrendingUp className="h-3.5 w-3.5" /> Rankings</TabsTrigger>
          <TabsTrigger value="agt" className="gap-1"><FileText className="h-3.5 w-3.5" /> Resumo AGT</TabsTrigger>
        </TabsList>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-4">
          {/* Revenue + NC monthly */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Receita vs Notas de Crédito ({periodLabel} {filterYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        fmtKz(value),
                        name === "receita" ? "Receita" : name === "nc" ? "Notas Crédito" : name === "liquido" ? "Líquido" : "IVA",
                      ]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Legend formatter={v => v === "receita" ? "Receita" : v === "nc" ? "NC" : v === "liquido" ? "Líquido" : "IVA"} />
                    <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="nc" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="iva" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Métodos de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => [fmtKz(value), "Total"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-12">Sem dados</p>}
              </CardContent>
            </Card>
          </div>

          {/* Volume trend + Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Receita Líquida Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => [fmtKz(value), "Líquido"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="liquido" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Receita por Produto (Top 8)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={(value: number) => [fmtKz(value), "Receita"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-12">Sem dados</p>}
              </CardContent>
            </Card>
          </div>

          {/* Supplier revenue */}
          {filterSupplier === "all" && supplierRevenue.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Receita por Fornecedor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, supplierRevenue.length * 45)}>
                  <BarChart data={supplierRevenue} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip formatter={(value: number) => [fmtKz(value), "Receita"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rankings Tab */}
        <TabsContent value="rankings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 Produtos</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Produto</TableHead>
                      <TableHead className="text-xs text-right">Qtd</TableHead>
                      <TableHead className="text-xs text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                    ) : topProducts.map((p, i) => (
                      <TableRow key={p.name}>
                        <TableCell className="text-sm">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</span>
                            {p.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">{p.qty}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{fmtKz(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 Produtores</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Produtor</TableHead>
                      <TableHead className="text-xs text-right">Compras</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topFarmers.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                    ) : topFarmers.map((f, i) => (
                      <TableRow key={f.code}>
                        <TableCell className="text-sm">
                          <p className="font-medium">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground">{f.code}</p>
                        </TableCell>
                        <TableCell className="text-right text-sm">{f.count}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{fmtKz(f.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Supplier table */}
            {supplierRevenue.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Receita por Fornecedor</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Fornecedor</TableHead>
                        <TableHead className="text-xs text-right">Vendas</TableHead>
                        <TableHead className="text-xs text-right">Receita</TableHead>
                        <TableHead className="text-xs text-right">IVA</TableHead>
                        <TableHead className="text-xs text-right">% Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierRevenue.map(s => (
                        <TableRow key={s.name}>
                          <TableCell className="text-sm font-medium">{s.name}</TableCell>
                          <TableCell className="text-right text-sm">{s.count}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{fmtKz(s.revenue)}</TableCell>
                          <TableCell className="text-right text-sm">{fmtKz(s.iva)}</TableCell>
                          <TableCell className="text-right text-sm">{totalRevenue > 0 ? ((s.revenue / totalRevenue) * 100).toFixed(1) : 0}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* AGT Tab */}
        <TabsContent value="agt" className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Declaração Periódica de IVA — {periodLabel} {filterYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* IVA by rate table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Taxa IVA</TableHead>
                    <TableHead className="text-xs text-right">Nº Itens</TableHead>
                    <TableHead className="text-xs text-right">Base Tributável</TableHead>
                    <TableHead className="text-xs text-right">IVA Liquidado</TableHead>
                    <TableHead className="text-xs text-right">Total c/ IVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ivaByRate.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                  ) : (
                    <>
                      {ivaByRate.map(row => (
                        <TableRow key={row.rate}>
                          <TableCell className="font-semibold">{row.rate}%</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right">{fmtKz(row.base)}</TableCell>
                          <TableCell className="text-right">{fmtKz(row.iva)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtKz(row.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{ivaByRate.reduce((s, r) => s + r.count, 0)}</TableCell>
                        <TableCell className="text-right">{fmtKz(ivaByRate.reduce((s, r) => s + r.base, 0))}</TableCell>
                        <TableCell className="text-right">{fmtKz(ivaByRate.reduce((s, r) => s + r.iva, 0))}</TableCell>
                        <TableCell className="text-right">{fmtKz(ivaByRate.reduce((s, r) => s + r.total, 0))}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>

              <Separator />

              {/* Summary grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Base Tributável</p>
                  <p className="text-lg font-bold">{fmtKz(totalSubtotal)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">IVA Liquidado</p>
                  <p className="text-lg font-bold">{fmtKz(totalIVA)}</p>
                </div>
                <div className="p-4 bg-destructive/5 rounded-lg text-center border border-destructive/20">
                  <p className="text-[10px] text-muted-foreground mb-1">IVA em NC (dedução)</p>
                  <p className="text-lg font-bold text-destructive">-{fmtKz(totalCNIva)}</p>
                  <p className="text-[9px] text-muted-foreground">{filteredCN.length} NC</p>
                </div>
                <div className="p-4 bg-primary/5 rounded-lg text-center border border-primary/20">
                  <p className="text-[10px] text-muted-foreground mb-1">IVA a Entregar</p>
                  <p className="text-lg font-bold text-primary">{fmtKz(Math.max(0, totalIVA - totalCNIva))}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">Período</p>
                  <p className="text-lg font-bold">{periodLabel}</p>
                  <p className="text-[9px] text-muted-foreground">{filtered.length} facturas</p>
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground p-3 bg-muted/30 rounded-lg">
                <p className="font-semibold mb-1">Notas:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>O IVA a entregar à AGT é calculado como IVA Liquidado menos IVA regularizado em Notas de Crédito</li>
                  <li>As Notas de Crédito (série NC) com estado "emitida" são deduzidas automaticamente</li>
                  <li>Este resumo pode ser exportado via CSV ou impresso como PDF oficial</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Print footer */}
      <div className="hidden print:block text-center text-xs text-muted-foreground mt-8 border-t pt-4">
        <p>MOSAP3Pay — Sistema de Gestão de Incentivos e Agronegócio</p>
        <p>Relatório gerado automaticamente • {new Date().toLocaleString("pt-AO")}</p>
      </div>
    </div>
  );
};

export default Mosap3PayRelatorios;
