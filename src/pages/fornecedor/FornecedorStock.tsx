import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle, RotateCcw, Search, History, Edit2, TrendingDown, TrendingUp, Loader2, Tag, Calendar as CalendarIcon, X, User, Lock } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
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
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePatecCatalogIndex } from "@/hooks/usePatecCatalogIndex";

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

interface PriceLog {
  id: string;
  product_id: string;
  previous_price: number;
  new_price: number;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

const MOVEMENT_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  entrada: { label: "Entrada", color: "text-primary", icon: ArrowUpCircle },
  saida: { label: "Saída", color: "text-destructive", icon: ArrowDownCircle },
  ajuste: { label: "Ajuste", color: "text-warning", icon: RotateCcw },
  venda: { label: "Venda", color: "text-info", icon: ArrowDownCircle },
  devolucao: { label: "Devolução", color: "text-primary", icon: ArrowUpCircle },
};

const FornecedorStock = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string; name: string; status: string; user_id: string } }>();
  const { user, isAdmin } = useAuth();
  const isSupplierActive = supplier.status === "Ativo";
  const isOwner = !!user && user.id === supplier.user_id;
  const canManagePrices = isSupplierActive && (isOwner || isAdmin);
  const canManageStock = isSupplierActive && (isOwner || isAdmin);
  const denialReason = !isSupplierActive
    ? `Conta ${supplier.status?.toLowerCase() || "inactiva"}: acções de stock e preço bloqueadas.`
    : (!isOwner && !isAdmin)
      ? "Apenas o titular da conta de fornecedor ou um administrador podem editar preços e registar motivos."
      : null;
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [priceLogs, setPriceLogs] = useState<PriceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPatec, setFilterPatec] = useState<"todos" | "em_patec" | "fora_patec">("todos");
  const [search, setSearch] = useState("");
  const catalogIndex = usePatecCatalogIndex();
  const [movSearch, setMovSearch] = useState("");
  const [movFilterType, setMovFilterType] = useState("all");
  const [movReasonSearch, setMovReasonSearch] = useState("");
  const [movDateFrom, setMovDateFrom] = useState("");
  const [movDateTo, setMovDateTo] = useState("");
  const MOV_PAGE = 50;
  const HIST_PAGE = 20;
  const [movVisible, setMovVisible] = useState(MOV_PAGE);
  const [historyVisible, setHistoryVisible] = useState(HIST_PAGE);

  // Movement dialog
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveProduct, setMoveProduct] = useState<Product | null>(null);
  const [moveType, setMoveType] = useState("entrada");
  const [moveQty, setMoveQty] = useState(0);
  const [moveReason, setMoveReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [productMovements, setProductMovements] = useState<StockMovement[]>([]);
  const [productPriceLogs, setProductPriceLogs] = useState<PriceLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Edit min_stock
  const [editMinOpen, setEditMinOpen] = useState(false);
  const [editMinProduct, setEditMinProduct] = useState<Product | null>(null);
  const [editMinValue, setEditMinValue] = useState(0);

  // Edit price
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [editPriceProduct, setEditPriceProduct] = useState<Product | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [priceReason, setPriceReason] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);

  const MAX_PRICE = 10_000_000;

  const validatePrice = (raw: string): string | null => {
    if (raw.trim() === "") return "Indique um preço";
    const val = Number(raw);
    if (!isFinite(val)) return "Preço inválido";
    if (val < 0) return "O preço não pode ser negativo";
    if (val > MAX_PRICE) return `O preço máximo permitido é ${MAX_PRICE.toLocaleString("pt-AO")} Kz`;
    const rounded = Math.round(val * 100) / 100;
    if (rounded !== val) return null; // will be auto-corrected, not an error
    return null;
  };

  const formatPriceInput = (raw: string): string => {
    const val = Number(raw);
    if (!isFinite(val)) return raw;
    return String(Math.max(0, Math.min(MAX_PRICE, Math.round(val * 100) / 100)));
  };

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [prodRes, movRes, priceRes] = await Promise.all([
        supabase.from("supplier_products").select("id, name, category, stock, min_stock, price, unit, supplier_id, status").eq("supplier_id", supplier.id).order("name"),
        supabase.from("stock_movements").select("*").eq("supplier_id", supplier.id).order("created_at", { ascending: false }).limit(200),
        supabase.from("product_price_history").select("id, product_id, previous_price, new_price, reason, created_at, created_by").eq("supplier_id", supplier.id).order("created_at", { ascending: false }).limit(200),
      ]);
      if (prodRes.error) throw prodRes.error;
      if (movRes.error) throw movRes.error;
      const movs = (movRes.data as StockMovement[]) || [];
      const plogs = (priceRes.data as PriceLog[]) || [];
      setProducts((prodRes.data as Product[]) || []);
      setMovements(movs);
      setPriceLogs(plogs);
      await resolveUserNames([...movs.map(m => m.created_by), ...plogs.map(p => p.created_by)]);
    } catch (e: any) {
      setLoadError(e);
      toast.error("Erro ao carregar stock: " + (e.message || "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const resolveUserNames = async (ids: (string | null)[]) => {
    const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
    const missing = unique.filter(id => !userNames[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", missing);
    if (data) {
      setUserNames(prev => {
        const next = { ...prev };
        (data as { user_id: string; full_name: string }[]).forEach(p => { next[p.user_id] = p.full_name || "—"; });
        missing.forEach(id => { if (!next[id]) next[id] = "Utilizador desconhecido"; });
        return next;
      });
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getUserName = (id: string | null | undefined) => {
    if (!id) return "Sistema";
    return userNames[id] || "A carregar…";
  };

  useEffect(() => { fetchData(); }, [supplier.id]);
  useEffect(() => { setMovVisible(MOV_PAGE); }, [movSearch, movFilterType, movReasonSearch, movDateFrom, movDateTo]);

  const activeProducts = products.filter(p => p.status === "Ativo");
  const lowStockProducts = activeProducts.filter(p => p.stock <= p.min_stock && p.stock > 0);
  const outOfStock = activeProducts.filter(p => p.stock === 0);
  const totalStockValue = activeProducts.reduce((s, p) => s + p.stock * Number(p.price), 0);

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus === "low" && !(p.stock <= p.min_stock && p.stock > 0)) return false;
    if (filterStatus === "out" && p.stock !== 0) return false;
    if (filterStatus === "ok" && p.stock <= p.min_stock) return false;
    if (filterPatec !== "todos") {
      const inPatec = catalogIndex.isInAnyPatec(p.name);
      if (filterPatec === "em_patec" && !inPatec) return false;
      if (filterPatec === "fora_patec" && inPatec) return false;
    }
    return true;
  });

  type UnifiedEntry =
    | ({ kind: "stock" } & StockMovement)
    | ({ kind: "price" } & PriceLog);

  const filteredMovements: UnifiedEntry[] = (() => {
    const stockEntries: UnifiedEntry[] = movements.map(m => ({ kind: "stock", ...m }));
    const priceEntries: UnifiedEntry[] = movFilterType === "all" || movFilterType === "preco"
      ? priceLogs.map(p => ({ kind: "price", ...p }))
      : [];
    const merged = [...stockEntries, ...priceEntries].filter(e => {
      if (e.kind === "stock") {
        if (movFilterType !== "all" && movFilterType !== "preco" && e.movement_type !== movFilterType) return false;
      } else if (movFilterType !== "all" && movFilterType !== "preco") {
        return false;
      }
      if (movSearch) {
        const product = products.find(p => p.id === e.product_id);
        if (!product?.name.toLowerCase().includes(movSearch.toLowerCase())) return false;
      }
      if (movReasonSearch) {
        const reason = e.kind === "stock" ? e.reason : e.reason;
        if (!reason || !reason.toLowerCase().includes(movReasonSearch.toLowerCase())) return false;
      }
      if (movDateFrom || movDateTo) {
        const date = new Date(e.created_at);
        const from = movDateFrom ? new Date(movDateFrom) : null;
        const to = movDateTo ? new Date(movDateTo) : null;
        if (to) to.setHours(23, 59, 59, 999);
        if (from && date < from) return false;
        if (to && date > to) return false;
      }
      return true;
    });
    return merged.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  })();

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || "—";

  const guardManageStock = () => {
    if (!canManageStock) { toast.error(denialReason || "Sem permissão para gerir stock"); return false; }
    return true;
  };
  const guardManagePrices = () => {
    if (!canManagePrices) { toast.error(denialReason || "Sem permissão para editar preços"); return false; }
    return true;
  };

  const openMovement = (product: Product, type: string) => {
    if (!guardManageStock()) return;
    setMoveProduct(product);
    setMoveType(type);
    setMoveQty(0);
    setMoveReason("");
    setMoveOpen(true);
  };

  const openHistory = async (product: Product) => {
    setHistoryProduct(product);
    setHistoryVisible(HIST_PAGE);
    setHistoryOpen(true);
    const [movRes, priceRes] = await Promise.all([
      supabase.from("stock_movements").select("*").eq("product_id", product.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("product_price_history").select("id, product_id, previous_price, new_price, reason, created_at, created_by").eq("product_id", product.id).order("created_at", { ascending: false }).limit(200),
    ]);
    const movs = (movRes.data as StockMovement[]) || [];
    const plogs = (priceRes.data as PriceLog[]) || [];
    setProductMovements(movs);
    setProductPriceLogs(plogs);
    await resolveUserNames([...movs.map(m => m.created_by), ...plogs.map(p => p.created_by)]);
  };

  const openEditMin = (product: Product) => {
    if (!guardManageStock()) return;
    setEditMinProduct(product);
    setEditMinValue(product.min_stock);
    setEditMinOpen(true);
  };

  const saveMinStock = async () => {
    if (!editMinProduct) return;
    if (!guardManageStock()) return;
    setSubmitting(true);
    try {
      await supabase.from("supplier_products").update({ min_stock: editMinValue }).eq("id", editMinProduct.id);
      toast.success(`Stock mínimo de ${editMinProduct.name} actualizado para ${editMinValue}`);
      setEditMinOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPrice = (product: Product) => {
    if (!guardManagePrices()) return;
    setEditPriceProduct(product);
    const initial = String(Math.round(product.price * 100) / 100);
    setNewPrice(initial);
    setPriceReason("");
    setPriceError(null);
    setEditPriceOpen(true);
  };

  const savePrice = async () => {
    if (!editPriceProduct) return;
    if (!guardManagePrices()) return;
    const rounded = Math.round(Number(newPrice) * 100) / 100;
    if (!isFinite(rounded) || rounded < 0) { toast.error("Preço inválido"); return; }
    if (rounded > MAX_PRICE) { toast.error(`O preço máximo permitido é ${MAX_PRICE.toLocaleString("pt-AO")} Kz`); return; }
    if (rounded === Math.round(editPriceProduct.price * 100) / 100) { toast.info("Sem alterações"); return; }
    if (priceReason.trim().length < 3) { toast.error("Indique um motivo (≥ 3 caracteres)"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: upErr } = await supabase.from("supplier_products").update({ price: rounded }).eq("id", editPriceProduct.id);
      if (upErr) throw upErr;
      const { error: logErr } = await supabase.from("product_price_history").insert({
        product_id: editPriceProduct.id,
        supplier_id: supplier.id,
        previous_price: editPriceProduct.price,
        new_price: rounded,
        reason: priceReason.trim(),
        created_by: user?.id,
      });
      if (logErr) console.warn("Falha ao registar histórico de preço:", logErr.message);
      toast.success(`Preço de ${editPriceProduct.name} actualizado para ${rounded.toLocaleString("pt-AO")} Kz`);
      setEditPriceOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitMovement = async () => {
    if (!guardManageStock()) return;
    if (!moveProduct || moveQty <= 0) { toast.error("Indique uma quantidade válida"); return; }
    const isOut = moveType === "saida" || moveType === "venda";
    if (isOut && moveQty > moveProduct.stock) { toast.error("Quantidade excede o stock disponível"); return; }

    setSubmitting(true);
    try {
      const prevStock = moveProduct.stock;
      const newStock = moveType === "ajuste" ? moveQty : isOut ? prevStock - moveQty : prevStock + moveQty;

      await supabase.from("supplier_products").update({ stock: newStock }).eq("id", moveProduct.id);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("stock_movements").insert({
        supplier_id: supplier.id,
        product_id: moveProduct.id,
        movement_type: moveType,
        quantity: moveType === "ajuste" ? Math.abs(newStock - prevStock) : moveQty,
        previous_stock: prevStock,
        new_stock: newStock,
        reason: moveReason.trim() || null,
        created_by: user?.id,
      });

      toast.success(`Stock de ${moveProduct.name} actualizado: ${prevStock} → ${newStock}`);
      if (newStock <= moveProduct.min_stock && prevStock > moveProduct.min_stock) {
        toast.warning(`⚠️ ${moveProduct.name} abaixo do stock mínimo (${newStock}/${moveProduct.min_stock})`, { duration: 6000 });
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

  if (loadError && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Stock & Preços
          </h1>
          <p className="text-muted-foreground text-sm">Inventário da loja {supplier.name}</p>
        </div>
        <ErrorState onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Stock & Preços
        </h1>
        <p className="text-muted-foreground text-sm">Inventário da loja {supplier.name}</p>
      </div>

      {denialReason && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
          <Lock className="h-4 w-4 mt-0.5 text-warning" />
          <div>
            <p className="font-semibold">Modo apenas leitura</p>
            <p className="text-muted-foreground">{denialReason}</p>
          </div>
        </div>
      )}


      {/* Alerts */}
      {(lowStockProducts.length > 0 || outOfStock.length > 0) && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" /> Alertas ({lowStockProducts.length + outOfStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {outOfStock.map(p => (
                <Badge key={p.id} variant="destructive" className="gap-1 cursor-pointer" onClick={() => openMovement(p, "entrada")}>
                  🔴 {p.name}: ESGOTADO
                </Badge>
              ))}
              {lowStockProducts.map(p => (
                <Badge key={p.id} variant="outline" className="border-amber-500/30 text-amber-700 gap-1 cursor-pointer" onClick={() => openMovement(p, "entrada")}>
                  🟡 {p.name}: {p.stock}/{p.min_stock} {p.unit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{activeProducts.length}</p>
          <p className="text-xs text-muted-foreground">Produtos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{activeProducts.reduce((s, p) => s + p.stock, 0)}</p>
          <p className="text-xs text-muted-foreground">Unidades</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalStockValue.toLocaleString("pt-AO")} Kz</p>
          <p className="text-xs text-muted-foreground">Valor Inventário</p>
        </CardContent></Card>
        <Card className={outOfStock.length > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${outOfStock.length > 0 ? "text-destructive" : ""}`}>{outOfStock.length}</p>
            <p className="text-xs text-muted-foreground">Esgotados</p>
          </CardContent>
        </Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Saúde</p>
            <p className="text-sm font-bold">{stockHealthPercent}%</p>
          </div>
          <Progress value={stockHealthPercent} className="h-2" />
        </CardContent></Card>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" className="gap-1"><Package className="h-3.5 w-3.5" /> Produtos</TabsTrigger>
          <TabsTrigger value="movements" className="gap-1"><History className="h-3.5 w-3.5" /> Movimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">✅ OK</SelectItem>
                <SelectItem value="low">🟡 Baixo</SelectItem>
                <SelectItem value="out">🔴 Esgotado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Mín.</TableHead>
                    <TableHead className="text-center">Valor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem produtos</TableCell></TableRow>
                  ) : filtered.map(p => {
                    const isLow = p.stock <= p.min_stock && p.stock > 0;
                    const isOutItem = p.stock === 0;
                    const stockPercent = p.min_stock > 0 ? Math.min(100, Math.round((p.stock / (p.min_stock * 3)) * 100)) : 100;
                    return (
                      <TableRow key={p.id} className={isOutItem ? "bg-destructive/5" : isLow ? "bg-amber-500/5" : ""}>
                        <TableCell>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.category} • {Number(p.price).toLocaleString("pt-AO")} Kz/{p.unit}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`font-bold text-lg ${isOutItem ? "text-destructive" : isLow ? "text-amber-600" : ""}`}>{p.stock}</span>
                            <Progress value={stockPercent} className="h-1 w-16" />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canManageStock} title={canManageStock ? "Editar stock mínimo" : (denialReason || "Sem permissão")} onClick={() => openEditMin(p)}>
                            {p.min_stock} {canManageStock && <Edit2 className="h-2.5 w-2.5" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">{(p.stock * Number(p.price)).toLocaleString("pt-AO")} Kz</TableCell>
                        <TableCell>
                          {isOutItem ? <Badge variant="destructive" className="text-[10px]">Esgotado</Badge>
                            : isLow ? <Badge variant="secondary" className="text-[10px] border-amber-500/30">Baixo</Badge>
                            : <Badge variant="outline" className="text-[10px]">OK</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!canManageStock} title={canManageStock ? "" : (denialReason || "Sem permissão")} onClick={() => openMovement(p, "entrada")}>
                              <ArrowUpCircle className="h-3 w-3 mr-1 text-primary" /> Entrada
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!canManageStock} title={canManageStock ? "" : (denialReason || "Sem permissão")} onClick={() => openMovement(p, "saida")}>
                              <ArrowDownCircle className="h-3 w-3 mr-1 text-destructive" /> Saída
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!canManageStock} title={canManageStock ? "Ajuste de inventário" : (denialReason || "Sem permissão")} onClick={() => openMovement(p, "ajuste")}><RotateCcw className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!canManagePrices} title={canManagePrices ? "Editar preço" : (denialReason || "Sem permissão")} onClick={() => openEditPrice(p)}><Tag className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" title="Histórico" onClick={() => openHistory(p)}><History className="h-3 w-3" /></Button>
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
                <SelectItem value="preco">Preço</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filtrar por motivo..." value={movReasonSearch} onChange={e => setMovReasonSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input type="date" value={movDateFrom} onChange={e => setMovDateFrom(e.target.value)} className="pl-8 w-[150px] text-sm" />
              </div>
              <span className="text-muted-foreground text-sm">até</span>
              <div className="relative">
                <CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input type="date" value={movDateTo} onChange={e => setMovDateTo(e.target.value)} className="pl-8 w-[150px] text-sm" />
              </div>
            </div>
            {(movReasonSearch || movDateFrom || movDateTo) && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setMovReasonSearch(""); setMovDateFrom(""); setMovDateTo(""); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead>Utilizador</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sem movimentos</TableCell></TableRow>
                  ) : filteredMovements.slice(0, movVisible).map(entry => {
                    if (entry.kind === "price") {
                      const up = Number(entry.new_price) > Number(entry.previous_price);
                      return (
                        <TableRow key={`price-${entry.id}`}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(entry.created_at).toISOString()}>{formatDateTime(entry.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tag className="h-3.5 w-3.5 text-info" />
                              <Badge variant="outline" className="text-[10px]">Preço</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{getProductName(entry.product_id)}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${up ? "text-warning" : "text-success"}`}>{up ? "▲" : "▼"}</span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                            {Number(entry.previous_price).toLocaleString("pt-AO")} → <span className="font-semibold text-foreground">{Number(entry.new_price).toLocaleString("pt-AO")} Kz</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{getUserName(entry.created_by)}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entry.reason || "—"}</TableCell>
                        </TableRow>
                      );
                    }
                    const m = entry;
                    const meta = MOVEMENT_LABELS[m.movement_type] || MOVEMENT_LABELS.ajuste;
                    const Icon = meta.icon;
                    const isMovOut = m.movement_type === "saida" || m.movement_type === "venda";
                    return (
                      <TableRow key={`stock-${m.id}`}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(m.created_at).toISOString()}>{formatDateTime(m.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{getProductName(m.product_id)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold ${isMovOut ? "text-destructive" : "text-primary"}`}>{isMovOut ? "-" : "+"}{m.quantity}</span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{m.previous_stock} → <span className="font-semibold text-foreground">{m.new_stock}</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{getUserName(m.created_by)}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{m.reason || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {filteredMovements.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>A mostrar {Math.min(movVisible, filteredMovements.length)} de {filteredMovements.length}</span>
              {movVisible < filteredMovements.length && (
                <Button variant="outline" size="sm" onClick={() => setMovVisible(v => v + MOV_PAGE)}>Carregar mais</Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Movement Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {moveType === "entrada" ? <ArrowUpCircle className="h-5 w-5 text-primary" /> : moveType === "ajuste" ? <RotateCcw className="h-5 w-5 text-amber-600" /> : <ArrowDownCircle className="h-5 w-5 text-destructive" />}
              {moveType === "entrada" ? "Entrada de Stock" : moveType === "ajuste" ? "Ajuste de Inventário" : "Saída de Stock"}
            </DialogTitle>
          </DialogHeader>
          {moveProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-semibold">{moveProduct.name}</p>
                <p className="text-sm text-muted-foreground">Stock actual: <span className="font-bold">{moveProduct.stock} {moveProduct.unit}</span>
                  {moveProduct.stock <= moveProduct.min_stock && <Badge variant="destructive" className="ml-2 text-[10px]">Abaixo do mínimo ({moveProduct.min_stock})</Badge>}
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
                <Input type="number" min={moveType === "ajuste" ? 0 : 1} max={moveType === "saida" ? moveProduct.stock : 99999} value={moveQty || ""} onChange={e => setMoveQty(Number(e.target.value))} autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Motivo {moveType === "ajuste" ? "*" : "(opcional)"}</Label>
                <Textarea placeholder={moveType === "ajuste" ? "Ex: Contagem de inventário..." : "Ex: Reabastecimento..."} value={moveReason} onChange={e => setMoveReason(e.target.value)} rows={2} />
              </div>
              {moveQty > 0 && (
                <div className={`p-3 rounded-lg text-sm ${moveType === "saida" ? "bg-destructive/5 border border-destructive/20" : "bg-primary/5 border border-primary/20"}`}>
                  <div className="flex items-center gap-2">
                    {moveType === "saida" ? <TrendingDown className="h-4 w-4 text-destructive" /> : <TrendingUp className="h-4 w-4 text-primary" />}
                    <p>Stock: <span className="font-bold">{moveProduct.stock}</span> → <span className="font-bold ml-1">{moveType === "ajuste" ? moveQty : moveType === "saida" ? moveProduct.stock - moveQty : moveProduct.stock + moveQty}</span> {moveProduct.unit}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
            <Button onClick={submitMovement} disabled={submitting || moveQty <= 0 || (moveType === "ajuste" && !moveReason.trim())} variant={moveType === "saida" ? "destructive" : "default"}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {submitting ? "A processar..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Min Stock Dialog */}
      <Dialog open={editMinOpen} onOpenChange={setEditMinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Stock Mínimo</DialogTitle></DialogHeader>
          {editMinProduct && (
            <div className="space-y-4">
              <p className="text-sm font-semibold">{editMinProduct.name}</p>
              <div className="space-y-2">
                <Label>Stock Mínimo ({editMinProduct.unit})</Label>
                <Input type="number" min={0} value={editMinValue} onChange={e => setEditMinValue(Number(e.target.value))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMinOpen(false)}>Cancelar</Button>
            <Button onClick={saveMinStock} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Price Dialog */}
      <Dialog open={editPriceOpen} onOpenChange={setEditPriceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Editar Preço</DialogTitle>
          </DialogHeader>
          {editPriceProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-semibold">{editPriceProduct.name}</p>
                <p className="text-sm text-muted-foreground">Preço actual: <span className="font-bold">{Number(editPriceProduct.price).toLocaleString("pt-AO")} Kz</span> / {editPriceProduct.unit}</p>
              </div>
              <div className="space-y-2">
                <Label>Novo Preço (Kz)</Label>
                <Input
                  type="number"
                  min={0}
                  max={MAX_PRICE}
                  step="0.01"
                  value={newPrice}
                  onChange={e => {
                    const val = e.target.value;
                    setNewPrice(val);
                    setPriceError(validatePrice(val));
                  }}
                  onBlur={() => setNewPrice(formatPriceInput(newPrice))}
                  autoFocus
                  className={priceError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {priceError && <p className="text-xs text-destructive">{priceError}</p>}
                <p className="text-[10px] text-muted-foreground">Máx. {MAX_PRICE.toLocaleString("pt-AO")} Kz • arredondado a 2 casas decimais</p>
              </div>
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Textarea rows={2} placeholder="Ex: revisão mensal, ajuste de mercado..." value={priceReason} onChange={e => setPriceReason(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPriceOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={savePrice} disabled={submitting || !!priceError || !newPrice}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Histórico — {historyProduct?.name}</DialogTitle>
          </DialogHeader>
          {historyProduct && (
            <div className="p-3 bg-muted/50 rounded-lg mb-3 text-sm">
              <p>Stock actual: <span className="font-bold">{historyProduct.stock} {historyProduct.unit}</span> • Mín: {historyProduct.min_stock}</p>
            </div>
          )}
          {(() => {
            type HEntry = ({ kind: "stock" } & StockMovement) | ({ kind: "price" } & PriceLog);
            const merged: HEntry[] = [
              ...productMovements.map(m => ({ kind: "stock" as const, ...m })),
              ...productPriceLogs.map(p => ({ kind: "price" as const, ...p })),
            ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
            if (merged.length === 0) {
              return <p className="text-center text-muted-foreground py-8">Sem movimentos registados</p>;
            }
            return (
              <div className="space-y-2">
                {merged.slice(0, historyVisible).map(entry => {
                  if (entry.kind === "price") {
                    const up = Number(entry.new_price) > Number(entry.previous_price);
                    return (
                      <div key={`price-${entry.id}`} className="flex items-start gap-3 p-3 border rounded-lg">
                        <Tag className="h-5 w-5 mt-0.5 text-info" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">Preço</Badge>
                            <span className="text-xs text-muted-foreground" title={new Date(entry.created_at).toISOString()}>{formatDateTime(entry.created_at)}</span>
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><User className="h-3 w-3" />{getUserName(entry.created_by)}</span>
                          </div>
                          <p className="text-sm mt-1 tabular-nums">
                            <span className={`font-bold ${up ? "text-warning" : "text-success"}`}>{up ? "▲" : "▼"}</span>
                            <span className="ml-2">{Number(entry.previous_price).toLocaleString("pt-AO")} → <span className="font-semibold">{Number(entry.new_price).toLocaleString("pt-AO")} Kz</span></span>
                          </p>
                          {entry.reason && <p className="text-xs text-muted-foreground mt-1">📝 {entry.reason}</p>}
                        </div>
                      </div>
                    );
                  }
                  const m = entry;
                  const meta = MOVEMENT_LABELS[m.movement_type] || MOVEMENT_LABELS.ajuste;
                  const Icon = meta.icon;
                  const isMovOut = m.movement_type === "saida" || m.movement_type === "venda";
                  return (
                    <div key={`stock-${m.id}`} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Icon className={`h-5 w-5 mt-0.5 ${meta.color}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                          <span className="text-xs text-muted-foreground" title={new Date(m.created_at).toISOString()}>{formatDateTime(m.created_at)}</span>
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><User className="h-3 w-3" />{getUserName(m.created_by)}</span>
                        </div>
                        <p className="text-sm mt-1">
                          <span className={`font-bold ${isMovOut ? "text-destructive" : "text-primary"}`}>{isMovOut ? "-" : "+"}{m.quantity}</span>
                          <span className="text-muted-foreground ml-2">(Stock: {m.previous_stock} → {m.new_stock})</span>
                        </p>
                        {m.reason && <p className="text-xs text-muted-foreground mt-1">📝 {m.reason}</p>}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                  <span>A mostrar {Math.min(historyVisible, merged.length)} de {merged.length}</span>
                  {historyVisible < merged.length && (
                    <Button variant="outline" size="sm" onClick={() => setHistoryVisible(v => v + HIST_PAGE)}>Carregar mais</Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedorStock;
