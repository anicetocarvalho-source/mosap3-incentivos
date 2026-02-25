import { useState, useEffect } from "react";
import { ShoppingCart, Search, Filter, Eye, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

interface Sale {
  id: string;
  sale_code: string;
  supplier_id: string;
  farmer_code: string;
  farmer_name: string;
  patec_number: number | null;
  subtotal: number;
  iva_total: number;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  iva_amount: number;
  line_total: number;
}

const Mosap3PayVendas = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("pos_sales")
        .select("*")
        .order("created_at", { ascending: false });
      setSales((data as Sale[]) || []);
      setLoading(false);
    };
    fetchSales();
  }, []);

  const openDetail = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data } = await supabase
      .from("pos_sale_items")
      .select("*")
      .eq("sale_id", sale.id);
    setSaleItems((data as SaleItem[]) || []);
  };

  const filtered = sales.filter((s) => {
    const matchSearch = s.farmer_name.toLowerCase().includes(search.toLowerCase()) ||
      s.sale_code.toLowerCase().includes(search.toLowerCase()) ||
      s.farmer_code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || s.payment_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.total), 0);
  const totalPending = filtered.filter((s) => s.payment_status === "pendente").reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" /> Histórico de Vendas
        </h1>
        <p className="text-muted-foreground text-sm">Todas as transações MOSAP3Pay</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{filtered.length}</p><p className="text-xs text-muted-foreground">Total Vendas</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{totalRevenue.toLocaleString("pt-AO")} Kz</p><p className="text-xs text-muted-foreground">Receita Total</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{filtered.filter((s) => s.payment_status === "pago").length}</p><p className="text-xs text-muted-foreground">Pagos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{totalPending.toLocaleString("pt-AO")} Kz</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome, código de venda ou código do produtor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Produtor</TableHead>
                <TableHead>PATEC</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</TableCell></TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.sale_code}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{s.farmer_name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.farmer_code}</p>
                  </TableCell>
                  <TableCell>{s.patec_number ? <Badge variant="outline" className="text-[10px]">PATEC {s.patec_number}</Badge> : "—"}</TableCell>
                  <TableCell className="font-bold">{Number(s.total).toLocaleString("pt-AO")} Kz</TableCell>
                  <TableCell className="text-xs">{s.payment_method === "unitel_money" ? "Unitel Money" : s.payment_method}</TableCell>
                  <TableCell>
                    <Badge variant={s.payment_status === "pago" ? "default" : s.payment_status === "pendente" ? "secondary" : "destructive"} className="text-[10px]">
                      {s.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-AO")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openDetail(s)}>
                      <Eye className="h-3 w-3 mr-1" /> Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(o) => !o && setSelectedSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Venda {selectedSale?.sale_code}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{selectedSale.farmer_name}</p>
                <p className="text-xs text-muted-foreground">{selectedSale.farmer_code} • {selectedSale.patec_number ? `PATEC ${selectedSale.patec_number}` : "—"}</p>
                <p className="text-xs text-muted-foreground">{new Date(selectedSale.created_at).toLocaleString("pt-AO")}</p>
              </div>

              <div className="space-y-2">
                {saleItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{item.product_name}</span>
                      <span className="text-muted-foreground"> × {item.quantity}</span>
                    </div>
                    <span>{Number(item.line_total).toLocaleString("pt-AO")} Kz</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{Number(selectedSale.subtotal).toLocaleString("pt-AO")} Kz</span></div>
                <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>{Number(selectedSale.iva_total).toLocaleString("pt-AO")} Kz</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{Number(selectedSale.total).toLocaleString("pt-AO")} Kz</span></div>
              </div>

              <div className="flex justify-between items-center">
                <Badge variant={selectedSale.payment_status === "pago" ? "default" : "secondary"}>
                  {selectedSale.payment_status}
                </Badge>
                <span className="text-xs text-muted-foreground">{selectedSale.payment_method === "unitel_money" ? "Unitel Money" : selectedSale.payment_method}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayVendas;
