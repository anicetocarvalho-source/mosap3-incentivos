import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Anomaly } from "@/hooks/useAnomalies";
import { ANOMALY_LABELS } from "@/hooks/useAnomalies";

interface Props {
  anomaly: Anomaly | null;
  onClose: () => void;
  onResolved: () => void;
}

export function MarkFalsePositiveDialog({ anomaly, onClose, onResolved }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!anomaly || !notes.trim()) {
      toast.error("Por favor, escreva uma nota a justificar.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("anomaly_resolutions").upsert(
        {
          anomaly_type: anomaly.anomaly_type,
          anomaly_key: anomaly.anomaly_key,
          resolved_as: "falso_positivo",
          notes: notes.trim(),
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        },
        { onConflict: "anomaly_type,anomaly_key" }
      );
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        action: "anomalia_marcada_falso_positivo",
        entity_type: "anomalia",
        entity_id: anomaly.anomaly_key,
        details: { anomaly_type: anomaly.anomaly_type, farmer_code: anomaly.farmer_code, notes: notes.trim() },
      });

      toast.success("Anomalia marcada como falso positivo.");
      setNotes("");
      onResolved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao marcar anomalia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!anomaly} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como falso positivo</DialogTitle>
          <DialogDescription>
            {anomaly && (
              <>
                {ANOMALY_LABELS[anomaly.anomaly_type]} — {anomaly.farmer_name} ({anomaly.farmer_code})
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="notes">Justificação *</Label>
          <Textarea
            id="notes"
            placeholder="Ex: confirmado por telefone que se trata da mesma pessoa registada em duas escolas distintas."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !notes.trim()}>
            {saving ? "A guardar..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
