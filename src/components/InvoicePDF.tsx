import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { mosapLogo, LOGO_SIZES } from "@/config/brand";

interface InvoiceItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  iva_rate?: number;
  iva_amount: number;
  line_total: number;
}

interface InvoiceData {
  sale_code: string;
  invoice_number?: string;
  created_at: string;
  farmer_name: string;
  farmer_code: string;
  farmer_phone?: string | null;
  patec_number?: number | null;
  patec_code?: string | null;
  patec_label?: string | null;
  patec_valid_until?: string | null;
  parcel_size_label?: string | null;
  supplier_name?: string;
  supplier_nif?: string;
  subtotal: number;
  iva_total: number;
  total: number;
  payment_method: string;
  payment_status: string;
  items: InvoiceItem[];
}

/** Generate SHA-256 hash for AGT fiscal compliance */
async function generateFiscalHash(data: InvoiceData): Promise<string> {
  const payload = [
    data.sale_code,
    data.created_at,
    data.total.toFixed(2),
    data.farmer_code,
    data.supplier_nif || "000000000",
  ].join(";");

  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build QR code content per AGT format */
function buildQRContent(data: InvoiceData, hash: string): string {
  const lines = [
    `A:${data.supplier_nif || "000000000"}`,
    `B:${data.supplier_name || "MOSAP3Pay"}`,
    `C:${data.farmer_code}`,
    `D:FT`,
    `E:N`,
    `F:${new Date(data.created_at).toISOString().slice(0, 10)}`,
    `G:${data.invoice_number || `FT ${data.sale_code}`}`,
    `H:${data.invoice_number || data.sale_code}`,
    `I1:AO`,
    `I7:${data.subtotal.toFixed(2)}`,
    `I8:${data.iva_total.toFixed(2)}`,
    `N:${data.iva_total.toFixed(2)}`,
    `O:${data.total.toFixed(2)}`,
    `Q:${hash.substring(0, 4)}`,
    `R:0`,
  ];
  return lines.join("*");
}

export const InvoicePDF = ({
  data,
  hash,
  qrContent,
}: {
  data: InvoiceData;
  hash: string;
  qrContent: string;
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = invoiceRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Factura ${data.sale_code}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20mm; }
          .invoice { max-width: 210mm; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1a6b3c; }
          .header-left img { height: 40px; margin-bottom: 6px; }
          .header-left h1 { font-size: 18px; color: #1a6b3c; }
          .header-left p { font-size: 10px; color: #666; }
          .header-right { text-align: right; }
          .header-right .doc-type { font-size: 14px; font-weight: 700; color: #1a6b3c; }
          .header-right .doc-number { font-size: 11px; font-family: monospace; margin-top: 2px; }
          .header-right .doc-date { font-size: 10px; color: #666; margin-top: 2px; }
          .parties { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .party { flex: 1; padding: 10px; background: #f8f9fa; border-radius: 6px; }
          .party:first-child { margin-right: 10px; }
          .party h3 { font-size: 9px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-bottom: 4px; }
          .party p { font-size: 11px; margin: 1px 0; }
          .party .name { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { background: #1a6b3c; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          th:last-child, td:last-child { text-align: right; }
          th:nth-child(3), td:nth-child(3), th:nth-child(4), td:nth-child(4) { text-align: right; }
          td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
          tr:nth-child(even) td { background: #fafafa; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
          .totals-box { min-width: 220px; }
          .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
          .totals-row.total { font-size: 14px; font-weight: 700; border-top: 2px solid #1a6b3c; padding-top: 8px; margin-top: 4px; color: #1a6b3c; }
          .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; }
          .qr-section { display: flex; align-items: center; gap: 12px; }
          .qr-section svg { border: 1px solid #ddd; padding: 4px; }
          .hash-info { font-size: 8px; color: #999; font-family: monospace; word-break: break-all; max-width: 200px; }
          .fiscal-info { text-align: right; font-size: 9px; color: #888; }
          .fiscal-info p { margin: 1px 0; }
          .payment-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .payment-paid { background: #d4edda; color: #155724; }
          .payment-pending { background: #fff3cd; color: #856404; }
          @media print { body { padding: 10mm; } @page { margin: 10mm; } }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const dateFormatted = new Date(data.created_at).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const timeFormatted = new Date(data.created_at).toLocaleTimeString("pt-AO", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="space-y-3">
      {/* Print/Download buttons */}
      <div className="flex gap-2 justify-end print:hidden">
        <Button size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Imprimir Factura
        </Button>
      </div>

      {/* Invoice preview */}
      <div ref={invoiceRef} className="bg-white text-foreground rounded-lg border p-6 text-xs" style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#1a1a1a" }}>
        <div className="invoice">
          {/* Header */}
          <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 15, borderBottom: "2px solid #1a6b3c" }}>
            <div className="header-left">
              <img src={mosapLogo} alt="MOSAP3" style={{ height: LOGO_SIZES.invoicePx, marginBottom: 6 }} />
              <h1 style={{ fontSize: 18, color: "#1a6b3c", fontWeight: 700 }}>MOSAP3Pay</h1>
              <p style={{ fontSize: 10, color: "#666" }}>Sistema de Gestão de Vendas Agrícolas</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a6b3c" }}>FACTURA / RECIBO</div>
              <div style={{ fontSize: 13, fontFamily: "monospace", marginTop: 2, fontWeight: 700 }}>{data.invoice_number || `Nº ${data.sale_code}`}</div>
              <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{dateFormatted} às {timeFormatted}</div>
            </div>
          </div>

          {/* Parties */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, gap: 10 }}>
            <div style={{ flex: 1, padding: 10, background: "#f8f9fa", borderRadius: 6 }}>
              <h3 style={{ fontSize: 9, textTransform: "uppercase", color: "#888", letterSpacing: 0.5, marginBottom: 4 }}>Emitente</h3>
              <p style={{ fontWeight: 600 }}>{data.supplier_name || "MOSAP3Pay"}</p>
              <p>NIF: {data.supplier_nif || "—"}</p>
            </div>
            <div style={{ flex: 1, padding: 10, background: "#f8f9fa", borderRadius: 6 }}>
              <h3 style={{ fontSize: 9, textTransform: "uppercase", color: "#888", letterSpacing: 0.5, marginBottom: 4 }}>Adquirente</h3>
              <p style={{ fontWeight: 600 }}>{data.farmer_name}</p>
              <p>Código: {data.farmer_code}</p>
              {data.farmer_phone && <p>Tel: {data.farmer_phone}</p>}
              {(data.patec_label || data.patec_number) && <p>{data.patec_label || `PATEC ${data.patec_number}${data.patec_code ? ` — ${data.patec_code}` : ""}`}</p>}
              {data.patec_valid_until && <p>Válido até: {new Date(data.patec_valid_until).toLocaleDateString("pt-AO")}</p>}
              {data.parcel_size_label && <p>Parcela: {data.parcel_size_label}</p>}
            </div>
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 15 }}>
            <thead>
              <tr>
                <th style={{ background: "#1a6b3c", color: "white", padding: "8px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase" }}>Artigo</th>
                <th style={{ background: "#1a6b3c", color: "white", padding: "8px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase" }}>Qtd</th>
                <th style={{ background: "#1a6b3c", color: "white", padding: "8px 10px", textAlign: "right", fontSize: 10, textTransform: "uppercase" }}>Preço Unit.</th>
                <th style={{ background: "#1a6b3c", color: "white", padding: "8px 10px", textAlign: "right", fontSize: 10, textTransform: "uppercase" }}>IVA</th>
                <th style={{ background: "#1a6b3c", color: "white", padding: "8px 10px", textAlign: "right", fontSize: 10, textTransform: "uppercase" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{item.product_name}</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee" }}>{item.quantity}</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{Number(item.unit_price).toLocaleString("pt-AO")} Kz</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{Number(item.iva_amount).toLocaleString("pt-AO")} Kz</td>
                  <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", textAlign: "right" }}>{Number(item.line_total).toLocaleString("pt-AO")} Kz</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>Subtotal</span>
                <span>{data.subtotal.toLocaleString("pt-AO")} Kz</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#666" }}>
                <span>IVA (14%)</span>
                <span>{data.iva_total.toLocaleString("pt-AO")} Kz</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTop: "2px solid #1a6b3c", fontSize: 14, fontWeight: 700, color: "#1a6b3c" }}>
                <span>TOTAL</span>
                <span>{data.total.toLocaleString("pt-AO")} Kz</span>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div style={{ marginBottom: 15, fontSize: 11 }}>
            <span>Método: {data.payment_method === "unitel_money" ? "Unitel Money" : data.payment_method} • Estado: </span>
            <span style={{
              display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              background: data.payment_status === "pago" ? "#d4edda" : "#fff3cd",
              color: data.payment_status === "pago" ? "#155724" : "#856404",
            }}>
              {data.payment_status.toUpperCase()}
            </span>
          </div>

          {/* Footer: QR + Hash */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 30, paddingTop: 15, borderTop: "1px solid #ddd" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <QRCodeSVG value={qrContent} size={80} level="M" />
              <div style={{ fontSize: 8, color: "#999", fontFamily: "monospace", wordBreak: "break-all", maxWidth: 200 }}>
                <p style={{ marginBottom: 2, fontWeight: 600 }}>Hash SHA-256:</p>
                <p>{hash}</p>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 9, color: "#888" }}>
              <p>Documento processado por programa certificado</p>
              <p>MOSAP3Pay — {data.invoice_number || data.sale_code}</p>
              <p>AGT — Administração Geral Tributária</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { generateFiscalHash, buildQRContent };
export type { InvoiceData, InvoiceItem };
