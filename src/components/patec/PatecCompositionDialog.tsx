import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Package, Pencil, Check, X, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { UnitSelect } from "@/components/ui/unit-select";
import type { Patec } from "@/hooks/usePatecs";

interface PatecItem {
  id: string;
  patec_code: string | null;
  patec_number: number | null;
  category: string;
  subcategory: string | null;
  culture: string | null;
  name: string;
  base_quantity: number | null;
  unit: string | null;
  sort_order: number;
}

const SUBCATEGORY_LABELS: Record<string, string> = {
  semente: "Sementes",
  adubo: "Adubos",
  corretivo: "Correctivos do Solo",
  fitossanitario: "Fitossanitários",
  inseticida: "Inseticidas",
  fungicida: "Fungicidas",
  planta_melhoradora: "Plantas Melhoradoras",
  muda_fruteira_florestal: "Mudas Frutícolas e Florestais",
  embalagem: "Embalagens",
  animal: "Efectivo Animal",
  racao: "Ração",
  antibiotico: "Antibióticos",
  desparasitante_interno: "Desparasitantes Internos",
  desparasitante_externo: "Desparasitante Externo",
  vitamina: "Vitaminas",
  vacina: "Vacinas",
  anti_inflamatorio: "Anti-inflamatórios",
  irrigacao: "Irrigação",
  sistema_rega: "Irrigação (Sistema de Rega)",
  equipamento: "Equipamentos e Ferramentas",
};

const AGRICULTURA_SUBS = [
  "semente",
  "adubo",
  "corretivo",
  "fitossanitario",
  "inseticida",
  "fungicida",
  "planta_melhoradora",
  "muda_fruteira_florestal",
  "embalagem",
  "sistema_rega",
  "irrigacao",
  "equipamento",
];

const PECUARIA_SUBS = [
  "animal",
  "racao",
  "antibiotico",
  "desparasitante_interno",
  "desparasitante_externo",
  "vitamina",
  "vacina",
  "anti_inflamatorio",
  "equipamento",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patec: Patec | null;
  onMutated?: () => void;
}

type NewItemDraft = {
  name: string;
  subcategory: string;
  culture: string;
  base_quantity: string;
  unit: string;
};

const emptyDraft = (): NewItemDraft => ({
  name: "",
  subcategory: "",
  culture: "",
  base_quantity: "",
  unit: "",
});

