import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";

/* ───────────────────────── helpers ───────────────────────── */

import { parseAmount as parsePtao, formatKz as fmtKzShared, serializeAmount, computeSaldoFinal } from "@/lib/numberFormat";

const fmt = (n: number) => fmtKzShared(n, false);

/* ───── Phone normalization ─────
 * Angola mobile: 9 dígitos começando por 9 (ex.: 9XXXXXXXX).
 * Aceita variantes: +244 9..., 00244 9..., 244 9..., espaços, hífens, parênteses.
 * Retorna { phone: '9XXXXXXXX' | '', reason } com classificação para auditoria.
 */
type PhoneNormReason =
  | "ok"                  // já estava em formato 9XXXXXXXX
  | "stripped_244"        // tinha código país 244 (com ou sem +/00)
  | "stripped_leading_zero" // tinha 0 à frente (ex.: 0923456789)
  | "padded_or_trimmed"   // tinha comprimento diferente mas extraímos os últimos 9
  | "invalid_prefix"      // não começa por 9 após normalizar
  | "too_short"           // menos de 9 dígitos
  | "empty";

export type NormalizedPhone = {
  phone: string;          // resultado canónico (9XXXXXXXX) ou ""
  reason: PhoneNormReason;
  changed: boolean;       // true se diferente do input original (ignorando whitespace)
};

const normalizePhoneDetailed = (raw: string | null | undefined): NormalizedPhone => {
  if (!raw) return { phone: "", reason: "empty", changed: false };
  const original = raw.toString().trim();
  if (!original) return { phone: "", reason: "empty", changed: false };

  let digits = original.replace(/\D/g, "");
  if (!digits) return { phone: "", reason: "empty", changed: false };

  let reason: PhoneNormReason = "ok";

  // Remove código de país 244 (com ou sem 00)
  if (digits.startsWith("00244")) {
    digits = digits.slice(5);
    reason = "stripped_244";
  } else if (digits.startsWith("244") && digits.length >= 12) {
    digits = digits.slice(3);
    reason = "stripped_244";
  } else if (digits.startsWith("0") && digits.length === 10) {
    // Variante local com 0 à frente (0923456789)
    digits = digits.slice(1);
    reason = "stripped_leading_zero";
  }

  if (digits.length < 9) return { phone: "", reason: "too_short", changed: true };

  // Se ainda for >9, ficar com os últimos 9 (defensivo contra prefixos exóticos)
  if (digits.length > 9) {
    digits = digits.slice(-9);
    if (reason === "ok") reason = "padded_or_trimmed";
  }

  // Em Angola números móveis começam por 9
  if (!digits.startsWith("9")) {
    return { phone: "", reason: "invalid_prefix", changed: true };
  }

  const changed = digits !== original.replace(/\s/g, "");
  return { phone: digits, reason: changed && reason === "ok" ? "padded_or_trimmed" : reason, changed };
};

// Wrapper retro-compatível (apenas devolve a string)
const normalizePhone = (raw: string | null | undefined): string =>
  normalizePhoneDetailed(raw).phone;

/* Acumulador de estatísticas de normalização por origem (csv / farmers / orphans) */
export type PhoneNormStats = {
  total: number;
  valid: number;
  changed: number;
  stripped244: number;
  strippedLeadingZero: number;
  paddedOrTrimmed: number;
  invalidPrefix: number;
  tooShort: number;
  empty: number;
};

const emptyPhoneStats = (): PhoneNormStats => ({
  total: 0, valid: 0, changed: 0,
  stripped244: 0, strippedLeadingZero: 0, paddedOrTrimmed: 0,
  invalidPrefix: 0, tooShort: 0, empty: 0,
});

const accumulatePhone = (stats: PhoneNormStats, n: NormalizedPhone) => {
  stats.total += 1;
  if (n.phone) stats.valid += 1;
  if (n.changed) stats.changed += 1;
  switch (n.reason) {
    case "stripped_244": stats.stripped244 += 1; break;
    case "stripped_leading_zero": stats.strippedLeadingZero += 1; break;
    case "padded_or_trimmed": stats.paddedOrTrimmed += 1; break;
    case "invalid_prefix": stats.invalidPrefix += 1; break;
    case "too_short": stats.tooShort += 1; break;
    case "empty": stats.empty += 1; break;
  }
};

/* ───── CSV parsing (Unitel format) ───── */

type CsvRow = Record<string, string>;

const parseCsv = (text: string): CsvRow[] => {
  // Robust CSV: handle quoted values with commas. Auto-detect , or ; separator.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (c === sep && !inQ) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = splitLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: CsvRow = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").replace(/^"|"$/g, "");
    });
    return row;
  });
};

const findCol = (row: CsvRow, candidates: string[]): string | null => {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const k = keys.find((x) => x.toLowerCase().trim() === cand.toLowerCase().trim());
    if (k) return k;
  }
  for (const cand of candidates) {
    const k = keys.find((x) => x.toLowerCase().includes(cand.toLowerCase()));
    if (k) return k;
  }
  return null;
};

/* ───── Schema validation dos CSVs Unitel ───── */
export type CsvSchemaIssue = {
  level: "error" | "warning";
  field: "phone" | "amount" | "transactionId" | "bulkPlanId" | "rows" | "successRows";
  message: string;
};

export type CsvSchemaReport = {
  valid: boolean;          // false se houver pelo menos 1 erro
  issues: CsvSchemaIssue[];
  detected: {
    phoneCol: string | null;
    amountCol: string | null;
    statusCol: string | null;
    txCol: string | null;
    bulkCol: string | null;
    planNameCol: string | null;
  };
};

const validateCsvSchema = (rows: CsvRow[]): CsvSchemaReport => {
  const issues: CsvSchemaIssue[] = [];
  const sample = rows[0] ?? {};
  const phoneCol = findCol(sample, ["Credit Msisdn", "Msisdn", "Phone", "Telefone"]);
  const amountCol = findCol(sample, ["Amount", "Valor", "Credit Amount"]);
  const statusCol = findCol(sample, ["Status", "Estado", "Result"]);
  const txCol = findCol(sample, ["TransactionID", "Transaction Id", "Trx", "Reference"]);
  const bulkCol = findCol(sample, ["Bulk Plan ID", "BulkPlanId", "Plan ID"]);
  const planNameCol = findCol(sample, ["Plan Name", "Bulk Plan Name", "Description"]);

  if (rows.length === 0) {
    issues.push({ level: "error", field: "rows", message: "Ficheiro vazio (0 linhas)." });
  }
  if (!phoneCol) {
    issues.push({
      level: "error",
      field: "phone",
      message: "Coluna de telefone em falta. Esperado: 'Credit Msisdn', 'Msisdn', 'Phone' ou 'Telefone'.",
    });
  }
  if (!amountCol) {
    issues.push({
      level: "error",
      field: "amount",
      message: "Coluna de valor em falta. Esperado: 'Amount', 'Valor' ou 'Credit Amount'.",
    });
  }
  if (!txCol) {
    issues.push({
      level: "warning",
      field: "transactionId",
      message: "Coluna de identificador (TransactionID) em falta. A deteção de duplicados ficará mais fraca.",
    });
  }
  if (!bulkCol) {
    issues.push({
      level: "warning",
      field: "bulkPlanId",
      message: "Coluna 'Bulk Plan ID' em falta. Não será possível detetar reedições do mesmo bulk.",
    });
  }
  return {
    valid: issues.every((i) => i.level !== "error"),
    issues,
    detected: { phoneCol, amountCol, statusCol, txCol, bulkCol, planNameCol },
  };
};

