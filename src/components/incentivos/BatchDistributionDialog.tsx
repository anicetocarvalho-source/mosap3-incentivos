import { useState, useMemo } from "react";
import { Users, Layers, MapPin, Building2, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProvincesData } from "@/hooks/useProvincesData";
import { useProvinceMunicipalities } from "@/hooks/useProvinceMunicipalities";

type Scope = "eca" | "provincia" | "municipio";

const SCOPE_OPTIONS: { value: Scope; label: string; icon: typeof TreePine }[] = [
  { value: "eca", label: "Escola de Campo (ECA)", icon: TreePine },
  { value: "provincia", label: "Província", icon: MapPin },
  { value: "municipio", label: "Município", icon: Building2 },
];

const BatchDistributionDialog = () => {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope | "">("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [selectedEca, setSelectedEca] = useState("");
  const [formType, setFormType] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState("Unitel Money");
  const [submitting, setSubmitting] = useState(false);
  const [excludedFarmers, setExcludedFarmers] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { provinces } = useProvincesData();
  const { municipalities } = useProvinceMunicipalities(selectedProvince);

  // Get all farmers for filtering
  const { data: allFarmers = [] } = useQuery({
    queryKey: ["farmers_batch_distribution"],
    queryFn: async () => {
      const { data } = await supabase
        .from("farmers")
        .select("code, full_name, province, municipality, school, status")
        .eq("status", "Aprovado")
        .order("full_name");
      return data || [];
    },
    enabled: open,
  });

  // Unique ECAs from farmers
  const ecaList = useMemo(() => {
    const set = new Set<string>();
    allFarmers.forEach((f) => { if (f.school) set.add(f.school); });
    return Array.from(set).sort();
  }, [allFarmers]);

  // Unique provinces from provinces table
  const provinceList = useMemo(() =>
    provinces.map((p: any) => p.name).sort(),
  [provinces]);

  // Filter farmers based on scope selection
  const matchingFarmers = useMemo(() => {
    if (!scope) return [];
    return allFarmers.filter((f) => {
      if (scope === "eca") return f.school === selectedEca;
      if (scope === "provincia") return f.province === selectedProvince;
      if (scope === "municipio") return f.province === selectedProvince && f.municipality === selectedMunicipality;
      return false;
    });
  }, [scope, selectedEca, selectedProvince, selectedMunicipality, allFarmers]);

  const selectedFarmers = matchingFarmers.filter((f) => !excludedFarmers.has(f.code));

  const scopeLabel = scope === "eca" ? selectedEca :
    scope === "provincia" ? selectedProvince :
    scope === "municipio" ? `${selectedMunicipality}, ${selectedProvince}` : "";

  const canSubmit = selectedFarmers.length > 0 && formType && formAmount && scopeLabel;

  const resetForm = () => {
    setScope("");
    setSelectedProvince("");
    setSelectedMunicipality("");
    setSelectedEca("");
    setFormType("");
    setFormAmount("");
    setExcludedFarmers(new Set());
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const now = new Date().toLocaleDateString("pt-AO");
      const rows = selectedFarmers.map((f) => ({
        incentive_code: `INC-${Date.now().toString(36).toUpperCase()}-${f.code}`,
        farmer_code: f.code,
        type: formType,
        amount: formAmount,
        method: formMethod,
        incentive_date: now,
      }));

      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("farmer_incentives").insert(batch);
        if (error) throw error;
      }

      toast({
        title: "Distribuição em lote concluída",
        description: `${selectedFarmers.length} incentivos registados para ${scopeLabel}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["farmer_incentives"] });
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro na distribuição", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFarmer = (code: string) => {
    setExcludedFarmers((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Layers className="h-4 w-4" />Distribuir em Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Distribuição em Lote
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 flex-1 overflow-y-auto">
          {/* Scope selection */}
          <div className="space-y-2">
            <Label>Âmbito da distribuição</Label>
            <Select value={scope} onValueChange={(v: Scope) => {
              setScope(v);
              setSelectedProvince("");
              setSelectedMunicipality("");
              setSelectedEca("");
              setExcludedFarmers(new Set());
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar âmbito..." /></SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <s.icon className="h-4 w-4" />{s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scope-specific selectors */}
          {scope === "eca" && (
            <div className="space-y-2">
              <Label>Escola de Campo</Label>
              <Select value={selectedEca} onValueChange={(v) => { setSelectedEca(v); setExcludedFarmers(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar ECA..." /></SelectTrigger>
                <SelectContent>
                  {ecaList.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(scope === "provincia" || scope === "municipio") && (
            <div className="space-y-2">
              <Label>Província</Label>
              <Select value={selectedProvince} onValueChange={(v) => {
                setSelectedProvince(v);
                setSelectedMunicipality("");
                setExcludedFarmers(new Set());
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar província..." /></SelectTrigger>
                <SelectContent>
                  {provinceList.map((p: string) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "municipio" && selectedProvince && (
            <div className="space-y-2">
              <Label>Município</Label>
              <Select value={selectedMunicipality} onValueChange={(v) => { setSelectedMunicipality(v); setExcludedFarmers(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar município..." /></SelectTrigger>
                <SelectContent>
                  {municipalities.map((m: any) => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Incentive details */}
          {matchingFarmers.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Incentivo</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Insumos Agrícolas">Insumos Agrícolas</SelectItem>
                      <SelectItem value="Sementes">Sementes</SelectItem>
                      <SelectItem value="Fertilizantes">Fertilizantes</SelectItem>
                      <SelectItem value="Mecanização">Mecanização</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor por agricultor (Kz)</Label>
                  <Input placeholder="0.00" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
                </div>
              </div>

              {/* Farmers preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Agricultores ({selectedFarmers.length} de {matchingFarmers.length})</Label>
                  {excludedFarmers.size > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setExcludedFarmers(new Set())}>
                      Selecionar todos
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-40 rounded-md border border-border">
                  <div className="p-2 space-y-1">
                    {matchingFarmers.map((f) => (
                      <label key={f.code} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                        <Checkbox
                          checked={!excludedFarmers.has(f.code)}
                          onCheckedChange={() => toggleFarmer(f.code)}
                        />
                        <span className="font-medium truncate">{f.full_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{f.code}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Summary */}
              {formAmount && selectedFarmers.length > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium">Resumo da distribuição</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {selectedFarmers.length} agricultores × {formAmount} Kz
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-base px-3">
                    {(selectedFarmers.length * (parseFloat(formAmount.replace(/\./g, "").replace(",", ".")) || 0)).toLocaleString("pt-AO")} Kz
                  </Badge>
                </div>
              )}
            </>
          )}

          {scope && matchingFarmers.length === 0 && scopeLabel && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhum agricultor aprovado encontrado para esta seleção.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "A distribuir..." : `Distribuir para ${selectedFarmers.length} agricultores`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BatchDistributionDialog;
