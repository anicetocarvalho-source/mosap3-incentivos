import { useState, useEffect } from "react";
import { Store, Plus, Search, Edit2, Package, Monitor, Trash2, Eye, MapPin, X } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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

  const fetchSuppliers = async () => {
    setLoading(true);
    const [suppRes, zonesRes] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("supplier_provinces").select("supplier_id, province_id, provinces(id, name)"),
    ]);
    const rawSuppliers = (suppRes.data || []) as Supplier[];
    const zonesMap = new Map<string, Province[]>();
    for (const row of (zonesRes.data || []) as any[]) {
      const sid = row.supplier_id;
      if (!zonesMap.has(sid)) zonesMap.set(sid, []);
      if (row.provinces) zonesMap.get(sid)!.push({ id: row.provinces.id, name: row.provinces.name });
    }
    setSuppliers(rawSuppliers.map(s => ({ ...s, zones: zonesMap.get(s.id) || [] })));
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

    // Sync zones
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

  // Product CRUD
  const handleSaveProduct = async () => {
    if (!selectedSupplier || !editProduct.name) return;
    const payload = {
      supplier_id: selectedSupplier.id,
      name: editProduct.name,
      category: editProduct.category || "insumos",
      unit: editProduct.unit || "un",
      price: editProduct.price || 0,
      stock: editProduct.stock || 0,
      patec_number: editProduct.patec_number || null,
      patec_category: editProduct.patec_category || null,
      iva_rate: editProduct.iva_rate || 14,
      max_per_farmer_per_season: editProduct.max_per_farmer_per_season || null,
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

  // POS CRUD
  const handleSavePos = async () => {
    if (!selectedSupplier || !editPos.pos_code) return;
    const payload = {
      supplier_id: selectedSupplier.id,
      pos_code: editPos.pos_code,
      label: editPos.label || null,
      location: editPos.location || null,
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

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.nif?.toLowerCase().includes(search.toLowerCase()) || false
  );

  if (selectedSupplier) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSupplier(null)}>← Voltar</Button>
          <div>
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" /> {selectedSupplier.name}
            </h1>
            <p className="text-xs text-muted-foreground">NIF: {selectedSupplier.nif || "—"} • {selectedSupplier.phone || "—"} • {selectedSupplier.province || "—"}</p>
          </div>
          <Badge variant={selectedSupplier.status === "Ativo" ? "default" : "secondary"}>{selectedSupplier.status}</Badge>
        </div>

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
                        <TableCell><Badge variant={t.status === "Ativo" ? "default" : "secondary"} className="text-[10px]">{t.status}</Badge></TableCell>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por nome ou NIF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="col-span-full text-center text-muted-foreground py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground py-8">Nenhum fornecedor encontrado</p>
        ) : filtered.map((s) => (
          <Card key={s.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setSelectedSupplier(s)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{s.name}</h3>
                <Badge variant={s.status === "Ativo" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>NIF: {s.nif || "—"}</p>
                <p>Telefone: {s.phone || "—"}</p>
                <p>Província (sede): {s.province || "—"}</p>
                {s.zones && s.zones.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                    {s.zones.map(z => (
                      <Badge key={z.id} variant="outline" className="text-[9px] px-1 py-0">{z.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3">
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
        ))}
      </div>

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
