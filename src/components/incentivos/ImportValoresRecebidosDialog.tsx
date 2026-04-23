import { useState, useRef, useCallback } from "react";
import { FileUp, Upload, AlertTriangle, CheckCircle2, Download, X, Phone } from "lucide-react";
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

interface ParsedRow {
  phone: string;
  amount: number;
  amount_raw: string;
  _row: number;
  _errors: string[];
}

const COLUMN_MAP: Record<string, "phone" | "amount"> = {
  telefone: "phone",
  telemóvel: "phone",
  telemovel: "phone",
  phone: "phone",
  contacto: "phone",
  numero: "phone",
  número: "phone",
  msisdn: "phone",
  valor: "amount",
  montante: "amount",
  amount: "amount",
  "valor recebido": "amount",
  "valor atribuído": "amount",
  "valor atribuido": "amount",
  kz: "amount",
};

// Normalize Angolan phone numbers: keep last 9 digits.
function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 9 ? digits.slice(-9) : digits;
}

function parseAmount(raw: any): number {
  if (raw === null || raw === undefined || raw === "") return NaN;
  if (typeof raw === "number") return raw;
  const s = String(raw).trim().replace(/\s/g, "").replace(/Kz/gi, "");
  // Handle PT format "1.234.567,89" and US "1,234,567.89"
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized = s;
  if (lastComma > lastDot) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = s.replace(/,/g, "");
  }
  const n = parseFloat(normalized);
  return isFinite(n) ? n : NaN;
}

