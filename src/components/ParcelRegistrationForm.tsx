import { useState } from "react";
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

interface ParcelRegistrationFormProps {
  farmerCode: string;
  onSuccess: () => void;
}

const cultures = ["Milho", "Feijão", "Mandioca", "Soja", "Amendoim", "Batata Doce", "Massango", "Arroz", "Sorgo", "Gergelim"];

const ParcelRegistrationForm = ({ farmerCode, onSuccess }: ParcelRegistrationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    culture: "",
    area: "",
    lat: "",
    lon: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.culture || !form.area) {
      toast.error("Cultura e área são obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      // Generate parcel code
      const { count } = await supabase
        .from("farmer_parcels")
        .select("*", { count: "exact", head: true })
        .eq("farmer_code", farmerCode);

      const parcelCode = `${farmerCode}-P${(count || 0) + 1}`;

      const { error } = await supabase.from("farmer_parcels").insert({
        farmer_code: farmerCode,
        parcel_code: parcelCode,
        culture: form.culture,
        area: form.area,
        lat: form.lat || null,
        lon: form.lon || null,
        status: "Pendente",
      });

      if (error) throw error;

      toast.success("Parcela registada com sucesso!");
      setForm({ culture: "", area: "", lat: "", lon: "", notes: "" });
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registar parcela: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cultura *</Label>
          <Select value={form.culture} onValueChange={(v) => setForm({ ...form, culture: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar cultura" /></SelectTrigger>
            <SelectContent>
              {cultures.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Área (ha) *</Label>
          <Input
            type="number"
            step="0.1"
            min="0.1"
            placeholder="Ex: 2.5"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input
            placeholder="-12.0000"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input
            placeholder="14.0000"
            value={form.lon}
            onChange={(e) => setForm({ ...form, lon: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          placeholder="Informações adicionais..."
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Registar Parcela
      </Button>
    </form>
  );
};

export default ParcelRegistrationForm;
