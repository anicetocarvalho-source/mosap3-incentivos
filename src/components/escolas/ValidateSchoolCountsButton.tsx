import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  schoolId: string;
  name: string;
  province: string;
  municipality: string;
  expected: number;
  cached: number;
  ok: boolean;
};

const norm = (v: string | null | undefined) => (v || "").trim().toLowerCase();

export const ValidateSchoolCountsButton = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [primary, setPrimary] = useState<Row | null>(null);

  const run = async () => {
    setLoading(true);
    setRows([]);
    setPrimary(null);
    try {
      // 1. Carregar escolas + províncias + municípios
      const [{ data: schools }, { data: provinces }, { data: municipalities }] = await Promise.all([
        supabase.from("schools").select("id, name, province_id, municipality_id, total_farmers").limit(5000),
        supabase.from("provinces").select("id, name").limit(200),
        supabase.from("municipalities").select("id, name").limit(2000),
      ]);

      const provMap = new Map((provinces || []).map((p) => [p.id, p.name]));
      const munMap = new Map((municipalities || []).map((m) => [m.id, m.name]));

      // 2. Identificar escolas com nome duplicado
      const nameCounts = new Map<string, number>();
      (schools || []).forEach((s) => nameCounts.set(s.name, (nameCounts.get(s.name) || 0) + 1));
      const dupNames = new Set([...nameCounts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
      const dupSchools = (schools || []).filter((s) => dupNames.has(s.name));

      // 3. Carregar todos os produtores das escolas duplicadas (uma única query por nome)
      const uniqueNames = [...dupNames];
      const { data: farmers } = await supabase
        .from("farmers")
        .select("school, province, municipality, status")
        .in("school", uniqueNames)
        .neq("status", "Removido")
        .limit(10000);

      const computed: Row[] = dupSchools.map((s) => {
        const provinceName = (provMap.get(s.province_id) as string) || "";
        const municipalityName = (munMap.get(s.municipality_id) as string) || "";
        const sN = norm(s.name);
        const pN = norm(provinceName);
        const mN = norm(municipalityName);
        const expected = (farmers || []).filter((f) => {
          if (norm(f.school) !== sN) return false;
          if (pN && norm(f.province) !== pN) return false;
          if (mN && norm(f.municipality) !== mN) return false;
          return true;
        }).length;
        return {
          schoolId: s.id,
          name: s.name,
          province: provinceName,
          municipality: municipalityName,
          expected,
          cached: s.total_farmers || 0,
          ok: expected === (s.total_farmers || 0),
        };
      });

      computed.sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.province.localeCompare(b.province) ||
          a.municipality.localeCompare(b.municipality)
      );

      const target = computed.find(
        (r) => norm(r.name) === "1 de maio" && norm(r.municipality) === "balombo"
      );
      setPrimary(target || null);
      setRows(computed);

      if (target) {
        if (target.expected === 20) {
          toast.success(`Validação OK: "1 De Maio" (Balombo) → ${target.expected} produtores`);
        } else {
          toast.error(`Esperado 20 produtores, encontrado ${target.expected}`);
        }
      } else {
        toast.message("Validação concluída", {
          description: `${computed.length} escolas com nome duplicado verificadas.`,
        });
      }
    } catch (e: any) {
      toast.error("Erro a executar validação", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && rows.length === 0 && !loading) run();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          Validar contagens
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Validação de contagem de produtores por escola
          </DialogTitle>
          <DialogDescription>
            Verifica escolas com nome duplicado em municípios diferentes para garantir que cada uma só
            soma os seus produtores reais.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>A validar contagens…</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            {primary && (
              <div
                className={`rounded-lg border p-3 flex items-center gap-3 ${
                  primary.expected === 20
                    ? "bg-success/10 border-success/30"
                    : "bg-destructive/10 border-destructive/30"
                }`}
              >
                {primary.expected === 20 ? (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div className="text-sm">
                  <div className="font-semibold">
                    “1 De Maio” · {primary.municipality} ({primary.province})
                  </div>
                  <div className="text-muted-foreground">
                    Esperado: <strong>20</strong> · Encontrado:{" "}
                    <strong>{primary.expected}</strong> produtores
                  </div>
                </div>
              </div>
            )}

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem escolas com nome duplicado.
              </p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Escola</th>
                      <th className="text-left p-2">Município</th>
                      <th className="text-left p-2">Província</th>
                      <th className="text-right p-2">Real</th>
                      <th className="text-right p-2">Cache</th>
                      <th className="text-center p-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.schoolId} className="border-t">
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2">{r.municipality || "—"}</td>
                        <td className="p-2 text-muted-foreground">{r.province || "—"}</td>
                        <td className="p-2 text-right font-mono">{r.expected}</td>
                        <td className="p-2 text-right font-mono text-muted-foreground">
                          {r.cached}
                        </td>
                        <td className="p-2 text-center">
                          {r.ok ? (
                            <Badge variant="outline" className="gap-1 border-success/40 text-success">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                              <AlertTriangle className="h-3 w-3" /> Diferente
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={run} disabled={loading}>
                Re-executar validação
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
