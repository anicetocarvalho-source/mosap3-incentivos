import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Download, Eye, Edit, Package, ChevronLeft, ChevronRight, Trash2, RotateCcw, MoreHorizontal, Wallet, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle } from "lucide-react";
import FarmerAvatar from "@/components/FarmerAvatar";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import FarmerRegistrationForm from "@/components/FarmerRegistrationForm";
import FarmerFinancialSummaryDialog from "@/components/FarmerFinancialSummaryDialog";
import BulkImportDialog from "@/components/agricultores/BulkImportDialog";
import { useFarmersList } from "@/hooks/useFarmersList";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ErrorState } from "@/components/ui/error-state";

const PAGE_SIZE = 15;

// Parser unificado (suporta formato EN-US "200,000.00" e PT "200.000,00")
import { parseAmount as parsePtAo, formatKzCompact } from "@/lib/numberFormat";

const fmtKz = (s: string | null | undefined): string => formatKzCompact(s);

const statusDotClass = (status: string): string => {
  const s = status?.toLowerCase();
  if (s === "ativo") return "bg-success";
  if (s === "pendente" || s === "validado") return "bg-warning";
  return "bg-destructive";
};

const Agricultores = () => {
  const [search, setSearch] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [filterPatec, setFilterPatec] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvince, setFilterProvince] = useState("all");
  const [filterMunicipality, setFilterMunicipality] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [summaryTarget, setSummaryTarget] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"name" | "recebido" | "usado" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { farmers, loading, error: farmersError, refetch: refetchFarmers } = useFarmersList();
  const queryClient = useQueryClient();

  const { data: provinces = [] } = useQuery({
    queryKey: ["provinces_list"],
    queryFn: async () => {
      const { data } = await supabase.from("provinces").select("id, name").order("name");
      return data || [];
    },
  });

  // Municípios únicos derivados dos próprios agricultores da província selecionada
  const availableMunicipalities = Array.from(new Set(
    farmers
      .filter(f => filterProvince === "all" || (f.province || "").toLowerCase() === filterProvince.toLowerCase())
      .map(f => f.municipality)
      .filter((m): m is string => !!m && m.trim() !== "")
  )).sort((a, b) => a.localeCompare(b));

  // Reset município quando muda a província
  useEffect(() => { setFilterMunicipality("all"); }, [filterProvince]);

  useEffect(() => { setPage(1); }, [search, filterPatec, filterStatus, filterProvince, filterMunicipality, sortBy, sortDir]);

  const handleSort = (col: "name" | "recebido" | "usado") => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }: { col: "name" | "recebido" | "usado" }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filtered = farmers.filter((f) => {
    const matchesSearch =
      f.full_name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase()) ||
      (f.province || "").toLowerCase().includes(search.toLowerCase());
    const matchesPatec =
      filterPatec === "all" ||
      (filterPatec === "none" && !f.patec) ||
      String(f.patec) === filterPatec;
    const matchesStatus =
      filterStatus === "all" ||
      f.status.toLowerCase() === filterStatus.toLowerCase();
    const matchesProvince =
      filterProvince === "all" ||
      (f.province || "").toLowerCase() === filterProvince.toLowerCase();
    const matchesMunicipality =
      filterMunicipality === "all" ||
      (f.municipality || "").toLowerCase() === filterMunicipality.toLowerCase();
    return matchesSearch && matchesPatec && matchesStatus && matchesProvince && matchesMunicipality;
  });

  const sorted = sortBy
    ? [...filtered].sort((a, b) => {
        let av: number | string = 0;
        let bv: number | string = 0;
        if (sortBy === "name") {
          av = (a.full_name || "").toLowerCase();
          bv = (b.full_name || "").toLowerCase();
        } else if (sortBy === "recebido") {
          av = parsePtAo(a.valor_recebido);
          bv = parsePtAo(b.valor_recebido);
        } else if (sortBy === "usado") {
          av = parsePtAo(a.total_gasto);
          bv = parsePtAo(b.total_gasto);
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      })
    : filtered;

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleEdit = (farmer: any) => {
    setEditingFarmer({
      id: farmer.code,
      name: farmer.full_name,
      bi: farmer.bi || "",
      phone: farmer.phone || "",
      province: farmer.province || "",
      municipality: farmer.municipality || "",
      school: farmer.school || "",
      patec: farmer.patec || null,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingFarmer(null);
  };

  const handleExportCSV = () => {
    const headers = ["Código", "Nome", "BI", "Telefone", "Província", "Município", "Escola", "PATEC", "Estado", "Recebido", "Usado"];
    const rows = sorted.map(f => [f.code, f.full_name, f.bi || "", f.phone || "", f.province || "", f.municipality || "", f.school || "", f.patec || "", f.status, f.valor_recebido || "", f.total_gasto || ""]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `agricultores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("farmers")
      .update({ status: "Removido" })
      .eq("code", deleteTarget.code);
    if (error) {
      toast.error("Erro ao remover agricultor");
    } else {
      toast.success(`${deleteTarget.full_name} marcado como Removido`);
      queryClient.invalidateQueries({ queryKey: ["farmers_list"] });
    }
    setDeleteTarget(null);
  };

  const handleRestore = async (farmer: any) => {
    const { error } = await supabase
      .from("farmers")
      .update({ status: "Ativo" })
      .eq("code", farmer.code);
    if (error) {
      toast.error("Erro ao restaurar agricultor");
    } else {
      toast.success(`${farmer.full_name} restaurado como Ativo`);
      queryClient.invalidateQueries({ queryKey: ["farmers_list"] });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="page-title text-lg md:text-2xl">Agricultores</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1 hidden sm:block">Cadastro e gestão de produtores do MOSAP3</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <BulkImportDialog />
          <Button className="gap-2" size="sm" onClick={() => { setEditingFarmer(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Agricultor</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
        <FarmerRegistrationForm open={dialogOpen} onOpenChange={handleCloseDialog} editData={editingFarmer} />
      </div>

      {farmersError && !loading && (
        <ErrorState onRetry={refetchFarmers} />
      )}

      {/* Filters */}
      <Card className="p-3 md:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder="Pesquisar nome, ID, província..."
              className="pl-10 text-sm"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowSearchSuggestions(e.target.value.length >= 2); }}
              onFocus={() => search.length >= 2 && setShowSearchSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
            />
            {showSearchSuggestions && (() => {
              const suggestions = farmers.filter((f) =>
                f.full_name.toLowerCase().includes(search.toLowerCase()) ||
                f.code.toLowerCase().includes(search.toLowerCase()) ||
                (f.phone && f.phone.includes(search))
              ).slice(0, 8);
              if (suggestions.length === 0) return null;
              return (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((s) => (
                    <Link
                      key={s.id}
                      to={`/agricultores/${s.code}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0"
                    >
                      <FarmerAvatar photoUrl={s.photo_frontal_url} name={s.full_name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.code} • {s.province || "—"} • {s.phone || "—"}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterProvince} onValueChange={setFilterProvince}>
              <SelectTrigger className="w-full sm:w-36 text-xs md:text-sm"><SelectValue placeholder="Província" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {provinces.map((p: any) => (
                  <SelectItem key={p.id} value={p.name.toLowerCase()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-32 text-xs md:text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
                <SelectItem value="removido">Removido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPatec} onValueChange={setFilterPatec}>
              <SelectTrigger className="w-full sm:w-36 text-xs md:text-sm">
                <Package className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                <SelectValue placeholder="PATEC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos PATEC</SelectItem>
                <SelectItem value="1">PATEC 1 — Milho</SelectItem>
                <SelectItem value="2">PATEC 2 — Massango</SelectItem>
                <SelectItem value="3">PATEC 3 — Massambala</SelectItem>
                <SelectItem value="none">Sem PATEC</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="flex-shrink-0" onClick={handleExportCSV} title="Exportar CSV">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Table / Cards */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort("name")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors uppercase">
                      Agricultor <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Província</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Escola</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">PATEC</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort("recebido")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors uppercase ml-auto">
                      Recebido <SortIcon col="recebido" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    <button onClick={() => handleSort("usado")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors uppercase ml-auto">
                      Usado <SortIcon col="usado" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider w-12">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-6 py-3"><Skeleton className="h-5 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-8 w-8 ml-auto" /></td>
                    </tr>
                  ))
                ) : (
                  <TooltipProvider delayDuration={200}>
                    {paginated.map((f) => (
                      <tr key={f.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${f.status === "Removido" ? "opacity-60" : ""}`}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <FarmerAvatar photoUrl={f.photo_frontal_url} name={f.full_name} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${statusDotClass(f.status)}`} aria-label={f.status} />
                                  </TooltipTrigger>
                                  <TooltipContent>{f.status}</TooltipContent>
                                </Tooltip>
                                <p className="font-medium truncate">{f.full_name}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">{f.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{f.phone || "—"}</td>
                        <td className="px-4 py-3">{f.province || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{f.school || "—"}</td>
                        <td className="px-4 py-3">
                          {f.patec ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">PATEC {f.patec}</span> : "—"}
                        </td>
                        {(() => {
                          const recebido = parsePtAo(f.valor_recebido);
                          const usado = parsePtAo(f.total_gasto);
                          const semRecebido = usado > 0 && recebido === 0;
                          const excede = recebido > 0 && usado > recebido;
                          const inconsistente = semRecebido || excede;
                          const motivo = semRecebido
                            ? "Tem valor usado mas não tem recebido registado"
                            : `Usado excede o recebido em ${formatKzCompact(String(usado - recebido))}`;
                          return (
                            <>
                              <td className="px-4 py-3 text-right font-medium text-success tabular-nums">{fmtKz(f.valor_recebido)}</td>
                              <td className={`px-4 py-3 text-right font-medium tabular-nums ${inconsistente ? "text-destructive" : "text-warning"}`}>
                                <span className="inline-flex items-center gap-1.5 justify-end">
                                  {inconsistente && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" aria-label="Inconsistência" />
                                      </TooltipTrigger>
                                      <TooltipContent>{motivo}</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {fmtKz(f.total_gasto)}
                                </span>
                              </td>
                            </>
                          );
                        })()}
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Abrir menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/agricultores/${f.code}`}>
                                  <Eye className="h-4 w-4 mr-2" /> Ver
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(f)}>
                                <Edit className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSummaryTarget(f)}>
                                <Wallet className="h-4 w-4 mr-2" /> Resumo financeiro
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {f.status === "Removido" ? (
                                <DropdownMenuItem onClick={() => handleRestore(f)} className="text-success focus:text-success">
                                  <RotateCcw className="h-4 w-4 mr-2" /> Restaurar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setDeleteTarget(f)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" /> Remover
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </TooltipProvider>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum agricultor encontrado</div>
            ) : paginated.map((f) => (
              <div key={f.id} className="p-3 flex items-center gap-3">
                <FarmerAvatar photoUrl={f.photo_frontal_url} name={f.full_name} size="h-10 w-10" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{f.full_name}</p>
                    <span className={`text-[10px] flex-shrink-0 ${
                      f.status === "Ativo" ? "badge-active" :
                      f.status === "Pendente" || f.status === "Validado" ? "badge-pending" : "badge-suspended"
                    }`}>{f.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-mono">{f.code}</span>
                    <span>•</span>
                    <span className="truncate">{f.province || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Link to={`/agricultores/${f.code}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(f)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSummaryTarget(f)} title="Resumo financeiro"><Wallet className="h-4 w-4" /></Button>
                  {f.status === "Removido" ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={() => handleRestore(f)} title="Restaurar"><RotateCcw className="h-4 w-4" /></Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(f)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 md:px-6 py-3 border-t border-border flex items-center justify-between text-xs md:text-sm text-muted-foreground">
            <span>{sorted.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, sorted.length)} de {sorted.length} agricultores</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium">{page} / {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover agricultor?</AlertDialogTitle>
            <AlertDialogDescription>
              O produtor <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.code}) será marcado como <strong>Removido</strong>. Os dados associados (parcelas, produção, documentos) serão mantidos. Esta ação pode ser revertida alterando o estado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FarmerFinancialSummaryDialog
        farmer={summaryTarget}
        open={!!summaryTarget}
        onOpenChange={(o) => !o && setSummaryTarget(null)}
      />
    </div>
  );
};

export default Agricultores;
