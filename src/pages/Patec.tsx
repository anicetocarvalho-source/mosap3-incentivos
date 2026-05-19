import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Package, Search, Filter, Edit2, Eye, CheckSquare, X, Plus, Trash2, Pencil, Check, ChevronLeft, ChevronRight, Wheat, Loader2, Users, AlertCircle, Sprout, Leaf, TreeDeciduous, BarChart, MapPin, Shuffle, CalendarDays, Carrot, Apple, Cherry, Flower2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { TableRowsSkeleton, CardListSkeleton } from "@/components/ui/loading-skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { resolveScope, applyFarmerScopeFilter, type ResolvedScope } from "@/lib/farmerScope";
import { ErrorState } from "@/components/ui/error-state";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatecs, type Patec } from "@/hooks/usePatecs";
import { useSeasons } from "@/hooks/useSeasons";
import PatecsTab from "@/components/patec/PatecsTab";
import SeasonsTab from "@/components/patec/SeasonsTab";
import { validatePatecAssignment } from "@/lib/patecAssignmentGuard";
import PatecCompositionDialog from "@/components/patec/PatecCompositionDialog";

interface FarmerPatec {
  id: string;
  code: string;
  full_name: string;
  province: string | null;
  municipality: string | null;
  school: string | null;
  patec: number | null;
  patec_code: string | null;
  status: string;
}

interface PatecItem {
  id: string;
  patec_number: number;
  category: string;
  name: string;
  base_quantity: number | null;
  unit: string | null;
}

const patecMeta: Record<number, { title: string; color: string; cultures: string; icon: any; gradient: string; bgAccent: string; chartFill: string }> = {
  1: { title: "PATEC 1 — Milho + Feijão", color: "bg-amber-100 text-amber-800 border-amber-300", cultures: "Milho + Feijão", icon: Wheat, gradient: "from-amber-500 to-orange-500", bgAccent: "bg-amber-50 dark:bg-amber-950/30", chartFill: "hsl(38, 92%, 50%)" },
  2: { title: "PATEC 2 — Massango + Feijão", color: "bg-emerald-100 text-emerald-800 border-emerald-300", cultures: "Massango + Feijão", icon: Sprout, gradient: "from-emerald-500 to-teal-500", bgAccent: "bg-emerald-50 dark:bg-emerald-950/30", chartFill: "hsl(160, 84%, 39%)" },
  3: { title: "PATEC 3 — Massambala + Feijão", color: "bg-violet-100 text-violet-800 border-violet-300", cultures: "Massambala + Feijão", icon: Leaf, gradient: "from-violet-500 to-purple-500", bgAccent: "bg-violet-50 dark:bg-violet-950/30", chartFill: "hsl(263, 70%, 50%)" },
  4: { title: "PATEC 4 — Mandioca + Feijão", color: "bg-lime-100 text-lime-800 border-lime-300", cultures: "Mandioca + Feijão", icon: TreeDeciduous, gradient: "from-lime-500 to-green-600", bgAccent: "bg-lime-50 dark:bg-lime-950/30", chartFill: "hsl(84, 81%, 44%)" },
  5: { title: "PATEC 5 — Alho", color: "bg-stone-100 text-stone-800 border-stone-300", cultures: "Alho", icon: Flower2, gradient: "from-stone-400 to-zinc-500", bgAccent: "bg-stone-50 dark:bg-stone-900/40", chartFill: "hsl(220, 9%, 55%)" },
  6: { title: "PATEC 6 — Batata Doce", color: "bg-orange-100 text-orange-800 border-orange-300", cultures: "Batata Doce", icon: Apple, gradient: "from-orange-500 to-rose-500", bgAccent: "bg-orange-50 dark:bg-orange-950/30", chartFill: "hsl(20, 90%, 55%)" },
  7: { title: "PATEC 7 — Batata Rena", color: "bg-yellow-100 text-yellow-800 border-yellow-300", cultures: "Batata Rena", icon: Cherry, gradient: "from-yellow-500 to-amber-600", bgAccent: "bg-yellow-50 dark:bg-yellow-950/30", chartFill: "hsl(48, 95%, 50%)" },
  8: { title: "PATEC 8 — Cebola", color: "bg-rose-100 text-rose-800 border-rose-300", cultures: "Cebola", icon: Flower2, gradient: "from-rose-500 to-pink-600", bgAccent: "bg-rose-50 dark:bg-rose-950/30", chartFill: "hsl(340, 82%, 55%)" },
  9: { title: "PATEC 9 — Cenoura", color: "bg-orange-100 text-orange-800 border-orange-300", cultures: "Cenoura", icon: Carrot, gradient: "from-orange-600 to-red-500", bgAccent: "bg-orange-50 dark:bg-orange-950/30", chartFill: "hsl(14, 88%, 52%)" },
  10: { title: "PATEC 10 — Repolho", color: "bg-green-100 text-green-800 border-green-300", cultures: "Repolho", icon: Leaf, gradient: "from-green-500 to-emerald-600", bgAccent: "bg-green-50 dark:bg-green-950/30", chartFill: "hsl(142, 71%, 42%)" },
};

const FALLBACK_PATEC_META = { gradient: "from-slate-400 to-slate-600", icon: Package, chartFill: "hsl(215, 16%, 47%)", color: "bg-muted text-muted-foreground border-border" };

const getPatecVisual = (p: { legacy_number: number | null }) => {
  if (p.legacy_number != null && patecMeta[p.legacy_number]) return patecMeta[p.legacy_number];
  return FALLBACK_PATEC_META;
};

const categoryLabels: Record<string, string> = {
  insumos: "Insumos Agrícolas",
  pecuaria: "Pecuária e Materiais",
  servicos: "Serviços Incluídos",
};

const categoryColors: Record<string, string> = {
  insumos: "text-amber-700 dark:text-amber-400",
  pecuaria: "text-emerald-700 dark:text-emerald-400",
  servicos: "text-blue-700 dark:text-blue-400",
};

const categoryIcons: Record<string, string> = {
  insumos: "🌾",
  pecuaria: "🐄",
  servicos: "🔧",
};

const PAGE_SIZE = 15;

