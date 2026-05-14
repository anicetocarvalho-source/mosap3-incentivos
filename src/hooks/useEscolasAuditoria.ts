import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { normalizeName, levenshtein } from "@/lib/stringSimilarity";

export type DuplicateRow = {
  schoolId: string;
  name: string;
  province: string;
  municipality: string;
  village: string | null;
  real: number;
  cached: number;
  delta: number;
  ok: boolean;
};

export type SimilarPair = {
  a: { id: string; name: string; province: string; municipality: string; farmers: number };
  b: { id: string; name: string; province: string; municipality: string; farmers: number };
  distance: number;
  reason: "levenshtein" | "containment" | "normalized_equal";
};

export type OrphanRow = {
  schoolName: string;
  orphanCount: number;
  examples: { code: string; name: string; province: string; municipality: string }[];
};

export type AuditoriaResult = {
  duplicates: DuplicateRow[];
  similar: SimilarPair[];
  orphans: OrphanRow[];
  totals: {
    schools: number;
    duplicateNames: number;
    duplicateRows: number;
    discrepant: number;
    similarPairs: number;
    orphans: number;
  };
  perf: PerfMetrics;
};

export type PerfPhase =
  | "fetch"
  | "indexFarmers"
  | "normalizeSchools"
  | "duplicates"
  | "similar"
  | "orphans"
  | "total";

export type PerfMetrics = {
  startedAt: string; // ISO
  phases: Record<PerfPhase, number>; // ms
  rows: { schools: number; provinces: number; municipalities: number; farmers: number };
  memory: {
    supported: boolean;
    usedJSHeapMB?: number; // after run
    deltaJSHeapMB?: number; // after - before
    totalJSHeapMB?: number;
    jsHeapLimitMB?: number;
  };
};

export type PerfHistoryEntry = PerfMetrics;

const PERF_HISTORY_KEY = "escolas_auditoria_perf_history_v1";
const PERF_HISTORY_MAX = 20;

export function readAuditoriaPerfHistory(): PerfHistoryEntry[] {
  try {
    const raw = localStorage.getItem(PERF_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function clearAuditoriaPerfHistory() {
  try {
    localStorage.removeItem(PERF_HISTORY_KEY);
  } catch {
    /* noop */
  }
}

function pushPerfHistory(entry: PerfHistoryEntry) {
  try {
    const list = readAuditoriaPerfHistory();
    list.push(entry);
    while (list.length > PERF_HISTORY_MAX) list.shift();
    localStorage.setItem(PERF_HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

const toMB = (b: number) => Math.round((b / (1024 * 1024)) * 100) / 100;
function readMemory(): { used: number; total: number; limit: number } | null {
  const m = (performance as any).memory;
  if (!m || typeof m.usedJSHeapSize !== "number") return null;
  return { used: m.usedJSHeapSize, total: m.totalJSHeapSize, limit: m.jsHeapSizeLimit };
}

const KEY_SEP = "\u0001";

export type AuditoriaProgress = {
  phase: "idle" | "fetch" | "indexFarmers" | "normalizeSchools" | "duplicates" | "similar" | "orphans" | "done";
  label: string;
  pct: number; // 0..100
};

const PHASE_WEIGHTS: Record<AuditoriaProgress["phase"], number> = {
  idle: 0,
  fetch: 25,
  indexFarmers: 15,
  normalizeSchools: 5,
  duplicates: 10,
  similar: 30,
  orphans: 15,
  done: 0,
};

const PHASE_LABELS_HOOK: Record<AuditoriaProgress["phase"], string> = {
  idle: "A iniciar…",
  fetch: "A carregar dados…",
  indexFarmers: "A indexar produtores…",
  normalizeSchools: "A normalizar escolas…",
  duplicates: "A calcular duplicados…",
  similar: "A detectar nomes similares…",
  orphans: "A identificar produtores órfãos…",
  done: "Concluído",
};

const yieldUI = () => new Promise<void>((r) => setTimeout(r, 0));

// ── Persistent cache (localStorage) ───────────────────────────────────────────
const CACHE_KEY = "escolas_auditoria_cache_v1";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min (matches PWA convention)

type CacheSignature = { schools: number; farmers: number; provinces: number; municipalities: number };
type CacheEnvelope = { savedAt: number; signature: CacheSignature; result: AuditoriaResult };

function readCache(): CacheEnvelope | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope;
    if (!env || typeof env.savedAt !== "number" || !env.result) return null;
    return env;
  } catch {
    return null;
  }
}

function writeCache(env: CacheEnvelope) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(env));
  } catch (e) {
    // Quota exceeded etc. — drop silently, audit still works in-memory
    console.warn("[useEscolasAuditoria] cache write failed", e);
  }
}

export function clearAuditoriaCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* noop */
  }
}

