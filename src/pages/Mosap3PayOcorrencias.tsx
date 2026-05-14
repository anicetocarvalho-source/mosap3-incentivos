import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Search, Download, Loader2, Filter, Eye, ExternalLink, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SimStatusBadge } from "@/components/cartoes-sim/SimStatusBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIM_STATUSES } from "@/lib/reconciliation";

type AuditRow = {
  id: string;
  action: string;
  entity_id: string | null;
  entity_type: string;
  user_id: string | null;
  user_name: string | null;
  details: any;
  created_at: string;
};

const PAGE_SIZE = 25;
const ACTION = "pos_contact_manager_sim_blocked";

// Build a filtered query (without range/order) reusable for list + export.
const buildQuery = (opts: {
  search: string;
  statusFilter: string;
  dateFrom?: Date;
  dateTo?: Date;
  count?: "exact" | "planned" | "estimated";
}) => {
  let q = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_id, entity_type, user_id, user_name, details, created_at",
      opts.count ? { count: opts.count } : undefined
    )
    .eq("action", ACTION);

  const s = opts.search.trim();
  if (s) {
    const esc = s.replace(/[,()]/g, " ");
    // entity_id (farmer code), user_name, plus JSON fields farmer_name & phone
    q = q.or(
      [
        `entity_id.ilike.%${esc}%`,
        `user_name.ilike.%${esc}%`,
        `details->>farmer_name.ilike.%${esc}%`,
        `details->>phone.ilike.%${esc}%`,
      ].join(",")
    );
  }

  if (opts.statusFilter !== "all") {
    q = q.eq("details->>sim_status", opts.statusFilter);
  }

  if (opts.dateFrom) {
    const from = new Date(opts.dateFrom);
    from.setHours(0, 0, 0, 0);
    q = q.gte("created_at", from.toISOString());
  }
  if (opts.dateTo) {
    const to = new Date(opts.dateTo);
    to.setHours(23, 59, 59, 999);
    q = q.lte("created_at", to.toISOString());
  }

  return q;
};

const Mosap3PayOcorrencias = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);

  // Debounce search input → server query
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to first page when filters change
  useEffect(() => setPage(1), [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await buildQuery({
        search,
        statusFilter,
        dateFrom,
        dateTo,
        count: "exact",
      })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (cancelled) return;
      if (error) {
        console.error("[Ocorrencias] load error", error);
        setRows([]);
        setTotal(0);
      } else {
        setRows((data ?? []) as AuditRow[]);
        setTotal(count ?? 0);
      }
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, dateFrom, dateTo, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      // Fetch all matching rows in chunks of 1000 (Supabase max).
      const all: AuditRow[] = [];
      const CHUNK = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await buildQuery({ search, statusFilter, dateFrom, dateTo })
          .order("created_at", { ascending: false })
          .range(offset, offset + CHUNK - 1);
        if (error) throw error;
        const batch = (data ?? []) as AuditRow[];
        all.push(...batch);
        if (batch.length < CHUNK) break;
        offset += CHUNK;
      }

      const headers = ["Data", "Código", "Produtor", "Telefone", "Estado SIM", "Motivo", "Operador POS", "Destinatários"];
      const lines = all.map((r) =>
        [
          format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
          r.entity_id || "",
          r.details?.farmer_name || "",
          r.details?.phone || "",
          r.details?.sim_status || "",
          (r.details?.reason || "").replace(/[\n;]/g, " "),
          r.user_name || "",
          r.details?.recipients ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      );
      const csv = [headers.join(";"), ...lines].join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ocorrencias_sim_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[Ocorrencias] export error", e);
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Ocorrências do POS
          </h1>
          <p className="text-sm text-muted-foreground">
            Bloqueios reportados pelos operadores POS por SIM Barrado/Removido.
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline" disabled={!total || exporting}>
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Código, nome, telefone ou operador…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Estado SIM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {SIM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus locale={pt} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus locale={pt} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <div className="md:col-span-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} ocorrência(s)</span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> A carregar ocorrências…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Nenhuma ocorrência encontrada.</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Produtor</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Estado SIM</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Operador POS</TableHead>
                      <TableHead className="text-right">Destinatários</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.entity_id}</TableCell>
                        <TableCell>{r.details?.farmer_name || "—"}</TableCell>
                        <TableCell className="text-xs">{r.details?.phone || "—"}</TableCell>
                        <TableCell><SimStatusBadge status={r.details?.sim_status || "Desconhecido"} /></TableCell>
                        <TableCell className="max-w-[260px] text-xs">{r.details?.reason || "—"}</TableCell>
                        <TableCell className="text-xs">{r.user_name || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{r.details?.recipients ?? 0}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y">
                {rows.map((r) => (
                  <div key={r.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{r.entity_id}</span>
                      <SimStatusBadge status={r.details?.sim_status || "Desconhecido"} />
                    </div>
                    <div className="font-medium">{r.details?.farmer_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.details?.phone || "—"}</div>
                    <div className="text-xs">{r.details?.reason || "—"}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</span>
                      <span>POS: {r.user_name || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Mosap3PayOcorrencias;
