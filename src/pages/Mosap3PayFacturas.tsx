import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerTable, useDebouncedValue } from "@/hooks/useServerTable";
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
  ChevronUp,
  ChevronDown,
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
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [page, setPage] = useState(1);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<"invoice_number" | "farmer_name" | "supplier" | "total" | "created_at">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceHash, setInvoiceHash] = useState("");
  const [invoiceQR, setInvoiceQR] = useState("");

  // Credit Note dialog state
  const [ncOpen, setNcOpen] = useState(false);
  const [ncSale, setNcSale] = useState<Sale | null>(null);
  const [ncItems, setNcItems] = useState<Array<{ id: string; product_name: string; quantity: number; unit_price: number; iva_rate: number }>>([]);
  const [ncSelectedQty, setNcSelectedQty] = useState<Record<string, number>>({});
  const [ncReason, setNcReason] = useState("");
  const [ncSubmitting, setNcSubmitting] = useState(false);

  // ---- Queries ----
  const invoicesQuery = useQuery({
    queryKey: ["mosap3pay", "facturas"],
    queryFn: async (): Promise<Sale[]> => {
      const { data, error } = await supabase
        .from("pos_sales")
        .select("*")
        .not("invoice_number", "is", null)
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
  }).sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case "invoice_number":
        comparison = (a.invoice_number || "").localeCompare(b.invoice_number || "");
        break;
      case "farmer_name":
        comparison = a.farmer_name.localeCompare(b.farmer_name);
        break;
      case "supplier":
        comparison = supplierName(a.supplier_id).localeCompare(supplierName(b.supplier_id));
        break;
      case "total":
        comparison = Number(a.total) - Number(b.total);
        break;
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Sort handler
  const handleSort = (column: "invoice_number" | "farmer_name" | "supplier" | "total" | "created_at") => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  
  const SortHeader = ({ column, children }: { column: "invoice_number" | "farmer_name" | "supplier" | "total" | "created_at"; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column && (
          sortDirection === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />
        )}
      </div>
    </TableHead>
  );

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

  // ---- Open Credit Note dialog (pre-filled) ----
  const openCreditNote = async (sale: Sale) => {
    if (sale.payment_status !== "pago") {
      toast.error("Só é possível emitir NC para facturas pagas");
      return;
    }
    if (ncBySaleId.has(sale.id)) {
      toast.error("Esta factura já tem uma Nota de Crédito activa");
      return;
    }
    const { data, error } = await supabase.from("pos_sale_items").select("*").eq("sale_id", sale.id);
    if (error) {
      toast.error("Erro ao carregar itens da factura");
      return;
    }
    const items = (data || []) as any[];
    setNcSale(sale);
    setNcItems(
      items.map((i) => ({
        id: i.id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        iva_rate: Number(i.iva_rate),
      })),
    );
    const sel: Record<string, number> = {};
    items.forEach((i) => { sel[i.id] = i.quantity; });
    setNcSelectedQty(sel);
    setNcReason("");
    setNcOpen(true);
  };

  const ncTotals = useMemo(() => {
    const items = ncItems.filter((i) => (ncSelectedQty[i.id] || 0) > 0);
    const sub = items.reduce((s, i) => s + i.unit_price * (ncSelectedQty[i.id] || 0), 0);
    const iva = items.reduce((s, i) => s + i.unit_price * (ncSelectedQty[i.id] || 0) * (i.iva_rate / 100), 0);
    return { sub, iva, total: sub + iva };
  }, [ncItems, ncSelectedQty]);

  const submitCreditNote = async () => {
    if (!ncSale || !ncReason.trim()) {
      toast.error("Indique o motivo da Nota de Crédito");
      return;
    }
    const itemsToCredit = ncItems.filter((i) => (ncSelectedQty[i.id] || 0) > 0);
    if (itemsToCredit.length === 0) {
      toast.error("Seleccione pelo menos um item para creditar");
      return;
    }
    setNcSubmitting(true);
    try {
      let subtotal = 0;
      let ivaTotal = 0;
      const cnItems = itemsToCredit.map((item) => {
        const qty = ncSelectedQty[item.id];
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
        _supplier_id: ncSale.supplier_id,
        _year: year,
      });
      const { data: cn, error } = await supabase
        .from("credit_notes")
        .insert({
          credit_note_number: ncNumber || `NC ${year}/00001`,
          supplier_id: ncSale.supplier_id,
          original_sale_id: ncSale.id,
          farmer_code: ncSale.farmer_code,
          farmer_name: ncSale.farmer_name,
          reason: ncReason.trim(),
          subtotal: Math.round(subtotal * 100) / 100,
          iva_total: Math.round(ivaTotal * 100) / 100,
          total,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from("credit_note_items")
        .insert(cnItems.map((i) => ({ ...i, credit_note_id: cn.id })));

      // Adjust farmer balance
      const { data: farmerData } = await supabase
        .from("farmers")
        .select("saldo_final, total_gasto")
        .eq("code", ncSale.farmer_code)
        .maybeSingle();
      if (farmerData) {
        const parseCurrency = (v: string | null) =>
          parseFloat((v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
        const currentSaldo = parseCurrency(farmerData.saldo_final);
        const currentGasto = parseCurrency(farmerData.total_gasto);
        const newSaldo = Math.round((currentSaldo + total) * 100) / 100;
        const newGasto = Math.round(Math.max(0, currentGasto - total) * 100) / 100;
        await supabase
          .from("farmers")
          .update({
            saldo_final: newSaldo.toFixed(2).replace(".", ","),
            total_gasto: newGasto.toFixed(2).replace(".", ","),
          })
          .eq("code", ncSale.farmer_code);
      }

      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        user_name: user?.email,
        action: "credit_note_issued",
        entity_type: "credit_note",
        entity_id: cn.id,
        details: {
          credit_note_number: cn.credit_note_number,
          supplier_id: ncSale.supplier_id,
          original_sale_id: ncSale.id,
          original_sale_code: ncSale.sale_code,
          original_invoice_number: ncSale.invoice_number,
          original_sale_total: Number(ncSale.total),
          farmer_code: ncSale.farmer_code,
          farmer_name: ncSale.farmer_name,
          reason: ncReason.trim(),
          subtotal: Math.round(subtotal * 100) / 100,
          iva_total: Math.round(ivaTotal * 100) / 100,
          total,
          items_credited: cnItems.map((i) => ({
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            line_total: i.line_total,
          })),
          balance_adjusted: true,
          source: "facturas_page",
        },
      });

      toast.success(`Nota de Crédito ${cn.credit_note_number} emitida`);
      setNcOpen(false);
      setNcSale(null);
      creditNotesQuery.refetch();
    } catch (e: any) {
      toast.error("Erro ao emitir NC: " + (e.message || "desconhecido"));
    } finally {
      setNcSubmitting(false);
    }
  };

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
            <SelectItem value="cancelado">Cancelado</SelectItem>
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
                    <SortHeader column="invoice_number">Nº Factura</SortHeader>
                    <SortHeader column="created_at">Data</SortHeader>
                    <SortHeader column="farmer_name">Produtor</SortHeader>
                    <SortHeader column="supplier">Fornecedor</SortHeader>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <SortHeader column="total">Total</SortHeader>
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
                            <Link to={`/mosap3pay/facturas/${s.id}`} className="hover:underline">
                              <div className="flex items-center gap-1.5">
                                {nc && <Lock className="h-3 w-3 text-muted-foreground" />}
                                {s.invoice_number}
                              </div>
                              <p className="text-[10px] text-muted-foreground font-normal">{s.sale_code}</p>
                            </Link>
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
                              {s.payment_status === "pago" && !nc && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-destructive hover:text-destructive"
                                  onClick={() => openCreditNote(s)}
                                  title="Emitir Nota de Crédito"
                                >
                                  <FileText className="h-3 w-3" />
                                </Button>
                              )}
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
                      <div className="flex items-center justify-between gap-2">
                        {nc ? (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            NC {nc.credit_note_number}
                          </Badge>
                        ) : (
                          <span />
                        )}
                        {s.payment_status === "pago" && !nc && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] text-destructive border-destructive/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreditNote(s);
                            }}
                          >
                            <FileText className="h-3 w-3 mr-1" /> Emitir NC
                          </Button>
                        )}
                      </div>
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

      {/* Credit Note dialog (pre-filled from invoice) */}
      <Dialog open={ncOpen} onOpenChange={setNcOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Emitir Nota de Crédito
            </DialogTitle>
          </DialogHeader>
          {ncSale && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg flex justify-between items-start">
                <div>
                  <p className="font-mono font-semibold text-primary text-sm">
                    {ncSale.invoice_number}
                  </p>
                  <p className="text-sm font-medium">{ncSale.farmer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ncSale.farmer_code} • {new Date(ncSale.created_at).toLocaleDateString("pt-AO")}
                  </p>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  Total original
                  <br />
                  <span className="font-bold text-foreground text-sm">
                    {Number(ncSale.total).toLocaleString("pt-AO")} Kz
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Itens a creditar (ajuste quantidades)</Label>
                {ncItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 border rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Max: {item.quantity} × {item.unit_price.toLocaleString("pt-AO")} Kz
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={ncSelectedQty[item.id] ?? 0}
                      onChange={(e) =>
                        setNcSelectedQty((prev) => ({
                          ...prev,
                          [item.id]: Math.min(Number(e.target.value), item.quantity),
                        }))
                      }
                      className="w-20 text-center"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Motivo da Nota de Crédito *</Label>
                <Textarea
                  placeholder="Ex: Devolução de produto danificado, erro na facturação..."
                  value={ncReason}
                  onChange={(e) => setNcReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{ncTotals.sub.toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA</span>
                  <span>{ncTotals.iva.toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg text-destructive">
                  <span>Total NC</span>
                  <span>{ncTotals.total.toLocaleString("pt-AO", { maximumFractionDigits: 2 })} Kz</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNcOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={submitCreditNote}
              disabled={ncSubmitting || !ncSale || !ncReason.trim() || ncTotals.total <= 0}
              className="gap-2"
            >
              {ncSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {ncSubmitting ? "A emitir..." : "Emitir NC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayFacturas;
