import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Download, School, ArrowUpDown } from "lucide-react";
import * as XLSX from "xlsx";

type Row = {
  school: string;
  municipality: string | null;
  n: number;
  recebido: number;
  gasto: number;
  saldo: number;
};

import { parseAmount as parsePtao, formatKz, computeSaldoFinal } from "@/lib/numberFormat";

const fmt = (n: number) => formatKz(n, false);

type SortKey = "school" | "n" | "recebido" | "gasto" | "saldo";

const EcaBalanceTable = () => {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [province, setProvince] = useState<string>("Cuando Cubango");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("n");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Load provinces list
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("farmers")
        .select("province")
        .not("province", "is", null);
      const unique = Array.from(
        new Set((data ?? []).map((r) => r.province).filter((p): p is string => !!p && p.trim() !== ""))
      ).sort();
      setProvinces(unique);
    })();
  }, []);

  // Load farmers for the selected province and aggregate by school
  useEffect(() => {
    if (!province) return;
    setLoading(true);
    (async () => {
      const pageSize = 1000;
      let from = 0;
      const all: { school: string | null; municipality: string | null; valor_recebido: string | null; total_gasto: string | null }[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("farmers")
          .select("school, municipality, valor_recebido, total_gasto, saldo_final")
          .eq("province", province)
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const byEca = new Map<string, Row>();
      for (const f of all) {
        const key = (f.school?.trim() || "(sem escola)") as string;
        const existing = byEca.get(key) ?? {
          school: key,
          municipality: f.municipality ?? null,
          n: 0,
          recebido: 0,
          gasto: 0,
          saldo: 0,
        };
        existing.n += 1;
        existing.recebido += parsePtao(f.valor_recebido);
        existing.gasto += parsePtao(f.total_gasto);
        existing.saldo += parsePtao(f.saldo_final);
        byEca.set(key, existing);
      }
      setRows(Array.from(byEca.values()));
      setLoading(false);
    })();
  }, [province]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = rows;
    if (q) r = r.filter((x) => x.school.toLowerCase().includes(q) || (x.municipality ?? "").toLowerCase().includes(q));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...r].sort((a, b) => {
      const va = a[sortKey] as number | string;
      const vb = b[sortKey] as number | string;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "pt") * dir;
    });
  }, [rows, search, sortKey, sortDir]);

  const totals = useMemo(
    () =>
      filteredSorted.reduce(
        (acc, r) => ({
          n: acc.n + r.n,
          recebido: acc.recebido + r.recebido,
          gasto: acc.gasto + r.gasto,
          saldo: acc.saldo + r.saldo,
        }),
        { n: 0, recebido: 0, gasto: 0, saldo: 0 }
      ),
    [filteredSorted]
  );

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "school" ? "asc" : "desc");
    }
  };

  const exportXlsx = () => {
    const data = filteredSorted.map((r, i) => ({
      "#": i + 1,
      "ECA / Escola": r.school,
      "Município": r.municipality ?? "",
      "Nº Agricultores": r.n,
      "Total Recebido (Kz)": Number(r.recebido.toFixed(2)),
      "Total Gasto (Kz)": Number(r.gasto.toFixed(2)),
      "Saldo (Kz)": Number(r.saldo.toFixed(2)),
    }));
    data.push({
      "#": "" as any,
      "ECA / Escola": "TOTAL",
      "Município": "",
      "Nº Agricultores": totals.n,
      "Total Recebido (Kz)": Number(totals.recebido.toFixed(2)),
      "Total Gasto (Kz)": Number(totals.gasto.toFixed(2)),
      "Saldo (Kz)": Number(totals.saldo.toFixed(2)),
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 5 }, { wch: 38 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Saldos por ECA");
    const safeProv = province.replace(/\s+/g, "_").toLowerCase();
    XLSX.writeFile(wb, `saldos_por_eca_${safeProv}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <School className="h-4 w-4 text-primary" />
            Saldos por ECA
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Agregado por escola de campo dentro da província selecionada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Província" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Pesquisar ECA…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-[200px]"
          />
          <Button size="sm" variant="outline" onClick={exportXlsx} disabled={loading || filteredSorted.length === 0}>
            <Download className="h-4 w-4" />
            XLSX
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : filteredSorted.length === 0 ? (
          <EmptyState icon={School} title="Sem ECAs" description="Nenhum resultado para os filtros aplicados." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("school")}>
                    <span className="inline-flex items-center gap-1">ECA / Escola <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Município</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("n")}>
                    <span className="inline-flex items-center gap-1">Nº <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("recebido")}>
                    <span className="inline-flex items-center gap-1">Recebido (Kz) <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("gasto")}>
                    <span className="inline-flex items-center gap-1">Gasto (Kz) <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("saldo")}>
                    <span className="inline-flex items-center gap-1">Saldo (Kz) <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.map((r) => (
                  <TableRow key={r.school}>
                    <TableCell className="font-medium">{r.school}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{r.municipality ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.n}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.recebido)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.gasto)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${r.saldo < 0 ? "text-destructive" : "text-success"}`}>
                      {fmt(r.saldo)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="hidden md:table-cell" />
                  <TableCell className="text-right tabular-nums">{totals.n}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(totals.recebido)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(totals.gasto)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${totals.saldo < 0 ? "text-destructive" : "text-success"}`}>
                    {fmt(totals.saldo)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          A mostrar {filteredSorted.length} ECA{filteredSorted.length === 1 ? "" : "s"} • Província: {province}
        </p>
      </CardContent>
    </Card>
  );
};

export default EcaBalanceTable;
