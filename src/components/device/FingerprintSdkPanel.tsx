import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Fingerprint, Smartphone, CheckCircle2, XCircle, AlertTriangle,
  Loader2, X, Shield, RefreshCw, Trash2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useDeviceSession } from "@/hooks/useDeviceSession";
import {
  buildPairingUrl,
  getEdgeFunctionUrl,
  getEnrolledFingerprints,
  getVerificationHistory,
  deactivateFingerprint,
  getQualityLabel,
  getMatchLabel,
  FINGER_LABELS,
  FINGER_POSITIONS,
  MATCH_THRESHOLD,
  type DeviceCapture,
  type FarmerFingerprint,
  type FingerprintVerification,
  type FingerPosition,
  type SdkWorkflowState,
} from "@/lib/deviceBridge";

interface Props {
  farmerCode: string;
  onTemplateEnrolled?: (fp: { finger_position: string; quality_score: number | null }) => void;
  onVerified?: (result: { match_result: string; match_score: number }) => void;
}

const SDK_STEPS = [
  { key: "LIVESCAN_Find", label: "Localizar Dispositivo", desc: "Permissão USB" },
  { key: "LIVESCAN_Init", label: "Inicializar", desc: "Abrir módulo" },
  { key: "LIVESCAN_PrepareCapture", label: "Preparar Captura", desc: "Acordar sensor" },
  { key: "LIVESCAN_GetFPRawData", label: "Capturar Imagem", desc: "256×360 BMP" },
  { key: "LIVESCAN_CAPTUREMPLATE", label: "Gerar Template ISO", desc: "498 bytes" },
  { key: "LIVESCAN_EndCapture", label: "Finalizar", desc: "Encerrar captura" },
];

