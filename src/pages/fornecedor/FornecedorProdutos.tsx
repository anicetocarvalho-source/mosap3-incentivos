import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

const patecLabels: Record<string, string> = { "1": "PATEC 1 — Milho", "2": "PATEC 2 — Massango", "3": "PATEC 3 — Massambala" };

const FornecedorProdutos = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  const [products, setProducts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "insumos", unit: "un", price: "", stock: "", iva_rate: "14", patec_number: "", max_per_farmer_per_season: "" });

  const fetch = async () => {
    const { data } = await supabase.from("supplier_products").select("*").eq("supplier_id", supplier.id).order("name");
    setProducts(data || []);
  };

  useEffect(() => { fetch(); }, [supplier.id]);

  const openNew = () => { setEditing(null); setForm({ name: "", category: "insumos", unit: "un", price: "", stock: "", iva_rate: "14", patec_number: "", max_per_farmer_per_season: "" }); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, category: p.category, unit: p.unit, price: String(p.price), stock: String(p.stock), iva_rate: String(p.iva_rate), patec_number: p.patec_number ? String(p.patec_number) : "", max_per_farmer_per_season: p.max_per_farmer_per_season ? String(p.max_per_farmer_per_season) : "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error("Nome e preço são obrigatórios"); return; }
    const payload = {
      supplier_id: supplier.id,
      name: form.name,
      category: form.category,
      unit: form.unit,
      price: parseFloat(form.price),
      stock: parseInt(form.stock) || 0,
      iva_rate: parseFloat(form.iva_rate) || 14,
      patec_number: form.patec_number ? parseInt(form.patec_number) : null,
      max_per_farmer_per_season: form.max_per_farmer_per_season ? parseInt(form.max_per_farmer_per_season) : null,
    };
    if (editing) {
      await supabase.from("supplier_products").update(payload).eq("id", editing.id);
      toast.success("Produto actualizado");
    } else {
      await supabase.from("supplier_products").insert(payload);
      toast.success("Produto adicionado");
    }
    setDialogOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("supplier_products").delete().eq("id", id);
    toast.success("Produto removido");
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Catálogo de Produtos</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>PATEC</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Limite/Época</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                  <TableCell>{p.patec_number ? `PATEC ${p.patec_number}` : "—"}</TableCell>
                  <TableCell className="text-right">{Number(p.price).toLocaleString("pt-AO")} Kz</TableCell>
                  <TableCell className="text-right">{p.stock}</TableCell>
                  <TableCell className="text-right">{p.max_per_farmer_per_season ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum produto registado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="insumos">Insumos</SelectItem><SelectItem value="pecuaria">Pecuária</SelectItem><SelectItem value="servicos">Serviços</SelectItem><SelectItem value="equipamentos">Equipamentos</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>PATEC</Label>
                <Select value={form.patec_number} onValueChange={(v) => setForm({ ...form, patec_number: v })}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent><SelectItem value="1">PATEC 1</SelectItem><SelectItem value="2">PATEC 2</SelectItem><SelectItem value="3">PATEC 3</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Preço (Kz) *</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
              <div><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>IVA (%)</Label><Input type="number" value={form.iva_rate} onChange={(e) => setForm({ ...form, iva_rate: e.target.value })} /></div>
              <div><Label>Limite/produtor/época</Label><Input type="number" value={form.max_per_farmer_per_season} onChange={(e) => setForm({ ...form, max_per_farmer_per_season: e.target.value })} placeholder="Sem limite" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Guardar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedorProdutos;
