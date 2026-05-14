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
};

export function useEscolasAuditoria() {
  const [data, setData] = useState<AuditoriaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schools, provinces, municipalities, farmers] = await Promise.all([
        fetchAllPages<any>(() =>
          supabase.from("schools").select("id,name,province_id,municipality_id,village,total_farmers", { count: "exact" })
        ),
        fetchAllPages<any>(() => supabase.from("provinces").select("id,name", { count: "exact" })),
        fetchAllPages<any>(() => supabase.from("municipalities").select("id,name", { count: "exact" })),
        fetchAllPages<any>(() =>
          supabase.from("farmers").select("code,full_name,school,province,municipality,status", { count: "exact" }).neq("status", "Removido")
        ),
      ]);

      const provMap = new Map(provinces.map((p) => [p.id, p.name as string]));
      const munMap = new Map(municipalities.map((m) => [m.id, m.name as string]));

      // Index farmers per (normalized school, province, municipality)
      type FarmerLite = { code: string; name: string; school: string; province: string; municipality: string };
      const fNorm: FarmerLite[] = farmers.map((f) => ({
        code: f.code,
        name: f.full_name,
        school: normalizeName(f.school),
        province: normalizeName(f.province),
        municipality: normalizeName(f.municipality),
      }));

      // Group schools by normalized name
      const byName = new Map<string, any[]>();
      schools.forEach((s) => {
        const key = normalizeName(s.name);
        const arr = byName.get(key) || [];
        arr.push(s);
        byName.set(key, arr);
      });

      // Tab A — exact duplicates
      const duplicates: DuplicateRow[] = [];
      byName.forEach((group) => {
        if (group.length < 2) return;
        group.forEach((s) => {
          const provinceName = provMap.get(s.province_id) || "";
          const municipalityName = munMap.get(s.municipality_id) || "";
          const sN = normalizeName(s.name);
          const pN = normalizeName(provinceName);
          const mN = normalizeName(municipalityName);
          const real = fNorm.filter((f) => {
            if (f.school !== sN) return false;
            if (pN && f.province !== pN) return false;
            if (mN && f.municipality !== mN) return false;
            return true;
          }).length;
          duplicates.push({
            schoolId: s.id,
            name: s.name,
            province: provinceName,
            municipality: municipalityName,
            village: s.village,
            real,
            cached: s.total_farmers || 0,
            delta: real - (s.total_farmers || 0),
            ok: real === (s.total_farmers || 0),
          });
        });
      });
      duplicates.sort((a, b) =>
        a.name.localeCompare(b.name) || a.province.localeCompare(b.province) || a.municipality.localeCompare(b.municipality)
      );

      // Helper: count farmers per school row (for similar pairs)
      const countFor = (s: any) => {
        const sN = normalizeName(s.name);
        const pN = normalizeName(provMap.get(s.province_id) || "");
        const mN = normalizeName(munMap.get(s.municipality_id) || "");
        return fNorm.filter((f) => f.school === sN && (!pN || f.province === pN) && (!mN || f.municipality === mN)).length;
      };

      // Tab B — similar names (different normalized names but close)
      const uniqueNames = [...byName.keys()].filter(Boolean);
      const similar: SimilarPair[] = [];
      const seenPair = new Set<string>();
      for (let i = 0; i < uniqueNames.length; i++) {
        for (let j = i + 1; j < uniqueNames.length; j++) {
          const x = uniqueNames[i];
          const y = uniqueNames[j];
          let reason: SimilarPair["reason"] | null = null;
          let distance = 0;
          if (x === y) {
            reason = "normalized_equal";
          } else if (Math.abs(x.length - y.length) <= 8 && (x.includes(y) || y.includes(x)) && Math.min(x.length, y.length) >= 4) {
            reason = "containment";
            distance = Math.abs(x.length - y.length);
          } else if (Math.abs(x.length - y.length) <= 2) {
            const d = levenshtein(x, y);
            if (d <= 2 && d > 0) {
              reason = "levenshtein";
              distance = d;
            }
          }
          if (!reason) continue;
          // Build pair from each school in group X × group Y (cap to first 1)
          const groupX = byName.get(x)!;
          const groupY = byName.get(y)!;
          for (const sa of groupX) {
            for (const sb of groupY) {
              const k = [sa.id, sb.id].sort().join("|");
              if (seenPair.has(k)) continue;
              seenPair.add(k);
              similar.push({
                a: {
                  id: sa.id,
                  name: sa.name,
                  province: provMap.get(sa.province_id) || "",
                  municipality: munMap.get(sa.municipality_id) || "",
                  farmers: countFor(sa),
                },
                b: {
                  id: sb.id,
                  name: sb.name,
                  province: provMap.get(sb.province_id) || "",
                  municipality: munMap.get(sb.municipality_id) || "",
                  farmers: countFor(sb),
                },
                distance,
                reason,
              });
            }
          }
        }
      }
      similar.sort((a, b) => a.distance - b.distance || a.a.name.localeCompare(b.a.name));

      // Tab C — orphans: farmers whose school name matches some school but province/municipality don't match ANY school with that name
      const orphans: OrphanRow[] = [];
      byName.forEach((group, key) => {
        if (!key) return;
        const acceptableLocations = new Set(
          group.map(
            (s) => `${normalizeName(provMap.get(s.province_id) || "")}|${normalizeName(munMap.get(s.municipality_id) || "")}`
          )
        );
        const orphFarmers = farmers.filter((f) => {
          if (normalizeName(f.school) !== key) return false;
          const loc = `${normalizeName(f.province)}|${normalizeName(f.municipality)}`;
          return !acceptableLocations.has(loc);
        });
        if (orphFarmers.length > 0) {
          orphans.push({
            schoolName: group[0].name,
            orphanCount: orphFarmers.length,
            examples: orphFarmers.slice(0, 5).map((f) => ({
              code: f.code,
              name: f.full_name,
              province: f.province || "",
              municipality: f.municipality || "",
            })),
          });
        }
      });
      orphans.sort((a, b) => b.orphanCount - a.orphanCount);

      const duplicateNames = [...byName.values()].filter((g) => g.length > 1).length;
      setData({
        duplicates,
        similar,
        orphans,
        totals: {
          schools: schools.length,
          duplicateNames,
          duplicateRows: duplicates.length,
          discrepant: duplicates.filter((d) => !d.ok).length,
          similarPairs: similar.length,
          orphans: orphans.reduce((s, o) => s + o.orphanCount, 0),
        },
      });
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

  return { data, loading, error, refetch: run };
}
