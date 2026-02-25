import { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart3, TrendingUp, DollarSign, ShoppingCart, Users, Printer,
  Calendar, Filter, FileText, Package, CreditCard, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
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
  line_total: number;
  sale_id: string;
}

interface Supplier {
  id: string;
  name: string;
  nif: string | null;
  province: string | null;
}

const COLORS = [
  "hsl(142, 70%, 45%)", "hsl(45, 90%, 50%)", "hsl(200, 80%, 50%)",
  "hsl(350, 70%, 55%)", "hsl(270, 60%, 55%)", "hsl(30, 80%, 55%)",
  "hsl(170, 60%, 45%)", "hsl(320, 60%, 55%)",
];

const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const Mosap3PayRelatorios = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear().toString());
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [salesRes, suppliersRes] = await Promise.all([
        supabase.from("pos_sales").select("*").order("created_at", { ascending: true }),
        supabase.from("suppliers").select("id, name, nif, province").order("name"),
      ]);
      const allSales = (salesRes.data as Sale[]) || [];
      setSales(allSales);
      setSuppliers(suppliersRes.data || []);

      // Fetch all sale items
      const saleIds = allSales.map(s => s.id);
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from("pos_sale_items")
          .select("product_name, quantity, unit_price, iva_amount, line_total, sale_id")
          .in("sale_id", saleIds);
        setSaleItems((items as SaleItem[]) || []);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter sales
  const filtered = useMemo(() => {
    return sales.filter(s => {
      const year = new Date(s.created_at).getFullYear().toString();
      if (year !== filterYear) return false;
      if (filterSupplier !== "all" && s.supplier_id !== filterSupplier) return false;
      return true;
    });
  }, [sales, filterSupplier, filterYear]);

  // Available years
  const years = useMemo(() => {
    const set = new Set(sales.map(s => new Date(s.created_at).getFullYear()));
    if (set.size === 0) set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [sales]);

  // KPIs
  const totalRevenue = filtered.reduce((s, sale) => s + Number(sale.total), 0);
  const totalIVA = filtered.reduce((s, sale) => s + Number(sale.iva_total), 0);
  const totalSubtotal = filtered.reduce((s, sale) => s + Number(sale.subtotal), 0);
  const paidCount = filtered.filter(s => s.payment_status === "pago").length;
  const pendingCount = filtered.filter(s => s.payment_status === "pendente").length;
  const uniqueFarmers = new Set(filtered.map(s => s.farmer_code)).size;
  const avgTicket = filtered.length > 0 ? totalRevenue / filtered.length : 0;

  // Monthly revenue chart data
  const monthlyData = useMemo(() => {
    const map = new Map<number, { revenue: number; iva: number; count: number }>();
    for (let i = 0; i < 12; i++) map.set(i, { revenue: 0, iva: 0, count: 0 });
    for (const sale of filtered) {
      const month = new Date(sale.created_at).getMonth();
      const cur = map.get(month)!;
      cur.revenue += Number(sale.total);
      cur.iva += Number(sale.iva_total);
      cur.count++;
    }
    return Array.from(map.entries()).map(([month, data]) => ({
      month: MONTHS_PT[month],
      receita: Math.round(data.revenue),
      iva: Math.round(data.iva),
      vendas: data.count,
    }));
  }, [filtered]);

  // Payment method distribution
  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of filtered) {
      const method = sale.payment_method === "unitel_money" ? "Unitel Money" : sale.payment_method;
      map.set(method, (map.get(method) || 0) + Number(sale.total));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [filtered]);

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

  // Revenue by supplier
  const supplierRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of filtered) {
      const supplier = suppliers.find(s => s.id === sale.supplier_id);
      const name = supplier?.name || "Desconhecido";
      map.set(name, (map.get(name) || 0) + Number(sale.total));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
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

  // IVA summary by rate (from items)
  const ivaSummary = useMemo(() => {
    const filteredIds = new Set(filtered.map(s => s.id));
    let totalBase = 0;
    let totalIvaCalc = 0;
    for (const item of saleItems) {
      if (!filteredIds.has(item.sale_id)) continue;
      totalBase += Number(item.unit_price) * Number(item.quantity);
      totalIvaCalc += Number(item.iva_amount);
    }
    return { base: totalBase, iva: totalIvaCalc, total: totalBase + totalIvaCalc };
  }, [filtered, saleItems]);

  const handlePrint = () => {
    window.print();
  };

  const supplierName = filterSupplier !== "all" 
    ? suppliers.find(s => s.id === filterSupplier)?.name || ""
    : "Todos os Fornecedores";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - hidden in print */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Relatório de Vendas
          </h1>
          <p className="text-muted-foreground text-sm">Análise de receita, IVA e desempenho por fornecedor</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[100px]">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Fornecedores</SelectItem>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Imprimir PDF
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <div className="text-center border-b pb-4 mb-4">
          <h1 className="text-2xl font-bold">MOSAP3Pay — Relatório de Vendas</h1>
          <p className="text-lg">{supplierName} • Ano {filterYear}</p>
          <p className="text-sm text-muted-foreground">
            Gerado em {new Date().toLocaleDateString("pt-AO")} às {new Date().toLocaleTimeString("pt-AO")}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Receita Total</span>
            </div>
            <p className="text-xl font-bold">{totalRevenue.toLocaleString("pt-AO")} Kz</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">IVA Total</span>
            </div>
            <p className="text-xl font-bold">{totalIVA.toLocaleString("pt-AO")} Kz</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Vendas</span>
            </div>
            <p className="text-xl font-bold">{filtered.length}</p>
            <div className="flex gap-1 mt-1">
              <Badge variant="default" className="text-[9px]">{paidCount} pagos</Badge>
              {pendingCount > 0 && <Badge variant="secondary" className="text-[9px]">{pendingCount} pend.</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Produtores</span>
            </div>
            <p className="text-xl font-bold">{uniqueFarmers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Ticket Médio</span>
            </div>
            <p className="text-xl font-bold">{avgTicket.toLocaleString("pt-AO", { maximumFractionDigits: 0 })} Kz</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Subtotal (s/ IVA)</span>
            </div>
            <p className="text-xl font-bold">{totalSubtotal.toLocaleString("pt-AO")} Kz</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Monthly Revenue + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Receita Mensal ({filterYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString("pt-AO")} Kz`,
                    name === "receita" ? "Receita" : name === "iva" ? "IVA" : "Vendas",
                  ]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Legend formatter={v => v === "receita" ? "Receita" : "IVA"} />
                <Bar dataKey="receita" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="iva" fill="hsl(45, 90%, 50%)" radius={[4, 4, 0, 0]} />
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
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString("pt-AO")} Kz`, "Total"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Revenue by Supplier + Volume trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filterSupplier === "all" && supplierRevenue.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Receita por Fornecedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={supplierRevenue} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString("pt-AO")} Kz`, "Receita"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Bar dataKey="value" fill="hsl(142, 70%, 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className={filterSupplier === "all" && supplierRevenue.length > 0 ? "" : "lg:col-span-2"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Volume de Vendas Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [value, "Vendas"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Line type="monotone" dataKey="vendas" stroke="hsl(200, 80%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables: Top Products + Top Farmers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 Produtos</CardTitle>
          </CardHeader>
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
                        <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: COLORS[i % COLORS.length], color: "#fff" }}>
                          {i + 1}
                        </span>
                        {p.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">{p.qty}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{p.revenue.toLocaleString("pt-AO")} Kz</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 Produtores</CardTitle>
          </CardHeader>
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
                      <div>
                        <p className="font-medium">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">{f.code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{f.count}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{f.total.toLocaleString("pt-AO")} Kz</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* IVA Summary for AGT */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Resumo IVA para AGT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Base Tributável</p>
              <p className="text-xl font-bold">{ivaSummary.base.toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">IVA Liquidado</p>
              <p className="text-xl font-bold">{ivaSummary.iva.toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Total c/ IVA</p>
              <p className="text-xl font-bold">{ivaSummary.total.toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Período</p>
              <p className="text-xl font-bold">{filterYear}</p>
              <p className="text-xs text-muted-foreground">{filtered.length} facturas emitidas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print-only: timestamp */}
      <div className="hidden print:block text-center text-xs text-muted-foreground mt-8 border-t pt-4">
        <p>MOSAP3Pay — Sistema de Gestão de Incentivos e Agronegócio</p>
        <p>Relatório gerado automaticamente • {new Date().toLocaleString("pt-AO")}</p>
      </div>
    </div>
  );
};

export default Mosap3PayRelatorios;
