import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Smartphone, Share2, Copy, Check, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Instalar = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const appUrl = window.location.origin;

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    toast({ title: "Link copiado!", description: "Partilhe com os agentes de campo." });
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "MOSAP3 — Projecto Mosap3",
        text: "Instale a aplicação do Projecto Mosap3 no seu tablet ou telemóvel",
        url: appUrl,
      });
    } else {
      copyLink();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h1 className="page-title">Instalar Aplicação</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Digitalize o QR Code ou use o link para instalar no tablet ou telemóvel
        </p>
      </div>

      {/* QR Code */}
      <Card className="p-8 flex flex-col items-center gap-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-border">
          <QRCodeSVG
            value={appUrl}
            size={220}
            level="H"
            includeMargin={false}
            fgColor="#1B5E20"
          />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold">Digitalize com a câmara do tablet</p>
          <p className="text-xs text-muted-foreground">
            Abra a câmara e aponte para o código QR para abrir a aplicação
          </p>
        </div>
      </Card>

      {/* Link + Actions */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Wifi className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Link da aplicação</p>
            <p className="text-sm font-mono truncate">{appUrl}</p>
          </div>
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 flex-shrink-0">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={share} variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Partilhar Link
          </Button>
          {deferredPrompt ? (
            <Button onClick={handleInstall} className="gap-2">
              <Download className="h-4 w-4" />
              Instalar Agora
            </Button>
          ) : (
            <Button disabled variant="secondary" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Abra no dispositivo
            </Button>
          )}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-5 space-y-3">
        <h3 className="font-heading font-semibold text-sm">Como instalar no tablet Android</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            Digitalize o QR Code acima ou abra o link no navegador Chrome do tablet
          </li>
          <li className="flex gap-2">
            <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            Toque no menu (⋮) do Chrome → <strong>"Adicionar ao ecrã inicial"</strong>
          </li>
          <li className="flex gap-2">
            <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            Confirme a instalação — o ícone do MOSAP3 aparecerá no ecrã inicial
          </li>
          <li className="flex gap-2">
            <span className="bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            A aplicação funciona offline e sincroniza automaticamente quando ligada à internet
          </li>
        </ol>
      </Card>
    </div>
  );
};

export default Instalar;
