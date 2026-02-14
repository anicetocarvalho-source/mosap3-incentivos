import { useState, useRef, useEffect } from "react";
import { Camera, Fingerprint, User, X, ChevronRight, ChevronLeft, Check, WifiOff, Wifi, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FingerprintCapture from "@/components/FingerprintCapture";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { saveFarmerOffline } from "@/lib/offlineDb";
import { uploadAllFarmerMedia } from "@/lib/farmerStorage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { farmerSchema } from "@/lib/formValidation";

const photoSlots = [
  { label: "Foto Frontal", key: "frontal" },
  { label: "Perfil Esquerdo", key: "perfilEsq" },
  { label: "Perfil Direito", key: "perfilDir" },
];

const biometricSlots = [
  { label: "Polegar Direito", key: "polegarDir" },
  { label: "Indicador Direito", key: "indicadorDir" },
  { label: "Polegar Esquerdo", key: "polegarEsq" },
  { label: "Indicador Esquerdo", key: "indicadorEsq" },
];

const steps = [
  { id: 1, title: "Dados Pessoais", icon: User },
  { id: 2, title: "Fotografias", icon: Camera },
  { id: 3, title: "Biometria", icon: Fingerprint },
];

type EditData = {
  id: string;
  name: string;
  bi: string;
  phone: string;
  province: string;
  municipality: string;
  school: string;
} | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: EditData;
};

