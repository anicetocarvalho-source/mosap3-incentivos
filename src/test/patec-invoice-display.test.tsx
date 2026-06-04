/**
 * Garante que o código e a data de validade do PATEC aparecem
 * (ou ficam ausentes) no recibo/factura nos quatro cenários:
 *   - com PATEC (código + validade)
 *   - sem PATEC
 * Cobre o componente partilhado pelo Kiosk e pelo Terminal POS
 * (`InvoicePDF`), que é o único renderer do recibo imprimível.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoicePDF, type InvoiceData } from "@/components/InvoicePDF";

const baseInvoice: InvoiceData = {
  sale_code: "S-001",
  invoice_number: "FT MOSAP3PAY/2026/1",
  created_at: "2026-06-04T10:00:00.000Z",
  farmer_name: "João Teste",
  farmer_code: "AGRI-0001",
  farmer_phone: "923000000",
  supplier_name: "Loja Teste",
  supplier_nif: "5417000000",
  subtotal: 1000,
  iva_total: 140,
  total: 1140,
  payment_method: "unitel_money",
  payment_status: "pago",
  items: [
    { product_name: "Adubo", quantity: 1, unit_price: 1000, iva_rate: 14, iva_amount: 140, line_total: 1140 },
  ],
};

const renderInvoice = (overrides: Partial<InvoiceData>) =>
  render(
    <InvoicePDF
      data={{ ...baseInvoice, ...overrides }}
      hash="abcd1234"
      qrContent="A:000;B:Loja"
    />,
  );

describe("InvoicePDF — exibição PATEC no resumo/recibo", () => {
  it("com PATEC: mostra número, código e data de validade (Kiosk/Terminal)", () => {
    renderInvoice({
      patec_number: 1,
      patec_code: "PATEC-MILHO-2026",
      patec_valid_until: "2026-12-31",
    });

    expect(screen.getByText(/PATEC 1.*PATEC-MILHO-2026/)).toBeInTheDocument();
    // pt-AO renderiza dd/mm/aaaa
    expect(screen.getByText(/Válido até:\s*31\/12\/2026/)).toBeInTheDocument();
  });

  it("com PATEC mas sem código: mostra apenas o número (sem ' — ')", () => {
    renderInvoice({
      patec_number: 2,
      patec_code: null,
      patec_valid_until: "2026-10-15",
    });

    const patecLine = screen.getByText(/PATEC 2/);
    expect(patecLine).toBeInTheDocument();
    expect(patecLine.textContent).not.toMatch(/—/);
    expect(screen.getByText(/Válido até:\s*15\/10\/2026/)).toBeInTheDocument();
  });

  it("sem PATEC: não renderiza linha PATEC nem 'Válido até'", () => {
    renderInvoice({
      patec_number: null,
      patec_code: null,
      patec_valid_until: null,
    });

    expect(screen.queryByText(/PATEC\s+\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Válido até:/)).not.toBeInTheDocument();
  });

  it("com PATEC mas sem validade carregada: mostra código sem linha de validade", () => {
    renderInvoice({
      patec_number: 3,
      patec_code: "PATEC-HORTI",
      patec_valid_until: null,
    });

    expect(screen.getByText(/PATEC 3.*PATEC-HORTI/)).toBeInTheDocument();
    expect(screen.queryByText(/Válido até:/)).not.toBeInTheDocument();
  });
});
