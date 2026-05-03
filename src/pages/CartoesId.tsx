import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, XCircle, Printer, Search, Eye, MoreHorizontal, Download, Loader2, CalendarIcon, FileDown } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { fetchAllPages } from "@/lib/supabaseFetchAll";

interface CardRow {
  id: string;
  farmer_code: string;
  card_token: string;
  status: string;
  generated_at: string | null;
  printed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  farmer_name?: string;
  province?: string;
}

const statusColor: Record<string, string> = {
  Rascunho: "bg-muted text-muted-foreground",
  Gerado: "bg-info/10 text-info",
  Impresso: "bg-warning/10 text-warning",
  Entregue: "bg-success/10 text-success",
  Revogado: "bg-destructive/10 text-destructive",
};

const PAGE_SIZE = 15;

const CartoesId = () => {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvince, setFilterProvince] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const allCards = await fetchAllPages<any>(() =>
        supabase.from("farmer_cards").select("*", { count: "exact" }).order("created_at", { ascending: false })
      );

      const codes = [...new Set(allCards.map((c: any) => c.farmer_code))];
      const { data: farmers } = await supabase
        .from("farmers")
        .select("code, full_name, province")
        .in("code", codes);

      const farmerMap = new Map((farmers || []).map((f: any) => [f.code, f]));

      const enriched = allCards.map((c: any) => {
        const f = farmerMap.get(c.farmer_code);
        return { ...c, farmer_name: f?.full_name || c.farmer_code, province: f?.province || "" };
      });

      setCards(enriched);
    } catch {
      toast.error("Erro ao carregar cartões");
    }
    setLoading(false);
  };

  useEffect(() => { fetchCards(); }, []);

  const provinces = useMemo(
    () => [...new Set(cards.map((c) => c.province).filter(Boolean))].sort() as string[],
    [cards]
  );

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterProvince !== "all" && c.province !== filterProvince) return false;
      if (dateFrom) {
        const d = c.generated_at || c.created_at;
        if (new Date(d) < dateFrom) return false;
      }
      if (dateTo) {
        const d = c.generated_at || c.created_at;
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(d) > end) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return c.farmer_name?.toLowerCase().includes(q) || c.farmer_code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [cards, filterStatus, filterProvince, dateFrom, dateTo, search]);

  const kpis = useMemo(() => ({
    total: filtered.length,
    active: filtered.filter((c) => c.status !== "Revogado").length,
    revoked: filtered.filter((c) => c.status === "Revogado").length,
    delivered: filtered.filter((c) => c.status === "Entregue").length,
  }), [filtered]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = useCallback(() => setPage(1), []);

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) {
      toast.error("Nenhum resultado para exportar");
      return;
    }
    const headers = ["Código", "Agricultor", "Província", "Estado", "Token", "Gerado em", "Impresso em", "Entregue em", "Criado em"];
    const rows = filtered.map((c) => [
      c.farmer_code,
      c.farmer_name || "",
      c.province || "",
      c.status,
      c.card_token,
      c.generated_at ? new Date(c.generated_at).toLocaleDateString("pt-AO") : "",
      c.printed_at ? new Date(c.printed_at).toLocaleDateString("pt-AO") : "",
      c.delivered_at ? new Date(c.delivered_at).toLocaleDateString("pt-AO") : "",
      new Date(c.created_at).toLocaleDateString("pt-AO"),
    ]);

    const bom = "\uFEFF";
    const csv = bom + [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cartoes-id-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} registos exportados`);
  }, [filtered]);

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterProvince("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  const hasActiveFilters = search || filterStatus !== "all" || filterProvince !== "all" || dateFrom || dateTo;

  const updateStatus = async (card: CardRow, newStatus: string) => {
    const { data: user } = await supabase.auth.getUser();
    const updates: any = { status: newStatus };
    if (newStatus === "Impresso") updates.printed_at = new Date().toISOString();
    if (newStatus === "Entregue") updates.delivered_at = new Date().toISOString();
    if (newStatus === "Revogado") updates.revoked_at = new Date().toISOString();

    await supabase.from("farmer_cards").update(updates).eq("id", card.id);
    await supabase.from("farmer_card_logs").insert({
      farmer_code: card.farmer_code, action: newStatus.toLowerCase(), performed_by: user?.user?.id,
    });
    toast.success(`Estado alterado para ${newStatus}`);
    fetchCards();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6">
      <PageHeader title="Cartões de Identificação" description="Gestão de cartões ID dos agricultores" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Gerados", value: kpis.total, icon: CreditCard, color: "text-primary" },
          { label: "Activos", value: kpis.active, icon: CheckCircle2, color: "text-success" },
          { label: "Entregues", value: kpis.delivered, icon: Printer, color: "text-info" },
          { label: "Revogados", value: kpis.revoked, icon: XCircle, color: "text-destructive" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
              <div>
                <p className="text-2xl font-bold">{loading ? "—" : kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por nome ou código..." value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetPage(); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Estados</SelectItem>
              {["Rascunho", "Gerado", "Impresso", "Entregue", "Revogado"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterProvince} onValueChange={(v) => { setFilterProvince(v); resetPage(); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Província" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Províncias</SelectItem>
              {provinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Date From */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-44 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); resetPage(); }} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          {/* Date To */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-44 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); resetPage(); }} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          <div className="flex gap-2 ml-auto">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar Filtros</Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <FileDown className="h-4 w-4 mr-2" /> Exportar CSV ({filtered.length})
            </Button>
            <Button asChild size="sm"><Link to="/cartoes-id/lote"><Download className="h-4 w-4 mr-2" /> Geração em Lote</Link></Button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Agricultor</th>
                  <th className="text-left p-3">Código</th>
                  <th className="text-left p-3">Província</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-left p-3">Gerado em</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{c.farmer_name}</td>
                    <td className="p-3 font-mono text-xs">{c.farmer_code}</td>
                    <td className="p-3 text-muted-foreground">{c.province || "—"}</td>
                    <td className="p-3">
                      <Badge className={statusColor[c.status] || ""}>{c.status}</Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {c.generated_at ? new Date(c.generated_at).toLocaleDateString("pt-AO") : "—"}
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/agricultores/${c.farmer_code}`}>
                              <Eye className="h-4 w-4 mr-2" /> Ver Perfil
                            </Link>
                          </DropdownMenuItem>
                          {c.status === "Gerado" && (
                            <DropdownMenuItem onClick={() => updateStatus(c, "Impresso")}>
                              <Printer className="h-4 w-4 mr-2" /> Marcar Impresso
                            </DropdownMenuItem>
                          )}
                          {c.status === "Impresso" && (
                            <DropdownMenuItem onClick={() => updateStatus(c, "Entregue")}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar Entregue
                            </DropdownMenuItem>
                          )}
                          {c.status !== "Revogado" && (
                            <DropdownMenuItem className="text-destructive" onClick={() => updateStatus(c, "Revogado")}>
                              <XCircle className="h-4 w-4 mr-2" /> Revogar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum cartão encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y rounded-lg border">
            {paged.map((c) => (
              <div key={c.id} className="p-3 space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{c.farmer_name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{c.farmer_code}</p>
                    {c.province && <p className="text-xs text-muted-foreground">{c.province}</p>}
                  </div>
                  <Badge className={statusColor[c.status] || ""}>{c.status}</Badge>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/agricultores/${c.farmer_code}`}>Ver</Link>
                  </Button>
                </div>
              </div>
            ))}
            {paged.length === 0 && (
              <p className="p-4 text-center text-muted-foreground text-sm">Nenhum cartão encontrado</p>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default CartoesId;
