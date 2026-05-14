import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SIM_STATUSES } from "@/lib/reconciliation";

type Farmer = {
  code: string;
  full_name: string;
  phone: string | null;
  sim_status: string | null;
};

export function EditarSimStatusDialog({
  farmer,
  open,
  onOpenChange,
  onSaved,
}: {
  farmer: Farmer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [status, setStatus] = useState<string>(farmer?.sim_status || "Desconhecido");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when farmer changes
  if (farmer && open && status !== farmer.sim_status && !saving && notes === "") {
    // Pre-fill on open
  }

  const handleSave = async () => {
    if (!farmer) return;
    if (status === farmer.sim_status) {
      toast.info("Estado igual ao actual — nada a alterar");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("farmers")
        .update({ sim_status: status, sim_status_source: "manual" })
        .eq("code", farmer.code);
      if (error) throw error;

      // Adicionar notas no histórico (a entrada é criada pelo trigger; actualizamos as notas)
      if (notes.trim()) {
        await supabase
          .from("sim_status_history")
          .update({ notes: notes.trim() })
          .eq("farmer_code", farmer.code)
          .order("created_at", { ascending: false })
          .limit(1);
      }

      const { data: u } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        action: "sim_status_manual_update",
        entity_type: "farmer",
        entity_id: farmer.code,
        user_id: u.user?.id || null,
        user_name: u.user?.email || null,
        details: { from: farmer.sim_status, to: status, notes: notes.trim() || null },
      });

      toast.success(`Estado SIM actualizado para ${status}`);
      onSaved?.();
      onOpenChange(false);
      setNotes("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao actualizar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Estado do SIM</DialogTitle>
          <DialogDescription>
            {farmer?.full_name} · {farmer?.phone || "sem telefone"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Novo estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo da alteração…"
              maxLength={500}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || status === farmer?.sim_status}>
            {saving ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
