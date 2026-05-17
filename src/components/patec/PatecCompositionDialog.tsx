import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Package, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Patec } from "@/hooks/usePatecs";

interface PatecItem {
  id: string;
  patec_code: string | null;
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
  inseticida: "Inseticidas",
  fungicida: "Fungicidas",
  planta_melhoradora: "Plantas Melhoradoras",
  muda_fruteira_florestal: "Mudas Frutícolas e Florestais",
  animal: "Efectivo Animal",
  racao: "Ração",
  antibiotico: "Antibióticos",
  desparasitante_interno: "Desparasitantes Internos",
  desparasitante_externo: "Desparasitante Externo",
  vitamina: "Vitaminas",
  vacina: "Vacinas",
  anti_inflamatorio: "Anti-inflamatórios",
  irrigacao: "Irrigação",
  equipamento: "Equipamentos",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patec: Patec | null;
}

export default function PatecCompositionDialog({ open, onOpenChange, patec }: Props) {
  const [items, setItems] = useState<PatecItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [saving, setSaving] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patec]);

  const byCategory = useMemo(() => {
    const m: Record<string, PatecItem[]> = { agricultura: [], pecuaria: [] };
    for (const it of items) (m[it.category] ||= []).push(it);
    return m;
  }, [items]);

  const startEdit = (it: PatecItem) => {
    setEditingId(it.id);
    setEditQty(it.base_quantity != null ? String(it.base_quantity).replace(".", ",") : "");
    setEditUnit(it.unit || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQty("");
    setEditUnit("");
  };

  const saveEdit = async (it: PatecItem) => {
    const normalized = editQty.trim().replace(",", ".");
    const qty = normalized === "" ? null : Number(normalized);
    if (qty != null && (!isFinite(qty) || qty < 0)) {
      toast.error("Quantidade inválida");
      return;
    }
    const unit = editUnit.trim() || null;
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
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, base_quantity: qty, unit } : p)));
    cancelEdit();
  };

  const renderGroup = (list: PatecItem[]) => {
    const byCulture: Record<string, Record<string, PatecItem[]>> = {};
    for (const it of list) {
      const c = it.culture || "—";
      const s = it.subcategory || "outros";
      byCulture[c] ||= {};
      (byCulture[c][s] ||= []).push(it);
    }
    return Object.entries(byCulture).map(([culture, subs]) => (
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
                        <Input
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          placeholder="Unid."
                          className="h-7 w-20 text-xs"
                        />
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
                          title="Editar quantidade"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Composição — {patec?.name}
          </DialogTitle>
          <DialogDescription>
            {items.length} item(s) — quantidades por hectare / efectivo recomendado. Clique no lápis para editar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Sem composição registada para este pacote.
          </div>
        ) : (
          <Tabs defaultValue={byCategory.agricultura.length ? "agricultura" : "pecuaria"} className="w-full">
            <TabsList>
              {byCategory.agricultura.length > 0 && (
                <TabsTrigger value="agricultura">
                  Agricultura ({byCategory.agricultura.length})
                </TabsTrigger>
              )}
              {byCategory.pecuaria.length > 0 && (
                <TabsTrigger value="pecuaria">
                  Pecuária ({byCategory.pecuaria.length})
                </TabsTrigger>
              )}
            </TabsList>
            {byCategory.agricultura.length > 0 && (
              <TabsContent value="agricultura" className="space-y-5 mt-4">
                {renderGroup(byCategory.agricultura)}
              </TabsContent>
            )}
            {byCategory.pecuaria.length > 0 && (
              <TabsContent value="pecuaria" className="space-y-5 mt-4">
                {renderGroup(byCategory.pecuaria)}
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