type ParsedCsv = {
  fileName: string;
  rows: CsvRow[];
  bulkPlanId: string | null;
  planName: string | null;
  successCount: number;
  totalAmount: number;
  unitAmount: number | null;
  successRows: { phone: string; amount: number; transactionId: string }[];
  phoneStats: PhoneNormStats;
  schema: CsvSchemaReport;
};

const analyzeCsv = (fileName: string, rows: CsvRow[]): ParsedCsv => {
  const schema = validateCsvSchema(rows);
  const { phoneCol, amountCol, statusCol, txCol, bulkCol, planNameCol } = schema.detected;

  const successRows: ParsedCsv["successRows"] = [];
  let totalAmount = 0;
  let bulkPlanId: string | null = null;
  let planName: string | null = null;
  const amountSet = new Set<number>();
  const phoneStats = emptyPhoneStats();

  // Se não há coluna de telefone ou valor, não vale a pena tentar parse — schema irá bloquear.
  if (schema.valid) {
    for (const r of rows) {
      if (bulkCol && !bulkPlanId) bulkPlanId = (r[bulkCol] ?? "").trim() || null;
      if (planNameCol && !planName) planName = (r[planNameCol] ?? "").trim() || null;
      const status = statusCol ? (r[statusCol] ?? "").toLowerCase() : "success";
      if (statusCol && !status.includes("success") && !status.includes("ok")) continue;
      const norm = normalizePhoneDetailed(phoneCol ? r[phoneCol] : "");
      accumulatePhone(phoneStats, norm);
      const amount = parsePtao(amountCol ? r[amountCol] : "0");
      const transactionId = txCol ? (r[txCol] ?? "").trim() : "";
      if (!norm.phone) continue;
      successRows.push({ phone: norm.phone, amount, transactionId });
      totalAmount += amount;
      if (amount > 0) amountSet.add(amount);
    }
    if (successRows.length === 0) {
      schema.issues.push({
        level: "error",
        field: "successRows",
        message: "Nenhuma linha com sucesso após normalização (telefones inválidos ou status≠success).",
      });
      schema.valid = false;
    }
  }

  const unitAmount = amountSet.size === 1 ? Array.from(amountSet)[0] : null;

  return {
    fileName,
    rows,
    bulkPlanId,
    planName,
    successCount: successRows.length,
    totalAmount,
    unitAmount,
    successRows,
    phoneStats,
    schema,
  };
};

/* ───────────────────────── types ───────────────────────── */

type Farmer = {
  code: string;
  full_name: string;
  phone: string | null;
  school: string | null;
  municipality: string | null;
  valor_recebido: string | null;
  total_gasto: string | null;
  saldo_final: string | null;
};

type Orphan = {
  phone: string;
  amount: number;
  source_files: string[] | null;
  created_at: string;
};

type EcaRow = {
  school: string;
  municipality: string | null;
  n: number;
  recebido: number;
  gasto: number;
  saldo: number;
};

type DupCheck = {
  fileA: ParsedCsv;
  fileB: ParsedCsv;
  matchingTxIds: number;
  totalA: number;
  totalB: number;
  isDuplicate: boolean;
  reason: string;
};

type DiffRow = {
  fileName: string;
  totalRows: number;
  matched: number;
  matchedAmount: number;
  orphans: number;
  orphansAmount: number;
};

type FullReview = {
  province: string;
  generatedAt: string;
  farmersCount: number;
  totalRecebido: number;
  totalGasto: number;
  totalSaldo: number;
  ecaRows: EcaRow[];
  uploadedFiles: ParsedCsv[];
  duplicateChecks: DupCheck[];
  diffRows: DiffRow[];
  topOrphans: Orphan[];
  orphanCount: number;
  orphanAmount: number;
  phoneStats: {
    csv: PhoneNormStats;
    farmers: PhoneNormStats;
    orphans: PhoneNormStats;
  };
};

/* ───────────────────────── page ───────────────────────── */

