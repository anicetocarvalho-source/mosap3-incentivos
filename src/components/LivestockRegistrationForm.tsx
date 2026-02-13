import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Beef, HeartPulse, Milk, Loader2 } from "lucide-react";

const animalSchema = z.object({
  species: z.string().min(1, "Seleccione a espécie"),
  breed: z.string().max(100).optional(),
  quantity: z.coerce.number().min(1, "Quantidade mínima: 1").max(99999),
  male_count: z.coerce.number().min(0).max(99999),
  female_count: z.coerce.number().min(0).max(99999),
  young_count: z.coerce.number().min(0).max(99999),
  pasture_area: z.string().max(50).optional(),
  infrastructure_notes: z.string().max(500).optional(),
});

const healthSchema = z.object({
  livestock_id: z.string().min(1, "Seleccione o animal"),
  record_type: z.string().min(1, "Seleccione o tipo"),
  description: z.string().min(1, "Descrição obrigatória").max(500),
  date: z.string().min(1, "Data obrigatória"),
  quantity_affected: z.coerce.number().min(1).max(99999),
  veterinarian: z.string().max(200).optional(),
  cost: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

const productionSchema = z.object({
  livestock_id: z.string().min(1, "Seleccione o animal"),
  product_type: z.string().min(1, "Tipo de produto obrigatório").max(100),
  quantity: z.coerce.number().min(0.01, "Quantidade obrigatória"),
  unit: z.string().min(1, "Unidade obrigatória").max(50),
  period_start: z.string().min(1, "Data início obrigatória"),
  period_end: z.string().min(1, "Data fim obrigatória"),
  revenue: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

type AnimalForm = z.infer<typeof animalSchema>;
type HealthForm = z.infer<typeof healthSchema>;
type ProductionForm = z.infer<typeof productionSchema>;

interface LivestockRecord {
  id: string;
  species: string;
  breed: string | null;
  quantity: number;
}

interface Props {
  farmerId: string;
  schoolId?: string;
  existingLivestock: LivestockRecord[];
  onSuccess: () => void;
}

const SPECIES_OPTIONS = ["Bovinos", "Caprinos", "Suínos", "Aves", "Ovinos", "Equinos", "Coelhos"];
const HEALTH_TYPES = ["Vacinação", "Desparasitação", "Tratamento", "Consulta", "Mortalidade"];
const PRODUCT_TYPES = ["Leite", "Ovos", "Mel", "Carne", "Lã", "Estrume"];
const UNITS = ["litros", "unidades", "kg", "toneladas"];

export default function LivestockRegistrationForm({ farmerId, schoolId, existingLivestock, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState("animal");
  const [submitting, setSubmitting] = useState(false);

  const animalForm = useForm<AnimalForm>({
    resolver: zodResolver(animalSchema),
    defaultValues: { quantity: 1, male_count: 0, female_count: 0, young_count: 0 },
  });

  const healthForm = useForm<HealthForm>({
    resolver: zodResolver(healthSchema),
    defaultValues: { quantity_affected: 1, date: new Date().toISOString().split("T")[0] },
  });

  const productionForm = useForm<ProductionForm>({
    resolver: zodResolver(productionSchema),
    defaultValues: {},
  });

  const onSubmitAnimal = async (data: AnimalForm) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("livestock").insert({
        farmer_id: farmerId,
        school_id: schoolId || null,
        species: data.species,
        breed: data.breed || null,
        quantity: data.quantity,
        male_count: data.male_count,
        female_count: data.female_count,
        young_count: data.young_count,
        pasture_area: data.pasture_area || null,
        infrastructure_notes: data.infrastructure_notes || null,
      });
      if (error) throw error;
      toast.success("Animal registado com sucesso!");
      animalForm.reset();
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registar animal: " + (err.message || "Erro desconhecido"));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitHealth = async (data: HealthForm) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("livestock_health").insert({
        livestock_id: data.livestock_id,
        record_type: data.record_type,
        description: data.description,
        date: data.date,
        quantity_affected: data.quantity_affected,
        veterinarian: data.veterinarian || null,
        cost: data.cost || null,
        notes: data.notes || null,
      });
      if (error) throw error;
      toast.success("Registo de saúde adicionado!");
      healthForm.reset();
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registar saúde: " + (err.message || "Erro desconhecido"));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitProduction = async (data: ProductionForm) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("livestock_production").insert({
        livestock_id: data.livestock_id,
        product_type: data.product_type,
        quantity: data.quantity,
        unit: data.unit,
        period_start: data.period_start,
        period_end: data.period_end,
        revenue: data.revenue || null,
        notes: data.notes || null,
      });
      if (error) throw error;
      toast.success("Produção registada com sucesso!");
      productionForm.reset();
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registar produção: " + (err.message || "Erro desconhecido"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="animal" className="flex items-center gap-1.5 text-xs sm:text-sm">
          <Beef className="h-4 w-4" /> Animal
        </TabsTrigger>
        <TabsTrigger value="health" className="flex items-center gap-1.5 text-xs sm:text-sm">
          <HeartPulse className="h-4 w-4" /> Saúde
        </TabsTrigger>
        <TabsTrigger value="production" className="flex items-center gap-1.5 text-xs sm:text-sm">
          <Milk className="h-4 w-4" /> Produção
        </TabsTrigger>
      </TabsList>

      {/* Animal Registration */}
      <TabsContent value="animal">
        <form onSubmit={animalForm.handleSubmit(onSubmitAnimal)} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Espécie *</Label>
              <Select onValueChange={(v) => animalForm.setValue("species", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar espécie" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIES_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {animalForm.formState.errors.species && (
                <p className="text-xs text-destructive">{animalForm.formState.errors.species.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Raça</Label>
              <Input placeholder="Ex: Nelore, Boer..." {...animalForm.register("breed")} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input type="number" min={1} {...animalForm.register("quantity")} />
              {animalForm.formState.errors.quantity && (
                <p className="text-xs text-destructive">{animalForm.formState.errors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Machos</Label>
              <Input type="number" min={0} {...animalForm.register("male_count")} />
            </div>
            <div className="space-y-2">
              <Label>Fêmeas</Label>
              <Input type="number" min={0} {...animalForm.register("female_count")} />
            </div>
            <div className="space-y-2">
              <Label>Crias</Label>
              <Input type="number" min={0} {...animalForm.register("young_count")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Área de Pastagem</Label>
              <Input placeholder="Ex: 5.0 ha" {...animalForm.register("pasture_area")} />
            </div>
            <div className="space-y-2">
              <Label>Infraestrutura</Label>
              <Input placeholder="Ex: Curral cercado, bebedouro" {...animalForm.register("infrastructure_notes")} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registar Animal
          </Button>
        </form>
      </TabsContent>

      {/* Health Registration */}
      <TabsContent value="health">
        <form onSubmit={healthForm.handleSubmit(onSubmitHealth)} className="space-y-4 pt-4">
          {existingLivestock.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground text-sm">Registe primeiro um animal na aba "Animal" antes de adicionar registos de saúde.</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Animal *</Label>
                  <Select onValueChange={(v) => healthForm.setValue("livestock_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar animal" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLivestock.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.species} {l.breed ? `(${l.breed})` : ""} — {l.quantity} cab.
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {healthForm.formState.errors.livestock_id && (
                    <p className="text-xs text-destructive">{healthForm.formState.errors.livestock_id.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select onValueChange={(v) => healthForm.setValue("record_type", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {HEALTH_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {healthForm.formState.errors.record_type && (
                    <p className="text-xs text-destructive">{healthForm.formState.errors.record_type.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Input placeholder="Ex: Febre aftosa, Ivermectina..." {...healthForm.register("description")} />
                {healthForm.formState.errors.description && (
                  <p className="text-xs text-destructive">{healthForm.formState.errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" {...healthForm.register("date")} />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Afectada</Label>
                  <Input type="number" min={1} {...healthForm.register("quantity_affected")} />
                </div>
                <div className="space-y-2">
                  <Label>Veterinário</Label>
                  <Input placeholder="Nome" {...healthForm.register("veterinarian")} />
                </div>
                <div className="space-y-2">
                  <Label>Custo (Kz)</Label>
                  <Input type="number" min={0} {...healthForm.register("cost")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea placeholder="Observações adicionais..." {...healthForm.register("notes")} />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Registar Saúde
              </Button>
            </>
          )}
        </form>
      </TabsContent>

      {/* Production Registration */}
      <TabsContent value="production">
        <form onSubmit={productionForm.handleSubmit(onSubmitProduction)} className="space-y-4 pt-4">
          {existingLivestock.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground text-sm">Registe primeiro um animal na aba "Animal" antes de adicionar produção.</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Animal *</Label>
                  <Select onValueChange={(v) => productionForm.setValue("livestock_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar animal" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLivestock.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.species} {l.breed ? `(${l.breed})` : ""} — {l.quantity} cab.
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {productionForm.formState.errors.livestock_id && (
                    <p className="text-xs text-destructive">{productionForm.formState.errors.livestock_id.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Produto *</Label>
                  <Select onValueChange={(v) => productionForm.setValue("product_type", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {productionForm.formState.errors.product_type && (
                    <p className="text-xs text-destructive">{productionForm.formState.errors.product_type.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input type="number" step="0.01" min={0} {...productionForm.register("quantity")} />
                  {productionForm.formState.errors.quantity && (
                    <p className="text-xs text-destructive">{productionForm.formState.errors.quantity.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Unidade *</Label>
                  <Select onValueChange={(v) => productionForm.setValue("unit", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {productionForm.formState.errors.unit && (
                    <p className="text-xs text-destructive">{productionForm.formState.errors.unit.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Início *</Label>
                  <Input type="date" {...productionForm.register("period_start")} />
                </div>
                <div className="space-y-2">
                  <Label>Fim *</Label>
                  <Input type="date" {...productionForm.register("period_end")} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Receita (Kz)</Label>
                  <Input type="number" min={0} {...productionForm.register("revenue")} />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input placeholder="Observações..." {...productionForm.register("notes")} />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Registar Produção
              </Button>
            </>
          )}
        </form>
      </TabsContent>
    </Tabs>
  );
}
