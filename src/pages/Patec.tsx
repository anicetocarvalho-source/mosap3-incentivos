import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Package, Search, Filter, Edit2, Eye, CheckSquare, X, Plus, Trash2, Pencil, Check, ChevronLeft, ChevronRight, Wheat, Loader2, Users, AlertCircle, Sprout, Leaf, TreeDeciduous, BarChart, MapPin, Shuffle, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowsSkeleton, CardListSkeleton } from "@/components/ui/loading-skeletons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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

const patecMeta: Record<number, { title: string; color: string; cultures: string; icon: any; gradient: string; bgAccent: string }> = {
  1: { title: "PATEC 1 — Milho + Feijão + Gado", color: "bg-amber-100 text-amber-800 border-amber-300", cultures: "Milho + Feijão", icon: Wheat, gradient: "from-amber-500 to-orange-500", bgAccent: "bg-amber-50 dark:bg-amber-950/30" },
  2: { title: "PATEC 2 — Massango + Feijão + Gado", color: "bg-emerald-100 text-emerald-800 border-emerald-300", cultures: "Massango + Feijão", icon: Sprout, gradient: "from-emerald-500 to-teal-500", bgAccent: "bg-emerald-50 dark:bg-emerald-950/30" },
  3: { title: "PATEC 3 — Massambala + Feijão + Gado", color: "bg-violet-100 text-violet-800 border-violet-300", cultures: "Massambala + Feijão", icon: Leaf, gradient: "from-violet-500 to-purple-500", bgAccent: "bg-violet-50 dark:bg-violet-950/30" },
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

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkPatecCode, setBulkPatecCode] = useState<string>("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Season selector for assignment
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("all");

  // Add item state
  const [addingCategory, setAddingCategory] = useState<{ patec: number; category: string } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("kg");

  // Edit item state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");

  // New: pacotes & épocas
  const { patecs, refetch: refetchPatecs } = usePatecs();
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
    const { data } = await supabase
      .from("patec_items")
      .select("*")
      .order("created_at");
    setPatecItems((data as PatecItem[]) || []);
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

  const filtered = farmersByProvince.filter((f) => {
    const matchesSearch =
      f.full_name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase());
    const matchesPatec =
      filterPatec === "all" ||
      (filterPatec === "none" && !f.patec) ||
      String(f.patec) === filterPatec;
    return matchesSearch && matchesPatec;
  });

  const stats = {
    total: farmersByProvince.length,
    patec1: farmersByProvince.filter((f) => f.patec === 1).length,
    patec2: farmersByProvince.filter((f) => f.patec === 2).length,
    patec3: farmersByProvince.filter((f) => f.patec === 3).length,
    semPatec: farmersByProvince.filter((f) => !f.patec).length,
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
    let errorCount = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { error } = await supabase
        .from("farmers")
        .update({ patec_code: selected.code, patec: selected.legacy_number ?? null })
        .in("id", batch);
      if (error) errorCount++;
    }
    setSaving(false);
    setBulkDialogOpen(false);
    setBulkPatecCode("");
    if (errorCount > 0) {
      toast.error(`Erro ao atribuir PATEC a alguns produtores`);
    } else {
      toast.success(`${selected.code} atribuído a ${ids.length} produtor(es)`);
    }
    setSelectedIds(new Set());
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

      {/* Stats cards — visual upgrade */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className={`cursor-pointer transition-all hover:shadow-md ${filterPatec === "all" ? "ring-2 ring-primary/30 border-primary/50" : "hover:border-primary/30"}`} onClick={() => setFilterPatec("all")}>
          <CardContent className="p-4 text-center">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Produtores</p>
          </CardContent>
        </Card>
        {[1, 2, 3].map((p) => {
          const meta = patecMeta[p];
          const Icon = meta.icon;
          const count = p === 1 ? stats.patec1 : p === 2 ? stats.patec2 : stats.patec3;
          const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
          return (
            <Card key={p} className={`cursor-pointer transition-all hover:shadow-md ${filterPatec === String(p) ? "ring-2 ring-primary/30 border-primary/50" : "hover:border-primary/30"}`} onClick={() => setFilterPatec(String(p))}>
              <CardContent className="p-4 text-center">
                <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center mx-auto mb-2`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">PATEC {p}</p>
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${meta.gradient}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{pct}% • {meta.cultures}</p>
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

      {/* Validação de distribuição (terços) */}
      {(() => {
        const assigned = stats.patec1 + stats.patec2 + stats.patec3;
        if (assigned === 0) return null;
        const pct = (n: number) => (assigned > 0 ? (n / assigned) * 100 : 0);
        const p1 = pct(stats.patec1), p2 = pct(stats.patec2), p3 = pct(stats.patec3);
        const fmt = (v: number) => v.toFixed(1).replace(".", ",") + "%";
        const maxDev = Math.max(Math.abs(p1 - 33.33), Math.abs(p2 - 33.33), Math.abs(p3 - 33.33));
        const balanced = maxDev <= 2;
        const semPct = stats.total > 0 ? (stats.semPatec / stats.total) * 100 : 0;
        return (
          <Card className={balanced ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {balanced ? (
                    <Check className="h-5 w-5 text-success" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-warning" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {balanced ? "Distribuição equilibrada em terços" : "Distribuição desequilibrada"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ideal: 33,3% por pacote · desvio máximo {fmt(maxDev)} {balanced ? "(≤ 2pp)" : "(> 2pp)"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Badge variant="outline">PATEC 1: <strong className="ml-1">{stats.patec1}</strong> · {fmt(p1)}</Badge>
                  <Badge variant="outline">PATEC 2: <strong className="ml-1">{stats.patec2}</strong> · {fmt(p2)}</Badge>
                  <Badge variant="outline">PATEC 3: <strong className="ml-1">{stats.patec3}</strong> · {fmt(p3)}</Badge>
                  <Badge variant={stats.semPatec === 0 ? "outline" : "destructive"}>
                    Sem PATEC: <strong className="ml-1">{stats.semPatec}</strong> · {fmt(semPct)}
                  </Badge>
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
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Gráfico de distribuição PATEC */}
      {stats.total > 0 && (
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <BarChart className="h-4 w-4 text-primary" />
            Distribuição dos Pacotes
          </h2>
          <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[var(--shadow-card)]">
            <ResponsiveContainer width="100%" height={260}>
              <RechartsBarChart data={[
                { name: "PATEC 1", value: stats.patec1, fill: "hsl(38, 92%, 50%)" },
                { name: "PATEC 2", value: stats.patec2, fill: "hsl(160, 84%, 39%)" },
                { name: "PATEC 3", value: stats.patec3, fill: "hsl(263, 70%, 50%)" },
                { name: "Sem PATEC", value: stats.semPatec, fill: "hsl(var(--destructive))" },
              ]} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [v.toLocaleString("pt-AO"), "Agricultores"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {[
                    { fill: "hsl(38, 92%, 50%)" },
                    { fill: "hsl(160, 84%, 39%)" },
                    { fill: "hsl(263, 70%, 50%)" },
                    { fill: "hsl(var(--destructive))" },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Composition - compact list */}
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <TreeDeciduous className="h-4 w-4 text-primary" />
          Composição dos Pacotes
        </h2>
        <Card>
          <div className="divide-y">
            {[1, 2, 3].map((p) => {
              const meta = patecMeta[p];
              const Icon = meta.icon;
              const totalItems =
                getItems(p, "insumos").length +
                getItems(p, "pecuaria").length +
                getItems(p, "servicos").length;
              return (
                <div key={p} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center shrink-0`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">
                      PATEC {p} <span className="text-muted-foreground font-normal">— {meta.cultures} + Gado</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {totalItems} {totalItems === 1 ? "item" : "itens"}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewPatec(p)}>
                    <Eye className="h-3 w-3 mr-1" /> Detalhes
                  </Button>
                </div>
              );
            })}
          </div>
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
              <SelectItem value="1">🌾 PATEC 1 — Milho</SelectItem>
              <SelectItem value="2">🌱 PATEC 2 — Massango</SelectItem>
              <SelectItem value="3">🍃 PATEC 3 — Massambala</SelectItem>
              <SelectItem value="none">⚠️ Sem PATEC</SelectItem>
            </SelectContent>
          </Select>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir PATEC — {editFarmer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                  <p className="font-semibold">{meta?.title || `${sel.code} — ${sel.name}`}</p>
                  {sel.cultures && <p className="text-muted-foreground">{sel.cultures}</p>}
                  {legacy && meta && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {["insumos", "pecuaria", "servicos"].map((cat) => (
                        <div key={cat}>
                          <p className="font-medium text-muted-foreground mb-1">{categoryLabels[cat]}</p>
                          <ul className="space-y-0.5">
                            {getItems(legacy, cat).map((i) => <li key={i.id}>• {i.name}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFarmer(null)}>Cancelar</Button>
            <Button onClick={handleSavePatec} disabled={saving || patecsForSeason.length === 0}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk assign Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(o) => !o && setBulkDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir PATEC em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Vai atribuir o mesmo PATEC a <span className="font-bold text-foreground">{selectedIds.size}</span> produtor{selectedIds.size > 1 ? "es" : ""} seleccionado{selectedIds.size > 1 ? "s" : ""}:
            </p>
            <div className="max-h-32 overflow-y-auto border rounded-lg p-2 text-xs space-y-1 bg-muted/20">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => setBulkConfirmOpen(true)} disabled={saving || !bulkPatecCode || patecsForSeason.length === 0}>
              {`Atribuir a ${selectedIds.size} produtor${selectedIds.size > 1 ? "es" : ""}`}
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

      {/* View PATEC detail Dialog */}
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