const RevisaoProvincias = () => {
  const { hasRole, isAdmin } = useAuth();
  const canApply = isAdmin || hasRole("gestor_incentivos");
  const [provinces, setProvinces] = useState<string[]>([]);
  const [province, setProvince] = useState<string>("Cuando Cubango");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [review, setReview] = useState<FullReview | null>(null);
  const [uploadedCsvs, setUploadedCsvs] = useState<ParsedCsv[]>([]);
  const [confirmedDuplicates, setConfirmedDuplicates] = useState<Set<string>>(new Set());
  // Snapshot das decisões aplicadas no último generateReview — detecta mudanças pendentes
  const [appliedDuplicateDecisions, setAppliedDuplicateDecisions] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [writeUnlocked, setWriteUnlocked] = useState(false);
  // Apply-to-DB state
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
  const [currentReviewAppliedAt, setCurrentReviewAppliedAt] = useState<string | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyConfirmText, setApplyConfirmText] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* History (saved reviews) */
  type SavedReviewRow = {
    id: string;
    province: string;
    generated_at: string;
    generated_by_name: string | null;
    csv_file_names: string[];
    confirmed_duplicates: string[];
    total_farmers: number;
    total_csv_amount: number;
    total_matched_amount: number;
    total_orphan_amount: number;
    matched_count: number;
    orphan_count: number;
    duplicate_pairs_count: number;
    phones_normalized: number;
    notes: string | null;
    payload: any;
    applied_at: string | null;
    applied_by: string | null;
    applied_summary: any;
  };
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SavedReviewRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNotes, setSaveNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("province_reviews")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setHistory((data ?? []) as SavedReviewRow[]);
    } catch (e: any) {
      toast.error(`Falha a carregar histórico: ${e?.message ?? e}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveReview = async () => {
    if (!review) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id ?? null;
      let userName: string | null = null;
      if (userId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .maybeSingle();
        userName = prof?.full_name ?? null;
      }
      const phonesNormalized =
        ((review.phoneStats.csv as any)?.changed ?? 0) +
        ((review.phoneStats.farmers as any)?.changed ?? 0) +
        ((review.phoneStats.orphans as any)?.changed ?? 0);
      const totalCsvAmount = review.uploadedFiles.reduce((s, f) => s + (f.totalAmount ?? 0), 0);
      const totalMatchedAmount = review.diffRows.reduce(
        (s, r: any) => s + (r.csvAmount ?? r.amountCsv ?? 0),
        0,
      );
      const { data: inserted, error } = await supabase.from("province_reviews").insert({
        province: review.province,
        generated_at: review.generatedAt,
        generated_by: userId,
        generated_by_name: userName,
        csv_file_names: review.uploadedFiles.map((f) => f.fileName),
        confirmed_duplicates: Array.from(confirmedDuplicates),
        total_farmers: review.farmersCount,
        total_csv_amount: totalCsvAmount,
        total_matched_amount: totalMatchedAmount,
        total_orphan_amount: review.orphanAmount,
        matched_count: review.diffRows.length,
        orphan_count: review.orphanCount,
        duplicate_pairs_count: review.duplicateChecks.length,
        phones_normalized: phonesNormalized,
        notes: saveNotes.trim() || null,
        payload: review as any,
      }).select("id").single();
      if (error) throw error;
      setCurrentReviewId(inserted?.id ?? null);
      setCurrentReviewAppliedAt(null);
      toast.success("Revisão guardada no histórico");
      setSaveDialogOpen(false);
      setSaveNotes("");
    } catch (e: any) {
      toast.error(`Falha a guardar: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  const reopenFromHistory = (row: SavedReviewRow) => {
    try {
      const restored = row.payload as FullReview;
      if (!restored || !restored.province) {
        toast.error("Payload inválido — não é possível reabrir.");
        return;
      }
      setProvince(restored.province);
      setReview(restored);
      setUploadedCsvs(restored.uploadedFiles ?? []);
      setConfirmedDuplicates(new Set(row.confirmed_duplicates ?? []));
      setAppliedDuplicateDecisions(new Set(row.confirmed_duplicates ?? []));
      setCurrentReviewId(row.id);
      setCurrentReviewAppliedAt(row.applied_at ?? null);
      setHistoryOpen(false);
      toast.success(
        `Revisão de ${restored.province} reaberta (${new Date(row.generated_at).toLocaleString("pt-PT")})`,
      );
    } catch (e: any) {
      toast.error(`Falha a reabrir: ${e?.message ?? e}`);
    }
  };

  const deleteHistoryRow = async (id: string) => {
    try {
      const { error } = await supabase.from("province_reviews").delete().eq("id", id);
      if (error) throw error;
      setHistory((h) => h.filter((r) => r.id !== id));
      toast.success("Revisão removida do histórico");
    } catch (e: any) {
      toast.error(`Falha a remover: ${e?.message ?? e}`);
    }
  };

  /* Load provinces */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("farmers")
        .select("province")
        .not("province", "is", null);
      const unique = Array.from(
        new Set(
          (data ?? [])
            .map((r) => r.province)
            .filter((p): p is string => !!p && p.trim() !== "")
        )
      ).sort();
      setProvinces(unique);
    })();
  }, []);

  /* CSV upload */
  const onCsvFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const parsed: ParsedCsv[] = [];
    for (const f of Array.from(files)) {
      try {
        const text = await f.text();
        const rows = parseCsv(text);
        parsed.push(analyzeCsv(f.name, rows));
      } catch (e) {
        toast.error(`Falha a ler ${f.name}`);
      }
    }
    setUploadedCsvs((prev) => [...prev, ...parsed]);

    // Resumo de validação por ficheiro
    const invalid = parsed.filter((p) => !p.schema.valid);
    const withWarnings = parsed.filter(
      (p) => p.schema.valid && p.schema.issues.some((i) => i.level === "warning"),
    );
    if (invalid.length > 0) {
      for (const p of invalid) {
        const errs = p.schema.issues.filter((i) => i.level === "error").map((i) => i.message).join(" • ");
        toast.error(`${p.fileName}: schema inválido — ${errs}`, { duration: 8000 });
      }
    }
    if (withWarnings.length > 0) {
      for (const p of withWarnings) {
        const warns = p.schema.issues.filter((i) => i.level === "warning").map((i) => i.message).join(" • ");
        toast.warning(`${p.fileName}: ${warns}`, { duration: 6000 });
      }
    }
    const ok = parsed.length - invalid.length;
    if (ok > 0) toast.success(`${ok} ficheiro(s) válido(s) carregado(s)`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeCsv = (idx: number) =>
    setUploadedCsvs((prev) => prev.filter((_, i) => i !== idx));

  /* Detect duplicates among uploaded CSVs */
  const detectDuplicates = (files: ParsedCsv[]): DupCheck[] => {
    const checks: DupCheck[] = [];
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const a = files[i];
        const b = files[j];
        if (a.bulkPlanId && b.bulkPlanId && a.bulkPlanId === b.bulkPlanId) {
          const setB = new Set(b.successRows.map((r) => r.transactionId).filter(Boolean));
          const matching = a.successRows.filter((r) => r.transactionId && setB.has(r.transactionId)).length;
          checks.push({
            fileA: a,
            fileB: b,
            matchingTxIds: matching,
            totalA: a.successCount,
            totalB: b.successCount,
            isDuplicate: true,
            reason: `Mesmo Bulk Plan ID ${a.bulkPlanId}${matching > 0 ? ` • ${matching} TransactionIDs coincidem` : ""}`,
          });
          continue;
        }
        // Same total + same row count + >50% phones overlap → suspicious
        const phonesB = new Set(b.successRows.map((r) => r.phone));
        const overlap = a.successRows.filter((r) => phonesB.has(r.phone)).length;
        const sameTotal = Math.abs(a.totalAmount - b.totalAmount) < 1;
        if (
          sameTotal &&
          a.successCount === b.successCount &&
          overlap / Math.max(a.successCount, 1) > 0.95
        ) {
          checks.push({
            fileA: a,
            fileB: b,
            matchingTxIds: overlap,
            totalA: a.successCount,
            totalB: b.successCount,
            isDuplicate: true,
            reason: `Mesmo total (${fmt(a.totalAmount)} Kz), mesmo nº de linhas (${a.successCount}) e ${overlap} telefones em comum`,
          });
        }
      }
    }
    return checks;
  };

  /* Main: generate full review */
  const hasInvalidCsvs = uploadedCsvs.some((c) => !c.schema.valid);

  const generateReview = async () => {
    if (!province) return;
    if (hasInvalidCsvs) {
      const bad = uploadedCsvs.filter((c) => !c.schema.valid).map((c) => c.fileName).join(", ");
      toast.error(`Não é possível gerar: ficheiros com schema inválido — ${bad}. Remova-os ou substitua.`, { duration: 8000 });
      return;
    }
    setRunning(true);
    setReview(null);
    setWriteUnlocked(false);
    setCurrentReviewId(null);
    setCurrentReviewAppliedAt(null);
    try {
      // 1. Load farmers (paginated)
      setProgress(`A carregar agricultores de ${province}…`);
      const pageSize = 1000;
      let from = 0;
      const farmers: Farmer[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("farmers")
          .select("code, full_name, phone, school, municipality, valor_recebido, total_gasto, saldo_final")
          .eq("province", province)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        farmers.push(...(data as Farmer[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // 2. Aggregate by ECA
      setProgress("A agregar saldos por ECA…");
      const totalRecebido = farmers.reduce((s, f) => s + parsePtao(f.valor_recebido), 0);
      const totalGasto = farmers.reduce((s, f) => s + parsePtao(f.total_gasto), 0);
      const totalSaldo = farmers.reduce((s, f) => s + parsePtao(f.saldo_final), 0);
      const ecaMap = new Map<string, EcaRow>();
      for (const f of farmers) {
        const key = f.school?.trim() || "(sem escola)";
        const ex =
          ecaMap.get(key) ??
          ({ school: key, municipality: f.municipality ?? null, n: 0, recebido: 0, gasto: 0, saldo: 0 } as EcaRow);
        ex.n += 1;
        ex.recebido += parsePtao(f.valor_recebido);
        ex.gasto += parsePtao(f.total_gasto);
        ex.saldo += parsePtao(f.saldo_final);
        ecaMap.set(key, ex);
      }
      const ecaRows = Array.from(ecaMap.values()).sort((a, b) => b.n - a.n);

      // 3. Phone index of farmers (com stats de normalização)
      const farmerPhoneIndex = new Map<string, Farmer>();
      const farmerPhoneStats = emptyPhoneStats();
      for (const f of farmers) {
        const norm = normalizePhoneDetailed(f.phone);
        accumulatePhone(farmerPhoneStats, norm);
        if (norm.phone) farmerPhoneIndex.set(norm.phone, f);
      }

      // 4. Duplicate checks among uploaded CSVs
      setProgress("A verificar duplicados nos ficheiros carregados…");
      const usableFiles = uploadedCsvs.filter((c, idx) => {
        // skip files explicitly NOT confirmed when flagged duplicate later — we still include for diff,
        // duplicate decision affects only the warning panel, not the diff aggregation here.
        return true;
      });
      const dupChecks = detectDuplicates(usableFiles);

      // 5. Diff: matched vs orphan per uploaded file
      setProgress("A comparar telefones contra agricultores…");
      const filesForDiff = uploadedCsvs.filter((c) => {
        // Skip duplicates that were NOT confirmed for inclusion
        const dupKey = `${c.fileName}`;
        const isFlaggedDup = dupChecks.some((d) => d.fileB.fileName === c.fileName && d.isDuplicate);
        if (isFlaggedDup && !confirmedDuplicates.has(dupKey)) return false;
        return true;
      });
      const diffRows: DiffRow[] = filesForDiff.map((c) => {
        let matched = 0;
        let matchedAmount = 0;
        let orphans = 0;
        let orphansAmount = 0;
        for (const r of c.successRows) {
          if (farmerPhoneIndex.has(r.phone)) {
            matched += 1;
            matchedAmount += r.amount;
          } else {
            orphans += 1;
            orphansAmount += r.amount;
          }
        }
        return {
          fileName: c.fileName,
          totalRows: c.successCount,
          matched,
          matchedAmount,
          orphans,
          orphansAmount,
        };
      });

      // 6. Top orphans from DB orphan_phones (filter by phones present in uploaded CSVs OR all if none uploaded)
      setProgress("A carregar telefones órfãos…");
      const { data: allOrphans } = await supabase
        .from("orphan_phones")
        .select("phone, amount, source_files, created_at")
        .is("linked_farmer_code", null);

      let orphansForProvince: Orphan[] = (allOrphans ?? []) as Orphan[];
      // Stats de normalização aplicada aos órfãos antes do filtro
      const orphanPhoneStats = emptyPhoneStats();
      for (const o of orphansForProvince) accumulatePhone(orphanPhoneStats, normalizePhoneDetailed(o.phone));

      // If user uploaded CSVs, restrict orphans to phones appearing in those uploads
      if (filesForDiff.length > 0) {
        const allCsvPhones = new Set<string>();
        for (const c of filesForDiff) for (const r of c.successRows) allCsvPhones.add(r.phone);
        orphansForProvince = orphansForProvince.filter((o) => allCsvPhones.has(normalizePhone(o.phone)));
      } else {
        // No uploads → use source_files heuristic if available (filename starts with province)
        const provKey = province.toUpperCase().replace(/\s+/g, "_");
        const filtered = orphansForProvince.filter((o) =>
          (o.source_files ?? []).some((f) => f?.toUpperCase().includes(provKey))
        );
        if (filtered.length > 0) orphansForProvince = filtered;
      }
      // Remove orphans that actually match a known farmer phone
      orphansForProvince = orphansForProvince.filter((o) => !farmerPhoneIndex.has(normalizePhone(o.phone)));

      // Agregar stats de TODOS os CSVs carregados num único bloco
      const csvPhoneStats = emptyPhoneStats();
      for (const c of uploadedCsvs) {
        const s = c.phoneStats;
        csvPhoneStats.total += s.total;
        csvPhoneStats.valid += s.valid;
        csvPhoneStats.changed += s.changed;
        csvPhoneStats.stripped244 += s.stripped244;
        csvPhoneStats.strippedLeadingZero += s.strippedLeadingZero;
        csvPhoneStats.paddedOrTrimmed += s.paddedOrTrimmed;
        csvPhoneStats.invalidPrefix += s.invalidPrefix;
        csvPhoneStats.tooShort += s.tooShort;
        csvPhoneStats.empty += s.empty;
      }

      const topOrphans = [...orphansForProvince].sort((a, b) => b.amount - a.amount).slice(0, 100);
      const orphanCount = orphansForProvince.length;
      const orphanAmount = orphansForProvince.reduce((s, o) => s + Number(o.amount ?? 0), 0);

      const result: FullReview = {
        province,
        generatedAt: new Date().toISOString(),
        farmersCount: farmers.length,
        totalRecebido,
        totalGasto,
        totalSaldo,
        ecaRows,
        uploadedFiles: uploadedCsvs,
        duplicateChecks: dupChecks,
        diffRows,
        topOrphans,
        orphanCount,
        orphanAmount,
        phoneStats: { csv: csvPhoneStats, farmers: farmerPhoneStats, orphans: orphanPhoneStats },
      };
      setReview(result);
      setAppliedDuplicateDecisions(new Set(confirmedDuplicates));
      setProgress("");
      toast.success(`Revisão de ${province} gerada`);
    } catch (e: any) {
      toast.error(`Falha: ${e?.message ?? e}`);
    } finally {
      setRunning(false);
    }
  };

  /* Export full XLSX (3 sheets) */
  const exportXlsx = () => {
    if (!review) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Saldos por ECA
    const ecaData = review.ecaRows.map((r, i) => ({
      "#": i + 1,
      "ECA / Escola": r.school,
      "Município": r.municipality ?? "",
      "Nº Agricultores": r.n,
      "Total Recebido (Kz)": Number(r.recebido.toFixed(2)),
      "Total Gasto (Kz)": Number(r.gasto.toFixed(2)),
      "Saldo (Kz)": Number(r.saldo.toFixed(2)),
    }));
    ecaData.push({
      "#": "" as any,
      "ECA / Escola": "TOTAL",
      "Município": "",
      "Nº Agricultores": review.farmersCount,
      "Total Recebido (Kz)": Number(review.totalRecebido.toFixed(2)),
      "Total Gasto (Kz)": Number(review.totalGasto.toFixed(2)),
      "Saldo (Kz)": Number(review.totalSaldo.toFixed(2)),
    });
    const ws1 = XLSX.utils.json_to_sheet(ecaData);
    ws1["!cols"] = [{ wch: 5 }, { wch: 38 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Saldos por ECA");

    // Sheet 2: Diff Unitel (matches & orphans by file)
    if (review.diffRows.length > 0) {
      const diffData = review.diffRows.map((d) => ({
        "Ficheiro": d.fileName,
        "Linhas Success": d.totalRows,
        "Match Agricultores": d.matched,
        "Valor Match (Kz)": Number(d.matchedAmount.toFixed(2)),
        "Órfãos": d.orphans,
        "Valor Órfãos (Kz)": Number(d.orphansAmount.toFixed(2)),
      }));
      const ws2 = XLSX.utils.json_to_sheet(diffData);
      ws2["!cols"] = [{ wch: 40 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Diff Unitel");
    }

    // Sheet 3: Duplicate check
    if (review.duplicateChecks.length > 0) {
      const dupData = review.duplicateChecks.map((d) => ({
        "Ficheiro A": d.fileA.fileName,
        "Bulk Plan A": d.fileA.bulkPlanId ?? "",
        "Linhas A": d.totalA,
        "Total A (Kz)": Number(d.fileA.totalAmount.toFixed(2)),
        "Ficheiro B": d.fileB.fileName,
        "Bulk Plan B": d.fileB.bulkPlanId ?? "",
        "Linhas B": d.totalB,
        "Total B (Kz)": Number(d.fileB.totalAmount.toFixed(2)),
        "TxIDs Coincidentes": d.matchingTxIds,
        "Duplicado?": d.isDuplicate ? "Sim" : "Não",
        "Motivo": d.reason,
        "Confirmado p/ Importação": confirmedDuplicates.has(d.fileB.fileName) ? "Sim" : "Não",
      }));
      const ws3 = XLSX.utils.json_to_sheet(dupData);
      ws3["!cols"] = [
        { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 16 },
        { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 16 },
        { wch: 18 }, { wch: 12 }, { wch: 50 }, { wch: 24 },
      ];
      XLSX.utils.book_append_sheet(wb, ws3, "Duplicado Check");
    }

    // Sheet 4: Top órfãos
    if (review.topOrphans.length > 0) {
      const orpData = review.topOrphans.map((o, i) => ({
        "#": i + 1,
        "Telefone": o.phone,
        "Valor (Kz)": Number(o.amount),
        "Ficheiros Origem": (o.source_files ?? []).join(" | "),
        "Carregado em": o.created_at?.slice(0, 10) ?? "",
      }));
      const ws4 = XLSX.utils.json_to_sheet(orpData);
      ws4["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 50 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws4, "Top Órfãos");
    }

    const safe = review.province.replace(/\s+/g, "_").toLowerCase();
    XLSX.writeFile(wb, `revisao_${safe}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const flaggedFiles = useMemo(() => {
    if (!review) return new Set<string>();
    const set = new Set<string>();
    for (const d of review.duplicateChecks) set.add(d.fileB.fileName);
    return set;
  }, [review]);

  /* Pre-validation summary: aggregates everything the user must approve before any DB write */
  const validationSummary = useMemo(() => {
    if (!review) return null;
    const totalMatched = review.diffRows.reduce((s, d) => s + d.matched, 0);
    const totalMatchedAmount = review.diffRows.reduce((s, d) => s + d.matchedAmount, 0);
    const totalOrphans = review.diffRows.reduce((s, d) => s + d.orphans, 0);
    const totalOrphansAmount = review.diffRows.reduce((s, d) => s + d.orphansAmount, 0);
    const dupCount = review.duplicateChecks.length;
    const unresolvedDups = review.duplicateChecks.filter(
      (d) => !confirmedDuplicates.has(d.fileB.fileName)
    ).length;
    const bulkPlanIds = Array.from(
      new Set(
        review.uploadedFiles
          .map((f) => f.bulkPlanId)
          .filter((b): b is string => !!b)
      )
    );
    const filesIncluded = review.diffRows.length;
    const filesExcluded = review.uploadedFiles.length - filesIncluded;
    return {
      totalMatched,
      totalMatchedAmount,
      totalOrphans,
      totalOrphansAmount,
      dupCount,
      unresolvedDups,
      bulkPlanIds,
      filesIncluded,
      filesExcluded,
      hasBlockers: unresolvedDups > 0 && filesExcluded > 0,
    };
  }, [review, confirmedDuplicates]);

  const expectedConfirmText = "CONFIRMAR";
  const canConfirm = confirmText.trim().toUpperCase() === expectedConfirmText;

  const handleConfirmWrite = () => {
    setWriteUnlocked(true);
    setConfirmDialogOpen(false);
    setConfirmText("");
    toast.success("Pré-validação aprovada. Escrita desbloqueada (aguarda endpoint de importação).");
  };

  /* ─────────── Aplicar valores Unitel à BD ─────────── */
  const applyExpected = "APLICAR";
  const canApplyConfirm = applyConfirmText.trim().toUpperCase() === applyExpected;

  const applyToDb = async () => {
    if (!review) return;
    if (!canApply) {
      toast.error("Sem permissão para aplicar valores na BD.");
      return;
    }
    if (!currentReviewId) {
      toast.error("Guarde a revisão antes de aplicar.");
      return;
    }
    if (currentReviewAppliedAt) {
      toast.error("Esta revisão já foi aplicada anteriormente.");
      return;
    }

    setApplying(true);
    try {
      // 1) Reconstruir mapa fone→agricultor para a província
      setApplyProgress({ done: 0, total: 0 });
      toast.info("A carregar agricultores da província…");
      const farmers: { code: string; phone: string | null; valor_recebido: string | null }[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("farmers")
          .select("code, phone, valor_recebido")
          .eq("province", review.province)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        farmers.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const phoneToFarmer = new Map<string, { code: string; valor_recebido: string | null }>();
      const codeToFarmer = new Map<string, { valor_recebido: string | null }>();
      for (const f of farmers) {
        codeToFarmer.set(f.code, { valor_recebido: f.valor_recebido });
        const np = normalizePhone(f.phone);
        if (np) phoneToFarmer.set(np, { code: f.code, valor_recebido: f.valor_recebido });
      }

      // 2) Agregar valores por agricultor (somando todos os CSVs incluídos)
      const filesIncluded = review.uploadedFiles.filter((c) => {
        const isFlaggedDup = review.duplicateChecks.some(
          (d) => d.fileB.fileName === c.fileName && d.isDuplicate,
        );
        return !isFlaggedDup || confirmedDuplicates.has(c.fileName);
      });

      const farmerCredits = new Map<string, number>();
      const orphanAmounts = new Map<string, number>();
      let matchedAmount = 0;
      let orphanAmount = 0;

      for (const c of filesIncluded) {
        for (const r of c.successRows) {
          const match = phoneToFarmer.get(r.phone);
          if (match) {
            farmerCredits.set(match.code, (farmerCredits.get(match.code) ?? 0) + r.amount);
            matchedAmount += r.amount;
          } else {
            orphanAmounts.set(r.phone, (orphanAmounts.get(r.phone) ?? 0) + r.amount);
            orphanAmount += r.amount;
          }
        }
      }

      const farmerEntries = Array.from(farmerCredits.entries());
      setApplyProgress({ done: 0, total: farmerEntries.length });

      // 3) Atualizar valor_recebido em chunks de 50.
      // Guardamos em formato canónico EN-US "200000.00" (ver src/lib/numberFormat.ts).
      const formatPtao = (n: number): string => serializeAmount(n);

      const chunkSize = 50;
      let okCount = 0;
      let failCount = 0;
      const failed: string[] = [];

      for (let i = 0; i < farmerEntries.length; i += chunkSize) {
        const slice = farmerEntries.slice(i, i + chunkSize);
        await Promise.all(
          slice.map(async ([code, credit]) => {
            const cur = codeToFarmer.get(code);
            const currentVal = parsePtao(cur?.valor_recebido ?? "0");
            const newVal = currentVal + credit;
            const { error } = await supabase
              .from("farmers")
              .update({ valor_recebido: formatPtao(newVal) })
              .eq("code", code);
            if (error) {
              failCount += 1;
              failed.push(`${code}: ${error.message}`);
            } else {
              okCount += 1;
            }
          }),
        );
        setApplyProgress({ done: Math.min(i + chunkSize, farmerEntries.length), total: farmerEntries.length });
      }

      // 4) Inserir telefones órfãos
      let orphansInserted = 0;
      if (orphanAmounts.size > 0) {
        const orphanArray = Array.from(orphanAmounts.entries()).map(([phone, amount]) => ({
          phone,
          amount,
        }));
        const { data: orphanResult, error: orphanErr } = await (supabase.rpc as any)(
          "bulk_insert_orphan_phones",
          { _data: orphanArray },
        );
        if (orphanErr) {
          toast.warning(`Órfãos: ${orphanErr.message}`);
        } else {
          orphansInserted = (orphanResult as number) ?? orphanArray.length;
        }
      }

      // 5) Marcar revisão como aplicada
      const summary = {
        files_included: filesIncluded.map((f) => f.fileName),
        farmers_updated: okCount,
        farmers_failed: failCount,
        matched_amount: matchedAmount,
        orphans_inserted: orphansInserted,
        orphans_amount: orphanAmount,
        failed_codes: failed.slice(0, 20),
      };
      const { data: u } = await supabase.auth.getUser();
      const appliedAtIso = new Date().toISOString();
      const { error: markErr } = await supabase
        .from("province_reviews")
        .update({
          applied_at: appliedAtIso,
          applied_by: u?.user?.id ?? null,
          applied_summary: summary,
        })
        .eq("id", currentReviewId);
      if (markErr) {
        toast.warning(`Aplicado, mas falha a marcar revisão: ${markErr.message}`);
      } else {
        setCurrentReviewAppliedAt(appliedAtIso);
      }

      setApplyDialogOpen(false);
      setApplyConfirmText("");
      toast.success(
        `Aplicado: ${okCount} agricultores creditados (${fmt(matchedAmount)} Kz), ${orphansInserted} órfãos guardados${failCount > 0 ? `, ${failCount} falhas` : ""}.`,
        { duration: 10000 },
      );
    } catch (e: any) {
      toast.error(`Falha na aplicação: ${e?.message ?? e}`);
    } finally {
      setApplying(false);
      setApplyProgress({ done: 0, total: 0 });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisão por Província"
        description="Selecione uma província e gere a revisão completa: saldos por ECA, deteção de duplicados nos ficheiros Unitel e diff de telefones órfãos."
        icon={Wand2}
      />

      {/* Banner permanente: modo pré-validação */}
      <Alert className={writeUnlocked ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}>
        {writeUnlocked ? (
          <ShieldCheck className="h-4 w-4 text-success" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-warning" />
        )}
        <AlertTitle className="text-sm">
          {writeUnlocked ? "Escrita desbloqueada para esta sessão" : "Modo pré-validação — sem escrita na BD"}
        </AlertTitle>
        <AlertDescription className="text-xs">
          {writeUnlocked
            ? "Confirmação registada. Qualquer importação subsequente seguirá os parâmetros revistos abaixo."
            : "Esta tela só lê dados e gera relatórios. Nenhuma alteração é gravada nas tabelas farmers, orphan_phones ou farmer_balance_history sem confirmação explícita."}
        </AlertDescription>
      </Alert>

      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Província a revisar</Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma província" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {provinces.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Carregar CSVs Unitel (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  onChange={(e) => onCsvFiles(e.target.files)}
                />
                <Upload className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sem upload, o sistema usa apenas a tabela <code>orphan_phones</code> existente.
              </p>
            </div>
          </div>

          {uploadedCsvs.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ficheiros carregados ({uploadedCsvs.length})
              </p>
              <div className="space-y-1.5">
                {uploadedCsvs.map((c, i) => {
                  const errs = c.schema.issues.filter((x) => x.level === "error");
                  const warns = c.schema.issues.filter((x) => x.level === "warning");
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start justify-between gap-2 rounded border px-2 py-1.5 text-xs",
                        errs.length > 0
                          ? "border-destructive/40 bg-destructive/5"
                          : warns.length > 0
                            ? "border-warning/40 bg-warning/5"
                            : "border-border bg-card",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-medium">{c.fileName}</p>
                          {errs.length > 0 && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0">Schema inválido</Badge>
                          )}
                          {errs.length === 0 && warns.length > 0 && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">Avisos</Badge>
                          )}
                          {errs.length === 0 && warns.length === 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">OK</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          Bulk {c.bulkPlanId ?? "—"} • {c.successCount} success • {fmt(c.totalAmount)} Kz
                          {c.unitAmount ? ` • unit. ${fmt(c.unitAmount)}` : ""}
                        </p>
                        {(errs.length > 0 || warns.length > 0) && (
                          <ul className="mt-1 space-y-0.5">
                            {errs.map((iss, k) => (
                              <li key={`e${k}`} className="text-[11px] text-destructive">• {iss.message}</li>
                            ))}
                            {warns.map((iss, k) => (
                              <li key={`w${k}`} className="text-[11px] text-warning-foreground/80">• {iss.message}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeCsv(i)}>
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generateReview} disabled={running || !province || hasInvalidCsvs}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {running ? "A gerar…" : hasInvalidCsvs ? "Corrija os CSVs inválidos" : "Gerar revisão completa"}
            </Button>
            {review && (
              <>
                <Button variant="outline" onClick={generateReview} disabled={running}>
                  <RefreshCw className="h-4 w-4" />
                  Regerar
                </Button>
                <Button variant="outline" onClick={exportXlsx}>
                  <Download className="h-4 w-4" />
                  Exportar XLSX
                </Button>
                <Button variant="default" onClick={() => setSaveDialogOpen(true)}>
                  <Save className="h-4 w-4" />
                  Guardar revisão
                </Button>
                {canApply && (
                  <Button
                    variant="destructive"
                    onClick={() => setApplyDialogOpen(true)}
                    disabled={applying || !currentReviewId || !!currentReviewAppliedAt}
                    title={
                      !currentReviewId
                        ? "Guarde a revisão primeiro"
                        : currentReviewAppliedAt
                          ? "Esta revisão já foi aplicada"
                          : "Aplicar valores Unitel à BD"
                    }
                  >
                    {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    {currentReviewAppliedAt ? "Já aplicada" : "Aplicar valores na BD"}
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setHistoryOpen(true);
                loadHistory();
              }}
            >
              <History className="h-4 w-4" />
              Histórico
            </Button>
            {progress && <span className="text-xs text-muted-foreground">{progress}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {running && !review && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* Resultado */}
      {review && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Agricultores", value: review.farmersCount.toLocaleString("pt-AO") },
              { label: "Total Recebido", value: `${fmt(review.totalRecebido)} Kz` },
              { label: "Total Gasto", value: `${fmt(review.totalGasto)} Kz` },
              {
                label: "Saldo Final",
                value: `${fmt(review.totalSaldo)} Kz`,
                negative: review.totalSaldo < 0,
              },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className={`mt-1 text-lg font-bold tracking-tight ${k.negative ? "text-destructive" : "text-foreground"}`}>
                    {k.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Resumo de Pré-Validação + Confirmação */}
          {validationSummary && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Resumo de Pré-Validação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Bulk Plan IDs */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Bulk Plan IDs detectados ({validationSummary.bulkPlanIds.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {validationSummary.bulkPlanIds.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Nenhum CSV carregado.</span>
                    ) : (
                      validationSummary.bulkPlanIds.map((id) => (
                        <Badge key={id} variant="outline" className="font-mono text-[11px]">
                          {id}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                {/* Grelha de contadores */}
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="rounded-md border border-border bg-muted/30 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ficheiros</p>
                    <p className="mt-0.5 text-sm font-bold">
                      {validationSummary.filesIncluded} <span className="text-muted-foreground font-normal">incl.</span>
                      {validationSummary.filesExcluded > 0 && (
                        <span className="ml-1 text-warning">/ {validationSummary.filesExcluded} excl.</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Duplicados</p>
                    <p className={`mt-0.5 text-sm font-bold ${validationSummary.dupCount > 0 ? "text-warning" : "text-success"}`}>
                      {validationSummary.dupCount}
                      {validationSummary.unresolvedDups > 0 && (
                        <span className="ml-1 text-[11px] font-normal">({validationSummary.unresolvedDups} bloqueados)</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Match Agricultores</p>
                    <p className="mt-0.5 text-sm font-bold text-success">
                      {validationSummary.totalMatched.toLocaleString("pt-AO")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmt(validationSummary.totalMatchedAmount)} Kz</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Órfãos no Diff</p>
                    <p className="mt-0.5 text-sm font-bold text-warning">
                      {validationSummary.totalOrphans.toLocaleString("pt-AO")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmt(validationSummary.totalOrphansAmount)} Kz</p>
                  </div>
                </div>

                {/* Normalização de telefones */}
                {review?.phoneStats && (() => {
                  const ps = review.phoneStats;
                  const Block = ({ label, s }: { label: string; s: PhoneNormStats }) => {
                    const changedPct = s.total > 0 ? Math.round((s.changed / s.total) * 100) : 0;
                    const validPct = s.total > 0 ? Math.round((s.valid / s.total) * 100) : 0;
                    return (
                      <div className="rounded-md border border-border bg-muted/30 p-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className="mt-0.5 text-sm font-bold">
                          {s.changed.toLocaleString("pt-AO")}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">/ {s.total.toLocaleString("pt-AO")}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {changedPct}% normalizados • {validPct}% válidos
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.stripped244 > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0">+244 ×{s.stripped244}</Badge>}
                          {s.strippedLeadingZero > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0">0… ×{s.strippedLeadingZero}</Badge>}
                          {s.paddedOrTrimmed > 0 && <Badge variant="secondary" className="text-[9px] px-1 py-0">trim ×{s.paddedOrTrimmed}</Badge>}
                          {s.invalidPrefix > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0">prefixo ×{s.invalidPrefix}</Badge>}
                          {s.tooShort > 0 && <Badge variant="destructive" className="text-[9px] px-1 py-0">curto ×{s.tooShort}</Badge>}
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Normalização de telefones (244 / 0… / comprimento)
                      </p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <Block label="CSVs Unitel" s={ps.csv} />
                        <Block label="Agricultores" s={ps.farmers} />
                        <Block label="Órfãos (BD)" s={ps.orphans} />
                      </div>
                    </div>
                  );
                })()}

                {/* Veredito */}
                {validationSummary.dupCount > 0 && validationSummary.unresolvedDups > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Duplicados não resolvidos</AlertTitle>
                    <AlertDescription className="text-xs">
                      {validationSummary.unresolvedDups} ficheiro(s) ainda marcados como duplicados serão excluídos da
                      importação. Reveja a secção "Duplicados detectados" abaixo e confirme manualmente os que quer incluir.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Botão de confirmação final */}
                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs">
                    {writeUnlocked ? (
                      <span className="flex items-center gap-1.5 font-medium text-success">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Pré-validação aprovada — escrita desbloqueada
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Após rever, confirme para autorizar a importação na BD.
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => setConfirmDialogOpen(true)}
                    disabled={writeUnlocked}
                    variant={writeUnlocked ? "outline" : "default"}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {writeUnlocked ? "Confirmado" : "Confirmar e prosseguir"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicados */}
          {review.duplicateChecks.length > 0 && (() => {
            // Detetar se há mudanças entre as decisões actuais e as aplicadas no último generate
            const hasPendingChanges =
              confirmedDuplicates.size !== appliedDuplicateDecisions.size ||
              Array.from(confirmedDuplicates).some((k) => !appliedDuplicateDecisions.has(k)) ||
              Array.from(appliedDuplicateDecisions).some((k) => !confirmedDuplicates.has(k));

            // Totais agregados de risco
            const totalAtRisk = review.duplicateChecks.reduce(
              (s, d) => s + d.fileB.totalAmount,
              0,
            );
            const totalConfirmedIn = review.duplicateChecks
              .filter((d) => confirmedDuplicates.has(d.fileB.fileName))
              .reduce((s, d) => s + d.fileB.totalAmount, 0);

            return (
              <Card className="border-warning/40">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Suspeitas de duplicado ({review.duplicateChecks.length})
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Decida ficheiro a ficheiro o que entra na revisão. Por defeito, suspeitas são <b>excluídas</b>.
                      </p>
                    </div>
                    {hasPendingChanges && (
                      <Button
                        size="sm"
                        onClick={() => {
                          generateReview();
                          toast.success("A regerar com as novas decisões…");
                        }}
                        disabled={running}
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", running && "animate-spin")} />
                        Confirmar decisões e regerar
                      </Button>
                    )}
                  </div>

                  {/* Resumo de totais */}
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pares</p>
                      <p className="text-sm font-bold">{review.duplicateChecks.length}</p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Excluídos</p>
                      <p className="text-sm font-bold">
                        {review.duplicateChecks.length - confirmedDuplicates.size}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">A importar</p>
                      <p className="text-sm font-bold">{confirmedDuplicates.size}</p>
                    </div>
                    <div className="rounded-md border border-warning/40 bg-warning/5 p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kz em risco</p>
                      <p className="text-sm font-bold">{fmt(totalAtRisk - totalConfirmedIn)}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  {hasPendingChanges && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Há decisões pendentes não aplicadas. Clique em <b>"Confirmar decisões e regerar"</b> acima para refazer apenas o que muda.
                      </AlertDescription>
                    </Alert>
                  )}

                  {review.duplicateChecks.map((d, i) => {
                    const confirmed = confirmedDuplicates.has(d.fileB.fileName);
                    const wasAppliedAsExcluded = !appliedDuplicateDecisions.has(d.fileB.fileName);
                    const stateChanged = confirmed === wasAppliedAsExcluded; // mudou desde último generate
                    const overlap = d.matchingTxIds;
                    const overlapPct =
                      d.totalA > 0 ? Math.round((overlap / Math.min(d.totalA, d.totalB)) * 100) : 0;

                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          confirmed
                            ? "border-success/40 bg-success/5"
                            : "border-destructive/30 bg-destructive/5",
                          stateChanged && "ring-2 ring-primary/40",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-semibold">
                                {d.fileA.fileName} <span className="text-muted-foreground">↔</span> {d.fileB.fileName}
                              </p>
                              <Badge variant={confirmed ? "default" : "destructive"} className="text-[10px]">
                                {confirmed ? "Será importado" : "Excluído da revisão"}
                              </Badge>
                              {stateChanged && (
                                <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              <b>Motivo:</b> {d.reason}
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-1">
                            {!confirmed ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setConfirmedDuplicates((s) => new Set(s).add(d.fileB.fileName))
                                }
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Importar mesmo assim
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setConfirmedDuplicates((s) => {
                                    const n = new Set(s);
                                    n.delete(d.fileB.fileName);
                                    return n;
                                  })
                                }
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reverter (excluir)
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Resumo de totais por par */}
                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                          <div className="rounded border border-border bg-card p-1.5">
                            <p className="text-[9px] uppercase text-muted-foreground">Ficheiro A</p>
                            <p className="text-xs font-medium">{d.totalA} linhas</p>
                            <p className="text-[11px] text-muted-foreground">{fmt(d.fileA.totalAmount)} Kz</p>
                          </div>
                          <div className="rounded border border-border bg-card p-1.5">
                            <p className="text-[9px] uppercase text-muted-foreground">Ficheiro B</p>
                            <p className="text-xs font-medium">{d.totalB} linhas</p>
                            <p className="text-[11px] text-muted-foreground">{fmt(d.fileB.totalAmount)} Kz</p>
                          </div>
                          <div className="rounded border border-border bg-card p-1.5">
                            <p className="text-[9px] uppercase text-muted-foreground">Sobreposição</p>
                            <p className="text-xs font-medium">{overlap}</p>
                            <p className="text-[11px] text-muted-foreground">{overlapPct}% min(A,B)</p>
                          </div>
                          <div className="rounded border border-border bg-card p-1.5">
                            <p className="text-[9px] uppercase text-muted-foreground">Bulk Plan</p>
                            <p className="text-xs font-medium">
                              {d.fileA.bulkPlanId === d.fileB.bulkPlanId ? "Idêntico" : "Diferente"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {d.fileB.bulkPlanId ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })()}

          {/* Diff Unitel */}
          {review.diffRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Diff Unitel — Match vs Órfãos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ficheiro</TableHead>
                        <TableHead className="text-right">Linhas</TableHead>
                        <TableHead className="text-right">Match</TableHead>
                        <TableHead className="text-right">Valor Match</TableHead>
                        <TableHead className="text-right">Órfãos</TableHead>
                        <TableHead className="text-right">Valor Órfãos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {review.diffRows.map((d) => (
                        <TableRow key={d.fileName}>
                          <TableCell className="font-medium">
                            {d.fileName}
                            {flaggedFiles.has(d.fileName) && (
                              <Badge variant="outline" className="ml-2 text-[10px]">incluído (duplicado confirmado)</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{d.totalRows}</TableCell>
                          <TableCell className="text-right tabular-nums text-success">{d.matched}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(d.matchedAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums text-warning">{d.orphans}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(d.orphansAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saldos por ECA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saldos por ECA ({review.ecaRows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {review.ecaRows.length === 0 ? (
                <EmptyState icon={FileSpreadsheet} title="Sem ECAs" description="Sem agricultores nesta província." />
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ECA / Escola</TableHead>
                        <TableHead className="hidden md:table-cell">Município</TableHead>
                        <TableHead className="text-right">Nº</TableHead>
                        <TableHead className="text-right">Recebido</TableHead>
                        <TableHead className="text-right">Gasto</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {review.ecaRows.map((r) => (
                        <TableRow key={r.school}>
                          <TableCell className="font-medium">{r.school}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{r.municipality ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.n}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(r.recebido)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(r.gasto)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium ${r.saldo < 0 ? "text-destructive" : "text-success"}`}>
                            {fmt(r.saldo)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top órfãos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Top Órfãos ({review.orphanCount.toLocaleString("pt-AO")} • {fmt(review.orphanAmount)} Kz)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {review.topOrphans.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Sem órfãos" description="Não foram encontrados telefones órfãos para esta província." />
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="text-right">Valor (Kz)</TableHead>
                        <TableHead className="hidden md:table-cell">Ficheiros Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {review.topOrphans.slice(0, 50).map((o, i) => (
                        <TableRow key={`${o.phone}-${i}`}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-mono">{o.phone}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(Number(o.amount ?? 0))}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {(o.source_files ?? []).join(", ") || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {review.topOrphans.length > 50 && (
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      A mostrar 50 de {review.topOrphans.length}. Exporte XLSX para a lista completa.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog: Aplicar valores Unitel à BD */}
      <AlertDialog open={applyDialogOpen} onOpenChange={(open) => { if (!applying) setApplyDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-destructive" />
              Aplicar valores Unitel na BD
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Esta ação é <strong>irreversível</strong>. Vai somar os valores dos CSVs incluídos ao
                  <code className="mx-1 font-mono text-xs">valor_recebido</code>
                  de cada agricultor correspondente em <strong>{review?.province}</strong>, e gravar telefones sem match
                  como órfãos.
                </p>
                {validationSummary && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
                    <p>• Agricultores a creditar: <b>{validationSummary.totalMatched}</b> ({fmt(validationSummary.totalMatchedAmount)} Kz)</p>
                    <p>• Telefones órfãos a guardar: <b>{validationSummary.totalOrphans}</b> ({fmt(validationSummary.totalOrphansAmount)} Kz)</p>
                    <p>• Ficheiros incluídos: {validationSummary.filesIncluded}{validationSummary.filesExcluded > 0 ? ` (${validationSummary.filesExcluded} excluídos como duplicados)` : ""}</p>
                  </div>
                )}
                {applying && applyProgress.total > 0 && (
                  <div className="space-y-1">
                    <Progress value={(applyProgress.done / applyProgress.total) * 100} />
                    <p className="text-[11px] text-muted-foreground text-center">
                      {applyProgress.done} / {applyProgress.total} agricultores
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="apply-input" className="text-xs">
                    Escreva <strong className="font-mono">{applyExpected}</strong> para confirmar:
                  </Label>
                  <Input
                    id="apply-input"
                    value={applyConfirmText}
                    onChange={(e) => setApplyConfirmText(e.target.value)}
                    placeholder={applyExpected}
                    autoComplete="off"
                    disabled={applying}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying} onClick={() => setApplyConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); applyToDb(); }}
              disabled={!canApplyConfirm || applying}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Aplicar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
              Confirmar importação na BD
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Está prestes a autorizar a escrita destes dados nas tabelas{" "}
                  <code className="font-mono text-xs">farmers</code>,{" "}
                  <code className="font-mono text-xs">orphan_phones</code> e{" "}
                  <code className="font-mono text-xs">farmer_balance_history</code> para a província{" "}
                  <strong>{review?.province ?? "—"}</strong>.
                </p>
                {validationSummary && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                    <ul className="space-y-1">
                      <li>• Bulk Plan IDs: {validationSummary.bulkPlanIds.join(", ") || "—"}</li>
                      <li>• Ficheiros incluídos: {validationSummary.filesIncluded}</li>
                      {validationSummary.filesExcluded > 0 && (
                        <li className="text-warning">
                          • Ficheiros excluídos (duplicados): {validationSummary.filesExcluded}
                        </li>
                      )}
                      <li>
                        • Match: {validationSummary.totalMatched} agricultores ({fmt(validationSummary.totalMatchedAmount)} Kz)
                      </li>
                      <li>
                        • Órfãos: {validationSummary.totalOrphans} telefones ({fmt(validationSummary.totalOrphansAmount)} Kz)
                      </li>
                    </ul>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-input" className="text-xs">
                    Escreva <strong className="font-mono">{expectedConfirmText}</strong> para autorizar:
                  </Label>
                  <Input
                    id="confirm-input"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={expectedConfirmText}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmWrite} disabled={!canConfirm}>
              Autorizar escrita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save review dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar revisão no histórico</DialogTitle>
            <DialogDescription>
              Vai guardar uma cópia completa desta revisão (incluindo decisões de duplicados, métricas e dados detalhados) para poder reabrir mais tarde sem recalcular.
            </DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
                <p><b>Província:</b> {review.province}</p>
                <p><b>Agricultores:</b> {review.farmersCount}</p>
                <p><b>CSVs:</b> {review.uploadedFiles.length} ficheiros</p>
                <p><b>Matches:</b> {review.diffRows.length} • <b>Órfãos:</b> {review.orphanCount} ({fmt(review.orphanAmount)} Kz)</p>
                <p><b>Duplicados:</b> {review.duplicateChecks.length} pares ({confirmedDuplicates.size} a importar)</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="save-notes">Notas (opcional)</Label>
                <Textarea
                  id="save-notes"
                  placeholder="Ex.: Revisão final antes da importação de Janeiro 2026"
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveReview} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de revisões
            </DialogTitle>
            <DialogDescription>
              Reabra qualquer revisão anteriormente guardada sem recalcular. Mostra as 100 mais recentes.
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={History}
              title="Sem revisões guardadas"
              description="Gere uma revisão e clique em 'Guardar revisão' para começar o histórico."
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Província</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Por</TableHead>
                    <TableHead className="text-right">Agricultores</TableHead>
                    <TableHead className="text-right">Matches</TableHead>
                    <TableHead className="text-right">Órfãos</TableHead>
                    <TableHead className="text-right">Kz órfãos</TableHead>
                    <TableHead className="text-right">Tel. norm.</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.province}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(row.generated_at).toLocaleString("pt-PT")}
                        {row.notes && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={row.notes}>
                            {row.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{row.generated_by_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{row.total_farmers}</TableCell>
                      <TableCell className="text-right">{row.matched_count}</TableCell>
                      <TableCell className="text-right">{row.orphan_count}</TableCell>
                      <TableCell className="text-right text-xs">{fmt(Number(row.total_orphan_amount ?? 0))}</TableCell>
                      <TableCell className="text-right">{row.phones_normalized}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => reopenFromHistory(row)}>
                            <PlayCircle className="h-3.5 w-3.5" />
                            Reabrir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteHistoryRow(row.id)}
                            title="Remover do histórico"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={loadHistory} disabled={historyLoading}>
              <RefreshCw className={cn("h-4 w-4", historyLoading && "animate-spin")} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RevisaoProvincias;
