import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Search, Building2, Mail, Phone, MapPin, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import AcessoNegado from "@/pages/AcessoNegado";

interface SupplierRow {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  province: string | null;
  municipality: string | null;
  status: string;
  created_at: string;
  activated_at: string | null;
  activated_by: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  deactivation_reason: string | null;
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—";

const Mosap3PayFornecedoresPendentes = () => {
  const { isAdmin, loading, authReady } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("pendentes");

  const [confirmTarget, setConfirmTarget] = useState<{ supplier: SupplierRow; action: "activate" | "deactivate" } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const suppliersQuery = useQuery({
    enabled: isAdmin,
    queryKey: ["admin", "suppliers", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, nif, email, phone, province, municipality, status, created_at, activated_at, activated_by, deactivated_at, deactivated_by, deactivation_reason")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierRow[];
    },
  });

  // Fetch profiles to resolve admin names
  const userIds = useMemo(() => {
    const set = new Set<string>();
    (suppliersQuery.data ?? []).forEach(s => {
      if (s.activated_by) set.add(s.activated_by);
      if (s.deactivated_by) set.add(s.deactivated_by);
    });
    return Array.from(set);
  }, [suppliersQuery.data]);

  const profilesQuery = useQuery({
    enabled: userIds.length > 0,
    queryKey: ["admin", "supplier-approvers", userIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const map = new Map<string, string>();
      (data ?? []).forEach((p: any) => map.set(p.user_id, p.full_name || ""));
      return map;
    },
  });
  const nameOf = (uid: string | null) => (uid ? profilesQuery.data?.get(uid) || uid.slice(0, 8) : "—");

  const all = suppliersQuery.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = tab === "pendentes"
      ? all.filter(s => s.status === "Pendente")
      : tab === "ativos"
        ? all.filter(s => s.status === "Ativo")
        : all.filter(s => s.status !== "Ativo" && s.status !== "Pendente");
    if (!term) return base;
    return base.filter(s =>
      s.name.toLowerCase().includes(term) ||
      (s.email ?? "").toLowerCase().includes(term) ||
      (s.nif ?? "").toLowerCase().includes(term)
    );
  }, [all, tab, search]);

  const counts = useMemo(() => ({
    pendentes: all.filter(s => s.status === "Pendente").length,
    ativos: all.filter(s => s.status === "Ativo").length,
    inativos: all.filter(s => s.status !== "Ativo" && s.status !== "Pendente").length,
  }), [all]);

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setSubmitting(true);
    try {
      const fn = confirmTarget.action === "activate" ? "admin_activate_supplier" : "admin_deactivate_supplier";
      const { error } = await supabase.rpc(fn, {
        _supplier_id: confirmTarget.supplier.id,
        _reason: reason.trim() || null,
      });
      if (error) throw error;
      toast.success(confirmTarget.action === "activate" ? "Fornecedor ativado" : "Fornecedor desativado");
      setConfirmTarget(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "suppliers", "all"] });
      queryClient.invalidateQueries({ queryKey: ["mosap3pay", "suppliers"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar fornecedor");
    } finally {
      setSubmitting(false);
    }
  };

  if (!authReady || loading) return null;
  if (!isAdmin) return <AcessoNegado />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Aprovação de Fornecedores
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ative ou desative fornecedores. As alterações ficam registadas com autor e data.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Pendentes" value={String(counts.pendentes)} icon={Clock} />
        <StatCard title="Ativos" value={String(counts.ativos)} icon={CheckCircle} />
        <StatCard title="Inativos" value={String(counts.inativos)} icon={XCircle} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Fornecedores</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Procurar por nome, NIF, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="pendentes">Pendentes ({counts.pendentes})</TabsTrigger>
              <TabsTrigger value="ativos">Ativos ({counts.ativos})</TabsTrigger>
              <TabsTrigger value="inativos">Inativos ({counts.inativos})</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4">
              {suppliersQuery.isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Sem fornecedores nesta categoria.
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Contacto</TableHead>
                          <TableHead>Localização</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Histórico</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <div className="font-medium">{s.name}</div>
                              <div className="text-xs text-muted-foreground">NIF: {s.nif || "—"}</div>
                              <div className="text-xs text-muted-foreground">Registado: {fmtDate(s.created_at)}</div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email || "—"}</div>
                              <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone || "—"}</div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.province || "—"}</div>
                              <div className="text-muted-foreground">{s.municipality || "—"}</div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={s.status} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {s.activated_at && (
                                <div>Ativado: {fmtDate(s.activated_at)}<br /><span className="text-muted-foreground/80">por {nameOf(s.activated_by)}</span></div>
                              )}
                              {s.deactivated_at && (
                                <div className="mt-1">Desativado: {fmtDate(s.deactivated_at)}<br /><span className="text-muted-foreground/80">por {nameOf(s.deactivated_by)}</span>{s.deactivation_reason && <div className="italic">"{s.deactivation_reason}"</div>}</div>
                              )}
                              {!s.activated_at && !s.deactivated_at && "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <ActionButtons supplier={s} onAction={(action) => { setReason(""); setConfirmTarget({ supplier: s, action }); }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-border">
                    {filtered.map((s) => (
                      <div key={s.id} className="py-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.email || s.phone || "—"}</div>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.province || "—"} · Registado {fmtDate(s.created_at)}
                        </div>
                        {s.activated_at && (
                          <div className="text-xs text-muted-foreground">Ativado {fmtDate(s.activated_at)} por {nameOf(s.activated_by)}</div>
                        )}
                        {s.deactivated_at && (
                          <div className="text-xs text-muted-foreground">Desativado {fmtDate(s.deactivated_at)} por {nameOf(s.deactivated_by)}</div>
                        )}
                        <ActionButtons supplier={s} onAction={(action) => { setReason(""); setConfirmTarget({ supplier: s, action }); }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => { if (!o) { setConfirmTarget(null); setReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.action === "activate" ? "Ativar fornecedor?" : "Desativar fornecedor?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.action === "activate"
                ? <>O fornecedor <strong>{confirmTarget?.supplier.name}</strong> poderá aceder ao portal e operar terminais POS.</>
                : <>O fornecedor <strong>{confirmTarget?.supplier.name}</strong> deixará de poder operar até nova ativação.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium">
              {confirmTarget?.action === "activate" ? "Nota (opcional)" : "Motivo (opcional)"}
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={confirmTarget?.action === "activate" ? "Ex: documentação validada" : "Ex: incumprimento contratual"}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={submitting}>
              {submitting ? "A processar..." : confirmTarget?.action === "activate" ? "Ativar" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "Ativo") return <Badge className="bg-success/15 text-success border-success/30">Ativo</Badge>;
  if (status === "Pendente") return <Badge className="bg-warning/15 text-warning border-warning/30">Pendente</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">{status}</Badge>;
};

const ActionButtons = ({ supplier, onAction }: { supplier: SupplierRow; onAction: (a: "activate" | "deactivate") => void }) => {
  if (supplier.status === "Ativo") {
    return (
      <Button size="sm" variant="outline" onClick={() => onAction("deactivate")}>
        <XCircle className="h-4 w-4 mr-1" /> Desativar
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={() => onAction("activate")}>
      <CheckCircle className="h-4 w-4 mr-1" /> Ativar
    </Button>
  );
};

export default Mosap3PayFornecedoresPendentes;
