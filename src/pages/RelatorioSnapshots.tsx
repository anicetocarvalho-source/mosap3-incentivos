import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Upload, Info, ArrowUp, ArrowDown, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { parseAmount, formatKz } from "@/lib/numberFormat";
import { toast } from "sonner";

type PhoneAgg = {
  phone: string;
  snapshots: number;
  somaRecebido: number;
  somaGasto: number;
  ultimoRecebido: number;
  ultimoGasto: number;
};

type Totals = {
  phones: number;
  recebido: number;
  gasto: number;
  saldo: number;
};

type DbTotals = {
  farmers: number;
  recebido: number;
  gasto: number;
  saldo: number;
};

function normPhone(p: unknown): string {
  if (p == null) return "";
  let s = String(p).replace(/[^0-9]/g, "");
  if (s.startsWith("244")) s = s.slice(3);
  return s;
}

function parseDate(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v; // serial Excel
  const s = String(v).trim();
  // tenta ISO/DD-MM-YYYY/DD/MM/YYYY
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (isoMatch) return Date.parse(`${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`);
  const ptMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(s);
  if (ptMatch) {
    const yyyy = ptMatch[3].length === 2 ? `20${ptMatch[3]}` : ptMatch[3];
    return Date.parse(`${yyyy}-${ptMatch[2].padStart(2, "0")}-${ptMatch[1].padStart(2, "0")}`);
  }
  const n = Date.parse(s);
  return isNaN(n) ? 0 : n;
}

