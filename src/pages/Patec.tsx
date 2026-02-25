import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Search, Filter, Edit2, Eye, CheckSquare, X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface FarmerPatec {
  id: string;
  code: string;
  full_name: string;
  province: string | null;
  municipality: string | null;
  school: string | null;
  patec: number | null;
  status: string;
}

interface PatecItem {
  id: string;
  patec_number: number;
  category: string;
  name: string;
}

const patecMeta: Record<number, { title: string; color: string; cultures: string }> = {
  1: { title: "PATEC 1 — Milho + Feijão + Gado", color: "bg-amber-100 text-amber-800 border-amber-300", cultures: "Milho + Feijão" },
  2: { title: "PATEC 2 — Massango + Feijão + Gado", color: "bg-emerald-100 text-emerald-800 border-emerald-300", cultures: "Massango + Feijão" },
  3: { title: "PATEC 3 — Massambala + Feijão + Gado", color: "bg-violet-100 text-violet-800 border-violet-300", cultures: "Massambala + Feijão" },
};

const categoryLabels: Record<string, string> = {
  insumos: "Insumos Agrícolas",
  pecuaria: "Pecuária e Materiais",
  servicos: "Serviços Incluídos",
};

const categoryColors: Record<string, string> = {
  insumos: "text-amber-700",
  pecuaria: "text-emerald-700",
  servicos: "text-blue-700",
};

