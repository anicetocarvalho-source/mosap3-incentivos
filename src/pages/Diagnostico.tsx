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

interface ClientErrorRow {
  id: string;
  message: string;
  url: string | null;
  user_agent: string | null;
  app_version: string | null;
  created_at: string;
}

interface ErrorSummary {
  total24h: number;
  recent: ClientErrorRow[];
}

export default function Diagnostico() {
  const { user, roles, isOfflineSession } = useAuth();
  const isOnline = useOnlineStatus();
  const [results, setResults] = useState<RowResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingSync, setPendingSync] = useState<number>(0);
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null);
  const isAdmin = roles.includes("admin");

  const refreshPending = async () => {
    try {
      setPendingSync(await getPendingCount());
    } catch {
      setPendingSync(0);
    }
  };

  const refreshErrors = async () => {
    if (!isAdmin) return;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ count }, { data }] = await Promise.all([
        supabase
          .from("client_errors")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since),
        supabase
          .from("client_errors")
          .select("id, message, url, user_agent, app_version, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      setErrorSummary({ total24h: count ?? 0, recent: (data ?? []) as ClientErrorRow[] });
    } catch {
      setErrorSummary(null);
    }
  };

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
    await refreshPending();
    await refreshErrors();
  };

  const handleForceSync = async () => {
    if (!navigator.onLine) {
      toast.error("Sem ligação. Reconecte para sincronizar.");
      return;
    }
    const res = await syncAll();
    toast.success(`Sincronizado: ${res.synced} ok, ${res.failed} falhas.`);
    await refreshPending();
  };

  const handleCleanupNotifications = async () => {
    const { data, error } = await supabase.rpc("cleanup_old_notifications");
    if (error) {
      toast.error(`Falhou: ${error.message}`);
      return;
    }
    const row = (data as any[])?.[0];
    toast.success(`Apagadas: ${row?.deleted_read ?? 0} lidas + ${row?.deleted_unread ?? 0} não lidas.`);
  };

  const handleCleanupErrors = async () => {
    const { data, error } = await supabase.rpc("cleanup_old_client_errors");
    if (error) {
      toast.error(`Falhou: ${error.message}`);
      return;
    }
    toast.success(`Apagados ${data ?? 0} erros antigos (>30 dias).`);
    await refreshErrors();
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
          <h1 className="text-2xl font-bold">Diagnóstico</h1>
          <p className="text-sm text-muted-foreground">
            Saúde do sistema, sessão actual, RLS por tabela e erros recentes do cliente.
          </p>
        </div>
        <Button onClick={run} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "A executar..." : "Recarregar"}
        </Button>
      </div>

      {/* Saúde do sistema */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{isOnline ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-destructive" />}Ligação</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{isOnline ? "Online" : "Offline"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Cloud className="h-4 w-4" />Fila de sync</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSync}</div>
            {pendingSync > 0 && (
              <Button size="sm" variant="outline" className="mt-2" onClick={handleForceSync}>Forçar sync</Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertOctagon className="h-4 w-4" />Erros 24h</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isAdmin ? errorSummary?.total24h ?? "—" : "—"}</div>
            {!isAdmin && <p className="text-xs text-muted-foreground">Só admins</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ambiente</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm font-mono">{APP_VERSION}</div>
            <Badge variant={isDevOrPreview() ? "outline" : "secondary"} className="mt-2">
              {isDevOrPreview() ? "Dev / Preview" : "Produção"}
            </Badge>
          </CardContent>
        </Card>
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

      {/* Erros recentes (admin) */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Erros recentes do cliente</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCleanupErrors}>Apagar &gt;30d</Button>
              <Button size="sm" variant="outline" onClick={handleCleanupNotifications}>Limpar notificações antigas</Button>
            </div>
          </CardHeader>
          <CardContent>
            {!errorSummary || errorSummary.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem erros registados nas últimas 24h. 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Versão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorSummary.recent.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleString("pt-PT")}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={e.message}>{e.message}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={e.url ?? ""}>{e.url ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{e.app_version ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

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
