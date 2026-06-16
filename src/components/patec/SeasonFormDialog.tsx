import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Season } from "@/hooks/useSeasons";
import type { Patec } from "@/hooks/usePatecs";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  season: Season | null;
  patecs: Patec[];
  initialPatecIds: string[];
  onSaved: () => void;
}

export default function SeasonFormDialog({ open, onOpenChange, season, patecs, initialPatecIds, onSaved }: Props) {
  const isEdit = !!season;
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [patecIds, setPatecIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(season?.name ?? "");
      setStartDate(season?.start_date ?? "");
      setEndDate(season?.end_date ?? "");
      setIsActive(season?.is_active ?? true);
      setNotes(season?.notes ?? "");
      setPatecIds(initialPatecIds);
    }
  }, [open, season, initialPatecIds]);

  const togglePatec = (id: string) =>
    setPatecIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error("Nome e datas são obrigatórios");
      return;
    }
    if (endDate <= startDate) {
      toast.error("A data de fim deve ser posterior à data de início");
      return;
    }
    setSaving(true);
    try {
      let seasonId = season?.id;
      const payload = {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
        notes: notes.trim() || null,
      };
      if (isEdit && seasonId) {
        const { error } = await supabase.from("agricultural_seasons" as any).update(payload).eq("id", seasonId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("agricultural_seasons" as any).insert(payload).select("id").single();
        if (error) throw error;
        seasonId = (data as any).id;
      }

      if (seasonId) {
        await supabase.from("patec_seasons" as any).delete().eq("season_id", seasonId);
        if (patecIds.length > 0) {
          await supabase.from("patec_seasons" as any).insert(
            patecIds.map((pid) => ({ patec_id: pid, season_id: seasonId }))
          );
        }
      }

      toast.success(isEdit ? "Período actualizado" : "Período criado");
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Período Agrícola" : "Novo Período Agrícola"}</DialogTitle>
          <DialogDescription>Defina o intervalo de datas e quais pacotes ficam disponíveis.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Período 2025/2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de início *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Data de fim *</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Época activa</Label>
              <p className="text-[11px] text-muted-foreground">Inactiva ou fora do período bloqueia vendas POS</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div>
            <Label>Pacotes disponíveis nesta época</Label>
            <div className="rounded-lg border p-3 space-y-2 mt-1 max-h-48 overflow-y-auto">
              {patecs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sem pacotes criados.</p>
              ) : patecs.map((p) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={patecIds.includes(p.id)} onCheckedChange={() => togglePatec(p.id)} />
                  <span className="font-mono text-xs">{p.code}</span>
                  <span className="text-muted-foreground">— {p.name}</span>
                  {!p.is_active && <span className="text-[10px] text-warning">inactivo</span>}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Guardar" : "Criar Época"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
