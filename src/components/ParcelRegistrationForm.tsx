import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin, X, Crosshair } from "lucide-react";

interface ParcelRegistrationFormProps {
  farmerCode: string;
  onSuccess: () => void;
}

const CULTURES = ["Milho", "Feijão", "Mandioca", "Soja", "Amendoim", "Batata Doce", "Massango", "Massambala", "Arroz", "Sorgo", "Gergelim"];

const ParcelRegistrationForm = ({ farmerCode, onSuccess }: ParcelRegistrationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    cultures: [] as string[],
    area: "",
    lat: "",
    lon: "",
    notes: "",
  });

  const toggleCulture = (c: string) => {
    setForm((f) => ({
      ...f,
      cultures: f.cultures.includes(c) ? f.cultures.filter((x) => x !== c) : [...f.cultures, c],
    }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste dispositivo");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lon: pos.coords.longitude.toFixed(6) }));
        toast.success("Localização obtida");
        setLocating(false);
      },
      (err) => {
        toast.error("Erro ao obter localização: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.cultures.length === 0) { toast.error("Selecione pelo menos uma cultura"); return; }
    if (!form.area || !/^[0-9]+(\.[0-9]+)?$/.test(form.area)) { toast.error("Área inválida"); return; }

    setLoading(true);
    try {
      const { count } = await supabase
        .from("farmer_parcels")
        .select("*", { count: "exact", head: true })
        .eq("farmer_code", farmerCode);

      const parcelCode = `${farmerCode}-P${(count || 0) + 1}`;

      const { error } = await supabase.from("farmer_parcels").insert({
        farmer_code: farmerCode,
        parcel_code: parcelCode,
        culture: form.cultures[0],
        cultures: form.cultures,
        area: form.area,
        lat: form.lat || null,
        lon: form.lon || null,
        status: "Pendente",
      } as any);

      if (error) throw error;

      toast.success("Parcela registada com sucesso!");
      setForm({ cultures: [], area: "", lat: "", lon: "", notes: "" });
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registar parcela: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-2">
      <div className="space-y-2">
        <Label>Culturas * <span className="text-xs text-muted-foreground font-normal">(seleccione uma ou mais)</span></Label>
        <div className="flex flex-wrap gap-1.5">
          {CULTURES.map((c) => {
            const active = form.cultures.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCulture(c)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                {active && <X className="inline h-3 w-3 mr-1" />}
                {c}
              </button>
            );
          })}
        </div>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Coordenadas GPS</Label>
          <Button type="button" size="sm" variant="outline" onClick={useMyLocation} disabled={locating} className="h-7 gap-1.5 text-xs">
            {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
            Usar minha localização
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Latitude (-12.0000)" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
          <Input placeholder="Longitude (14.0000)" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} />
        </div>
        {form.lat && form.lon && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Coordenadas registadas
          </p>
        )}
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
