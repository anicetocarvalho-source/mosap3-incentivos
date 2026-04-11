import { useState, useMemo, useRef } from "react";
import { Users, Layers, MapPin, Building2, TreePine, Upload, FileCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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
import { useProvinceMunicipalities } from "@/hooks/useProvinceMunicipalities";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Scope = "eca" | "provincia" | "municipio";
type InputMode = "manual" | "file";

interface CsvRow {
  phone: string;
  amount: string;
  comment: string;
  raw: string[];
}

interface ValidationResult {
  row: CsvRow;
  index: number;
  valid: boolean;
  farmerMatch?: { code: string; full_name: string };
  errors: string[];
}

const SCOPE_OPTIONS: { value: Scope; label: string; icon: typeof TreePine }[] = [
  { value: "eca", label: "Escola de Campo (ECA)", icon: TreePine },
  { value: "provincia", label: "Província", icon: MapPin },
  { value: "municipio", label: "Município", icon: Building2 },
];

function parseCsvContent(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Detect delimiter
  const delim = lines[0].includes(";") ? ";" : ",";

  return lines.slice(1).map((line) => {
    const cols = line.split(delim).map((c) => c.trim());
    return {
      phone: cols[1] || "",
      amount: cols[4] || "",
      comment: cols[5] || "",
      raw: cols,
    };
  });
}

const BatchDistributionDialog = () => {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope | "">("");
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedMunicipalityName, setSelectedMunicipalityName] = useState("");
  const [selectedEca, setSelectedEca] = useState("");
  const [formType, setFormType] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [excludedFarmers, setExcludedFarmers] = useState<Set<string>>(new Set());

  // File upload state
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { provinces, municipalities } = useProvinceMunicipalities(selectedProvinceId);

  const selectedProvinceName = useMemo(
    () => provinces.find((p) => p.id === selectedProvinceId)?.name || "",
    [provinces, selectedProvinceId]
  );

  const { data: allFarmers = [] } = useQuery({
    queryKey: ["farmers_batch_distribution"],
    queryFn: async () => {
      const { data } = await supabase
        .from("farmers")
        .select("code, full_name, province, municipality, school, phone, status")
        .in("status", ["Aprovado", "Ativo", "Validado"])
        .order("full_name");
      return data || [];
    },
    enabled: open,
  });

  const ecaList = useMemo(() => {
    const set = new Set<string>();
    allFarmers.forEach((f) => { if (f.school) set.add(f.school); });
    return Array.from(set).sort();
  }, [allFarmers]);

  const matchingFarmers = useMemo(() => {
    if (!scope) return [];
    return allFarmers.filter((f) => {
      if (scope === "eca") return f.school === selectedEca;
      if (scope === "provincia") return f.province === selectedProvinceName;
      if (scope === "municipio") return f.province === selectedProvinceName && f.municipality === selectedMunicipalityName;
      return false;
    });
  }, [scope, selectedEca, selectedProvinceName, selectedMunicipalityName, allFarmers]);

  const selectedFarmers = matchingFarmers.filter((f) => !excludedFarmers.has(f.code));

  const scopeReady =
    (scope === "eca" && selectedEca) ||
    (scope === "provincia" && selectedProvinceName) ||
    (scope === "municipio" && selectedProvinceName && selectedMunicipalityName);

  const scopeLabel = scope === "eca" ? selectedEca :
    scope === "provincia" ? selectedProvinceName :
    scope === "municipio" ? `${selectedMunicipalityName}, ${selectedProvinceName}` : "";

  const canSubmitManual = selectedFarmers.length > 0 && formType && formAmount && scopeReady;

  const resetForm = () => {
    setScope("");
    setSelectedProvinceId("");
    setSelectedMunicipalityName("");
    setSelectedEca("");
    setFormType("");
    setFormAmount("");
    setExcludedFarmers(new Set());
    setInputMode("manual");
    setCsvRows([]);
    setValidationResults(null);
    setFileName("");
  };

  // --- File handling ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidationResults(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsvContent(text);
      setCsvRows(rows);
    };
    reader.readAsText(file);
    // Reset file input so same file can be re-selected
    e.target.value = "";
  };

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 9) return digits;
    if (digits.startsWith("244") && digits.length === 12) return digits.slice(3);
    return digits;
  };

  const validateRows = () => {
    setValidating(true);
    const results: ValidationResult[] = csvRows.map((row, index) => {
      const errors: string[] = [];
      const phone = normalizePhone(row.phone);
      if (!phone || phone.length !== 9) errors.push("Telefone inválido");

      const amount = parseFloat(row.amount);
      if (!amount || amount <= 0) errors.push("Valor inválido");

      // Match farmer by phone within the scope
      const farmer = matchingFarmers.find((f) => {
        const fp = normalizePhone(f.phone || "");
        return fp === phone;
      });

      if (!farmer && errors.length === 0) errors.push("Agricultor não encontrado no âmbito");

      return {
        row,
        index,
        valid: errors.length === 0,
        farmerMatch: farmer ? { code: farmer.code, full_name: farmer.full_name } : undefined,
        errors,
      };
    });
    setValidationResults(results);
    setValidating(false);
  };

  const validRows = validationResults?.filter((r) => r.valid) || [];
  const invalidRows = validationResults?.filter((r) => !r.valid) || [];

  const handleFileSubmit = async (skipValidation = false) => {
    const rowsToProcess = skipValidation
      ? csvRows.map((row, index) => {
          const phone = normalizePhone(row.phone);
          const farmer = matchingFarmers.find((f) => normalizePhone(f.phone || "") === phone);
          return { row, index, valid: !!farmer, farmerMatch: farmer ? { code: farmer.code, full_name: farmer.full_name } : undefined, errors: [] as string[] };
        }).filter((r) => r.farmerMatch)
      : validRows;

    if (rowsToProcess.length === 0) {
      toast({ title: "Sem registos válidos", description: "Nenhum registo válido para processar.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toLocaleDateString("pt-AO");
      const base = Date.now().toString(36).toUpperCase();
      const incentiveType = formType || "Insumos Agrícolas";

      const rows = rowsToProcess.map((r, i) => ({
        incentive_code: `INC-${base}-${String(i + 1).padStart(3, "0")}`,
        farmer_code: r.farmerMatch!.code,
        type: incentiveType,
        amount: r.row.amount,
        method: "Unitel Money",
        incentive_date: now,
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("farmer_incentives").insert(batch);
        if (error) throw error;
      }

      toast({
        title: "Distribuição concluída",
        description: `${rowsToProcess.length} incentivos registados via ficheiro.`,
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

  const handleManualSubmit = async () => {
    if (!canSubmitManual) return;
    setSubmitting(true);
    try {
      const now = new Date().toLocaleDateString("pt-AO");
      const base = Date.now().toString(36).toUpperCase();
      const rows = selectedFarmers.map((f, i) => ({
        incentive_code: `INC-${base}-${String(i + 1).padStart(3, "0")}`,
        farmer_code: f.code,
        type: formType,
        amount: formAmount,
        method: "Unitel Money",
        incentive_date: now,
      }));

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

  const parsedAmount = parseFloat((formAmount || "0").replace(/\./g, "").replace(",", ".")) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Layers className="h-4 w-4" />Distribuir em Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Distribuição em Lote
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 flex-1 overflow-y-auto pr-1">
          {/* Scope selection */}
          <div className="space-y-2">
            <Label>Âmbito da distribuição</Label>
            <Select value={scope} onValueChange={(v: Scope) => {
              setScope(v);
              setSelectedProvinceId("");
              setSelectedMunicipalityName("");
              setSelectedEca("");
              setExcludedFarmers(new Set());
              setCsvRows([]);
              setValidationResults(null);
              setFileName("");
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
              <Select value={selectedEca} onValueChange={(v) => { setSelectedEca(v); setExcludedFarmers(new Set()); setCsvRows([]); setValidationResults(null); }}>
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
              <Select value={selectedProvinceId} onValueChange={(v) => {
                setSelectedProvinceId(v);
                setSelectedMunicipalityName("");
                setExcludedFarmers(new Set());
                setCsvRows([]);
                setValidationResults(null);
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar província..." /></SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === "municipio" && selectedProvinceId && (
            <div className="space-y-2">
              <Label>Município</Label>
              <Select value={selectedMunicipalityName} onValueChange={(v) => { setSelectedMunicipalityName(v); setExcludedFarmers(new Set()); setCsvRows([]); setValidationResults(null); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar município..." /></SelectTrigger>
                <SelectContent>
                  {municipalities.map((m) => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Input mode toggle - appears after scope is ready */}
          {scopeReady && (
            <div className="space-y-2">
              <Label>Modo de entrada</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={inputMode === "manual" ? "default" : "outline"}
                  onClick={() => { setInputMode("manual"); setCsvRows([]); setValidationResults(null); setFileName(""); }}
                  className="flex-1 gap-2"
                >
                  <Users className="h-4 w-4" />Manual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={inputMode === "file" ? "default" : "outline"}
                  onClick={() => setInputMode("file")}
                  className="flex-1 gap-2"
                >
                  <Upload className="h-4 w-4" />Carregar Ficheiro
                </Button>
              </div>
            </div>
          )}

          {/* FILE MODE */}
          {scopeReady && inputMode === "file" && (
            <>
              {/* Incentive type for file mode */}
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

              {/* File upload area */}
              <div className="space-y-2">
                <Label>Ficheiro CSV (formato Bulk Payment)</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {fileName ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <FileCheck className="h-5 w-5 text-primary" />
                      <span className="font-medium">{fileName}</span>
                      <Badge variant="secondary">{csvRows.length} registos</Badge>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Clique para selecionar ficheiro CSV</p>
                      <p className="text-xs text-muted-foreground">Formato: MSISDN;Telefone;;;Valor;Comentário</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview of loaded rows */}
              {csvRows.length > 0 && !validationResults && (
                <div className="space-y-2">
                  <Label>Pré-visualização ({csvRows.length} linhas)</Label>
                  <ScrollArea className="h-40 rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Telefone</TableHead>
                          <TableHead className="text-xs">Valor</TableHead>
                          <TableHead className="text-xs">Comentário</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{r.phone}</TableCell>
                            <TableCell className="text-xs">{r.amount} Kz</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.comment}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={validateRows}
                      disabled={validating}
                    >
                      <FileCheck className="h-4 w-4" />
                      {validating ? "A validar..." : "Validar"}
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 gap-2"
                      onClick={() => handleFileSubmit(true)}
                      disabled={submitting}
                    >
                      <Upload className="h-4 w-4" />
                      {submitting ? "A processar..." : "Carregar Directo"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Validation results */}
              {validationResults && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="font-medium text-success">{validRows.length} válidos</span>
                    </div>
                    {invalidRows.length > 0 && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">{invalidRows.length} com erros</span>
                      </div>
                    )}
                  </div>

                  <ScrollArea className="h-48 rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-8">#</TableHead>
                          <TableHead className="text-xs">Telefone</TableHead>
                          <TableHead className="text-xs">Agricultor</TableHead>
                          <TableHead className="text-xs">Valor</TableHead>
                          <TableHead className="text-xs">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResults.map((r) => (
                          <TableRow key={r.index} className={r.valid ? "" : "bg-destructive/5"}>
                            <TableCell className="text-xs">{r.index + 1}</TableCell>
                            <TableCell className="text-xs font-mono">{r.row.phone}</TableCell>
                            <TableCell className="text-xs">
                              {r.farmerMatch ? (
                                <span className="text-foreground">{r.farmerMatch.full_name}</span>
                              ) : (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{r.row.amount} Kz</TableCell>
                            <TableCell className="text-xs">
                              {r.valid ? (
                                <Badge variant="secondary" className="text-[10px] bg-success/10 text-success">OK</Badge>
                              ) : (
                                <span className="text-destructive text-[10px]">{r.errors.join(", ")}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {validRows.length > 0 && (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <p className="font-medium">Pronto para distribuir</p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {validRows.length} registos válidos
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-base px-3">
                        {validRows.reduce((s, r) => s + (parseFloat(r.row.amount) || 0), 0).toLocaleString("pt-AO")} Kz
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* MANUAL MODE */}
          {scopeReady && inputMode === "manual" && matchingFarmers.length > 0 && (
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
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{f.code}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {parsedAmount > 0 && selectedFarmers.length > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium">Resumo da distribuição</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {selectedFarmers.length} agricultores × {formAmount} Kz
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-base px-3">
                    {(selectedFarmers.length * parsedAmount).toLocaleString("pt-AO")} Kz
                  </Badge>
                </div>
              )}
            </>
          )}

          {scopeReady && inputMode === "manual" && matchingFarmers.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhum agricultor aprovado encontrado para esta seleção.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
            Cancelar
          </Button>
          {inputMode === "manual" ? (
            <Button onClick={handleManualSubmit} disabled={!canSubmitManual || submitting}>
              {submitting ? "A distribuir..." : `Distribuir para ${selectedFarmers.length} agricultores`}
            </Button>
          ) : (
            validationResults && validRows.length > 0 && (
              <Button onClick={() => handleFileSubmit(false)} disabled={submitting}>
                {submitting ? "A processar..." : `Distribuir ${validRows.length} válidos`}
              </Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BatchDistributionDialog;
