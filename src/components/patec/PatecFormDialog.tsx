import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Patec } from "@/hooks/usePatecs";
import type { Season } from "@/hooks/useSeasons";

const ICON_OPTIONS = [
  { value: "wheat", label: "🌾 Wheat" },
  { value: "sprout", label: "🌱 Sprout" },
  { value: "leaf", label: "🍃 Leaf" },
  { value: "tree-deciduous", label: "🌳 Árvore" },
  { value: "carrot", label: "🥕 Carrot" },
  { value: "apple", label: "🍎 Apple" },
  { value: "package", label: "📦 Package" },
];

const COLOR_OPTIONS = [
  { value: "amber", label: "Âmbar" },
  { value: "emerald", label: "Verde" },
  { value: "violet", label: "Violeta" },
  { value: "sky", label: "Azul" },
  { value: "rose", label: "Rosa" },
  { value: "slate", label: "Cinza" },
  { value: "orange", label: "Laranja" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patec: Patec | null;
  seasons: Season[];
  initialSeasonIds: string[];
  onSaved: () => void;
}

export default function PatecFormDialog({ open, onOpenChange, patec, seasons, initialSeasonIds, onSaved }: Props) {
  const isEdit = !!patec;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cultures, setCultures] = useState("");
  const [icon, setIcon] = useState("wheat");
  const [colorToken, setColorToken] = useState("amber");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [seasonIds, setSeasonIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(patec?.code ?? "");
      setName(patec?.name ?? "");
      setDescription(patec?.description ?? "");
      setCultures(patec?.cultures ?? "");
      setIcon(patec?.icon ?? "wheat");
      setColorToken(patec?.color_token ?? "amber");
      setIsActive(patec?.is_active ?? true);
      setSortOrder(patec?.sort_order ?? 0);
      setSeasonIds(initialSeasonIds);
    }
  }, [open, patec, initialSeasonIds]);

  const toggleSeason = (id: string) => {
    setSeasonIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, "-");
    if (!cleanCode || !name.trim()) {
      toast.error("Código e nome são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      let patecId = patec?.id;
      if (isEdit && patecId) {
        const { error } = await supabase.from("patecs" as any).update({
          code: cleanCode,
          name: name.trim(),
          description: description.trim() || null,
          cultures: cultures.trim() || null,
          icon, color_token: colorToken,
          is_active: isActive,
          sort_order: sortOrder,
        }).eq("id", patecId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("patecs" as any).insert({
          code: cleanCode,
          name: name.trim(),
          description: description.trim() || null,
          cultures: cultures.trim() || null,
          icon, color_token: colorToken,
          is_active: isActive,
          sort_order: sortOrder,
        }).select("id").single();
        if (error) throw error;
        patecId = (data as any).id;
      }

      // Sync season links
      if (patecId) {
        await supabase.from("patec_seasons" as any).delete().eq("patec_id", patecId);
        if (seasonIds.length > 0) {
          await supabase.from("patec_seasons" as any).insert(
            seasonIds.map((sid) => ({ patec_id: patecId, season_id: sid }))
          );
        }
      }

      toast.success(isEdit ? "Pacote actualizado" : "Pacote criado");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Pacote" : "Novo Pacote Tecnológico"}</DialogTitle>
          <DialogDescription>Configure o pacote, escolha ícone, cor e épocas em que estará disponível.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Código *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PATEC-MILHO" />
              <p className="text-[10px] text-muted-foreground mt-1">Identificador único (maiúsculas, sem espaços)</p>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Milho + Feijão + Gado" />
            </div>
          </div>
          <div>
            <Label>Culturas</Label>
            <Input value={cultures} onChange={(e) => setCultures(e.target.value)} placeholder="Milho + Feijão" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Ícone</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ICON_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Select value={colorToken} onValueChange={setColorToken}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COLOR_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Pacote activo</Label>
              <p className="text-[11px] text-muted-foreground">Inactivo bloqueia atribuições e vendas POS</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div>
            <Label>Épocas Agrícolas em que está disponível</Label>
            <div className="rounded-lg border p-3 space-y-2 mt-1 max-h-48 overflow-y-auto">
              {seasons.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sem épocas criadas — usa o separador "Épocas" para criar.</p>
              ) : seasons.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={seasonIds.includes(s.id)} onCheckedChange={() => toggleSeason(s.id)} />
                  <span>{s.name}</span>
                  <span className="text-xs text-muted-foreground">({s.start_date} → {s.end_date})</span>
                  {!s.is_active && <span className="text-[10px] text-warning">inactiva</span>}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Sem épocas associadas, o POS bloqueará vendas com este pacote.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Guardar" : "Criar Pacote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
