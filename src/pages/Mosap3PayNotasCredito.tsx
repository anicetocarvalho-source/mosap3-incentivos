import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, Plus, Eye, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ErrorState } from "@/components/ui/error-state";
import { useServerTable, useDebouncedValue } from "@/hooks/useServerTable";

const PAGE_SIZE = 15;

interface CreditNote {
  id: string;
  credit_note_number: string;
  supplier_id: string;
  original_sale_id: string | null;
  farmer_code: string;
  farmer_name: string;
  reason: string;
  subtotal: number;
  iva_total: number;
  total: number;
  status: string;
  created_at: string;
}

interface Sale {
  id: string;
  sale_code: string;
  invoice_number: string | null;
  farmer_code: string;
  farmer_name: string;
  subtotal: number;
  iva_total: number;
  total: number;
  supplier_id: string;
  created_at: string;
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  iva_amount: number;
  iva_rate: number;
  line_total: number;
}

const Mosap3PayNotasCredito = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailNote, setDetailNote] = useState<CreditNote | null>(null);
  const [page, setPage] = useState(1);

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const debSearch = useDebouncedValue(search, 350);
  useEffect(() => { setPage(1); }, [debSearch]);

  useEffect(() => {
    supabase.from("suppliers").select("id, name").order("name").then(({ data }) => setSuppliers(data || []));
  }, []);

  const { rows: paginated, total, isLoading: loading, isError, isFetching, refetch } = useServerTable<CreditNote>({
    table: "credit_notes",
    columns: "*",
    page,
    pageSize: PAGE_SIZE,
    search: debSearch,
    searchColumns: ["credit_note_number", "farmer_name", "farmer_code"],
    sort: { column: "created_at", dir: "desc" },
  });

  const kpisQuery = useQuery({
    queryKey: ["credit_notes_kpis", debSearch],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("credit_notes_kpis", { _search: debSearch || null });
      if (error) throw error;
      return data as { total_count: number; total_credited: number; active_count: number };
    },
  });

  const kpis = kpisQuery.data || { total_count: 0, total_credited: 0, active_count: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadSales = async (supplierId: string) => {
    setSelectedSupplier(supplierId);
    setSelectedSale(null);
    setSaleItems([]);
    setSelectedItems({});
    const { data } = await supabase
      .from("pos_sales")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(50);
    setSales((data as Sale[]) || []);
  };

  const selectSale = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data } = await supabase.from("pos_sale_items").select("*").eq("sale_id", sale.id);
    const items = (data as SaleItem[]) || [];
    setSaleItems(items);
    const sel: Record<string, number> = {};
    items.forEach(i => { sel[i.id] = i.quantity; });
    setSelectedItems(sel);
  };

  const createCreditNote = async () => {
    if (!selectedSale || !reason.trim()) {
      toast.error("Seleccione uma factura e indique o motivo");
      return;
    }
    const itemsToCredit = saleItems.filter(i => (selectedItems[i.id] || 0) > 0);
    if (itemsToCredit.length === 0) {
      toast.error("Seleccione pelo menos um item para creditar");
      return;
    }
    setSubmitting(true);
    try {
      let subtotal = 0;
      let ivaTotal = 0;
      const cnItems = itemsToCredit.map(item => {
        const qty = selectedItems[item.id];
        const lineNet = item.unit_price * qty;
        const lineIva = lineNet * (item.iva_rate / 100);
        subtotal += lineNet;
        ivaTotal += lineIva;
        return {
          product_name: item.product_name,
          quantity: qty,
          unit_price: item.unit_price,
          iva_rate: item.iva_rate,
          iva_amount: Math.round(lineIva * 100) / 100,
          line_total: Math.round((lineNet + lineIva) * 100) / 100,
        };
      });
      const total = Math.round((subtotal + ivaTotal) * 100) / 100;
      const year = new Date().getFullYear();
      const { data: ncNumber } = await supabase.rpc("next_credit_note_number", {
        _supplier_id: selectedSale.supplier_id, _year: year,
      });
      const { data: cn, error } = await supabase.from("credit_notes").insert({
        credit_note_number: ncNumber || `NC ${year}/00001`,
        supplier_id: selectedSale.supplier_id,
        original_sale_id: selectedSale.id,
        farmer_code: selectedSale.farmer_code,
        farmer_name: selectedSale.farmer_name,
        reason: reason.trim(),
        subtotal: Math.round(subtotal * 100) / 100,
        iva_total: Math.round(ivaTotal * 100) / 100,
        total,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      await supabase.from("credit_note_items").insert(cnItems.map(item => ({ ...item, credit_note_id: cn.id })));

      const { data: farmerData } = await supabase.from("farmers").select("saldo_final, total_gasto").eq("code", selectedSale.farmer_code).maybeSingle();
      if (farmerData) {
        const parseCurrency = (v: string | null) => parseFloat((v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
        const currentSaldo = parseCurrency(farmerData.saldo_final);
        const currentGasto = parseCurrency(farmerData.total_gasto);
        const newSaldo = Math.round((currentSaldo + total) * 100) / 100;
        const newGasto = Math.round(Math.max(0, currentGasto - total) * 100) / 100;
        await supabase.from("farmers").update({
          saldo_final: newSaldo.toFixed(2).replace(".", ","),
          total_gasto: newGasto.toFixed(2).replace(".", ","),
        }).eq("code", selectedSale.farmer_code);
      }

      await supabase.from("audit_logs").insert({
        user_id: user?.id, user_name: user?.email,
        action: "credit_note_issued", entity_type: "credit_note", entity_id: cn.id,
        details: {
          credit_note_number: cn.credit_note_number, supplier_id: selectedSale.supplier_id,
          original_sale_id: selectedSale.id, original_sale_code: selectedSale.sale_code,
          original_invoice_number: selectedSale.invoice_number, original_sale_total: Number(selectedSale.total),
          farmer_code: selectedSale.farmer_code, farmer_name: selectedSale.farmer_name,
          reason: reason.trim(), subtotal: Math.round(subtotal * 100) / 100,
          iva_total: Math.round(ivaTotal * 100) / 100, total,
          items_credited: cnItems.map(i => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, line_total: i.line_total })),
          balance_adjusted: true,
        },
      });

      toast.success(`Nota de Crédito ${cn.credit_note_number} emitida com sucesso`);
      setCreateOpen(false);
      setReason("");
      setSelectedSale(null);
      refetch();
      kpisQuery.refetch();
    } catch (e: any) {
      toast.error("Erro ao criar NC: " + (e.message || "Erro desconhecido"));
    } finally {
      setSubmitting(false);
    }
  };

  const PaginationControls = () => totalPages > 1 ? (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <p className="text-xs text-muted-foreground">
        {total.toLocaleString("pt-AO")} registos • Página {page}/{totalPages}
        {isFetching && <Loader2 className="h-3 w-3 animate-spin inline ml-2" />}
      </p>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Notas de Crédito
          </h1>
          <p className="text-muted-foreground text-sm">Série NC — Anulações e devoluções</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Emitir Nota de Crédito
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{kpis.total_count.toLocaleString("pt-AO")}</p>
          <p className="text-xs text-muted-foreground">Total NC Emitidas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{Number(kpis.total_credited).toLocaleString("pt-AO")} Kz</p>
          <p className="text-xs text-muted-foreground">Total Creditado</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{kpis.active_count.toLocaleString("pt-AO")}</p>
          <p className="text-xs text-muted-foreground">Activas</p>
        </CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por número NC, nome ou código..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isError ? (
        <Card><CardContent className="p-6"><ErrorState onRetry={() => refetch()} /></CardContent></Card>
      ) : (
      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº NC</TableHead>
                  <TableHead>Produtor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma nota de crédito</TableCell></TableRow>
                ) : paginated.map(cn => (
                  <TableRow key={cn.id}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">{cn.credit_note_number}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{cn.farmer_name}</p>
                      <p className="text-[10px] text-muted-foreground">{cn.farmer_code}</p>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{cn.reason}</TableCell>
                    <TableCell className="font-bold">{Number(cn.total).toLocaleString("pt-AO")} Kz</TableCell>
                    <TableCell><Badge variant={cn.status === "emitida" ? "default" : "secondary"} className="text-[10px]">{cn.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(cn.created_at).toLocaleDateString("pt-AO")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDetailNote(cn)}>
                        <Eye className="h-3 w-3 mr-1" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden divide-y divide-border">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Carregando...</p>
            ) : paginated.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma nota de crédito</p>
            ) : paginated.map(cn => (
              <div key={cn.id} className="p-3 space-y-1.5" onClick={() => setDetailNote(cn)}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-primary">{cn.credit_note_number}</span>
                  <Badge variant={cn.status === "emitida" ? "default" : "secondary"} className="text-[10px]">{cn.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{cn.farmer_name}</span>
                  <span className="font-bold text-sm">{Number(cn.total).toLocaleString("pt-AO")} Kz</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{cn.reason}</p>
                <p className="text-xs text-muted-foreground">{new Date(cn.created_at).toLocaleDateString("pt-AO")}</p>
              </div>
            ))}
          </div>

          <PaginationControls />
        </CardContent>
      </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Emitir Nota de Crédito
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={selectedSupplier} onValueChange={loadSales}>
                <SelectTrigger><SelectValue placeholder="Seleccionar fornecedor..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {sales.length > 0 && !selectedSale && (
              <div className="space-y-2">
                <Label>Factura Original</Label>
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {sales.map(s => (
                    <button key={s.id} onClick={() => selectSale(s)}
                      className="w-full text-left p-2 rounded hover:bg-muted/50 flex justify-between items-center text-sm">
                      <div>
                        <span className="font-mono font-semibold text-primary">{s.invoice_number || s.sale_code}</span>
                        <span className="ml-2 text-muted-foreground">{s.farmer_name}</span>
                      </div>
                      <span className="font-bold">{Number(s.total).toLocaleString("pt-AO")} Kz</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSale && (
              <>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">{selectedSale.invoice_number || selectedSale.sale_code}</p>
                      <p className="text-sm text-muted-foreground">{selectedSale.farmer_name} ({selectedSale.farmer_code})</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedSale(null); setSaleItems([]); }}>Alterar</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Itens a creditar (ajuste quantidades)</Label>
                  {saleItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 border rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">Max: {item.quantity} × {Number(item.unit_price).toLocaleString("pt-AO")} Kz</p>
                      </div>
                      <Input type="number" min={0} max={item.quantity}
                        value={selectedItems[item.id] || 0}
                        onChange={e => setSelectedItems(prev => ({ ...prev, [item.id]: Math.min(Number(e.target.value), item.quantity) }))}
                        className="w-20 text-center"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Motivo da Nota de Crédito *</Label>
                  <Textarea placeholder="Ex: Devolução de produto danificado, erro na facturação..."
                    value={reason} onChange={e => setReason(e.target.value)} rows={3} />
                </div>

                {(() => {
                  const items = saleItems.filter(i => (selectedItems[i.id] || 0) > 0);
                  const sub = items.reduce((s, i) => s + i.unit_price * (selectedItems[i.id] || 0), 0);
                  const iva = items.reduce((s, i) => s + i.unit_price * (selectedItems[i.id] || 0) * (i.iva_rate / 100), 0);
                  return (
                    <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg space-y-1 text-sm">
                      <div className="flex justify-between"><span>Subtotal</span><span>{sub.toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>{iva.toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</span></div>
                      <Separator />
                      <div className="flex justify-between font-bold text-lg text-destructive"><span>Total NC</span><span>{(sub + iva).toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</span></div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={createCreditNote} disabled={submitting || !selectedSale || !reason.trim()} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {submitting ? "A emitir..." : "Emitir NC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailNote} onOpenChange={o => !o && setDetailNote(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailNote?.credit_note_number}</DialogTitle></DialogHeader>
          {detailNote && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{detailNote.farmer_name}</p>
                <p className="text-xs text-muted-foreground">{detailNote.farmer_code}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(detailNote.created_at).toLocaleString("pt-AO")}</p>
              </div>
              <div><Label className="text-xs">Motivo</Label><p className="text-sm">{detailNote.reason}</p></div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{Number(detailNote.subtotal).toLocaleString("pt-AO")} Kz</span></div>
                <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>{Number(detailNote.iva_total).toLocaleString("pt-AO")} Kz</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-lg text-destructive"><span>Total Creditado</span><span>{Number(detailNote.total).toLocaleString("pt-AO")} Kz</span></div>
              </div>
              <Badge variant={detailNote.status === "emitida" ? "default" : "secondary"}>{detailNote.status}</Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayNotasCredito;
