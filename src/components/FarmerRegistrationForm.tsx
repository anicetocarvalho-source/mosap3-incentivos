import { useState, useRef } from "react";
import { Camera, Fingerprint, User, Upload, X, ChevronRight, ChevronLeft, Check } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";

type PhotoSlot = {
  label: string;
  key: string;
  icon: string;
};

const photoSlots: PhotoSlot[] = [
  { label: "Foto Frontal", key: "frontal", icon: "👤" },
  { label: "Foto Perfil Esquerdo", key: "perfilEsq", icon: "👤" },
  { label: "Foto Perfil Direito", key: "perfilDir", icon: "👤" },
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FarmerRegistrationForm = ({ open, onOpenChange }: Props) => {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [biometrics, setBiometrics] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUpload, setActiveUpload] = useState<string | null>(null);

  const handlePhotoUpload = (key: string) => {
    setActiveUpload(key);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUpload) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (activeUpload.startsWith("bio_")) {
          setBiometrics((prev) => ({ ...prev, [activeUpload]: reader.result as string }));
        } else {
          setPhotos((prev) => ({ ...prev, [activeUpload]: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removePhoto = (key: string) => {
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const removeBiometric = (key: string) => {
    setBiometrics((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleBiometricUpload = (key: string) => {
    setActiveUpload(`bio_${key}`);
    fileInputRef.current?.click();
  };

  const handleSubmit = () => {
    onOpenChange(false);
    setStep(1);
    setPhotos({});
    setBiometrics({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Registar Agricultor</DialogTitle>
        </DialogHeader>

        {/* Hidden file input */}
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
                {step > s.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <s.icon className="h-4 w-4" />
                )}
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
                <Input placeholder="Nome do agricultor" />
              </div>
              <div className="space-y-2">
                <Label>Nº BI</Label>
                <Input placeholder="000000000LA000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input type="date" />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                <Select>
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
                <Input placeholder="9XX XXX XXX" />
              </div>
              <div className="space-y-2">
                <Label>Província</Label>
                <Select>
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
                <Input placeholder="Município" />
              </div>
              <div className="space-y-2">
                <Label>Escola de Campo</Label>
                <Select>
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
              Capture as fotografias do produtor: frontal e perfis laterais.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {photoSlots.map((slot) => (
                <div key={slot.key} className="space-y-2">
                  <Label className="text-xs">{slot.label}</Label>
                  {photos[slot.key] ? (
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border bg-muted">
                      <img
                        src={photos[slot.key]}
                        alt={slot.label}
                        className="w-full h-full object-cover"
                      />
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
                      className="aspect-[3/4] w-full rounded-lg border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 hover:bg-muted transition-colors"
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
              Capture as impressões digitais do polegar e indicador de ambas as mãos.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {biometricSlots.map((slot) => {
                const bioKey = `bio_${slot.key}`;
                const hasBio = biometrics[bioKey];
                return (
                  <div key={slot.key} className="space-y-2">
                    <Label className="text-xs">{slot.label}</Label>
                    {hasBio ? (
                      <div className="relative h-32 rounded-lg overflow-hidden border border-border bg-muted">
                        <img
                          src={hasBio}
                          alt={slot.label}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeBiometric(bioKey)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-xs text-center py-1 font-medium">
                          ✓ Capturado
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBiometricUpload(slot.key)}
                        className="h-32 w-full rounded-lg border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 hover:bg-muted transition-colors"
                      >
                        <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
                          <Fingerprint className="h-6 w-6 text-accent-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Capturar Impressão</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Fingerprint className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Para captura biométrica real, conecte um leitor de impressões digitais compatível. Nesta versão, pode carregar uma imagem da impressão digital.
              </span>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} className="gap-1">
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="gap-1">
              <Check className="h-4 w-4" />
              Registar Agricultor
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FarmerRegistrationForm;
