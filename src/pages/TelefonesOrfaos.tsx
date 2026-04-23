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
import { PhoneOff, Download, Link2, Search, RefreshCw, CheckCircle2, Unlink } from "lucide-react";
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

const formatKz = (n: number) =>
  new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function TelefonesOrfaos() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "pendentes" | "associados">("pendentes");
  const [linkDialog, setLinkDialog] = useState<OrphanRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orphan_phones")
      .select("*")
      .order("amount", { ascending: false })
      .limit(5000);
    if (error) toast.error("Erro a carregar órfãos: " + error.message);
    setRows((data as OrphanRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "pendentes" && r.linked_farmer_code) return false;
      if (filter === "associados" && !r.linked_farmer_code) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return r.phone.includes(q) || (r.linked_farmer_code?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [rows, filter, search]);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const pendentes = rows.filter((r) => !r.linked_farmer_code);
    const associados = rows.filter((r) => r.linked_farmer_code);
    return {
      count: rows.length,
      pendentesCount: pendentes.length,
      associadosCount: associados.length,
      totalKz: total,
      pendentesKz: pendentes.reduce((s, r) => s + Number(r.amount), 0),
      associadosKz: associados.reduce((s, r) => s + Number(r.amount), 0),
    };
  }, [rows]);

  const exportCsv = () => {
    const header = "telefone,valor_kz,estado,agricultor_associado,data_associacao,notas\n";
    const csv = filtered
      .map((r) =>
        [
          r.phone,
          r.amount.toFixed(2),
          r.linked_farmer_code ? "Associado" : "Pendente",
          r.linked_farmer_code ?? "",
          r.linked_at ?? "",
          (r.notes ?? "").replace(/"/g, '""'),
        ]
          .map((v) => `"${v}"`)
          .join(","),
      )
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

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total de órfãos</div>
          <div className="text-2xl font-bold mt-1">{totals.count.toLocaleString("pt-AO")}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatKz(totals.totalKz)} Kz</div>
        </Card>
        <Card className="p-4 border-warning/30">
          <div className="text-xs text-warning">Pendentes</div>
          <div className="text-2xl font-bold mt-1">{totals.pendentesCount.toLocaleString("pt-AO")}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatKz(totals.pendentesKz)} Kz</div>
        </Card>
        <Card className="p-4 border-success/30">
          <div className="text-xs text-success">Associados</div>
          <div className="text-2xl font-bold mt-1">{totals.associadosCount.toLocaleString("pt-AO")}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatKz(totals.associadosKz)} Kz</div>
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
        <div className="flex gap-1">
          {(["pendentes", "associados", "todos"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
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
            Nenhum telefone {filter === "pendentes" ? "pendente" : filter === "associados" ? "associado" : ""} encontrado.
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Valor (Kz)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Agricultor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.phone}</TableCell>
                      <TableCell className="text-right font-medium">{formatKz(Number(r.amount))}</TableCell>
                      <TableCell>
                        {r.linked_farmer_code ? (
                          <Badge variant="outline" className="border-success/40 text-success">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Associado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-warning/40 text-warning">
                            Pendente
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
                      <TableCell className="text-right">
                        {r.linked_farmer_code ? (
                          <Button size="sm" variant="ghost" onClick={() => unlink(r)}>
                            <Unlink className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setLinkDialog(r)}>
                            <Link2 className="h-4 w-4 mr-1" /> Associar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
              {filtered.slice(0, 200).map((r) => (
                <div key={r.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono font-medium">{r.phone}</div>
                      <div className="text-sm text-muted-foreground">{formatKz(Number(r.amount))} Kz</div>
                    </div>
                    {r.linked_farmer_code ? (
                      <Badge variant="outline" className="border-success/40 text-success text-xs">
                        Associado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning/40 text-warning text-xs">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  {r.linked_farmer_code && (
                    <div className="text-xs font-mono text-muted-foreground">→ {r.linked_farmer_code}</div>
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
              ))}
            </div>
          </>
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
    const { error } = await supabase
      .from("orphan_phones")
      .update({
        linked_farmer_code: selected.code,
        linked_at: new Date().toISOString(),
        linked_by: userData.user?.id ?? null,
        notes: `Associado manualmente a ${selected.full_name} (${selected.code})`,
      })
      .eq("id", row.id);
    setSubmitting(false);
    if (error) return toast.error("Erro: " + error.message);

    // Somar valor ao valor_recebido actual do agricultor
    const { data: f } = await supabase
      .from("farmers")
      .select("valor_recebido")
      .eq("code", selected.code)
      .maybeSingle();
    const current = parseFloat(
      (f?.valor_recebido ?? "0").toString().replace(/\./g, "").replace(",", "."),
    ) || 0;
    const novo = current + Number(row.amount);
    const formatted = new Intl.NumberFormat("pt-AO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(novo);
    await supabase.from("farmers").update({ valor_recebido: formatted }).eq("code", selected.code);

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
                actual do agricultor.
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
