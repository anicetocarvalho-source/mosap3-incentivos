import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  Search,
  Eye,
  FileDown,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Calculator,
  TrendingUp,
  Wallet,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { InvoicePDF, generateFiscalHash, buildQRContent, type InvoiceData } from "@/components/InvoicePDF";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

const PAGE_SIZE = 15;

interface Sale {
  id: string;
  sale_code: string;
  invoice_number: string | null;
  supplier_id: string;
  farmer_code: string;
  farmer_name: string;
  patec_number: number | null;
  parcel_size_label: string | null;
  subtotal: number;
  iva_total: number;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

interface CreditNoteRef {
  id: string;
  credit_note_number: string;
  original_sale_id: string | null;
  status: string;
  iva_total: number;
}

interface SupplierCtx {
  supplier: { id: string; name: string };
}

type SortColumn = "invoice_number" | "farmer_name" | "total" | "iva_total" | "created_at";

const FornecedorFacturas = () => {
  const { supplier } = useOutletContext<SupplierCtx>();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterQuarter, setFilterQuarter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fiscal panel year/quarter (independent of table filter)
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState<string>(String(currentYear));
  const [fiscalQuarter, setFiscalQuarter] = useState<string>("all");

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceHash, setInvoiceHash] = useState("");
  const [invoiceQR, setInvoiceQR] = useState("");

  // Queries scoped to this supplier
  const invoicesQuery = useQuery({
    queryKey: ["fornecedor", "facturas", supplier?.id],
    enabled: !!supplier?.id,
    queryFn: async (): Promise<Sale[]> => {
      const { data, error } = await supabase
        .from("pos_sales")
        .select("*")
        .eq("supplier_id", supplier.id)
        .not("invoice_number", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Sale[]) || [];
    },
  });

