import { useState, useRef, useMemo, useCallback } from "react";
import { Upload, FileUp, X, AlertTriangle, CheckCircle2, Loader2, Database, UserPlus, UserX, Edit3, Coins } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import {
  parseSheet,
  computeDiffs,
  normalizeProvince,
  normalizeMunicipality,
  normalizeName,
  generateFarmerCode,
  type DbFarmerRow,
  type ExcelFarmerRow,
  type FarmerDiff,
} from "@/lib/reconciliation";

const BATCH = 50;

type ValidationReport = {
  totalRaw: number;
  invalidRows: import("@/lib/reconciliation").InvalidRow[];
  duplicateMsisdns: string[];
  missingByField: Record<import("@/lib/reconciliation").MissingField, number>;
};

const Mosap3PayReconciliacao = () => {
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [xlRows, setXlRows] = useState<ExcelFarmerRow[]>([]);
  const [dbRows, setDbRows] = useState<DbFarmerRow[]>([]);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [acceptValidation, setAcceptValidation] = useState(false);
  const [selNew, setSelNew] = useState<Set<string>>(new Set());
  const [selRemove, setSelRemove] = useState<Set<string>>(new Set());
  const [selName, setSelName] = useState<Set<string>>(new Set());
  const [selProv, setSelProv] = useState<Set<string>>(new Set());
  const [selMun, setSelMun] = useState<Set<string>>(new Set());
  const [selSaldo, setSelSaldo] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const diffs = useMemo(() => {
    if (!acceptValidation) return null;
    if (!xlRows.length || !dbRows.length) return null;
    return computeDiffs(dbRows, xlRows);
  }, [xlRows, dbRows, acceptValidation]);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParsing(true);
    setLoading(true);
    setAcceptValidation(false);
    setValidation(null);
    setXlRows([]);
    setDbRows([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("detalh")) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
      const parsed = parseSheet(json);
      if (parsed.headerErrors.length) {
        toast.error(parsed.headerErrors.join("; "));
        setLoading(false);
        setParsing(false);
        return;
      }
      setXlRows(parsed.rows);
      setValidation({
        totalRaw: parsed.totalRaw,
        invalidRows: parsed.invalidRows,
        duplicateMsisdns: parsed.duplicateMsisdns,
        missingByField: parsed.missingByField,
      });
      setParsing(false);

      const blocking = parsed.invalidRows.filter((r) => r.blocking).length;
      const warnings = parsed.invalidRows.length - blocking;
      if (parsed.invalidRows.length) {
        toast.warning(
          `Validação: ${blocking} linha(s) descartada(s), ${warnings} com avisos. Reveja antes de aprovar.`,
        );
      } else {
        toast.success(`${parsed.rows.length} linhas válidas no Excel`);
      }

      // Carrega BD
      toast.info("A carregar dados da base de dados…");
      const all = await fetchAllPages<DbFarmerRow>(() =>
        supabase
          .from("farmers")
          .select("code, full_name, phone, province, municipality, status, saldo_final, sim_status", { count: "exact" })
      );
      setDbRows(all);
    } catch (e: any) {
      toast.error(`Erro a processar: ${e.message || e}`);
    } finally {
      setLoading(false);
      setParsing(false);
    }
  }, []);

  const reset = () => {
    setFileName("");
    setXlRows([]);
    setDbRows([]);
    setValidation(null);
    setAcceptValidation(false);
    setSelNew(new Set());
    setSelRemove(new Set());
    setSelName(new Set());
    setSelProv(new Set());
    setSelMun(new Set());
    setSelSaldo(new Set());
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggle = (s: Set<string>, setS: (v: Set<string>) => void, key: string) => {
    const next = new Set(s);
    next.has(key) ? next.delete(key) : next.add(key);
    setS(next);
  };
  const toggleAll = (s: Set<string>, setS: (v: Set<string>) => void, all: string[]) => {
    if (s.size === all.length) setS(new Set());
    else setS(new Set(all));
  };

  const logAudit = async (action: string, details: any) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        action,
        entity_type: "reconciliation",
        user_id: u.user?.id || null,
        user_name: u.user?.email || null,
        details,
      });
    } catch {
      /* ignore */
    }
  };

  const applyNew = async () => {
    if (!diffs) return;
    const targets = diffs.newFarmers.filter((f) => selNew.has(f.msisdn));
    if (!targets.length) return;
    setProgress({ pct: 0, label: `A importar ${targets.length} novos agricultores…` });
    let ok = 0, fail = 0;
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH).map((r, j) => ({
        code: generateFarmerCode(i + j),
        full_name: normalizeName(r.name) || r.msisdn,
        phone: r.msisdn,
        province: normalizeProvince(r.province) || null,
        municipality: normalizeMunicipality(r.region) || null,
        saldo_final: r.saldoMosap.toFixed(2).replace(".", ","),
        status: r.estadoNumero === "Removido" ? "Removido" : "Pendente",
        sim_status: (r.estadoNumero && ["Activo","Removido","Barrado"].includes(r.estadoNumero)) ? r.estadoNumero : (r.estadoNumero?.toLowerCase().startsWith("pré") || r.estadoNumero?.toLowerCase().startsWith("pre")) ? "Pré desactivado" : "Desconhecido",
        sim_status_source: "reconciliacao",
      }));
      const { error } = await supabase.from("farmers").insert(batch);
      if (error) fail += batch.length;
      else ok += batch.length;
      setProgress({ pct: Math.round(((i + batch.length) / targets.length) * 100), label: `Importados ${i + batch.length}/${targets.length}` });
    }
    await logAudit("reconciliation_import_new", { file: fileName, ok, fail, sample: targets.slice(0, 3).map((r) => r.msisdn) });
    setProgress(null);
    setSelNew(new Set());
    qc.invalidateQueries({ queryKey: ["farmers_list"] });
    toast.success(`${ok} importados${fail ? `, ${fail} falharam` : ""}`);
  };

  const applyDiffs = async (
    items: FarmerDiff[],
    selected: Set<string>,
    field: "full_name" | "province" | "municipality" | "saldo_final" | "sim_status",
    label: string,
  ) => {
    const targets = items.filter((d) => selected.has(d.dbCode));
    if (!targets.length) return;
    setProgress({ pct: 0, label: `A aplicar ${targets.length} alterações de ${label}…` });
    let ok = 0, fail = 0;
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((d) => {
          const payload: Record<string, any> = { [field]: d.proposed };
          if (field === "sim_status") payload.sim_status_source = "reconciliacao";
          return supabase.from("farmers").update(payload).eq("code", d.dbCode);
        })
      );
      results.forEach((r) => (r.error ? fail++ : ok++));
      setProgress({ pct: Math.round(((i + batch.length) / targets.length) * 100), label: `${i + batch.length}/${targets.length}` });
    }
    await logAudit("reconciliation_update", { file: fileName, field, ok, fail });
    setProgress(null);
    qc.invalidateQueries({ queryKey: ["farmers_list"] });
    toast.success(`${ok} ${label} actualizados${fail ? `, ${fail} falharam` : ""}`);
    return targets.map((d) => d.dbCode);
  };

  const applyRemove = async () => {
    if (!diffs) return;
    const targets = diffs.toRemove.filter((r) => selRemove.has(r.db.code));
    if (!targets.length) return;
    setProgress({ pct: 0, label: `A remover ${targets.length}…` });
    let ok = 0, fail = 0;
    for (let i = 0; i < targets.length; i += BATCH) {
      const batch = targets.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((t) => supabase.from("farmers").update({ status: "Removido" }).eq("code", t.db.code))
      );
      results.forEach((r) => (r.error ? fail++ : ok++));
      setProgress({ pct: Math.round(((i + batch.length) / targets.length) * 100), label: `${i + batch.length}/${targets.length}` });
    }
    await logAudit("reconciliation_remove", { file: fileName, ok, fail });
    setProgress(null);
    setSelRemove(new Set());
    qc.invalidateQueries({ queryKey: ["farmers_list"] });
    toast.success(`${ok} marcados como Removido${fail ? `, ${fail} falharam` : ""}`);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold">Reconciliação MOSAP3 Pay</h1>
        <p className="text-muted-foreground text-sm">
          Carregue o ficheiro <code className="text-xs bg-muted px-1 py-0.5 rounded">ALL_MOSAP_*.xlsx</code> para validar
          e completar dados em falta dos agricultores.
        </p>
      </div>

      {/* Upload */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
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
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {parsing ? "A processar Excel…" : "A carregar dados da BD…"}
              </div>
            ) : fileName ? (
              <div className="flex items-center justify-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">{fileName}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); reset(); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Arraste o ficheiro Excel ou clique para seleccionar</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx · folha "Detalhe"</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {progress && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{progress.label}</span>
              <span className="text-muted-foreground">{progress.pct}%</span>
            </div>
            <Progress value={progress.pct} />
          </CardContent>
        </Card>
      )}

      {validation && xlRows.length > 0 && (
        <ValidationCard
          report={validation}
          accepted={acceptValidation}
          onAccept={() => setAcceptValidation(true)}
        />
      )}

      {diffs && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPI icon={<Database className="h-4 w-4" />} label="Excel" value={xlRows.length} />
            <KPI icon={<Database className="h-4 w-4" />} label="Base de Dados" value={dbRows.length} />
            <KPI icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Match" value={diffs.matched} />
            <KPI icon={<UserPlus className="h-4 w-4 text-info" />} label="Novos" value={diffs.newFarmers.length} highlight />
            <KPI icon={<UserX className="h-4 w-4 text-destructive" />} label="A remover" value={diffs.toRemove.length} />
            <KPI icon={<Coins className="h-4 w-4 text-warning" />} label="Saldos divergentes" value={diffs.saldoDiffs.length} />
          </div>

          <Tabs defaultValue="new">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="new" className="gap-2">
                <UserPlus className="h-3.5 w-3.5" />Novos <Badge variant="secondary">{diffs.newFarmers.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="remove" className="gap-2">
                <UserX className="h-3.5 w-3.5" />A remover <Badge variant="secondary">{diffs.toRemove.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="name" className="gap-2">
                <Edit3 className="h-3.5 w-3.5" />Nomes <Badge variant="secondary">{diffs.nameDiffs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="prov" className="gap-2">
                <Edit3 className="h-3.5 w-3.5" />Província <Badge variant="secondary">{diffs.provinceDiffs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="mun" className="gap-2">
                <Edit3 className="h-3.5 w-3.5" />Município <Badge variant="secondary">{diffs.municipalityDiffs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="saldo" className="gap-2">
                <Coins className="h-3.5 w-3.5" />Saldos <Badge variant="secondary">{diffs.saldoDiffs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="sim" className="gap-2">
                <Edit3 className="h-3.5 w-3.5" />Estado SIM <Badge variant="secondary">{diffs.simStatusDiffs.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new">
              <NewFarmersTab
                rows={diffs.newFarmers}
                selected={selNew}
                onToggle={(k) => toggle(selNew, setSelNew, k)}
                onToggleAll={() => toggleAll(selNew, setSelNew, diffs.newFarmers.map((r) => r.msisdn))}
                onApply={applyNew}
              />
            </TabsContent>

            <TabsContent value="remove">
              <RemoveTab
                rows={diffs.toRemove}
                selected={selRemove}
                onToggle={(k) => toggle(selRemove, setSelRemove, k)}
                onToggleAll={() => toggleAll(selRemove, setSelRemove, diffs.toRemove.map((r) => r.db.code))}
                onApply={applyRemove}
              />
            </TabsContent>

            <TabsContent value="name">
              <DiffTab
                title="Diferenças de nome"
                rows={diffs.nameDiffs}
                selected={selName}
                onToggle={(k) => toggle(selName, setSelName, k)}
                onToggleAll={() => toggleAll(selName, setSelName, diffs.nameDiffs.map((d) => d.dbCode))}
                onApply={async () => { await applyDiffs(diffs.nameDiffs, selName, "full_name", "nomes"); setSelName(new Set()); }}
              />
            </TabsContent>

            <TabsContent value="prov">
              <DiffTab
                title="Diferenças de província"
                rows={diffs.provinceDiffs}
                selected={selProv}
                onToggle={(k) => toggle(selProv, setSelProv, k)}
                onToggleAll={() => toggleAll(selProv, setSelProv, diffs.provinceDiffs.map((d) => d.dbCode))}
                onApply={async () => { await applyDiffs(diffs.provinceDiffs, selProv, "province", "províncias"); setSelProv(new Set()); }}
              />
            </TabsContent>

            <TabsContent value="mun">
              <DiffTab
                title="Diferenças de município"
                rows={diffs.municipalityDiffs}
                selected={selMun}
                onToggle={(k) => toggle(selMun, setSelMun, k)}
                onToggleAll={() => toggleAll(selMun, setSelMun, diffs.municipalityDiffs.map((d) => d.dbCode))}
                onApply={async () => { await applyDiffs(diffs.municipalityDiffs, selMun, "municipality", "municípios"); setSelMun(new Set()); }}
              />
            </TabsContent>

            <TabsContent value="saldo">
              <DiffTab
                title="Saldos divergentes (BD vs Excel)"
                rows={diffs.saldoDiffs}
                selected={selSaldo}
                onToggle={(k) => toggle(selSaldo, setSelSaldo, k)}
                onToggleAll={() => toggleAll(selSaldo, setSelSaldo, diffs.saldoDiffs.map((d) => d.dbCode))}
                onApply={async () => {
                  // saldo_final stored as text "199.800,00"
                  const targets = diffs.saldoDiffs.filter((d) => selSaldo.has(d.dbCode));
                  if (!targets.length) return;
                  setProgress({ pct: 0, label: `A sincronizar ${targets.length} saldos…` });
                  let ok = 0, fail = 0;
                  for (let i = 0; i < targets.length; i += BATCH) {
                    const batch = targets.slice(i, i + BATCH);
                    const results = await Promise.all(
                      batch.map((d) => supabase.from("farmers").update({ saldo_final: d.proposed }).eq("code", d.dbCode))
                    );
                    results.forEach((r) => (r.error ? fail++ : ok++));
                    setProgress({ pct: Math.round(((i + batch.length) / targets.length) * 100), label: `${i + batch.length}/${targets.length}` });
                  }
                  await logAudit("reconciliation_update", { file: fileName, field: "saldo_final", ok, fail });
                  setProgress(null);
                  setSelSaldo(new Set());
                  qc.invalidateQueries({ queryKey: ["farmers_list"] });
                  toast.success(`${ok} saldos sincronizados${fail ? `, ${fail} falharam` : ""}`);
                }}
              />
            </TabsContent>
          </Tabs>

          {diffs.onlyDbCount > 0 && (
            <Card className="border-warning/40">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">{diffs.onlyDbCount} agricultores na BD sem correspondência no Excel</p>
                  <p className="text-muted-foreground">Podem estar fora deste lote ou já desactivos. Não são alterados automaticamente.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

const KPI = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) => (
  <Card className={highlight ? "border-primary/40" : ""}>
    <CardContent className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="text-xl sm:text-2xl font-bold mt-1">{value.toLocaleString("pt-AO")}</p>
    </CardContent>
  </Card>
);

const NewFarmersTab = ({
  rows, selected, onToggle, onToggleAll, onApply,
}: {
  rows: ExcelFarmerRow[]; selected: Set<string>; onToggle: (k: string) => void; onToggleAll: () => void; onApply: () => void;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
      <CardTitle className="text-base">Novos agricultores no Excel</CardTitle>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{selected.size} seleccionados</Badge>
        <Button size="sm" onClick={onApply} disabled={selected.size === 0}>Importar seleccionados</Button>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <ScrollArea className="h-[480px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
            <tr className="border-b">
              <th className="px-3 py-2 text-left w-10">
                <Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={onToggleAll} />
              </th>
              <th className="px-3 py-2 text-left">Telefone</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Província</th>
              <th className="px-3 py-2 text-left">Município</th>
              <th className="px-3 py-2 text-right">Saldo MOSAP</th>
              <th className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.msisdn} className="border-b hover:bg-muted/30">
                <td className="px-3 py-1.5">
                  <Checkbox checked={selected.has(r.msisdn)} onCheckedChange={() => onToggle(r.msisdn)} />
                </td>
                <td className="px-3 py-1.5 font-mono">{r.msisdn}</td>
                <td className="px-3 py-1.5">{normalizeName(r.name)}</td>
                <td className="px-3 py-1.5">{normalizeProvince(r.province)}</td>
                <td className="px-3 py-1.5">{normalizeMunicipality(r.region)}</td>
                <td className="px-3 py-1.5 text-right">{r.saldoMosap.toLocaleString("pt-AO")}</td>
                <td className="px-3 py-1.5">
                  <Badge variant={r.estadoNumero === "Activo" ? "secondary" : "outline"} className="text-[10px]">
                    {r.estadoNumero}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground p-6">Sem novos registos</td></tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </CardContent>
  </Card>
);

const RemoveTab = ({
  rows, selected, onToggle, onToggleAll, onApply,
}: {
  rows: { db: DbFarmerRow; xl: ExcelFarmerRow }[]; selected: Set<string>; onToggle: (k: string) => void; onToggleAll: () => void; onApply: () => void;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
      <CardTitle className="text-base">Marcar como Removido</CardTitle>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{selected.size} seleccionados</Badge>
        <Button size="sm" variant="destructive" onClick={onApply} disabled={selected.size === 0}>Remover seleccionados</Button>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <ScrollArea className="h-[480px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
            <tr className="border-b">
              <th className="px-3 py-2 text-left w-10">
                <Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={onToggleAll} />
              </th>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Telefone</th>
              <th className="px-3 py-2 text-left">Estado Excel</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ db, xl }) => (
              <tr key={db.code} className="border-b hover:bg-muted/30">
                <td className="px-3 py-1.5"><Checkbox checked={selected.has(db.code)} onCheckedChange={() => onToggle(db.code)} /></td>
                <td className="px-3 py-1.5 font-mono">{db.code}</td>
                <td className="px-3 py-1.5">{db.full_name}</td>
                <td className="px-3 py-1.5 font-mono">{db.phone}</td>
                <td className="px-3 py-1.5"><Badge variant="destructive" className="text-[10px]">{xl.estadoNumero}</Badge></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted-foreground p-6">Nada a remover</td></tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </CardContent>
  </Card>
);

const DiffTab = ({
  title, rows, selected, onToggle, onToggleAll, onApply,
}: {
  title: string; rows: FarmerDiff[]; selected: Set<string>; onToggle: (k: string) => void; onToggleAll: () => void; onApply: () => void;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
      <CardTitle className="text-base">{title}</CardTitle>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{selected.size} seleccionados</Badge>
        <Button size="sm" onClick={onApply} disabled={selected.size === 0}>Aplicar seleccionados</Button>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <ScrollArea className="h-[480px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
            <tr className="border-b">
              <th className="px-3 py-2 text-left w-10">
                <Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={onToggleAll} />
              </th>
              <th className="px-3 py-2 text-left">Telefone</th>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Actual (BD)</th>
              <th className="px-3 py-2 text-left">Proposto (Excel)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.dbCode} className="border-b hover:bg-muted/30">
                <td className="px-3 py-1.5"><Checkbox checked={selected.has(d.dbCode)} onCheckedChange={() => onToggle(d.dbCode)} /></td>
                <td className="px-3 py-1.5 font-mono">{d.phone}</td>
                <td className="px-3 py-1.5 font-mono">{d.dbCode}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{d.current || <span className="italic">vazio</span>}</td>
                <td className="px-3 py-1.5 font-medium text-primary">{d.proposed}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted-foreground p-6">Sem diferenças</td></tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </CardContent>
  </Card>
);

const FIELD_LABELS: Record<string, string> = {
  MSISDN: "Telefone (MSISDN)",
  NAME: "Nome",
  PROVINCE: "Província",
  REGION: "Município",
  SALDO_DISPONIVEL_MOSAP: "Saldo MOSAP",
  SALDO_DISPONIVEL_EMONEY: "Saldo eMoney",
};

const ValidationCard = ({
  report,
  accepted,
  onAccept,
}: {
  report: ValidationReport;
  accepted: boolean;
  onAccept: () => void;
}) => {
  const blocking = report.invalidRows.filter((r) => r.blocking).length;
  const warnings = report.invalidRows.length - blocking;
  const validCount = report.totalRaw - blocking;
  const fieldEntries = (Object.entries(report.missingByField) as [string, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  const downloadCsv = () => {
    const header = ["Linha", "MSISDN", "Nome", "Província", "Município", "Bloqueante", "Campos em falta"];
    const rows = report.invalidRows.map((r) => [
      r.rowNumber, r.msisdn, r.name, r.province, r.region,
      r.blocking ? "Sim" : "Não",
      r.missing.map((m) => FIELD_LABELS[m] || m).join(" | "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `validacao_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const clean = report.invalidRows.length === 0 && report.duplicateMsisdns.length === 0;

  return (
    <Card className={clean ? "border-success/40" : "border-warning/40"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {clean ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
            <CardTitle className="text-base">
              Validação do ficheiro
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {report.invalidRows.length > 0 && (
              <Button size="sm" variant="outline" onClick={downloadCsv}>
                Exportar problemas (CSV)
              </Button>
            )}
            {!accepted && (
              <Button size="sm" onClick={onAccept} disabled={validCount === 0}>
                {clean ? "Continuar" : `Aprovar e processar ${validCount.toLocaleString("pt-AO")} linhas válidas`}
              </Button>
            )}
            {accepted && <Badge variant="secondary">Aprovado</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI icon={<Database className="h-4 w-4" />} label="Linhas no Excel" value={report.totalRaw} />
          <KPI icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Válidas" value={validCount} />
          <KPI icon={<AlertTriangle className="h-4 w-4 text-warning" />} label="Com avisos" value={warnings} />
          <KPI icon={<X className="h-4 w-4 text-destructive" />} label="Descartadas" value={blocking} />
        </div>

        {fieldEntries.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Campos em falta por linha</p>
            <div className="flex flex-wrap gap-2">
              {fieldEntries.map(([field, count]) => (
                <Badge key={field} variant={field === "MSISDN" ? "destructive" : "outline"}>
                  {FIELD_LABELS[field] || field}: {count.toLocaleString("pt-AO")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {report.duplicateMsisdns.length > 0 && (
          <div className="text-sm flex items-start gap-2 text-warning">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {report.duplicateMsisdns.length} MSISDN duplicado(s) no Excel — só a primeira ocorrência é considerada.
            </span>
          </div>
        )}

        {report.invalidRows.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">
              Primeiras {Math.min(report.invalidRows.length, 100)} linhas com problemas
            </p>
            <ScrollArea className="h-64 border rounded-md">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left">Linha</th>
                    <th className="px-3 py-2 text-left">MSISDN</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Província</th>
                    <th className="px-3 py-2 text-left">Em falta</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {report.invalidRows.slice(0, 100).map((r) => (
                    <tr key={`${r.rowNumber}-${r.msisdn}`} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-mono">{r.rowNumber}</td>
                      <td className="px-3 py-1.5 font-mono">{r.msisdn || <span className="italic text-muted-foreground">vazio</span>}</td>
                      <td className="px-3 py-1.5">{r.name || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-1.5">{r.province || <span className="italic text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {r.missing.map((m) => (
                            <Badge key={m} variant="outline" className="text-[10px]">
                              {FIELD_LABELS[m] || m}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant={r.blocking ? "destructive" : "secondary"} className="text-[10px]">
                          {r.blocking ? "Descartada" : "Aviso"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Mosap3PayReconciliacao;
