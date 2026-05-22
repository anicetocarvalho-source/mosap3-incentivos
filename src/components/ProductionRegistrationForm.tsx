import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ProductionRegistrationFormProps {
  farmerCode: string;
  onSuccess: () => void;
}

const PHASES = ["Preparação", "Sementeira", "Crescimento", "Floração", "Colheita", "Pós-Colheita"];
const STATUSES = ["Semeada", "Em Crescimento", "Em Floração", "Colhida"];
const DEFAULT_CULTURES = ["Milho", "Feijão", "Mandioca", "Soja", "Amendoim", "Batata Doce", "Massango", "Massambala", "Arroz", "Sorgo", "Gergelim"];

const ProductionRegistrationForm = ({ farmerCode, onSuccess }: ProductionRegistrationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [parcels, setParcels] = useState<Array<{ id: string; parcel_code: string; culture: string; cultures: string[] | null; area: string }>>([]);
  const [form, setForm] = useState({
    parcelId: "",
    culture: "",
    area: "",
    plantedDate: "",
    expectedHarvest: "",
    estimatedYield: "",
    currentPhase: "Sementeira",
    status: "Semeada",
    technician: "",
    notes: "",
  });

  useEffect(() => {
    supabase
      .from("farmer_parcels")
      .select("id, parcel_code, culture, cultures, area")
      .eq("farmer_code", farmerCode)
      .then(({ data }) => setParcels((data as any) || []));
  }, [farmerCode]);

  const selectedParcel = parcels.find((p) => p.id === form.parcelId);
  const cultureOptions = selectedParcel
    ? (selectedParcel.cultures && selectedParcel.cultures.length > 0
        ? selectedParcel.cultures
        : selectedParcel.culture ? [selectedParcel.culture] : DEFAULT_CULTURES)
    : DEFAULT_CULTURES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.culture) { toast.error("Selecione a cultura"); return; }

    setLoading(true);
    try {
      const { count } = await supabase
        .from("farmer_production")
        .select("*", { count: "exact", head: true })
        .eq("farmer_code", farmerCode);

      const productionCode = `${farmerCode}-PR${(count || 0) + 1}`;

      const { data: prod, error } = await supabase
        .from("farmer_production")
        .insert({
          farmer_code: farmerCode,
          production_code: productionCode,
          culture: form.culture,
          area: form.area || selectedParcel?.area || null,
          planted_date: form.plantedDate || null,
          expected_harvest: form.expectedHarvest || null,
          estimated_yield: form.estimatedYield || null,
          status: form.status,
          current_phase: form.currentPhase,
          technician: form.technician || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Cria a fase actual com nota inicial, se aplicável
      if (prod && form.currentPhase) {
        await supabase.from("farmer_production_phases").insert({
          production_id: prod.id,
          phase: form.currentPhase,
          phase_date: form.plantedDate || new Date().toISOString().slice(0, 10),
          notes: form.notes || null,
        });
      }

      toast.success("Produção registada com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registar produção: " + (err.message || "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-2">
      {parcels.length > 0 && (
        <div className="space-y-2">
          <Label>Parcela (opcional)</Label>
          <Select value={form.parcelId} onValueChange={(v) => setForm({ ...form, parcelId: v, culture: "", area: "" })}>
            <SelectTrigger><SelectValue placeholder="Associar a uma parcela" /></SelectTrigger>
            <SelectContent>
              {parcels.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.parcel_code} — {p.area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cultura *</Label>
          <Select value={form.culture} onValueChange={(v) => setForm({ ...form, culture: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar cultura" /></SelectTrigger>
            <SelectContent>
              {cultureOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Área</Label>
          <Input
            placeholder={selectedParcel?.area || "Ex: 1 ha"}
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data de Sementeira</Label>
          <Input type="date" value={form.plantedDate} onChange={(e) => setForm({ ...form, plantedDate: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Colheita Prevista</Label>
          <Input type="date" value={form.expectedHarvest} onChange={(e) => setForm({ ...form, expectedHarvest: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fase Actual</Label>
          <Select value={form.currentPhase} onValueChange={(v) => setForm({ ...form, currentPhase: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PHASES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Produção Estimada</Label>
          <Input placeholder="Ex: 1.500 kg" value={form.estimatedYield} onChange={(e) => setForm({ ...form, estimatedYield: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Técnico Responsável</Label>
          <Input placeholder="Nome do extensionista" value={form.technician} onChange={(e) => setForm({ ...form, technician: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea rows={2} placeholder="Notas iniciais da produção…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Registar Produção
      </Button>
    </form>
  );
};

export default ProductionRegistrationForm;
