import { motion } from "framer-motion";
import { Plus, Building2, MapPin, Phone, Mail, ArrowLeft, ShoppingCart, TrendingUp, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Supplier {
  id: string;
  name: string;
  nif: string | null;
  province: string | null;
  municipality: string | null;
  phone: string | null;
  email: string | null;
  status: string;
}

interface Sale {
  id: string;
  sale_code: string;
  farmer_name: string;
  farmer_code: string;
  subtotal: number;
  iva_total: number;
  total: number;
  payment_status: string;
  created_at: string;
}

interface SaleItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

const ITEMS_PER_PAGE = 5;
const formatKz = (value: number) => `${value.toLocaleString("pt-AO")} Kz`;

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(200 80% 50%)",
];

const Empresas = () => {
  const [search, setSearch] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [vendaPage, setVendaPage] = useState(1);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data } = await supabase.from("suppliers").select("id, name, nif, province, municipality, phone, email, status").order("name");
      setSuppliers(data || []);
      setLoading(false);
    };
    fetchSuppliers();
  }, []);

  const fetchSupplierDetail = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSalesLoading(true);
    setVendaPage(1);
    const [salesRes, prodRes] = await Promise.all([
      supabase.from("pos_sales").select("id, sale_code, farmer_name, farmer_code, subtotal, iva_total, total, payment_status, created_at").eq("supplier_id", supplier.id).order("created_at", { ascending: false }),
      supabase.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id),
    ]);
    setSales(salesRes.data || []);
    setProductCount(prodRes.count || 0);
    setSalesLoading(false);
  };

  const filtered = suppliers.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.province || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.nif || "").includes(search)
  );

  // Detail view
  if (selectedSupplier) {
    const totalVendas = sales.reduce((s, v) => s + Number(v.total), 0);
    const totalEntregue = sales.filter(v => v.payment_status === "pago").reduce((s, v) => s + Number(v.total), 0);
    const totalPendente = totalVendas - totalEntregue;

    const totalVendaPages = Math.ceil(sales.length / ITEMS_PER_PAGE);
    const paginatedVendas = sales.slice((vendaPage - 1) * ITEMS_PER_PAGE, vendaPage * ITEMS_PER_PAGE);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedSupplier(null); setVendaPage(1); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="page-title">{selectedSupplier.name}</h1>
              <Badge variant={selectedSupplier.status === "Ativo" ? "default" : selectedSupplier.status === "Pendente" ? "secondary" : "outline"}>
                {selectedSupplier.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
              {selectedSupplier.municipality && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedSupplier.municipality}{selectedSupplier.province ? `, ${selectedSupplier.province}` : ""}</span>}
              {selectedSupplier.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selectedSupplier.phone}</span>}
              {selectedSupplier.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{selectedSupplier.email}</span>}
              {selectedSupplier.nif && <span>NIF: {selectedSupplier.nif}</span>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Vendas</p>
            <p className="text-2xl font-bold">{formatKz(totalVendas)}</p>
            <p className="text-xs text-muted-foreground mt-1">{sales.length} transacções</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Pago</p>
            <p className="text-2xl font-bold text-primary">{formatKz(totalEntregue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{sales.filter(v => v.payment_status === "pago").length} pagas</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-2xl font-bold">{formatKz(totalPendente)}</p>
            <p className="text-xs text-muted-foreground mt-1">{sales.filter(v => v.payment_status === "pendente").length} pendentes</p>
          </CardContent></Card>
        </div>

        {/* Vendas list */}
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-3 border-b border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Lista de Vendas
            </h3>
          </div>
          {salesLoading ? (
            <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : sales.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma venda registada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Código</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Agricultor</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Total</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVendas.map((v) => (
                      <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{v.sale_code}</td>
                        <td className="px-4 py-3 font-medium">{v.farmer_name}</td>
                        <td className="px-4 py-3 font-semibold">{formatKz(Number(v.total))}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(v.created_at).toLocaleDateString("pt-AO")}</td>
                        <td className="px-4 py-3">
                          <Badge variant={v.payment_status === "pago" ? "default" : "outline"} className="text-[10px]">{v.payment_status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalVendaPages > 1 && (
                <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                  <span>A mostrar {(vendaPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(vendaPage * ITEMS_PER_PAGE, sales.length)} de {sales.length}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={vendaPage <= 1} onClick={() => setVendaPage(vendaPage - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">{vendaPage} / {totalVendaPages}</span>
                    <Button variant="outline" size="sm" disabled={vendaPage >= totalVendaPages} onClick={() => setVendaPage(vendaPage + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de empresas fornecedoras e parceiras</p>
        </div>
      </div>

      <div className="max-w-sm">
        <Input placeholder="Pesquisar empresas..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((empresa, i) => (
            <motion.div key={empresa.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => fetchSupplierDetail(empresa)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-sm leading-tight">{empresa.name}</h3>
                      {empresa.nif && <p className="text-xs text-muted-foreground">NIF: {empresa.nif}</p>}
                    </div>
                  </div>
                  <Badge variant={empresa.status === "Ativo" ? "default" : empresa.status === "Pendente" ? "secondary" : "outline"} className="shrink-0">
                    {empresa.status}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-sm">
                  {empresa.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{empresa.phone}</span>
                    </div>
                  )}
                  {empresa.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{empresa.email}</span>
                    </div>
                  )}
                  {empresa.province && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{empresa.municipality ? `${empresa.municipality}, ` : ""}{empresa.province}</span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Empresas;
