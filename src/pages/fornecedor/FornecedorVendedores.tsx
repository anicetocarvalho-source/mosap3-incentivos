import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, KeyRound, Loader2, UserCog } from "lucide-react";

interface Seller {
  id: string;
  full_name: string;
  username: string;
  is_active: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

const emptyForm = { id: null as string | null, full_name: "", username: "", pin: "", is_active: true };

const FornecedorVendedores = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  const [list, setList] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<Seller | null>(null);
  const [newPin, setNewPin] = useState("");

  const load = async () => {
    if (!supplier?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("supplier_sellers")
      .select("id, full_name, username, is_active, failed_attempts, locked_until, created_at")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar vendedores: " + error.message);
    setList((data as Seller[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [supplier?.id]);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (s: Seller) => {
    setForm({ id: s.id, full_name: s.full_name, username: s.username, pin: "", is_active: s.is_active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username)) { toast.error("Username inválido (3-30, a-z 0-9 . _ -)"); return; }
    if (!form.id && !/^\d{4,6}$/.test(form.pin)) { toast.error("PIN deve ter 4 a 6 dígitos"); return; }
    if (form.id && form.pin && !/^\d{4,6}$/.test(form.pin)) { toast.error("Novo PIN inválido"); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("supplier_seller_upsert", {
      _id: form.id,
      _supplier_id: supplier.id,
      _full_name: form.full_name,
      _username: form.username,
      _pin: form.pin || null,
      _is_active: form.is_active,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Vendedor actualizado" : "Vendedor criado");
    setOpen(false);
    load();
  };

  const toggleActive = async (s: Seller) => {
    const { error } = await (supabase as any).rpc("supplier_seller_upsert", {
      _id: s.id, _supplier_id: supplier.id, _full_name: s.full_name,
      _username: s.username, _pin: null, _is_active: !s.is_active,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(s.is_active ? "Vendedor desactivado" : "Vendedor activado");
    load();
  };

  const resetPin = async () => {
    if (!resetTarget) return;
    if (!/^\d{4,6}$/.test(newPin)) { toast.error("PIN deve ter 4 a 6 dígitos"); return; }
    const { error } = await (supabase as any).rpc("supplier_seller_upsert", {
      _id: resetTarget.id, _supplier_id: supplier.id, _full_name: resetTarget.full_name,
      _username: resetTarget.username, _pin: newPin, _is_active: resetTarget.is_active,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("PIN actualizado e desbloqueado");
    setResetTarget(null); setNewPin("");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2"><UserCog className="h-6 w-6 text-primary" /> Vendedores</h1>
          <p className="text-sm text-muted-foreground">Crie utilizadores para os seus terminais POS. Cada venda fica associada ao vendedor que a fez.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo vendedor</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />A carregar…</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Ainda não existem vendedores. Crie o primeiro para começar.</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.full_name}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.username}</code></TableCell>
                      <TableCell>
                        {!s.is_active ? <Badge variant="secondary">Inactivo</Badge> :
                          (s.locked_until && new Date(s.locked_until) > new Date())
                            ? <Badge variant="destructive">Bloqueado</Badge>
                            : <Badge className="bg-success text-success-foreground">Activo</Badge>}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setResetTarget(s); setNewPin(""); }}><KeyRound className="h-4 w-4" /></Button>
                        <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y">
              {list.map((s) => (
                <div key={s.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.username}</code>
                    </div>
                    {!s.is_active ? <Badge variant="secondary">Inactivo</Badge> :
                      (s.locked_until && new Date(s.locked_until) > new Date())
                        ? <Badge variant="destructive">Bloqueado</Badge>
                        : <Badge className="bg-success text-success-foreground">Activo</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(s)} className="flex-1"><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
                    <Button variant="outline" size="sm" onClick={() => { setResetTarget(s); setNewPin(""); }} className="flex-1"><KeyRound className="h-3.5 w-3.5 mr-1" />PIN</Button>
                    <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar vendedor" : "Novo vendedor"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div>
              <Label>Username *</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="ex: maria.silva" />
              <p className="text-xs text-muted-foreground mt-1">3-30 caracteres (a-z, 0-9, . _ -). Único por fornecedor.</p>
            </div>
            <div>
              <Label>{form.id ? "Novo PIN (deixar vazio para manter)" : "PIN *"}</Label>
              <Input inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} placeholder="4 a 6 dígitos" />
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Activo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPin(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir PIN — {resetTarget?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Novo PIN</Label>
            <Input inputMode="numeric" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="4 a 6 dígitos" />
            <p className="text-xs text-muted-foreground">Tentativas falhadas serão também repostas.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPin(""); }}>Cancelar</Button>
            <Button onClick={resetPin}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedorVendedores;
