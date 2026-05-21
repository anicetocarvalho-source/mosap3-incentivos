import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Printer, RefreshCw, Loader2, Clock, CreditCard, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import FarmerIdCard, { FarmerCardData } from "@/components/cartao/FarmerIdCard";
import { useFarmerCard } from "@/hooks/useFarmerCard";
import { downloadCardPdf, downloadCardPng, DEFAULT_PRINT_LAYOUT, type PrintLayoutOptions } from "@/lib/cardExport";
import PrintLayoutDialog from "@/components/cartao/PrintLayoutDialog";
import DeviceManagerDialog from "@/components/device/DeviceManagerDialog";

interface Props {
  farmerCode?: string;
  farmerInfo: any;
  signedPhotos?: Record<string, string> | null;
}

const statusColor: Record<string, string> = {
  Rascunho: "bg-muted text-muted-foreground",
  Gerado: "bg-info/10 text-info",
  Impresso: "bg-warning/10 text-warning",
  Entregue: "bg-success/10 text-success",
  Revogado: "bg-destructive/10 text-destructive",
};

const FarmerCardTab = ({ farmerCode, farmerInfo, signedPhotos }: Props) => {
  const { card, logs, loading, generateCard, updateStatus, regenerateToken } = useFarmerCard(farmerCode);
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [printLayout, setPrintLayout] = useState<PrintLayoutOptions>(DEFAULT_PRINT_LAYOUT);

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const farmerData: FarmerCardData = {
    code: farmerInfo?.id || farmerCode || "",
    full_name: farmerInfo?.name || "",
    photo_url: signedPhotos?.frontal || null,
    province: farmerInfo?.province,
    municipality: farmerInfo?.municipality,
    school: farmerInfo?.school,
    gender: farmerInfo?.gender,
    bi: farmerInfo?.bi,
    phone: farmerInfo?.phone,
    patec: null,
    status: farmerInfo?.status,
    registered_by_name: farmerInfo?.registeredByName,
    registered_by_phone: farmerInfo?.registeredByPhone,
  };


  const handleGenerate = async () => {
    await generateCard();
    toast.success("Cartão gerado com sucesso");
  };

  const handleDownloadPdf = async () => {
    if (!cardRef.current || !card) return;
    setExporting(true);
    try {
      const frontEl = cardRef.current.querySelector("[data-card-side='front']") as HTMLElement;
      const backEl = cardRef.current.querySelector("[data-card-side='back']") as HTMLElement;
      if (frontEl && backEl) {
        await downloadCardPdf(frontEl, backEl, `cartao-${farmerData.code}`, printLayout);
        toast.success("PDF descarregado");
      }
    } catch { toast.error("Erro ao gerar PDF"); }
    setExporting(false);
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const frontEl = cardRef.current.querySelector("[data-card-side='front']") as HTMLElement;
      if (frontEl) {
        await downloadCardPng(frontEl, `cartao-${farmerData.code}`);
      }
    } catch { toast.error("Erro ao gerar PNG"); }
    setExporting(false);
  };

  const handleRegenerate = async () => {
    await regenerateToken();
    toast.success("Token regenerado — novo cartão criado");
  };

  return (
    <div className="space-y-6">
      {/* Card Preview */}
      {card ? (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={statusColor[card.status] || ""}>{card.status}</Badge>
            {card.generated_at && (
              <span className="text-xs text-muted-foreground">
                Gerado: {new Date(card.generated_at).toLocaleDateString("pt-AO")}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-4 overflow-x-auto">
            <FarmerIdCard ref={cardRef} farmer={farmerData} cardToken={card.card_token} />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 justify-center">
            <DeviceManagerDialog farmerCode={farmerCode} fullFingerprintMode />
            <PrintLayoutDialog value={printLayout} onChange={setPrintLayout} />
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPng} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" /> PNG
            </Button>
            {card.status === "Gerado" && (
              <Button variant="outline" size="sm" onClick={() => { updateStatus("Impresso"); toast.success("Marcado como impresso"); }}>
                <Printer className="h-4 w-4 mr-1" /> Marcar Impresso
              </Button>
            )}
            {card.status === "Impresso" && (
              <Button variant="outline" size="sm" onClick={() => { updateStatus("Entregue"); toast.success("Marcado como entregue"); }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar Entregue
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
              <RefreshCw className="h-4 w-4 mr-1" /> Regenerar QR
            </Button>
            {card.status !== "Revogado" && (
              <Button variant="destructive" size="sm" onClick={() => { updateStatus("Revogado", "Revogado manualmente"); toast.success("Cartão revogado"); }}>
                <XCircle className="h-4 w-4 mr-1" /> Revogar
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8 space-y-4">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Este agricultor ainda não tem cartão de identificação.</p>
          <Button onClick={handleGenerate}>
            <CreditCard className="h-4 w-4 mr-2" /> Gerar Cartão ID
          </Button>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-28 flex-shrink-0">
                    {new Date(log.created_at).toLocaleString("pt-AO")}
                  </span>
                  <Badge variant="outline" className="capitalize">{log.action}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FarmerCardTab;
