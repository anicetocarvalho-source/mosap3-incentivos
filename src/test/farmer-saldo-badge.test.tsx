/**
 * Testes do badge de Saldo do POS.
 *
 * Garante que o badge usado na lista de sugestões do POS:
 *  - calcula o saldo via `computeSaldoFinal(valor_recebido, total_gasto)`;
 *  - mostra texto verde quando saldo > 0;
 *  - mostra texto vermelho + "sem saldo" quando saldo ≤ 0;
 *  - aceita strings nos formatos PT-AO ("200.000,00") e EN-US ("200,000.00");
 *  - aplica as cores HSL no modo Kiosk e os tokens semânticos no modo standard.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FarmerSaldoBadge } from "@/components/pos/FarmerSaldoBadge";

describe("FarmerSaldoBadge — variant standard", () => {
  it("mostra saldo positivo com cor success e sem rótulo 'sem saldo'", () => {
    render(<FarmerSaldoBadge valor_recebido="200.000,00" total_gasto="50.000,00" />);
    const value = screen.getByTestId("farmer-saldo-value");
    expect(value.textContent).toContain("150.000");
    expect(value.className).toContain("text-success");
    expect(value.className).not.toContain("text-destructive");
    expect(screen.queryByTestId("farmer-saldo-empty")).toBeNull();
  });

  it("mostra saldo zero com cor destructive e rótulo 'sem saldo'", () => {
    render(<FarmerSaldoBadge valor_recebido="100.000,00" total_gasto="100.000,00" />);
    const value = screen.getByTestId("farmer-saldo-value");
    expect(value.className).toContain("text-destructive");
    const empty = screen.getByTestId("farmer-saldo-empty");
    expect(empty.textContent).toBe("sem saldo");
  });

  it("trata gasto > recebido como 'sem saldo' (nunca negativo)", () => {
    render(<FarmerSaldoBadge valor_recebido="50.000,00" total_gasto="80.000,00" />);
    const value = screen.getByTestId("farmer-saldo-value");
    // computeSaldoFinal devolve 0, nunca negativo
    expect(value.textContent).toContain("0");
    expect(value.className).toContain("text-destructive");
    expect(screen.getByTestId("farmer-saldo-empty")).toBeInTheDocument();
  });

  it("trata null/undefined como 'sem saldo'", () => {
    render(<FarmerSaldoBadge valor_recebido={null} total_gasto={null} />);
    expect(screen.getByTestId("farmer-saldo-value").className).toContain("text-destructive");
    expect(screen.getByTestId("farmer-saldo-empty")).toBeInTheDocument();
  });

  it("aceita formato EN-US ('200,000.00')", () => {
    render(<FarmerSaldoBadge valor_recebido="200,000.00" total_gasto="50,000.00" />);
    const value = screen.getByTestId("farmer-saldo-value");
    expect(value.textContent).toContain("150.000");
    expect(value.className).toContain("text-success");
  });

  it("aceita números directamente", () => {
    render(<FarmerSaldoBadge valor_recebido={300000} total_gasto={100000} />);
    const value = screen.getByTestId("farmer-saldo-value");
    expect(value.textContent).toContain("200.000");
    expect(value.className).toContain("text-success");
  });
});

describe("FarmerSaldoBadge — variant kiosk", () => {
  it("usa HSL verde quando há saldo", () => {
    render(<FarmerSaldoBadge variant="kiosk" valor_recebido="100.000,00" total_gasto="0" />);
    const value = screen.getByTestId("farmer-saldo-value");
    expect(value.className).toContain("text-[hsl(120,60%,55%)]");
    expect(screen.queryByTestId("farmer-saldo-empty")).toBeNull();
  });

  it("usa HSL vermelho e mostra 'sem saldo' quando saldo ≤ 0", () => {
    render(<FarmerSaldoBadge variant="kiosk" valor_recebido="0" total_gasto="0" />);
    const value = screen.getByTestId("farmer-saldo-value");
    expect(value.className).toContain("text-[hsl(0,70%,60%)]");
    expect(screen.getByTestId("farmer-saldo-empty").textContent).toBe("sem saldo");
  });
});
