import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, TrendingDown, TrendingUp, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { parseAmount, formatKz, computeSaldoFinal } from "@/lib/numberFormat";

interface Farmer {
  code: string;
  full_name: string;
  valor_recebido?: string | null;
  total_gasto?: string | null;
  saldo_final?: string | null;
}

interface Tx {
  id: string;
  product: string;
  empresa: string;
  valor: string;
  transaction_date: string | null;
  created_at: string;
}

interface Props {
  farmer: Farmer | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const FarmerFinancialSummaryDialog = ({ farmer, open, onOpenChange }: Props) => {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !farmer) return;
    setLoading(true);
    supabase
      .from("farmer_transactions")
      .select("id, product, empresa, valor, transaction_date, created_at")
      .eq("farmer_code", farmer.code)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTxs((data as Tx[]) || []);
        setLoading(false);
      });
  }, [open, farmer]);

  if (!farmer) return null;

  const recebido = parseAmount(farmer.valor_recebido);
  const usado = parseAmount(farmer.total_gasto);
  // Saldo Final canónico: max(0, recebido − gasto). Ignora saldo_final da BD.
  const saldoFinal = computeSaldoFinal(recebido, usado);
  const totalTxs = txs.reduce((acc, t) => acc + parseAmount(t.valor), 0);
  const desvio = totalTxs - usado;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resumo Financeiro</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{farmer.full_name}</span> · <span className="font-mono text-xs">{farmer.code}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Recebido
            </div>
            <p className="text-xl font-semibold text-success tabular-nums">{formatKz(recebido)}</p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
              <TrendingDown className="h-3.5 w-3.5" /> Usado
            </div>
            <p className="text-xl font-semibold text-warning tabular-nums">{formatKz(usado)}</p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
              <Wallet className="h-3.5 w-3.5" /> Saldo
            </div>
            <p className={`text-xl font-semibold tabular-nums ${saldoFinal < 0 ? "text-destructive" : ""}`}>{formatKz(saldoFinal)}</p>
          </div>
        </div>

        {!loading && txs.length > 0 && Math.abs(desvio) > 0.01 && (
          <div className="text-xs px-3 py-2 rounded border border-warning/30 bg-warning/10 text-warning-foreground">
            <strong>Atenção:</strong> soma das {txs.length} transações ({formatKz(totalTxs)}) difere do "Usado" guardado ({formatKz(usado)}) em <strong>{formatKz(desvio)}</strong>.
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Transações ({txs.length})</h3>
            <Link to={`/agricultores/${farmer.code}`}>
              <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs">
                Ver perfil completo <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-2 font-semibold">Data</th>
                  <th className="text-left px-3 py-2 font-semibold">Produto</th>
                  <th className="text-left px-3 py-2 font-semibold">Empresa</th>
                  <th className="text-right px-3 py-2 font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : txs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-sm">
                      Sem transações registadas.
                    </td>
                  </tr>
                ) : (
                  txs.map((t) => (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {t.transaction_date || new Date(t.created_at).toLocaleDateString("pt-AO")}
                      </td>
                      <td className="px-3 py-2">{t.product}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t.empresa}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatKz(t.valor)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && txs.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKz(totalTxs)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FarmerFinancialSummaryDialog;