export default function RelatorioSnapshots() {
  const [loadingXlsx, setLoadingXlsx] = useState(false);
  const [loadingDb, setLoadingDb] = useState(false);
  const [aggs, setAggs] = useState<PhoneAgg[] | null>(null);
  const [dbTotals, setDbTotals] = useState<DbTotals | null>(null);

  const fileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingXlsx(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

      // Detectar nomes de coluna (tolerante)
      const sample = rows[0] || {};
      const keyOf = (re: RegExp) =>
        Object.keys(sample).find((k) => re.test(k.toLowerCase())) || "";
      const kPhone = keyOf(/(telefone|phone|tel)/);
      const kRec = keyOf(/(total.*disponi|disponi|recebido|valor.*receb)/);
      const kGasto = keyOf(/(valor.*gasto|gasto)/);
      const kDate = keyOf(/(data.*carreg|data|date)/);

      if (!kPhone || !kRec || !kGasto) {
        toast.error("Colunas não encontradas no Excel (telefone/disponibilizado/gasto).");
        setLoadingXlsx(false);
        return;
      }

      const byPhone = new Map<string, { rows: Array<{ rec: number; gasto: number; ts: number }> }>();
      for (const r of rows) {
        const p = normPhone(r[kPhone]);
        if (!p) continue;
        const rec = parseAmount(r[kRec] as string | number | null);
        const gasto = parseAmount(r[kGasto] as string | number | null);
        const ts = kDate ? parseDate(r[kDate]) : 0;
        const entry = byPhone.get(p) || { rows: [] };
        entry.rows.push({ rec, gasto, ts });
        byPhone.set(p, entry);
      }

      const result: PhoneAgg[] = [];
      for (const [phone, { rows: rs }] of byPhone) {
        const somaRecebido = rs.reduce((a, x) => a + x.rec, 0);
        const somaGasto = rs.reduce((a, x) => a + x.gasto, 0);
        // último snapshot: maior timestamp; se sem data, último elemento (a ordem de leitura) — também maior recebido como fallback
        let last = rs[0];
        if (rs.some((x) => x.ts > 0)) {
          last = rs.reduce((a, b) => (b.ts >= a.ts ? b : a));
        } else {
          // fallback: maior valor (acumulado) presume snapshot mais recente
          last = rs.reduce((a, b) => (b.rec >= a.rec ? b : a));
        }
        result.push({
          phone,
          snapshots: rs.length,
          somaRecebido,
          somaGasto,
          ultimoRecebido: last.rec,
          ultimoGasto: last.gasto,
        });
      }
      setAggs(result);
      toast.success(`Processadas ${rows.length} linhas / ${result.length} telefones únicos.`);
    } catch (err) {
      console.error(err);
      toast.error("Erro a processar o ficheiro Excel.");
    } finally {
      setLoadingXlsx(false);
      e.target.value = "";
    }
  };

  const carregarDb = async () => {
    setLoadingDb(true);
    try {
      const rows = await fetchAllPages<{ valor_recebido: string | null; total_gasto: string | null }>(
        () => supabase.from("farmers").select("valor_recebido, total_gasto", { count: "exact" })
      );
      const recebido = rows.reduce((a, r) => a + parseAmount(r.valor_recebido), 0);
      const gasto = rows.reduce((a, r) => a + parseAmount(r.total_gasto), 0);
      setDbTotals({ farmers: rows.length, recebido, gasto, saldo: Math.max(0, recebido - gasto) });
      toast.success(`BD: ${rows.length} agricultores agregados.`);
    } catch (err) {
      console.error(err);
      toast.error("Erro a ler totais da BD.");
    } finally {
      setLoadingDb(false);
    }
  };

  const somaTotals: Totals | null = useMemo(() => {
    if (!aggs) return null;
    const recebido = aggs.reduce((a, x) => a + x.somaRecebido, 0);
    const gasto = aggs.reduce((a, x) => a + x.somaGasto, 0);
    return { phones: aggs.length, recebido, gasto, saldo: Math.max(0, recebido - gasto) };
  }, [aggs]);

  const ultimoTotals: Totals | null = useMemo(() => {
    if (!aggs) return null;
    const recebido = aggs.reduce((a, x) => a + x.ultimoRecebido, 0);
    const gasto = aggs.reduce((a, x) => a + x.ultimoGasto, 0);
    return { phones: aggs.length, recebido, gasto, saldo: Math.max(0, recebido - gasto) };
  }, [aggs]);

  const snapshotStats = useMemo(() => {
    if (!aggs) return null;
    const counts = aggs.map((a) => a.snapshots);
    const total = counts.reduce((a, b) => a + b, 0);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const avg = total / counts.length;
    return { totalLinhas: total, min, max, avg };
  }, [aggs]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        title="Relatório · Soma vs. Snapshot Mais Recente"
        description="Compara totais agregados por telefone usando duas estratégias de deduplicação."
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como ler este relatório</AlertTitle>
        <AlertDescription>
          O ficheiro original contém vários snapshots por telefone (≈6 carregamentos). A coluna{" "}
          <strong>Soma</strong> agrega todos os snapshots (valores inflacionados ~6×). A coluna{" "}
          <strong>Último snapshot</strong> mantém apenas o registo com data mais recente (valor real).
          Os totais da BD reflectem a estratégia actualmente importada.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>1. Carregar Excel original</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={fileChosen}
              disabled={loadingXlsx}
              className="max-w-sm"
            />
            {loadingXlsx && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> A processar…
              </div>
            )}
          </div>
          {snapshotStats && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{snapshotStats.totalLinhas.toLocaleString("pt-PT")} linhas</Badge>
              <Badge variant="secondary">{aggs!.length.toLocaleString("pt-PT")} telefones únicos</Badge>
              <Badge variant="outline">snapshots: min {snapshotStats.min} · máx {snapshotStats.max} · média {snapshotStats.avg.toFixed(2)}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>2. Totais actuais na base de dados</CardTitle>
          <Button onClick={carregarDb} disabled={loadingDb} variant="outline" size="sm">
            {loadingDb ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Recalcular
          </Button>
        </CardHeader>
        <CardContent>
          {dbTotals ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Agricultores" value={dbTotals.farmers.toLocaleString("pt-PT")} />
              <Metric label="Recebido" value={formatKz(dbTotals.recebido)} />
              <Metric label="Gasto" value={formatKz(dbTotals.gasto)} />
              <Metric label="Saldo" value={formatKz(dbTotals.saldo)} variant="success" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Clica em <em>Recalcular</em> para ler os totais actuais.</p>
          )}
        </CardContent>
      </Card>

      {somaTotals && ultimoTotals && (
        <Card>
          <CardHeader>
            <CardTitle>3. Comparação Soma vs. Último snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Métrica</th>
                    <th className="py-2 pr-4">Soma snapshots</th>
                    <th className="py-2 pr-4">Último snapshot</th>
                    <th className="py-2 pr-4">Diferença</th>
                    <th className="py-2 pr-4">Rácio</th>
                  </tr>
                </thead>
                <tbody>
                  <Row label="Telefones únicos" a={somaTotals.phones} b={ultimoTotals.phones} fmt={(n) => n.toLocaleString("pt-PT")} />
                  <Row label="Total disponibilizado" a={somaTotals.recebido} b={ultimoTotals.recebido} fmt={formatKz} />
                  <Row label="Total gasto" a={somaTotals.gasto} b={ultimoTotals.gasto} fmt={formatKz} />
                  <Row label="Saldo" a={somaTotals.saldo} b={ultimoTotals.saldo} fmt={formatKz} highlight />
                </tbody>
              </table>
            </div>

            {dbTotals && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Coerência com a BD</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <Coerencia label="BD vs. Soma (recebido)" a={dbTotals.recebido} b={somaTotals.recebido} />
                  <Coerencia label="BD vs. Último (recebido)" a={dbTotals.recebido} b={ultimoTotals.recebido} />
                  <Coerencia label="BD vs. Soma (gasto)" a={dbTotals.gasto} b={somaTotals.gasto} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, variant }: { label: string; value: string; variant?: "success" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${variant === "success" ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}

function Row({
  label,
  a,
  b,
  fmt,
  highlight,
}: {
  label: string;
  a: number;
  b: number;
  fmt: (n: number) => string;
  highlight?: boolean;
}) {
  const diff = a - b;
  const ratio = b !== 0 ? a / b : 0;
  return (
    <tr className={`border-b ${highlight ? "bg-muted/40" : ""}`}>
      <td className="py-2 pr-4 font-medium">{label}</td>
      <td className="py-2 pr-4">{fmt(a)}</td>
      <td className="py-2 pr-4">{fmt(b)}</td>
      <td className="py-2 pr-4">{fmt(diff)}</td>
      <td className="py-2 pr-4">
        <Badge variant={Math.abs(ratio - 1) > 0.05 ? "destructive" : "secondary"}>
          {ratio ? `${ratio.toFixed(2)}×` : "—"}
        </Badge>
      </td>
    </tr>
  );
}

function Coerencia({ label, a, b }: { label: string; a: number; b: number }) {
  const delta = a - b;
  const pct = b !== 0 ? Math.abs(delta) / Math.abs(b) : 0;
  const ok = pct < 0.01;
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{formatKz(delta)}</p>
      <Badge variant={ok ? "secondary" : "destructive"} className="mt-1">
        {ok ? "Coerente (<1%)" : `Δ ${(pct * 100).toFixed(1)}%`}
      </Badge>
    </div>
  );
}