export default function PatecCompositionDialog({ open, onOpenChange, patec, onMutated }: Props) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<PatecItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editFullDraft, setEditFullDraft] = useState<NewItemDraft>(emptyDraft());
  const [editFullCategory, setEditFullCategory] = useState<"agricultura" | "pecuaria">("agricultura");
  const [editMode, setEditMode] = useState<"quick" | "full">("quick");
  const [saving, setSaving] = useState(false);
  const [addingCategory, setAddingCategory] = useState<"agricultura" | "pecuaria" | null>(null);
  const [newItem, setNewItem] = useState<NewItemDraft>(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PatecItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"agricultura" | "pecuaria">("agricultura");

  const fetchItems = async () => {
    if (!patec) return;
    setLoading(true);
    const { data } = await supabase
      .from("patec_items" as any)
      .select("*")
      .eq("patec_code", patec.code)
      .order("sort_order");
    setItems((data as unknown as PatecItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open || !patec) return;
    fetchItems();
    setEditingId(null);
    setAddingCategory(null);
    setNewItem(emptyDraft());
    setActiveTab("agricultura");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patec]);

  // Sincroniza tab activo com a categoria predominante quando items carregam pela 1ª vez
  useEffect(() => {
    if (!loading && items.length > 0) {
      setActiveTab((prev) => prev ?? computedDefaultTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const byCategory = useMemo(() => {
    const m: Record<string, PatecItem[]> = { agricultura: [], pecuaria: [] };
    for (const it of items) {
      // Fallback defensivo: categorias desconhecidas (ex: legado 'equipamento'/'irrigacao')
      // são reclassificadas como 'agricultura' para nunca desaparecerem da UI.
      const cat = it.category === "agricultura" || it.category === "pecuaria" ? it.category : "agricultura";
      (m[cat] ||= []).push(it);
    }
    return m;
  }, [items]);

  const cultureSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.culture) s.add(it.culture);
    return Array.from(s).sort();
  }, [items]);

  const norm = (v: string | null | undefined) => (v || "").trim().toLowerCase();

  /**
   * Verifica duplicados na composição do pacote.
   * Regra: dentro do mesmo patec_code, não pode existir outro item com a mesma
   * combinação (subcategoria + cultura + nome), ignorando maiúsculas/espaços.
   * Cultura vazia conta como grupo próprio ("sem cultura").
   */
  const findDuplicate = (
    name: string,
    subcategory: string,
    culture: string,
    excludeId?: string
  ): PatecItem | null => {
    const n = norm(name);
    const s = norm(subcategory);
    const c = norm(culture);
    return (
      items.find(
        (it) =>
          it.id !== excludeId &&
          norm(it.name) === n &&
          norm(it.subcategory) === s &&
          norm(it.culture) === c
      ) || null
    );
  };

  const startEdit = (it: PatecItem) => {
    setEditingId(it.id);
    setEditMode("quick");
    setEditQty(it.base_quantity != null ? String(it.base_quantity).replace(".", ",") : "");
    setEditUnit(it.unit || "");
  };

  const startEditFull = (it: PatecItem) => {
    setEditingId(it.id);
    setEditMode("full");
    setEditFullCategory((it.category as "agricultura" | "pecuaria") || "agricultura");
    setEditFullDraft({
      name: it.name || "",
      subcategory: it.subcategory || "",
      culture: it.culture || "",
      base_quantity: it.base_quantity != null ? String(it.base_quantity).replace(".", ",") : "",
      unit: it.unit || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQty("");
    setEditUnit("");
    setEditFullDraft(emptyDraft());
    setEditMode("quick");
  };

  const saveEdit = async (it: PatecItem) => {
    const qtyRaw = editQty.trim().replace(",", ".");
    const unitRaw = editUnit.trim();
    if (qtyRaw === "") {
      toast.error("Quantidade obrigatória", { description: "Introduza um valor numérico." });
      return;
    }
    const qty = Number(qtyRaw);
    if (!isFinite(qty) || isNaN(qty)) {
      toast.error("Formato inválido", { description: "Use apenas números, vírgula ou ponto decimal." });
      return;
    }
    if (qty < 0) {
      toast.error("Quantidade inválida", { description: "Não são permitidos valores negativos." });
      return;
    }
    if (unitRaw === "") {
      toast.error("Unidade obrigatória", { description: "Introduza a unidade de medida (ex: kg, L, un, cabeça)." });
      return;
    }
    const unit = unitRaw || null;
    setSaving(true);
    const { error } = await supabase
      .from("patec_items" as any)
      .update({ base_quantity: qty, unit })
      .eq("id", it.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao guardar", { description: error.message });
      return;
    }
    toast.success("Quantidade actualizada");
    await fetchItems();
    onMutated?.();
    cancelEdit();
  };

  const saveEditFull = async (it: PatecItem) => {
    const name = editFullDraft.name.trim();
    const subcategory = editFullDraft.subcategory.trim();
    const culture = editFullDraft.culture.trim();
    const unit = editFullDraft.unit.trim();
    const qtyRaw = editFullDraft.base_quantity.trim().replace(",", ".");

    if (!name) {
      toast.error("Nome obrigatório");
      return;
    }
    if (!subcategory) {
      toast.error("Subcategoria obrigatória");
      return;
    }
    if (qtyRaw === "") {
      toast.error("Quantidade obrigatória");
      return;
    }
    const qty = Number(qtyRaw);
    if (!isFinite(qty) || isNaN(qty) || qty < 0) {
      toast.error("Quantidade inválida", { description: "Use número ≥ 0." });
      return;
    }
    if (!unit) {
      toast.error("Unidade obrigatória", { description: "Ex: kg, L, un, cabeça." });
      return;
    }

    const dup = findDuplicate(name, subcategory, culture, it.id);
    if (dup) {
      toast.error("Item duplicado", {
        description: `Já existe "${dup.name}" em ${
          SUBCATEGORY_LABELS[dup.subcategory || ""] || dup.subcategory || "—"
        }${dup.culture ? ` / ${dup.culture}` : ""}. Ajuste o item existente em vez de duplicar.`,
      });
      return;
    }
    setSaving(true);
    const patch = {
      name,
      subcategory,
      culture: culture || null,
      base_quantity: qty,
      unit,
    };
    const { error } = await supabase
      .from("patec_items" as any)
      .update(patch)
      .eq("id", it.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao guardar", { description: error.message });
      return;
    }
    toast.success("Item actualizado");
    const targetCat = (patch as any).subcategory && PECUARIA_SUBS.includes((patch as any).subcategory) ? "pecuaria" : (it.category === "pecuaria" ? "pecuaria" : "agricultura");
    setActiveTab(targetCat as "agricultura" | "pecuaria");
    await fetchItems();
    onMutated?.();
    cancelEdit();
  };

  const openAdd = (category: "agricultura" | "pecuaria") => {
    setAddingCategory(category);
    setNewItem(emptyDraft());
  };

  const cancelAdd = () => {
    setAddingCategory(null);
    setNewItem(emptyDraft());
  };

  const submitAdd = async () => {
    if (!patec || !addingCategory) return;
    const name = newItem.name.trim();
    const subcategory = newItem.subcategory.trim();
    const culture = newItem.culture.trim();
    const unit = newItem.unit.trim();
    const qtyRaw = newItem.base_quantity.trim().replace(",", ".");

    if (!name) {
      toast.error("Nome obrigatório");
      return;
    }
    if (!subcategory) {
      toast.error("Subcategoria obrigatória");
      return;
    }
    if (qtyRaw === "") {
      toast.error("Quantidade obrigatória");
      return;
    }
    const qty = Number(qtyRaw);
    if (!isFinite(qty) || isNaN(qty) || qty < 0) {
      toast.error("Quantidade inválida", { description: "Use número ≥ 0." });
      return;
    }
    if (!unit) {
      toast.error("Unidade obrigatória", { description: "Ex: kg, L, un, cabeça." });
      return;
    }

    const dup = findDuplicate(name, subcategory, culture);
    if (dup) {
      toast.error("Item duplicado", {
        description: `Já existe "${dup.name}" em ${
          SUBCATEGORY_LABELS[dup.subcategory || ""] || dup.subcategory || "—"
        }${dup.culture ? ` / ${dup.culture}` : ""}. Edite a quantidade do item existente em vez de criar um novo.`,
      });
      return;
    }

    // Calcular sort_order = max do mesmo grupo (cultura+subcategoria) + 10
    const sameGroup = items.filter(
      (i) =>
        i.category === addingCategory &&
        (i.culture || "") === culture &&
        (i.subcategory || "") === subcategory
    );
    const maxOrder = sameGroup.reduce((m, i) => Math.max(m, i.sort_order || 0), 0);

    setAdding(true);
    const payload = {
      patec_code: patec.code,
      patec_number: patec.legacy_number ?? null,
      category: addingCategory,
      subcategory,
      culture: culture || null,
      name,
      base_quantity: qty,
      unit,
      sort_order: maxOrder + 10,
    };
    const { data, error } = await supabase
      .from("patec_items" as any)
      .insert(payload)
      .select()
      .single();
    setAdding(false);
    if (error) {
      toast.error("Erro ao adicionar item", { description: error.message });
      return;
    }
    toast.success("Item adicionado à composição");
    setActiveTab(addingCategory);
    await fetchItems();
    onMutated?.();
    cancelAdd();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("patec_items" as any)
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao remover", { description: error.message });
      return;
    }
    toast.success("Item removido da composição");
    await fetchItems();
    onMutated?.();
    setDeleteTarget(null);
  };

  const subcategoryOptions = addingCategory === "pecuaria" ? PECUARIA_SUBS : AGRICULTURA_SUBS;
  const datalistId = "patec-cultures-suggestions";

  const renderAddForm = () => (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide">
        Novo item — {addingCategory === "pecuaria" ? "Pecuária" : "Agricultura"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Nome do item *"
          value={newItem.name}
          onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
          className="h-8 text-sm"
          maxLength={120}
        />
        <Select
          value={newItem.subcategory}
          onValueChange={(v) => setNewItem((s) => ({ ...s, subcategory: v }))}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Subcategoria *" />
          </SelectTrigger>
          <SelectContent>
            {subcategoryOptions.map((k) => (
              <SelectItem key={k} value={k}>
                {SUBCATEGORY_LABELS[k] || k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Cultura / agrupamento (opcional)"
          value={newItem.culture}
          onChange={(e) => setNewItem((s) => ({ ...s, culture: e.target.value }))}
          className="h-8 text-sm"
          list={datalistId}
          maxLength={80}
        />
        <datalist id={datalistId}>
          {cultureSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Quantidade *"
            inputMode="decimal"
            value={newItem.base_quantity}
            onChange={(e) => setNewItem((s) => ({ ...s, base_quantity: e.target.value }))}
            className="h-8 text-sm"
          />
          <UnitSelect
            value={newItem.unit}
            onChange={(v) => setNewItem((s) => ({ ...s, unit: v }))}
            triggerClassName="h-8"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={cancelAdd} disabled={adding}>
          Cancelar
        </Button>
        <Button size="sm" onClick={submitAdd} disabled={adding}>
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
          Guardar
        </Button>
      </div>
    </div>
  );

  const renderGroup = (list: PatecItem[], category: "agricultura" | "pecuaria") => {
    const byCulture: Record<string, Record<string, PatecItem[]>> = {};
    for (const it of list) {
      const c = it.culture || "—";
      const s = it.subcategory || "outros";
      byCulture[c] ||= {};
      (byCulture[c][s] ||= []).push(it);
    }
    return (
      <>
        {isAdmin && (
          <div className="flex justify-end">
            {addingCategory === category ? null : (
              <Button size="sm" variant="outline" onClick={() => openAdd(category)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
              </Button>
            )}
          </div>
        )}
        {isAdmin && addingCategory === category && renderAddForm()}
        {Object.entries(byCulture).map(([culture, subs]) => (
          <div key={culture} className="space-y-3">
            <h3 className="text-sm font-semibold text-primary border-b pb-1">{culture}</h3>
            {Object.entries(subs).map(([sub, rows]) => (
              <div key={sub} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {SUBCATEGORY_LABELS[sub] || sub}
                </p>
                <div className="rounded-lg border divide-y">
                  {rows.map((r) => {
                    const isEditing = editingId === r.id;
                    const isFullEdit = isEditing && editMode === "full";
                    const editSubOptions =
                      editFullCategory === "pecuaria" ? PECUARIA_SUBS : AGRICULTURA_SUBS;
                    if (isFullEdit) {
                      return (
                        <div key={r.id} className="px-3 py-2 bg-primary/5 space-y-2">
                          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                            Editar item
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              placeholder="Nome do item *"
                              value={editFullDraft.name}
                              onChange={(e) =>
                                setEditFullDraft((s) => ({ ...s, name: e.target.value }))
                              }
                              className="h-8 text-sm"
                              maxLength={120}
                              autoFocus
                            />
                            <Select
                              value={editFullDraft.subcategory}
                              onValueChange={(v) =>
                                setEditFullDraft((s) => ({ ...s, subcategory: v }))
                              }
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Subcategoria *" />
                              </SelectTrigger>
                              <SelectContent>
                                {editSubOptions.map((k) => (
                                  <SelectItem key={k} value={k}>
                                    {SUBCATEGORY_LABELS[k] || k}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Cultura / agrupamento (opcional)"
                              value={editFullDraft.culture}
                              onChange={(e) =>
                                setEditFullDraft((s) => ({ ...s, culture: e.target.value }))
                              }
                              className="h-8 text-sm"
                              list={datalistId}
                              maxLength={80}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Quantidade *"
                                inputMode="decimal"
                                value={editFullDraft.base_quantity}
                                onChange={(e) =>
                                  setEditFullDraft((s) => ({ ...s, base_quantity: e.target.value }))
                                }
                                className="h-8 text-sm"
                              />
                              <UnitSelect
                                value={editFullDraft.unit}
                                onChange={(v) =>
                                  setEditFullDraft((s) => ({ ...s, unit: v }))
                                }
                                triggerClassName="h-8"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                              Cancelar
                            </Button>
                            <Button size="sm" onClick={() => saveEditFull(r)} disabled={saving}>
                              {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <Check className="h-3.5 w-3.5 mr-1" />
                              )}
                              Guardar
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                        <span className="flex-1 min-w-0 truncate">{r.name}</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              placeholder="Qtd"
                              inputMode="decimal"
                              className="h-7 w-20 text-xs"
                              autoFocus
                            />
                            <div className="w-28">
                              <UnitSelect
                                value={editUnit}
                                onChange={setEditUnit}
                                triggerClassName="h-7 text-xs"
                              />
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(r)} disabled={saving}>
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-success" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {r.base_quantity != null ? (
                              <span className="font-mono text-xs text-foreground">
                                {r.base_quantity.toLocaleString("pt-PT")} {r.unit || ""}
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">
                                a definir
                              </Badge>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-60 hover:opacity-100"
                              onClick={() => startEdit(r)}
                              title="Editar quantidade e unidade"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-60 hover:opacity-100"
                                  onClick={() => startEditFull(r)}
                                  title="Editar todos os campos (nome, subcategoria, cultura, quantidade, unidade)"
                                >
                                  <Package className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-60 hover:opacity-100 hover:text-destructive"
                                  onClick={() => setDeleteTarget(r)}
                                  title="Remover item do pacote"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </>
    );
  };

  const hasAny = items.length > 0;
  const computedDefaultTab = byCategory.agricultura.length || addingCategory === "agricultura" ? "agricultura" : "pecuaria";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Composição — {patec?.code}{(patec?.cultures || patec?.name) ? ` — ${patec?.cultures || patec?.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              {items.length} item(s) — quantidades por hectare / efectivo recomendado.
              {isAdmin ? " Pode adicionar, editar e remover itens." : " Apenas administradores podem editar."}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !hasAny && !isAdmin ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Sem composição registada para este pacote.
            </div>
          ) : (
            <Tabs defaultValue={activeTab} className="w-full">
              <TabsList>
                <TabsTrigger value="agricultura">
                  Agricultura ({byCategory.agricultura.length})
                </TabsTrigger>
                <TabsTrigger value="pecuaria">
                  Pecuária ({byCategory.pecuaria.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="agricultura" className="space-y-5 mt-4">
                {byCategory.agricultura.length === 0 && !isAdmin ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Sem itens de agricultura.</div>
                ) : (
                  renderGroup(byCategory.agricultura, "agricultura")
                )}
              </TabsContent>
              <TabsContent value="pecuaria" className="space-y-5 mt-4">
                {byCategory.pecuaria.length === 0 && !isAdmin ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Sem itens de pecuária.</div>
                ) : (
                  renderGroup(byCategory.pecuaria, "pecuaria")
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item da composição?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> será removido permanentemente do pacote{" "}
              <strong>{patec?.code}{(patec?.cultures || patec?.name) ? ` — ${patec?.cultures || patec?.name}` : ""}</strong>. Esta acção afecta todos os agricultores com este PATEC nas próximas vendas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
