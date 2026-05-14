import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Download,
  Loader2,
  School as SchoolIcon,
  RefreshCw,
} from "lucide-react";
import { useEscolasAuditoria, readAuditoriaPerfHistory, clearAuditoriaPerfHistory, type PerfMetrics } from "@/hooks/useEscolasAuditoria";
import { useMemo, useState } from "react";
import { Gauge, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const csvEscape = (v: any) => {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EscolasAuditoria = () => {
  const { data, loading, refetch } = useEscolasAuditoria();
  const [showPerf, setShowPerf] = useState(true);
  const [historyTick, setHistoryTick] = useState(0);
  const history = useMemo(() => readAuditoriaPerfHistory(), [data, historyTick]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">A executar auditoria de ECAs…</span>
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { duplicates, similar, orphans, totals } = data;

  const stats = [
    { label: "Escolas totais", value: totals.schools, color: "text-primary", bg: "bg-primary/10" },
    { label: "Nomes duplicados", value: totals.duplicateNames, color: "text-warning", bg: "bg-warning/10" },
    {
      label: "ECAs com discrepância",
      value: totals.discrepant,
      color: totals.discrepant > 0 ? "text-destructive" : "text-success",
      bg: totals.discrepant > 0 ? "bg-destructive/10" : "bg-success/10",
    },
    { label: "Pares similares", value: totals.similarPairs, color: "text-info", bg: "bg-info/10" },
    { label: "Produtores órfãos", value: totals.orphans, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title text-xl md:text-2xl flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Auditoria de ECAs
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">
            Verificação de duplicados, nomes similares e produtores órfãos por Escola de Campo
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Re-executar
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/escolas">Voltar</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
              <SchoolIcon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold font-heading leading-none">{s.value.toLocaleString("pt-AO")}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="duplicates">
        <TabsList>
          <TabsTrigger value="duplicates">Duplicados ({totals.duplicateRows})</TabsTrigger>
          <TabsTrigger value="similar">Similares ({totals.similarPairs})</TabsTrigger>
          <TabsTrigger value="orphans">Órfãos ({orphans.length})</TabsTrigger>
        </TabsList>

        {/* TAB A — Duplicados */}
        <TabsContent value="duplicates" className="mt-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Escolas com nome igual em municípios/províncias diferentes. Comparado com o cache <code>schools.total_farmers</code>.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  downloadCsv("auditoria-duplicados.csv", [
                    ["Escola", "Província", "Município", "Aldeia", "Real", "Cache", "Delta", "Estado"],
                    ...duplicates.map((d) => [
                      d.name,
                      d.province,
                      d.municipality,
                      d.village || "",
                      d.real,
                      d.cached,
                      d.delta,
                      d.ok ? "OK" : "DIFERENTE",
                    ]),
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Escola</th>
                    <th className="text-left p-2">Município</th>
                    <th className="text-left p-2">Província</th>
                    <th className="text-right p-2">Real</th>
                    <th className="text-right p-2">Cache</th>
                    <th className="text-right p-2">Δ</th>
                    <th className="text-center p-2">Estado</th>
                    <th className="text-center p-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.map((d) => (
                    <tr key={d.schoolId} className={`border-t ${!d.ok ? "bg-destructive/5" : ""}`}>
                      <td className="p-2 font-medium">{d.name}</td>
                      <td className="p-2">{d.municipality || "—"}</td>
                      <td className="p-2 text-muted-foreground">{d.province || "—"}</td>
                      <td className="p-2 text-right font-mono">{d.real}</td>
                      <td className="p-2 text-right font-mono text-muted-foreground">{d.cached}</td>
                      <td className={`p-2 text-right font-mono ${d.delta !== 0 ? "text-destructive font-semibold" : ""}`}>
                        {d.delta > 0 ? `+${d.delta}` : d.delta}
                      </td>
                      <td className="p-2 text-center">
                        {d.ok ? (
                          <Badge variant="outline" className="gap-1 border-success/40 text-success">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                            <AlertTriangle className="h-3 w-3" /> Diferente
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <Button asChild size="sm" variant="ghost" className="gap-1 h-7">
                          <Link to={`/escolas/${d.schoolId}`}>
                            <ExternalLink className="h-3 w-3" />
                            Abrir
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {duplicates.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-muted-foreground text-sm">
                        Sem nomes duplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB B — Similares */}
        <TabsContent value="similar" className="mt-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Pares de ECAs com nomes muito parecidos (potenciais erros ortográficos ou variações).
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  downloadCsv("auditoria-similares.csv", [
                    ["Nome A", "Município A", "Província A", "Produtores A", "Nome B", "Município B", "Província B", "Produtores B", "Distância", "Motivo"],
                    ...similar.map((s) => [
                      s.a.name, s.a.municipality, s.a.province, s.a.farmers,
                      s.b.name, s.b.municipality, s.b.province, s.b.farmers,
                      s.distance, s.reason,
                    ]),
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Escola A</th>
                    <th className="text-left p-2">Local A</th>
                    <th className="text-right p-2">Prod. A</th>
                    <th className="text-left p-2">Escola B</th>
                    <th className="text-left p-2">Local B</th>
                    <th className="text-right p-2">Prod. B</th>
                    <th className="text-center p-2">Δ</th>
                    <th className="text-center p-2">Motivo</th>
                    <th className="text-center p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {similar.map((s, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 font-medium">{s.a.name}</td>
                      <td className="p-2 text-xs">{s.a.municipality}/{s.a.province}</td>
                      <td className="p-2 text-right font-mono">{s.a.farmers}</td>
                      <td className="p-2 font-medium">{s.b.name}</td>
                      <td className="p-2 text-xs">{s.b.municipality}/{s.b.province}</td>
                      <td className="p-2 text-right font-mono">{s.b.farmers}</td>
                      <td className="p-2 text-center font-mono">{s.distance}</td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {s.reason === "levenshtein" ? "Ortografia" : s.reason === "containment" ? "Contém" : "Igual"}
                        </Badge>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                          <Link to={`/escolas/${s.a.id}`}>A</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                          <Link to={`/escolas/${s.b.id}`}>B</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {similar.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-muted-foreground text-sm">
                        Sem nomes similares detectados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB C — Órfãos */}
        <TabsContent value="orphans" className="mt-4">
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Produtores cujo nome de escola existe mas a província/município não bate com nenhuma ECA registada com esse nome.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  downloadCsv("auditoria-orfaos.csv", [
                    ["Escola", "Nº órfãos", "Exemplo (código)", "Exemplo (nome)", "Província", "Município"],
                    ...orphans.flatMap((o) =>
                      o.examples.map((e, i) => [
                        i === 0 ? o.schoolName : "",
                        i === 0 ? o.orphanCount : "",
                        e.code,
                        e.name,
                        e.province,
                        e.municipality,
                      ])
                    ),
                  ])
                }
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Escola</th>
                    <th className="text-right p-2">Órfãos</th>
                    <th className="text-left p-2">Exemplos (até 5)</th>
                  </tr>
                </thead>
                <tbody>
                  {orphans.map((o) => (
                    <tr key={o.schoolName} className="border-t align-top">
                      <td className="p-2 font-medium">{o.schoolName}</td>
                      <td className="p-2 text-right font-mono text-warning font-semibold">{o.orphanCount}</td>
                      <td className="p-2 text-xs">
                        <ul className="space-y-0.5">
                          {o.examples.map((e) => (
                            <li key={e.code} className="text-muted-foreground">
                              <span className="font-mono">{e.code}</span> · {e.name} ·{" "}
                              <span className="italic">{e.municipality || "—"}/{e.province || "—"}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                  {orphans.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">
                        Sem produtores órfãos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EscolasAuditoria;
