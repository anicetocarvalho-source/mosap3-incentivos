import { motion } from "framer-motion";
import { Plus, Search, User, Shield, MapPin, Trash2, Loader2, School, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  gestor_incentivos: "Gestor de Incentivos",
  senior_agricultura: "Sénior Agricultura",
  senior_monitoria: "Sénior Monitoria",
  junior_monitoria: "Júnior Monitoria",
  junior_agricultura: "Júnior Agricultura",
  senior_agronegocio: "Sénior Agronegócio",
  junior_agronegocio: "Júnior Agronegócio",
  tecnico_extensionista: "Técnico Extensionista",
};

const PROVINCES = [
  "Bengo", "Benguela", "Bié", "Cabinda", "Cuando Cubango",
  "Cuanza Norte", "Cuanza Sul", "Cunene", "Huambo", "Huíla",
  "Luanda", "Lunda Norte", "Lunda Sul", "Malanje", "Moxico",
  "Namibe", "Uíge", "Zaire",
];

interface UserRow {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  roles: AppRole[];
  provinces: string[];
  ecas: string[];
}

const PAGE_SIZE = 10;

const Utilizadores = () => {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [provinceDialogOpen, setProvinceDialogOpen] = useState(false);
  const [ecaDialogOpen, setEcaDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<AppRole | "">("");
  const [newProvince, setNewProvince] = useState("");
  const [newEca, setNewEca] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [ecaNames, setEcaNames] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("schools").select("name").order("name").then(({ data }) => {
      if (data) setEcaNames(data.map((s) => s.name));
    });
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("*");
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("*");
      if (rErr) throw rErr;

      const { data: provinces, error: prErr } = await supabase
        .from("user_provinces")
        .select("*");
      if (prErr) throw prErr;

      const { data: ecas, error: eErr } = await supabase
        .from("user_ecas")
        .select("*");
      if (eErr) throw eErr;

      const merged: UserRow[] = (profiles || []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone,
        roles: (roles || []).filter((r) => r.user_id === p.user_id).map((r) => r.role),
        provinces: (provinces || []).filter((pr) => pr.user_id === p.user_id).map((pr) => pr.province),
        ecas: (ecas || []).filter((e) => e.user_id === p.user_id).map((e) => e.eca_name),
      }));

      setUsers(merged);
    } catch (err: any) {
      toast({ title: "Erro ao carregar utilizadores", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || "").includes(search)
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const addRole = async () => {
    if (!selectedUser || !newRole) return;
    if (selectedUser.roles.includes(newRole as AppRole)) {
      toast({ title: "Este utilizador já tem este perfil", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUser.user_id,
      role: newRole as AppRole,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao atribuir perfil", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atribuído com sucesso" });
      setNewRole("");
      setRoleDialogOpen(false);
      fetchUsers();
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    setSaving(true);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao remover perfil", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil removido" });
      fetchUsers();
    }
  };

  const addProvince = async () => {
    if (!selectedUser || !newProvince) return;
    if (selectedUser.provinces.includes(newProvince)) {
      toast({ title: "Esta província já está atribuída", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("user_provinces").insert({
      user_id: selectedUser.user_id,
      province: newProvince,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao atribuir província", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Província atribuída com sucesso" });
      setNewProvince("");
      setProvinceDialogOpen(false);
      fetchUsers();
    }
  };

  const removeProvince = async (userId: string, province: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("user_provinces")
      .delete()
      .eq("user_id", userId)
      .eq("province", province);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao remover província", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Província removida" });
      fetchUsers();
    }
  };

  const addEca = async () => {
    if (!selectedUser || !newEca) return;
    if (selectedUser.ecas.includes(newEca)) {
      toast({ title: "Esta ECA já está atribuída", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("user_ecas").insert({
      user_id: selectedUser.user_id,
      eca_name: newEca,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao atribuir ECA", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "ECA atribuída com sucesso" });
      setNewEca("");
      setEcaDialogOpen(false);
      fetchUsers();
    }
  };

  const removeEca = async (userId: string, ecaName: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("user_ecas")
      .delete()
      .eq("user_id", userId)
      .eq("eca_name", ecaName);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao remover ECA", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "ECA removida" });
      fetchUsers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Utilizadores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão de utilizadores, perfis e províncias
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar utilizadores..."
          className="pl-10"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum utilizador encontrado. Os utilizadores aparecem após registo no sistema.
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid gap-4">
            {paginated.map((u) => (
              <Card key={u.id} className="p-5">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* User info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{u.phone || "Sem telefone"}</p>
                    </div>
                  </div>

                  {/* Roles */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfis</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">Nenhum perfil</span>
                      )}
                      {u.roles.map((role) => (
                        <Badge key={role} variant="secondary" className="gap-1 pr-1">
                          {ROLE_LABELS[role]}
                          <button
                            onClick={() => removeRole(u.user_id, role)}
                            className="ml-1 hover:text-destructive transition-colors"
                            title="Remover perfil"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Dialog
                        open={roleDialogOpen && selectedUser?.id === u.id}
                        onOpenChange={(open) => {
                          setRoleDialogOpen(open);
                          if (open) setSelectedUser(u);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
                            <Plus className="h-3 w-3" /> Perfil
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Atribuir Perfil a {u.full_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-2">
                            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um perfil..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([key, label]) => (
                                  <SelectItem key={key} value={key} disabled={u.roles.includes(key)}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button onClick={addRole} disabled={!newRole || saving} className="w-full">
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atribuir Perfil"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Provinces */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Províncias</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {u.provinces.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">Nenhuma província</span>
                      )}
                      {u.provinces.map((prov) => (
                        <Badge key={prov} variant="outline" className="gap-1 pr-1">
                          {prov}
                          <button
                            onClick={() => removeProvince(u.user_id, prov)}
                            className="ml-1 hover:text-destructive transition-colors"
                            title="Remover província"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Dialog
                        open={provinceDialogOpen && selectedUser?.id === u.id}
                        onOpenChange={(open) => {
                          setProvinceDialogOpen(open);
                          if (open) setSelectedUser(u);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
                            <Plus className="h-3 w-3" /> Província
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Atribuir Província a {u.full_name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-2">
                            <Select value={newProvince} onValueChange={setNewProvince}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma província..." />
                              </SelectTrigger>
                              <SelectContent>
                                {PROVINCES.map((prov) => (
                                  <SelectItem key={prov} value={prov} disabled={u.provinces.includes(prov)}>
                                    {prov}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button onClick={addProvince} disabled={!newProvince || saving} className="w-full">
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atribuir Província"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* ECAs - only for tecnico_extensionista */}
                  {u.roles.includes("tecnico_extensionista") && (
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <School className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ECAs</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {u.ecas.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">Nenhuma ECA</span>
                        )}
                        {u.ecas.map((eca) => (
                          <Badge key={eca} className="gap-1 pr-1 bg-accent text-accent-foreground">
                            {eca}
                            <button
                              onClick={() => removeEca(u.user_id, eca)}
                              className="ml-1 hover:text-destructive transition-colors"
                              title="Remover ECA"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                        <Dialog
                          open={ecaDialogOpen && selectedUser?.id === u.id}
                          onOpenChange={(open) => {
                            setEcaDialogOpen(open);
                            if (open) setSelectedUser(u);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
                              <Plus className="h-3 w-3" /> ECA
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Atribuir ECA a {u.full_name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <Select value={newEca} onValueChange={setNewEca}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione uma ECA..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {ecaNames.map((eca) => (
                                    <SelectItem key={eca} value={eca} disabled={u.ecas.includes(eca)}>
                                      {eca}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button onClick={addEca} disabled={!newEca || saving} className="w-full">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atribuir ECA"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
            <span>{filtered.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} utilizadores</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{page} / {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Utilizadores;
