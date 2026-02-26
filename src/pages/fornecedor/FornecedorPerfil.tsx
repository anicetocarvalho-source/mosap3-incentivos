import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, Save, Building2, MapPin, Phone, Mail, FileText, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { useProvinceMunicipalities } from "@/hooks/useProvinceMunicipalities";

interface Supplier {
  id: string;
  name: string;
  status: string;
}

interface SupplierFull {
  id: string;
  name: string;
  nif: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  province: string | null;
  municipality: string | null;
  logo_url: string | null;
  shortcode: string | null;
  status: string;
}

const FornecedorPerfil = () => {
  const { supplier } = useOutletContext<{ supplier: Supplier }>();
  const [data, setData] = useState<SupplierFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    nif: "",
    phone: "",
    email: "",
    address: "",
    province: "",
    municipality: "",
    shortcode: "",
  });

  // Cascading province → municipality
  const { provinces: provinceOptions, municipalities: municipalityOptions } = useProvinceMunicipalities(form.province || undefined);

  useEffect(() => {
    const load = async () => {
      const { data: s } = await supabase
        .from("suppliers")
        .select("id, name, nif, phone, email, address, province, municipality, logo_url, shortcode, status")
        .eq("id", supplier.id)
        .single();
      if (s) {
        setData(s);
        setForm({
          name: s.name || "",
          nif: s.nif || "",
          phone: s.phone || "",
          email: s.email || "",
          address: s.address || "",
          province: s.province || "",
          municipality: s.municipality || "",
          shortcode: s.shortcode || "",
        });
      }
      setLoading(false);
    };
    load();
  }, [supplier.id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("suppliers")
      .update({
        name: form.name,
        nif: form.nif || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        province: form.province || null,
        municipality: form.municipality || null,
        shortcode: form.shortcode || null,
      })
      .eq("id", supplier.id);

    setSaving(false);
    if (error) {
      toast.error("Erro ao guardar: " + error.message);
    } else {
      toast.success("Informações actualizadas com sucesso");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file, 512, 0.8);
      const blob = await fetch(compressed).then((r) => r.blob());
      const ext = "jpg";
      const path = `${supplier.id}/logo.${ext}`;

      // Remove old logo if exists
      await supabase.storage.from("supplier-logos").remove([path]);

      const { error: upErr } = await supabase.storage
        .from("supplier-logos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("supplier-logos")
        .getPublicUrl(path);

      const logoUrl = urlData.publicUrl + "?t=" + Date.now();

      await supabase
        .from("suppliers")
        .update({ logo_url: logoUrl })
        .eq("id", supplier.id);

      setData((prev) => (prev ? { ...prev, logo_url: logoUrl } : prev));
      toast.success("Logotipo actualizado");
    } catch (err: any) {
      toast.error("Erro ao carregar logotipo: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold">Perfil da Loja</h1>
        <p className="text-sm text-muted-foreground">Configure as informações da sua loja</p>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logotipo</CardTitle>
          <CardDescription>Imagem exibida nos documentos e no portal</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative group">
            {data?.logo_url ? (
              <img
                src={data.logo_url}
                alt="Logo"
                className="h-24 w-24 rounded-xl object-cover border border-border"
              />
            ) : (
              <div className="h-24 w-24 rounded-xl bg-muted flex items-center justify-center border border-border">
                <Building2 className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Clique na imagem para alterar</p>
            <p className="text-xs text-muted-foreground">JPG, PNG — máx. 2 MB</p>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Nome da Loja
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome comercial"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> NIF
              </Label>
              <Input
                value={form.nif}
                onChange={(e) => setForm({ ...form, nif: e.target.value })}
                placeholder="Número de Identificação Fiscal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefone
              </Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+244 9XX XXX XXX"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="loja@exemplo.co.ao"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Código curto (shortcode)</Label>
            <Input
              value={form.shortcode}
              onChange={(e) => setForm({ ...form, shortcode: e.target.value })}
              placeholder="Ex: AGR01"
              maxLength={10}
            />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Localização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Província</Label>
              <Select value={form.province} onValueChange={(v) => setForm({ ...form, province: v, municipality: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecionar província" /></SelectTrigger>
                <SelectContent>
                  {provinceOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Município</Label>
              <Select value={form.municipality} onValueChange={(v) => setForm({ ...form, municipality: v })} disabled={!form.province}>
                <SelectTrigger><SelectValue placeholder={form.province ? "Selecionar município" : "Selecione a província primeiro"} /></SelectTrigger>
                <SelectContent>
                  {municipalityOptions.map((m) => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Rua, bairro, referência..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !form.name}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar Alterações
        </Button>
      </div>
    </div>
  );
};

export default FornecedorPerfil;
