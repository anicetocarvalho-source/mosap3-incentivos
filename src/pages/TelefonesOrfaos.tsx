import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PhoneOff, Download, Link2, Search, RefreshCw, CheckCircle2, Unlink,
  AlertTriangle, Sparkles, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type OrphanRow = {
  id: string;
  phone: string;
  amount: number;
  linked_farmer_code: string | null;
  linked_at: string | null;
  notes: string | null;
  created_at: string;
};

type FarmerOption = {
  code: string;
  full_name: string;
  phone: string | null;
  province: string | null;
};

type Origem = "auto" | "manual" | "pendente";

const formatKz = (n: number) =>
  new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" }) : "—";

const origemOf = (r: OrphanRow): Origem => {
  if (!r.linked_farmer_code) return "pendente";
  if ((r.notes ?? "").toLowerCase().startsWith("auto")) return "auto";
  return "manual";
};

export default function TelefonesOrfaos() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "pendentes" | "auto" | "manual">("pendentes");
  const [linkDialog, setLinkDialog] = useState<OrphanRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const load = async () => {
    setLoading(true);
    try {
      const { fetchAllPages } = await import("@/lib/supabaseFetchAll");
      const all = await fetchAllPages<OrphanRow>(() =>
        supabase.from("orphan_phones").select("*", { count: "exact" }).order("amount", { ascending: false })
      );
      setRows(all);
    } catch (e: any) {
      toast.error("Erro a carregar órfãos: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const o = origemOf(r);
      if (filter === "pendentes" && o !== "pendente") return false;
      if (filter === "auto" && o !== "auto") return false;
      if (filter === "manual" && o !== "manual") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return r.phone.includes(q) || (r.linked_farmer_code?.toLowerCase().includes(q) ?? false);
      }
      return true;
    }).sort((a, b) => {
      // pendentes primeiro, depois valor desc
      const oa = origemOf(a), ob = origemOf(b);
      if (oa === "pendente" && ob !== "pendente") return -1;
      if (ob === "pendente" && oa !== "pendente") return 1;
      return Number(b.amount) - Number(a.amount);
    });
  }, [rows, filter, search]);

  const totals = useMemo(() => {
    let pendCount = 0, autoCount = 0, manualCount = 0;
    let pendKz = 0, autoKz = 0, manualKz = 0, totalKz = 0;
    for (const r of rows) {
      const v = Number(r.amount) || 0;
      totalKz += v;
      const o = origemOf(r);
      if (o === "pendente") { pendCount++; pendKz += v; }
      else if (o === "auto") { autoCount++; autoKz += v; }
      else { manualCount++; manualKz += v; }
    }
    return {
      count: rows.length, totalKz,
      pendCount, pendKz,
      autoCount, autoKz,
      manualCount, manualKz,
    };
  }, [rows]);

  const exportCsv = () => {
    const header = "telefone,valor_kz,origem,agricultor_associado,data_associacao,notas\n";
    const csv = filtered
      .map((r) => {
        const o = origemOf(r);
        return [
          r.phone,
          r.amount.toFixed(2),
          o === "auto" ? "Auto" : o === "manual" ? "Manual" : "Pendente",
          r.linked_farmer_code ?? "",
          r.linked_at ?? "",
          (r.notes ?? "").replace(/"/g, '""'),
        ].map((v) => `"${v}"`).join(",");
      })
      .join("\n");
    const blob = new Blob([header + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telefones_orfaos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} linhas exportadas`);
  };

  const unlink = async (row: OrphanRow) => {
    const { error } = await supabase
      .from("orphan_phones")
      .update({ linked_farmer_code: null, linked_at: null, linked_by: null, notes: null })
      .eq("id", row.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Associação removida");
    load();
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Apenas administradores podem aceder a esta página.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Telefones Órfãos"
        description="Pagamentos Unitel Money sem agricultor associado na base de dados"
        icon={PhoneOff}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline ml-1">Atualizar</span>
            </Button>
            <Button size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Exportar CSV</span>
            </Button>
          </>
        }
      />

      {/* Banner reconciliação automática */}
      {totals.autoCount > 0 && (
        <Card className="p-3 border-success/40 bg-success/5 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-success">Reconciliação automática concluída</div>
            <div className="text-muted-foreground">
              <strong>{totals.autoCount.toLocaleString("pt-AO")}</strong> telefones associados
              automaticamente ({formatKz(totals.autoKz)} Kz) por correspondência dos últimos 9 dígitos.
              {totals.pendCount > 0 ? (
                <> Restam <strong className="text-warning">{totals.pendCount}</strong> casos
                  ({formatKz(totals.pendKz)} Kz) para revisão manual.</>
              ) : (
                <> Não restam casos pendentes.</>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total de órfãos</div>
          <div className="text-2xl font-bold mt-1">{totals.count.toLocaleString("pt-AO")}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatKz(totals.totalKz)} Kz</div>
        </Card>
        <Card className={`p-4 ${totals.pendCount > 0 ? "border-warning/40 bg-warning/5" : "border-muted"}`}>
          <div className="text-xs text-warning flex items-center gap-1">
            {totals.pendCount > 0 && <AlertTriangle className="h-3 w-3" />} Pendentes
          </div>
          <div className="text-2xl font-bold mt-1">{totals.pendCount.toLocaleString("pt-AO")}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatKz(totals.pendKz)} Kz</div>
        </Card>
        <Card className="p-4 border-success/30">
          <div className="text-xs text-success flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Auto-associados
          </div>
          <div className="text-2xl font-bold mt-1">{totals.autoCount.toLocaleString("pt-AO")}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatKz(totals.autoKz)} Kz</div>
        </Card>
        <Card className="p-4 border-primary/30">
          <div className="text-xs text-primary flex items-center gap-1">
            <UserCheck className="h-3 w-3" /> Manuais
          </div>
          <div className="text-2xl font-bold mt-1">{totals.manualCount.toLocaleString("pt-AO")}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatKz(totals.manualKz)} Kz</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por telefone ou código de agricultor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {([
            { key: "pendentes", label: "Pendentes" },
            { key: "auto", label: "Auto" },
            { key: "manual", label: "Manuais" },
            { key: "todos", label: "Todos" },
          ] as const).map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum telefone encontrado com os filtros actuais.
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Valor (Kz)</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Agricultor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r) => {
                    const o = origemOf(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.phone}</TableCell>
                        <TableCell className="text-right font-medium">{formatKz(Number(r.amount))}</TableCell>
                        <TableCell>
                          {o === "auto" && (
                            <Badge variant="outline" className="border-success/40 text-success">
                              <Sparkles className="h-3 w-3 mr-1" /> Auto
                            </Badge>
                          )}
                          {o === "manual" && (
                            <Badge variant="outline" className="border-primary/40 text-primary">
                              <UserCheck className="h-3 w-3 mr-1" /> Manual
                            </Badge>
                          )}
                          {o === "pendente" && (
                            <Badge variant="outline" className="border-warning/40 text-warning">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.linked_farmer_code ? (
                            <span className="font-mono text-sm">{r.linked_farmer_code}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(r.linked_at)}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          {r.notes ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground line-clamp-1 cursor-help">
                                  {r.notes}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">{r.notes}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.linked_farmer_code ? (
                            <Button size="sm" variant="ghost" onClick={() => unlink(r)} title="Desassociar">
                              <Unlink className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setLinkDialog(r)}>
                              <Link2 className="h-4 w-4 mr-1" /> Associar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t">
                  A mostrar 500 de {filtered.length}. Filtre ou exporte CSV para ver todos.
                </div>
              )}
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y">
              {filtered.slice(0, 200).map((r) => {
                const o = origemOf(r);
                return (
                  <div key={r.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-medium">{r.phone}</div>
                        <div className="text-sm text-muted-foreground">{formatKz(Number(r.amount))} Kz</div>
                      </div>
                      {o === "auto" && (
                        <Badge variant="outline" className="border-success/40 text-success text-xs">
                          <Sparkles className="h-3 w-3 mr-1" /> Auto
                        </Badge>
                      )}
                      {o === "manual" && (
                        <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                          <UserCheck className="h-3 w-3 mr-1" /> Manual
                        </Badge>
                      )}
                      {o === "pendente" && (
                        <Badge variant="outline" className="border-warning/40 text-warning text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Pendente
                        </Badge>
                      )}
                    </div>
                    {r.linked_farmer_code && (
                      <div className="text-xs font-mono text-muted-foreground">
                        → {r.linked_farmer_code} <span className="ml-1">({formatDate(r.linked_at)})</span>
                      </div>
                    )}
                    {r.notes && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{r.notes}</div>
                    )}
                    <div className="flex justify-end">
                      {r.linked_farmer_code ? (
                        <Button size="sm" variant="ghost" onClick={() => unlink(r)}>
                          <Unlink className="h-4 w-4 mr-1" /> Desassociar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setLinkDialog(r)}>
                          <Link2 className="h-4 w-4 mr-1" /> Associar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </Card>

      <LinkDialog row={linkDialog} onClose={() => setLinkDialog(null)} onLinked={load} />
    </div>
  );
}

/* ───────────────────── Dialog de associação manual ───────────────────── */

function LinkDialog({
  row,
  onClose,
  onLinked,
}: {
  row: OrphanRow | null;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FarmerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FarmerOption | null>(null);
  const [popOpen, setPopOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setSelected(null);
  }, [row?.id]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("farmers")
        .select("code, full_name, phone, province")
        .or(`full_name.ilike.%${query}%,code.ilike.%${query}%,phone.ilike.%${query}%,bi.ilike.%${query}%`)
        .limit(20);
      setResults((data as FarmerOption[]) || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const submit = async () => {
    if (!row || !selected) return;
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;

    const { error } = await supabase
      .from("orphan_phones")
      .update({
        linked_farmer_code: selected.code,
        linked_at: new Date().toISOString(),
        linked_by: userId,
        notes: `Manual: associado a ${selected.full_name} (${selected.code})`,
      })
      .eq("id", row.id);
    if (error) {
      setSubmitting(false);
      return toast.error("Erro: " + error.message);
    }

    // Somar valor ao valor_recebido actual do agricultor
    const { data: f } = await supabase
      .from("farmers")
      .select("valor_recebido")
      .eq("code", selected.code)
      .maybeSingle();
    const oldRaw = (f?.valor_recebido ?? "0").toString();
    const current = parseFloat(oldRaw.replace(/\./g, "").replace(",", ".")) || 0;
    const delta = Number(row.amount);
    const novo = current + delta;
    const formatted = new Intl.NumberFormat("pt-AO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(novo);
    await supabase.from("farmers").update({ valor_recebido: formatted }).eq("code", selected.code);

    // Histórico (consistência com o auto-link)
    await supabase.from("farmer_balance_history").insert({
      farmer_code: selected.code,
      field: "valor_recebido",
      old_value: oldRaw,
      new_value: formatted,
      delta,
      source: "orphan_phone_manual_link",
      source_ref: row.id,
      changed_by: userId,
      notes: `Telefone órfão ${row.phone} associado manualmente`,
    });

    setSubmitting(false);
    toast.success(
      `Associado a ${selected.full_name}. valor_recebido actualizado para ${formatted} Kz.`,
    );
    onLinked();
    onClose();
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Associar telefone órfão</DialogTitle>
          <DialogDescription>
            Telefone <span className="font-mono font-medium">{row?.phone}</span> recebeu{" "}
            <strong>{row && formatKz(Number(row.amount))} Kz</strong>. Selecione o agricultor a quem
            este pagamento pertence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Popover open={popOpen} onOpenChange={setPopOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start" type="button">
                {selected ? (
                  <span className="truncate">
                    <span className="font-mono">{selected.code}</span> — {selected.full_name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Pesquisar agricultor...</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[460px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Nome, código, BI ou telefone..."
                  value={query}
                  onValueChange={setQuery}
                />
                <CommandList>
                  {searching && <div className="p-3 text-sm text-muted-foreground">A procurar...</div>}
                  {!searching && query.length < 2 && (
                    <div className="p-3 text-sm text-muted-foreground">
                      Escreva pelo menos 2 caracteres.
                    </div>
                  )}
                  {!searching && query.length >= 2 && results.length === 0 && (
                    <CommandEmpty>Sem resultados.</CommandEmpty>
                  )}
                  <CommandGroup>
                    {results.map((f) => (
                      <CommandItem
                        key={f.code}
                        onSelect={() => {
                          setSelected(f);
                          setPopOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span>
                            <span className="font-mono text-xs">{f.code}</span> — {f.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {f.phone || "sem telefone"} · {f.province || "—"}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selected && (
            <Card className="p-3 bg-muted/40 text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Nome: </span>
                <strong>{selected.full_name}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Telefone na BD: </span>
                <span className="font-mono">{selected.phone || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Província: </span>
                {selected.province || "—"}
              </div>
              <div className="text-xs text-warning mt-2">
                Esta operação irá somar {row && formatKz(Number(row.amount))} Kz ao valor_recebido
                actual do agricultor e registar entrada no histórico de saldos.
              </div>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!selected || submitting}>
            {submitting ? "A associar..." : "Confirmar associação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
