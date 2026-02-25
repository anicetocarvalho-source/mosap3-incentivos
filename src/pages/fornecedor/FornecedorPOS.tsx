import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Monitor, Pencil } from "lucide-react";
import { toast } from "sonner";

const FornecedorPOS = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  const [terminals, setTerminals] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ pos_code: "", label: "", location: "", operator_name: "", operator_phone: "" });

  const load = async () => {
    const { data } = await supabase.from("supplier_pos").select("*").eq("supplier_id", supplier.id).order("created_at");
    setTerminals(data || []);
  };

  useEffect(() => { load(); }, [supplier.id]);

  const openNew = () => {
    setEditing(null);
    const code = `POS-${supplier.id.slice(0, 4).toUpperCase()}-${String(terminals.length + 1).padStart(3, "0")}`;
    setForm({ pos_code: code, label: "", location: "", operator_name: "", operator_phone: "" });
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ pos_code: t.pos_code, label: t.label || "", location: t.location || "", operator_name: t.operator_name || "", operator_phone: t.operator_phone || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { supplier_id: supplier.id, pos_code: form.pos_code, label: form.label || null, location: form.location || null, operator_name: form.operator_name || null, operator_phone: form.operator_phone || null };
    if (editing) {
      await supabase.from("supplier_pos").update(payload).eq("id", editing.id);
      toast.success("Terminal actualizado");
    } else {
      await supabase.from("supplier_pos").insert(payload);
      toast.success("Terminal criado");
    }
    setDialogOpen(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Monitor className="h-5 w-5 text-primary" /> Terminais POS</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Terminal</Button>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {terminals.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm">{t.pos_code}</TableCell>
                  <TableCell>{t.label || "—"}</TableCell>
                  <TableCell>{t.location || "—"}</TableCell>
                  <TableCell>{t.operator_name || "—"}</TableCell>
                  <TableCell><Badge variant={t.status === "Ativo" ? "default" : "outline"}>{t.status}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}
              {terminals.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum terminal registado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Terminal" : "Novo Terminal"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Código POS</Label><Input value={form.pos_code} readOnly className="bg-muted" /></div>
            <div><Label>Etiqueta</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Loja Centralidade" /></div>
            <div><Label>Localização</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome do operador</Label><Input value={form.operator_name} onChange={(e) => setForm({ ...form, operator_name: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.operator_phone} onChange={(e) => setForm({ ...form, operator_phone: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Guardar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedorPOS;