const Patec = () => {
  const { isAdmin, user, roles, authReady } = useAuth();
  const [searchParams] = useSearchParams();
  const initialProvince = searchParams.get("province") || "all";
  const initialPatec = searchParams.get("patec") || "all";
  const [scope, setScope] = useState<ResolvedScope | null>(null);
  const [farmers, setFarmers] = useState<FarmerPatec[]>([]);
  const [patecItems, setPatecItems] = useState<PatecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPatec, setFilterPatec] = useState<string>(initialPatec);
  const [filterProvince, setFilterProvince] = useState<string>(initialProvince);
  const [page, setPage] = useState(1);
  const [editFarmer, setEditFarmer] = useState<FarmerPatec | null>(null);
  const [editPatecCode, setEditPatecCode] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [viewPatec, setViewPatec] = useState<number | null>(null);
  const [composingPatec, setComposingPatec] = useState<Patec | null>(null);
  const [itemCountsByCode, setItemCountsByCode] = useState<Record<string, number>>({});
  const [compositionLoading, setCompositionLoading] = useState(true);
  const [compositionError, setCompositionError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkPatecCode, setBulkPatecCode] = useState<string>("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Region bulk assign state
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [regionScope, setRegionScope] = useState<"provincia" | "municipio" | "escola">("provincia");
  const [regionValues, setRegionValues] = useState<string[]>([]);
  const [regionPatecCode, setRegionPatecCode] = useState<string>("");
  const [regionOverwrite, setRegionOverwrite] = useState<boolean>(false);
  const [regionConfirmOpen, setRegionConfirmOpen] = useState(false);

  // Assignment progress (shared by bulk + region)
  type AssignProgress = {
    total: number;
    done: number;
    success: number;
    failed: number;
    batches: number;
    batchesDone: number;
    errors: string[];
  };
  const [assignProgress, setAssignProgress] = useState<AssignProgress | null>(null);
  const [assignReport, setAssignReport] = useState<(AssignProgress & { patecCode: string; scope: string }) | null>(null);
  const [assignReportOpen, setAssignReportOpen] = useState(false);

  // Season selector for assignment
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("all");

  // Add item state
  const [addingCategory, setAddingCategory] = useState<{ patec: number; category: string } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("kg");

  // Composition list filter
  const [compositionSearch, setCompositionSearch] = useState("");

  // Edit item state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");

  // New: pacotes & épocas
  const { patecs, loading: patecsLoading, refetch: refetchPatecs } = usePatecs();
  const { seasons, links, refetch: refetchSeasons } = useSeasons();
  const farmerCountsByCode = farmers.reduce<Record<string, number>>((acc, f) => {
    const k = (f as any).patec_code || (f.patec ? `_legacy_${f.patec}` : "_none");
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  // Map legacy counts to codes via patec.legacy_number
  patecs.forEach((p) => {
    if (p.legacy_number != null) {
      const legacyKey = `_legacy_${p.legacy_number}`;
      farmerCountsByCode[p.code] = (farmerCountsByCode[p.code] || 0) + (farmerCountsByCode[legacyKey] || 0);
    }
  });

  // Default season selector to currently active (in-progress) season once loaded
  useEffect(() => {
    if (selectedSeasonId !== "all" || seasons.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const current = seasons.find((s) => s.is_active && today >= s.start_date && today <= s.end_date);
    if (current) setSelectedSeasonId(current.id);
  }, [seasons]);

  // PATECs assignable for the chosen season (active only; restricted by links when a season is selected)
  const activePatecs = patecs.filter((p) => p.is_active);
  const patecsForSeason = selectedSeasonId === "all"
    ? activePatecs
    : activePatecs.filter((p) => links.some((l) => l.season_id === selectedSeasonId && l.patec_id === p.id));

  const findPatecByFarmer = (code: string | null, legacy: number | null): Patec | undefined => {
    if (code) {
      const m = patecs.find((p) => p.code === code);
      if (m) return m;
    }
    if (legacy != null) return patecs.find((p) => p.legacy_number === legacy);
    return undefined;
  };


  const fetchFarmers = async (resolved: ResolvedScope) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAllPages<FarmerPatec>(() =>
        applyFarmerScopeFilter(
          supabase
            .from("farmers")
            .select(
              "id, code, full_name, province, municipality, school, patec, patec_code, status",
              { count: "exact" }
            )
            .order("code"),
          resolved,
          { includeRemoved: true }
        )
      );
      setFarmers(data);
    } catch (error: any) {
      setLoadError(error.message);
      toast.error("Erro ao carregar produtores");
    }
    setLoading(false);
  };

  const fetchPatecItems = async () => {
    setCompositionLoading(true);
    setCompositionError(null);
    try {
      const { data, error } = await supabase
        .from("patec_items")
        .select("*")
        .order("created_at");
      if (error) throw error;
      const rows = (data as any[]) || [];
      setPatecItems(rows as PatecItem[]);
      const counts: Record<string, number> = {};
      for (const r of rows) {
        if (r.patec_code) counts[r.patec_code] = (counts[r.patec_code] || 0) + 1;
      }
      setItemCountsByCode(counts);
    } catch (err: any) {
      setCompositionError(err?.message || "Erro ao carregar itens dos PATECs");
    } finally {
      setCompositionLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    (async () => {
      const resolved = await resolveScope(user.id, roles);
      if (cancelled) return;
      setScope(resolved);
      fetchFarmers(resolved);
      fetchPatecItems();
    })();
    return () => { cancelled = true; };
  }, [authReady, user?.id, roles.join(",")]);

  // Realtime: aplica eventos INSERT/UPDATE/DELETE incrementalmente em
  // patecItems e itemCountsByCode. Eventos em rajada são acumulados num
  // buffer e aplicados num único batch (debounce 150ms) para minimizar
  // re-renderizações. Códigos afectados são marcados como "dirty" e
  // reconciliados em lote contra a contagem autoritativa do servidor.
  const dirtyCodesRef = useRef<Set<string>>(new Set<string>());
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const RECONCILE_DEBOUNCE_MS = 800;

  const reconcileDirtyCodes = useCallback(async () => {
    reconcileTimerRef.current = null;
    const codes = Array.from(dirtyCodesRef.current);
    dirtyCodesRef.current = new Set<string>();
    if (codes.length === 0) return;

    // Fetch counts autoritativos em paralelo (head:true → sem payload)
    const results = await Promise.all(
      codes.map(async (code) => {
        const { count, error } = await supabase
          .from("patec_items")
          .select("id", { count: "exact", head: true })
          .eq("patec_code", code);
        return { code, count, error };
      })
    );

    setItemCountsByCode((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const { code, count, error } of results) {
        if (error || count == null) continue;
        const current = prev[code] || 0;
        if (current === count) continue;
        if (count <= 0) {
          if (code in next) { delete next[code]; changed = true; }
        } else {
          next[code] = count;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const scheduleReconcile = useCallback(() => {
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    reconcileTimerRef.current = setTimeout(() => {
      void reconcileDirtyCodes();
    }, RECONCILE_DEBOUNCE_MS);
  }, [reconcileDirtyCodes]);

  useEffect(() => {
    if (!authReady || !user) return;

    type Ev =
      | { kind: "insert"; row: PatecItem }
      | { kind: "update"; row: PatecItem; oldCode: string | null }
      | { kind: "delete"; id?: string; oldCode: string | null };

    const buffer: Ev[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 150;

    const flush = () => {
      flushTimer = null;
      if (buffer.length === 0) return;
      const events = buffer.splice(0, buffer.length);

      // Aplica todas as mutações de patecItems numa única setState
      setPatecItems((prev) => {
        const map = new Map(prev.map((p) => [p.id, p] as const));
        for (const ev of events) {
          if (ev.kind === "insert") map.set(ev.row.id, ev.row);
          else if (ev.kind === "update") map.set(ev.row.id, ev.row);
          else if (ev.kind === "delete" && ev.id) map.delete(ev.id);
        }
        return Array.from(map.values());
      });

      // Calcula deltas agregados por código e aplica num único setState
      const deltas = new Map<string, number>();
      const bump = (code: string | null | undefined, d: number) => {
        if (!code) return;
        deltas.set(code, (deltas.get(code) || 0) + d);
        dirtyCodesRef.current.add(code);
      };
      for (const ev of events) {
        if (ev.kind === "insert") bump((ev.row as any).patec_code, +1);
        else if (ev.kind === "delete") bump(ev.oldCode, -1);
        else if (ev.kind === "update") {
          const newCode = (ev.row as any).patec_code ?? null;
          if (ev.oldCode !== newCode) {
            bump(ev.oldCode, -1);
            bump(newCode, +1);
          } else if (newCode) {
            // Sem mudança de código: marca como dirty para apanhar
            // escritas concorrentes perdidas via reconciliação.
            dirtyCodesRef.current.add(newCode);
          }
        }
      }
      if (deltas.size > 0) {
        setItemCountsByCode((prev) => {
          const next = { ...prev };
          let changed = false;
          deltas.forEach((d, code) => {
            const v = (next[code] || 0) + d;
            if (v <= 0) {
              if (code in next) {
                delete next[code];
                changed = true;
              }
            } else if (next[code] !== v) {
              next[code] = v;
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }

      // Agenda reconciliação em lote para todos os códigos tocados
      if (dirtyCodesRef.current.size > 0) scheduleReconcile();
    };

    const schedule = (ev: Ev) => {
      buffer.push(ev);
      if (flushTimer == null) flushTimer = setTimeout(flush, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("patec_items-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "patec_items" },
        (payload) => schedule({ kind: "insert", row: payload.new as PatecItem })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patec_items" },
        (payload) =>
          schedule({
            kind: "update",
            row: payload.new as PatecItem,
            oldCode: ((payload.old as any)?.patec_code ?? null) as string | null,
          })
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "patec_items" },
        (payload) =>
          schedule({
            kind: "delete",
            id: (payload.old as any)?.id,
            oldCode: ((payload.old as any)?.patec_code ?? null) as string | null,
          })
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncStatus("connected");
          // Ao (re)ligar, marca todos os códigos já carregados como dirty
          // para reconciliar eventos perdidos durante a desconexão.
          setItemCountsByCode((prev) => {
            Object.keys(prev).forEach((c) => dirtyCodesRef.current.add(c));
            return prev;
          });
          scheduleReconcile();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setSyncStatus("error");
        else setSyncStatus("disconnected");
      });
    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      flush();
      if (reconcileTimerRef.current) {
        clearTimeout(reconcileTimerRef.current);
        reconcileTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [authReady, user?.id, scheduleReconcile]);

  // Reconciliação imediata do PATEC actualmente seleccionado (composição
  // aberta) — garante leitura fresca sem esperar pelo debounce de lote.
  useEffect(() => {
    const code = composingPatec?.code;
    if (!code || !authReady || !user) return;
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from("patec_items")
        .select("id", { count: "exact", head: true })
        .eq("patec_code", code);
      if (cancelled || error || count == null) return;
      setItemCountsByCode((prev) => {
        const current = prev[code] || 0;
        if (current === count) return prev;
        const next = { ...prev };
        if (count <= 0) delete next[code];
        else next[code] = count;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [composingPatec?.code, syncStatus, authReady, user?.id]);



  const getItems = (patecNum: number, category: string) =>
    patecItems.filter((i) => i.patec_number === patecNum && i.category === category);

  const handleAddItem = async () => {
    if (!addingCategory || !newItemName.trim()) return;
    const qty = newItemQty ? parseFloat(newItemQty.replace(",", ".")) : null;
    const { error } = await supabase.from("patec_items").insert({
      patec_number: addingCategory.patec,
      category: addingCategory.category,
      name: newItemName.trim(),
      base_quantity: qty && qty > 0 ? qty : null,
      unit: newItemUnit.trim() || null,
    });
    if (error) {
      toast.error("Erro ao adicionar item");
    } else {
      toast.success("Item adicionado");
      setNewItemName("");
      setNewItemQty("");
      setAddingCategory(null);
      fetchPatecItems();
    }
  };

  const handleDeleteItem = async (item: PatecItem) => {
    const { error } = await supabase.from("patec_items").delete().eq("id", item.id);
    if (error) {
      toast.error("Erro ao remover item");
    } else {
      toast.success(`"${item.name}" removido`);
      fetchPatecItems();
    }
  };

  const handleRenameItem = async (item: PatecItem) => {
    if (!editingItemName.trim() || editingItemName.trim() === item.name) {
      setEditingItem(null);
      return;
    }
    const { error } = await supabase.from("patec_items").update({ name: editingItemName.trim() }).eq("id", item.id);
    if (error) {
      toast.error("Erro ao renomear item");
    } else {
      toast.success("Item renomeado");
      fetchPatecItems();
    }
    setEditingItem(null);
  };

  const provinces = Array.from(new Set(farmers.map((f) => f.province).filter(Boolean))).sort();

  const farmersByProvince = farmers.filter((f) =>
    filterProvince === "all" || f.province === filterProvince
  );

  // Resolve PATEC do filtro (pode ser código novo ou legacy 1/2/3)
  const filterPatecResolved = filterPatec === "all" || filterPatec === "none"
    ? null
    : patecs.find((p) => p.code === filterPatec || String(p.legacy_number) === filterPatec) ?? null;

  const filtered = farmersByProvince.filter((f) => {
    const matchesSearch =
      f.full_name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase());
    const matchesPatec =
      filterPatec === "all" ||
      (filterPatec === "none" && !f.patec && !f.patec_code) ||
      (filterPatecResolved &&
        (f.patec_code === filterPatecResolved.code ||
          (f.patec_code == null && filterPatecResolved.legacy_number != null && f.patec === filterPatecResolved.legacy_number)));
    return matchesSearch && matchesPatec;
  });

  // Contagens dinâmicas por pacote (suporta atribuição por patec_code ou legacy patec)
  const countsByCode: Record<string, number> = {};
  for (const p of patecs) countsByCode[p.code] = 0;
  let semPatecCount = 0;
  for (const f of farmersByProvince) {
    const matched = findPatecByFarmer(f.patec_code, f.patec);
    if (matched) countsByCode[matched.code] = (countsByCode[matched.code] || 0) + 1;
    else if (!f.patec_code && !f.patec) semPatecCount++;
    else semPatecCount++; // patec_code/legacy desconhecido → tratar como sem PATEC válido
  }
  const stats = {
    total: farmersByProvince.length,
    semPatec: semPatecCount,
    assigned: farmersByProvince.length - semPatecCount,
  };

  const handleSavePatec = async () => {
    if (!editFarmer) return;
    const selected = editPatecCode ? patecs.find((p) => p.code === editPatecCode) : null;
    const guard = validatePatecAssignment(selected, patecsForSeason);
    if (!guard.ok) {
      toast.error(guard.message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("farmers")
      .update({
        patec_code: selected?.code ?? null,
        patec: selected?.legacy_number ?? null,
      })
      .eq("id", editFarmer.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atribuir PATEC");
    } else {
      toast.success(selected ? `${selected.code} atribuído a ${editFarmer.full_name}` : `PATEC removido de ${editFarmer.full_name}`);
      setEditFarmer(null);
      scope && fetchFarmers(scope);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((f) => f.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkSave = async () => {
    if (!bulkPatecCode || selectedIds.size === 0) return;
    const selected = patecs.find((p) => p.code === bulkPatecCode);
    if (!selected) return;
    const guard = validatePatecAssignment(selected, patecsForSeason);
    if (!guard.ok) {
      toast.error(guard.message);
      return;
    }
    setSaving(true);
    const ids = Array.from(selectedIds);
    const totalBatches = Math.ceil(ids.length / 50);
    const progress: AssignProgress = { total: ids.length, done: 0, success: 0, failed: 0, batches: totalBatches, batchesDone: 0, errors: [] };
    setAssignProgress({ ...progress });
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { error } = await supabase
        .from("farmers")
        .update({ patec_code: selected.code, patec: selected.legacy_number ?? null })
        .in("id", batch);
      progress.done += batch.length;
      progress.batchesDone += 1;
      if (error) {
        progress.failed += batch.length;
        progress.errors.push(`Lote ${progress.batchesDone}/${totalBatches} (${batch.length}): ${error.message}`);
      } else {
        progress.success += batch.length;
      }
      setAssignProgress({ ...progress });
    }
    setSaving(false);
    setBulkConfirmOpen(false);
    setBulkDialogOpen(false);
    setBulkPatecCode("");
    setAssignProgress(null);
    setAssignReport({ ...progress, patecCode: selected.code, scope: `${ids.length} seleccionado(s)` });
    setAssignReportOpen(true);
    if (progress.failed > 0) {
      toast.error(`${progress.success}/${progress.total} atribuídos · ${progress.failed} falharam`);
    } else {
      toast.success(`${selected.code} atribuído a ${progress.success} produtor(es)`);
    }
    setSelectedIds(new Set());
    scope && fetchFarmers(scope);
  };

  // Region bulk assign: target farmers by Província / Município / Escola
  const regionTargetFarmers = (() => {
    if (regionValues.length === 0) return [];
    const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
    const set = new Set(regionValues.map(norm));
    return farmers.filter((f) => {
      const key = regionScope === "provincia" ? f.province : regionScope === "municipio" ? f.municipality : f.school;
      if (!set.has(norm(key))) return false;
      if (!regionOverwrite && (f.patec_code || f.patec)) return false;
      return true;
    });
  })();

  const handleRegionAssign = async () => {
    if (!regionPatecCode || regionTargetFarmers.length === 0) return;
    const selected = patecs.find((p) => p.code === regionPatecCode);
    if (!selected) return;
    const guard = validatePatecAssignment(selected, patecsForSeason);
    if (!guard.ok) {
      toast.error(guard.message);
      return;
    }
    setSaving(true);
    const ids = regionTargetFarmers.map((f) => f.id);
    const scopeLabel =
      regionScope === "provincia" ? "Províncias" : regionScope === "municipio" ? "Municípios" : "Escolas";
    const totalBatches = Math.ceil(ids.length / 50);
    const progress: AssignProgress = { total: ids.length, done: 0, success: 0, failed: 0, batches: totalBatches, batchesDone: 0, errors: [] };
    setAssignProgress({ ...progress });
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { error } = await supabase
        .from("farmers")
        .update({ patec_code: selected.code, patec: selected.legacy_number ?? null })
        .in("id", batch);
      progress.done += batch.length;
      progress.batchesDone += 1;
      if (error) {
        progress.failed += batch.length;
        progress.errors.push(`Lote ${progress.batchesDone}/${totalBatches} (${batch.length}): ${error.message}`);
      } else {
        progress.success += batch.length;
      }
      setAssignProgress({ ...progress });
    }
    setSaving(false);
    setRegionConfirmOpen(false);
    setRegionDialogOpen(false);
    setRegionValues([]);
    setRegionPatecCode("");
    setAssignProgress(null);
    setAssignReport({ ...progress, patecCode: selected.code, scope: `${scopeLabel}: ${regionValues.join(", ") || "—"}` });
    setAssignReportOpen(true);
    if (progress.failed > 0) {
      toast.error(`${progress.success}/${progress.total} atribuídos · ${progress.failed} falharam`);
    } else {
      toast.success(`${selected.code} atribuído a ${progress.success} produtor(es)`);
    }
    scope && fetchFarmers(scope);
  };

  // Random redistribution (admin only)
  const [randomConfirmOpen, setRandomConfirmOpen] = useState(false);
  const [randomReport, setRandomReport] = useState<null | {
    total: number;
    province: string;
    season: string;
    distribution: Array<{ code: string; name: string; count: number }>;
  }>(null);

  const semPatecPool = farmersByProvince.filter((f) => !f.patec && !f.patec_code);

  const handleRandomReassign = async () => {
    if (semPatecPool.length === 0) return;
    if (patecsForSeason.length === 0) {
      toast.error("Não existem PATECs disponíveis para a época seleccionada");
      return;
    }
    setSaving(true);
    // Fisher-Yates shuffle
    const ids = semPatecPool.map((f) => f.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    // Split evenly across available PATECs for the season
    const pool = patecsForSeason;
    const buckets: Record<string, string[]> = {};
    pool.forEach((p) => { buckets[p.code] = []; });
    ids.forEach((id, idx) => {
      const p = pool[idx % pool.length];
      buckets[p.code].push(id);
    });
    let errorCount = 0;
    for (const p of pool) {
      const list = buckets[p.code];
      const legacy = p.legacy_number ?? null;
      for (let i = 0; i < list.length; i += 50) {
        const batch = list.slice(i, i + 50);
        const { error } = await supabase
          .from("farmers")
          .update({ patec_code: p.code, patec: legacy })
          .in("id", batch);
        if (error) errorCount++;
      }
    }
    setSaving(false);
    setRandomConfirmOpen(false);
    if (errorCount > 0) {
      toast.error("Erro ao reatribuir alguns produtores");
    } else {
      toast.success(`Reatribuídos ${ids.length} produtor(es) aleatoriamente`);
      const seasonName = selectedSeasonId === "all"
        ? "Todas as épocas"
        : (seasons.find((s) => s.id === selectedSeasonId)?.name || "—");
      setRandomReport({
        total: ids.length,
        province: filterProvince === "all" ? "Todas as províncias" : filterProvince,
        season: seasonName,
        distribution: pool.map((p) => ({ code: p.code, name: p.name, count: buckets[p.code].length })),
      });
    }
    scope && fetchFarmers(scope);
  };

  const isAllSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const isSomeSelected = selectedIds.size > 0;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterPatec, filterProvince]);

  // Render editable item list for a category
  const renderItemList = (patecNum: number, category: string) => {
    const items = getItems(patecNum, category);
    const isAdding = addingCategory?.patec === patecNum && addingCategory?.category === category;

    return (
      <div key={category} className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className={`font-semibold text-xs flex items-center gap-1.5 ${categoryColors[category]}`}>
            <span>{categoryIcons[category]}</span> {categoryLabels[category]}
          </p>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => { setAddingCategory({ patec: patecNum, category }); setNewItemName(""); }}
              title="Adicionar item"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between group bg-muted/30 rounded px-2 py-1">
              {editingItem === item.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={editingItemName}
                    onChange={(e) => setEditingItemName(e.target.value)}
                    className="h-6 text-xs flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameItem(item);
                      if (e.key === "Escape") setEditingItem(null);
                    }}
                  />
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-primary" onClick={() => handleRenameItem(item)}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingItem(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-xs">
                    {item.name}
                    {item.base_quantity ? <span className="text-muted-foreground ml-1">· {item.base_quantity} {item.unit || "un"}/0,5Ha</span> : <span className="text-amber-600 dark:text-amber-400 ml-1">· s/ qty</span>}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => { setEditingItem(item.id); setEditingItemName(item.name); }}
                        title="Editar nome"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-destructive"
                        onClick={() => handleDeleteItem(item)}
                        title="Remover item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground italic">Sem itens</p>}
        </div>
        {isAdding && (
          <div className="flex gap-1 mt-1">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Nome do item..."
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={handleAddItem} disabled={!newItemName.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setAddingCategory(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="atribuicao" className="space-y-6">
        <TabsList>
          <TabsTrigger value="atribuicao">Atribuição</TabsTrigger>
          <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
          <TabsTrigger value="epocas">Épocas Agrícolas</TabsTrigger>
        </TabsList>

        <TabsContent value="pacotes">
          <PatecsTab
            patecs={patecs}
            seasons={seasons}
            links={links}
            farmerCounts={farmerCountsByCode}
            isAdmin={isAdmin}
            refetch={() => { refetchPatecs(); refetchSeasons(); }}
          />
        </TabsContent>

        <TabsContent value="epocas">
          <SeasonsTab
            seasons={seasons}
            patecs={patecs}
            links={links}
            isAdmin={isAdmin}
            refetch={() => { refetchSeasons(); refetchPatecs(); }}
          />
        </TabsContent>

        <TabsContent value="atribuicao" className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            Pacotes Tecnológicos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão e atribuição dos pacotes tecnológicos aos produtores — Ano de Arranque MOSAP III
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex-wrap">
          <Users className="h-3.5 w-3.5" />
          <span><strong className="text-foreground">{stats.total}</strong> produtores registados</span>
          {scope && scope.scope !== "global" && (
            <>
              <span className="text-border">|</span>
              <Filter className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">
                {scope.scope === "province" ? "Províncias" : "ECAs"}: {scope.filterLabel}
              </span>
            </>
          )}
          {filterProvince !== "all" && (
            <>
              <span className="text-border">|</span>
              <MapPin className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{filterProvince}</span>
            </>
          )}
          {stats.semPatec > 0 && (
            <>
              <span className="text-border">|</span>
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive font-medium">{stats.semPatec} sem PATEC</span>
            </>
          )}
        </div>
      </div>

      {/* Stats cards — um cartão por PATEC + Total + Sem PATEC */}
      {(() => {
        const sortedPatecs = [...patecs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className={`cursor-pointer transition-all hover:shadow-md ${filterPatec === "all" ? "ring-2 ring-primary/30 border-primary/50" : "hover:border-primary/30"}`} onClick={() => setFilterPatec("all")}>
              <CardContent className="p-4 text-center">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Produtores</p>
              </CardContent>
            </Card>
            {sortedPatecs.map((p) => {
              const meta = getPatecVisual(p);
              const Icon = meta.icon;
              const count = countsByCode[p.code] || 0;
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    filterPatec === p.code ? "ring-2 ring-primary/30 border-primary/50" : "hover:border-primary/30",
                    !p.is_active && "opacity-60"
                  )}
                  onClick={() => setFilterPatec(p.code)}
                >
                  <CardContent className="p-4 text-center">
                    <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center mx-auto mb-2`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground truncate" title={`${p.code} — ${p.cultures || p.name}`}>{p.code}</p>
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${meta.gradient}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{pct}% • {p.cultures || p.name}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card className={`cursor-pointer transition-all hover:shadow-md ${filterPatec === "none" ? "ring-2 ring-destructive/30 border-destructive/50" : "hover:border-destructive/30"}`} onClick={() => setFilterPatec("none")}>
              <CardContent className="p-4 text-center">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
                <p className="text-2xl font-bold text-destructive">{stats.semPatec}</p>
                <p className="text-xs text-muted-foreground">Sem PATEC</p>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Validação de equilíbrio (ideal = 100/N por pacote) */}
      {(() => {
        const activePatecs = patecs.filter((p) => p.is_active);
        const N = activePatecs.length;
        if (N === 0 || stats.assigned === 0) return null;
        const ideal = 100 / N;
        const fmt = (v: number) => v.toFixed(1).replace(".", ",") + "%";
        const pcts = activePatecs.map((p) => {
          const c = countsByCode[p.code] || 0;
          return { p, count: c, pct: stats.assigned > 0 ? (c / stats.assigned) * 100 : 0 };
        });
        const maxDev = Math.max(...pcts.map((x) => Math.abs(x.pct - ideal)));
        const balanced = maxDev <= 2;
        const semPct = stats.total > 0 ? (stats.semPatec / stats.total) * 100 : 0;
        return (
          <Card className={balanced ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {balanced ? (
                    <Check className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {balanced ? `Distribuição equilibrada entre ${N} pacotes` : "Distribuição desequilibrada"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ideal: {fmt(ideal)} por pacote · desvio máximo {fmt(maxDev)} {balanced ? "(≤ 2pp)" : "(> 2pp)"}
                    </p>
                  </div>
                </div>
                {isAdmin && stats.semPatec > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      if (patecsForSeason.length === 0) {
                        toast.error("Não existem PATECs disponíveis para a época seleccionada. Seleccione uma época com pacotes vinculados.");
                        return;
                      }
                      setRandomConfirmOpen(true);
                    }}
                    disabled={saving}
                  >
                    <Shuffle className="h-3.5 w-3.5 mr-1.5" />
                    Reatribuir aleatoriamente
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                {pcts.map(({ p, count, pct }) => (
                  <Badge key={p.id} variant="outline" className="font-normal">
                    {p.code}: <strong className="ml-1">{count}</strong> · {fmt(pct)}
                  </Badge>
                ))}
                <Badge variant={stats.semPatec === 0 ? "outline" : "destructive"} className="font-normal">
                  Sem PATEC: <strong className="ml-1">{stats.semPatec}</strong> · {fmt(semPct)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Gráfico de distribuição PATEC (todos os pacotes + Sem PATEC) */}
      {stats.total > 0 && (() => {
        const sortedPatecs = [...patecs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const chartData = [
          ...sortedPatecs.map((p) => ({
            name: p.code.replace("PATEC-", "P"),
            fullName: p.code,
            value: countsByCode[p.code] || 0,
            fill: getPatecVisual(p).chartFill,
          })),
          { name: "Sem", fullName: "Sem PATEC", value: stats.semPatec, fill: "hsl(var(--destructive))" },
        ];
        return (
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <BarChart className="h-4 w-4 text-primary" />
              Distribuição dos Pacotes
            </h2>
            <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[var(--shadow-card)]">
              <ResponsiveContainer width="100%" height={280}>
                <RechartsBarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v.toLocaleString("pt-AO"), "Agricultores"]}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload as any)?.fullName ?? ""}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* Composition - compact list */}
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <TreeDeciduous className="h-4 w-4 text-primary" aria-hidden="true" />
          Composição dos Pacotes
          <span className="ml-auto flex items-center gap-1.5">
            <span className={cn("relative flex h-2 w-2", syncStatus === "connected" && "animate-pulse")}>
              <span
                className={cn(
                  "inline-flex h-2 w-2 rounded-full",
                  syncStatus === "connected"
                    ? "bg-success"
                    : syncStatus === "error"
                      ? "bg-destructive"
                      : "bg-muted-foreground"
                )}
              />
            </span>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-medium",
                syncStatus === "connected"
                  ? "text-success"
                  : syncStatus === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
              )}
            >
              {syncStatus === "connected"
                ? "Sincronizado"
                : syncStatus === "error"
                  ? "Erro de sincronização"
                  : "Desligado"}
            </span>
          </span>
        </h2>
        <Card>
          <div className="p-3 pb-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Pesquisar PATEC..."
                value={compositionSearch}
                onChange={(e) => setCompositionSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
                aria-label="Pesquisar PATEC na composição"
              />
            </div>
          </div>
          {(() => {
            const isLoading = compositionLoading || patecsLoading;
            if (isLoading) {
              return (
                <div className="px-4 py-6">
                  <LoadingState variant="spinner" label="A carregar pacotes..." />
                </div>
              );
            }
            if (compositionError) {
              return (
                <div className="px-4 py-6">
                  <ErrorState
                    title="Erro ao carregar composição"
                    description={compositionError}
                    onRetry={fetchPatecItems}
                  />
                </div>
              );
            }
            return (
              <ul className="divide-y" role="list">
                {(() => {
                  const term = compositionSearch.toLowerCase().trim();
                  const sortedPatecs = [...patecs].sort((a, b) => {
                    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
                    if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                    return a.code.localeCompare(b.code);
                  });
                  const filtered = term
                    ? sortedPatecs.filter((p) =>
                        p.code.toLowerCase().includes(term) ||
                        p.name.toLowerCase().includes(term) ||
                        (p.cultures || "").toLowerCase().includes(term)
                      )
                    : sortedPatecs;
                  if (filtered.length === 0) {
                    return (
                      <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {term ? "Nenhum pacote corresponde à pesquisa." : "Sem pacotes disponíveis."}
                      </li>
                    );
                  }
                  return filtered.map((p) => {
                    const legacyMeta = p.legacy_number != null ? patecMeta[p.legacy_number] : null;
                    const LegacyIcon = legacyMeta?.icon;
                    const totalItems = itemCountsByCode[p.code] || 0;
                    return (
                      <li
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5",
                          !p.is_active && "opacity-60 bg-muted/30"
                        )}
                      >
                        {legacyMeta ? (
                          <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${legacyMeta.gradient} flex items-center justify-center shrink-0`} aria-hidden="true">
                            <LegacyIcon className="h-4 w-4 text-white" aria-hidden="true" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0" aria-hidden="true">
                            <Package className="h-4 w-4 text-primary" aria-hidden="true" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-tight truncate">
                            {p.code}{" "}
                            <span className="text-muted-foreground font-normal">
                              — {p.name}{p.cultures ? ` · ${p.cultures}` : ""}
                            </span>
                            {!p.is_active && (
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">(inativo)</span>
                            )}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {totalItems} {totalItems === 1 ? "item" : "itens"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setComposingPatec(p)}
                          aria-label={`Ver detalhes da composição do ${p.code}`}
                        >
                          <Eye className="h-3 w-3 mr-1" aria-hidden="true" /> Detalhes
                        </Button>
                      </li>
                    );
                  });
                })()}
              </ul>
            );
          })()}
        </Card>
      </div>

      {/* Filters + Bulk action bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Lista de Produtores
          <Badge variant="outline" className="text-[10px] font-normal ml-1">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</Badge>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterProvince} onValueChange={(v) => { setFilterProvince(v); setSelectedIds(new Set()); }}>
            <SelectTrigger className="w-[200px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todas as províncias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as províncias</SelectItem>
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {seasons.length > 0 && (
            <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
              <SelectTrigger className="w-[220px]">
                <CalendarDays className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Época agrícola" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as épocas</SelectItem>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterPatec} onValueChange={setFilterPatec}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar PATEC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Produtores</SelectItem>
              {[...patecs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((p) => (
                <SelectItem key={p.id} value={p.code}>
                  {p.code} — {p.cultures || p.name}{!p.is_active ? " (inativo)" : ""}
                </SelectItem>
              ))}
              <SelectItem value="none">⚠️ Sem PATEC</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => { setRegionDialogOpen(true); setRegionScope("provincia"); setRegionValues([]); setRegionPatecCode(""); setRegionOverwrite(false); }}
          >
            <MapPin className="h-4 w-4 mr-1" /> Atribuir por região
          </Button>
        </div>

        {isSomeSelected && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 animate-in fade-in slide-in-from-top-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedIds.size} produtor{selectedIds.size > 1 ? "es" : ""} seleccionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={clearSelection}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => { setBulkDialogOpen(true); setBulkPatecCode(""); }}>
              <Package className="h-3 w-3 mr-1" /> Atribuir PATEC em lote
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {loadError ? (
        <Card><CardContent className="p-0"><ErrorState onRetry={() => scope && fetchFarmers(scope)} /></CardContent></Card>
      ) : (
      <Card>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} aria-label="Seleccionar todos" />
                  </TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Província</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>PATEC</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRowsSkeleton rows={6} cols={8} />
                ) : paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="p-0"><EmptyState size="sm" icon={Users} /></TableCell></TableRow>
                ) : paginated.map((f) => (
                  <TableRow key={f.id} className={selectedIds.has(f.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(f.id)} onCheckedChange={() => toggleSelect(f.id)} aria-label={`Seleccionar ${f.full_name}`} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{f.code}</TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/agricultores/${f.code}`} className="text-primary hover:underline">{f.full_name}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.province || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.school || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={f.status === "Ativo" ? "default" : "secondary"} className="text-[10px]">{f.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const p = findPatecByFarmer(f.patec_code, f.patec);
                        if (!p) return <span className="text-xs text-destructive font-medium">Não atribuído</span>;
                        const meta = p.legacy_number ? patecMeta[p.legacy_number] : null;
                        return <Badge variant="outline" className={`text-[10px] ${meta?.color || ""}`}>{p.code}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                        const p = findPatecByFarmer(f.patec_code, f.patec);
                        setEditFarmer(f);
                        setEditPatecCode(p?.code ?? "");
                      }}>
                        <Edit2 className="h-3 w-3 mr-1" /> Atribuir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {loading ? (
              <CardListSkeleton count={5} />
            ) : paginated.length === 0 ? (
              <EmptyState size="sm" icon={Users} />
            ) : paginated.map((f) => (
              <div key={f.id} className={`p-3 space-y-1.5 ${selectedIds.has(f.id) ? "bg-primary/5" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedIds.has(f.id)} onCheckedChange={() => toggleSelect(f.id)} />
                    <Link to={`/agricultores/${f.code}`} className="text-sm font-medium text-primary hover:underline">{f.full_name}</Link>
                  </div>
                  {(() => {
                    const p = findPatecByFarmer(f.patec_code, f.patec);
                    if (!p) return <span className="text-[10px] text-destructive font-medium">Sem PATEC</span>;
                    const meta = p.legacy_number ? patecMeta[p.legacy_number] : null;
                    return <Badge variant="outline" className={`text-[10px] ${meta?.color || ""}`}>{p.code}</Badge>;
                  })()}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{f.code}</span>
                  <span>{f.province || "—"} • {f.school || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={f.status === "Ativo" ? "default" : "secondary"} className="text-[10px]">{f.status}</Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                    const p = findPatecByFarmer(f.patec_code, f.patec);
                    setEditFarmer(f);
                    setEditPatecCode(p?.code ?? "");
                  }}>
                    <Edit2 className="h-3 w-3 mr-1" /> Atribuir
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">{filtered.length} produtores • Página {page}/{totalPages}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Edit Dialog (single) */}
      <Dialog open={!!editFarmer} onOpenChange={(o) => !o && setEditFarmer(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Atribuir PATEC — {editFarmer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Código: <span className="font-mono font-semibold">{editFarmer?.code}</span>
            </p>
            {seasons.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Época: <span className="font-medium text-foreground">
                  {selectedSeasonId === "all" ? "Todas" : (seasons.find((s) => s.id === selectedSeasonId)?.name || "—")}
                </span>
              </div>
            )}
            <Select value={editPatecCode || "_none"} onValueChange={(v) => setEditPatecCode(v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar PATEC" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Remover atribuição —</SelectItem>
                {patecsForSeason.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhum pacote vinculado a esta época. Vá ao separador <strong>Pacotes</strong> para vincular.
                  </div>
                ) : patecsForSeason.map((p) => (
                  <SelectItem key={p.id} value={p.code}>{p.code} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editPatecCode && (() => {
              const sel = patecs.find((p) => p.code === editPatecCode);
              if (!sel) return null;
              const legacy = sel.legacy_number;
              const meta = legacy ? patecMeta[legacy] : null;
              return (
                <div className="border rounded-lg p-3 text-xs space-y-2 bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{meta?.title || `${sel.code} — ${sel.name}`}</p>
                      {sel.cultures && <p className="text-muted-foreground">{sel.cultures}</p>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] shrink-0"
                      onClick={() => setComposingPatec(sel)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Ver composição completa
                    </Button>
                  </div>
                  {legacy && meta && (
                    <div className="max-h-[40vh] overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {["insumos", "pecuaria", "servicos"].map((cat) => {
                          const items = getItems(legacy, cat);
                          if (items.length === 0) return null;
                          return (
                            <div key={cat}>
                              <p className="font-medium text-muted-foreground mb-1">
                                {categoryLabels[cat]} <span className="text-[10px]">({items.length})</span>
                              </p>
                              <ul className="space-y-0.5">
                                {items.map((i) => <li key={i.id}>• {i.name}</li>)}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setEditFarmer(null)}>Cancelar</Button>
            <Button onClick={handleSavePatec} disabled={saving || patecsForSeason.length === 0}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk assign Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(o) => !o && setBulkDialogOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Atribuir PATEC em Lote</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Vai atribuir o mesmo PATEC a <span className="font-bold text-foreground">{selectedIds.size}</span> produtor{selectedIds.size > 1 ? "es" : ""} seleccionado{selectedIds.size > 1 ? "s" : ""}:
            </p>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 text-xs space-y-1 bg-muted/20">
              {filtered.filter((f) => selectedIds.has(f.id)).map((f) => {
                const p = findPatecByFarmer(f.patec_code, f.patec);
                return (
                  <div key={f.id} className="flex items-center justify-between">
                    <span><span className="font-mono text-muted-foreground">{f.code}</span> — {f.full_name}</span>
                    {p && <Badge variant="outline" className="text-[9px]">{p.code}</Badge>}
                  </div>
                );
              })}
            </div>
            <Select value={bulkPatecCode} onValueChange={setBulkPatecCode}>
              <SelectTrigger><SelectValue placeholder="Seleccionar PATEC para todos" /></SelectTrigger>
              <SelectContent>
                {patecsForSeason.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhum pacote vinculado a esta época.
                  </div>
                ) : patecsForSeason.map((p) => (
                  <SelectItem key={p.id} value={p.code}>{p.code} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {assignProgress && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">A atribuir... lote {assignProgress.batchesDone}/{assignProgress.batches}</span>
                <span className="text-muted-foreground">{assignProgress.done}/{assignProgress.total}</span>
              </div>
              <Progress value={assignProgress.total ? (assignProgress.done / assignProgress.total) * 100 : 0} />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-success" />{assignProgress.success} sucesso</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-destructive" />{assignProgress.failed} falhas</span>
              </div>
            </div>
          )}
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => setBulkConfirmOpen(true)} disabled={saving || !bulkPatecCode || patecsForSeason.length === 0}>
              {saving ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" />A atribuir...</>) : `Atribuir a ${selectedIds.size} produtor${selectedIds.size > 1 ? "es" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk confirm AlertDialog */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atribuição em lote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {(() => {
                  const selectedPatec = patecs.find((p) => p.code === bulkPatecCode);
                  return (
                    <>
                      <p>
                        Tem a certeza que deseja atribuir o seguinte pacote a <strong className="text-foreground">{selectedIds.size}</strong> produtor(es)?
                      </p>
                      <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
                        <p className="font-semibold text-foreground">
                          {selectedPatec?.code || bulkPatecCode || "—"}
                        </p>
                        {selectedPatec?.name && (
                          <p className="text-muted-foreground">{selectedPatec.name}</p>
                        )}
                        {selectedPatec?.cultures && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Culturas:</span> {selectedPatec.cultures}
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
                {(() => {
                  const selected = farmers.filter((f) => selectedIds.has(f.id));
                  const comPatec = selected.filter((f) => f.patec !== null && f.patec !== undefined);
                  const semPatec = selected.filter((f) => f.patec === null || f.patec === undefined);
                  return (
                    <ul className="list-disc list-inside space-y-0.5">
                      {semPatec.length > 0 && <li><strong>{semPatec.length}</strong> sem PATEC atribuído (nova atribuição)</li>}
                      {comPatec.length > 0 && <li><strong>{comPatec.length}</strong> já com PATEC atribuído (será alterado)</li>}
                    </ul>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setBulkConfirmOpen(false); handleBulkSave(); }} disabled={saving}>
              {saving ? "Guardando..." : "Confirmar Atribuição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Region bulk assign Dialog */}
      <Dialog open={regionDialogOpen} onOpenChange={(o) => { if (!o) setRegionDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Atribuir PATEC por região</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Atribua o mesmo PATEC a todos os produtores de uma ou mais Províncias, Municípios ou Escolas de Campo (ECA).
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Âmbito geográfico</label>
              <Select value={regionScope} onValueChange={(v: any) => { setRegionScope(v); setRegionValues([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="provincia">Por Província</SelectItem>
                  <SelectItem value="municipio">Por Município</SelectItem>
                  <SelectItem value="escola">Por Escola de Campo (ECA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Seleccionar {regionScope === "provincia" ? "províncias" : regionScope === "municipio" ? "municípios" : "escolas"}
              </label>
              {(() => {
                const key = regionScope === "provincia" ? "province" : regionScope === "municipio" ? "municipality" : "school";
                const counts = farmers.reduce<Record<string, number>>((acc, f) => {
                  const v = (f as any)[key];
                  if (!v) return acc;
                  acc[v] = (acc[v] || 0) + 1;
                  return acc;
                }, {});
                const options = Object.keys(counts).sort((a, b) => a.localeCompare(b));
                if (options.length === 0) {
                  return <p className="text-xs text-muted-foreground italic">Sem dados disponíveis no seu âmbito.</p>;
                }
                const allSelected = options.length > 0 && options.every((o) => regionValues.includes(o));
                return (
                  <div className="border rounded-lg max-h-64 overflow-y-auto divide-y">
                    <div className="flex items-center gap-2 p-2 bg-muted/30 sticky top-0">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => setRegionValues(allSelected ? [] : options)}
                        aria-label="Seleccionar todos"
                      />
                      <span className="text-xs font-medium">Seleccionar todos ({options.length})</span>
                    </div>
                    {options.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 p-2 hover:bg-muted/40 cursor-pointer text-sm">
                        <Checkbox
                          checked={regionValues.includes(opt)}
                          onCheckedChange={() => setRegionValues((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt])}
                          aria-label={opt}
                        />
                        <span className="flex-1">{opt}</span>
                        <Badge variant="secondary" className="text-[10px]">{counts[opt]} prod.</Badge>
                      </label>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">PATEC a atribuir</label>
              <Select value={regionPatecCode} onValueChange={setRegionPatecCode}>
                <SelectTrigger><SelectValue placeholder="Seleccionar PATEC" /></SelectTrigger>
                <SelectContent>
                  {patecsForSeason.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      Nenhum pacote vinculado a esta época.
                    </div>
                  ) : patecsForSeason.map((p) => (
                    <SelectItem key={p.id} value={p.code}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer border rounded-lg p-3 bg-muted/20">
              <Checkbox
                checked={regionOverwrite}
                onCheckedChange={(v) => setRegionOverwrite(!!v)}
                aria-label="Substituir atribuições existentes"
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <p className="font-medium">Substituir atribuições existentes</p>
                <p className="text-xs text-muted-foreground">
                  Se desmarcado, apenas produtores <strong>sem PATEC</strong> serão actualizados.
                </p>
              </div>
            </label>

            {/* Live preview panel */}
            <div className="border rounded-lg p-4 bg-primary/5 border-primary/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {regionScope === "provincia" ? "Províncias" : regionScope === "municipio" ? "Municípios" : "Escolas de Campo"} seleccionadas
                </h4>
                <Badge variant="outline" className="text-[10px]">{regionValues.length}</Badge>
              </div>
              {regionValues.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {regionValues.map((v) => (
                    <Badge key={v} variant="secondary" className="text-[11px] font-normal">
                      {v}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhuma selecção.</p>
              )}
              <div className="border-t border-primary/10 pt-3">
                {(() => {
                  const total = regionTargetFarmers.length;
                  const comPatec = regionTargetFarmers.filter((f) => f.patec_code || f.patec).length;
                  const semPatec = total - comPatec;
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total de produtores afectados</span>
                        <span className="font-bold text-primary text-xl">{total}</span>
                      </div>
                      {total > 0 && regionOverwrite && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-success" />
                            {semPatec} nova{semPatec === 1 ? "" : "s"} atribuição{semPatec === 1 ? "" : "es"}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-warning" />
                            {comPatec} substituição{comPatec === 1 ? "" : "es"}
                          </span>
                        </div>
                      )}
                      {total > 0 && !regionOverwrite && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="inline-block w-2 h-2 rounded-full bg-success" />
                          {total} nova{total === 1 ? "" : "s"} atribuição{total === 1 ? "" : "es"} (apenas produtores sem PATEC)
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          {assignProgress && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">A atribuir... lote {assignProgress.batchesDone}/{assignProgress.batches}</span>
                <span className="text-muted-foreground">{assignProgress.done}/{assignProgress.total}</span>
              </div>
              <Progress value={assignProgress.total ? (assignProgress.done / assignProgress.total) * 100 : 0} />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-success" />{assignProgress.success} sucesso</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-destructive" />{assignProgress.failed} falhas</span>
              </div>
            </div>
          )}
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setRegionDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              onClick={() => setRegionConfirmOpen(true)}
              disabled={saving || !regionPatecCode || regionTargetFarmers.length === 0 || patecsForSeason.length === 0}
            >
              {saving ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" />A atribuir...</>) : `Atribuir a ${regionTargetFarmers.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Region confirm */}
      <AlertDialog open={regionConfirmOpen} onOpenChange={setRegionConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atribuição por região</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Vai atribuir <strong className="text-foreground">{regionPatecCode || "—"}</strong> a{" "}
                  <strong className="text-foreground">{regionTargetFarmers.length}</strong> produtor(es)
                  {regionOverwrite ? " (incluindo os já atribuídos)" : " (apenas os sem PATEC)"}.
                </p>
                <p className="text-xs">Esta acção pode ser revertida individualmente em cada produtor.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegionAssign} disabled={saving}>
              {saving ? "A atribuir..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assignment final report */}
      <AlertDialog open={assignReportOpen} onOpenChange={setAssignReportOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {assignReport && assignReport.failed === 0 ? (
                <><Check className="w-5 h-5 text-success" /> Atribuição concluída</>
              ) : (
                <><AlertCircle className="w-5 h-5 text-destructive" /> Atribuição concluída com erros</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {assignReport && (
                  <>
                    <div className="border rounded-lg p-3 bg-muted/30 space-y-1 text-foreground">
                      <p><span className="text-muted-foreground">PATEC:</span> <strong>{assignReport.patecCode}</strong></p>
                      <p className="text-xs"><span className="text-muted-foreground">Âmbito:</span> {assignReport.scope}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="border rounded-lg p-2">
                        <div className="text-xl font-bold">{assignReport.total}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">Total</div>
                      </div>
                      <div className="border rounded-lg p-2 bg-success/10 border-success/30">
                        <div className="text-xl font-bold text-success">{assignReport.success}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">Sucesso</div>
                      </div>
                      <div className="border rounded-lg p-2 bg-destructive/10 border-destructive/30">
                        <div className="text-xl font-bold text-destructive">{assignReport.failed}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">Falhas</div>
                      </div>
                    </div>
                    {assignReport.errors.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-destructive">Erros ({assignReport.errors.length}):</p>
                        <div className="max-h-40 overflow-y-auto border rounded-lg p-2 bg-destructive/5 text-xs space-y-1 font-mono">
                          {assignReport.errors.map((e, i) => (
                            <div key={i} className="break-words">{e}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAssignReportOpen(false)}>Fechar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* View PATEC detail Dialog */}
      <PatecCompositionDialog
        open={composingPatec !== null}
        onOpenChange={(o) => !o && setComposingPatec(null)}
        patec={composingPatec}
      />

      <Dialog open={viewPatec !== null} onOpenChange={(o) => !o && setViewPatec(null)}>

        <DialogContent className="max-w-lg">
          {viewPatec && patecMeta[viewPatec] && (
            <>
              <DialogHeader>
                <DialogTitle>{patecMeta[viewPatec].title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 text-sm">
                {["insumos", "pecuaria", "servicos"].map((cat) => (
                  <div key={cat}>
                    <h3 className="font-semibold mb-2 text-primary">{categoryLabels[cat]}</h3>
                    <ul className="space-y-1">
                      {getItems(viewPatec, cat).map((i) => (
                        <li key={i.id} className="flex items-center justify-between group">
                          <span className="flex items-start gap-2"><span className="text-primary">•</span>{i.name}</span>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                              onClick={() => handleDeleteItem(i)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {isAdmin && (
                      <div className="mt-2">
                        {addingCategory?.patec === viewPatec && addingCategory?.category === cat ? (
                          <div className="flex gap-1">
                            <Input
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              placeholder="Nome do item..."
                              className="h-7 text-xs"
                              autoFocus
                              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                            />
                            <Button size="sm" className="h-7 text-xs px-2" onClick={handleAddItem} disabled={!newItemName.trim()}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setAddingCategory(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-primary"
                            onClick={() => { setAddingCategory({ patec: viewPatec, category: cat }); setNewItemName(""); }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Adicionar item
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-xs text-muted-foreground border-t pt-3">
                  Produtores com este pacote: <span className="font-bold">{farmers.filter((f) => f.patec === viewPatec).length}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Random reassign confirmation */}
      <AlertDialog open={randomConfirmOpen} onOpenChange={setRandomConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shuffle className="h-5 w-5 text-primary" /> Reatribuir aleatoriamente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Vai distribuir aleatoriamente (equilibrado) <strong className="text-foreground">{semPatecPool.length}</strong>{" "}
                  produtor(es) sem PATEC pelos{" "}
                  <strong className="text-foreground">{patecsForSeason.length}</strong> PATEC(s) disponíveis para a época{" "}
                  <strong className="text-foreground">
                    {selectedSeasonId === "all" ? "(todas)" : (seasons.find((s) => s.id === selectedSeasonId)?.name || "—")}
                  </strong>
                  {filterProvince !== "all" ? <> em <strong className="text-foreground">{filterProvince}</strong></> : null}.
                </p>
                {patecsForSeason.length === 0 && (
                  <p className="text-xs text-destructive">
                    Não existem PATECs vinculados a esta época. Vincule pacotes à época antes de continuar.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Os produtores que já têm PATEC atribuído não serão alterados.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRandomReassign} disabled={saving || semPatecPool.length === 0}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />A reatribuir...</> : "Reatribuir agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Random reassign report */}
      <Dialog open={!!randomReport} onOpenChange={(o) => !o && setRandomReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" /> Relatório de Reatribuição
            </DialogTitle>
          </DialogHeader>
          {randomReport && (() => {
            const t = randomReport.total;
            const pct = (n: number) => (t > 0 ? ((n / t) * 100).toFixed(1).replace(".", ",") + "%" : "—");
            return (
              <div className="space-y-3 py-2 text-sm">
                <p className="text-muted-foreground">
                  Âmbito: <span className="font-medium text-foreground">{randomReport.province}</span>
                  {" · "}Época: <span className="font-medium text-foreground">{randomReport.season}</span>
                </p>
                <p>
                  <strong className="text-foreground">{t}</strong> produtor(es) reatribuídos aleatoriamente de forma equilibrada.
                </p>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  {randomReport.distribution.map((d) => (
                    <div key={d.code} className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">
                        <span className="font-mono text-xs mr-1.5">{d.code}</span>{d.name}
                      </span>
                      <Badge variant="outline" className="shrink-0">{d.count} · {pct(d.count)}</Badge>
                    </div>
                  ))}
                </div>
                {randomReport.distribution.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Diferença máxima entre pacotes: <strong className="text-foreground">
                      {Math.max(...randomReport.distribution.map((d) => d.count)) - Math.min(...randomReport.distribution.map((d) => d.count))}
                    </strong> produtor(es) (ideal ≤ 1 com distribuição equilibrada).
                  </p>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setRandomReport(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Patec;
