import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, ShoppingCart, PiggyBank, Users } from "lucide-react";
import { formatKz } from "@/lib/numberFormat";
import type { FinancialSummary } from "@/hooks/useFinancialSummary";

interface FinancialSummaryCardsProps {
  title: string;
  data?: FinancialSummary;
  loading?: boolean;
  error?: Error | null;
}

export function FinancialSummaryCards({ title, data, loading, error }: FinancialSummaryCardsProps) {
  return (
    <section aria-labelledby="resumo-financeiro-heading" className="space-y-3">
      <h2
        id="resumo-financeiro-heading"
        className="font-heading font-semibold text-base text-foreground"
      >
        {title}
      </h2>

      {error ? (
        <Card className="p-4">
          <p className="text-sm text-destructive">
            Não foi possível carregar o resumo financeiro.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total Recebido"
            value={loading ? null : formatKz(data?.recebido ?? 0)}
            icon={<Wallet className="h-5 w-5 text-success" />}
            valueClass="text-success"
            hint={
              loading || !data
                ? undefined
                : `${data.beneficiarios} de ${data.totalFarmers} produtores`
            }
          />
          <KpiCard
            label="Total Gasto"
            value={loading ? null : formatKz(data?.gasto ?? 0)}
            icon={<ShoppingCart className="h-5 w-5 text-warning" />}
            valueClass="text-warning"
            hint={
              loading || !data
                ? undefined
                : `Taxa de utilização: ${data.utilizationPct.toFixed(1)}%`
            }
          />
          <KpiCard
            label="Saldo Final"
            value={loading ? null : formatKz(data?.saldo ?? 0)}
            icon={<PiggyBank className="h-5 w-5 text-primary" />}
            valueClass={
              (data?.saldo ?? 0) < 0 ? "text-destructive" : "text-foreground"
            }
            hint={
              loading || !data
                ? undefined
                : (data.saldo ?? 0) < 0
                ? "Saldo negativo"
                : "Disponível"
            }
          />
          <KpiCard
            label="Beneficiários"
            value={
              loading || !data
                ? null
                : `${data.beneficiarios.toLocaleString("pt-PT")}`
            }
            icon={<Users className="h-5 w-5 text-accent-foreground" />}
            valueClass="text-foreground"
            hint={
              loading || !data
                ? undefined
                : data.totalFarmers > 0
                ? `${Math.round((data.beneficiarios / data.totalFarmers) * 100)}% dos produtores`
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}

interface KpiCardProps {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  valueClass?: string;
  hint?: string;
}

function KpiCard({ label, value, icon, valueClass, hint }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {value === null ? (
            <Skeleton className="h-7 w-24 mt-1" />
          ) : (
            <p
              className={`text-lg md:text-xl font-bold font-heading tracking-tight truncate ${valueClass ?? ""}`}
              title={value}
            >
              {value}
            </p>
          )}
          {hint && <p className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</p>}
        </div>
        <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </Card>
  );
}
