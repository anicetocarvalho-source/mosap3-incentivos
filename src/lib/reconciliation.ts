/**
 * Helpers para reconciliação do dataset MOSAP3 (export Unitel) com a BD `farmers`.
 * Lê uma folha "Detalhe" com colunas:
 *   MSISDN, NAME, TRUST LEVEL, STATUS, PRODUCT_NAME, PROVINCE, REGION,
 *   SALDO_DISPONIVEL_EMONEY, SALDO_DISPONIVEL_MOSAP, Nome_Cliente, Estado_Numero
 */

export interface ExcelFarmerRow {
  msisdn: string;
  name: string;
  trustLevel: number | null;
  status: string;
  product: string;
  province: string;
  region: string;
  saldoEmoney: number;
  saldoMosap: number;
  estadoNumero: string;
}

export interface DbFarmerRow {
  code: string;
  full_name: string;
  phone: string | null;
  province: string | null;
  municipality: string | null;
  status: string;
  saldo_final: string | null;
  sim_status?: string | null;
}

export const SIM_STATUSES = ["Activo", "Removido", "Barrado", "Pré desactivado", "Desconhecido"] as const;
export type SimStatus = typeof SIM_STATUSES[number];

export const normalizeSimStatus = (raw?: string | null): SimStatus => {
  if (!raw) return "Desconhecido";
  const v = String(raw).trim();
  const lower = v.toLowerCase();
  if (lower === "activo" || lower === "ativo") return "Activo";
  if (lower === "removido") return "Removido";
  if (lower === "barrado") return "Barrado";
  if (lower.startsWith("pré") || lower.startsWith("pre")) return "Pré desactivado";
  return "Desconhecido";
};

const PROVINCE_MAP: Record<string, string> = {
  BENGUELA: "Benguela",
  HUILA: "Huila",
  HUÍLA: "Huila",
  NAMIBE: "Namibe",
  "KUANDO KUBANGO": "Cuando Cubango",
  "CUANDO CUBANGO": "Cuando Cubango",
  CUNENE: "Cunene",
  BENGO: "Bengo",
  LUANDA: "Luanda",
};

const MUNICIPALITY_MAP: Record<string, string> = {
  "Cuanhama (Kwanhama)": "Cuanhama",
  "Cuito Cuanavale (Kuito Kuanavale)": "Cuito Cuanavale",
  Menogue: "Menongue", // erro tipográfico observado na BD
};

export const normalizeProvince = (raw?: string | null): string => {
  if (!raw) return "";
  const key = String(raw).trim().toUpperCase();
  return PROVINCE_MAP[key] ?? toTitle(String(raw).trim());
};

export const normalizeMunicipality = (raw?: string | null): string => {
  if (!raw) return "";
  const v = String(raw).trim();
  if (MUNICIPALITY_MAP[v]) return MUNICIPALITY_MAP[v];
  // remove parênteses tipo "Foo (Bar)"
  const cleaned = v.replace(/\s*\(.*\)\s*$/, "").trim();
  return toTitle(cleaned);
};

const PRESERVE = new Set(["da", "de", "do", "das", "dos", "e"]);
export const normalizeName = (raw?: string | null): string => {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && PRESERVE.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
};

const toTitle = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

export const parseSaldoToNumber = (v: string | null | undefined): number => {
  if (v == null) return 0;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export const formatSaldoBR = (n: number): string =>
  n.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type MissingField =
  | "MSISDN"
  | "NAME"
  | "PROVINCE"
  | "REGION"
  | "SALDO_DISPONIVEL_MOSAP"
  | "SALDO_DISPONIVEL_EMONEY";

export interface InvalidRow {
  rowNumber: number; // 1-based, including header offset
  msisdn: string;
  name: string;
  province: string;
  region: string;
  missing: MissingField[];
  blocking: boolean; // true se faltar MSISDN (linha descartada)
}

export interface ParsedSheet {
  rows: ExcelFarmerRow[];
  headerErrors: string[];
  invalidRows: InvalidRow[];
  duplicateMsisdns: string[];
  totalRaw: number;
  missingByField: Record<MissingField, number>;
}

const REQUIRED_HEADERS = [
  "MSISDN",
  "NAME",
  "PROVINCE",
  "REGION",
  "SALDO_DISPONIVEL_MOSAP",
  "Estado_Numero",
];

const MSISDN_RE = /^\+?\d{6,15}$/;

const isBlank = (v: any) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

const isNumericPresent = (v: any) => {
  if (isBlank(v)) return false;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n);
};

