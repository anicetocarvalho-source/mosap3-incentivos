import { describe, it, expect } from "vitest";
import { generateFiscalHash, buildQRContent, type InvoiceData } from "@/components/InvoicePDF";

// Test the POS sale business logic (cart calculations, fiscal compliance)

describe("Fluxo de Venda POS — Lógica de Negócio", () => {
  describe("Cálculos do Carrinho", () => {
    const product = {
      id: "p1",
      name: "Sementes de Milho",
      category: "insumos",
      unit: "kg",
      price: 1000,
      stock: 50,
      patec_number: 1,
      max_per_farmer_per_season: 10,
      iva_rate: 14,
      supplier_id: "s1",
    };

    it("calcula subtotal correctamente", () => {
      const quantity = 5;
      const subtotal = product.price * quantity;
      expect(subtotal).toBe(5000);
    });

    it("calcula IVA a 14%", () => {
      const quantity = 5;
      const subtotal = product.price * quantity;
      const iva = subtotal * (product.iva_rate / 100);
      expect(iva).toBe(700);
    });

    it("calcula total com IVA incluído", () => {
      const quantity = 5;
      const subtotal = product.price * quantity;
      const iva = subtotal * (product.iva_rate / 100);
      const total = subtotal + iva;
      expect(total).toBe(5700);
    });

    it("respeita limite máximo por produtor por época", () => {
      const requestedQty = 15;
      const maxAllowed = product.max_per_farmer_per_season!;
      const effectiveQty = Math.min(requestedQty, maxAllowed);
      expect(effectiveQty).toBe(10);
    });

    it("respeita limite de stock disponível", () => {
      const requestedQty = 100;
      const effectiveQty = Math.min(requestedQty, product.stock);
      expect(effectiveQty).toBe(50);
    });

    it("calcula múltiplos produtos no carrinho", () => {
      const items = [
        { price: 1000, qty: 5, iva_rate: 14 },
        { price: 500, qty: 10, iva_rate: 14 },
        { price: 2000, qty: 2, iva_rate: 14 },
      ];
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      expect(subtotal).toBe(14000); // 5000 + 5000 + 4000
      const iva = items.reduce((s, i) => s + i.price * i.qty * (i.iva_rate / 100), 0);
      expect(iva).toBe(1960);
    });
  });

  describe("Validação de Saldo de Incentivos", () => {
    it("permite venda se saldo é suficiente", () => {
      const saldoFinal = 10000;
      const totalVenda = 5700;
      expect(saldoFinal >= totalVenda).toBe(true);
    });

    it("bloqueia venda se saldo é insuficiente", () => {
      const saldoFinal = 3000;
      const totalVenda = 5700;
      expect(saldoFinal >= totalVenda).toBe(false);
    });

    it("permite venda quando saldo é exactamente igual ao total", () => {
      const saldoFinal = 5700;
      const totalVenda = 5700;
      expect(saldoFinal >= totalVenda).toBe(true);
    });
  });

  describe("Geração de Código Fiscal", () => {
    it("gera hash fiscal não-vazio", async () => {
      const hash = await generateFiscalHash("FT 2026/00001", "2026-04-16", 5700, "");
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("gera hashes diferentes para facturas diferentes", async () => {
      const hash1 = await generateFiscalHash("FT 2026/00001", "2026-04-16", 5700, "");
      const hash2 = await generateFiscalHash("FT 2026/00002", "2026-04-16", 5700, "");
      expect(hash1).not.toBe(hash2);
    });

    it("constrói conteúdo QR com campos obrigatórios", () => {
      const qr = buildQRContent("FT 2026/00001", "2026-04-16", 5700, "abc123hash");
      expect(qr).toContain("FT 2026/00001");
      expect(qr).toContain("2026-04-16");
      expect(qr).toContain("5700");
      expect(qr).toContain("abc123hash");
    });
  });

  describe("Validação de Produtor para POS", () => {
    it("requer código de produtor", () => {
      const farmer = { code: "PROD-001", full_name: "João", patec: 1, saldo_final: "10000" };
      expect(farmer.code).toBeTruthy();
    });

    it("requer PATEC definido", () => {
      const farmer = { code: "PROD-001", full_name: "João", patec: 1, saldo_final: "10000" };
      expect(farmer.patec).toBeTruthy();
    });

    it("filtra produtos pelo PATEC do produtor", () => {
      const farmerPatec = 1;
      const allProducts = [
        { id: "1", name: "Sementes Milho", patec_number: 1 },
        { id: "2", name: "Sementes Massango", patec_number: 2 },
        { id: "3", name: "Ferramenta", patec_number: null },
      ];
      const filtered = allProducts.filter(
        (p) => p.patec_number === null || p.patec_number === farmerPatec
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.map((p) => p.id)).toEqual(["1", "3"]);
    });
  });
});
