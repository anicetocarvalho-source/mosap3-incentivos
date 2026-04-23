import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";

/* ───────────────────────── helpers ───────────────────────── */

const parsePtao = (s: string | number | null | undefined): number => {
  if (s === null || s === undefined) return 0;
  if (typeof s === "number") return isNaN(s) ? 0 : s;
  const str = s.toString().trim().replace(/[^0-9.,-]/g, "");
  if (!str) return 0;
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  let normalized = str;
  if (lastComma > lastDot) normalized = str.replace(/\./g, "").replace(",", ".");
  else if (lastDot > -1 && lastComma === -1) {
    const parts = str.split(".");
    if (parts.length > 2 && parts.slice(1).every((p) => p.length === 3)) normalized = parts.join("");
  }
  const n = Number(normalized);
  return isNaN(n) ? 0 : n;
};

const fmt = (n: number) =>
  n.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
};

const analyzeCsv = (fileName: string, rows: CsvRow[]): ParsedCsv => {
  const sample = rows[0] ?? {};
  const phoneCol = findCol(sample, ["Credit Msisdn", "Msisdn", "Phone", "Telefone"]);
  const amountCol = findCol(sample, ["Amount", "Valor", "Credit Amount"]);
  const statusCol = findCol(sample, ["Status", "Estado", "Result"]);
  const txCol = findCol(sample, ["TransactionID", "Transaction Id", "Trx", "Reference"]);
  const bulkCol = findCol(sample, ["Bulk Plan ID", "BulkPlanId", "Plan ID"]);
  const planNameCol = findCol(sample, ["Plan Name", "Bulk Plan Name", "Description"]);

  const successRows: ParsedCsv["successRows"] = [];
  let totalAmount = 0;
  let bulkPlanId: string | null = null;
  let planName: string | null = null;
  const amountSet = new Set<number>();
  const phoneStats = emptyPhoneStats();

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
  const [provinces, setProvinces] = useState<string[]>([]);
  const [province, setProvince] = useState<string>("Cuando Cubango");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [review, setReview] = useState<FullReview | null>(null);
  const [uploadedCsvs, setUploadedCsvs] = useState<ParsedCsv[]>([]);
  const [confirmedDuplicates, setConfirmedDuplicates] = useState<Set<string>>(new Set());
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [writeUnlocked, setWriteUnlocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    toast.success(`${parsed.length} ficheiro(s) carregado(s)`);
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
  const generateReview = async () => {
    if (!province) return;
    setRunning(true);
    setReview(null);
    setWriteUnlocked(false);
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
                {uploadedCsvs.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.fileName}</p>
                      <p className="text-muted-foreground">
                        Bulk {c.bulkPlanId ?? "—"} • {c.successCount} success • {fmt(c.totalAmount)} Kz
                        {c.unitAmount ? ` • unit. ${fmt(c.unitAmount)}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeCsv(i)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={generateReview} disabled={running || !province}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {running ? "A gerar…" : "Gerar revisão completa"}
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
              </>
            )}
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
          {review.duplicateChecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Duplicados detectados ({review.duplicateChecks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {review.duplicateChecks.map((d, i) => {
                  const confirmed = confirmedDuplicates.has(d.fileB.fileName);
                  return (
                    <Alert key={i} variant={confirmed ? "default" : "destructive"}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="flex items-center gap-2">
                        {d.fileA.fileName} ↔ {d.fileB.fileName}
                        <Badge variant={confirmed ? "default" : "destructive"}>
                          {confirmed ? "Confirmado p/ importação" : "Excluído da revisão"}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p className="text-xs">{d.reason}</p>
                        <p className="text-xs">
                          A: {d.totalA} linhas, {fmt(d.fileA.totalAmount)} Kz • B: {d.totalB} linhas, {fmt(d.fileB.totalAmount)} Kz
                        </p>
                        <div className="flex gap-2 pt-1">
                          {!confirmed ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setConfirmedDuplicates((s) => new Set(s).add(d.fileB.fileName));
                                toast.message(`${d.fileB.fileName} marcado para incluir. Clique 'Regerar' para refazer o diff.`);
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Importar mesmo assim
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setConfirmedDuplicates((s) => {
                                  const n = new Set(s);
                                  n.delete(d.fileB.fileName);
                                  return n;
                                });
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reverter
                            </Button>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  );
                })}
              </CardContent>
            </Card>
          )}

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

      {/* Dialog de confirmação final */}
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
    </div>
  );
};

export default RevisaoProvincias;
