import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, XCircle, Printer, Search, Eye, MoreHorizontal, RefreshCw, Download, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [page, setPage] = useState(1);
  const [kpis, setKpis] = useState({ total: 0, active: 0, revoked: 0, delivered: 0 });

  const fetchCards = async () => {
    setLoading(true);
    try {
      const allCards = await fetchAllPages<any>(() =>
        supabase.from("farmer_cards").select("*", { count: "exact" }).order("created_at", { ascending: false })
      );

      // Enrich with farmer names
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

      // KPIs
      setKpis({
        total: enriched.length,
        active: enriched.filter((c: any) => c.status !== "Revogado").length,
        revoked: enriched.filter((c: any) => c.status === "Revogado").length,
        delivered: enriched.filter((c: any) => c.status === "Entregue").length,
      });
    } catch {
      toast.error("Erro ao carregar cartões");
    }
    setLoading(false);
  };

  useEffect(() => { fetchCards(); }, []);

  const filtered = cards.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.farmer_name?.toLowerCase().includes(q) || c.farmer_code.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      <PageHeader title="Cartões de Identificação" subtitle="Gestão de cartões ID dos agricultores" />

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

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome ou código..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {["Rascunho", "Gerado", "Impresso", "Entregue", "Revogado"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button asChild><Link to="/cartoes-id/lote">Geração em Lote</Link></Button>
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
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default CartoesId;
