import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Store, MapPin, Phone, User, Loader2, Trash2 } from "lucide-react";
import { useProvinceMunicipalities } from "@/hooks/useProvinceMunicipalities";

interface Supplier {
  id: string;
  name: string;
  status: string;
}

interface StoreRow {
  id: string;
  name: string;
  address: string | null;
  province: string | null;
  municipality: string | null;
  phone: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  status: string;
}

const emptyForm = {
  name: "",
  address: "",
  province: "",
  municipality: "",
  phone: "",
  manager_name: "",
  manager_phone: "",
};

type StoreForm = typeof emptyForm;

const StoreFormFields = ({
  form,
  setForm,
}: {
  form: StoreForm;
  setForm: React.Dispatch<React.SetStateAction<StoreForm>>;
}) => {
  const { provinces, municipalities } = useProvinceMunicipalities(
    form.province || undefined
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5" /> Nome da Loja *
        </Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Ex: Loja Central Huambo"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Província</Label>
          <Select
            value={form.province}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, province: v, municipality: "" }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((p) => (
                <SelectItem key={p.id} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Município</Label>
          <Select
            value={form.municipality}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, municipality: v }))
            }
            disabled={!form.province}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  form.province ? "Selecionar" : "Selecione a província"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {municipalities.map((m) => (
                <SelectItem key={m.id} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Endereço
        </Label>
        <Input
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          placeholder="Rua, bairro, referência..."
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> Telefone da Loja
        </Label>
        <Input
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          placeholder="+244 9XX XXX XXX"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Nome do Gestor
          </Label>
          <Input
            value={form.manager_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, manager_name: e.target.value }))
            }
            placeholder="Nome completo"
          />
        </div>
        <div className="space-y-2">
          <Label>Telefone do Gestor</Label>
          <Input
            value={form.manager_phone}
            onChange={(e) =>
              setForm((p) => ({ ...p, manager_phone: e.target.value }))
            }
            placeholder="+244 9XX XXX XXX"
          />
        </div>
      </div>
    </div>
  );
};

const FornecedorLojas = () => {
  const { supplier } = useOutletContext<{ supplier: Supplier }>();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StoreForm>(emptyForm);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("supplier_stores")
      .select(
        "id, name, address, province, municipality, phone, manager_name, manager_phone, status"
      )
      .eq("supplier_id", supplier.id)
      .order("created_at");
    setStores(data ?? []);
    setLoading(false);
  }, [supplier.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (store: StoreRow) => {
    setEditingId(store.id);
    setForm({
      name: store.name,
      address: store.address ?? "",
      province: store.province ?? "",
      municipality: store.municipality ?? "",
      phone: store.phone ?? "",
      manager_name: store.manager_name ?? "",
      manager_phone: store.manager_phone ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("O nome da loja é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address || null,
      province: form.province || null,
      municipality: form.municipality || null,
      phone: form.phone || null,
      manager_name: form.manager_name || null,
      manager_phone: form.manager_phone || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("supplier_stores")
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase
        .from("supplier_stores")
        .insert({ ...payload, supplier_id: supplier.id }));
    }

    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success(editingId ? "Loja actualizada" : "Loja adicionada");
      setDialogOpen(false);
      load();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem a certeza que deseja remover a loja "${name}"?`)) return;
    const { error } = await supabase
      .from("supplier_stores")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Loja removida");
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Lojas</h1>
          <p className="text-sm text-muted-foreground">
            Gerir os pontos de venda físicos da sua empresa
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nova Loja
        </Button>
      </div>

      {stores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma loja registada</p>
            <p className="text-sm mt-1">
              Adicione o primeiro ponto de venda para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((store) => (
            <Card key={store.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{store.name}</CardTitle>
                  </div>
                  <Badge
                    variant={
                      store.status === "Ativo" ? "default" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {store.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {(store.province || store.municipality) && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {[store.province, store.municipality]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {store.address && <p className="pl-5">{store.address}</p>}
                {store.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {store.phone}
                  </p>
                )}
                {store.manager_name && (
                  <p className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> {store.manager_name}
                    {store.manager_phone && ` — ${store.manager_phone}`}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(store)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(store.id, store.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Loja" : "Nova Loja"}
            </DialogTitle>
          </DialogHeader>
          <StoreFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Guardar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedorLojas;
