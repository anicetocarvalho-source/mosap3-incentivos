import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  History,
  ArrowUp,
  ArrowDown,
  Wallet,
  Receipt,
  Scale,
  ShoppingCart,
  Gift,
  FileText,
  ArrowLeftRight,
  ExternalLink,
} from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

type BalanceRow = {
  id: string;
  field: "valor_recebido" | "total_gasto" | "saldo_final";
  old_value: string | null;
  new_value: string | null;
  delta: number | null;
  source: string;
  notes: string | null;
  created_at: string;
};

type EventKind = "saldo" | "transacao" | "venda_pos" | "incentivo" | "documento";

type TimelineEvent = {
  id: string;
  kind: EventKind;
  /** ISO string (data de negócio com fallback para created_at) */
  date: string;
  /** True quando a data exibida vem de um campo de negócio explícito */
  hasBusinessDate: boolean;
  title: string;
  description?: string;
  amount?: number | null;
  direction?: "in" | "out" | "neutral" | null;
  source?: string;
  href?: string;
};

const FIELD_META: Record<BalanceRow["field"], { label: string; icon: any; color: string }> = {
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

const KIND_META: Record<EventKind, { label: string; icon: any; color: string }> = {
  saldo: { label: "Saldo", icon: Scale, color: "text-primary" },
  transacao: { label: "Transação", icon: ArrowLeftRight, color: "text-info" },
  venda_pos: { label: "Venda POS", icon: ShoppingCart, color: "text-warning" },
  incentivo: { label: "Incentivo", icon: Gift, color: "text-success" },
  documento: { label: "Documento", icon: FileText, color: "text-muted-foreground" },
};

const formatKz = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Converte string PT-AO ("1.234,56") ou ISO em número. */
const toNumber = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * Normaliza qualquer string de data para ISO. Aceita:
 *  - ISO ("2026-04-12T...")
 *  - "YYYY-MM-DD"
 *  - "DD/MM/YYYY" ou "DD-MM-YYYY"
 * Devolve null se inválida ou vazia.
 */
const parseBusinessDate = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO direto
  const iso = parseISO(s);
  if (isValid(iso)) return iso.toISOString();

  // DD/MM/YYYY ou DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isValid(d)) return d.toISOString();
  }

  // YYYY-MM-DD (fallback explícito)
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    if (isValid(d)) return d.toISOString();
  }

  return null;
};

/**
 * Resolve a data de um evento usando data de negócio com fallback consistente.
 * Devolve { date, hasBusinessDate }.
 */
const resolveEventDate = (
  business: string | null | undefined,
  createdAt: string,
): { date: string; hasBusinessDate: boolean } => {
  const b = parseBusinessDate(business);
  if (b) return { date: b, hasBusinessDate: true };
  return { date: createdAt, hasBusinessDate: false };
};

const formatDate = (iso: string, withTime = true) => {
  const d = new Date(iso);
  if (!isValid(d)) return "—";
  return format(d, withTime ? "dd MMM yyyy 'às' HH:mm" : "dd MMM yyyy", { locale: pt });
};

