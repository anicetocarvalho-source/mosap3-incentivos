import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Package, History, TrendingUp, TrendingDown, Search, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatKz } from "@/lib/numberFormat";

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  min_stock: number;
  iva_rate: number;
  status: string;
}

interface PriceLog {
  id: string;
  product_id: string;
  previous_price: number;
  new_price: number;
  delta: number;
  reason: string | null;
  created_at: string;
}

interface StockLog {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  created_at: string;
}

type Combined =
  | ({ kind: "price" } & PriceLog)
  | ({ kind: "stock" } & StockLog);

const FornecedorPrecosStock = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string; name: string } }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [priceLogs, setPriceLogs] = useState<PriceLog[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prodRes, priceRes, stockRes] = await Promise.all([
        supabase.from("supplier_products")
          .select("id, name, category, unit, price, stock, min_stock, iva_rate, status")
          .eq("supplier_id", supplier.id)
          .order("name"),
        supabase.from("product_price_history")
          .select("*")
          .eq("supplier_id", supplier.id)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("stock_movements")
          .select("id, product_id, movement_type, quantity, previous_stock, new_stock, reason, created_at")
          .eq("supplier_id", supplier.id)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);
      if (prodRes.error) throw prodRes.error;
      setProducts((prodRes.data as Product[]) || []);
      setPriceLogs((priceRes.data as PriceLog[]) || []);
      setStockLogs((stockRes.data as StockLog[]) || []);
    } catch (e: any) {
      toast.error("Erro ao carregar dados: " + (e.message || "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [supplier.id]);

  const openEdit = (p: Product) => {
    setEditing(p);
    setNewPrice(String(p.price));
    setNewStock(String(p.stock));
    setReason("");
    setDialogOpen(true);
  };

  const openHistory = (p: Product) => {
    setHistoryProduct(p);
    setHistoryOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    const parsedPrice = Number(newPrice);
    const parsedStock = Number(newStock);
    if (!isFinite(parsedPrice) || parsedPrice < 0) { toast.error("Preço inválido"); return; }
    if (!Number.isInteger(parsedStock) || parsedStock < 0) { toast.error("Stock deve ser um inteiro ≥ 0"); return; }

    const priceChanged = parsedPrice !== Number(editing.price);
    const stockChanged = parsedStock !== editing.stock;
    if (!priceChanged && !stockChanged) { toast.info("Nenhuma alteração para guardar"); return; }
    if ((priceChanged || stockChanged) && reason.trim().length < 3) {
      toast.error("Indique um motivo (≥ 3 caracteres) para registar no histórico");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: Record<string, any> = {};
      if (priceChanged) updates.price = parsedPrice;
      if (stockChanged) updates.stock = parsedStock;

      const { error: upErr } = await supabase
        .from("supplier_products").update(updates).eq("id", editing.id);
      if (upErr) throw upErr;

      if (priceChanged) {
        const { error } = await supabase.from("product_price_history").insert({
          product_id: editing.id,
          supplier_id: supplier.id,
          previous_price: editing.price,
          new_price: parsedPrice,
          reason: reason.trim() || null,
          created_by: user?.id,
        });
        if (error) console.warn("Falha ao registar preço:", error.message);
      }
      if (stockChanged) {
        const delta = parsedStock - editing.stock;
        const { error } = await supabase.from("stock_movements").insert({
          supplier_id: supplier.id,
          product_id: editing.id,
          movement_type: "ajuste",
          quantity: Math.abs(delta),
          previous_stock: editing.stock,
          new_stock: parsedStock,
          reason: reason.trim() || null,
          created_by: user?.id,
        });
        if (error) console.warn("Falha ao registar stock:", error.message);
      }

      toast.success(`${editing.name} actualizado`);
      setDialogOpen(false);
      fetchAll();
    } catch (e: any) {
      toast.error("Erro ao guardar: " + (e.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () => products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );

  const combinedHistory = useMemo<Combined[]>(() => {
    const all: Combined[] = [
      ...priceLogs.map(p => ({ kind: "price" as const, ...p })),
      ...stockLogs.map(s => ({ kind: "stock" as const, ...s })),
    ];
    return all.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [priceLogs, stockLogs]);

  const productHistory = useMemo<Combined[]>(() => {
    if (!historyProduct) return [];
    return combinedHistory.filter(h => h.product_id === historyProduct.id);
  }, [combinedHistory, historyProduct]);

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" /> Preços & Stock
        </h1>
        <p className="text-sm text-muted-foreground">
          Ajustes rápidos de preço e stock dos produtos do POS — todas as alterações ficam no histórico.
        </p>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" className="gap-1"><Package className="h-3.5 w-3.5" /> Produtos</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><History className="h-3.5 w-3.5" /> Histórico ({combinedHistory.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-6"><LoadingState rows={6} /></div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={Package} title="Sem produtos" description="Adicione produtos no Catálogo para depois ajustar aqui." />
              ) : (
                <>
                  {/* Desktop */}
                  <Table className="hidden md:table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Preço actual</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-center">IVA</TableHead>
                        <TableHead className="text-right">Acções</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(p => {
                        const low = p.stock > 0 && p.stock <= p.min_stock;
                        const out = p.stock === 0;
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <p className="font-medium text-sm">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">{p.category} • {p.unit}</p>
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatKz(Number(p.price))}</TableCell>
                            <TableCell className="text-right">
                              <span className={`font-semibold tabular-nums ${out ? "text-destructive" : low ? "text-warning" : ""}`}>{p.stock}</span>
                              {out && <Badge variant="destructive" className="ml-2 text-[10px]">Esgotado</Badge>}
                              {low && !out && <Badge variant="outline" className="ml-2 text-[10px] border-warning/30">Baixo</Badge>}
                            </TableCell>
                            <TableCell className="text-center text-xs">{Number(p.iva_rate)}%</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(p)}>Ajustar</Button>
                              <Button variant="ghost" size="sm" className="h-8 ml-1" onClick={() => openHistory(p)}>
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-border">
                    {filtered.map(p => {
                      const low = p.stock > 0 && p.stock <= p.min_stock;
                      const out = p.stock === 0;
                      return (
                        <div key={p.id} className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">{p.category} • {p.unit} • IVA {Number(p.iva_rate)}%</p>
                            </div>
                            {out ? <Badge variant="destructive" className="text-[10px]">Esgotado</Badge>
                              : low ? <Badge variant="outline" className="text-[10px] border-warning/30">Baixo</Badge>
                              : null}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>{formatKz(Number(p.price))}</span>
                            <span className="text-muted-foreground">Stock: <b className={out ? "text-destructive" : low ? "text-warning" : ""}>{p.stock}</b></span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>Ajustar</Button>
                            <Button size="sm" variant="ghost" onClick={() => openHistory(p)}><History className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> Últimas alterações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-6"><LoadingState rows={6} /></div>
              ) : combinedHistory.length === 0 ? (
                <EmptyState icon={History} title="Sem histórico" description="As alterações de preço e stock aparecerão aqui." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Alteração</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {combinedHistory.slice(0, 100).map(h => (
                      <HistoryRow key={`${h.kind}-${h.id}`} entry={h} productName={getProductName(h.product_id)} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar preço e stock</DialogTitle>
            <DialogDescription>{editing?.name}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço actual</Label>
                  <p className="text-sm font-medium pt-2">{formatKz(Number(editing.price))}</p>
                </div>
                <div>
                  <Label htmlFor="np">Novo preço (Kz)</Label>
                  <Input id="np" type="number" min="0" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stock actual</Label>
                  <p className="text-sm font-medium pt-2">{editing.stock} {editing.unit}</p>
                </div>
                <div>
                  <Label htmlFor="ns">Novo stock</Label>
                  <Input id="ns" type="number" min="0" step="1" value={newStock} onChange={e => setNewStock(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="rz">Motivo *</Label>
                <Textarea id="rz" rows={2} value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Ex: revisão mensal, recepção de lote, correcção de inventário..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Guardar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico — {historyProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {productHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem alterações registadas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Alteração</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productHistory.map(h => (
                    <HistoryRow key={`${h.kind}-${h.id}`} entry={h} productName={historyProduct?.name || ""} hideProduct />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const HistoryRow = ({ entry, productName, hideProduct }: { entry: Combined; productName: string; hideProduct?: boolean }) => {
  const date = new Date(entry.created_at).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" });
  if (entry.kind === "price") {
    const up = entry.new_price > entry.previous_price;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <TableRow>
        <TableCell className="text-xs whitespace-nowrap">{date}</TableCell>
        {!hideProduct && <TableCell className="text-sm">{productName}</TableCell>}
        <TableCell><Badge variant="outline" className="gap-1"><Tag className="h-3 w-3" /> Preço</Badge></TableCell>
        <TableCell className="text-sm">
          <span className="inline-flex items-center gap-1 tabular-nums">
            {formatKz(Number(entry.previous_price))}
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className={up ? "text-warning font-medium" : "text-success font-medium"}>
              {formatKz(Number(entry.new_price))}
            </span>
            <Icon className={`h-3 w-3 ${up ? "text-warning" : "text-success"}`} />
          </span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{entry.reason || "—"}</TableCell>
      </TableRow>
    );
  }
  const up = entry.new_stock > entry.previous_stock;
  return (
    <TableRow>
      <TableCell className="text-xs whitespace-nowrap">{date}</TableCell>
      {!hideProduct && <TableCell className="text-sm">{productName}</TableCell>}
      <TableCell>
        <Badge variant="outline" className="gap-1 capitalize"><Package className="h-3 w-3" /> {entry.movement_type}</Badge>
      </TableCell>
      <TableCell className="text-sm">
        <span className="inline-flex items-center gap-1 tabular-nums">
          {entry.previous_stock}
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className={up ? "text-success font-medium" : "text-warning font-medium"}>{entry.new_stock}</span>
          <span className="text-xs text-muted-foreground">({up ? "+" : "−"}{entry.quantity})</span>
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{entry.reason || "—"}</TableCell>
    </TableRow>
  );
};

export default FornecedorPrecosStock;