export function parseSheet(rawRows: any[]): ParsedSheet {
  const empty = {
    MSISDN: 0, NAME: 0, PROVINCE: 0, REGION: 0,
    SALDO_DISPONIVEL_MOSAP: 0, SALDO_DISPONIVEL_EMONEY: 0,
  } as Record<MissingField, number>;
  if (!rawRows.length) {
    return { rows: [], headerErrors: ["Folha vazia"], invalidRows: [], duplicateMsisdns: [], totalRaw: 0, missingByField: empty };
  }
  const sample = rawRows[0];
  const headers = Object.keys(sample);
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    return { rows: [], headerErrors: [`Faltam colunas: ${missing.join(", ")}`], invalidRows: [], duplicateMsisdns: [], totalRaw: rawRows.length, missingByField: empty };
  }

  const invalidRows: InvalidRow[] = [];
  const missingByField: Record<MissingField, number> = { ...empty };
  const seen = new Map<string, number>();
  const duplicates = new Set<string>();
  const validRows: ExcelFarmerRow[] = [];

  rawRows.forEach((r, idx) => {
    const rowNumber = idx + 2; // +1 header, +1 1-based
    const msisdnRaw = isBlank(r.MSISDN) ? "" : String(r.MSISDN).trim();
    const fieldsMissing: MissingField[] = [];

    if (!msisdnRaw || !MSISDN_RE.test(msisdnRaw)) {
      fieldsMissing.push("MSISDN");
      missingByField.MSISDN++;
    }
    if (isBlank(r.NAME)) { fieldsMissing.push("NAME"); missingByField.NAME++; }
    if (isBlank(r.PROVINCE)) { fieldsMissing.push("PROVINCE"); missingByField.PROVINCE++; }
    if (isBlank(r.REGION)) { fieldsMissing.push("REGION"); missingByField.REGION++; }
    if (!isNumericPresent(r.SALDO_DISPONIVEL_MOSAP)) {
      fieldsMissing.push("SALDO_DISPONIVEL_MOSAP"); missingByField.SALDO_DISPONIVEL_MOSAP++;
    }
    if (!isNumericPresent(r.SALDO_DISPONIVEL_EMONEY)) {
      fieldsMissing.push("SALDO_DISPONIVEL_EMONEY"); missingByField.SALDO_DISPONIVEL_EMONEY++;
    }

    const blocking = fieldsMissing.includes("MSISDN");
    if (fieldsMissing.length) {
      invalidRows.push({
        rowNumber,
        msisdn: msisdnRaw,
        name: String(r.NAME ?? "").trim(),
        province: String(r.PROVINCE ?? "").trim(),
        region: String(r.REGION ?? "").trim(),
        missing: fieldsMissing,
        blocking,
      });
    }
    if (blocking) return;

    if (seen.has(msisdnRaw)) {
      duplicates.add(msisdnRaw);
    } else {
      seen.set(msisdnRaw, rowNumber);
    }

    validRows.push({
      msisdn: msisdnRaw,
      name: String(r.NAME ?? "").trim(),
      trustLevel: r["TRUST LEVEL"] != null ? Number(r["TRUST LEVEL"]) : null,
      status: String(r.STATUS ?? "").trim(),
      product: String(r.PRODUCT_NAME ?? "").trim(),
      province: String(r.PROVINCE ?? "").trim(),
      region: String(r.REGION ?? "").trim(),
      saldoEmoney: Number(r.SALDO_DISPONIVEL_EMONEY ?? 0) || 0,
      saldoMosap: Number(r.SALDO_DISPONIVEL_MOSAP ?? 0) || 0,
      estadoNumero: String(r.Estado_Numero ?? "").trim(),
    });
  });

  return {
    rows: validRows,
    headerErrors: [],
    invalidRows,
    duplicateMsisdns: Array.from(duplicates),
    totalRaw: rawRows.length,
    missingByField,
  };
}

export interface FarmerDiff {
  phone: string;
  dbCode: string;
  field: "full_name" | "province" | "municipality" | "saldo_final" | "sim_status";
  current: string;
  proposed: string;
}

export function computeDiffs(db: DbFarmerRow[], xl: ExcelFarmerRow[]) {
  const xlByPhone = new Map(xl.map((r) => [r.msisdn, r]));
  const dbByPhone = new Map(db.map((r) => [String(r.phone || ""), r]));

  const newFarmers: ExcelFarmerRow[] = [];
  const toRemove: { db: DbFarmerRow; xl: ExcelFarmerRow }[] = [];
  const nameDiffs: FarmerDiff[] = [];
  const provinceDiffs: FarmerDiff[] = [];
  const municipalityDiffs: FarmerDiff[] = [];
  const saldoDiffs: FarmerDiff[] = [];
  const simStatusDiffs: FarmerDiff[] = [];

  for (const x of xl) {
    const d = dbByPhone.get(x.msisdn);
    if (!d) {
      newFarmers.push(x);
      continue;
    }
    if (x.estadoNumero === "Removido" && d.status !== "Removido") {
      toRemove.push({ db: d, xl: x });
    }
    const propName = normalizeName(x.name);
    if (propName && d.full_name && propName.toLowerCase() !== d.full_name.trim().toLowerCase()) {
      nameDiffs.push({ phone: x.msisdn, dbCode: d.code, field: "full_name", current: d.full_name, proposed: propName });
    }
    const propProv = normalizeProvince(x.province);
    if (propProv && (d.province || "").trim() !== propProv) {
      provinceDiffs.push({ phone: x.msisdn, dbCode: d.code, field: "province", current: d.province || "", proposed: propProv });
    }
    const propMun = normalizeMunicipality(x.region);
    if (propMun && (d.municipality || "").trim() !== propMun) {
      municipalityDiffs.push({ phone: x.msisdn, dbCode: d.code, field: "municipality", current: d.municipality || "", proposed: propMun });
    }
    const dbSaldo = parseSaldoToNumber(d.saldo_final);
    if (Math.abs(dbSaldo - x.saldoMosap) > 0.5) {
      saldoDiffs.push({
        phone: x.msisdn,
        dbCode: d.code,
        field: "saldo_final",
        current: formatSaldoBR(dbSaldo),
        proposed: formatSaldoBR(x.saldoMosap),
      });
    }
  }

  return {
    matched: xl.length - newFarmers.length,
    newFarmers,
    toRemove,
    nameDiffs,
    provinceDiffs,
    municipalityDiffs,
    saldoDiffs,
    onlyDbCount: db.filter((d) => !xlByPhone.has(String(d.phone || ""))).length,
  };
}

export const generateFarmerCode = (index: number) => {
  const ts = Date.now().toString(36).toUpperCase();
  return `AGR-${ts}-${String(index + 1).padStart(4, "0")}`;
};
