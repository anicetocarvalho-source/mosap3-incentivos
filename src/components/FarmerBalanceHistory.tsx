import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, ArrowUp, ArrowDown, Wallet, Receipt, Scale } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

type Row = {
  id: string;
  field: "valor_recebido" | "total_gasto" | "saldo_final";
  old_value: string | null;
  new_value: string | null;
  delta: number | null;
  source: string;
  notes: string | null;
  created_at: string;
};

const FIELD_META: Record<Row["field"], { label: string; icon: any; color: string }> = {
  valor_recebido: { label: "Valor recebido", icon: Wallet, color: "text-success" },
  total_gasto: { label: "Total gasto", icon: Receipt, color: "text-warning" },
  saldo_final: { label: "Saldo final", icon: Scale, color: "text-primary" },
};

const SOURCE_LABELS: Record<string, string> = {
  edicao_manual: "Edição manual",
  import_unitel_money_2026_04: "Importação Unitel Money (Abr/2026)",
  recalc_inicial: "Recálculo inicial",
  associacao_telefone_orfao: "Associação telefone órfão",
  pos_sale: "Venda POS",
  recalc_transactions: "Recálculo de transações",
};

const formatKz = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function FarmerBalanceHistory({ farmerCode }: { farmerCode: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("farmer_balance_history")
        .select("id, field, old_value, new_value, delta, source, notes, created_at")
        .eq("farmer_code", farmerCode)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        setRows((data as Row[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [farmerCode]);

  // Última alteração por campo
  const lastByField = (() => {
    const m: Partial<Record<Row["field"], Row>> = {};
    for (const r of rows) {
      if (!m[r.field]) m[r.field] = r;
    }
    return m;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Histórico de Saldos</h3>
      </div>

      {/* Última importação por campo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(FIELD_META) as Row["field"][]).map((f) => {
          const r = lastByField[f];
          const meta = FIELD_META[f];
          const Icon = meta.icon;
          return (
            <Card key={f} className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
              </div>
              {r ? (
                <>
                  <div className="text-sm font-semibold">{r.new_value || "0,00"} Kz</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {SOURCE_LABELS[r.source] ?? r.source}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(r.created_at), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Sem alterações registadas</div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Timeline */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b bg-muted/40">
          <span className="text-sm font-medium">Linha temporal de alterações</span>
          <span className="text-xs text-muted-foreground ml-2">
            {rows.length === 100 ? "(últimas 100)" : `(${rows.length})`}
          </span>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma alteração registada ainda.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const meta = FIELD_META[r.field];
              const Icon = meta.icon;
              const positive = (r.delta ?? 0) > 0;
              const negative = (r.delta ?? 0) < 0;
              return (
                <li key={r.id} className="p-3 flex items-start gap-3">
                  <div className={`mt-0.5 ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{meta.label}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {SOURCE_LABELS[r.source] ?? r.source}
                      </Badge>
                      {r.delta !== null && r.delta !== 0 && (
                        <span
                          className={`text-xs font-semibold inline-flex items-center gap-0.5 ${
                            positive ? "text-success" : negative ? "text-destructive" : ""
                          }`}
                        >
                          {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {formatKz(Math.abs(r.delta))} Kz
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.old_value ? <><span className="line-through">{r.old_value}</span> → </> : "Inicial → "}
                      <span className="font-medium text-foreground">{r.new_value || "0,00"}</span>
                    </div>
                    {r.notes && (
                      <div className="text-xs text-muted-foreground italic mt-0.5">{r.notes}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(r.created_at), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
