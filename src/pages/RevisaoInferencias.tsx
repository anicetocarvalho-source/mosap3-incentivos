import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import {
  CheckCheck, CheckCircle2, XCircle, Pencil, Sparkles, RefreshCw, Search, ExternalLink, Loader2,
} from "lucide-react";

type Field = "province" | "municipality" | "school";

type FarmerRow = {
  code: string;
  full_name: string;
  phone: string | null;
  province: string | null;
  municipality: string | null;
  school: string | null;
};

type Suggestion = {
  field: Field;
  value: string;
  source: string;
  confidence: number;
  votes?: number;
  total_neighbors?: number;
  min_phone_distance?: number;
  alternatives?: Array<{ school?: string; municipality?: string; province?: string; votes?: number; dist_min?: number }>;
  audit_id: string;
};

type RowItem = FarmerRow & {
  missing: Field[];
  suggestions: Partial<Record<Field, Suggestion>>;
};

const UNKNOWN_VALUES = new Set(["", "ECA Desconhecida", "Desconhecida", "Desconhecido", "N/A", "-"]);

const isMissing = (v: string | null | undefined) => !v || UNKNOWN_VALUES.has(v.trim());

const FIELD_LABEL: Record<Field, string> = {
  province: "Província",
  municipality: "Município",
  school: "ECA",
};

const SOURCE_LABEL: Record<string, string> = {
  phone_neighbor_cluster: "Cluster telefone",
  same_phone: "Mesmo telefone",
  shared_bi: "BI partilhado",
  shared_phone: "Telefone partilhado",
  eca: "Pela ECA",
  gps_neighbor: "Parcela GPS próxima",
  gps: "Parcela GPS",
};

