import { useState, useEffect } from "react";
import { Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle, RotateCcw, Search, Plus, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  price: number;
  unit: string;
  supplier_id: string;
  status: string;
}

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference_id: string | null;
  created_at: string;
  created_by: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

const MOVEMENT_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  entrada: { label: "Entrada", color: "text-primary", icon: ArrowUpCircle },
  saida: { label: "Saída", color: "text-destructive", icon: ArrowDownCircle },
  ajuste: { label: "Ajuste", color: "text-amber-600", icon: RotateCcw },
  venda: { label: "Venda", color: "text-blue-600", icon: ArrowDownCircle },
  devolucao: { label: "Devolução", color: "text-primary", icon: ArrowUpCircle },
};

const Mosap3PayStock = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [search, setSearch] = useState("");

  // Movement dialog
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveProduct, setMoveProduct] = useState<Product | null>(null);
  const [moveType, setMoveType] = useState<string>("entrada");
  const [moveQty, setMoveQty] = useState(0);
  const [moveReason, setMoveReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [productMovements, setProductMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, supRes, movRes] = await Promise.all([
      supabase.from("supplier_products").select("id, name, category, stock, min_stock, price, unit, supplier_id, status").order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setProducts((prodRes.data as Product[]) || []);
    setSuppliers(supRes.data || []);
    setMovements((movRes.data as StockMovement[]) || []);
    setLoading(false);
  };

  const filtered = products.filter(p => {
    if (filterSupplier !== "all" && p.supplier_id !== filterSupplier) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const lowStockProducts = filtered.filter(p => p.stock <= p.min_stock && p.status === "Ativo");
  const outOfStock = filtered.filter(p => p.stock === 0 && p.status === "Ativo");

  const openMovement = (product: Product, type: string) => {
    setMoveProduct(product);
    setMoveType(type);
    setMoveQty(0);
    setMoveReason("");
    setMoveOpen(true);
  };

  const openHistory = async (product: Product) => {
    setHistoryProduct(product);
    const { data } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setProductMovements((data as StockMovement[]) || []);
    setHistoryOpen(true);
  };

  const submitMovement = async () => {
    if (!moveProduct || moveQty <= 0) {
      toast.error("Indique uma quantidade válida");
      return;
    }

    const isOut = moveType === "saida";
    if (isOut && moveQty > moveProduct.stock) {
      toast.error("Quantidade excede o stock disponível");
      return;
    }

    setSubmitting(true);
    try {
      const prevStock = moveProduct.stock;
      const newStock = isOut ? prevStock - moveQty : prevStock + moveQty;

      // Update product stock
      await supabase.from("supplier_products").update({ stock: newStock }).eq("id", moveProduct.id);

      // Record movement
      await supabase.from("stock_movements").insert({
        supplier_id: moveProduct.supplier_id,
        product_id: moveProduct.id,
        movement_type: moveType,
        quantity: moveQty,
        previous_stock: prevStock,
        new_stock: newStock,
        reason: moveReason.trim() || null,
        created_by: user?.id,
      });

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        user_name: user?.email,
        action: "stock_movement",
        entity_type: "supplier_product",
        entity_id: moveProduct.id,
        details: { product: moveProduct.name, type: moveType, quantity: moveQty, prev: prevStock, new: newStock },
      });

      toast.success(`Stock de ${moveProduct.name} actualizado: ${prevStock} → ${newStock}`);
      setMoveOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Gestão de Stock
          </h1>
          <p className="text-muted-foreground text-sm">Movimentos, alertas e histórico de inventário</p>
        </div>
      </div>

      {/* Alerts */}
      {lowStockProducts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" /> Alertas de Stock Baixo ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(p => (
                <Badge key={p.id} variant="outline" className="border-amber-500/30 text-amber-700 gap-1">
                  {p.stock === 0 ? "🔴" : "🟡"} {p.name}: {p.stock}/{p.min_stock} {p.unit}
                  <span className="text-[10px] text-muted-foreground ml-1">({getSupplierName(p.supplier_id)})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Produtos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{filtered.reduce((s, p) => s + p.stock, 0)}</p>
          <p className="text-xs text-muted-foreground">Stock Total</p>
        </CardContent></Card>
        <Card className={outOfStock.length > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${outOfStock.length > 0 ? "text-destructive" : ""}`}>{outOfStock.length}</p>
            <p className="text-xs text-muted-foreground">Sem Stock</p>
          </CardContent>
        </Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{movements.length}</p>
          <p className="text-xs text-muted-foreground">Movimentos Recentes</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-center">Mín.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem produtos</TableCell></TableRow>
              ) : filtered.map(p => {
                const isLow = p.stock <= p.min_stock && p.stock > 0;
                const isOut = p.stock === 0;
                return (
                  <TableRow key={p.id} className={isOut ? "bg-destructive/5" : isLow ? "bg-amber-500/5" : ""}>
                    <TableCell>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.category} • {Number(p.price).toLocaleString("pt-AO")} Kz/{p.unit}</p>
                    </TableCell>
                    <TableCell className="text-sm">{getSupplierName(p.supplier_id)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold text-lg ${isOut ? "text-destructive" : isLow ? "text-amber-600" : ""}`}>
                        {p.stock}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{p.unit}</span>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{p.min_stock}</TableCell>
                    <TableCell>
                      {isOut ? <Badge variant="destructive" className="text-[10px]">Esgotado</Badge>
                        : isLow ? <Badge variant="secondary" className="text-[10px] border-amber-500/30">Baixo</Badge>
                        : <Badge variant="outline" className="text-[10px]">OK</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openMovement(p, "entrada")}>
                        <ArrowUpCircle className="h-3 w-3 mr-1 text-primary" /> Entrada
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openMovement(p, "saida")}>
                        <ArrowDownCircle className="h-3 w-3 mr-1 text-destructive" /> Saída
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openHistory(p)}>
                        <History className="h-3 w-3 mr-1" /> Hist.
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Movement Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {moveType === "entrada" ? <ArrowUpCircle className="h-5 w-5 text-primary" /> : <ArrowDownCircle className="h-5 w-5 text-destructive" />}
              {moveType === "entrada" ? "Entrada de Stock" : "Saída de Stock"}
            </DialogTitle>
          </DialogHeader>
          {moveProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-semibold">{moveProduct.name}</p>
                <p className="text-sm text-muted-foreground">Stock actual: <span className="font-bold">{moveProduct.stock} {moveProduct.unit}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min={1} max={moveType === "saida" ? moveProduct.stock : 99999} value={moveQty || ""} onChange={e => setMoveQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Textarea placeholder="Ex: Reabastecimento, inventário..." value={moveReason} onChange={e => setMoveReason(e.target.value)} rows={2} />
              </div>
              {moveQty > 0 && (
                <div className="p-3 bg-primary/5 rounded-lg text-sm">
                  <p>Stock: <span className="font-bold">{moveProduct.stock}</span> → <span className="font-bold">{moveType === "saida" ? moveProduct.stock - moveQty : moveProduct.stock + moveQty}</span> {moveProduct.unit}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
            <Button onClick={submitMovement} disabled={submitting || moveQty <= 0} className="gap-2">
              {moveType === "entrada" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico — {historyProduct?.name}</DialogTitle>
          </DialogHeader>
          {productMovements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem movimentos registados</p>
          ) : (
            <div className="space-y-2">
              {productMovements.map(m => {
                const meta = MOVEMENT_LABELS[m.movement_type] || MOVEMENT_LABELS.ajuste;
                const Icon = meta.icon;
                return (
                  <div key={m.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Icon className={`h-5 w-5 mt-0.5 ${meta.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-AO")}</span>
                      </div>
                      <p className="text-sm mt-1">
                        <span className="font-bold">{m.movement_type === "saida" || m.movement_type === "venda" ? "-" : "+"}{m.quantity}</span>
                        <span className="text-muted-foreground ml-2">(Stock: {m.previous_stock} → {m.new_stock})</span>
                      </p>
                      {m.reason && <p className="text-xs text-muted-foreground mt-1">{m.reason}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayStock;
