import { useEffect, useMemo, useState } from "react";
import { Smartphone, Search, Download, Pencil, History, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SimStatusBadge } from "@/components/cartoes-sim/SimStatusBadge";
import { EditarSimStatusDialog } from "@/components/cartoes-sim/EditarSimStatusDialog";
import { SimStatusHistoryDrawer } from "@/components/cartoes-sim/SimStatusHistoryDrawer";
import { SIM_STATUSES } from "@/lib/reconciliation";
import { useServerTable, useDebouncedValue } from "@/hooks/useServerTable";

type Farmer = {
  code: string;
  full_name: string;
  phone: string | null;
  province: string | null;
  municipality: string | null;
  school: string | null;
  sim_status: string | null;
  sim_status_updated_at: string | null;
  sim_status_source: string | null;
};

const PAGE_SIZE = 50;
const COLS = "code, full_name, phone, province, municipality, school, sim_status, sim_status_updated_at, sim_status_source";

const Mosap3PayCartoesSim = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [provFilter, setProvFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Farmer | null>(null);
  const [history, setHistory] = useState<Farmer | null>(null);
  const [exporting, setExporting] = useState(false);

  const debSearch = useDebouncedValue(search, 350);

  useEffect(() => { setPage(1); }, [debSearch, statusFilter, provFilter]);

  const filters = useMemo(
    () => ({
      sim_status: statusFilter === "all" ? undefined : statusFilter,
      province: provFilter === "all" ? undefined : provFilter,
    }),
    [statusFilter, provFilter]
  );

  const { rows, total, isLoading, refetch, isFetching } = useServerTable<Farmer>({
    table: "farmers",
    columns: COLS,
    page,
    pageSize: PAGE_SIZE,
    search: debSearch,
    searchColumns: ["full_name", "phone", "code", "bi"],
    filters,
    sort: { column: "sim_status_updated_at", dir: "desc", nullsFirst: false },
    excludeEq: { column: "status", value: "Removido" },
  });

  // KPIs do servidor (1 query agregada)
  const kpisQuery = useQuery({
    queryKey: ["farmers-sim-kpis"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("farmers_sim_kpis");
      if (error) throw error;
      return data as { activo: number; pre_desactivado: number; barrado: number; removido: number; desconhecido: number };
    },
  });

  // Lista de províncias (1 query distinta)
  const provincesQuery = useQuery({
    queryKey: ["farmers-distinct-provinces"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("farmers_distinct_provinces");
      if (error) throw error;
      return ((data as any[]) || []).map((r) => r.province).filter(Boolean) as string[];
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const provinces = provincesQuery.data || [];

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages<Farmer>(() => {
        let q: any = supabase
          .from("farmers")
          .select(COLS, { count: "exact" })
          .neq("status", "Removido");
        if (statusFilter !== "all") q = q.eq("sim_status", statusFilter);
        if (provFilter !== "all") q = q.eq("province", provFilter);
        const term = debSearch.trim();
        if (term) {
          q = q.or(["full_name", "phone", "code", "bi"].map((c) => `${c}.ilike.%${term}%`).join(","));
        }
        return q;
      });
      const header = ["Código", "Nome", "Telefone", "Província", "Município", "Escola", "Estado SIM", "Última alteração", "Fonte"];
      const csv = [header, ...all.map((r) => [
        r.code, r.full_name, r.phone || "", r.province || "", r.municipality || "", r.school || "",
        r.sim_status || "Desconhecido",
        r.sim_status_updated_at ? new Date(r.sim_status_updated_at).toLocaleString("pt-AO") : "",
        r.sim_status_source || "",
      ])].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `cartoes_sim_${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const counts = kpisQuery.data || { activo: 0, pre_desactivado: 0, barrado: 0, removido: 0, desconhecido: 0 };

  const KPI = ({ label, value, status }: { label: string; value: number; status: string }) => (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-2xl font-bold">{value.toLocaleString("pt-AO")}</p>
          <SimStatusBadge status={status} />
        </div>
      </CardContent>
    </Card>
  );

  const onSaved = () => { refetch(); kpisQuery.refetch(); };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold flex items-center gap-2">
            <Smartphone className="h-7 w-7 text-primary" />
            Cartões SIM
          </h1>
          <p className="text-muted-foreground text-sm">
            Estado dos cartões SIM dos agricultores (sincronizado via reconciliação ou edição manual).
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={exporting || total === 0}>
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Activos" value={counts.activo} status="Activo" />
        <KPI label="Pré desactivado" value={counts.pre_desactivado} status="Pré desactivado" />
        <KPI label="Barrados" value={counts.barrado} status="Barrado" />
        <KPI label="Removidos" value={counts.removido} status="Removido" />
        <KPI label="Desconhecido" value={counts.desconhecido} status="Desconhecido" />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar nome, telefone, código ou BI…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Estado SIM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {SIM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={provFilter} onValueChange={setProvFilter}>
            <SelectTrigger><SelectValue placeholder="Província" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as províncias</SelectItem>
              {provinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Província / Município</TableHead>
                      <TableHead>Escola</TableHead>
                      <TableHead>Estado SIM</TableHead>
                      <TableHead>Última alteração</TableHead>
                      <TableHead className="text-right">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.code}>
                        <TableCell className="font-mono text-xs">{r.phone || "—"}</TableCell>
                        <TableCell>{r.full_name}</TableCell>
                        <TableCell className="text-xs">
                          {r.province || "—"}<br />
                          <span className="text-muted-foreground">{r.municipality || "—"}</span>
                        </TableCell>
                        <TableCell className="text-xs">{r.school || "—"}</TableCell>
                        <TableCell>
                          <SimStatusBadge status={r.sim_status} />
                          {r.sim_status_source && (
                            <Badge variant="outline" className="ml-1 text-[10px]">{r.sim_status_source}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.sim_status_updated_at ? new Date(r.sim_status_updated_at).toLocaleString("pt-AO") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => setEdit(r)} title="Alterar estado">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setHistory(r)} title="Histórico">
                            <History className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground p-6">Nenhum resultado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden divide-y">
                {rows.map((r) => (
                  <div key={r.code} className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{r.full_name}</span>
                      <SimStatusBadge status={r.sim_status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.phone || "—"} · {r.province || "—"} / {r.municipality || "—"}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setEdit(r)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Alterar
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setHistory(r)}>
                        <History className="h-3.5 w-3.5 mr-1" />Histórico
                      </Button>
                    </div>
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="text-center text-muted-foreground p-6 text-sm">Nenhum resultado</p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 border-t text-sm">
                <span className="text-muted-foreground">
                  {total.toLocaleString("pt-AO")} resultados · página {page}/{totalPages}
                  {isFetching && <Loader2 className="h-3 w-3 animate-spin inline ml-2" />}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Seguinte</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EditarSimStatusDialog
        farmer={edit}
        open={!!edit}
        onOpenChange={(v) => !v && setEdit(null)}
        onSaved={onSaved}
      />
      <SimStatusHistoryDrawer
        farmerCode={history?.code || null}
        farmerName={history?.full_name}
        open={!!history}
        onOpenChange={(v) => !v && setHistory(null)}
      />
    </div>
  );
};

export default Mosap3PayCartoesSim;