export default function FarmerBalanceHistory({ farmerCode }: { farmerCode: string }) {
  const [balanceRows, setBalanceRows] = useState<BalanceRow[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKinds, setActiveKinds] = useState<Set<EventKind>>(
    new Set(["saldo", "transacao", "venda_pos", "incentivo", "documento"]),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const [balanceRes, txRes, salesRes, incRes, docsRes] = await Promise.all([
        supabase
          .from("farmer_balance_history")
          .select("id, field, old_value, new_value, delta, source, notes, created_at")
          .eq("farmer_code", farmerCode)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("farmer_transactions")
          .select("id, product, empresa, valor, transaction_date, created_at")
          .eq("farmer_code", farmerCode),
        supabase
          .from("pos_sales")
          .select("id, sale_code, invoice_number, total, payment_status, created_at")
          .eq("farmer_code", farmerCode),
        supabase
          .from("farmer_incentives")
          .select("id, incentive_code, type, amount, status, method, incentive_date, created_at")
          .eq("farmer_code", farmerCode),
        supabase
          .from("farmer_documents")
          .select("id, file_name, file_type, created_at")
          .eq("farmer_code", farmerCode),
      ]);

      if (cancelled) return;

      const balance = (balanceRes.data as BalanceRow[]) || [];
      setBalanceRows(balance);

      const merged: TimelineEvent[] = [];

      // 1) Histórico de saldo (data de negócio = created_at)
      for (const r of balance) {
        const meta = FIELD_META[r.field];
        const sign = (r.delta ?? 0) > 0 ? "in" : (r.delta ?? 0) < 0 ? "out" : "neutral";
        merged.push({
          id: `bal-${r.id}`,
          kind: "saldo",
          date: r.created_at,
          hasBusinessDate: true,
          title: `${meta?.label ?? r.field} alterado`,
          description: `${r.old_value ?? "—"} → ${r.new_value ?? "—"}${r.notes ? ` · ${r.notes}` : ""}`,
          amount: r.delta,
          direction: sign,
          source: SOURCE_LABELS[r.source] ?? r.source,
        });
      }

      // 2) Transações manuais (transaction_date com fallback created_at)
      for (const t of (txRes.data || []) as any[]) {
        const { date, hasBusinessDate } = resolveEventDate(t.transaction_date, t.created_at);
        const amount = toNumber(t.valor);
        merged.push({
          id: `tx-${t.id}`,
          kind: "transacao",
          date,
          hasBusinessDate,
          title: t.product || "Transação",
          description: t.empresa || undefined,
          amount,
          direction: "out",
        });
      }

      // 3) Vendas POS (created_at é a data de negócio efetiva)
      for (const s of (salesRes.data || []) as any[]) {
        merged.push({
          id: `sale-${s.id}`,
          kind: "venda_pos",
          date: s.created_at,
          hasBusinessDate: true,
          title: `Venda ${s.invoice_number || s.sale_code}`,
          description: s.payment_status ? `Pagamento: ${s.payment_status}` : undefined,
          amount: toNumber(s.total),
          direction: "out",
          href: `/mosap3pay/facturas/${s.id}`,
        });
      }

      // 4) Incentivos (incentive_date com fallback created_at)
      for (const i of (incRes.data || []) as any[]) {
        const { date, hasBusinessDate } = resolveEventDate(i.incentive_date, i.created_at);
        merged.push({
          id: `inc-${i.id}`,
          kind: "incentivo",
          date,
          hasBusinessDate,
          title: `${i.type || "Incentivo"} ${i.incentive_code ? `· ${i.incentive_code}` : ""}`.trim(),
          description: [i.method, i.status].filter(Boolean).join(" · ") || undefined,
          amount: toNumber(i.amount),
          direction: "in",
        });
      }

      // 5) Documentos (created_at)
      for (const d of (docsRes.data || []) as any[]) {
        merged.push({
          id: `doc-${d.id}`,
          kind: "documento",
          date: d.created_at,
          hasBusinessDate: true,
          title: d.file_name || "Documento",
          description: d.file_type || undefined,
          direction: "neutral",
        });
      }

      // Ordenação cronológica DESC; empates resolvidos por kind+id para estabilidade.
      merged.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (db !== da) return db - da;
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.id.localeCompare(b.id);
      });

      setEvents(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [farmerCode]);

  // Última alteração por campo (para os 3 cards de topo)
  const lastByField = useMemo(() => {
    const m: Partial<Record<BalanceRow["field"], BalanceRow>> = {};
    for (const r of balanceRows) {
      if (!m[r.field]) m[r.field] = r;
    }
    return m;
  }, [balanceRows]);

  const filteredEvents = useMemo(
    () => events.filter((e) => activeKinds.has(e.kind)),
    [events, activeKinds],
  );

  const toggleKind = (k: EventKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      // Garante pelo menos um filtro ativo
      if (next.size === 0) return prev;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Histórico Financeiro</h3>
      </div>

      {/* Última alteração de saldo por campo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(FIELD_META) as BalanceRow["field"][]).map((f) => {
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
                  <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}</div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Sem alterações registadas</div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_META) as EventKind[]).map((k) => {
          const meta = KIND_META[k];
          const Icon = meta.icon;
          const active = activeKinds.has(k);
          return (
            <Button
              key={k}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => toggleKind(k)}
            >
              <Icon className="h-3 w-3 mr-1" />
              {meta.label}
            </Button>
          );
        })}
      </div>

      {/* Timeline unificada */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b bg-muted/40 flex items-center justify-between">
          <span className="text-sm font-medium">Linha temporal de eventos</span>
          <span className="text-xs text-muted-foreground">
            {filteredEvents.length} {filteredEvents.length === 1 ? "evento" : "eventos"}
          </span>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum evento registado para os filtros selecionados.
          </div>
        ) : (
          <ul className="divide-y">
            {filteredEvents.map((e) => {
              const meta = KIND_META[e.kind];
              const Icon = meta.icon;
              const positive = e.direction === "in";
              const negative = e.direction === "out";
              return (
                <li key={e.id} className="p-3 flex items-start gap-3">
                  <div className={`mt-0.5 ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm truncate">{e.title}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {meta.label}
                      </Badge>
                      {e.source && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {e.source}
                        </Badge>
                      )}
                      {e.amount !== null && e.amount !== undefined && e.amount !== 0 && (
                        <span
                          className={`text-xs font-semibold inline-flex items-center gap-0.5 ${
                            positive ? "text-success" : negative ? "text-destructive" : ""
                          }`}
                        >
                          {positive ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : negative ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : null}
                          {formatKz(Math.abs(e.amount))} Kz
                        </span>
                      )}
                      {e.href && (
                        <Link
                          to={e.href}
                          className="text-xs text-primary inline-flex items-center gap-0.5 hover:underline"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    {e.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {e.description}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <span>{formatDate(e.date)}</span>
                      {!e.hasBusinessDate && (
                        <span
                          className="text-[10px] italic text-muted-foreground/80"
                          title="Data de negócio em falta — a usar data de criação como fallback"
                        >
                          (data de registo)
                        </span>
                      )}
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
