import { useState, useEffect, useMemo } from "react";
import { Store, Plus, Search, Edit2, Package, Monitor, Trash2, Eye, MapPin, X, CheckCircle, LayoutGrid, List, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import { motion } from "framer-motion";

interface Province {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
  nif: string | null;
  phone: string | null;
  email: string | null;
  province: string | null;
  status: string;
  user_id: string;
  zones?: Province[];
}

interface Product {
  id: string;
  supplier_id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  patec_number: number | null;
  patec_category: string | null;
  max_per_farmer_per_season: number | null;
  iva_rate: number;
  status: string;
}

interface PosTerminal {
  id: string;
  supplier_id: string;
  pos_code: string;
  label: string | null;
  location: string | null;
  operator_name: string | null;
  status: string;
}

const Mosap3PayFornecedores = () => {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  // Province list
  const [allProvinces, setAllProvinces] = useState<Province[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  // Detail view
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [posTerminals, setPosTerminals] = useState<PosTerminal[]>([]);

  // Product dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Partial<Product>>({});

  // POS dialog
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [editPos, setEditPos] = useState<Partial<PosTerminal>>({});

  // Supplier form
  const [form, setForm] = useState({ name: "", nif: "", phone: "", email: "", province: "" });

  // KPI counts
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPos, setTotalPos] = useState(0);

  // View toggle & filters
  const [viewMode, setViewMode] = useState<string>("grid");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvince, setFilterProvince] = useState("all");
  const [filterZone, setFilterZone] = useState("all");

  const fetchSuppliers = async () => {
    setLoading(true);
    const [suppRes, zonesRes, prodCountRes, posCountRes] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("supplier_provinces").select("supplier_id, province_id, provinces(id, name)"),
      supabase.from("supplier_products").select("id", { count: "exact", head: true }),
      supabase.from("supplier_pos").select("id", { count: "exact", head: true }),
    ]);
    const rawSuppliers = (suppRes.data || []) as Supplier[];
    const zonesMap = new Map<string, Province[]>();
    for (const row of (zonesRes.data || []) as any[]) {
      const sid = row.supplier_id;
      if (!zonesMap.has(sid)) zonesMap.set(sid, []);
      if (row.provinces) zonesMap.get(sid)!.push({ id: row.provinces.id, name: row.provinces.name });
    }
    setSuppliers(rawSuppliers.map(s => ({ ...s, zones: zonesMap.get(s.id) || [] })));
    setTotalProducts(prodCountRes.count || 0);
    setTotalPos(posCountRes.count || 0);
    setLoading(false);
  };

  const fetchProvinces = async () => {
    const { data } = await supabase.from("provinces").select("id, name").order("name");
    setAllProvinces((data as Province[]) || []);
  };

  const fetchSupplierDetails = async (supplierId: string) => {
    const [prodRes, posRes] = await Promise.all([
      supabase.from("supplier_products").select("*").eq("supplier_id", supplierId).order("name"),
      supabase.from("supplier_pos").select("*").eq("supplier_id", supplierId).order("pos_code"),
    ]);
    setProducts((prodRes.data as Product[]) || []);
    setPosTerminals((posRes.data as PosTerminal[]) || []);
  };

  useEffect(() => { fetchSuppliers(); fetchProvinces(); }, []);

  useEffect(() => {
    if (selectedSupplier) fetchSupplierDetails(selectedSupplier.id);
  }, [selectedSupplier]);

  // --- KPI derived values ---
  const activeCount = useMemo(() => suppliers.filter(s => s.status === "Ativo").length, [suppliers]);
  const inactiveCount = useMemo(() => suppliers.filter(s => s.status !== "Ativo").length, [suppliers]);

  // --- Filtering ---
  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.nif?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchStatus = filterStatus === "all" || s.status === filterStatus;
      const matchProvince = filterProvince === "all" || s.province === filterProvince;
      const matchZone = filterZone === "all" || s.zones?.some(z => z.id === filterZone);
      return matchSearch && matchStatus && matchProvince && matchZone;
    });
  }, [suppliers, search, filterStatus, filterProvince, filterZone]);

  const uniqueProvinceNames = useMemo(() => {
    const set = new Set(suppliers.map(s => s.province).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [suppliers]);

  // --- CRUD handlers (unchanged) ---
  const handleSaveSupplier = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    let supplierId: string;
    if (editSupplier) {
      const { error } = await supabase.from("suppliers").update({
        name: form.name, nif: form.nif || null, phone: form.phone || null,
        email: form.email || null, province: form.province || null,
      }).eq("id", editSupplier.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      supplierId = editSupplier.id;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("suppliers").insert({
        name: form.name, nif: form.nif || null, phone: form.phone || null,
        email: form.email || null, province: form.province || null,
        user_id: user?.id || "",
      }).select("id").single();
      if (error || !data) { toast.error("Erro ao criar fornecedor"); return; }
      supplierId = data.id;
    }
    await supabase.from("supplier_provinces").delete().eq("supplier_id", supplierId);
    if (selectedZones.length > 0) {
      await supabase.from("supplier_provinces").insert(
        selectedZones.map(pid => ({ supplier_id: supplierId, province_id: pid }))
      );
    }
    toast.success(editSupplier ? "Fornecedor atualizado" : "Fornecedor criado");
    setDialogOpen(false);
    setEditSupplier(null);
    fetchSuppliers();
  };

  const openEditDialog = (s: Supplier) => {
    setEditSupplier(s);
    setForm({ name: s.name, nif: s.nif || "", phone: s.phone || "", email: s.email || "", province: s.province || "" });
    setSelectedZones(s.zones?.map(z => z.id) || []);
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditSupplier(null);
    setForm({ name: "", nif: "", phone: "", email: "", province: "" });
    setSelectedZones([]);
    setDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!selectedSupplier || !editProduct.name) return;
    const payload = {
      supplier_id: selectedSupplier.id, name: editProduct.name,
      category: editProduct.category || "insumos", unit: editProduct.unit || "un",
      price: editProduct.price || 0, stock: editProduct.stock || 0,
      patec_number: editProduct.patec_number || null, patec_category: editProduct.patec_category || null,
      iva_rate: editProduct.iva_rate || 14, max_per_farmer_per_season: editProduct.max_per_farmer_per_season || null,
    };
    if (editProduct.id) {
      await supabase.from("supplier_products").update(payload).eq("id", editProduct.id);
      toast.success("Produto atualizado");
    } else {
      await supabase.from("supplier_products").insert(payload);
      toast.success("Produto adicionado");
    }
    setProductDialogOpen(false);
    fetchSupplierDetails(selectedSupplier.id);
  };

  const handleDeleteProduct = async (id: string) => {
    await supabase.from("supplier_products").delete().eq("id", id);
    toast.success("Produto removido");
    if (selectedSupplier) fetchSupplierDetails(selectedSupplier.id);
  };

  const handleSavePos = async () => {
    if (!selectedSupplier || !editPos.pos_code) return;
    const payload = {
      supplier_id: selectedSupplier.id, pos_code: editPos.pos_code,
      label: editPos.label || null, location: editPos.location || null,
      operator_name: editPos.operator_name || null,
    };
    if (editPos.id) {
      await supabase.from("supplier_pos").update(payload).eq("id", editPos.id);
      toast.success("Terminal atualizado");
    } else {
      await supabase.from("supplier_pos").insert(payload);
      toast.success("Terminal adicionado");
    }
    setPosDialogOpen(false);
    fetchSupplierDetails(selectedSupplier.id);
  };

  // ===================== DETAIL VIEW =====================
  if (selectedSupplier) {
    return (
      <div className="space-y-6">
        {/* Enhanced detail header */}
        <Card className="border-none shadow-md bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedSupplier(null)}>
                  ←
                </Button>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-heading font-bold">{selectedSupplier.name}</h1>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>NIF: {selectedSupplier.nif || "—"}</span>
                    <span>•</span>
                    <span>{selectedSupplier.phone || "—"}</span>
                    <span>•</span>
                    <span>{selectedSupplier.province || "—"}</span>
                  </div>
                  {selectedSupplier.zones && selectedSupplier.zones.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1.5">
                      <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                      {selectedSupplier.zones.map(z => (
                        <Badge key={z.id} variant="outline" className="text-[9px] px-1.5 py-0">{z.name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Badge
                className={`text-xs px-3 py-1 ${selectedSupplier.status === "Ativo" ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" : "bg-muted text-muted-foreground"}`}
                variant="outline"
              >
                {selectedSupplier.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="produtos">
          <TabsList>
            <TabsTrigger value="produtos"><Package className="h-3 w-3 mr-1" /> Produtos ({products.length})</TabsTrigger>
            <TabsTrigger value="pos"><Monitor className="h-3 w-3 mr-1" /> Terminais POS ({posTerminals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setEditProduct({}); setProductDialogOpen(true); }}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar Produto
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>PATEC</TableHead>
                      <TableHead>Limite/Época</TableHead>
                      <TableHead className="text-right">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum produto cadastrado</TableCell></TableRow>
                    ) : products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{p.category}</Badge></TableCell>
                        <TableCell>{Number(p.price).toLocaleString("pt-AO")} Kz</TableCell>
                        <TableCell>{p.stock} {p.unit}</TableCell>
                        <TableCell>{p.patec_number ? `PATEC ${p.patec_number}` : "Todos"}</TableCell>
                        <TableCell>{p.max_per_farmer_per_season ?? "Sem limite"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => { setEditProduct(p); setProductDialogOpen(true); }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => handleDeleteProduct(p.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pos" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setEditPos({}); setPosDialogOpen(true); }}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar Terminal
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Operador</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posTerminals.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum terminal cadastrado</TableCell></TableRow>
                    ) : posTerminals.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.pos_code}</TableCell>
                        <TableCell>{t.label || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{t.location || "—"}</TableCell>
                        <TableCell className="text-sm">{t.operator_name || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${t.status === "Ativo" ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                          >
                            {t.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Product Dialog */}
        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editProduct.id ? "Editar" : "Novo"} Produto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={editProduct.name || ""} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={editProduct.category || "insumos"} onValueChange={(v) => setEditProduct({ ...editProduct, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insumos">Insumos</SelectItem>
                      <SelectItem value="pecuaria">Pecuária</SelectItem>
                      <SelectItem value="servicos">Serviços</SelectItem>
                      <SelectItem value="equipamento">Equipamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Unidade</Label><Input value={editProduct.unit || "un"} onChange={(e) => setEditProduct({ ...editProduct, unit: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço (Kz)</Label><Input type="number" value={editProduct.price || ""} onChange={(e) => setEditProduct({ ...editProduct, price: Number(e.target.value) })} /></div>
                <div><Label>Stock</Label><Input type="number" value={editProduct.stock || ""} onChange={(e) => setEditProduct({ ...editProduct, stock: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>PATEC elegível</Label>
                  <Select value={editProduct.patec_number ? String(editProduct.patec_number) : "all"} onValueChange={(v) => setEditProduct({ ...editProduct, patec_number: v === "all" ? null : Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os PATEC</SelectItem>
                      <SelectItem value="1">PATEC 1 — Milho</SelectItem>
                      <SelectItem value="2">PATEC 2 — Massango</SelectItem>
                      <SelectItem value="3">PATEC 3 — Massambala</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Limite por produtor/época</Label>
                  <Input type="number" placeholder="Sem limite" value={editProduct.max_per_farmer_per_season ?? ""} onChange={(e) => setEditProduct({ ...editProduct, max_per_farmer_per_season: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div><Label>IVA (%)</Label><Input type="number" value={editProduct.iva_rate ?? 14} onChange={(e) => setEditProduct({ ...editProduct, iva_rate: Number(e.target.value) })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveProduct} disabled={!editProduct.name}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* POS Dialog */}
        <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editPos.id ? "Editar" : "Novo"} Terminal POS</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Código POS *</Label><Input value={editPos.pos_code || ""} onChange={(e) => setEditPos({ ...editPos, pos_code: e.target.value })} placeholder="POS001" /></div>
              <div><Label>Nome/Label</Label><Input value={editPos.label || ""} onChange={(e) => setEditPos({ ...editPos, label: e.target.value })} /></div>
              <div><Label>Localização</Label><Input value={editPos.location || ""} onChange={(e) => setEditPos({ ...editPos, location: e.target.value })} /></div>
              <div><Label>Operador</Label><Input value={editPos.operator_name || ""} onChange={(e) => setEditPos({ ...editPos, operator_name: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPosDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSavePos} disabled={!editPos.pos_code}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===================== LIST VIEW =====================
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> Fornecedores
          </h1>
          <p className="text-muted-foreground text-sm">Gestão de fornecedores, catálogo e terminais POS</p>
        </div>
        {isAdmin && (
          <Button onClick={openNewDialog}>
            <Plus className="h-4 w-4 mr-2" /> Novo Fornecedor
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Total Fornecedores"
          value={String(suppliers.length)}
          icon={Store}
          iconBg="hsl(var(--primary))"
        />
        <StatCard
          title="Ativos"
          value={String(activeCount)}
          change={inactiveCount > 0 ? `${inactiveCount} inativos` : "Todos ativos"}
          changeType={inactiveCount > 0 ? "neutral" : "positive"}
          icon={CheckCircle}
          iconBg="hsl(142 71% 45%)"
        />
        <StatCard
          title="Total Produtos"
          value={String(totalProducts)}
          icon={Package}
          iconBg="hsl(262 83% 58%)"
        />
        <StatCard
          title="Terminais POS"
          value={String(totalPos)}
          icon={Monitor}
          iconBg="hsl(25 95% 53%)"
        />
      </div>

      {/* Search + Filters + View toggle */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome ou NIF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterProvince} onValueChange={setFilterProvince}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Província (sede)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas províncias</SelectItem>
              {uniqueProvinceNames.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Zona actuação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas zonas</SelectItem>
              {allProvinces.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v)} className="border rounded-md">
            <ToggleGroupItem value="grid" size="sm" className="h-9 w-9 p-0">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" size="sm" className="h-9 w-9 p-0">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum fornecedor encontrado</p>
      ) : viewMode === "grid" ? (
        /* ===== GRID VIEW ===== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer group" onClick={() => setSelectedSupplier(s)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Store className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm leading-tight">{s.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{s.province || "Sem província"}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${s.status === "Ativo" ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" : "bg-muted text-muted-foreground"}`}
                    >
                      {s.status}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 mb-3">
                    <div className="flex justify-between">
                      <span>NIF</span>
                      <span className="font-medium text-foreground">{s.nif || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Telefone</span>
                      <span className="font-medium text-foreground">{s.phone || "—"}</span>
                    </div>
                  </div>

                  {s.zones && s.zones.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-3">
                      <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                      {s.zones.slice(0, 3).map(z => (
                        <Badge key={z.id} variant="outline" className="text-[9px] px-1.5 py-0">{z.name}</Badge>
                      ))}
                      {s.zones.length > 3 && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">+{s.zones.length - 3}</Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={(e) => { e.stopPropagation(); setSelectedSupplier(s); }}>
                      <Eye className="h-3 w-3 mr-1" /> Detalhes
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openEditDialog(s); }}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        /* ===== TABLE VIEW ===== */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Província</TableHead>
                  <TableHead className="hidden lg:table-cell">Zonas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedSupplier(s)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Store className="h-3.5 w-3.5 text-primary" />
                        </div>
                        {s.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.nif || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{s.phone || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{s.province || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {s.zones?.slice(0, 2).map(z => (
                          <Badge key={z.id} variant="outline" className="text-[9px] px-1.5 py-0">{z.name}</Badge>
                        ))}
                        {(s.zones?.length || 0) > 2 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">+{(s.zones?.length || 0) - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${s.status === "Ativo" ? "bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" : "bg-muted text-muted-foreground"}`}
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7" onClick={(e) => { e.stopPropagation(); setSelectedSupplier(s); }}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" className="h-7" onClick={(e) => { e.stopPropagation(); openEditDialog(s); }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSupplier ? "Editar" : "Novo"} Fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NIF</Label><Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Província (sede)</Label><Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></div>
            <div>
              <Label className="flex items-center gap-1 mb-2"><MapPin className="h-3.5 w-3.5" /> Zona de Actuação</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-background">
                {allProvinces.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Carregando províncias...</p>
                ) : allProvinces.map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedZones.includes(p.id)}
                      onCheckedChange={(checked) => {
                        setSelectedZones(prev =>
                          checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                        );
                      }}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
              {selectedZones.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedZones.map(zid => {
                    const prov = allProvinces.find(p => p.id === zid);
                    return prov ? (
                      <Badge key={zid} variant="secondary" className="text-[10px] gap-1">
                        {prov.name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedZones(prev => prev.filter(id => id !== zid))} />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSupplier} disabled={!form.name.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayFornecedores;
