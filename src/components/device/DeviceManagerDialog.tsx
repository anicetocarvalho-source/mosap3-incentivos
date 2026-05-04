import { useState } from "react";
import { Fingerprint, CreditCard, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DevicePairingPanel from "./DevicePairingPanel";
import type { DeviceCapture } from "@/lib/deviceBridge";

interface Props {
  farmerCode?: string;
  onFingerprintCapture?: (capture: DeviceCapture) => void;
  onFingerprintImage?: (dataUrl: string) => void;
  onNfcCapture?: (capture: DeviceCapture) => void;
}

const DeviceManagerDialog = ({ farmerCode, onFingerprintCapture, onFingerprintImage, onNfcCapture }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Smartphone className="h-4 w-4" />
          Dispositivos Externos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Dispositivos Externos
          </DialogTitle>
        </DialogHeader>

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
            <DevicePairingPanel
              deviceType="fingerprint"
              farmerCode={farmerCode}
              onCapture={onFingerprintCapture}
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
          </TabsContent>

          <TabsContent value="nfc" className="mt-4">
            <DevicePairingPanel
              deviceType="nfc"
              farmerCode={farmerCode}
              onCapture={onNfcCapture}
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