  const creditNotesQuery = useQuery({
    queryKey: ["fornecedor", "facturas-cn", supplier?.id],
    enabled: !!supplier?.id,
    queryFn: async (): Promise<CreditNoteRef[]> => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("id, credit_note_number, original_sale_id, status, iva_total")
        .eq("supplier_id", supplier.id);
      if (error) throw error;
      return (data as CreditNoteRef[]) || [];
    },
  });

  const invoices = invoicesQuery.data ?? [];
  const creditNotes = creditNotesQuery.data ?? [];
  const loading = invoicesQuery.isLoading;
  const loadError = invoicesQuery.error ? (invoicesQuery.error as Error).message : null;

  useEffect(() => {
    if (invoicesQuery.error) toast.error("Erro ao carregar facturas");
  }, [invoicesQuery.error]);

  const ncBySaleId = useMemo(() => {
    const map = new Map<string, CreditNoteRef>();
    creditNotes
      .filter((cn) => cn.original_sale_id && cn.status === "emitida")
      .forEach((cn) => map.set(cn.original_sale_id!, cn));
    return map;
  }, [creditNotes]);

  const years = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((i) => set.add(new Date(i.created_at).getFullYear().toString()));
    if (!set.has(String(currentYear))) set.add(String(currentYear));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [invoices, currentYear]);

  const getQuarter = (d: Date) => Math.floor(d.getMonth() / 3) + 1;

  // Table filtering
  const filtered = useMemo(() => {
    return invoices
      .filter((s) => {
        const term = search.toLowerCase();
        const matchSearch =
          !term ||
          (s.invoice_number || "").toLowerCase().includes(term) ||
          s.sale_code.toLowerCase().includes(term) ||
          s.farmer_name.toLowerCase().includes(term) ||
          s.farmer_code.toLowerCase().includes(term);
        const matchStatus = filterStatus === "all" || s.payment_status === filterStatus;
        const d = new Date(s.created_at);
        const matchYear = filterYear === "all" || d.getFullYear().toString() === filterYear;
        const matchQuarter = filterQuarter === "all" || String(getQuarter(d)) === filterQuarter;
        return matchSearch && matchStatus && matchYear && matchQuarter;
      })
      .sort((a, b) => {
        let c = 0;
        switch (sortColumn) {
          case "invoice_number":
            c = (a.invoice_number || "").localeCompare(b.invoice_number || "");
            break;
          case "farmer_name":
            c = a.farmer_name.localeCompare(b.farmer_name);
            break;
          case "total":
            c = Number(a.total) - Number(b.total);
            break;
          case "iva_total":
            c = Number(a.iva_total) - Number(b.iva_total);
            break;
          case "created_at":
            c = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
        }
        return sortDirection === "asc" ? c : -c;
      });
  }, [invoices, search, filterStatus, filterYear, filterQuarter, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  const SortHeader = ({ column, children, className }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer hover:bg-muted/50 transition-colors ${className || ""}`} onClick={() => handleSort(column)}>
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />)}
      </div>
    </TableHead>
  );

  // KPIs (table-filtered)
  const totalCount = filtered.length;
  const totalRevenue = filtered.reduce((s, i) => s + Number(i.total), 0);
  const ivaPaidPagas = filtered
    .filter((i) => i.payment_status === "pago")
    .reduce((s, i) => s + Number(i.iva_total), 0);
  const ivaNcFiltered = filtered
    .map((i) => ncBySaleId.get(i.id))
    .filter((cn): cn is CreditNoteRef => !!cn)
    .reduce((s, cn) => s + Number(cn.iva_total), 0);
  const ivaToLiquidate = Math.max(0, ivaPaidPagas - ivaNcFiltered);
  const withNcCount = filtered.filter((i) => ncBySaleId.has(i.id)).length;

  // Fiscal panel (independent year/quarter)
  const fiscalScope = useMemo(() => {
    const matchPeriod = (d: Date) => {
      if (fiscalYear !== "all" && d.getFullYear().toString() !== fiscalYear) return false;
      if (fiscalQuarter !== "all" && String(getQuarter(d)) !== fiscalQuarter) return false;
      return true;
    };
    const periodInvoices = invoices.filter((i) => matchPeriod(new Date(i.created_at)) && i.payment_status === "pago");
    const subtotal = periodInvoices.reduce((s, i) => s + Number(i.subtotal), 0);
    const ivaLiquidado = periodInvoices.reduce((s, i) => s + Number(i.iva_total), 0);
    const totalFacturado = periodInvoices.reduce((s, i) => s + Number(i.total), 0);
    const periodNcs = creditNotes.filter((cn) => {
      if (cn.status !== "emitida" || !cn.original_sale_id) return false;
      const sale = invoices.find((i) => i.id === cn.original_sale_id);
      if (!sale) return false;
      return matchPeriod(new Date(sale.created_at));
    });
    const ivaNc = periodNcs.reduce((s, cn) => s + Number(cn.iva_total), 0);
    const ivaLiquido = Math.max(0, ivaLiquidado - ivaNc);
    return { subtotal, ivaLiquidado, totalFacturado, ivaNc, ivaLiquido, count: periodInvoices.length, ncCount: periodNcs.length };
  }, [invoices, creditNotes, fiscalYear, fiscalQuarter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterYear, filterQuarter]);

  const openInvoice = async (sale: Sale) => {
    const { data: items } = await supabase.from("pos_sale_items").select("*").eq("sale_id", sale.id);
    const { data: sup } = await supabase.from("suppliers").select("name, nif").eq("id", sale.supplier_id).maybeSingle();
    const inv: InvoiceData = {
      sale_code: sale.sale_code,
      invoice_number: sale.invoice_number || undefined,
      created_at: sale.created_at,
      farmer_name: sale.farmer_name,
      farmer_code: sale.farmer_code,
      patec_number: sale.patec_number,
      parcel_size_label: sale.parcel_size_label,
      supplier_name: sup?.name,
      supplier_nif: sup?.nif,
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

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error("Sem facturas para exportar"); return; }
    const header = ["Nº Factura","Código Venda","Data","Produtor","Código Produtor","Subtotal (Kz)","IVA (Kz)","Total (Kz)","Estado","Nota de Crédito","IVA NC (Kz)"];
    const rows = filtered.map((s) => {
      const cn = ncBySaleId.get(s.id);
      return [
        s.invoice_number || "",
        s.sale_code,
        new Date(s.created_at).toLocaleDateString("pt-AO"),
        s.farmer_name,
        s.farmer_code,
        Number(s.subtotal).toFixed(2),
        Number(s.iva_total).toFixed(2),
        Number(s.total).toFixed(2),
        s.payment_status,
        cn?.credit_note_number || "",
        cn ? Number(cn.iva_total).toFixed(2) : "",
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facturas_${supplier.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const variant: "default" | "secondary" | "destructive" =
      status === "pago" ? "default" : status === "pendente" ? "secondary" : "destructive";
    const label = status === "pago" ? "Pago" : status === "pendente" ? "Pendente" : status === "cancelado" ? "Cancelado" : status;
    return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
  };

  const fmt = (n: number) => n.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <LoadingState message="A carregar facturas..." />;
  if (loadError) return <ErrorState title="Erro ao carregar facturas" description={loadError} onRetry={() => invoicesQuery.refetch()} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Facturas (Série FT)
          </h1>
          <p className="text-sm text-muted-foreground">
            Documentos fiscais emitidos pela sua loja — apoio à contabilidade e conformidade AGT.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <FileDown className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3.5 w-3.5" /> Facturas
            </div>
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">no período filtrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Receita Total
            </div>
            <p className="text-2xl font-bold">{fmt(totalRevenue)} Kz</p>
            <p className="text-[10px] text-muted-foreground mt-1">com IVA incluído</p>
          </CardContent>
        </Card>
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-warning-foreground/80 text-xs mb-1">
              <Wallet className="h-3.5 w-3.5" /> IVA a Liquidar
            </div>
            <p className="text-2xl font-bold text-warning-foreground">{fmt(ivaToLiquidate)} Kz</p>
            <p className="text-[10px] text-muted-foreground mt-1">líquido de NC activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="h-3.5 w-3.5" /> Notas de Crédito
            </div>
            <p className="text-2xl font-bold">{withNcCount}</p>
            <p className="text-[10px] text-muted-foreground mt-1">facturas com NC associada</p>
          </CardContent>
        </Card>
      </div>

      {/* Fiscal Summary panel */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" /> Resumo Fiscal — IVA a entregar à AGT
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={fiscalYear} onValueChange={setFiscalYear}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fiscalQuarter} onValueChange={setFiscalQuarter}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ano completo</SelectItem>
                  <SelectItem value="1">Q1 (Jan–Mar)</SelectItem>
                  <SelectItem value="2">Q2 (Abr–Jun)</SelectItem>
                  <SelectItem value="3">Q3 (Jul–Set)</SelectItem>
                  <SelectItem value="4">Q4 (Out–Dez)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Subtotal (sem IVA)</p>
              <p className="font-semibold">{fmt(fiscalScope.subtotal)} Kz</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">IVA Liquidado (14%)</p>
              <p className="font-semibold text-primary">{fmt(fiscalScope.ivaLiquidado)} Kz</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Facturado</p>
              <p className="font-semibold">{fmt(fiscalScope.totalFacturado)} Kz</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">IVA NC (a deduzir)</p>
              <p className="font-semibold text-destructive">− {fmt(fiscalScope.ivaNc)} Kz</p>
            </div>
            <div className="space-y-1 rounded-md bg-warning/10 border border-warning/40 p-2">
              <p className="text-[11px] text-warning-foreground/80 uppercase tracking-wide">IVA Líquido a Pagar</p>
              <p className="font-bold text-warning-foreground text-lg">{fmt(fiscalScope.ivaLiquido)} Kz</p>
            </div>
          </div>
          <Separator className="my-3" />
          <p className="text-[11px] text-muted-foreground">
            Base: {fiscalScope.count} factura(s) paga(s) • {fiscalScope.ncCount} nota(s) de crédito activa(s) no período seleccionado.
            Cálculo conforme regime geral do IVA (taxa 14%) — utilize estes valores como apoio à entrega trimestral à AGT.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar Nº factura, código venda, produtor..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterQuarter} onValueChange={setFilterQuarter}>
                <SelectTrigger><SelectValue placeholder="Trimestre" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table (desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader column="invoice_number">Nº Factura</SortHeader>
                <SortHeader column="created_at">Data</SortHeader>
                <SortHeader column="farmer_name">Produtor</SortHeader>
                <TableHead className="text-right">Subtotal</TableHead>
                <SortHeader column="iva_total" className="text-right">IVA</SortHeader>
                <SortHeader column="total" className="text-right">Total</SortHeader>
                <TableHead>Estado</TableHead>
                <TableHead>NC</TableHead>
                <TableHead className="text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground text-sm">
                    Nenhuma factura encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((s) => {
                  const cn = ncBySaleId.get(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          {cn && <Lock className="h-3 w-3 text-muted-foreground" />}
                          {s.invoice_number}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-normal">{s.sale_code}</div>
                      </TableCell>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString("pt-AO")}</TableCell>
                      <TableCell>
                        <div className="text-sm">{s.farmer_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{s.farmer_code}</div>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{fmt(Number(s.subtotal))}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-primary font-medium">{fmt(Number(s.iva_total))}</TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">{fmt(Number(s.total))}</TableCell>
                      <TableCell><StatusBadge status={s.payment_status} /></TableCell>
                      <TableCell>
                        {cn ? (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Lock className="h-2.5 w-2.5" /> {cn.credit_note_number}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openInvoice(s)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                {filtered.length} registos • Página {page}/{totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden divide-y rounded-lg border bg-card">
        {paginated.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Nenhuma factura encontrada.</div>
        ) : (
          paginated.map((s) => {
            const cn = ncBySaleId.get(s.id);
            return (
              <div key={s.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold flex items-center gap-1.5">
                      {cn && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {s.invoice_number}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-AO")}</p>
                  </div>
                  <StatusBadge status={s.payment_status} />
                </div>
                <div className="text-sm">{s.farmer_name}</div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div><span className="text-muted-foreground">Subtotal:</span> {fmt(Number(s.subtotal))}</div>
                  <div><span className="text-muted-foreground">IVA:</span> <span className="text-primary font-medium">{fmt(Number(s.iva_total))}</span></div>
                  <div><span className="text-muted-foreground">Total:</span> <span className="font-semibold">{fmt(Number(s.total))}</span></div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  {cn ? (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Lock className="h-2.5 w-2.5" /> {cn.credit_note_number}
                    </Badge>
                  ) : <span />}
                  <Button variant="ghost" size="sm" onClick={() => openInvoice(s)}>
                    <Eye className="h-4 w-4 mr-1" /> Ver
                  </Button>
                </div>
              </div>
            );
          })
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs text-muted-foreground">Pág. {page}/{totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice modal */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Factura {invoiceData?.invoice_number || invoiceData?.sale_code}</DialogTitle>
          </DialogHeader>
          {invoiceData && <InvoicePDF data={invoiceData} hash={invoiceHash} qrContent={invoiceQR} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedorFacturas;
