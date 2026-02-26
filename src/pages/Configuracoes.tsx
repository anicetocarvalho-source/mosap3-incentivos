import { useState, useEffect } from "react";
import { Settings, Globe, Bell, Shield, Database, Save, Loader2 } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SETTINGS_KEYS = [
  "org_name", "org_email", "org_phone",
  "campanha", "idioma",
  "notif_email", "notif_push",
  "modo_offline", "auto_sync", "intervalo_sync",
] as const;

type SettingsMap = Record<string, string>;

const Configuracoes = () => {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [provinceCount, setProvinceCount] = useState<number | null>(null);
  const roleCount = Constants.public.Enums.app_role.length;

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value");

      if (!error && data) {
        const map: SettingsMap = {};
        data.forEach((row) => { map[row.key] = row.value; });
        setSettings(map);
      }
      setLoading(false);
    };
    const fetchCounts = async () => {
      const [profilesRes, provincesRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("provinces").select("*", { count: "exact", head: true }),
      ]);
      setUserCount(profilesRes.count ?? 0);
      setProvinceCount(provincesRes.count ?? 0);
    };
    fetchSettings();
    fetchCounts();
  }, []);

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    const promises = Object.entries(settings).map(([key, value]) =>
      supabase
        .from("system_settings")
        .update({ value, updated_by: userId })
        .eq("key", key)
    );

    const results = await Promise.all(promises);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      toast({ title: "Erro", description: "Não foi possível guardar algumas configurações.", variant: "destructive" });
    } else {
      toast({ title: "Configurações guardadas", description: "As alterações foram aplicadas com sucesso." });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const readOnly = !isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Configurações Gerais</h1>
          <p className="text-muted-foreground text-sm mt-1">Parâmetros globais do sistema MOSAP3</p>
        </div>
        {!readOnly && (
          <Button className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Alterações
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organização */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="h-4 w-4 text-primary" />
            Organização
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Organização</Label>
              <Input value={settings.org_name ?? ""} onChange={(e) => update("org_name", e.target.value)} readOnly={readOnly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email de Contacto</Label>
              <Input type="email" value={settings.org_email ?? ""} onChange={(e) => update("org_email", e.target.value)} readOnly={readOnly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input value={settings.org_phone ?? ""} onChange={(e) => update("org_phone", e.target.value)} readOnly={readOnly} />
            </div>
          </div>
        </Card>

        {/* Campanha e Idioma */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="h-4 w-4 text-primary" />
            Campanha e Idioma
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Campanha Activa</Label>
              <Select value={settings.campanha ?? "2025/2026"} onValueChange={(v) => update("campanha", v)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025/2026">2025/2026</SelectItem>
                  <SelectItem value="2024/2025">2024/2025</SelectItem>
                  <SelectItem value="2023/2024">2023/2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Idioma do Sistema</Label>
              <Select value={settings.idioma ?? "pt"} onValueChange={(v) => update("idioma", v)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">Inglês</SelectItem>
                  <SelectItem value="fr">Francês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Notificações */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-primary" />
            Notificações
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Notificações por Email</p>
                <p className="text-xs text-muted-foreground">Receber alertas por email</p>
              </div>
              <Switch checked={settings.notif_email === "true"} onCheckedChange={(v) => update("notif_email", String(v))} disabled={readOnly} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Notificações Push</p>
                <p className="text-xs text-muted-foreground">Alertas no dispositivo</p>
              </div>
              <Switch checked={settings.notif_push === "true"} onCheckedChange={(v) => update("notif_push", String(v))} disabled={readOnly} />
            </div>
          </div>
        </Card>

        {/* Sincronização */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-primary" />
            Sincronização e Offline
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Modo Offline</p>
                <p className="text-xs text-muted-foreground">Permitir uso sem internet</p>
              </div>
              <Switch checked={settings.modo_offline === "true"} onCheckedChange={(v) => update("modo_offline", String(v))} disabled={readOnly} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sincronização Automática</p>
                <p className="text-xs text-muted-foreground">Sincronizar ao restabelecer ligação</p>
              </div>
              <Switch checked={settings.auto_sync === "true"} onCheckedChange={(v) => update("auto_sync", String(v))} disabled={readOnly} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Intervalo de Sincronização (minutos)</Label>
              <Select value={settings.intervalo_sync ?? "15"} onValueChange={(v) => update("intervalo_sync", v)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Segurança */}
        <Card className="p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-primary" />
            Segurança e Acesso
          </div>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">{userCount ?? "..."}</p>
              <p className="text-xs text-muted-foreground mt-1">Utilizadores Activos</p>
            </div>
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">{roleCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Perfis de Acesso</p>
            </div>
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">{provinceCount ?? "..."}</p>
              <p className="text-xs text-muted-foreground mt-1">Províncias Configuradas</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A gestão detalhada de utilizadores e permissões está disponível nas páginas "Lista de Utilizadores" e "Perfis & Permissões" no menu lateral.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Configuracoes;
