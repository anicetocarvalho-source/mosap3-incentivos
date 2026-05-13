import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Copy, MinusCircle, Coins, Phone, IdCard, ExternalLink,
  CheckCircle2, RefreshCw, Filter, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowsSkeleton, CardListSkeleton, StatCardsSkeleton } from "@/components/ui/loading-skeletons";
import { useAnomalies, ANOMALY_LABELS, type AnomalyType, type Anomaly } from "@/hooks/useAnomalies";
import { MarkFalsePositiveDialog } from "@/components/anomalies/MarkFalsePositiveDialog";

const TYPE_ICONS: Record<AnomalyType, any> = {
  duplicado: Copy,
  saldo_negativo: MinusCircle,
  valor_fora_escalao: Coins,
  telefone_partilhado: Phone,
  bi_partilhado: IdCard,
};

const SEVERITY_BADGE: Record<string, string> = {
  alta: "bg-destructive/15 text-destructive border-destructive/30",
  media: "bg-warning/15 text-warning border-warning/30",
  baixa: "bg-muted text-muted-foreground border-border",
};

const formatKz = (n: number) =>
  new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " Kz";

function describeDetails(a: Anomaly): string {
  switch (a.anomaly_type) {
    case "duplicado":
      return `${a.details.group_size} produtores com nome similar (${a.related_codes.join(", ")})`;
    case "saldo_negativo":
      return `Recebeu ${formatKz(a.details.recebido ?? 0)} • Gastou ${formatKz(a.details.gasto ?? 0)} • Saldo ${formatKz(a.details.saldo ?? 0)}`;
    case "valor_fora_escalao":
      return `Recebeu ${formatKz(a.details.recebido ?? 0)} (escalões esperados: 200.000 / 301.760 / 915.840)`;
    case "telefone_partilhado":
      return `Telefone ${a.details.phone} partilhado por ${a.details.group_size} produtores (${a.related_codes.join(", ")})`;
    case "bi_partilhado":
      return `BI ${a.details.bi} partilhado por ${a.details.group_size} produtores (${a.related_codes.join(", ")})`;
  }
}

export default function Anomalias() {
  const [includeResolved, setIncludeResolved] = useState(false);
  const { data, scope, loading, error, refresh } = useAnomalies(includeResolved);

  const [typeFilter, setTypeFilter] = useState<"all" | AnomalyType>("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogAnomaly, setDialogAnomaly] = useState<Anomaly | null>(null);

  const provinces = useMemo(
    () => Array.from(new Set(data.map((d) => d.province).filter(Boolean) as string[])).sort(),
    [data]
  );

  const filtered = useMemo(() => {
    return data.filter((a) => {
      if (typeFilter !== "all" && a.anomaly_type !== typeFilter) return false;
      if (provinceFilter !== "all" && a.province !== provinceFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!a.farmer_name.toLowerCase().includes(s) && !a.farmer_code.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [data, typeFilter, provinceFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { duplicado: 0, saldo_negativo: 0, valor_fora_escalao: 0, telefone_partilhado: 0, bi_partilhado: 0 };
    data.forEach((a) => { if (!a.resolved) c[a.anomaly_type] = (c[a.anomaly_type] ?? 0) + 1; });
    return c;
  }, [data]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-warning" />
            Anomalias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Casos suspeitos detectados automaticamente nos dados de produtores.
            {scope && scope.scope !== "global" && (
              <span className="ml-2 text-xs">
                ({scope.scope === "province" ? "Províncias" : "ECAs"}: {scope.filterLabel})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Switch id="resolved" checked={includeResolved} onCheckedChange={setIncludeResolved} />
            <Label htmlFor="resolved" className="cursor-pointer">Incluir resolvidos</Label>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-2 hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <StatCardsSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.keys(ANOMALY_LABELS) as AnomalyType[]).map((t) => {
            const Icon = TYPE_ICONS[t];
            const value = counts[t] ?? 0;
            return (
              <Card key={t} className={`cursor-pointer transition-colors ${typeFilter === t ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${value > 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{ANOMALY_LABELS[t]}</div>
                    <div className="text-xl font-bold">{value}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por nome ou código..." className="pl-9"
                   value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(Object.keys(ANOMALY_LABELS) as AnomalyType[]).map((t) => (
                <SelectItem key={t} value={t}>{ANOMALY_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={provinceFilter} onValueChange={setProvinceFilter}>
            <SelectTrigger><SelectValue placeholder="Província" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as províncias</SelectItem>
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {loading ? "A carregar..." : `${filtered.length} ${filtered.length === 1 ? "anomalia" : "anomalias"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-destructive">{error}</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Produtor</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead className="w-44 text-right">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRowsSkeleton rows={8} cols={5} />
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState size="sm" icon={CheckCircle2} title="Sem anomalias detectadas"
                                      description="Os dados de produtores não apresentam casos suspeitos com os filtros atuais." />
                        </TableCell>
                      </TableRow>
                    ) : filtered.map((a) => {
                      const Icon = TYPE_ICONS[a.anomaly_type];
                      return (
                        <TableRow key={`${a.anomaly_type}-${a.anomaly_key}-${a.farmer_code}`}
                                  className={a.resolved ? "opacity-60" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-medium">{ANOMALY_LABELS[a.anomaly_type]}</div>
                                <Badge variant="outline" className={`text-[10px] mt-0.5 ${SEVERITY_BADGE[a.severity]}`}>
                                  {a.severity}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{a.farmer_name}</div>
                            <div className="text-xs text-muted-foreground">{a.farmer_code}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{a.province ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {[a.municipality, a.school].filter(Boolean).join(" • ") || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-xs text-muted-foreground">{describeDetails(a)}</div>
                            {a.resolved && a.resolved_notes && (
                              <div className="text-[11px] mt-1 text-success">
                                ✓ Resolvido: {a.resolved_notes}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/agricultores/${a.farmer_code}`}>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span className="ml-1">Perfil</span>
                                </Link>
                              </Button>
                              {!a.resolved && (
                                <Button size="sm" variant="ghost" onClick={() => setDialogAnomaly(a)}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span className="ml-1">Falso +</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {loading ? (
                  <CardListSkeleton count={6} />
                ) : filtered.length === 0 ? (
                  <EmptyState size="sm" icon={CheckCircle2} title="Sem anomalias detectadas" />
                ) : filtered.map((a) => {
                  const Icon = TYPE_ICONS[a.anomaly_type];
                  return (
                    <div key={`${a.anomaly_type}-${a.anomaly_key}-${a.farmer_code}`}
                         className={`p-4 space-y-2 ${a.resolved ? "opacity-60" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{ANOMALY_LABELS[a.anomaly_type]}</div>
                            <Badge variant="outline" className={`text-[10px] ${SEVERITY_BADGE[a.severity]}`}>
                              {a.severity}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{a.farmer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.farmer_code} • {a.province ?? "—"}{a.municipality ? ` / ${a.municipality}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">{describeDetails(a)}</div>
                      {a.resolved && a.resolved_notes && (
                        <div className="text-[11px] text-success">✓ {a.resolved_notes}</div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button asChild size="sm" variant="outline" className="flex-1">
                          <Link to={`/agricultores/${a.farmer_code}`}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir perfil
                          </Link>
                        </Button>
                        {!a.resolved && (
                          <Button size="sm" variant="ghost" onClick={() => setDialogAnomaly(a)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Falso +
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MarkFalsePositiveDialog
        anomaly={dialogAnomaly}
        onClose={() => setDialogAnomaly(null)}
        onResolved={refresh}
      />
    </div>
  );
}
