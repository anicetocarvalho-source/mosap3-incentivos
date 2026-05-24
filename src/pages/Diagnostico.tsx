import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getPendingCount, syncAll } from "@/lib/offlineDb";
import { isDevOrPreview } from "@/lib/devMode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Wifi, WifiOff, Cloud, AlertOctagon } from "lucide-react";

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

const TABLES = [
  "farmers",
  "farmer_transactions",
  "farmer_incentives",
  "farmer_parcels",
  "farmer_production",
  "farmer_dependents",
  "farmer_documents",
  "farmer_balance_history",
  "livestock",
  "schools",
  "provinces",
  "municipalities",
  "suppliers",
  "supplier_products",
  "supplier_pos",
  "pos_sales",
  "credit_notes",
  "patec_items",
  "module_permissions",
  "user_roles",
  "profiles",
  "notifications",
  "audit_logs",
  "orphan_phones",
  "province_reviews",
] as const;

type RowResult = {
  table: string;
  count: number | null;
  error: string | null;
  ms: number;
};

export default function Diagnostico() {
  const { user, roles, isOfflineSession } = useAuth();
  const [results, setResults] = useState<RowResult[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const out: RowResult[] = [];
    for (const t of TABLES) {
      const start = performance.now();
      try {
        const { count, error } = await (supabase as any)
          .from(t)
          .select("*", { count: "exact", head: true });
        out.push({
          table: t,
          count: count ?? 0,
          error: error?.message ?? null,
          ms: Math.round(performance.now() - start),
        });
      } catch (e: any) {
        out.push({
          table: t,
          count: null,
          error: e?.message ?? "erro desconhecido",
          ms: Math.round(performance.now() - start),
        });
      }
      setResults([...out]);
    }
    setLoading(false);
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderStatus = (r: RowResult) => {
    if (r.error) return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Erro</Badge>;
    if ((r.count ?? 0) === 0) return <Badge variant="outline" className="gap-1 text-warning border-warning"><AlertTriangle className="h-3 w-3" />Vazio</Badge>;
    return <Badge variant="outline" className="gap-1 text-success border-success"><CheckCircle2 className="h-3 w-3" />OK</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico de Acesso</h1>
          <p className="text-sm text-muted-foreground">
            Conta linhas por tabela com a sessão actual. Útil para identificar problemas de RLS.
          </p>
        </div>
        <Button onClick={run} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "A executar..." : "Recarregar"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessão Actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">User ID:</span> <code className="text-xs">{user?.id || "—"}</code></div>
          <div><span className="text-muted-foreground">Email:</span> {user?.email || "—"}</div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Roles:</span>
            {roles.length > 0 ? roles.map(r => <Badge key={r} variant="secondary">{r}</Badge>) : <span className="text-warning">Nenhuma role atribuída</span>}
          </div>
          <div>
            <span className="text-muted-foreground">Sessão offline:</span> {isOfflineSession ? <Badge variant="outline" className="text-warning border-warning">Sim</Badge> : "Não"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contagem por Tabela ({results.length}/{TABLES.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabela</TableHead>
                <TableHead className="text-right">Linhas</TableHead>
                <TableHead className="text-right">Tempo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.table}>
                  <TableCell className="font-mono text-xs">{r.table}</TableCell>
                  <TableCell className="text-right font-semibold">{r.count ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">{r.ms}ms</TableCell>
                  <TableCell>{renderStatus(r)}</TableCell>
                  <TableCell className="text-xs text-destructive max-w-md truncate" title={r.error || ""}>
                    {r.error || ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
