/**
 * Badge de saldo do produtor usado nas listas de sugestão do POS.
 *
 * Regras (consistentes com a fonte canónica `computeSaldoFinal`):
 *  - saldo > 0  → texto verde com o valor formatado.
 *  - saldo ≤ 0 → texto vermelho com o valor + sufixo "sem saldo".
 *
 * `variant="kiosk"` aplica as cores HSL inline usadas no modo Kiosk (tema escuro
 * dedicado); `variant="standard"` usa os tokens semânticos `text-success` /
 * `text-destructive` do design system.
 */
import { computeSaldoFinal, formatKzCompact } from "@/lib/numberFormat";

export interface FarmerSaldoBadgeProps {
  valor_recebido: string | number | null | undefined;
  total_gasto: string | number | null | undefined;
  variant?: "standard" | "kiosk";
}

export const FarmerSaldoBadge = ({
  valor_recebido,
  total_gasto,
  variant = "standard",
}: FarmerSaldoBadgeProps) => {
  const saldo = computeSaldoFinal(valor_recebido, total_gasto);
  const hasSaldo = saldo > 0;

  if (variant === "kiosk") {
    return (
      <div className="text-right shrink-0" data-testid="farmer-saldo-badge">
        <p
          className={`text-[11px] font-semibold ${hasSaldo ? "text-[hsl(120,60%,55%)]" : "text-[hsl(0,70%,60%)]"}`}
          data-testid="farmer-saldo-value"
        >
          {formatKzCompact(saldo)}
        </p>
        {!hasSaldo && (
          <p className="text-[9px] text-[hsl(0,70%,60%)] leading-none" data-testid="farmer-saldo-empty">
            sem saldo
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-right shrink-0" data-testid="farmer-saldo-badge">
      <p
        className={`text-xs font-semibold ${hasSaldo ? "text-success" : "text-destructive"}`}
        data-testid="farmer-saldo-value"
      >
        {formatKzCompact(saldo)}
      </p>
      {!hasSaldo && (
        <p className="text-[10px] text-destructive leading-none" data-testid="farmer-saldo-empty">
          sem saldo
        </p>
      )}
    </div>
  );
};
