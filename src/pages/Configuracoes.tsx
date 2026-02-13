import { useState } from "react";
import { Settings, Globe, Bell, Shield, Database, Save } from "lucide-react";
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

const Configuracoes = () => {
  const [campanha, setCampanha] = useState("2025/2026");
  const [idioma, setIdioma] = useState("pt");
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [modoOffline, setModoOffline] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [intervaloSync, setIntervaloSync] = useState("15");
  const [nomeOrganizacao, setNomeOrganizacao] = useState("MOSAP3 — Ministério da Agricultura e Pescas");
  const [emailContacto, setEmailContacto] = useState("suporte@mosap3.gov.ao");
  const [telefoneContacto, setTelefoneContacto] = useState("+244 222 123 456");

  const handleSave = () => {
    toast({
      title: "Configurações guardadas",
      description: "As alterações foram aplicadas com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Configurações Gerais</h1>
          <p className="text-muted-foreground text-sm mt-1">Parâmetros globais do sistema MOSAP3</p>
        </div>
        <Button className="gap-2" onClick={handleSave}>
          <Save className="h-4 w-4" />
          Guardar Alterações
        </Button>
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
              <Input value={nomeOrganizacao} onChange={(e) => setNomeOrganizacao(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email de Contacto</Label>
              <Input type="email" value={emailContacto} onChange={(e) => setEmailContacto(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input value={telefoneContacto} onChange={(e) => setTelefoneContacto(e.target.value)} />
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
              <Select value={campanha} onValueChange={setCampanha}>
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
              <Select value={idioma} onValueChange={setIdioma}>
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
              <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Notificações Push</p>
                <p className="text-xs text-muted-foreground">Alertas no dispositivo</p>
              </div>
              <Switch checked={notifPush} onCheckedChange={setNotifPush} />
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
              <Switch checked={modoOffline} onCheckedChange={setModoOffline} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sincronização Automática</p>
                <p className="text-xs text-muted-foreground">Sincronizar ao restabelecer ligação</p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Intervalo de Sincronização (minutos)</Label>
              <Select value={intervaloSync} onValueChange={setIntervaloSync}>
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
              <p className="text-2xl font-bold text-primary">3</p>
              <p className="text-xs text-muted-foreground mt-1">Utilizadores Activos</p>
            </div>
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">9</p>
              <p className="text-xs text-muted-foreground mt-1">Perfis de Acesso</p>
            </div>
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">18</p>
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
