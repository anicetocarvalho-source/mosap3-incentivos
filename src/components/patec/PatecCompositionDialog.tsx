import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package } from "lucide-react";
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

  useEffect(() => {
    if (!open || !patec) return;
    setLoading(true);
    supabase.from("patec_items" as any)
      .select("*")
      .eq("patec_code", patec.code)
      .order("sort_order")
      .then(({ data }) => {
        setItems((data as unknown as PatecItem[]) || []);
        setLoading(false);
      });
  }, [open, patec]);

  const byCategory = useMemo(() => {
    const m: Record<string, PatecItem[]> = { agricultura: [], pecuaria: [] };
    for (const it of items) (m[it.category] ||= []).push(it);
    return m;
  }, [items]);

  const renderGroup = (list: PatecItem[]) => {
    // Group by culture, then subcategory
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
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span>{r.name}</span>
                  {r.base_quantity != null ? (
                    <span className="font-mono text-xs text-foreground">
                      {r.base_quantity.toLocaleString("pt-PT")} {r.unit || ""}
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">
                      a definir
                    </Badge>
                  )}
                </div>
              ))}
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
            {items.length} item(s) — quantidades por hectare / efectivo recomendado
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
