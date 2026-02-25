import { useState, useEffect } from "react";
import { Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle, RotateCcw, Search, History, Edit2, TrendingDown, TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  supplier_id: string;
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
  ajuste: { label: "Ajuste", color: "text-warning", icon: RotateCcw },
  venda: { label: "Venda", color: "text-info", icon: ArrowDownCircle },
  devolucao: { label: "Devolução", color: "text-primary", icon: ArrowUpCircle },
};

const Mosap3PayStock = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [movSearch, setMovSearch] = useState("");
  const [movFilterType, setMovFilterType] = useState("all");

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

  // Edit min_stock dialog
  const [editMinOpen, setEditMinOpen] = useState(false);
  const [editMinProduct, setEditMinProduct] = useState<Product | null>(null);
  const [editMinValue, setEditMinValue] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, supRes, movRes] = await Promise.all([
      supabase.from("supplier_products").select("id, name, category, stock, min_stock, price, unit, supplier_id, status").order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setProducts((prodRes.data as Product[]) || []);
    setSuppliers(supRes.data || []);
    setMovements((movRes.data as StockMovement[]) || []);
    setLoading(false);
  };

  const filtered = products.filter(p => {
    if (filterSupplier !== "all" && p.supplier_id !== filterSupplier) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus === "low" && !(p.stock <= p.min_stock && p.stock > 0)) return false;
    if (filterStatus === "out" && p.stock !== 0) return false;
    if (filterStatus === "ok" && p.stock <= p.min_stock) return false;
    return true;
  });

  const activeProducts = products.filter(p => p.status === "Ativo");
  const lowStockProducts = activeProducts.filter(p => p.stock <= p.min_stock && p.stock > 0);
  const outOfStock = activeProducts.filter(p => p.stock === 0);
  const totalStockValue = activeProducts.reduce((s, p) => s + p.stock * Number(p.price), 0);

  const filteredMovements = movements.filter(m => {
    if (movFilterType !== "all" && m.movement_type !== movFilterType) return false;
    if (movSearch) {
      const product = products.find(p => p.id === m.product_id);
      return product?.name.toLowerCase().includes(movSearch.toLowerCase());
    }
    return true;
  });

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || "—";
  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || "—";

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

  const openEditMin = (product: Product) => {
    setEditMinProduct(product);
    setEditMinValue(product.min_stock);
    setEditMinOpen(true);
  };

  const saveMinStock = async () => {
    if (!editMinProduct) return;
    setSubmitting(true);
    try {
      await supabase.from("supplier_products").update({ min_stock: editMinValue }).eq("id", editMinProduct.id);
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        user_name: user?.email,
        action: "update",
        entity_type: "supplier_product",
        entity_id: editMinProduct.id,
        details: { product: editMinProduct.name, field: "min_stock", old: editMinProduct.min_stock, new: editMinValue },
      });
      toast.success(`Stock mínimo de ${editMinProduct.name} actualizado para ${editMinValue}`);
      setEditMinOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitMovement = async () => {
    if (!moveProduct || moveQty <= 0) {
      toast.error("Indique uma quantidade válida");
      return;
    }

    const isOut = moveType === "saida" || moveType === "venda";
    if (isOut && moveQty > moveProduct.stock) {
      toast.error("Quantidade excede o stock disponível");
      return;
    }

    setSubmitting(true);
    try {
      const prevStock = moveProduct.stock;
      const newStock = isOut ? prevStock - moveQty : prevStock + moveQty;

      await supabase.from("supplier_products").update({ stock: newStock }).eq("id", moveProduct.id);

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

      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        user_name: user?.email,
        action: "stock_movement",
        entity_type: "supplier_product",
        entity_id: moveProduct.id,
        details: { product: moveProduct.name, type: moveType, quantity: moveQty, prev: prevStock, new: newStock },
      });

      toast.success(`Stock de ${moveProduct.name} actualizado: ${prevStock} → ${newStock}`);

      // Alert if now below min
      if (newStock <= moveProduct.min_stock && prevStock > moveProduct.min_stock) {
        toast.warning(`⚠️ ${moveProduct.name} está agora abaixo do stock mínimo (${newStock}/${moveProduct.min_stock})`, { duration: 6000 });
      }

      setMoveOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const stockHealthPercent = activeProducts.length > 0
    ? Math.round(((activeProducts.length - lowStockProducts.length - outOfStock.length) / activeProducts.length) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Gestão de Stock Avançada
          </h1>
          <p className="text-muted-foreground text-sm">Movimentos, alertas, histórico e valorização de inventário</p>
        </div>
      </div>

      {/* Alerts */}
      {(lowStockProducts.length > 0 || outOfStock.length > 0) && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" /> Alertas de Stock ({lowStockProducts.length + outOfStock.length} produtos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {outOfStock.map(p => (
                <Badge key={p.id} variant="destructive" className="gap-1 cursor-pointer" onClick={() => openMovement(p, "entrada")}>
                  🔴 {p.name}: ESGOTADO <span className="text-[10px] opacity-75">({getSupplierName(p.supplier_id)})</span>
                </Badge>
              ))}
              {lowStockProducts.map(p => (
                <Badge key={p.id} variant="outline" className="border-warning/30 text-warning gap-1 cursor-pointer" onClick={() => openMovement(p, "entrada")}>
                  🟡 {p.name}: {p.stock}/{p.min_stock} {p.unit} <span className="text-[10px] text-muted-foreground ml-1">({getSupplierName(p.supplier_id)})</span>
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Clique num alerta para registar entrada de stock</p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{activeProducts.length}</p>
          <p className="text-xs text-muted-foreground">Produtos Activos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{activeProducts.reduce((s, p) => s + p.stock, 0)}</p>
          <p className="text-xs text-muted-foreground">Unidades em Stock</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalStockValue.toLocaleString("pt-AO")} Kz</p>
          <p className="text-xs text-muted-foreground">Valor do Inventário</p>
        </CardContent></Card>
        <Card className={outOfStock.length > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${outOfStock.length > 0 ? "text-destructive" : ""}`}>{outOfStock.length}</p>
            <p className="text-xs text-muted-foreground">Esgotados</p>
          </CardContent>
        </Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Saúde do Stock</p>
            <p className="text-sm font-bold">{stockHealthPercent}%</p>
          </div>
          <Progress value={stockHealthPercent} className="h-2" />
        </CardContent></Card>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" className="gap-1"><Package className="h-3.5 w-3.5" /> Produtos</TabsTrigger>
          <TabsTrigger value="movements" className="gap-1"><History className="h-3.5 w-3.5" /> Movimentos ({movements.length})</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Análise</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Fornecedores</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Estados</SelectItem>
                <SelectItem value="ok">✅ OK</SelectItem>
                <SelectItem value="low">🟡 Baixo</SelectItem>
                <SelectItem value="out">🔴 Esgotado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Mín.</TableHead>
                    <TableHead className="text-center">Valor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sem produtos</TableCell></TableRow>
                  ) : filtered.map(p => {
                    const isLow = p.stock <= p.min_stock && p.stock > 0;
                    const isOut = p.stock === 0;
                    const stockPercent = p.min_stock > 0 ? Math.min(100, Math.round((p.stock / (p.min_stock * 3)) * 100)) : 100;
                    return (
                      <TableRow key={p.id} className={isOut ? "bg-destructive/5" : isLow ? "bg-warning/5" : ""}>
                        <TableCell>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.category} • {Number(p.price).toLocaleString("pt-AO")} Kz/{p.unit}</p>
                        </TableCell>
                        <TableCell className="text-sm">{getSupplierName(p.supplier_id)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`font-bold text-lg ${isOut ? "text-destructive" : isLow ? "text-warning" : ""}`}>
                              {p.stock}
                            </span>
                            <Progress value={stockPercent} className="h-1 w-16" />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto" onClick={() => openEditMin(p)}>
                            {p.min_stock} <Edit2 className="h-2.5 w-2.5" />
                          </button>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {(p.stock * Number(p.price)).toLocaleString("pt-AO")} Kz
                        </TableCell>
                        <TableCell>
                          {isOut ? <Badge variant="destructive" className="text-[10px]">Esgotado</Badge>
                            : isLow ? <Badge variant="secondary" className="text-[10px] border-warning/30">Baixo</Badge>
                            : <Badge variant="outline" className="text-[10px]">OK</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openMovement(p, "entrada")}>
                              <ArrowUpCircle className="h-3 w-3 mr-1 text-primary" /> Entrada
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openMovement(p, "saida")}>
                              <ArrowDownCircle className="h-3 w-3 mr-1 text-destructive" /> Saída
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openMovement(p, "ajuste")}>
                              <RotateCcw className="h-3 w-3 mr-1" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openHistory(p)}>
                              <History className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar por produto..." value={movSearch} onChange={e => setMovSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={movFilterType} onValueChange={setMovFilterType}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                {Object.entries(MOVEMENT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sem movimentos</TableCell></TableRow>
                  ) : filteredMovements.slice(0, 100).map(m => {
                    const meta = MOVEMENT_LABELS[m.movement_type] || MOVEMENT_LABELS.ajuste;
                    const Icon = meta.icon;
                    const isOut = m.movement_type === "saida" || m.movement_type === "venda";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(m.created_at).toLocaleString("pt-AO")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{getProductName(m.product_id)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getSupplierName(m.supplier_id)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${isOut ? "text-destructive" : "text-primary"}`}>
                            {isOut ? "-" : "+"}{m.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {m.previous_stock} → <span className="font-semibold text-foreground">{m.new_stock}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{m.reason || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stock by Category */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stock por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(
                  activeProducts.reduce<Record<string, { qty: number; value: number; count: number }>>((acc, p) => {
                    acc[p.category] = acc[p.category] || { qty: 0, value: 0, count: 0 };
                    acc[p.category].qty += p.stock;
                    acc[p.category].value += p.stock * Number(p.price);
                    acc[p.category].count++;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1].value - a[1].value).map(([cat, data]) => (
                  <div key={cat} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="text-sm font-medium">{cat}</p>
                      <p className="text-[10px] text-muted-foreground">{data.count} produtos • {data.qty} unidades</p>
                    </div>
                    <p className="font-bold text-sm">{data.value.toLocaleString("pt-AO")} Kz</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Stock by Supplier */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stock por Fornecedor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {suppliers.map(sup => {
                  const supProducts = activeProducts.filter(p => p.supplier_id === sup.id);
                  const totalQty = supProducts.reduce((s, p) => s + p.stock, 0);
                  const totalVal = supProducts.reduce((s, p) => s + p.stock * Number(p.price), 0);
                  const lowCount = supProducts.filter(p => p.stock <= p.min_stock).length;
                  if (supProducts.length === 0) return null;
                  return (
                    <div key={sup.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="text-sm font-medium">{sup.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {supProducts.length} produtos • {totalQty} un.
                          {lowCount > 0 && <span className="text-warning ml-1">• {lowCount} em alerta</span>}
                        </p>
                      </div>
                      <p className="font-bold text-sm">{totalVal.toLocaleString("pt-AO")} Kz</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Recent Movement Summary */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo de Movimentos (últimos 200)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Object.entries(MOVEMENT_LABELS).map(([type, meta]) => {
                    const count = movements.filter(m => m.movement_type === type).length;
                    const totalQty = movements.filter(m => m.movement_type === type).reduce((s, m) => s + m.quantity, 0);
                    const Icon = meta.icon;
                    return (
                      <div key={type} className="flex items-center gap-2 p-3 border rounded-lg">
                        <Icon className={`h-5 w-5 ${meta.color}`} />
                        <div>
                          <p className="font-bold text-lg">{count}</p>
                          <p className="text-[10px] text-muted-foreground">{meta.label} ({totalQty} un.)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Movement Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {moveType === "entrada" ? <ArrowUpCircle className="h-5 w-5 text-primary" />
                : moveType === "ajuste" ? <RotateCcw className="h-5 w-5 text-warning" />
                : <ArrowDownCircle className="h-5 w-5 text-destructive" />}
              {moveType === "entrada" ? "Entrada de Stock" : moveType === "ajuste" ? "Ajuste de Inventário" : "Saída de Stock"}
            </DialogTitle>
          </DialogHeader>
          {moveProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-semibold">{moveProduct.name}</p>
                <p className="text-sm text-muted-foreground">
                  Fornecedor: {getSupplierName(moveProduct.supplier_id)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Stock actual: <span className="font-bold">{moveProduct.stock} {moveProduct.unit}</span>
                  {moveProduct.stock <= moveProduct.min_stock && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">Abaixo do mínimo ({moveProduct.min_stock})</Badge>
                  )}
                </p>
              </div>

              {moveType === "ajuste" && (
                <div className="space-y-2">
                  <Label>Tipo de Ajuste</Label>
                  <Select value={moveType} onValueChange={v => setMoveType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ajuste">Ajuste (Definir stock)</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="devolucao">Devolução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>{moveType === "ajuste" ? "Novo Stock" : "Quantidade"}</Label>
                <Input
                  type="number"
                  min={moveType === "ajuste" ? 0 : 1}
                  max={moveType === "saida" ? moveProduct.stock : 99999}
                  value={moveQty || ""}
                  onChange={e => setMoveQty(Number(e.target.value))}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Motivo {moveType === "ajuste" ? "*" : "(opcional)"}</Label>
                <Textarea
                  placeholder={moveType === "ajuste" ? "Ex: Contagem de inventário, quebra..." : "Ex: Reabastecimento, encomenda..."}
                  value={moveReason}
                  onChange={e => setMoveReason(e.target.value)}
                  rows={2}
                />
              </div>
              {moveQty > 0 && (
                <div className={`p-3 rounded-lg text-sm ${moveType === "saida" ? "bg-destructive/5 border border-destructive/20" : "bg-primary/5 border border-primary/20"}`}>
                  <div className="flex items-center gap-2">
                    {moveType === "saida" ? <TrendingDown className="h-4 w-4 text-destructive" /> : <TrendingUp className="h-4 w-4 text-primary" />}
                    <p>
                      Stock: <span className="font-bold">{moveProduct.stock}</span> → 
                      <span className="font-bold ml-1">
                        {moveType === "ajuste" ? moveQty : moveType === "saida" ? moveProduct.stock - moveQty : moveProduct.stock + moveQty}
                      </span> {moveProduct.unit}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
            <Button
              onClick={submitMovement}
              disabled={submitting || moveQty <= 0 || (moveType === "ajuste" && !moveReason.trim())}
              className="gap-2"
              variant={moveType === "saida" ? "destructive" : "default"}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : moveType === "entrada" ? <ArrowUpCircle className="h-4 w-4" /> : moveType === "saida" ? <ArrowDownCircle className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              {submitting ? "A processar..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Min Stock Dialog */}
      <Dialog open={editMinOpen} onOpenChange={setEditMinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Stock Mínimo</DialogTitle>
          </DialogHeader>
          {editMinProduct && (
            <div className="space-y-4">
              <p className="text-sm"><span className="font-semibold">{editMinProduct.name}</span> — {getSupplierName(editMinProduct.supplier_id)}</p>
              <div className="space-y-2">
                <Label>Stock Mínimo ({editMinProduct.unit})</Label>
                <Input type="number" min={0} value={editMinValue} onChange={e => setEditMinValue(Number(e.target.value))} />
                <p className="text-[10px] text-muted-foreground">Alertas serão gerados quando o stock atingir este valor</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMinOpen(false)}>Cancelar</Button>
            <Button onClick={saveMinStock} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico — {historyProduct?.name}
            </DialogTitle>
          </DialogHeader>
          {historyProduct && (
            <div className="p-3 bg-muted/50 rounded-lg mb-3 text-sm">
              <p>Stock actual: <span className="font-bold">{historyProduct.stock} {historyProduct.unit}</span> • Mín: {historyProduct.min_stock} • Fornecedor: {getSupplierName(historyProduct.supplier_id)}</p>
            </div>
          )}
          {productMovements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem movimentos registados</p>
          ) : (
            <div className="space-y-2">
              {productMovements.map(m => {
                const meta = MOVEMENT_LABELS[m.movement_type] || MOVEMENT_LABELS.ajuste;
                const Icon = meta.icon;
                const isOut = m.movement_type === "saida" || m.movement_type === "venda";
                return (
                  <div key={m.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Icon className={`h-5 w-5 mt-0.5 ${meta.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-AO")}</span>
                      </div>
                      <p className="text-sm mt-1">
                        <span className={`font-bold ${isOut ? "text-destructive" : "text-primary"}`}>
                          {isOut ? "-" : "+"}{m.quantity}
                        </span>
                        <span className="text-muted-foreground ml-2">(Stock: {m.previous_stock} → {m.new_stock})</span>
                      </p>
                      {m.reason && <p className="text-xs text-muted-foreground mt-1">📝 {m.reason}</p>}
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
