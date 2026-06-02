import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, AlertTriangle, BarChart3, Search, Filter, ExternalLink, Activity, LineChart as LineChartIcon, CheckCircle2, RotateCcw, Bell, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { formatKz } from "@/lib/numberFormat";
import {
  usePriceAnalysis,
  useAbruptPriceChanges,
  usePriceAlertReviews,
  useUpsertPriceAlertReview,
  useDeletePriceAlertReview,
  useBatchUpsertPriceAlertReview,
  type PriceAlertRow,
  type PriceAlertReview,
} from "@/hooks/usePriceAnalysis";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SEVERITY_LABELS = {
  alta: { label: "Alta", classes: "bg-destructive/15 text-destructive border-destructive/30" },
  media: { label: "Média", classes: "bg-warning/15 text-warning border-warning/30" },
  baixa: { label: "Baixo (dumping?)", classes: "bg-info/15 text-info border-info/30" },
  normal: { label: "Normal", classes: "bg-muted text-muted-foreground" },
} as const;

const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

export default function Mosap3PayAnalisePrecos() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("anormais");
  const [minSuppliers, setMinSuppliers] = useState(3);
  const [highPct, setHighPct] = useState(40);
  const [mediumPct, setMediumPct] = useState(25);
  const [abruptDays, setAbruptDays] = useState(90);
  const [abruptThreshold, setAbruptThreshold] = useState(25);
  const [evolutionProduct, setEvolutionProduct] = useState<PriceAlertRow | null>(null);
  const [reviewProduct, setReviewProduct] = useState<PriceAlertRow | null>(null);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("all");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);

  const { data: alerts = [], isLoading, error, refetch } = usePriceAnalysis({ minSuppliers, highPct, mediumPct });
  const { data: abrupt = [], isLoading: loadingAbrupt } = useAbruptPriceChanges({ days: abruptDays, thresholdPct: abruptThreshold });
  const { data: reviews = [] } = usePriceAlertReviews();

  const reviewMap = useMemo(() => {
    const m = new Map<string, PriceAlertReview>();
    reviews.forEach((r) => m.set(`${r.product_id}|${r.supplier_id}`, r));
    return m;
  }, [reviews]);

  const reviewStatusOf = (row: PriceAlertRow): "pendente" | "revisto" | "desactualizado" => {
    const r = reviewMap.get(`${row.product_id}|${row.supplier_id}`);
    if (!r) return "pendente";
    return Number(r.reviewed_price) === Number(row.current_price) ? "revisto" : "desactualizado";
  };

  const rowKey = (row: PriceAlertRow) => `${row.product_id}|${row.supplier_id}`;

  const categories = useMemo(() => {
    const set = new Set(alerts.map((a) => a.category));
    return Array.from(set).sort();
  }, [alerts]);

  // (helpers de seleção em lote movidos para depois de `visible`)

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter === "anormais" && a.severity === "normal") return false;
      if (severityFilter !== "all" && severityFilter !== "anormais" && a.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (reviewStatusFilter !== "all" && reviewStatusOf(a) !== reviewStatusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.product_name.toLowerCase().includes(q) && !a.supplier_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [alerts, severityFilter, categoryFilter, search, reviewStatusFilter, reviewMap]);

  const stats = useMemo(() => {
    const monitored = alerts.length;
    const abnormal = alerts.filter((a) => a.severity !== "normal").length;
    const high = alerts.filter((a) => a.severity === "alta").length;
    const suppliersWithAlerts = new Set(alerts.filter((a) => a.severity !== "normal").map((a) => a.supplier_id)).size;
    const pending = alerts.filter((a) => a.severity !== "normal" && reviewStatusOf(a) !== "revisto").length;
    return { monitored, abnormal, high, suppliersWithAlerts, pending };
  }, [alerts, reviewMap]);

  // Paginação / infinite scroll para a tabela de alertas
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset paginação sempre que filtros mudam
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, categoryFilter, severityFilter, reviewStatusFilter, minSuppliers, highPct, mediumPct]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  // Seleção em lote (depende de visible)
  const visibleKeys = useMemo(() => visible.map(rowKey), [visible]);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.has(k));
  const someVisibleSelected = visibleKeys.some((k) => selectedKeys.has(k)) && !allVisibleSelected;
  const selectedPending = useMemo(
    () => visible.filter((r) => selectedKeys.has(rowKey(r)) && reviewStatusOf(r) !== "revisto"),
    [visible, selectedKeys, reviewMap],
  );

  const toggleSelectAllVisible = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleKeys.forEach((k) => next.delete(k));
      } else {
        visibleKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, filtered.length]);

  // Dispatch in-app notifications for high-severity alerts (dedupe 24h in DB)
  const [dispatching, setDispatching] = useState(false);
  const autoDispatchedRef = useRef(false);
  const dispatchNotifications = async (silent = false) => {
    setDispatching(true);
    try {
      const { data, error } = await supabase.rpc("dispatch_price_alert_notifications", {
        p_min_suppliers: minSuppliers,
        p_high_pct: highPct,
        p_medium_pct: mediumPct,
        p_dedupe_hours: 24,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const created = row?.notifications_created ?? 0;
      const evaluated = row?.alerts_evaluated ?? 0;
      const skipped = row?.alerts_skipped ?? 0;
      if (!silent) {
        if (created > 0) {
          toast.success(`${created} notificações enviadas (${evaluated} alertas, ${skipped} já notificados)`);
        } else if (evaluated === 0) {
          toast.info("Sem alertas de severidade alta no momento.");
        } else {
          toast.info(`Todos os ${evaluated} alertas já foram notificados nas últimas 24h.`);
        }
      }
    } catch (e: any) {
      if (!silent) toast.error(e?.message || "Falha ao enviar notificações");
    } finally {
      setDispatching(false);
    }
  };

  // Auto-dispatch silently once per session when high-severity alerts exist
  useEffect(() => {
    if (autoDispatchedRef.current) return;
    if (isLoading) return;
    if (stats.high <= 0) return;
    autoDispatchedRef.current = true;
    dispatchNotifications(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, stats.high]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Análise de Preços"
        description="Detecte preços anormais e variações abruptas dos produtos dos fornecedores comparativamente à média de mercado."
        icon={TrendingUp}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Os gestores recebem notificações automáticas no sistema quando surgem alertas de severidade alta (anti-spam de 24h).
        </p>
        <Button size="sm" variant="outline" onClick={() => dispatchNotifications(false)} disabled={dispatching || stats.high === 0}>
          {dispatching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
          Notificar gestores agora
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Alertas activos" value={String(stats.abnormal)} icon={AlertTriangle} changeType={stats.abnormal > 0 ? "negative" : "positive"} change={stats.abnormal > 0 ? "Requer revisão" : "Tudo normal"} />
        <StatCard title="Pendentes de revisão" value={String(stats.pending)} icon={Activity} changeType={stats.pending > 0 ? "negative" : "positive"} change={stats.pending === 0 ? "Tudo revisto" : `${stats.abnormal - stats.pending} já revistos`} />
        <StatCard title="Severidade alta" value={String(stats.high)} icon={Activity} changeType={stats.high > 0 ? "negative" : "neutral"} />
        <StatCard title="Fornecedores afectados" value={String(stats.suppliersWithAlerts)} icon={AlertTriangle} />
      </div>

      {/* Limiares configuráveis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Parâmetros de detecção
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Mín. fornecedores</label>
            <Input type="number" min={2} value={minSuppliers} onChange={(e) => setMinSuppliers(Math.max(2, Number(e.target.value) || 3))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">% alta (≥)</label>
            <Input type="number" min={1} value={highPct} onChange={(e) => setHighPct(Number(e.target.value) || 40)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">% média (≥)</label>
            <Input type="number" min={1} value={mediumPct} onChange={(e) => setMediumPct(Number(e.target.value) || 25)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Variação abrupta (%)</label>
            <Input type="number" min={1} value={abruptThreshold} onChange={(e) => setAbruptThreshold(Number(e.target.value) || 25)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Janela (dias)</label>
            <Input type="number" min={1} value={abruptDays} onChange={(e) => setAbruptDays(Number(e.target.value) || 90)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="alertas">
        <TabsList>
          <TabsTrigger value="alertas">Alertas de Preço ({stats.abnormal})</TabsTrigger>
          <TabsTrigger value="variacoes">Variações Abruptas ({abrupt.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="alertas" className="space-y-3">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar produto ou fornecedor…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anormais">Apenas anormais</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="alta">Severidade alta</SelectItem>
                  <SelectItem value="media">Severidade média</SelectItem>
                  <SelectItem value="baixa">Preço suspeito (baixo)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reviewStatusFilter} onValueChange={setReviewStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Estado de revisão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="revisto">Revistos</SelectItem>
                  <SelectItem value="desactualizado">Revisão desactualizada</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {error ? (
            <ErrorState title="Erro ao carregar análise" description={(error as Error).message} onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingState label="A analisar preços de mercado…" />
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sem alertas com os filtros actuais.</CardContent></Card>
          ) : (
            <>
              {/* Toolbar de acções em lote */}
              {selectedKeys.size > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-3 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium">
                      {selectedKeys.size} seleccionado{selectedKeys.size > 1 ? "s" : ""}
                    </span>
                    {selectedPending.length > 0 && (
                      <Button size="sm" onClick={() => setBatchReviewOpen(true)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Marcar {selectedPending.length} revisto{selectedPending.length > 1 ? "s" : ""}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedKeys(new Set())}>
                      Limpar selecção
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Desktop table */}
              <Card className="hidden md:block overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Seleccionar todos visíveis" />
                      </TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Preço actual</TableHead>
                      <TableHead className="text-right">Média mercado</TableHead>
                      <TableHead className="text-right">Min / Max</TableHead>
                      <TableHead className="text-right">Desvio</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Última alteração</TableHead>
                      <TableHead>Revisão</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((row) => {
                      const sev = SEVERITY_LABELS[row.severity];
                      const rstatus = reviewStatusOf(row);
                      const rev = reviewMap.get(`${row.product_id}|${row.supplier_id}`);
                      return (
                        <TableRow key={`${row.product_id}-${row.supplier_id}`}>
                          <TableCell className="w-10">
                            <Checkbox
                              checked={selectedKeys.has(rowKey(row))}
                              onCheckedChange={() => toggleRow(rowKey(row))}
                              aria-label={`Seleccionar ${row.product_name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{row.product_name} <span className="text-muted-foreground text-xs">/ {row.unit}</span></TableCell>
                          <TableCell><Badge variant="outline">{row.category}</Badge></TableCell>
                          <TableCell>{row.supplier_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatKz(row.current_price)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{formatKz(row.avg_price)}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatKz(row.min_price, false)} / {formatKz(row.max_price, false)}</TableCell>
                          <TableCell className={`text-right font-semibold ${row.deviation_pct > 0 ? "text-destructive" : row.deviation_pct < 0 ? "text-info" : ""}`}>
                            {fmtPct(row.deviation_pct)}
                          </TableCell>
                          <TableCell><Badge className={sev.classes} variant="outline">{sev.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(row.last_changed_at)}</TableCell>
                          <TableCell className="text-xs">
                            {rstatus === "revisto" ? (
                              <div className="flex flex-col">
                                <Badge variant="outline" className="bg-success/15 text-success border-success/30 w-fit">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Revisto
                                </Badge>
                                <span className="text-muted-foreground mt-1">
                                  {rev?.reviewer_name ?? "—"} · {fmtDate(rev?.reviewed_at ?? null)}
                                </span>
                              </div>
                            ) : rstatus === "desactualizado" ? (
                              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                                <RotateCcw className="h-3 w-3 mr-1" /> Preço mudou
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted text-muted-foreground">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant={rstatus === "revisto" ? "ghost" : "outline"} onClick={() => setReviewProduct(row)} title="Marcar como revisto">
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEvolutionProduct(row)} title="Ver evolução">
                                <LineChartIcon className="h-4 w-4" />
                              </Button>
                              <Button asChild size="sm" variant="ghost" title="Ver fornecedor">
                                <Link to={`/mosap3pay/fornecedores`}><ExternalLink className="h-4 w-4" /></Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>

              {/* Mobile cards */}
              <div className="md:hidden divide-y rounded-lg border bg-card">
                {visible.map((row) => {
                  const sev = SEVERITY_LABELS[row.severity];
                  const rstatus = reviewStatusOf(row);
                  const rev = reviewMap.get(`${row.product_id}|${row.supplier_id}`);
                  return (
                    <div key={`${row.product_id}-${row.supplier_id}`} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={selectedKeys.has(rowKey(row))}
                            onCheckedChange={() => toggleRow(rowKey(row))}
                            aria-label={`Seleccionar ${row.product_name}`}
                          />
                          <div>
                            <p className="font-medium text-sm">{row.product_name}</p>
                            <p className="text-xs text-muted-foreground">{row.supplier_name} · {row.category}</p>
                          </div>
                        </div>
                        <Badge className={sev.classes} variant="outline">{sev.label}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Actual</span><br/><span className="font-mono">{formatKz(row.current_price, false)}</span></div>
                        <div><span className="text-muted-foreground">Média</span><br/><span className="font-mono">{formatKz(row.avg_price, false)}</span></div>
                        <div className={`font-semibold ${row.deviation_pct > 0 ? "text-destructive" : "text-info"}`}>{fmtPct(row.deviation_pct)}</div>
                      </div>
                      {rstatus === "revisto" ? (
                        <p className="text-xs text-success">✓ Revisto por {rev?.reviewer_name ?? "—"} · {fmtDate(rev?.reviewed_at ?? null)}</p>
                      ) : rstatus === "desactualizado" ? (
                        <p className="text-xs text-warning">⚠ Revisão desactualizada (preço alterou)</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem revisão</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEvolutionProduct(row)}>
                          <LineChartIcon className="h-3 w-3 mr-1" /> Evolução
                        </Button>
                        <Button size="sm" variant={rstatus === "revisto" ? "ghost" : "default"} onClick={() => setReviewProduct(row)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> {rstatus === "revisto" ? "Editar revisão" : "Marcar revisto"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginação / infinite scroll */}
              <div className="flex flex-col items-center gap-2 py-3 text-xs text-muted-foreground">
                <span>
                  A mostrar {visible.length} de {filtered.length} alertas
                </span>
                {hasMore ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length))}
                    >
                      Carregar mais ({Math.min(PAGE_SIZE, filtered.length - visibleCount)})
                    </Button>
                    <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
                  </>
                ) : filtered.length > PAGE_SIZE ? (
                  <span>— fim da lista —</span>
                ) : null}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="variacoes" className="space-y-3">
          {loadingAbrupt ? (
            <LoadingState label="A carregar histórico…" />
          ) : abrupt.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sem variações abruptas no período seleccionado.</CardContent></Card>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Anterior</TableHead>
                    <TableHead className="text-right">Novo</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abrupt.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="font-medium">{r.product_name}</TableCell>
                      <TableCell>{r.supplier_name}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatKz(r.previous_price)}</TableCell>
                      <TableCell className="text-right font-mono">{formatKz(r.new_price)}</TableCell>
                      <TableCell className={`text-right font-semibold ${r.change_pct > 0 ? "text-destructive" : "text-info"}`}>
                        {fmtPct(r.change_pct)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <PriceEvolutionDialog product={evolutionProduct} onClose={() => setEvolutionProduct(null)} marketAvg={evolutionProduct?.avg_price ?? 0} />
      <ReviewAlertDialog
        product={reviewProduct}
        existing={reviewProduct ? reviewMap.get(`${reviewProduct.product_id}|${reviewProduct.supplier_id}`) ?? null : null}
        onClose={() => setReviewProduct(null)}
      />
      <BatchReviewDialog
        open={batchReviewOpen}
        items={selectedPending}
        onClose={() => setBatchReviewOpen(false)}
        onSuccess={() => setSelectedKeys(new Set())}
      />
    </div>
  );
}

function ReviewAlertDialog({
  product,
  existing,
  onClose,
}: {
  product: PriceAlertRow | null;
  existing: PriceAlertReview | null;
  onClose: () => void;
}) {
  const upsert = useUpsertPriceAlertReview();
  const remove = useDeletePriceAlertReview();
  const [notes, setNotes] = useState("");

  // reset notes when opening
  useEffect(() => {
    setNotes(existing?.notes ?? "");
  }, [existing?.id, product?.product_id]);

  if (!product) return null;

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        product_id: product.product_id,
        supplier_id: product.supplier_id,
        reviewed_price: Number(product.current_price),
        notes: notes.trim() || null,
      });
      toast.success("Alerta marcado como revisto.");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível guardar a revisão.");
    }
  };

  const handleRemove = async () => {
    if (!existing) return;
    try {
      await remove.mutateAsync(existing.id);
      toast.success("Revisão removida. Alerta volta a pendente.");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível remover a revisão.");
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar alerta como revisto</DialogTitle>
          <DialogDescription>
            {product.product_name} — {product.supplier_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-muted p-2">
              <span className="text-xs text-muted-foreground">Preço actual</span><br />
              <span className="font-mono font-semibold">{formatKz(product.current_price)}</span>
            </div>
            <div className="rounded-md bg-muted p-2">
              <span className="text-xs text-muted-foreground">Desvio</span><br />
              <span className={`font-semibold ${product.deviation_pct > 0 ? "text-destructive" : "text-info"}`}>{fmtPct(product.deviation_pct)}</span>
            </div>
          </div>
          {existing && (
            <div className="rounded-md border p-2 text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Última revisão:</span>{" "}
                <span className="font-medium">{existing.reviewer_name ?? "—"}</span>
              </div>
              <div className="text-muted-foreground">{fmtDate(existing.reviewed_at)} · preço revisto {formatKz(Number(existing.reviewed_price))}</div>
              {existing.notes && <div className="text-muted-foreground italic">"{existing.notes}"</div>}
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Notas da revisão (opcional)</label>
            <Textarea
              placeholder="Ex.: confirmado com o fornecedor, justificado por aumento do custo da matéria-prima…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {existing && (
            <Button variant="ghost" onClick={handleRemove} disabled={remove.isPending}>
              Remover revisão
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> {existing ? "Actualizar revisão" : "Marcar como revisto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PriceEvolutionDialog({
  product,
  onClose,
  marketAvg,
}: {
  product: PriceAlertRow | null;
  onClose: () => void;
  marketAvg: number;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["price-evolution", product?.product_id],
    enabled: !!product,
    queryFn: async () => {
      if (!product) return [];
      const { data, error } = await supabase
        .from("product_price_history")
        .select("created_at, new_price, previous_price")
        .eq("product_id", product.product_id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []).map((r: any) => ({
        date: new Date(r.created_at).toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit" }),
        preco: Number(r.new_price),
      }));
      // Garantir pelo menos o preço actual
      if (product) rows.push({ date: "agora", preco: product.current_price });
      return rows;
    },
  });

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Evolução de preço — {product?.product_name}</DialogTitle>
        </DialogHeader>
        {!product ? null : isLoading ? (
          <LoadingState label="A carregar histórico…" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-md bg-muted p-2"><span className="text-muted-foreground">Preço actual</span><br/><span className="font-mono font-semibold">{formatKz(product.current_price)}</span></div>
              <div className="rounded-md bg-muted p-2"><span className="text-muted-foreground">Média mercado</span><br/><span className="font-mono font-semibold">{formatKz(marketAvg)}</span></div>
              <div className="rounded-md bg-muted p-2"><span className="text-muted-foreground">Desvio</span><br/><span className={`font-semibold ${product.deviation_pct > 0 ? "text-destructive" : "text-info"}`}>{fmtPct(product.deviation_pct)}</span></div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatKz(v, false)} />
                  <Tooltip formatter={(v: number) => formatKz(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="preco" stroke="hsl(var(--primary))" strokeWidth={2} dot name="Preço do fornecedor" />
                  <ReferenceLine y={marketAvg} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: "Média mercado", fontSize: 10, fill: "hsl(var(--warning))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
