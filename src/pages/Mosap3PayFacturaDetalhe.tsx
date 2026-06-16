import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Receipt,
  Printer,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Building2,
  User,
  Calendar,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { supabase } from "@/integrations/supabase/client";
import {
  InvoicePDF,
  generateFiscalHash,
  buildQRContent,
  type InvoiceData,
} from "@/components/InvoicePDF";
import { usePatecLabel } from "@/hooks/usePatecLabel";

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    pago: { label: "Paga", cls: "bg-success/10 text-success border-success/20" },
    pendente: { label: "Pendente", cls: "bg-warning/10 text-warning border-warning/20" },
    cancelado: { label: "Cancelada", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const cfg = map[status] || { label: status, cls: "bg-muted" };
  return (
    <Badge variant="outline" className={cfg.cls}>
      {cfg.label}
    </Badge>
  );
};

const Mosap3PayFacturaDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const [hash, setHash] = useState("");
  const [qr, setQr] = useState("");
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const { labelByLegacy: patecLabel } = usePatecLabel({ activeOnly: false });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["factura-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: sale, error: saleErr } = await supabase
        .from("pos_sales")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (saleErr) throw saleErr;
      if (!sale) throw new Error("Factura não encontrada");

      const [{ data: items }, { data: supplier }, { data: cn }] = await Promise.all([
        supabase.from("pos_sale_items").select("*").eq("sale_id", sale.id).order("created_at"),
        supabase.from("suppliers").select("name, nif, phone, email, address").eq("id", sale.supplier_id).maybeSingle(),
        supabase.from("credit_notes").select("*").eq("original_sale_id", sale.id).maybeSingle(),
      ]);

      let cnItems: any[] = [];
      if (cn) {
        const { data: ci } = await supabase
          .from("credit_note_items")
          .select("*")
          .eq("credit_note_id", cn.id);
        cnItems = ci || [];
      }

      return { sale, items: items || [], supplier, creditNote: cn, cnItems };
    },
  });

  useEffect(() => {
    if (!data) return;
    const inv: InvoiceData = {
      sale_code: data.sale.sale_code,
      invoice_number: data.sale.invoice_number || undefined,
      created_at: data.sale.created_at,
      farmer_name: data.sale.farmer_name,
      farmer_code: data.sale.farmer_code,
      farmer_phone: data.sale.farmer_phone,
      patec_number: data.sale.patec_number,
      patec_label: data.sale.patec_number ? patecLabel(data.sale.patec_number) : null,
      parcel_size_label: data.sale.parcel_size_label,
      supplier_name: data.supplier?.name,
      supplier_nif: data.supplier?.nif,
      subtotal: Number(data.sale.subtotal),
      iva_total: Number(data.sale.iva_total),
      total: Number(data.sale.total),
      payment_method: data.sale.payment_method,
      payment_status: data.sale.payment_status,
      items: data.items.map((i: any) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        iva_rate: Number(i.iva_rate),
        iva_amount: Number(i.iva_amount),
        line_total: Number(i.line_total),
      })),
    };
    setInvoiceData(inv);
    generateFiscalHash(inv).then((h) => {
      setHash(h);
      setQr(buildQRContent(inv, h));
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground">A carregar factura…</div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <ErrorState
          title="Factura indisponível"
          description={(error as Error)?.message || "Esta factura não pôde ser carregada."}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const { sale, items, supplier, creditNote, cnItems } = data;
  const dateStr = new Date(sale.created_at).toLocaleString("pt-AO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const isLocked = !!creditNote;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/mosap3pay/facturas">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Facturas
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              {sale.invoice_number || `Factura ${sale.sale_code}`}
              {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
            </h1>
            <p className="text-sm text-muted-foreground">
              Documento fiscal Série FT • Conformidade AGT
            </p>
          </div>
        </div>
        <Button onClick={() => setPrintOpen(true)} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      {/* Credit Note alert */}
      {creditNote && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">
                  Esta factura tem uma Nota de Crédito associada
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{creditNote.credit_note_number}</span> emitida em{" "}
                  {new Date(creditNote.created_at).toLocaleDateString("pt-AO")} •{" "}
                  {Number(creditNote.total).toLocaleString("pt-AO")} Kz creditados
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium">Motivo:</span> {creditNote.reason}
                </p>
              </div>
            </div>
            <Link to="/mosap3pay/notas-credito">
              <Button variant="outline" size="sm">
                Ver NC
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Meta + Parties grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Emissão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-medium text-sm">{dateStr}</p>
            <p className="text-xs text-muted-foreground font-mono">Cód. venda: {sale.sale_code}</p>
            <div className="pt-2"><StatusBadge status={sale.payment_status} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Emitente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 text-sm">
            <p className="font-semibold">{supplier?.name || "—"}</p>
            <p className="text-xs">NIF: {supplier?.nif || "—"}</p>
            {supplier?.phone && <p className="text-xs text-muted-foreground">{supplier.phone}</p>}
            {supplier?.address && (
              <p className="text-xs text-muted-foreground line-clamp-2">{supplier.address}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              <User className="h-3 w-3" /> Adquirente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 text-sm">
            <p className="font-semibold">{sale.farmer_name}</p>
            <p className="text-xs">Código: {sale.farmer_code}</p>
            {sale.farmer_phone && <p className="text-xs text-muted-foreground">{sale.farmer_phone}</p>}
            {sale.patec_number && (
              <Badge variant="outline" className="mt-1 text-[10px]">{patecLabel(sale.patec_number)}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens da factura</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artigo</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.product_name}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">
                    {Number(it.unit_price).toLocaleString("pt-AO")} Kz
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {Number(it.iva_amount).toLocaleString("pt-AO")} Kz
                    <span className="text-[10px] block">({Number(it.iva_rate)}%)</span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {Number(it.line_total).toLocaleString("pt-AO")} Kz
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end p-4">
            <div className="min-w-[260px] space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{Number(sale.subtotal).toLocaleString("pt-AO")} Kz</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA</span>
                <span>{Number(sale.iva_total).toLocaleString("pt-AO")} Kz</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base text-primary">
                <span>TOTAL</span>
                <span>{Number(sale.total).toLocaleString("pt-AO")} Kz</span>
              </div>
              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                <CreditCard className="h-3 w-3" />
                {sale.payment_method === "unitel_money" ? "Unitel Money" : sale.payment_method}
                {sale.payment_reference && <span className="font-mono">• {sale.payment_reference}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NC items breakdown */}
      {creditNote && cnItems.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Itens creditados ({creditNote.credit_note_number})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artigo</TableHead>
                  <TableHead className="text-right">Qtd creditada</TableHead>
                  <TableHead className="text-right">Total creditado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cnItems.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.product_name}</TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">
                      −{Number(it.line_total).toLocaleString("pt-AO")} Kz
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Fiscal footer */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
          {qr ? (
            <QRCodeSVG value={qr} size={110} level="M" className="bg-white p-2 rounded border" />
          ) : (
            <div className="h-[110px] w-[110px] bg-muted animate-pulse rounded" />
          )}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-success" /> Validação fiscal AGT
            </div>
            <p className="text-xs text-muted-foreground">
              Hash SHA-256 do documento (formato AGT — primeiros 4 caracteres no QR):
            </p>
            <p className="font-mono text-[10px] break-all bg-background p-2 rounded border">
              {hash || "A calcular…"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Documento processado por programa certificado • MOSAP3Pay
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Print dialog */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização da Factura</DialogTitle>
          </DialogHeader>
          {invoiceData && hash && qr && (
            <InvoicePDF data={invoiceData} hash={hash} qrContent={qr} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayFacturaDetalhe;