const Patec = () => {
  const { isAdmin } = useAuth();
  const [farmers, setFarmers] = useState<FarmerPatec[]>([]);
  const [patecItems, setPatecItems] = useState<PatecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPatec, setFilterPatec] = useState<string>("all");
  const [editFarmer, setEditFarmer] = useState<FarmerPatec | null>(null);
  const [editPatec, setEditPatec] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [viewPatec, setViewPatec] = useState<number | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkPatec, setBulkPatec] = useState<string>("");

  // Add item state
  const [addingCategory, setAddingCategory] = useState<{ patec: number; category: string } | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const fetchFarmers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("farmers")
      .select("id, code, full_name, province, municipality, school, patec, status")
      .order("code");
    setFarmers((data as FarmerPatec[]) || []);
    setLoading(false);
  };

  const fetchPatecItems = async () => {
    const { data } = await supabase
      .from("patec_items")
      .select("*")
      .order("created_at");
    setPatecItems((data as PatecItem[]) || []);
  };

  useEffect(() => {
    fetchFarmers();
    fetchPatecItems();
  }, []);

  const getItems = (patecNum: number, category: string) =>
    patecItems.filter((i) => i.patec_number === patecNum && i.category === category);

  const handleAddItem = async () => {
    if (!addingCategory || !newItemName.trim()) return;
    const { error } = await supabase.from("patec_items").insert({
      patec_number: addingCategory.patec,
      category: addingCategory.category,
      name: newItemName.trim(),
    });
    if (error) {
      toast.error("Erro ao adicionar item");
    } else {
      toast.success("Item adicionado");
      setNewItemName("");
      setAddingCategory(null);
      fetchPatecItems();
    }
  };

  const handleDeleteItem = async (item: PatecItem) => {
    const { error } = await supabase.from("patec_items").delete().eq("id", item.id);
    if (error) {
      toast.error("Erro ao remover item");
    } else {
      toast.success(`"${item.name}" removido`);
      fetchPatecItems();
    }
  };

  const filtered = farmers.filter((f) => {
    const matchesSearch =
      f.full_name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase());
    const matchesPatec =
      filterPatec === "all" ||
      (filterPatec === "none" && !f.patec) ||
      String(f.patec) === filterPatec;
    return matchesSearch && matchesPatec;
  });

  const stats = {
    total: farmers.length,
    patec1: farmers.filter((f) => f.patec === 1).length,
    patec2: farmers.filter((f) => f.patec === 2).length,
    patec3: farmers.filter((f) => f.patec === 3).length,
    semPatec: farmers.filter((f) => !f.patec).length,
  };

  const handleSavePatec = async () => {
    if (!editFarmer) return;
    setSaving(true);
    const newPatec = editPatec ? parseInt(editPatec) : null;
    const { error } = await supabase
      .from("farmers")
      .update({ patec: newPatec })
      .eq("id", editFarmer.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atribuir PATEC");
    } else {
      toast.success(`PATEC ${newPatec || "removido"} atribuído a ${editFarmer.full_name}`);
      setEditFarmer(null);
      fetchFarmers();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((f) => f.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkSave = async () => {
    if (!bulkPatec || selectedIds.size === 0) return;
    setSaving(true);
    const newPatec = parseInt(bulkPatec);
    const ids = Array.from(selectedIds);
    let errorCount = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { error } = await supabase.from("farmers").update({ patec: newPatec }).in("id", batch);
      if (error) errorCount++;
    }
    setSaving(false);
    setBulkDialogOpen(false);
    setBulkPatec("");
    if (errorCount > 0) {
      toast.error(`Erro ao atribuir PATEC a alguns produtores`);
    } else {
      toast.success(`PATEC ${newPatec} atribuído a ${ids.length} produtor(es)`);
    }
    setSelectedIds(new Set());
    fetchFarmers();
  };

  const isAllSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const isSomeSelected = selectedIds.size > 0;

  // Render editable item list for a category
  const renderItemList = (patecNum: number, category: string) => {
    const items = getItems(patecNum, category);
    const isAdding = addingCategory?.patec === patecNum && addingCategory?.category === category;

    return (
      <div key={category} className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className={`font-semibold text-xs ${categoryColors[category]}`}>{categoryLabels[category]}</p>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => { setAddingCategory({ patec: patecNum, category }); setNewItemName(""); }}
              title="Adicionar item"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between group bg-muted/30 rounded px-2 py-1">
              <span className="text-xs">{item.name}</span>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  onClick={() => handleDeleteItem(item)}
                  title="Remover item"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground italic">Sem itens</p>}
        </div>
        {isAdding && (
          <div className="flex gap-1 mt-1">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Nome do item..."
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={handleAddItem} disabled={!newItemName.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setAddingCategory(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          Pacotes Tecnológicos (PATEC)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestão e atribuição dos pacotes tecnológicos aos produtores — Ano de Arranque MOSAP III
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterPatec("all")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Produtores</p>
          </CardContent>
        </Card>
        {[1, 2, 3].map((p) => (
          <Card key={p} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterPatec(String(p))}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{p === 1 ? stats.patec1 : p === 2 ? stats.patec2 : stats.patec3}</p>
              <p className="text-xs text-muted-foreground">PATEC {p}</p>
              <Badge variant="outline" className={`mt-1 text-[10px] ${patecMeta[p].color}`}>
                {patecMeta[p].cultures}
              </Badge>
            </CardContent>
          </Card>
        ))}
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setFilterPatec("none")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.semPatec}</p>
            <p className="text-xs text-muted-foreground">Sem PATEC</p>
          </CardContent>
        </Card>
      </div>

      {/* Composition cards - editable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((p) => (
          <Card key={p} className="border-l-4" style={{ borderLeftColor: p === 1 ? "hsl(var(--chart-1))" : p === 2 ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                {patecMeta[p].title}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewPatec(p)}>
                  <Eye className="h-3 w-3 mr-1" /> Detalhes
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              {["insumos", "pecuaria", "servicos"].map((cat) => renderItemList(p, cat))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Bulk action bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterPatec} onValueChange={setFilterPatec}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar PATEC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="1">PATEC 1 — Milho</SelectItem>
              <SelectItem value="2">PATEC 2 — Massango</SelectItem>
              <SelectItem value="3">PATEC 3 — Massambala</SelectItem>
              <SelectItem value="none">Sem PATEC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSomeSelected && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 animate-in fade-in slide-in-from-top-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedIds.size} produtor{selectedIds.size > 1 ? "es" : ""} seleccionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={clearSelection}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => { setBulkDialogOpen(true); setBulkPatec(""); }}>
              <Package className="h-3 w-3 mr-1" /> Atribuir PATEC em lote
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} aria-label="Seleccionar todos" />
                </TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Província</TableHead>
                <TableHead>Escola</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>PATEC</TableHead>
                <TableHead className="text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum produtor encontrado</TableCell></TableRow>
              ) : filtered.map((f) => (
                <TableRow key={f.id} className={selectedIds.has(f.id) ? "bg-primary/5" : ""}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(f.id)} onCheckedChange={() => toggleSelect(f.id)} aria-label={`Seleccionar ${f.full_name}`} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{f.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/agricultores/${f.code}`} className="text-primary hover:underline">{f.full_name}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.province || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.school || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === "Ativo" ? "default" : "secondary"} className="text-[10px]">{f.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {f.patec ? (
                      <Badge variant="outline" className={`text-[10px] ${patecMeta[f.patec]?.color || ""}`}>
                        PATEC {f.patec}
                      </Badge>
                    ) : (
                      <span className="text-xs text-destructive font-medium">Não atribuído</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditFarmer(f); setEditPatec(f.patec ? String(f.patec) : ""); }}>
                      <Edit2 className="h-3 w-3 mr-1" /> Atribuir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog (single) */}
      <Dialog open={!!editFarmer} onOpenChange={(o) => !o && setEditFarmer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir PATEC — {editFarmer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Código: <span className="font-mono font-semibold">{editFarmer?.code}</span>
            </p>
            <Select value={editPatec} onValueChange={setEditPatec}>
              <SelectTrigger><SelectValue placeholder="Seleccionar PATEC" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">PATEC 1 — Milho + Feijão + Gado</SelectItem>
                <SelectItem value="2">PATEC 2 — Massango + Feijão + Gado</SelectItem>
                <SelectItem value="3">PATEC 3 — Massambala + Feijão + Gado</SelectItem>
              </SelectContent>
            </Select>
            {editPatec && (
              <div className="border rounded-lg p-3 text-xs space-y-2 bg-muted/30">
                <p className="font-semibold">{patecMeta[parseInt(editPatec)]?.title}</p>
                <div className="grid grid-cols-3 gap-2">
                  {["insumos", "pecuaria", "servicos"].map((cat) => (
                    <div key={cat}>
                      <p className="font-medium text-muted-foreground mb-1">{categoryLabels[cat]}</p>
                      <ul className="space-y-0.5">
                        {getItems(parseInt(editPatec), cat).map((i) => <li key={i.id}>• {i.name}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFarmer(null)}>Cancelar</Button>
            <Button onClick={handleSavePatec} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk assign Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(o) => !o && setBulkDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir PATEC em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Vai atribuir o mesmo PATEC a <span className="font-bold text-foreground">{selectedIds.size}</span> produtor{selectedIds.size > 1 ? "es" : ""} seleccionado{selectedIds.size > 1 ? "s" : ""}:
            </p>
            <div className="max-h-32 overflow-y-auto border rounded-lg p-2 text-xs space-y-1 bg-muted/20">
              {filtered.filter((f) => selectedIds.has(f.id)).map((f) => (
                <div key={f.id} className="flex items-center justify-between">
                  <span><span className="font-mono text-muted-foreground">{f.code}</span> — {f.full_name}</span>
                  {f.patec && <Badge variant="outline" className={`text-[9px] ${patecMeta[f.patec]?.color || ""}`}>PATEC {f.patec}</Badge>}
                </div>
              ))}
            </div>
            <Select value={bulkPatec} onValueChange={setBulkPatec}>
              <SelectTrigger><SelectValue placeholder="Seleccionar PATEC para todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">PATEC 1 — Milho + Feijão + Gado</SelectItem>
                <SelectItem value="2">PATEC 2 — Massango + Feijão + Gado</SelectItem>
                <SelectItem value="3">PATEC 3 — Massambala + Feijão + Gado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkSave} disabled={saving || !bulkPatec}>
              {saving ? "Guardando..." : `Atribuir a ${selectedIds.size} produtor${selectedIds.size > 1 ? "es" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View PATEC detail Dialog */}
      <Dialog open={viewPatec !== null} onOpenChange={(o) => !o && setViewPatec(null)}>
        <DialogContent className="max-w-lg">
          {viewPatec && patecMeta[viewPatec] && (
            <>
              <DialogHeader>
                <DialogTitle>{patecMeta[viewPatec].title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 text-sm">
                {["insumos", "pecuaria", "servicos"].map((cat) => (
                  <div key={cat}>
                    <h3 className="font-semibold mb-2 text-primary">{categoryLabels[cat]}</h3>
                    <ul className="space-y-1">
                      {getItems(viewPatec, cat).map((i) => (
                        <li key={i.id} className="flex items-center justify-between group">
                          <span className="flex items-start gap-2"><span className="text-primary">•</span>{i.name}</span>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                              onClick={() => handleDeleteItem(i)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {isAdmin && (
                      <div className="mt-2">
                        {addingCategory?.patec === viewPatec && addingCategory?.category === cat ? (
                          <div className="flex gap-1">
                            <Input
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              placeholder="Nome do item..."
                              className="h-7 text-xs"
                              autoFocus
                              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                            />
                            <Button size="sm" className="h-7 text-xs px-2" onClick={handleAddItem} disabled={!newItemName.trim()}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setAddingCategory(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-primary"
                            onClick={() => { setAddingCategory({ patec: viewPatec, category: cat }); setNewItemName(""); }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Adicionar item
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-xs text-muted-foreground border-t pt-3">
                  Produtores com este pacote: <span className="font-bold">{farmers.filter((f) => f.patec === viewPatec).length}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Patec;
