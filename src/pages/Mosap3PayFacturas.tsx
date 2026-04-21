import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Receipt,
  Search,
  Eye,
  Printer,
  FileDown,
  Lock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { InvoicePDF, generateFiscalHash, buildQRContent, type InvoiceData } from "@/components/InvoicePDF";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/hooks/useAuth";

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
}

interface Supplier {
  id: string;
  name: string;
}

const Mosap3PayFacturas = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceHash, setInvoiceHash] = useState("");
  const [invoiceQR, setInvoiceQR] = useState("");

  // ---- Queries ----
  const invoicesQuery = useQuery({
    queryKey: ["mosap3pay", "facturas"],
    queryFn: async (): Promise<Sale[]> => {
      const { data, error } = await supabase
        .from("pos_sales")
        .select("*")
        .not("invoice_number", "is", null)
        .neq("payment_status", "cancelado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Sale[]) || [];
    },
  });

  const creditNotesQuery = useQuery({
    queryKey: ["mosap3pay", "facturas-cn-refs"],
    queryFn: async (): Promise<CreditNoteRef[]> => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("id, credit_note_number, original_sale_id, status");
      if (error) throw error;
      return (data as CreditNoteRef[]) || [];
    },
  });

  const suppliersQuery = useQuery({
    queryKey: ["mosap3pay", "facturas-suppliers"],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return (data as Supplier[]) || [];
    },
  });

  const invoices = invoicesQuery.data ?? [];
  const creditNotes = creditNotesQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const loading = invoicesQuery.isLoading;
  const loadError = invoicesQuery.error ? (invoicesQuery.error as Error).message : null;

  useEffect(() => {
    if (invoicesQuery.error) toast.error("Erro ao carregar facturas");
  }, [invoicesQuery.error]);

  // Map sale_id -> credit note (active)
  const ncBySaleId = useMemo(() => {
    const map = new Map<string, CreditNoteRef>();
    creditNotes
      .filter((cn) => cn.original_sale_id && cn.status === "emitida")
      .forEach((cn) => map.set(cn.original_sale_id!, cn));
    return map;
  }, [creditNotes]);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || "—";

  // ---- Filters ----
  const years = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((i) => set.add(new Date(i.created_at).getFullYear().toString()));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [invoices]);

  const filtered = invoices.filter((s) => {
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      (s.invoice_number || "").toLowerCase().includes(term) ||
      s.sale_code.toLowerCase().includes(term) ||
      s.farmer_name.toLowerCase().includes(term) ||
      s.farmer_code.toLowerCase().includes(term);
    const matchStatus = filterStatus === "all" || s.payment_status === filterStatus;
    const matchYear = filterYear === "all" || new Date(s.created_at).getFullYear().toString() === filterYear;
    const matchSupplier = filterSupplier === "all" || s.supplier_id === filterSupplier;
    return matchSearch && matchStatus && matchYear && matchSupplier;
  });

  // ---- KPIs (filtered) ----
  const totalCount = filtered.length;
  const totalSubtotal = filtered.reduce((s, i) => s + Number(i.subtotal), 0);
  const totalIva = filtered.reduce((s, i) => s + Number(i.iva_total), 0);
  const withNcCount = filtered.filter((i) => ncBySaleId.has(i.id)).length;

  // ---- Pagination ----
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterYear, filterSupplier]);

  // ---- Print invoice ----
  const openInvoice = async (sale: Sale) => {
    const { data: items } = await supabase.from("pos_sale_items").select("*").eq("sale_id", sale.id);
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("name, nif")
      .eq("id", sale.supplier_id)
      .maybeSingle();

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

  // ---- CSV export ----
  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("Sem facturas para exportar");
      return;
    }
    const header = [
      "Nº Factura",
      "Código Venda",
      "Data",
      "Produtor",
      "Código Produtor",
      "Fornecedor",
      "Subtotal",
      "IVA",
      "Total",
      "Estado",
      "Nota de Crédito",
    ];
    const rows = filtered.map((s) => [
      s.invoice_number || "",
      s.sale_code,
      new Date(s.created_at).toLocaleDateString("pt-AO"),
      s.farmer_name,
      s.farmer_code,
      supplierName(s.supplier_id),
      Number(s.subtotal).toFixed(2),
      Number(s.iva_total).toFixed(2),
      Number(s.total).toFixed(2),
      s.payment_status,
      ncBySaleId.get(s.id)?.credit_note_number || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `facturas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const variant: "default" | "secondary" | "destructive" =
      status === "pago" ? "default" : status === "pendente" ? "secondary" : "destructive";
    const label =
      status === "pago" ? "Pago" : status === "pendente" ? "Pendente" : status === "cancelado" ? "Cancelado" : status;
    return (
      <Badge variant={variant} className="text-[10px]">
        {label}
      </Badge>
    );
  };

  const PaginationControls = () =>
    totalPages > 1 ? (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <p className="text-xs text-muted-foreground">
          {filtered.length} registos • Página {page}/{totalPages}
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Facturas (Série FT)
          </h1>
          <p className="text-muted-foreground text-sm">
            Documentos fiscais emitidos — conformidade AGT
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV}>
          <FileDown className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total de Facturas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalSubtotal.toLocaleString("pt-AO")} Kz</p>
            <p className="text-xs text-muted-foreground">Receita (Subtotal)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalIva.toLocaleString("pt-AO")} Kz</p>
            <p className="text-xs text-muted-foreground">IVA Liquidado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{withNcCount}</p>
            <p className="text-xs text-muted-foreground">Com NC associada</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar Nº Factura, código, produtor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger>
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {suppliers.length > 1 && (
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="md:col-span-1">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table / Cards */}
      {loadError ? (
        <Card>
          <CardContent className="p-6">
            <ErrorState onRetry={() => invoicesQuery.refetch()} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Factura</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Produtor</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>NC</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Nenhuma factura encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((s) => {
                      const nc = ncBySaleId.get(s.id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            <div className="flex items-center gap-1.5">
                              {nc && <Lock className="h-3 w-3 text-muted-foreground" />}
                              {s.invoice_number}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-normal">{s.sale_code}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString("pt-AO")}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{s.farmer_name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.farmer_code}</p>
                          </TableCell>
                          <TableCell className="text-sm">{supplierName(s.supplier_id)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {Number(s.subtotal).toLocaleString("pt-AO")} Kz
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {Number(s.iva_total).toLocaleString("pt-AO")} Kz
                          </TableCell>
                          <TableCell className="text-right font-bold text-sm">
                            {Number(s.total).toLocaleString("pt-AO")} Kz
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={s.payment_status} />
                          </TableCell>
                          <TableCell>
                            {nc ? (
                              <Link to="/mosap3pay/notas-credito">
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {nc.credit_note_number}
                                </Badge>
                              </Link>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => openInvoice(s)}
                                title="Imprimir / PDF"
                              >
                                <Printer className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => openInvoice(s)}
                                title="Ver detalhe"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Carregando...</p>
              ) : paginated.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma factura encontrada</p>
              ) : (
                paginated.map((s) => {
                  const nc = ncBySaleId.get(s.id);
                  return (
                    <div key={s.id} className="p-3 space-y-1.5" onClick={() => openInvoice(s)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {nc && <Lock className="h-3 w-3 text-muted-foreground" />}
                          <span className="font-mono text-xs font-semibold text-primary">
                            {s.invoice_number}
                          </span>
                        </div>
                        <StatusBadge status={s.payment_status} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{s.farmer_name}</span>
                        <span className="font-bold text-sm">
                          {Number(s.total).toLocaleString("pt-AO")} Kz
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{supplierName(s.supplier_id)}</span>
                        <span>{new Date(s.created_at).toLocaleDateString("pt-AO")}</span>
                      </div>
                      {nc && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          NC {nc.credit_note_number}
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <PaginationControls />
          </CardContent>
        </Card>
      )}

      {/* Invoice/PDF dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Factura {invoiceData?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {invoiceData && (
            <InvoicePDF data={invoiceData} hash={invoiceHash} qrContent={invoiceQR} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayFacturas;
