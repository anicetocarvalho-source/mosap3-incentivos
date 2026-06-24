import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
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
import { Plus, Pencil, Trash2, Package, Download, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { UnitSelect } from "@/components/ui/unit-select";
import { usePatecCatalogIndex } from "@/hooks/usePatecCatalogIndex";
import { usePatecLabel } from "@/hooks/usePatecLabel";

interface PatecItem { id: string; name: string; category: string; patec_number: number; }

const categoryMap: Record<string, string> = { "Insumos": "insumos", "Pecuária": "pecuaria", "Serviços": "servicos" };


const FornecedorProdutos = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  const [_, setParams] = useSearchParams();
  const goToStock = () => {
    const p = new URLSearchParams();
    p.set("tab", "stock");
    setParams(p, { replace: true });
  };
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "insumos", unit: "un", iva_rate: "14", patec_number: "", patec_category: "", max_per_farmer_per_season: "" });
  const [patecFilter, setPatecFilter] = useState<"todos" | "em_patec" | "fora_patec">("todos");
  const { patecs: patecCatalog, labelByLegacy: patecLabel } = usePatecLabel({ activeOnly: true });
  const catalogIndex = usePatecCatalogIndex();

  // PATEC import state
  const [importOpen, setImportOpen] = useState(false);
  const [importPatecNum, setImportPatecNum] = useState<number>(1);
  const [patecItems, setPatecItems] = useState<PatecItem[]>([]);
  const [selectedImport, setSelectedImport] = useState<Set<string>>(new Set());
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Catalog-driven new product state
  const [manualMode, setManualMode] = useState(false);
  const [pickerPatec, setPickerPatec] = useState<string>("");
  const [pickerItemId, setPickerItemId] = useState<string>("");
  const [pickerItems, setPickerItems] = useState<PatecItem[]>([]);
  const [pickerExistingNames, setPickerExistingNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pickerPatec) { setPickerItems([]); setPickerExistingNames(new Set()); return; }
    const num = Number(pickerPatec);
    (async () => {
      const [{ data: items }, { data: existing }] = await Promise.all([
        supabase.from("patec_items").select("id, name, category, patec_number").eq("patec_number", num).eq("is_active", true).order("category, name"),
        supabase.from("supplier_products").select("name").eq("supplier_id", supplier.id).eq("patec_number", num),
      ]);
      setPickerItems((items as PatecItem[]) || []);
      setPickerExistingNames(new Set((existing || []).map((p: any) => (p.name || "").toLowerCase())));
      setPickerItemId("");
    })();
  }, [pickerPatec, supplier.id]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from("supplier_products").select("*").eq("supplier_id", supplier.id).order("name");
    if (err) setError(err as unknown as Error);
    else setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [supplier.id]);

  const openNew = () => {
    setEditing(null);
    setManualMode(false);
    setPickerPatec("");
    setPickerItemId("");
    setForm({ name: "", category: "insumos", unit: "un", iva_rate: "14", patec_number: "", patec_category: "", max_per_farmer_per_season: "" });
    setDialogOpen(true);
  };
  const openEdit = (p: any) => {
    setEditing(p);
    setManualMode(true);
    setForm({ name: p.name, category: p.category, unit: p.unit, iva_rate: String(p.iva_rate), patec_number: p.patec_number ? String(p.patec_number) : "", patec_category: p.patec_category || "", max_per_farmer_per_season: p.max_per_farmer_per_season ? String(p.max_per_farmer_per_season) : "" });
    setDialogOpen(true);
  };

  const pickItemFromCatalog = (itemId: string) => {
    setPickerItemId(itemId);
    const item = pickerItems.find((i) => i.id === itemId);
    if (!item) return;
    setForm((prev) => ({
      ...prev,
      name: item.name,
      category: categoryMap[item.category] || "insumos",
      patec_number: String(item.patec_number),
      patec_category: item.category,
    }));
  };

  const handleSave = async () => {
    if (!editing && !manualMode && !pickerItemId) { toast.error("Seleccione um item do catálogo PATEC"); return; }
    if (!form.name) { toast.error("Nome é obrigatório"); return; }
    if (!editing && !manualMode && pickerExistingNames.has(form.name.toLowerCase())) {
      toast.error("Já existe um produto com este nome no catálogo."); return;
    }
    const basePayload: any = {
      supplier_id: supplier.id,
      name: form.name,
      category: form.category,
      unit: form.unit,
      iva_rate: parseFloat(form.iva_rate) || 14,
      patec_number: form.patec_number ? parseInt(form.patec_number) : null,
      patec_category: form.patec_number && form.patec_category ? form.patec_category : null,
      max_per_farmer_per_season: form.max_per_farmer_per_season ? parseInt(form.max_per_farmer_per_season) : null,
    };
    // Link to PATEC catalog item when chosen — DB trigger will sync name/category/unit automatically
    if (!editing && !manualMode && pickerItemId) {
      basePayload.patec_item_id = pickerItemId;
    }
    try {
      if (editing) {
        // Preço e stock são geridos apenas em "Stock & Preços" — não sobrescrever aqui.
        const { error: err } = await supabase.from("supplier_products").update(basePayload).eq("id", editing.id);
        if (err) throw err;
        toast.success("Produto actualizado");
      } else {
        const { error: err } = await supabase.from("supplier_products").insert({ ...basePayload, price: 0, stock: 0 });
        if (err) throw err;
        toast.success("Produto adicionado. Defina preço e stock em 'Stock & Preços'.");
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


  const openImportPatec = async (patecNum: number) => {
    setImportPatecNum(patecNum);
    setImporting(false);
    const [{ data: items }, { data: existing }] = await Promise.all([
      supabase.from("patec_items").select("*").eq("patec_number", patecNum).eq("is_active", true).order("category, name"),
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
      supplier_id: supplier.id, patec_item_id: i.id,
      name: i.name, patec_number: i.patec_number,
      patec_category: i.category, category: categoryMap[i.category] || "insumos",
      price: 0, stock: 0, unit: "un", iva_rate: 14,
    }));
    const { error } = await supabase.from("supplier_products").insert(rows);
    if (error) { toast.error("Erro ao importar"); setImporting(false); return; }
    toast.success(`${toImport.length} produto(s) importado(s) — ${patecLabel(importPatecNum)}`);
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
              {patecCatalog.filter((p) => p.legacy_number != null).map((p) => (
                <SelectItem key={p.id} value={String(p.legacy_number)}>{patecLabel(p.legacy_number!)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </div>
      </div>

      <div className="rounded-md border border-info/30 bg-info/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium text-foreground">Preço e stock são geridos em Stock &amp; Preços</p>
          <p className="text-muted-foreground">Para definir ou alterar preço e stock de um produto, utilize o separador seguinte.</p>
        </div>
        <Button variant="outline" size="sm" onClick={goToStock} className="shrink-0">
          Ir para Stock &amp; Preços <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
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
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
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
                          <TableCell>{p.patec_number ? patecLabel(p.patec_number) : "—"}</TableCell>
                          <TableCell>{p.unit}</TableCell>
                          <TableCell className="text-right">{Number(p.iva_rate ?? 14)}%</TableCell>
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
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            {!editing && (
              <p className="text-xs text-muted-foreground">
                {manualMode
                  ? "Adição manual — produto ficará marcado como Fora de PATEC e não será elegível para incentivos."
                  : "Seleccione um item da composição oficial dos PATECs. A lista garante consistência com o catálogo central."}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-3">
            {!editing && !manualMode && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>PATEC *</Label>
                    <Select value={pickerPatec} onValueChange={setPickerPatec}>
                      <SelectTrigger><SelectValue placeholder="Escolher PATEC..." /></SelectTrigger>
                      <SelectContent>
                        {patecCatalog.filter((p) => p.legacy_number != null).map((p) => (
                          <SelectItem key={p.id} value={String(p.legacy_number)}>{patecLabel(p.legacy_number!)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Item da composição *</Label>
                    <Select value={pickerItemId} onValueChange={pickItemFromCatalog} disabled={!pickerPatec || pickerItems.length === 0}>
                      <SelectTrigger><SelectValue placeholder={!pickerPatec ? "Escolha o PATEC primeiro" : pickerItems.length === 0 ? "Sem itens" : "Escolher item..."} /></SelectTrigger>
                      <SelectContent>
                        {pickerItems.map((i) => {
                          const exists = pickerExistingNames.has(i.name.toLowerCase());
                          return (
                            <SelectItem key={i.id} value={i.id} disabled={exists}>
                              <span className="text-xs text-muted-foreground mr-1">[{i.category}]</span>
                              {i.name} {exists ? "— já no catálogo" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <button type="button" onClick={() => setManualMode(true)} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Adicionar fora do catálogo PATEC (excepcional)
                </button>
              </>
            )}

            {(editing || manualMode) && (
              <>
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
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        {patecCatalog.filter((p) => p.legacy_number != null).map((p) => (
                          <SelectItem key={p.id} value={String(p.legacy_number)}>{patecLabel(p.legacy_number!)}</SelectItem>
                        ))}
                      </SelectContent>
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
                {!editing && manualMode && (
                  <button type="button" onClick={() => setManualMode(false)} className="text-xs text-primary hover:underline">
                    ← Voltar ao catálogo PATEC
                  </button>
                )}
              </>
            )}

            {(editing || manualMode || pickerItemId) && (
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Unidade</Label><UnitSelect value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} triggerClassName="h-10" /></div>
                <div><Label>IVA (%)</Label><Input type="number" value={form.iva_rate} onChange={(e) => setForm({ ...form, iva_rate: e.target.value })} /></div>
                <div><Label>Limite/produtor/época</Label><Input type="number" value={form.max_per_farmer_per_season} onChange={(e) => setForm({ ...form, max_per_farmer_per_season: e.target.value })} placeholder="Sem limite" /></div>
              </div>
            )}

            <div className="rounded-md border border-info/30 bg-info/10 p-2.5 text-xs text-muted-foreground">
              <strong className="text-foreground">Preço e stock</strong> são definidos no separador <strong>Stock &amp; Preços</strong>, com registo de motivo e histórico de alterações.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!editing && !manualMode && !pickerItemId}>{editing ? "Guardar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>

      </Dialog>

      {/* PATEC Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Importar itens — {patecLabel(importPatecNum)}
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
