import { useState, useRef, useCallback } from "react";
import { FileUp, Upload, AlertTriangle, CheckCircle2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { usePatecLabel } from "@/hooks/usePatecLabel";

interface ParsedFarmer {
  full_name: string;
  bi?: string;
  phone?: string;
  province?: string;
  municipality?: string;
  school?: string;
  gender?: string;
  birth_date?: string;
  patec?: number | null;
  _row: number;
  _errors: string[];
}

// Expected column headers mapping (Portuguese → field)
const COLUMN_MAP: Record<string, keyof Omit<ParsedFarmer, "_row" | "_errors">> = {
  nome: "full_name",
  "nome completo": "full_name",
  full_name: "full_name",
  bi: "bi",
  "bilhete de identidade": "bi",
  telefone: "phone",
  phone: "phone",
  telemóvel: "phone",
  telemovel: "phone",
  província: "province",
  provincia: "province",
  province: "province",
  município: "municipality",
  municipio: "municipality",
  municipality: "municipality",
  escola: "school",
  "escola de campo": "school",
  eca: "school",
  school: "school",
  género: "gender",
  genero: "gender",
  sexo: "gender",
  gender: "gender",
  "data de nascimento": "birth_date",
  "data nascimento": "birth_date",
  birth_date: "birth_date",
  nascimento: "birth_date",
  patec: "patec",
};

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[_\-]/g, " ");

const generateCode = (index: number) => {
  const ts = Date.now().toString(36).toUpperCase();
  return `AGR-${ts}-${String(index + 1).padStart(3, "0")}`;
};

const validateRow = (row: ParsedFarmer, validPatecNumbers: Set<number>): string[] => {
  const errors: string[] = [];
  if (!row.full_name || row.full_name.trim().length < 2) errors.push("Nome obrigatório (mín. 2 caracteres)");
  if (row.patec && validPatecNumbers.size > 0 && !validPatecNumbers.has(row.patec)) {
    errors.push(`PATEC inválido (válidos: ${Array.from(validPatecNumbers).sort((a, b) => a - b).join(", ")})`);
  }
  if (row.gender && !["Masculino", "Feminino", "M", "F"].includes(row.gender)) errors.push("Género inválido");
  return errors;
};

const normalizeGender = (g?: string) => {
  if (!g) return null;
  const v = g.trim().toUpperCase();
  if (v === "M" || v === "MASCULINO") return "Masculino";
  if (v === "F" || v === "FEMININO") return "Feminino";
  return g;
};

