import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Search, Filter, Eye, Printer, FileDown, Loader2, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { InvoicePDF, generateFiscalHash, buildQRContent, type InvoiceData } from "@/components/InvoicePDF";
import { ErrorState } from "@/components/ui/error-state";
import { useServerTable, useDebouncedValue } from "@/hooks/useServerTable";

interface Sale {
  id: string;
  sale_code: string;
  invoice_number: string | null;
  supplier_id: string;
  farmer_code: string;
  farmer_name: string;
  patec_number: number | null;
  parcel_size: number | null;
  parcel_size_label: string | null;
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

const PAGE_SIZE = 15;

const Mosap3PayVendas = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceHash, setInvoiceHash] = useState("");
  const [invoiceQR, setInvoiceQR] = useState("");

  // SAF-T export state
  const [saftOpen, setSaftOpen] = useState(false);
  const [saftSupplierId, setSaftSupplierId] = useState("");
  const [saftStartDate, setSaftStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [saftEndDate, setSaftEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saftExporting, setSaftExporting] = useState(false);

  const [validationOpen, setValidationOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  const debSearch = useDebouncedValue(search, 350);
  useEffect(() => { setPage(1); }, [debSearch, filterStatus]);

  const filters = useMemo(
    () => ({ payment_status: filterStatus === "all" ? undefined : filterStatus }),
    [filterStatus]
  );

  // Página servida
  const { rows: paginated, total, isLoading: loading, isFetching, isError, refetch } = useServerTable<Sale>({
    table: "pos_sales",
    columns: "*",
    page,
    pageSize: PAGE_SIZE,
    search: debSearch,
    searchColumns: ["farmer_name", "sale_code", "farmer_code", "invoice_number"],
    filters,
    sort: { column: "created_at", dir: "desc" },
  });

  // KPIs agregados no servidor
  const kpisQuery = useQuery({
    queryKey: ["pos_sales_kpis", filterStatus, debSearch],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_sales_kpis", {
        _status: filterStatus === "all" ? null : filterStatus,
        _search: debSearch || null,
        _invoice_only: false,
        _supplier_id: null,
        _year: null,
      });
      if (error) throw error;
      return data as { total_count: number; total_revenue: number; paid_count: number; pending_total: number };
    },
  });

  const saftSuppliersQuery = useQuery({
    queryKey: ["mosap3pay", "saft-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const saftSuppliers = saftSuppliersQuery.data ?? [];
  const kpis = kpisQuery.data || { total_count: 0, total_revenue: 0, paid_count: 0, pending_total: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (isError) toast.error("Erro ao carregar vendas");
  }, [isError]);

  const exportSaft = async () => {
    if (!saftSupplierId) { toast.error("Seleccione um fornecedor"); return; }
    setSaftExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-saft", {
        body: { supplier_id: saftSupplierId, start_date: saftStartDate, end_date: saftEndDate },
      });
      if (error) throw error;
      const xmlText = typeof data === "string" ? data : await new Response(data).text();
      const blob = new Blob([xmlText], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SAFT-AO_${saftStartDate}_${saftEndDate}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Ficheiro SAF-T exportado com sucesso");
      setSaftOpen(false);
    } catch (e: any) {
      toast.error("Erro ao exportar SAF-T: " + (e.message || "Erro desconhecido"));
    } finally {
      setSaftExporting(false);
    }
  };

  const validateSaft = async () => {
    if (!saftSupplierId) { toast.error("Seleccione um fornecedor"); return; }
    setValidating(true);
    setValidationResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("validate-saft", {
        body: { supplier_id: saftSupplierId, start_date: saftStartDate, end_date: saftEndDate },
      });
      if (error) throw error;
      setValidationResult(data);
      setValidationOpen(true);
    } catch (e: any) {
      toast.error("Erro ao validar SAF-T: " + (e.message || "Erro desconhecido"));
    } finally {
      setValidating(false);
    }
  };

  const openDetail = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data } = await supabase.from("pos_sale_items").select("*").eq("sale_id", sale.id);
    setSaleItems((data as SaleItem[]) || []);
  };

  const openInvoice = async (sale: Sale) => {
    const { data: items } = await supabase.from("pos_sale_items").select("*").eq("sale_id", sale.id);
    const { data: supplier } = await supabase.from("suppliers").select("name, nif").eq("id", sale.supplier_id).maybeSingle();
    const inv: InvoiceData = {
      sale_code: sale.sale_code,
      invoice_number: sale.invoice_number || undefined,
      created_at: sale.created_at,
      farmer_name: sale.farmer_name,
      farmer_code: sale.farmer_code,
      patec_number: sale.patec_number,
      parcel_size_label: sale.parcel_size_label,
      supplier_name: supplier?.name,
      supplier_nif: supplier?.nif,
      subtotal: Number(sale.subtotal),
      iva_total: Number(sale.iva_total),
      total: Number(sale.total),
      payment_method: sale.payment_method,
      payment_status: sale.payment_status,
      items: (items || []).map((i: any) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        iva_amount: i.iva_amount,
        line_total: i.line_total,
      })),
    };
    setInvoiceData(inv);
    const hash = await generateFiscalHash(inv);
    setInvoiceHash(hash);
    setInvoiceQR(buildQRContent(inv, hash));
    setInvoiceOpen(true);
  };

  const PaginationControls = () => totalPages > 1 ? (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <p className="text-xs text-muted-foreground">
        {total.toLocaleString("pt-AO")} vendas • Página {page}/{totalPages}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Histórico de Vendas
          </h1>
          <p className="text-muted-foreground text-sm">Todas as transações MOSAP3Pay</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setSaftOpen(true)}>
          <FileDown className="h-4 w-4" /> Exportar SAF-T
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{kpis.total_count.toLocaleString("pt-AO")}</p><p className="text-xs text-muted-foreground">Total Vendas</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{Number(kpis.total_revenue).toLocaleString("pt-AO")} Kz</p><p className="text-xs text-muted-foreground">Receita Total</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{kpis.paid_count.toLocaleString("pt-AO")}</p><p className="text-xs text-muted-foreground">Pagos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-warning">{Number(kpis.pending_total).toLocaleString("pt-AO")} Kz</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome, código de venda, factura ou produtor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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

      {isError ? (
        <Card><CardContent className="p-6"><ErrorState onRetry={() => refetch()} /></CardContent></Card>
      ) : (
      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
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
                ) : paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</TableCell></TableRow>
                ) : paginated.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.sale_code}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{s.farmer_name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.farmer_code}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {s.patec_number ? <Badge variant="outline" className="text-[10px] w-fit">PATEC {s.patec_number}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        {s.parcel_size_label && <span className="text-[10px] text-muted-foreground">Parcela {s.parcel_size_label}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">{Number(s.total).toLocaleString("pt-AO")} Kz</TableCell>
                    <TableCell className="text-xs">{s.payment_method === "unitel_money" ? "Unitel Money" : s.payment_method}</TableCell>
                    <TableCell>
                      <Badge variant={s.payment_status === "pago" ? "default" : s.payment_status === "pendente" ? "secondary" : "destructive"} className="text-[10px]">
                        {s.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-AO")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openDetail(s)}>
                        <Eye className="h-3 w-3 mr-1" /> Ver
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openInvoice(s)}>
                        <Printer className="h-3 w-3 mr-1" /> Factura
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
              <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma venda encontrada</p>
            ) : paginated.map((s) => (
              <div key={s.id} className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{s.sale_code}</span>
                  <Badge variant={s.payment_status === "pago" ? "default" : s.payment_status === "pendente" ? "secondary" : "destructive"} className="text-[10px]">
                    {s.payment_status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{s.farmer_name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.farmer_code}</p>
                  </div>
                  <span className="font-bold text-sm">{Number(s.total).toLocaleString("pt-AO")} Kz</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(s.created_at).toLocaleDateString("pt-AO")}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => openDetail(s)}>Ver</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => openInvoice(s)}>Factura</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <PaginationControls />
        </CardContent>
      </Card>
      )}

      <Dialog open={!!selectedSale} onOpenChange={(o) => !o && setSelectedSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Venda {selectedSale?.sale_code}</DialogTitle></DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{selectedSale.farmer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedSale.farmer_code} • {selectedSale.patec_number ? `PATEC ${selectedSale.patec_number}` : "—"}
                  {selectedSale.parcel_size_label && ` • Parcela ${selectedSale.parcel_size_label}`}
                </p>
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
                <Badge variant={selectedSale.payment_status === "pago" ? "default" : "secondary"}>{selectedSale.payment_status}</Badge>
                <span className="text-xs text-muted-foreground">{selectedSale.payment_method === "unitel_money" ? "Unitel Money" : selectedSale.payment_method}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Factura / Recibo</DialogTitle></DialogHeader>
          {invoiceData && (<InvoicePDF data={invoiceData} hash={invoiceHash} qrContent={invoiceQR} />)}
        </DialogContent>
      </Dialog>

      <Dialog open={saftOpen} onOpenChange={setSaftOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              Exportar SAF-T (AO)
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gere o ficheiro SAF-T conforme as normas da AGT Angola para o período e fornecedor seleccionados.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={saftSupplierId} onValueChange={setSaftSupplierId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar fornecedor..." /></SelectTrigger>
                <SelectContent>
                  {saftSuppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data Início</Label><Input type="date" value={saftStartDate} onChange={(e) => setSaftStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={saftEndDate} onChange={(e) => setSaftEndDate(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSaftOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={validateSaft} disabled={validating || saftExporting} className="gap-2">
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {validating ? "A validar..." : "Validar XML"}
            </Button>
            <Button onClick={exportSaft} disabled={saftExporting || validating} className="gap-2">
              {saftExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {saftExporting ? "A gerar..." : "Exportar XML"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Validação SAF-T (AO 1.01_01)
            </DialogTitle>
          </DialogHeader>
          {validationResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border flex items-center gap-3 ${validationResult.valid ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
                {validationResult.valid ? <CheckCircle2 className="h-8 w-8 text-primary shrink-0" /> : <XCircle className="h-8 w-8 text-destructive shrink-0" />}
                <div>
                  <p className="font-bold text-lg">{validationResult.valid ? "Ficheiro válido ✓" : "Ficheiro com erros"}</p>
                  <p className="text-sm text-muted-foreground">{validationResult.errors.length} erro(s) • {validationResult.warnings.length} aviso(s)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center"><p className="text-xl font-bold">{validationResult.summary.totalInvoices}</p><p className="text-xs text-muted-foreground">Facturas</p></div>
                <div className="p-3 bg-muted/50 rounded-lg text-center"><p className="text-xl font-bold">{validationResult.summary.totalProducts}</p><p className="text-xs text-muted-foreground">Produtos</p></div>
                <div className="p-3 bg-muted/50 rounded-lg text-center"><p className="text-xl font-bold">{validationResult.summary.totalCustomers}</p><p className="text-xs text-muted-foreground">Clientes</p></div>
                <div className="p-3 bg-muted/50 rounded-lg text-center col-span-2 md:col-span-1"><p className="text-xl font-bold">{parseFloat(validationResult.summary.totalCredit || "0").toLocaleString("pt-AO")} Kz</p><p className="text-xs text-muted-foreground">Total Crédito</p></div>
                <div className="p-3 bg-muted/50 rounded-lg text-center col-span-2"><p className="text-sm font-medium">{validationResult.summary.period}</p><p className="text-xs text-muted-foreground">Período • Ano Fiscal {validationResult.summary.fiscalYear}</p></div>
              </div>
              {validationResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" /> Erros ({validationResult.errors.length})</h3>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1">
                      {validationResult.errors.map((err: any, i: number) => (
                        <div key={i} className="p-2 bg-destructive/5 border border-destructive/10 rounded text-xs">
                          <div className="flex items-start gap-2"><Badge variant="destructive" className="text-[9px] shrink-0">{err.code}</Badge><div><p className="font-medium">{err.message}</p><p className="text-muted-foreground font-mono text-[10px]">{err.path}</p></div></div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              {validationResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" /> Avisos ({validationResult.warnings.length})</h3>
                  <ScrollArea className="max-h-40">
                    <div className="space-y-1">
                      {validationResult.warnings.map((warn: any, i: number) => (
                        <div key={i} className="p-2 bg-warning/5 border border-warning/10 rounded text-xs">
                          <div className="flex items-start gap-2"><Badge variant="secondary" className="text-[9px] shrink-0">{warn.code}</Badge><div><p className="font-medium">{warn.message}</p><p className="text-muted-foreground font-mono text-[10px]">{warn.path}</p></div></div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              {validationResult.valid && validationResult.warnings.length === 0 && (
                <div className="p-3 bg-primary/5 rounded-lg text-center">
                  <CheckCircle2 className="h-6 w-6 text-primary mx-auto mb-1" />
                  <p className="text-sm font-medium">Ficheiro SAF-T em total conformidade com as normas AGT</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setValidationOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayVendas;