function confidenceBadge(c: number) {
  if (c >= 85) return "bg-success/15 text-success border-success/30";
  if (c >= 60) return "bg-warning/15 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function RevisaoInferencias() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RowItem[]>([]);
  const [rejected, setRejected] = useState<Set<string>>(new Set()); // `${code}|${field}`
  const [showRejected, setShowRejected] = useState(false);
  const [provinces, setProvinces] = useState<{ id: string; name: string }[]>([]);
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string; province_id: string }[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string; municipality_id: string | null; province_id: string | null }[]>([]);

  const [search, setSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState<"all" | Field>("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // `${code}|${field}`
  const [busy, setBusy] = useState(false);

  const [editFarmer, setEditFarmer] = useState<RowItem | null>(null);
  const [editProvince, setEditProvince] = useState<string>("");
  const [editMunicipality, setEditMunicipality] = useState<string>("");
  const [editSchool, setEditSchool] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1) farmers candidates
      const { data: farmers, error: fErr } = await supabase
        .from("farmers")
        .select("code, full_name, phone, province, municipality, school")
        .or("province.is.null,province.eq.,municipality.is.null,municipality.eq.,school.is.null,school.eq.,school.eq.ECA Desconhecida")
        .limit(2000);
      if (fErr) throw fErr;

      const farmerList = (farmers ?? []) as FarmerRow[];
      const codes = farmerList.map((f) => f.code);

      // 2) audit suggestions (latest per farmer/action)
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("id, entity_id, action, details, created_at")
        .in("entity_id", codes.length ? codes : ["__none__"])
        .in("action", ["backfill_school", "municipality_suggestion", "auto_assign_municipality", "auto_assign_failed"])
        .order("created_at", { ascending: false });

      // 3) rejected map
      const { data: rejLogs } = await supabase
        .from("audit_logs")
        .select("entity_id, details")
        .eq("action", "inference_rejected")
        .in("entity_id", codes.length ? codes : ["__none__"]);

      const rejSet = new Set<string>();
      (rejLogs ?? []).forEach((l: any) => {
        const f = l.details?.field;
        if (f) rejSet.add(`${l.entity_id}|${f}`);
      });
      setRejected(rejSet);

      // pick latest suggestion per (code, field)
      const sugMap = new Map<string, Suggestion>();
      (logs ?? []).forEach((l: any) => {
        const d = l.details || {};
        const code = l.entity_id;
        const candidates: Array<{ field: Field; value?: string }> = [];
        if (d.suggested_school) candidates.push({ field: "school", value: d.suggested_school });
        if (d.assigned_school && !d.suggested_school) candidates.push({ field: "school", value: d.assigned_school });
        if (d.municipality) candidates.push({ field: "municipality", value: d.municipality });
        if (d.province) candidates.push({ field: "province", value: d.province });
        candidates.forEach(({ field, value }) => {
          if (!value) return;
          const key = `${code}|${field}`;
          if (sugMap.has(key)) return; // first wins = newest
          sugMap.set(key, {
            field,
            value,
            source: d.source || l.action,
            confidence: Number(d.confidence ?? 0),
            votes: d.votes,
            total_neighbors: d.total_neighbors,
            min_phone_distance: d.min_phone_distance,
            alternatives: d.alternatives,
            audit_id: l.id,
          });
        });
      });

      // build rows
      const items: RowItem[] = farmerList.map((f) => {
        const missing: Field[] = [];
        if (isMissing(f.province)) missing.push("province");
        if (isMissing(f.municipality)) missing.push("municipality");
        if (isMissing(f.school)) missing.push("school");
        const suggestions: Partial<Record<Field, Suggestion>> = {};
        missing.forEach((field) => {
          const s = sugMap.get(`${f.code}|${field}`);
          if (s) suggestions[field] = s;
        });
        return { ...f, missing, suggestions };
      });

      setRows(items);
    } catch (e: any) {
      toast.error("Falha ao carregar revisões", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      const [p, m, s] = await Promise.all([
        supabase.from("provinces").select("id, name").order("name"),
        supabase.from("municipalities").select("id, name, province_id").order("name"),
        supabase.from("schools").select("id, name, municipality_id, province_id").order("name"),
      ]);
      setProvinces((p.data as any) ?? []);
      setMunicipalities((m.data as any) ?? []);
      setSchools((s.data as any) ?? []);
    })();
  }, [load]);

  /* ───────── derived list ───────── */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .map((r) => {
        const fields = fieldFilter === "all" ? r.missing : r.missing.filter((f) => f === fieldFilter);
        return { ...r, missing: fields };
      })
      .filter((r) => r.missing.length > 0)
      .filter((r) => {
        if (provinceFilter !== "all" && r.province !== provinceFilter) return false;
        if (q && !r.full_name.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q)) return false;
        if (!showRejected) {
          const allRejected = r.missing.every((f) => rejected.has(`${r.code}|${f}`));
          if (allRejected) return false;
        }
        if (minConfidence > 0) {
          const hasGood = r.missing.some((f) => (r.suggestions[f]?.confidence ?? 0) >= minConfidence);
          if (!hasGood) return false;
        }
        return true;
      });
  }, [rows, fieldFilter, provinceFilter, search, showRejected, minConfidence, rejected]);

  const stats = useMemo(() => {
    let pending = 0;
    let withSuggestion = 0;
    let highConf = 0;
    rows.forEach((r) => {
      r.missing.forEach((f) => {
        const key = `${r.code}|${f}`;
        if (rejected.has(key)) return;
        pending++;
        const s = r.suggestions[f];
        if (s) {
          withSuggestion++;
          if (s.confidence >= 75) highConf++;
        }
      });
    });
    return { pending, withSuggestion, highConf, rejected: rejected.size };
  }, [rows, rejected]);

  /* ───────── actions ───────── */

  const writeUpdate = useCallback(async (code: string, patch: Partial<Record<Field, string>>, audit: any) => {
    const { error } = await supabase.from("farmers").update(patch).eq("code", code);
    if (error) throw error;
    await supabase.from("audit_logs").insert({
      entity_type: "farmer",
      entity_id: code,
      action: audit.action,
      user_id: user?.id ?? null,
      user_name: (user as any)?.user_metadata?.full_name ?? user?.email ?? null,
      details: audit.details,
    });
  }, [user]);

  const accept = async (row: RowItem, field: Field) => {
    const s = row.suggestions[field];
    if (!s) return;
    setBusy(true);
    try {
      const patch: Partial<Record<Field, string>> = { [field]: s.value };
      // when accepting school, opportunistically fill province/municipality from schools table
      if (field === "school") {
        const sc = schools.find((x) => x.name === s.value);
        if (sc) {
          const muni = municipalities.find((m) => m.id === sc.municipality_id);
          const prov = provinces.find((p) => p.id === sc.province_id || p.id === muni?.province_id);
          if (isMissing(row.municipality) && muni) patch.municipality = muni.name;
          if (isMissing(row.province) && prov) patch.province = prov.name;
        }
      }
      await writeUpdate(row.code, patch, {
        action: "inference_accepted",
        details: {
          field, suggested: s.value, applied: patch, source: s.source, confidence: s.confidence, suggestion_audit_id: s.audit_id,
        },
      });
      toast.success(`${FIELD_LABEL[field]} aceite para ${row.code}`);
      await load();
    } catch (e: any) {
      toast.error("Erro ao aceitar", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const reject = async (row: RowItem, field: Field) => {
    const s = row.suggestions[field];
    setBusy(true);
    try {
      await supabase.from("audit_logs").insert({
        entity_type: "farmer",
        entity_id: row.code,
        action: "inference_rejected",
        user_id: user?.id ?? null,
        user_name: (user as any)?.user_metadata?.full_name ?? user?.email ?? null,
        details: { field, suggested: s?.value ?? null, source: s?.source ?? null, confidence: s?.confidence ?? null },
      });
      setRejected((prev) => new Set(prev).add(`${row.code}|${field}`));
      toast.success("Sugestão recusada");
    } catch (e: any) {
      toast.error("Erro ao recusar", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row: RowItem) => {
    setEditFarmer(row);
    setEditProvince(row.province ?? "");
    setEditMunicipality(row.municipality ?? "");
    setEditSchool(row.school && row.school !== "ECA Desconhecida" ? row.school : "");
  };

  const saveEdit = async () => {
    if (!editFarmer) return;
    const patch: Partial<Record<Field, string>> = {};
    if (editProvince && editProvince !== editFarmer.province) patch.province = editProvince;
    if (editMunicipality && editMunicipality !== editFarmer.municipality) patch.municipality = editMunicipality;
    if (editSchool && editSchool !== editFarmer.school) patch.school = editSchool;
    if (Object.keys(patch).length === 0) {
      setEditFarmer(null);
      return;
    }
    setBusy(true);
    try {
      await writeUpdate(editFarmer.code, patch, {
        action: "inference_manual_override",
        details: {
          applied: patch,
          suggestions: editFarmer.suggestions,
          previous: { province: editFarmer.province, municipality: editFarmer.municipality, school: editFarmer.school },
        },
      });
      toast.success("Localização actualizada");
      setEditFarmer(null);
      await load();
    } catch (e: any) {
      toast.error("Erro ao gravar", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const eligibleBatch = useMemo(() => {
    const items: Array<{ row: RowItem; field: Field; sug: Suggestion }> = [];
    filtered.forEach((r) => {
      r.missing.forEach((f) => {
        const s = r.suggestions[f];
        if (s && s.confidence >= 75) items.push({ row: r, field: f, sug: s });
      });
    });
    return items;
  }, [filtered]);

  const selectAll = () => {
    setSelected(new Set(eligibleBatch.map(({ row, field }) => `${row.code}|${field}`)));
  };
  const clearSel = () => setSelected(new Set());

  const acceptBatch = async () => {
    const toRun = eligibleBatch.filter(({ row, field }) => selected.has(`${row.code}|${field}`));
    if (!toRun.length) return;
    setBusy(true);
    let ok = 0;
    try {
      // chunks of 50
      for (let i = 0; i < toRun.length; i += 50) {
        const chunk = toRun.slice(i, i + 50);
        await Promise.all(chunk.map(({ row, field }) => accept(row, field).then(() => { ok++; }).catch(() => {})));
      }
      toast.success(`${ok} sugestões aceites`);
      clearSel();
      await load();
    } finally {
      setBusy(false);
    }
  };

  /* ───────── render ───────── */

  const editMunicipalitiesForProvince = municipalities.filter(
    (m) => provinces.find((p) => p.id === m.province_id)?.name === editProvince
  );
  const editSchoolsForMunicipality = schools.filter((s) => {
    const muni = municipalities.find((m) => m.id === s.municipality_id);
    return muni?.name === editMunicipality;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisão de Inferências"
        description="Confirme, recuse ou edite as sugestões automáticas para província, município e ECA"
        icon={Sparkles}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Recarregar
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Campos pendentes</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.pending}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Com sugestão</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.withSuggestion}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Alta confiança (≥75)</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-success">{stats.highConf}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Recusados</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.rejected}</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Pesquisa</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Nome ou código" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de inferência</Label>
            <Select value={fieldFilter} onValueChange={(v) => setFieldFilter(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="province">Província</SelectItem>
                <SelectItem value="municipality">Município</SelectItem>
                <SelectItem value="school">ECA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Província</Label>
            <Select value={provinceFilter} onValueChange={setProvinceFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {provinces.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confiança mínima: {minConfidence}%</Label>
            <Slider value={[minConfidence]} onValueChange={(v) => setMinConfidence(v[0])} min={0} max={100} step={5} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2 lg:col-span-4">
            <Switch id="showRejected" checked={showRejected} onCheckedChange={setShowRejected} />
            <Label htmlFor="showRejected" className="text-sm">Mostrar casos recusados</Label>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-3">
          <div className="text-sm">
            <strong>{selected.size}</strong> sugestões seleccionadas (apenas com confiança ≥ 75%)
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearSel}>Limpar</Button>
            <Button size="sm" onClick={acceptBatch} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              Aceitar seleccionadas
            </Button>
          </div>
        </div>
      )}

      {eligibleBatch.length > 0 && selected.size === 0 && (
        <div className="text-xs text-muted-foreground">
          <button className="underline" onClick={selectAll}>Seleccionar todas as {eligibleBatch.length} sugestões elegíveis para lote</button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nada para rever" description="Não há casos pendentes com os filtros actuais." />
          ) : (
            <TooltipProvider>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Agricultor</TableHead>
                      <TableHead>Localização actual</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead>Sugestão</TableHead>
                      <TableHead className="text-right">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.flatMap((r) =>
                      r.missing.map((field) => {
                        const s = r.suggestions[field];
                        const key = `${r.code}|${field}`;
                        const isRejected = rejected.has(key);
                        const eligible = s && s.confidence >= 75;
                        return (
                          <TableRow key={key} className={isRejected ? "opacity-50" : ""}>
                            <TableCell>
                              {eligible && (
                                <Checkbox
                                  checked={selected.has(key)}
                                  onCheckedChange={() => toggleSelect(key)}
                                  disabled={isRejected}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{r.full_name}</div>
                              <div className="text-xs text-muted-foreground">
                                <Link to={`/agricultor/${r.code}`} className="hover:underline inline-flex items-center gap-1">
                                  {r.code} <ExternalLink className="h-3 w-3" />
                                </Link>
                                {r.phone && <> • {r.phone}</>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div>{isMissing(r.province) ? <Badge variant="outline" className="text-warning border-warning/30">Província em falta</Badge> : r.province}</div>
                              <div>{isMissing(r.municipality) ? <Badge variant="outline" className="text-warning border-warning/30">Município em falta</Badge> : r.municipality}</div>
                              <div>{isMissing(r.school) ? <Badge variant="outline" className="text-warning border-warning/30">ECA em falta</Badge> : r.school}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{FIELD_LABEL[field]}</Badge></TableCell>
                            <TableCell>
                              {s ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      <div className="font-medium">{s.value}</div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className={confidenceBadge(s.confidence)}>{s.confidence}%</Badge>
                                        <span className="text-xs text-muted-foreground">{SOURCE_LABEL[s.source] ?? s.source}</span>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="space-y-1 text-xs">
                                      {s.votes != null && <div>{s.votes}/{s.total_neighbors ?? "?"} votos • dist mínima {s.min_phone_distance}</div>}
                                      {s.alternatives && s.alternatives.length > 0 && (
                                        <div>
                                          <div className="font-semibold mt-1">Alternativas:</div>
                                          {s.alternatives.slice(0, 3).map((a, i) => (
                                            <div key={i}>• {a.school ?? a.municipality ?? a.province} {a.votes != null && `(${a.votes} votos)`}</div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sem sugestão automática</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                {isRejected ? (
                                  <Badge variant="outline" className="text-muted-foreground">Recusado</Badge>
                                ) : (
                                  <>
                                    {s && (
                                      <>
                                        <Button size="sm" variant="ghost" className="h-8 text-success hover:bg-success/10" onClick={() => accept(r, field)} disabled={busy} title="Aceitar">
                                          <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => reject(r, field)} disabled={busy} title="Recusar">
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-8" onClick={() => openEdit(r)} disabled={busy} title="Editar manualmente">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y">
                {filtered.flatMap((r) =>
                  r.missing.map((field) => {
                    const s = r.suggestions[field];
                    const key = `${r.code}|${field}`;
                    const isRejected = rejected.has(key);
                    return (
                      <div key={key} className={`p-4 space-y-2 ${isRejected ? "opacity-50" : ""}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{r.full_name}</div>
                            <div className="text-xs text-muted-foreground">{r.code}{r.phone && ` • ${r.phone}`}</div>
                          </div>
                          <Badge variant="outline">{FIELD_LABEL[field]}</Badge>
                        </div>
                        {s ? (
                          <div className="text-sm">
                            <strong>{s.value}</strong>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={confidenceBadge(s.confidence)}>{s.confidence}%</Badge>
                              <span className="text-xs text-muted-foreground">{SOURCE_LABEL[s.source] ?? s.source}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">Sem sugestão automática</div>
                        )}
                        <div className="flex gap-2 pt-1">
                          {!isRejected && s && (
                            <>
                              <Button size="sm" variant="outline" className="flex-1 text-success border-success/30" onClick={() => accept(r, field)} disabled={busy}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Aceitar
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30" onClick={() => reject(r, field)} disabled={busy}>
                                <XCircle className="h-4 w-4 mr-1" /> Recusar
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openEdit(r)} disabled={busy}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editFarmer} onOpenChange={(o) => !o && setEditFarmer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar localização</DialogTitle>
            <DialogDescription>{editFarmer?.full_name} ({editFarmer?.code})</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Província</Label>
              <Select value={editProvince} onValueChange={(v) => { setEditProvince(v); setEditMunicipality(""); setEditSchool(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Município</Label>
              <Select value={editMunicipality} onValueChange={(v) => { setEditMunicipality(v); setEditSchool(""); }} disabled={!editProvince}>
                <SelectTrigger><SelectValue placeholder={editProvince ? "Seleccionar" : "Escolha a província"} /></SelectTrigger>
                <SelectContent>
                  {editMunicipalitiesForProvince.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ECA</Label>
              <Select value={editSchool} onValueChange={setEditSchool} disabled={!editMunicipality}>
                <SelectTrigger><SelectValue placeholder={editMunicipality ? "Seleccionar" : "Escolha o município"} /></SelectTrigger>
                <SelectContent>
                  {editSchoolsForMunicipality.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFarmer(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
