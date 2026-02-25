import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings, Eye, EyeOff, Save, CheckCircle, AlertTriangle, Wifi, Shield } from "lucide-react";
import { toast } from "sonner";

const SETTINGS_KEYS = [
  "unitel_api_endpoint",
  "unitel_consumer_key",
  "unitel_consumer_secret",
  "unitel_initiator",
  "unitel_shortcode",
  "unitel_security_credential",
  "unitel_payment_enabled",
] as const;

type SettingsKey = (typeof SETTINGS_KEYS)[number];

const DEFAULT_ENDPOINT = "https://api.unitel.ao/v2/partners/1.0.0";

const Mosap3PayConfiguracoes = () => {
  const [values, setValues] = useState<Record<SettingsKey, string>>({
    unitel_api_endpoint: DEFAULT_ENDPOINT,
    unitel_consumer_key: "",
    unitel_consumer_secret: "",
    unitel_initiator: "",
    unitel_shortcode: "",
    unitel_security_credential: "",
    unitel_payment_enabled: "false",
  });
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", SETTINGS_KEYS as unknown as string[]);

      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row) => (map[row.key] = row.value));
        setValues((prev) => ({ ...prev, ...map }));
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of SETTINGS_KEYS) {
        const value = values[key];
        const { error } = await supabase
          .from("system_settings")
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
      toast.success("Configurações Unitel Money guardadas com sucesso");
    } catch (err: any) {
      toast.error("Erro ao guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("unitel-money-payment", {
        body: { action: "test_connection" },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Conexão com Unitel Money API estabelecida com sucesso!");
      } else {
        toast.error("Falha na conexão: " + (data?.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      toast.error("Erro ao testar: " + err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const toggleShow = (key: string) =>
    setShowSecret((prev) => ({ ...prev, [key]: !prev[key] }));

  const isConfigured =
    values.unitel_consumer_key &&
    values.unitel_consumer_secret &&
    values.unitel_initiator &&
    values.unitel_shortcode &&
    values.unitel_security_credential;

  const isEnabled = values.unitel_payment_enabled === "true";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

  const secretField = (
    key: SettingsKey,
    label: string,
    placeholder: string,
    hint?: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={key} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={key}
          type={showSecret[key] ? "text" : "password"}
          value={values[key]}
          onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
          placeholder={placeholder}
          className="pr-10 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => toggleShow(key)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showSecret[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações de Pagamento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            API UNITEL Money v4.7 — Integração REST para pagamentos BuyGoods
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" /> Configurado
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Não configurado
            </Badge>
          )}
        </div>
      </div>

      {/* Enable/Disable */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Pagamentos Unitel Money Activos
              </p>
              <p className="text-xs text-muted-foreground">
                Quando activado, o sistema processará pagamentos automaticamente via Unitel Money BuyGoods.
              </p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) =>
                setValues((prev) => ({
                  ...prev,
                  unitel_payment_enabled: checked ? "true" : "false",
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* API Endpoint */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" />
            API Endpoint
          </CardTitle>
          <CardDescription>
            Endpoints: /buyGoods_sync, /buyGoods_async, /goodsRefundTransaction_sync
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={values.unitel_api_endpoint}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, unitel_api_endpoint: e.target.value }))
            }
            placeholder={DEFAULT_ENDPOINT}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* OAuth2 Credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Credenciais OAuth2</CardTitle>
          <CardDescription>
            Chaves de autenticação obtidas no Portal de Desenvolvedores da Unitel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {secretField(
              "unitel_consumer_key",
              "Consumer Key",
              "OAuth2 Consumer Key",
              "Chave pública para autenticação OAuth2"
            )}
            {secretField(
              "unitel_consumer_secret",
              "Consumer Secret",
              "OAuth2 Consumer Secret",
              "Chave secreta para autenticação OAuth2"
            )}
          </div>
        </CardContent>
      </Card>

      {/* Merchant Credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Credenciais do Comerciante</CardTitle>
          <CardDescription>
            Dados do contrato BuyGoods fornecidos pela Unitel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {secretField(
              "unitel_initiator",
              "Initiator Identifier",
              "Ex: merchantOp",
              "IdentifierType: 12 (default)"
            )}
            {secretField(
              "unitel_shortcode",
              "ShortCode (Merchant ID)",
              "Ex: 00001708",
              "Identificador do comerciante UNITEL"
            )}
          </div>
          {secretField(
            "unitel_security_credential",
            "Security Credential",
            "PIN encriptado fornecido pela UNITEL",
            "Credencial de segurança encriptada para autenticação das transações"
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar Configurações"}
        </Button>
        <Button
          variant="outline"
          onClick={testConnection}
          disabled={testingConnection || !isConfigured}
          className="gap-2"
        >
          <Wifi className="h-4 w-4" />
          {testingConnection ? "Testando..." : "Testar Conexão"}
        </Button>
      </div>
    </div>
  );
};

export default Mosap3PayConfiguracoes;