const BulkImportDialog = () => {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedFarmer[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { patecs: allPatecs } = usePatecLabel({ activeOnly: true });
  const validPatecNumbers = new Set(allPatecs.map((p) => p.legacy_number).filter((n): n is number => n != null));

  const reset = () => {
    setParsed([]);
    setFileName("");
    setProgress(0);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback((file: File) => {
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (json.length === 0) {
          toast.error("O ficheiro não contém dados");
          return;
        }

        // Map columns
        const rawHeaders = Object.keys(json[0]);
        const headerMap: Record<string, string> = {};
        rawHeaders.forEach((h) => {
          const norm = normalizeHeader(h);
          const mapped = COLUMN_MAP[norm];
          if (mapped) headerMap[h] = mapped;
        });

        if (!Object.values(headerMap).includes("full_name")) {
          toast.error("Coluna 'Nome' não encontrada. Verifique o cabeçalho do ficheiro.");
          return;
        }

        const rows: ParsedFarmer[] = json.map((row, i) => {
          const farmer: any = { _row: i + 2, _errors: [] };
          Object.entries(headerMap).forEach(([orig, field]) => {
            let val = row[orig];
            if (val instanceof Date) val = val.toISOString().slice(0, 10);
            else if (val !== undefined && val !== null) val = String(val).trim();
            if (field === "patec") {
              const num = parseInt(val, 10);
              farmer[field] = isNaN(num) ? null : num;
            } else {
              farmer[field] = val || undefined;
            }
          });
          farmer.gender = normalizeGender(farmer.gender);
          farmer._errors = validateRow(farmer, validPatecNumbers);
          return farmer as ParsedFarmer;
        });

        setParsed(rows);
      } catch {
        toast.error("Erro ao ler o ficheiro. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [validPatecNumbers]);

  const validRows = parsed.filter((r) => r._errors.length === 0);
  const invalidRows = parsed.filter((r) => r._errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;
    const batchSize = 25;

    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize).map((r, j) => ({
        code: generateCode(i + j),
        full_name: r.full_name,
        bi: r.bi || null,
        phone: r.phone || null,
        province: r.province || null,
        municipality: r.municipality || null,
        school: r.school || null,
        gender: r.gender || null,
        birth_date: r.birth_date || null,
        patec: r.patec || null,
        status: "Pendente",
      }));

      const { error } = await supabase.from("farmers").insert(batch);
      if (error) {
        failed += batch.length;
      } else {
        success += batch.length;
      }
      setProgress(Math.round(((i + batch.length) / validRows.length) * 100));
    }

    setResult({ success, failed });
    setImporting(false);
    if (success > 0) {
      queryClient.invalidateQueries({ queryKey: ["farmers_list"] });
      toast.success(`${success} agricultores importados com sucesso`);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nome Completo", "BI", "Telefone", "Província", "Município", "Escola de Campo", "Género", "Data Nascimento", "PATEC"],
      ["João Manuel Silva", "000123456LA789", "923456789", "Benguela", "Lobito", "EC Lobito", "Masculino", "1985-03-15", 1],
    ]);
    ws["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, "Agricultores");
    XLSX.writeFile(wb, "modelo_agricultores.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileUp className="h-4 w-4" />
          <span className="hidden sm:inline">Importar Excel</span>
          <span className="sm:hidden">Importar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importação em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Template download */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
            <div className="text-sm">
              <p className="font-medium">Modelo Excel</p>
              <p className="text-muted-foreground text-xs">Descarregue o modelo com as colunas corretas</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" />Descarregar
            </Button>
          </div>

          {/* File upload */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <FileUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-medium">{fileName}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); reset(); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">Arraste o ficheiro ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls) ou CSV</p>
              </>
            )}
          </div>

          {/* Preview */}
          {parsed.length > 0 && !result && (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />{validRows.length} válidos
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />{invalidRows.length} com erros
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{parsed.length} linhas no total</span>
              </div>

              <ScrollArea className="h-52 rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 sticky top-0">
                      <th className="text-left px-3 py-2 font-semibold">Linha</th>
                      <th className="text-left px-3 py-2 font-semibold">Nome</th>
                      <th className="text-left px-3 py-2 font-semibold">Província</th>
                      <th className="text-left px-3 py-2 font-semibold">Escola</th>
                      <th className="text-left px-3 py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r) => (
                      <tr key={r._row} className={`border-b border-border ${r._errors.length > 0 ? "bg-destructive/5" : ""}`}>
                        <td className="px-3 py-1.5 text-muted-foreground">{r._row}</td>
                        <td className="px-3 py-1.5 font-medium">{r.full_name || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.province || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.school || "—"}</td>
                        <td className="px-3 py-1.5">
                          {r._errors.length > 0 ? (
                            <span className="text-destructive" title={r._errors.join(", ")}>
                              <AlertTriangle className="h-3 w-3 inline mr-1" />{r._errors[0]}
                            </span>
                          ) : (
                            <span className="text-primary"><CheckCircle2 className="h-3 w-3 inline mr-1" />OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">A importar... {progress}%</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg border border-border p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
              <p className="font-medium">{result.success} agricultores importados</p>
              {result.failed > 0 && <p className="text-sm text-destructive">{result.failed} falharam</p>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={validRows.length === 0 || importing}>
              {importing ? "A importar..." : `Importar ${validRows.length} agricultores`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportDialog;