// Hand SVG for finger selection
const HandSvg = ({ side, enrolled, selected, onSelect }: {
  side: "dir" | "esq";
  enrolled: Set<string>;
  selected: FingerPosition | null;
  onSelect: (fp: FingerPosition) => void;
}) => {
  const fingers: { pos: FingerPosition; cx: number; cy: number }[] = side === "dir"
    ? [
      { pos: "polegar_dir", cx: 18, cy: 65 },
      { pos: "indicador_dir", cx: 38, cy: 15 },
      { pos: "medio_dir", cx: 55, cy: 10 },
      { pos: "anelar_dir", cx: 72, cy: 18 },
    ]
    : [
      { pos: "anelar_esq", cx: 28, cy: 18 },
      { pos: "medio_esq", cx: 45, cy: 10 },
      { pos: "indicador_esq", cx: 62, cy: 15 },
      { pos: "polegar_esq", cx: 82, cy: 65 },
    ];

  return (
    <div className="relative">
      <p className="text-[10px] text-muted-foreground text-center mb-1">
        {side === "dir" ? "Mão Direita" : "Mão Esquerda"}
      </p>
      <svg viewBox="0 0 100 90" className="w-28 h-24">
        {/* Palm outline */}
        <ellipse cx="50" cy="60" rx="30" ry="25" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
        {fingers.map(({ pos, cx, cy }) => {
          const isEnrolled = enrolled.has(pos);
          const isSelected = selected === pos;
          return (
            <g key={pos} onClick={() => onSelect(pos)} className="cursor-pointer">
              <circle
                cx={cx} cy={cy} r={8}
                fill={isSelected ? "hsl(var(--primary))" : isEnrolled ? "hsl(var(--success) / 0.3)" : "hsl(var(--muted))"}
                stroke={isSelected ? "hsl(var(--primary))" : isEnrolled ? "hsl(var(--success))" : "hsl(var(--border))"}
                strokeWidth={isSelected ? 2 : 1}
              />
              {isEnrolled && (
                <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="8" fill="hsl(var(--success))">✓</text>
              )}
              {!isEnrolled && !isSelected && (
                <text x={cx} y={cy + 3} textAnchor="middle" fontSize="6" fill="hsl(var(--muted-foreground))">●</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const FingerprintSdkPanel = ({ farmerCode, onTemplateEnrolled, onVerified }: Props) => {
  const [activeTab, setActiveTab] = useState<"enroll" | "verify" | "history">("enroll");
  const [selectedFinger, setSelectedFinger] = useState<FingerPosition | null>(null);
  const [enrolled, setEnrolled] = useState<FarmerFingerprint[]>([]);
  const [verifications, setVerifications] = useState<FingerprintVerification[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [sdkWorkflow, setSdkWorkflow] = useState<SdkWorkflowState>({});

  const enrolledSet = new Set(enrolled.map((f) => f.finger_position));

  const {
    session, status, captures, loading, isActive, start, stop,
  } = useDeviceSession({
    deviceType: "fingerprint",
    farmerCode,
    onWorkflowUpdate: setSdkWorkflow,
    onCapture: (capture) => {
      if (capture.capture_type === "fingerprint_template") {
        onTemplateEnrolled?.({
          finger_position: capture.finger_position || "",
          quality_score: capture.quality_score,
        });
        // Refresh enrolled list
        loadEnrolled();
      }
    },
  });

  const loadEnrolled = useCallback(async () => {
    try {
      const fps = await getEnrolledFingerprints(farmerCode);
      setEnrolled(fps);
    } catch { /* ignore */ }
  }, [farmerCode]);

  const loadVerifications = useCallback(async () => {
    try {
      const vs = await getVerificationHistory(farmerCode);
      setVerifications(vs);
    } catch { /* ignore */ }
  }, [farmerCode]);

  useEffect(() => {
    setLoadingData(true);
    Promise.all([loadEnrolled(), loadVerifications()]).finally(() => setLoadingData(false));
  }, [loadEnrolled, loadVerifications]);

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateFingerprint(id);
      toast.success("Impressão digital desactivada");
      await loadEnrolled();
    } catch {
      toast.error("Erro ao desactivar");
    }
  };

  const pairingUrl = session ? buildPairingUrl(session.session_code) : "";
  const apiUrl = getEdgeFunctionUrl();

  // Template captures from current session
  const templateCaptures = captures.filter((c) => c.capture_type === "fingerprint_template");
  const imageCaptures = captures.filter((c) => c.capture_type === "fingerprint_image");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="h-5 w-5 text-primary" />
          Impressão Digital — SDK G2010 ISO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="enroll" className="text-xs gap-1">
              <Fingerprint className="h-3.5 w-3.5" />
              Registar
            </TabsTrigger>
            <TabsTrigger value="verify" className="text-xs gap-1">
              <Shield className="h-3.5 w-3.5" />
              Verificar
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1">
              <Clock className="h-3.5 w-3.5" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* ─── ENROLL TAB ─── */}
          <TabsContent value="enroll" className="mt-4 space-y-4">
            {/* Finger selection */}
            <div>
              <p className="text-xs font-medium mb-2">Seleccione o dedo a registar:</p>
              <div className="flex justify-center gap-4">
                <HandSvg
                  side="esq"
                  enrolled={enrolledSet}
                  selected={selectedFinger}
                  onSelect={setSelectedFinger}
                />
                <HandSvg
                  side="dir"
                  enrolled={enrolledSet}
                  selected={selectedFinger}
                  onSelect={setSelectedFinger}
                />
              </div>
              {selectedFinger && (
                <p className="text-xs text-center mt-2 text-primary font-medium">
                  {FINGER_LABELS[selectedFinger]}
                  {enrolledSet.has(selectedFinger) && (
                    <Badge variant="outline" className="ml-2 text-[10px]">Já registado</Badge>
                  )}
                </p>
              )}
            </div>

            {/* Device connection */}
            {!isActive ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <Button
                  onClick={start}
                  disabled={loading || !selectedFinger}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  Ligar Leitor G2010
                </Button>
                {!selectedFinger && (
                  <p className="text-[10px] text-muted-foreground">
                    Seleccione um dedo primeiro
                  </p>
                )}
              </div>
            ) : session ? (
              <div className="space-y-3">
                {/* QR Pairing */}
                {status === "pending" && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white p-2.5 rounded-lg">
                      <QRCodeSVG value={pairingUrl} size={140} level="M" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Código de emparelhamento:</p>
                      <p className="text-xl font-mono font-bold tracking-[0.3em] text-primary">
                        {session.session_code}
                      </p>
                    </div>
                  </div>
                )}

                {/* SDK Workflow Steps */}
                {(status === "paired" || status === "active") && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Processo SDK G2010:</p>
                    <div className="space-y-1">
                      {SDK_STEPS.map((step, i) => {
                        const stepData = sdkWorkflow[`step_${step.key}`] as
                          | { status: string; error_code?: string; error_info?: string }
                          | undefined;
                        const isDone = stepData?.status === "success";
                        const isFailed = stepData?.status === "error";
                        const isCurrent = sdkWorkflow.last_step === step.key && !isDone && !isFailed;

                        return (
                          <div
                            key={step.key}
                            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                              isDone
                                ? "bg-success/10"
                                : isFailed
                                  ? "bg-destructive/10"
                                  : isCurrent
                                    ? "bg-primary/10"
                                    : "bg-muted/30"
                            }`}
                          >
                            <span className="w-5 text-center text-[10px] text-muted-foreground">
                              {i + 1}
                            </span>
                            {isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                            ) : isFailed ? (
                              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            ) : isCurrent ? (
                              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                            ) : (
                              <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={`font-medium ${isDone ? "text-success" : isFailed ? "text-destructive" : ""}`}>
                                {step.label}
                              </span>
                              <span className="text-muted-foreground ml-1.5">— {step.desc}</span>
                            </div>
                            {isFailed && stepData?.error_code && (
                              <Badge variant="destructive" className="text-[9px]">
                                ERR {stepData.error_code}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Captures received */}
                {templateCaptures.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-success">
                      ✓ {templateCaptures.length} template(s) ISO recebido(s)
                    </p>
                    {templateCaptures.map((c) => {
                      const q = getQualityLabel(c.quality_score);
                      return (
                        <div key={c.id} className="flex items-center justify-between bg-success/5 rounded-md px-3 py-2">
                          <div className="flex items-center gap-2 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            <span>ISO 19794-2 — {c.finger_position ? FINGER_LABELS[c.finger_position as FingerPosition] || c.finger_position : "N/D"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium ${q.color}`}>{q.label}</span>
                            {c.quality_score != null && (
                              <Badge variant="outline" className="text-[9px]">Q:{c.quality_score}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {imageCaptures.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{imageCaptures.length} imagem(ns) raw</p>
                    <div className="flex gap-2 flex-wrap">
                      {imageCaptures.map((c) => (
                        <img
                          key={c.id}
                          src={`data:image/bmp;base64,${c.data}`}
                          alt="Fingerprint"
                          className="h-16 w-12 rounded border border-border object-cover bg-black"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="destructive" size="sm" onClick={stop} className="gap-1">
                    <X className="h-3.5 w-3.5" /> Encerrar
                  </Button>
                  {status === "pending" && (
                    <Button variant="ghost" size="sm" onClick={() => { stop(); start(); }} className="gap-1">
                      <RefreshCw className="h-3.5 w-3.5" /> Novo Código
                    </Button>
                  )}
                </div>

                {/* API details for dev */}
                <details className="text-[10px]">
                  <summary className="text-muted-foreground cursor-pointer">Detalhes API (Android)</summary>
                  <div className="mt-1 rounded bg-muted/30 p-2 font-mono break-all space-y-0.5">
                    <p><strong>Endpoint:</strong> {apiUrl}</p>
                    <p><strong>Pair:</strong> POST ?action=pair</p>
                    <p><strong>SDK Status:</strong> POST ?action=sdk_status</p>
                    <p><strong>Capture:</strong> POST ?action=capture</p>
                    <p><strong>finger_position:</strong> {selectedFinger || "—"}</p>
                  </div>
                </details>
              </div>
            ) : null}

            {/* Enrolled fingerprints summary */}
            {enrolled.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium mb-2">Impressões registadas ({enrolled.length}):</p>
                <div className="space-y-1">
                  {enrolled.map((fp) => {
                    const q = getQualityLabel(fp.quality_score);
                    return (
                      <div key={fp.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <Fingerprint className="h-3.5 w-3.5 text-success" />
                          <span>{FINGER_LABELS[fp.finger_position]}</span>
                          <span className={`text-[10px] ${q.color}`}>{q.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(fp.created_at).toLocaleDateString("pt-AO")}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive/60 hover:text-destructive"
                            onClick={() => handleDeactivate(fp.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── VERIFY TAB ─── */}
          <TabsContent value="verify" className="mt-4 space-y-4">
            {enrolled.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma impressão registada para verificação
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setActiveTab("enroll")}
                >
                  Registar primeiro
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-info/5 border border-info/20 p-3">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-info mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Verificação biométrica ISO 19794-2</p>
                      <p className="text-muted-foreground">
                        Ligue o leitor G2010, capture a impressão digital do agricultor
                        e o dispositivo comparará com o template registado.
                        Score ≥ {MATCH_THRESHOLD} = correspondência válida.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <Button onClick={start} disabled={loading || isActive} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Iniciar Verificação
                  </Button>
                </div>

                {isActive && session && (
                  <div className="space-y-3">
                    {status === "pending" && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-white p-2 rounded-lg">
                          <QRCodeSVG value={pairingUrl} size={120} level="M" />
                        </div>
                        <p className="text-lg font-mono font-bold tracking-[0.2em] text-primary">
                          {session.session_code}
                        </p>
                      </div>
                    )}

                    {(status === "paired" || status === "active") && (
                      <div className="text-center py-4">
                        <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Aguardando verificação do dispositivo...
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          O dispositivo compara com: LIVESCAN_VERIFYTEMPLATE
                        </p>
                      </div>
                    )}

                    <Button variant="ghost" size="sm" onClick={stop} className="w-full gap-1">
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </div>
                )}

                {/* Recent verifications */}
                {verifications.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-medium mb-2">Últimas verificações:</p>
                    <div className="space-y-1">
                      {verifications.slice(0, 5).map((v) => {
                        const m = getMatchLabel(v.match_score);
                        return (
                          <div key={v.id} className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-1.5 text-xs">
                            <div className="flex items-center gap-2">
                              {v.match_result === "match" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              )}
                              <span className={m.color}>{m.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">
                                {v.match_score}/{MATCH_THRESHOLD}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(v.created_at).toLocaleString("pt-AO", {
                                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ─── HISTORY TAB ─── */}
          <TabsContent value="history" className="mt-4">
            {loadingData ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Enrolled summary */}
                <div>
                  <p className="text-xs font-medium mb-2">Templates ISO registados</p>
                  {enrolled.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum template registado</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {FINGER_POSITIONS.map((fp) => {
                        const data = enrolled.find((e) => e.finger_position === fp);
                        return (
                          <div
                            key={fp}
                            className={`rounded-md px-2 py-1.5 text-xs flex items-center gap-1.5 ${
                              data ? "bg-success/10" : "bg-muted/30"
                            }`}
                          >
                            {data ? (
                              <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                            ) : (
                              <div className="h-3 w-3 rounded-full border border-border shrink-0" />
                            )}
                            <span className={data ? "text-foreground" : "text-muted-foreground"}>
                              {FINGER_LABELS[fp]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Verification history */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium">Histórico de verificações</p>
                    <Button variant="ghost" size="sm" onClick={loadVerifications} className="h-6 text-[10px]">
                      <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
                    </Button>
                  </div>
                  {verifications.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma verificação registada</p>
                  ) : (
                    <ScrollArea className="max-h-60">
                      <div className="space-y-1">
                        {verifications.map((v) => {
                          const m = getMatchLabel(v.match_score);
                          return (
                            <div
                              key={v.id}
                              className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {v.match_result === "match" ? (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                ) : v.match_result === "no_match" ? (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-warning" />
                                )}
                                <div>
                                  <span className={`font-medium ${m.color}`}>{m.label}</span>
                                  {v.finger_position && (
                                    <span className="text-muted-foreground ml-1">
                                      — {FINGER_LABELS[v.finger_position as FingerPosition] || v.finger_position}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-16">
                                  <Progress
                                    value={m.percentage}
                                    className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-warning [&>div]:to-success"
                                  />
                                </div>
                                <span className="text-[10px] font-mono w-10 text-right">{v.match_score}</span>
                                <span className="text-[10px] text-muted-foreground w-20 text-right">
                                  {new Date(v.created_at).toLocaleString("pt-AO", {
                                    day: "2-digit", month: "2-digit", year: "2-digit",
                                    hour: "2-digit", minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* SDK specs */}
                <div className="rounded-lg bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground text-xs">Especificações SDK G2010</p>
                  <p>• Norma: ISO/IEC 19794-2:2005 (ISO_FMR)</p>
                  <p>• Template: 498 bytes máx.</p>
                  <p>• Imagem raw: 256×360 pixels, 8-bit</p>
                  <p>• Score verificação: 580–2000 (limiar: {MATCH_THRESHOLD})</p>
                  <p>• Classe: com.Oxi.library.JG_FprDev</p>
                  <p>• Conexão: USB (não suporta debug USB simultâneo)</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FingerprintSdkPanel;