function formatKz(n: number) {
  return n.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ImportValoresRecebidosDialog() {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [matched, setMatched] = useState<Map<string, { code: string; full_name: string }>>(new Map());
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [completed, setCompleted] = useState<{ updated: number; failed: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setRows([]); setMatched(new Map()); setUnmatched([]);
    setCompleted(null); setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["telefone", "valor"],
      ["923456789", "50000"],
      ["924111222", "75000,50"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ValoresRecebidos");
    XLSX.writeFile(wb, "template_valores_recebidos.xlsx");
  };

  const onFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); setCompleted(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: false });

      const parsed: ParsedRow[] = json.map((r, idx) => {
        const normalized: Record<string, any> = {};
        for (const k of Object.keys(r)) {
          const key = k.toLowerCase().trim();
          const mapped = COLUMN_MAP[key];
          if (mapped) normalized[mapped] = r[k];
        }
        const phone = normalizePhone(normalized.phone);
        const amount = parseAmount(normalized.amount);
        const errs: string[] = [];
        if (!phone || phone.length < 9) errs.push("Telefone inválido");
        if (!isFinite(amount) || amount < 0) errs.push("Valor inválido");
        return {
          phone,
          amount: isFinite(amount) ? amount : 0,
          amount_raw: String(normalized.amount ?? ""),
          _row: idx + 2,
          _errors: errs,
        };
      });

      setRows(parsed);

      // Match against farmers by phone (last 9 digits).
      const validPhones = Array.from(new Set(parsed.filter((p) => p._errors.length === 0).map((p) => p.phone)));
      if (validPhones.length === 0) {
        setMatched(new Map()); setUnmatched([]);
        toast.error("Nenhum telefone válido no ficheiro");
        return;
      }

      // Fetch all farmers (10k+) and match locally to avoid IN-list size limits.
      const map = new Map<string, { code: string; full_name: string }>();
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("farmers")
          .select("code, full_name, phone")
          .not("phone", "is", null)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const f of data) {
          const fp = normalizePhone(f.phone || "");
          if (fp && !map.has(fp)) map.set(fp, { code: f.code, full_name: f.full_name });
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const matchedMap = new Map<string, { code: string; full_name: string }>();
      const notFound: string[] = [];
      for (const ph of validPhones) {
        const f = map.get(ph);
        if (f) matchedMap.set(ph, f);
        else notFound.push(ph);
      }
      setMatched(matchedMap);
      setUnmatched(notFound);
    } catch (err: any) {
      toast.error("Erro ao ler ficheiro", { description: err?.message });
    } finally {
      setParsing(false);
    }
  }, []);

  const onImport = async () => {
    const updates = rows.filter((r) => r._errors.length === 0 && matched.has(r.phone));
    if (updates.length === 0) {
      toast.error("Não há linhas válidas com agricultor correspondente");
      return;
    }
    setImporting(true); setProgress(0);

    let updated = 0; let failed = 0;
    // Aggregate by code (caso o mesmo telefone apareça mais que uma vez).
    const byCode = new Map<string, number>();
    for (const r of updates) {
      const m = matched.get(r.phone)!;
      byCode.set(m.code, (byCode.get(m.code) || 0) + r.amount);
    }
    const entries = Array.from(byCode.entries());

    for (let i = 0; i < entries.length; i++) {
      const [code, amount] = entries[i];
      // Formato canónico EN-US "200000.00" (sem separadores de milhar)
      const valor_recebido = amount.toFixed(2);
      const { error } = await supabase
        .from("farmers")
        .update({ valor_recebido })
        .eq("code", code);
      if (error) failed++; else updated++;
      setProgress(Math.round(((i + 1) / entries.length) * 100));
    }

    setImporting(false);
    setCompleted({ updated, failed });
    queryClient.invalidateQueries({ queryKey: ["farmer_incentives"] });
    queryClient.invalidateQueries({ queryKey: ["farmers_list_select"] });
    queryClient.invalidateQueries({ queryKey: ["farmers"] });
    toast.success(`${updated} agricultor(es) actualizado(s)`, {
      description: failed > 0 ? `${failed} falharam` : undefined,
    });
  };

  const validCount = rows.filter((r) => r._errors.length === 0 && matched.has(r.phone)).length;
  const errorCount = rows.filter((r) => r._errors.length > 0).length;
  const totalAmount = rows
    .filter((r) => r._errors.length === 0 && matched.has(r.phone))
    .reduce((s, r) => s + r.amount, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Phone className="h-4 w-4" />Importar Valores (por telefone)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileUp className="h-5 w-5" />Importar Valores Recebidos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium">Como funciona</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
              <li>O ficheiro deve ter as colunas <strong>telefone</strong> e <strong>valor</strong>.</li>
              <li>O sistema procura cada agricultor pelo telefone (últimos 9 dígitos).</li>
              <li>O <strong>valor recebido</strong> é actualizado e o <strong>saldo final</strong> recalcula-se automaticamente.</li>
            </ul>
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-2">
              <Download className="h-3 w-3" />Descarregar modelo
            </Button>
          </div>

          {!rows.length && (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Carregar ficheiro Excel ou CSV</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={onFile}
              />
            </div>
          )}

          {parsing && (
            <div className="text-center py-6 text-sm text-muted-foreground">A processar ficheiro…</div>
          )}

          {rows.length > 0 && !completed && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total linhas</p>
                  <p className="text-lg font-bold">{rows.length}</p>
                </div>
                <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                  <p className="text-xs text-success">Válidas</p>
                  <p className="text-lg font-bold text-success">{validCount}</p>
                </div>
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <p className="text-xs text-warning">Sem match</p>
                  <p className="text-lg font-bold text-warning">{unmatched.length}</p>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs text-destructive">Erros</p>
                  <p className="text-lg font-bold text-destructive">{errorCount}</p>
                </div>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                Total a creditar: <strong>{formatKz(totalAmount)} Kz</strong> em <strong>{validCount}</strong> agricultor(es)
              </div>

              <ScrollArea className="h-64 rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      <th className="text-left px-3 py-2">Linha</th>
                      <th className="text-left px-3 py-2">Telefone</th>
                      <th className="text-right px-3 py-2">Valor</th>
                      <th className="text-left px-3 py-2">Agricultor</th>
                      <th className="text-left px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const m = matched.get(r.phone);
                      const hasErr = r._errors.length > 0;
                      const noMatch = !hasErr && !m;
                      return (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-1.5 text-muted-foreground">{r._row}</td>
                          <td className="px-3 py-1.5 font-mono">{r.phone || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-medium">
                            {isFinite(r.amount) ? formatKz(r.amount) : r.amount_raw}
                          </td>
                          <td className="px-3 py-1.5">
                            {m ? <span className="text-foreground">{m.full_name} <span className="text-muted-foreground text-[10px]">({m.code})</span></span> : "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            {hasErr ? (
                              <Badge variant="destructive" className="gap-1 text-[10px]">
                                <X className="h-3 w-3" />{r._errors.join(", ")}
                              </Badge>
                            ) : noMatch ? (
                              <Badge variant="outline" className="gap-1 text-[10px] border-warning/40 text-warning">
                                <AlertTriangle className="h-3 w-3" />Sem match
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-[10px] border-success/40 text-success">
                                <CheckCircle2 className="h-3 w-3" />OK
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>

              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">A actualizar… {progress}%</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset} disabled={importing}>Cancelar</Button>
                <Button onClick={onImport} disabled={importing || validCount === 0}>
                  Importar {validCount} valor(es)
                </Button>
              </div>
            </>
          )}

          {completed && (
            <div className="space-y-3">
              <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-success mb-2" />
                <p className="font-medium">Importação concluída</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {completed.updated} actualizado(s){completed.failed > 0 ? `, ${completed.failed} falharam` : ""}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset}>Importar outro ficheiro</Button>
                <Button onClick={() => setOpen(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