const FarmerRegistrationForm = ({ open, onOpenChange, editData }: Props) => {
  const isEditing = !!editData;
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [biometrics, setBiometrics] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: "", bi: "", dataNascimento: "", genero: "",
    telefone: "", provincia: "", municipio: "", escolaCampo: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUpload, setActiveUpload] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  useEffect(() => {
    if (editData && open) {
      setFormData({
        nome: editData.name,
        bi: editData.bi,
        dataNascimento: "",
        genero: "",
        telefone: editData.phone,
        provincia: editData.province.toLowerCase(),
        municipio: editData.municipality,
        escolaCampo: "",
      });
      setStep(1);
    }
  }, [editData, open]);

  const handlePhotoUpload = (key: string) => {
    setActiveUpload(key);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUpload) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => ({ ...prev, [activeUpload!]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removePhoto = (key: string) => {
    setPhotos((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const validation = farmerSchema.safeParse(formData);
    if (!validation.success) {
      toast({ title: "Erro de validação", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    const farmerCode = isEditing
      ? editData!.id
      : `AGR-${Date.now().toString(36).toUpperCase()}`;

    try {
      if (isOnline) {
        // Upload media to cloud storage
        const { photoUrls, biometricUrls } = await uploadAllFarmerMedia(
          farmerCode, photos, biometrics,
        );

        // Save farmer record to database
        const farmerRow = {
          code: farmerCode,
          full_name: formData.nome,
          bi: formData.bi || null,
          birth_date: formData.dataNascimento || null,
          gender: formData.genero || null,
          phone: formData.telefone || null,
          province: formData.provincia || null,
          municipality: formData.municipio || null,
          school: formData.escolaCampo || null,
          photo_frontal_url: photoUrls.frontal || null,
          photo_profile_left_url: photoUrls.perfilEsq || null,
          photo_profile_right_url: photoUrls.perfilDir || null,
          biometric_thumb_right_url: biometricUrls.polegarDir || null,
          biometric_index_right_url: biometricUrls.indicadorDir || null,
          biometric_thumb_left_url: biometricUrls.polegarEsq || null,
          biometric_index_left_url: biometricUrls.indicadorEsq || null,
        };

        if (isEditing) {
          const { error } = await supabase
            .from("farmers")
            .update(farmerRow)
            .eq("code", farmerCode);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("farmers")
            .insert(farmerRow);
          if (error) throw error;
        }

        toast({
          title: "Agricultor registado",
          description: "O registo e ficheiros foram guardados com sucesso.",
        });
      } else {
        // Offline: save locally
        const record = {
          id: farmerCode,
          timestamp: Date.now(),
          synced: false,
          data: formData,
          photos,
          biometrics,
        };
        await saveFarmerOffline(record);
        toast({
          title: "Guardado offline",
          description: "O registo será sincronizado quando houver ligação à internet.",
        });
      }

      window.dispatchEvent(new Event("mosap3-saved"));
      onOpenChange(false);
      setStep(1);
      setPhotos({});
      setBiometrics({});
      setFormData({ nome: "", bi: "", dataNascimento: "", genero: "", telefone: "", provincia: "", municipio: "", escolaCampo: "" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Não foi possível guardar o registo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-heading text-lg">{isEditing ? "Editar Agricultor" : "Registar Agricultor"}</DialogTitle>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              isOnline ? "bg-primary/10 text-primary" : "bg-warning/15 text-orange-600"
            }`}>
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium w-full transition-colors ${
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : step > s.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                <span className="truncate">{s.title}</span>
              </button>
              {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Step 1: Dados Pessoais */}
        {step === 1 && (
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input placeholder="Nome do agricultor" value={formData.nome} onChange={(e) => updateField("nome", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nº BI</Label>
                <Input placeholder="000000000LA000" value={formData.bi} onChange={(e) => updateField("bi", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input type="date" value={formData.dataNascimento} onChange={(e) => updateField("dataNascimento", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                <Select value={formData.genero} onValueChange={(v) => updateField("genero", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="9XX XXX XXX" value={formData.telefone} onChange={(e) => updateField("telefone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Província</Label>
                <Select value={formData.provincia} onValueChange={(v) => updateField("provincia", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="benguela">Benguela</SelectItem>
                    <SelectItem value="huambo">Huambo</SelectItem>
                    <SelectItem value="bie">Bié</SelectItem>
                    <SelectItem value="huila">Huíla</SelectItem>
                    <SelectItem value="malanje">Malanje</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Município</Label>
                <Input placeholder="Município" value={formData.municipio} onChange={(e) => updateField("municipio", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Escola de Campo</Label>
                <Select value={formData.escolaCampo} onValueChange={(v) => updateField("escolaCampo", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ec1">EC Caimbambo</SelectItem>
                    <SelectItem value="ec2">EC Longonjo</SelectItem>
                    <SelectItem value="ec3">EC Cuemba</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Fotografias */}
        {step === 2 && (
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Capture as fotografias do produtor usando a câmara do dispositivo.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {photoSlots.map((slot) => (
                <div key={slot.key} className="space-y-2">
                  <Label className="text-xs">{slot.label}</Label>
                  {photos[slot.key] ? (
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border bg-muted">
                      <img src={photos[slot.key]} alt={slot.label} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(slot.key)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePhotoUpload(slot.key)}
                      className="aspect-[3/4] w-full rounded-lg border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 hover:bg-muted active:scale-[0.97] transition-all"
                    >
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Camera className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Capturar</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Biometria */}
        {step === 3 && (
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Pressione o dedo do produtor no ecrã do tablet para capturar a impressão digital.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {biometricSlots.map((slot) => (
                <FingerprintCapture
                  key={slot.key}
                  label={slot.label}
                  captured={biometrics[slot.key]}
                  onCapture={(data) => setBiometrics((prev) => ({ ...prev, [slot.key]: data }))}
                  onRemove={() => setBiometrics((prev) => { const n = { ...prev }; delete n[slot.key]; return n; })}
                />
              ))}
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Fingerprint className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Peça ao produtor para pressionar firmemente o dedo indicado no ecrã e mover lentamente até a barra de progresso completar. Os dados são guardados localmente no dispositivo.
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 1 || saving}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Guardará offline
              </span>
            )}
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} className="gap-1">
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving} className="gap-1">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {saving ? "A guardar…" : isEditing ? "Guardar Alterações" : "Registar Agricultor"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FarmerRegistrationForm;