async function fetchSignature(): Promise<CacheSignature> {
  const head = (table: "schools" | "farmers" | "provinces" | "municipalities", filter?: (q: any) => any) => {
    let q: any = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    return q.then((r: any) => r.count ?? 0);
  };
  const [schools, farmers, provinces, municipalities] = await Promise.all([
    head("schools"),
    head("farmers", (q) => q.neq("status", "Removido")),
    head("provinces"),
    head("municipalities"),
  ]);
  return { schools, farmers, provinces, municipalities };
}

const sigEq = (a: CacheSignature, b: CacheSignature) =>
  a.schools === b.schools && a.farmers === b.farmers && a.provinces === b.provinces && a.municipalities === b.municipalities;

export type CacheInfo = { fromCache: boolean; savedAt: number | null; ageMs: number | null };

export function useEscolasAuditoria() {
  const [data, setData] = useState<AuditoriaResult | null>(null);
  const [progress, setProgress] = useState<AuditoriaProgress>({ phase: "idle", label: PHASE_LABELS_HOOK.idle, pct: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({ fromCache: false, savedAt: null, ageMs: null });

  const run = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    setLoading(true);
    setError(null);

    // Try persistent cache first (unless forced)
    if (!force) {
      const env = readCache();
      if (env && Date.now() - env.savedAt < CACHE_TTL_MS) {
        try {
          const liveSig = await fetchSignature();
          if (sigEq(liveSig, env.signature)) {
            setData(env.result);
            setProgress({ phase: "done", label: PHASE_LABELS_HOOK.done, pct: 100 });
            setCacheInfo({ fromCache: true, savedAt: env.savedAt, ageMs: Date.now() - env.savedAt });
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[useEscolasAuditoria] signature check failed, running full audit", e);
        }
      }
    }
    setCacheInfo({ fromCache: false, savedAt: null, ageMs: null });
    const tStart = performance.now();
    const memBefore = readMemory();
    const startedAt = new Date().toISOString();
    const phases: Partial<Record<PerfPhase, number>> = {};
    let tMark = tStart;
    const mark = (phase: PerfPhase) => {
      const now = performance.now();
      phases[phase] = Math.round((now - tMark) * 100) / 100;
      tMark = now;
    };
    let cumulative = 0;
    const advance = async (phase: AuditoriaProgress["phase"]) => {
      setProgress({ phase, label: PHASE_LABELS_HOOK[phase], pct: cumulative });
      await yieldUI();
    };
    const completePhase = (phase: AuditoriaProgress["phase"]) => {
      cumulative = Math.min(100, cumulative + PHASE_WEIGHTS[phase]);
    };
    setData(null);
    try {
      await advance("fetch");
      const [schools, provinces, municipalities, farmers] = await Promise.all([
        fetchAllPages<any>(() =>
          supabase.from("schools").select("id,name,province_id,municipality_id,village,total_farmers", { count: "exact" })
        ),
        fetchAllPages<any>(() => supabase.from("provinces").select("id,name", { count: "exact" })),
        fetchAllPages<any>(() => supabase.from("municipalities").select("id,name", { count: "exact" })),
        fetchAllPages<any>(() =>
          supabase
            .from("farmers")
            .select("code,full_name,school,province,municipality,status", { count: "exact" })
            .neq("status", "Removido")
        ),
      ]);
      mark("fetch");
      completePhase("fetch");
      await advance("indexFarmers");

      const provMap = new Map<string, string>(provinces.map((p) => [p.id, p.name as string]));
      const munMap = new Map<string, string>(municipalities.map((m) => [m.id, m.name as string]));

      // ── Single pass over farmers: build (school|prov|mun) -> count and (school) -> list of indices
      // We avoid materializing a normalized parallel array; we keep only what's needed.
      const triKey = (s: string, p: string, m: string) => s + KEY_SEP + p + KEY_SEP + m;
      const tripletCount = new Map<string, number>(); // school|prov|mun -> count
      const farmersBySchool = new Map<string, number[]>(); // schoolNorm -> indices into `farmers`
      const farmerNormProv: string[] = new Array(farmers.length);
      const farmerNormMun: string[] = new Array(farmers.length);

      for (let i = 0; i < farmers.length; i++) {
        const f = farmers[i];
        const sN = normalizeName(f.school);
        if (!sN) continue;
        const pN = normalizeName(f.province);
        const mN = normalizeName(f.municipality);
        farmerNormProv[i] = pN;
        farmerNormMun[i] = mN;
        const k = triKey(sN, pN, mN);
        tripletCount.set(k, (tripletCount.get(k) || 0) + 1);
        const arr = farmersBySchool.get(sN);
        if (arr) arr.push(i);
        else farmersBySchool.set(sN, [i]);
      }
      mark("indexFarmers");
      completePhase("indexFarmers");
      await advance("normalizeSchools");

      // ── Pre-normalize schools & group by normalized name
      type SchoolNorm = {
        s: any;
        nameN: string;
        provName: string;
        munName: string;
        provN: string;
        munN: string;
      };
      const schoolsN: SchoolNorm[] = schools.map((s) => {
        const provName = provMap.get(s.province_id) || "";
        const munName = munMap.get(s.municipality_id) || "";
        return {
          s,
          nameN: normalizeName(s.name),
          provName,
          munName,
          provN: normalizeName(provName),
          munN: normalizeName(munName),
        };
      });

      const byName = new Map<string, SchoolNorm[]>();
      for (const sn of schoolsN) {
        if (!sn.nameN) continue;
        const arr = byName.get(sn.nameN);
        if (arr) arr.push(sn);
        else byName.set(sn.nameN, [sn]);
      }
      mark("normalizeSchools");

      // Helper for any school's real farmer count using triplet map (with fallback when prov/mun empty)
      const realCount = (sn: SchoolNorm): number => {
        if (sn.provN && sn.munN) return tripletCount.get(triKey(sn.nameN, sn.provN, sn.munN)) || 0;
        // Fallback: scan only farmers of this school name (rare path)
        const idxs = farmersBySchool.get(sn.nameN);
        if (!idxs) return 0;
        let c = 0;
        for (const i of idxs) {
          if (sn.provN && farmerNormProv[i] !== sn.provN) continue;
          if (sn.munN && farmerNormMun[i] !== sn.munN) continue;
          c++;
        }
        return c;
      };

      // ── Tab A: exact duplicates
      const duplicates: DuplicateRow[] = [];
      for (const group of byName.values()) {
        if (group.length < 2) continue;
        for (const sn of group) {
          const real = realCount(sn);
          const cached = sn.s.total_farmers || 0;
          duplicates.push({
            schoolId: sn.s.id,
            name: sn.s.name,
            province: sn.provName,
            municipality: sn.munName,
            village: sn.s.village,
            real,
            cached,
            delta: real - cached,
            ok: real === cached,
          });
        }
      }
      duplicates.sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.province.localeCompare(b.province) ||
          a.municipality.localeCompare(b.municipality)
      );
      mark("duplicates");
      completePhase("duplicates");

      const makePartialPerf = (): PerfMetrics => ({
        startedAt,
        phases: {
          fetch: phases.fetch || 0,
          indexFarmers: phases.indexFarmers || 0,
          normalizeSchools: phases.normalizeSchools || 0,
          duplicates: phases.duplicates || 0,
          similar: phases.similar || 0,
          orphans: phases.orphans || 0,
          total: Math.round((performance.now() - tStart) * 100) / 100,
        },
        rows: {
          schools: schools.length,
          provinces: provinces.length,
          municipalities: municipalities.length,
          farmers: farmers.length,
        },
        memory: { supported: false },
      });

      const partialDupNames = [...byName.values()].reduce((n, g) => n + (g.length > 1 ? 1 : 0), 0);
      setData({
        duplicates,
        similar: [],
        orphans: [],
        totals: {
          schools: schools.length,
          duplicateNames: partialDupNames,
          duplicateRows: duplicates.length,
          discrepant: duplicates.reduce((n, d) => n + (d.ok ? 0 : 1), 0),
          similarPairs: 0,
          orphans: 0,
        },
        perf: makePartialPerf(),
      });
      await advance("similar");

      // Cache farmer counts per school id (used by similar tab)
      const countById = new Map<string, number>();
      for (const sn of schoolsN) countById.set(sn.s.id, realCount(sn));

      // ── Tab B: similar names — bucket by length to avoid O(N²) full scan
      const uniqueNames = [...byName.keys()];
      uniqueNames.sort();
      const byLen = new Map<number, string[]>();
      for (const n of uniqueNames) {
        const arr = byLen.get(n.length);
        if (arr) arr.push(n);
        else byLen.set(n.length, [n]);
      }

      const similar: SimilarPair[] = [];
      const seenPair = new Set<string>();

      const buildPairs = (xName: string, yName: string, reason: SimilarPair["reason"], distance: number) => {
        const groupX = byName.get(xName)!;
        const groupY = byName.get(yName)!;
        for (const sa of groupX) {
          for (const sb of groupY) {
            const k = sa.s.id < sb.s.id ? sa.s.id + "|" + sb.s.id : sb.s.id + "|" + sa.s.id;
            if (seenPair.has(k)) continue;
            seenPair.add(k);
            similar.push({
              a: {
                id: sa.s.id,
                name: sa.s.name,
                province: sa.provName,
                municipality: sa.munName,
                farmers: countById.get(sa.s.id) || 0,
              },
              b: {
                id: sb.s.id,
                name: sb.s.name,
                province: sb.provName,
                municipality: sb.munName,
                farmers: countById.get(sb.s.id) || 0,
              },
              distance,
              reason,
            });
          }
        }
      };

      // Levenshtein ≤ 2 → only compare names with |len diff| ≤ 2
      for (const [len, names] of byLen) {
        for (const otherLen of [len, len + 1, len + 2]) {
          const others = byLen.get(otherLen);
          if (!others) continue;
          const sameBucket = otherLen === len;
          for (let i = 0; i < names.length; i++) {
            const x = names[i];
            const startJ = sameBucket ? i + 1 : 0;
            for (let j = startJ; j < others.length; j++) {
              const y = others[j];
              if (x === y) continue;
              const d = levenshtein(x, y);
              if (d > 0 && d <= 2) buildPairs(x, y, "levenshtein", d);
            }
          }
        }
      }

      // Containment: shorter name ⊂ longer name (only when not already similar)
      // Use a sorted-by-length list to compare each shorter name against longer ones.
      const namesByLen = uniqueNames.slice().sort((a, b) => a.length - b.length);
      for (let i = 0; i < namesByLen.length; i++) {
        const x = namesByLen[i];
        if (x.length < 4) continue;
        for (let j = i + 1; j < namesByLen.length; j++) {
          const y = namesByLen[j];
          if (y.length - x.length > 8) break;
          if (y.length === x.length) continue;
          if (y.includes(x)) buildPairs(x, y, "containment", y.length - x.length);
        }
      }

      similar.sort((a, b) => a.distance - b.distance || a.a.name.localeCompare(b.a.name));
      mark("similar");
      completePhase("similar");
      setData((prev) =>
        prev
          ? {
              ...prev,
              similar,
              totals: { ...prev.totals, similarPairs: similar.length },
              perf: makePartialPerf(),
            }
          : prev
      );
      await advance("orphans");

      // ── Tab C: orphans — single pass per school name using the index built earlier
      const orphans: OrphanRow[] = [];
      for (const [key, group] of byName) {
        const idxs = farmersBySchool.get(key);
        if (!idxs || idxs.length === 0) continue;

        // Allowed (province|municipality) tuples for this school name
        const allowed = new Set<string>();
        for (const sn of group) allowed.add(sn.provN + KEY_SEP + sn.munN);

        let count = 0;
        const examples: OrphanRow["examples"] = [];
        for (const i of idxs) {
          const loc = farmerNormProv[i] + KEY_SEP + farmerNormMun[i];
          if (allowed.has(loc)) continue;
          count++;
          if (examples.length < 5) {
            const f = farmers[i];
            examples.push({
              code: f.code,
              name: f.full_name,
              province: f.province || "",
              municipality: f.municipality || "",
            });
          }
        }
        if (count > 0) {
          orphans.push({ schoolName: group[0].s.name, orphanCount: count, examples });
        }
      }
      orphans.sort((a, b) => b.orphanCount - a.orphanCount);
      mark("orphans");

      const duplicateNames = [...byName.values()].reduce((n, g) => n + (g.length > 1 ? 1 : 0), 0);

      const memAfter = readMemory();
      const totalMs = Math.round((performance.now() - tStart) * 100) / 100;
      const perf: PerfMetrics = {
        startedAt,
        phases: {
          fetch: phases.fetch || 0,
          indexFarmers: phases.indexFarmers || 0,
          normalizeSchools: phases.normalizeSchools || 0,
          duplicates: phases.duplicates || 0,
          similar: phases.similar || 0,
          orphans: phases.orphans || 0,
          total: totalMs,
        },
        rows: {
          schools: schools.length,
          provinces: provinces.length,
          municipalities: municipalities.length,
          farmers: farmers.length,
        },
        memory: memAfter
          ? {
              supported: true,
              usedJSHeapMB: toMB(memAfter.used),
              deltaJSHeapMB: memBefore ? toMB(memAfter.used - memBefore.used) : undefined,
              totalJSHeapMB: toMB(memAfter.total),
              jsHeapLimitMB: toMB(memAfter.limit),
            }
          : { supported: false },
      };
      pushPerfHistory(perf);
      // eslint-disable-next-line no-console
      console.info("[useEscolasAuditoria] perf", perf);

      const finalResult: AuditoriaResult = {
        duplicates,
        similar,
        orphans,
        totals: {
          schools: schools.length,
          duplicateNames,
          duplicateRows: duplicates.length,
          discrepant: duplicates.reduce((n, d) => n + (d.ok ? 0 : 1), 0),
          similarPairs: similar.length,
          orphans: orphans.reduce((s, o) => s + o.orphanCount, 0),
        },
        perf,
      };
      setData(finalResult);
      completePhase("orphans");
      setProgress({ phase: "done", label: PHASE_LABELS_HOOK.done, pct: 100 });

      // Persist to cache with a signature derived from the rows we just loaded
      writeCache({
        savedAt: Date.now(),
        signature: {
          schools: schools.length,
          farmers: farmers.length,
          provinces: provinces.length,
          municipalities: municipalities.length,
        },
        result: finalResult,
      });
      setCacheInfo({ fromCache: false, savedAt: Date.now(), ageMs: 0 });
    } catch (e) {
      console.error("[useEscolasAuditoria]", e);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const refetch = useCallback(() => run({ force: true }), [run]);

  return { data, loading, error, progress, cacheInfo, refetch };
}
