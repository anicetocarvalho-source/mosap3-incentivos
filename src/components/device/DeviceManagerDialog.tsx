import { useState, useCallback } from "react";
import { Fingerprint, CreditCard, Smartphone, CheckCircle2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import DevicePairingPanel from "./DevicePairingPanel";
import FingerprintSdkPanel from "./FingerprintSdkPanel";
import FarmerBiometricStatus from "./FarmerBiometricStatus";
import { linkNfcTag, type DeviceCapture } from "@/lib/deviceBridge";

interface Props {
  farmerCode?: string;
  onFingerprintCapture?: (capture: DeviceCapture) => void;
  onFingerprintImage?: (dataUrl: string) => void;
  onNfcCapture?: (capture: DeviceCapture) => void;
  /** Use full SDK panel for fingerprint (enroll + verify + history) */
  fullFingerprintMode?: boolean;
}

const DeviceManagerDialog = ({
  farmerCode,
  onFingerprintCapture,
  onFingerprintImage,
  onNfcCapture,
  fullFingerprintMode = false,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [biometricRefreshKey, setBiometricRefreshKey] = useState(0);
  const [linkedItems, setLinkedItems] = useState<{ type: string; id: string; label: string }[]>([]);

  const refreshBiometrics = useCallback(() => {
    setBiometricRefreshKey((k) => k + 1);
  }, []);

  /** Auto-link NFC capture to farmer */
  const handleNfcCapture = useCallback(async (capture: DeviceCapture) => {
    onNfcCapture?.(capture);

    if (!farmerCode) return;

    if (capture.capture_type === "nfc_uid") {
      try {
        await linkNfcTag(
          farmerCode,
          capture.data,
          capture.session_id,
          (capture.metadata as Record<string, string>)?.nfc_type,
        );
        setLinkedItems((prev) => [
          ...prev,
          { type: "nfc", id: capture.id, label: `NFC ${capture.data.substring(0, 12)}` },
        ]);
        refreshBiometrics();
        toast.success("Tag NFC vinculada ao agricultor", {
          description: `UID: ${capture.data.substring(0, 16)}...`,
        });
      } catch (e) {
        toast.error("Erro ao vincular NFC", {
          description: e instanceof Error ? e.message : "Tente novamente",
        });
      }
    }
  }, [farmerCode, onNfcCapture, refreshBiometrics]);

  /** Handle fingerprint template enrolled (auto-linked by edge function) */
  const handleFingerprintEnrolled = useCallback((fp: { finger_position: string; quality_score: number | null }) => {
    setLinkedItems((prev) => [
      ...prev,
      { type: "fingerprint", id: fp.finger_position, label: `Impressão ${fp.finger_position}` },
    ]);
    refreshBiometrics();
  }, [refreshBiometrics]);

  /** Handle fingerprint capture from simple mode */
  const handleFingerprintCapture = useCallback((capture: DeviceCapture) => {
    onFingerprintCapture?.(capture);

    if (capture.capture_type === "fingerprint_template" && farmerCode) {
      setLinkedItems((prev) => [
        ...prev,
        { type: "fingerprint", id: capture.id, label: `Template ISO` },
      ]);
      refreshBiometrics();
    }
  }, [farmerCode, onFingerprintCapture, refreshBiometrics]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setLinkedItems([]); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Smartphone className="h-4 w-4" />
          Dispositivos Externos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Dispositivos Externos
          </DialogTitle>
        </DialogHeader>

        {/* Biometric status banner */}
        {farmerCode && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Dados biométricos vinculados</span>
            </div>
            <FarmerBiometricStatus farmerCode={farmerCode} refreshKey={biometricRefreshKey} />
          </div>
        )}

        {/* Recently linked items confirmation */}
        {linkedItems.length > 0 && (
          <div className="rounded-lg bg-success/5 border border-success/20 p-3 space-y-1.5">
            <p className="text-xs font-medium text-success flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Vinculados nesta sessão:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {linkedItems.map((item, i) => (
                <span
                  key={`${item.id}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success"
                >
                  {item.type === "fingerprint" ? (
                    <Fingerprint className="h-2.5 w-2.5" />
                  ) : (
                    <CreditCard className="h-2.5 w-2.5" />
                  )}
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="fingerprint" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fingerprint" className="gap-1.5 text-xs">
              <Fingerprint className="h-3.5 w-3.5" />
              Impressão Digital
            </TabsTrigger>
            <TabsTrigger value="nfc" className="gap-1.5 text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              NFC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fingerprint" className="mt-4">
            {fullFingerprintMode && farmerCode ? (
              <FingerprintSdkPanel
                farmerCode={farmerCode}
                onTemplateEnrolled={handleFingerprintEnrolled}
              />
            ) : (
              <>
                <DevicePairingPanel
                  deviceType="fingerprint"
                  farmerCode={farmerCode}
                  onCapture={handleFingerprintCapture}
                  onCaptureImage={onFingerprintImage}
                />
                <div className="mt-3 rounded-lg bg-muted/30 p-3 space-y-1.5">
                  <p className="text-xs font-medium">SDK G2010 — Leitor OXi</p>
                  <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                    <li>Templates ISO 19794-2 (498 bytes)</li>
                    <li>Imagens BMP 256×360 (raw)</li>
                    <li>Score de verificação: 580–2000</li>
                    <li>Conexão USB ao tablet Android</li>
                  </ul>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="nfc" className="mt-4">
            <DevicePairingPanel
              deviceType="nfc"
              farmerCode={farmerCode}
              onCapture={handleNfcCapture}
            />
            <div className="mt-3 rounded-lg bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-medium">SDK SOTEN NFC</p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                <li>Leitura de UID de tags NFC</li>
                <li>Leitura/escrita NDEF</li>
                <li>Compatível com Mifare, NTAG</li>
                <li>Integrado no tablet Android</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceManagerDialog;
