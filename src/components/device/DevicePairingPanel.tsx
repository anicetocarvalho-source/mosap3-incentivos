import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Wifi, WifiOff, CheckCircle2, Fingerprint, CreditCard, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeviceSession } from "@/hooks/useDeviceSession";
import { buildPairingUrl, getEdgeFunctionUrl, type DeviceType, type DeviceCapture } from "@/lib/deviceBridge";

interface Props {
  deviceType: DeviceType;
  farmerCode?: string;
  onCapture?: (capture: DeviceCapture) => void;
  onCaptureImage?: (dataUrl: string) => void;
  compact?: boolean;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Wifi }> = {
  idle: { label: "Desligado", color: "bg-muted text-muted-foreground", icon: WifiOff },
  pending: { label: "A aguardar...", color: "bg-warning/20 text-warning", icon: Wifi },
  paired: { label: "Emparelhado", color: "bg-info/20 text-info", icon: Smartphone },
  active: { label: "A capturar", color: "bg-success/20 text-success", icon: CheckCircle2 },
  expired: { label: "Expirado", color: "bg-destructive/20 text-destructive", icon: WifiOff },
  closed: { label: "Encerrado", color: "bg-muted text-muted-foreground", icon: WifiOff },
};

const DevicePairingPanel = ({ deviceType, farmerCode, onCapture, onCaptureImage, compact }: Props) => {
  const [showDetails, setShowDetails] = useState(false);

  const { session, status, captures, loading, isActive, start, stop } = useDeviceSession({
    deviceType,
    farmerCode,
    onCapture: (capture) => {
      onCapture?.(capture);
      if (capture.capture_type === "fingerprint_image" && onCaptureImage) {
        onCaptureImage(`data:image/bmp;base64,${capture.data}`);
      }
    },
  });

  const statusInfo = STATUS_MAP[status] || STATUS_MAP.idle;
  const StatusIcon = statusInfo.icon;
  const pairingUrl = session ? buildPairingUrl(session.session_code) : "";
  const apiUrl = getEdgeFunctionUrl();

  if (compact && !isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={start}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : deviceType === "fingerprint" ? (
          <Fingerprint className="h-4 w-4" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {deviceType === "fingerprint" ? "Ligar Leitor G2010" : "Ligar NFC SOTEN"}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {deviceType === "fingerprint" ? (
            <Fingerprint className="h-5 w-5 text-primary" />
          ) : (
            <CreditCard className="h-5 w-5 text-primary" />
          )}
          <h3 className="text-sm font-semibold">
            {deviceType === "fingerprint" ? "Leitor G2010" : "NFC SOTEN"}
          </h3>
        </div>
        <Badge className={`${statusInfo.color} text-xs gap-1`}>
          <StatusIcon className="h-3 w-3" />
          {statusInfo.label}
        </Badge>
      </div>

      {/* Not active - start button */}
      {!isActive && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            {deviceType === "fingerprint" ? (
              <Fingerprint className="h-8 w-8 text-primary/60" />
            ) : (
              <CreditCard className="h-8 w-8 text-primary/60" />
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-[240px]">
            {deviceType === "fingerprint"
              ? "Ligue o leitor de impressões digitais G2010 via app Android"
              : "Ligue o leitor NFC SOTEN via app Android"}
          </p>
          <Button onClick={start} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Iniciar Sessão
          </Button>
        </div>
      )}

      {/* Active - show QR + code */}
      {isActive && session && (
        <div className="space-y-4">
          {/* QR Code for pairing */}
          {status === "pending" && (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={pairingUrl} size={160} level="M" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">
                  Digitalize o QR ou insira o código na app Android:
                </p>
                <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">
                  {session.session_code}
                </p>
              </div>
            </div>
          )}

          {/* Paired / Active - show captures */}
          {(status === "paired" || status === "active") && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {captures.length === 0
                  ? "Aguardando captura do dispositivo..."
                  : `${captures.length} captura(s) recebida(s)`}
              </p>
              {captures.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {captures.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span>
                          {c.capture_type === "fingerprint_template"
                            ? `Template ISO${c.finger_position ? ` — ${c.finger_position}` : ""}`
                            : c.capture_type === "fingerprint_image"
                              ? `Imagem${c.finger_position ? ` — ${c.finger_position}` : ""}`
                              : c.capture_type === "nfc_uid"
                                ? `NFC UID: ${c.data.substring(0, 16)}...`
                                : `NDEF: ${c.data.substring(0, 20)}...`}
                        </span>
                      </div>
                      {c.quality_score != null && (
                        <Badge variant="outline" className="text-[10px]">
                          Q: {c.quality_score}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={stop} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Encerrar
            </Button>
            {status === "pending" && (
              <Button variant="ghost" size="sm" onClick={() => { stop(); start(); }} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Novo Código
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="ml-auto text-xs"
            >
              {showDetails ? "Ocultar" : "API Info"}
            </Button>
          </div>

          {/* API details for Android dev */}
          {showDetails && (
            <div className="rounded-lg bg-muted/30 p-3 text-[11px] font-mono space-y-1 break-all">
              <p><strong>Endpoint:</strong> {apiUrl}</p>
              <p><strong>Pair:</strong> POST ?action=pair {`{"session_code":"${session.session_code}"}`}</p>
              <p><strong>Capture:</strong> POST ?action=capture {`{"session_id":"${session.id}","capture_type":"...","data":"base64..."}`}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DevicePairingPanel;
