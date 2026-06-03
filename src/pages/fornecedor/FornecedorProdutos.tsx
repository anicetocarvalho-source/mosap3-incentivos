import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Package, Download } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { UnitSelect } from "@/components/ui/unit-select";
import { usePatecCatalogIndex } from "@/hooks/usePatecCatalogIndex";

const patecLabels: Record<string, string> = { "1": "PATEC 1 — Milho", "2": "PATEC 2 — Massango", "3": "PATEC 3 — Massambala" };

interface PatecItem { id: string; name: string; category: string; patec_number: number; }

const FornecedorProdutos = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "insumos", unit: "un", price: "", stock: "", iva_rate: "14", patec_number: "", patec_category: "", max_per_farmer_per_season: "" });
  const [patecFilter, setPatecFilter] = useState<"todos" | "em_patec" | "fora_patec">("todos");
  const catalogIndex = usePatecCatalogIndex();

  // PATEC import state
  const [importOpen, setImportOpen] = useState(false);
  const [importPatecNum, setImportPatecNum] = useState<number>(1);
  const [patecItems, setPatecItems] = useState<PatecItem[]>([]);
  const [selectedImport, setSelectedImport] = useState<Set<string>>(new Set());
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from("supplier_products").select("*").eq("supplier_id", supplier.id).order("name");
    if (err) setError(err as unknown as Error);
    else setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [supplier.id]);

  const openNew = () => { setEditing(null); setForm({ name: "", category: "insumos", unit: "un", price: "", stock: "", iva_rate: "14", patec_number: "", patec_category: "", max_per_farmer_per_season: "" }); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, category: p.category, unit: p.unit, price: String(p.price), stock: String(p.stock), iva_rate: String(p.iva_rate), patec_number: p.patec_number ? String(p.patec_number) : "", patec_category: p.patec_category || "", max_per_farmer_per_season: p.max_per_farmer_per_season ? String(p.max_per_farmer_per_season) : "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error("Nome e preço são obrigatórios"); return; }
    const payload = {
      supplier_id: supplier.id,
      name: form.name,
      category: form.category,
      unit: form.unit,
      price: parseFloat(form.price),
      stock: parseInt(form.stock) || 0,
      iva_rate: parseFloat(form.iva_rate) || 14,
      patec_number: form.patec_number ? parseInt(form.patec_number) : null,
      patec_category: form.patec_number && form.patec_category ? form.patec_category : null,
      max_per_farmer_per_season: form.max_per_farmer_per_season ? parseInt(form.max_per_farmer_per_season) : null,
    };
    try {
      if (editing) {
        const { error: err } = await supabase.from("supplier_products").update(payload).eq("id", editing.id);
        if (err) throw err;
        toast.success("Produto actualizado");
      } else {
        const { error: err } = await supabase.from("supplier_products").insert(payload);
        if (err) throw err;
        toast.success("Produto adicionado");
      }
      setDialogOpen(false);
      fetchProducts();
    } catch (e: any) {
      toast.error("Erro ao guardar produto: " + (e.message || "tente novamente"));
    }
  };

  const handleDelete = async (id: string) => {
    const { error: err } = await supabase.from("supplier_products").delete().eq("id", id);
    if (err) toast.error("Erro ao remover produto: " + err.message);
    else {
      toast.success("Produto removido");
      fetchProducts();
    }
  };

  // PATEC import
  const categoryMap: Record<string, string> = { "Insumos": "insumos", "Pecuária": "pecuaria", "Serviços": "servicos" };

  const openImportPatec = async (patecNum: number) => {
    setImportPatecNum(patecNum);
    setImporting(false);
    const [{ data: items }, { data: existing }] = await Promise.all([
      supabase.from("patec_items").select("*").eq("patec_number", patecNum).order("category, name"),
      supabase.from("supplier_products").select("name, patec_number").eq("supplier_id", supplier.id).eq("patec_number", patecNum),
    ]);
    setPatecItems(items || []);
    const names = new Set((existing || []).map((p: any) => p.name.toLowerCase()));
    setExistingNames(names);
    const newItems = (items || []).filter(i => !names.has(i.name.toLowerCase()));
    setSelectedImport(new Set(newItems.map(i => i.id)));
    setImportOpen(true);
  };

  const handleImport = async () => {
    if (selectedImport.size === 0) return;
    setImporting(true);
    const toImport = patecItems.filter(i => selectedImport.has(i.id) && !existingNames.has(i.name.toLowerCase()));
    if (toImport.length === 0) { toast.info("Nenhum item novo para importar"); setImporting(false); return; }
    const rows = toImport.map(i => ({
      supplier_id: supplier.id, name: i.name, patec_number: i.patec_number,
      patec_category: i.category, category: categoryMap[i.category] || "insumos",
      price: 0, stock: 0, unit: "un", iva_rate: 14,
    }));
    const { error } = await supabase.from("supplier_products").insert(rows);
    if (error) { toast.error("Erro ao importar"); setImporting(false); return; }
    toast.success(`${toImport.length} produto(s) importado(s) do PATEC ${importPatecNum}`);
    setImportOpen(false);
    fetchProducts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Catálogo de Produtos</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={patecFilter} onValueChange={(v: any) => setPatecFilter(v)}>
            <SelectTrigger className="w-auto h-8 text-xs gap-1 min-w-[150px]">
              <SelectValue placeholder="Filtro PATEC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              <SelectItem value="em_patec">Apenas em PATEC</SelectItem>
              <SelectItem value="fora_patec">Fora de PATEC</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => openImportPatec(Number(v))}>
            <SelectTrigger className="w-auto h-8 text-xs gap-1">
              <Download className="h-3 w-3" />
              <SelectValue placeholder="Importar do PATEC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">PATEC 1 — Milho</SelectItem>
              <SelectItem value="2">PATEC 2 — Massango</SelectItem>
              <SelectItem value="3">PATEC 3 — Massambala</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </div>
      </div>


      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <LoadingState rows={6} />
          ) : error ? (
            <ErrorState onRetry={fetchProducts} />
          ) : products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto no catálogo"
              description="Adicione produtos manualmente ou importe a partir de um PATEC."
              action={{ label: "Adicionar primeiro produto", onClick: openNew }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>PATEC</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Limite/Época</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products
                    .filter((p) => {
                      if (patecFilter === "todos") return true;
                      const inPatec = catalogIndex.isInAnyPatec(p.name);
                      return patecFilter === "em_patec" ? inPatec : !inPatec;
                    })
                    .map((p) => {
                      const codes = catalogIndex.getPatecCodes(p.name);
                      const inPatec = codes.length > 0;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              {inPatec ? (
                                <Badge variant="secondary" className="text-[9px] bg-success/15 text-success border-success/30">
                                  PATEC: {codes.join(", ")}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] text-warning border-warning/40">
                                  Fora de PATEC
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                          <TableCell>{p.patec_number ? `PATEC ${p.patec_number}` : "—"}</TableCell>
                          <TableCell className="text-right">{Number(p.price).toLocaleString("pt-AO")} Kz</TableCell>
                          <TableCell className="text-right">{p.stock} {p.unit}</TableCell>
                          <TableCell className="text-right">{p.max_per_farmer_per_season ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="insumos">Insumos</SelectItem><SelectItem value="pecuaria">Pecuária</SelectItem><SelectItem value="servicos">Serviços</SelectItem><SelectItem value="equipamentos">Equipamentos</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>PATEC</Label>
                <Select value={form.patec_number} onValueChange={(v) => setForm({ ...form, patec_number: v, patec_category: v ? form.patec_category : "" })}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent><SelectItem value="1">PATEC 1</SelectItem><SelectItem value="2">PATEC 2</SelectItem><SelectItem value="3">PATEC 3</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {form.patec_number && (
              <div>
                <Label>Categoria PATEC</Label>
                <Select value={form.patec_category} onValueChange={(v) => setForm({ ...form, patec_category: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Insumos">Insumos</SelectItem>
                    <SelectItem value="Pecuária">Pecuária</SelectItem>
                    <SelectItem value="Serviços">Serviços</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Preço (Kz) *</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
              <div><Label>Unidade</Label><UnitSelect value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} triggerClassName="h-10" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>IVA (%)</Label><Input type="number" value={form.iva_rate} onChange={(e) => setForm({ ...form, iva_rate: e.target.value })} /></div>
              <div><Label>Limite/produtor/época</Label><Input type="number" value={form.max_per_farmer_per_season} onChange={(e) => setForm({ ...form, max_per_farmer_per_season: e.target.value })} placeholder="Sem limite" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Guardar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PATEC Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Importar itens — PATEC {importPatecNum}
            </DialogTitle>
          </DialogHeader>
          {patecItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item definido para este PATEC.</p>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {["Insumos", "Pecuária", "Serviços"].map((cat) => {
                const items = patecItems.filter(i => i.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{cat}</p>
                    {items.map((item) => {
                      const exists = existingNames.has(item.name.toLowerCase());
                      return (
                        <label key={item.id} className={`flex items-center gap-2 py-1.5 px-2 rounded text-sm ${exists ? "opacity-50" : "hover:bg-muted/50 cursor-pointer"}`}>
                          <Checkbox
                            checked={exists || selectedImport.has(item.id)}
                            disabled={exists}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedImport);
                              if (checked) next.add(item.id); else next.delete(item.id);
                              setSelectedImport(next);
                            }}
                          />
                          <span>{item.name}</span>
                          {exists && <Badge variant="outline" className="text-[9px] ml-auto">Já existe</Badge>}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing || selectedImport.size === 0}>
              {importing ? "A importar..." : `Importar (${[...selectedImport].filter(id => !existingNames.has(patecItems.find(i => i.id === id)?.name.toLowerCase() || "")).length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedorProdutos;
