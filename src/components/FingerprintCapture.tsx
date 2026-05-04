import { useRef, useState, useEffect, useCallback } from "react";
import { Fingerprint, RotateCcw, Check, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import DevicePairingPanel from "@/components/device/DevicePairingPanel";

type Props = {
  label: string;
  onCapture: (imageData: string) => void;
  captured?: string;
  onRemove?: () => void;
  farmerCode?: string;
  allowRealDevice?: boolean;
};

const REQUIRED_POINTS = 50;
const QUALITY_THRESHOLDS = { low: 40, medium: 75, high: 100 };

function getQualityLabel(progress: number) {
  if (progress < QUALITY_THRESHOLDS.low) return { text: "Fraca", color: "text-destructive" };
  if (progress < QUALITY_THRESHOLDS.medium) return { text: "Média", color: "text-warning" };
  if (progress < QUALITY_THRESHOLDS.high) return { text: "Boa", color: "text-success" };
  return { text: "Excelente", color: "text-primary" };
}

function vibrate(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

const FingerprintCapture = ({ label, onCapture, captured, onRemove, farmerCode, allowRealDevice = true }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanLineRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [useRealDevice, setUseRealDevice] = useState(false);
  const [touchPoints, setTouchPoints] = useState(0);
  const [progress, setProgress] = useState(0);
  const isDrawing = useRef(false);
  const centerRef = useRef({ cx: 0, cy: 0 });

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    centerRef.current = { cx: w / 2, cy: h / 2 };

    // Dark scanner background with subtle gradient
    const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.5);
    bg.addColorStop(0, "#0f1a12");
    bg.addColorStop(1, "#080d09");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Fingerprint oval guide
    const rx = Math.min(w, h) / 2.8;
    const ry = rx * 1.3;
    ctx.strokeStyle = "rgba(34,197,94,0.15)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner brackets
    const bLen = 14;
    const bPad = 16;
    ctx.strokeStyle = "rgba(34,197,94,0.35)";
    ctx.lineWidth = 2;
    // Top-left
    ctx.beginPath(); ctx.moveTo(bPad, bPad + bLen); ctx.lineTo(bPad, bPad); ctx.lineTo(bPad + bLen, bPad); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(w - bPad - bLen, bPad); ctx.lineTo(w - bPad, bPad); ctx.lineTo(w - bPad, bPad + bLen); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(bPad, h - bPad - bLen); ctx.lineTo(bPad, h - bPad); ctx.lineTo(bPad + bLen, h - bPad); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(w - bPad - bLen, h - bPad); ctx.lineTo(w - bPad, h - bPad); ctx.lineTo(w - bPad, h - bPad - bLen); ctx.stroke();

    // Guide text
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pressione o dedo aqui", w / 2, h - 14);

    // Start scan-line animation
    startScanLine(canvas, ctx, dpr);
  }, []);

  const startScanLine = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dpr: number) => {
    cancelAnimationFrame(animFrameRef.current);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    let y = 0;
    const speed = 0.6;

    const animate = () => {
      // Draw scan line over existing content
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createLinearGradient(0, y - 4, 0, y + 4);
      grad.addColorStop(0, "rgba(34,197,94,0)");
      grad.addColorStop(0.5, "rgba(34,197,94,0.08)");
      grad.addColorStop(1, "rgba(34,197,94,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 4, w, 8);
      ctx.restore();

      y += speed;
      if (y > h) y = 0;
      scanLineRef.current = y;
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isCapturing) {
      initCanvas();
      setTouchPoints(0);
      setProgress(0);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isCapturing, initCanvas]);

  const drawTouch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const px = x - rect.left;
    const py = y - rect.top;
    const { cx, cy } = centerRef.current;

    // Distance from center for concentric ridge effect
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const angle = Math.atan2(py - cy, px - cx);

    // Simulate concentric fingerprint ridges
    const ridgePhase = dist * 0.35;
    const ridgeIntensity = 0.3 + 0.4 * Math.abs(Math.sin(ridgePhase));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Main ridge arc
    ctx.strokeStyle = `rgba(34,197,94,${ridgeIntensity})`;
    ctx.lineWidth = 0.8 + Math.random() * 0.8;
    ctx.beginPath();
    const arcLen = 0.3 + Math.random() * 0.5;
    const arcRadius = dist + (Math.random() - 0.5) * 3;
    ctx.arc(cx, cy, Math.max(2, arcRadius), angle - arcLen, angle + arcLen);
    ctx.stroke();

    // Secondary micro-ridges
    if (Math.random() > 0.4) {
      ctx.strokeStyle = `rgba(34,197,94,${ridgeIntensity * 0.5})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const offset = (Math.random() - 0.5) * 6;
      ctx.arc(cx, cy, Math.max(2, arcRadius + offset), angle - arcLen * 0.7, angle + arcLen * 0.7);
      ctx.stroke();
    }

    // Minutiae dots (bifurcations / endings)
    if (Math.random() > 0.7) {
      ctx.fillStyle = `rgba(34,197,94,${0.3 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(px + (Math.random() - 0.5) * 3, py + (Math.random() - 0.5) * 3, 0.8 + Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Haptic feedback on mobile
    vibrate(4);

    setTouchPoints((prev) => {
      const next = prev + 1;
      const pct = Math.min(100, (next / REQUIRED_POINTS) * 100);
      setProgress(pct);
      if (next >= REQUIRED_POINTS) {
        vibrate(30);
        cancelAnimationFrame(animFrameRef.current);
        setTimeout(() => {
          const dataUrl = canvas.toDataURL("image/png");
          onCapture(dataUrl);
          setIsCapturing(false);
        }, 400);
      }
      return next;
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const touch = e.touches[0];
    drawTouch(touch.clientX, touch.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    drawTouch(e.clientX, e.clientY);
  };

  const handleStart = () => {
    isDrawing.current = true;
    vibrate(12);
  };
  const handleEnd = () => {
    isDrawing.current = false;
  };

  // ── Captured state ──
  if (captured) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <div className="relative h-40 rounded-xl overflow-hidden border border-primary/30 bg-foreground/95 shadow-lg shadow-primary/5">
          <img src={captured} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            <span className="text-xs font-semibold text-success">Capturada</span>
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm hover:bg-destructive text-white rounded-full p-1.5 transition-all hover:scale-110"
              title="Recapturar"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Capturing state ──
  if (isCapturing) {
    const quality = getQualityLabel(progress);
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <div className="relative rounded-xl overflow-hidden border-2 border-primary/60 bg-foreground/95 shadow-xl shadow-primary/10">
          <canvas
            ref={canvasRef}
            className="w-full touch-none cursor-crosshair"
            style={{ height: 180 }}
            onTouchStart={handleStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleEnd}
            onMouseDown={handleStart}
            onMouseMove={handleMouseMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
          />

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0">
            <Progress value={progress} className="h-1.5 rounded-none bg-muted [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-success" />
          </div>

          {/* HUD overlay */}
          <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1.5 bg-foreground/60 backdrop-blur-sm px-2 py-1 rounded-md">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${progress >= 100 ? "bg-success" : "bg-primary animate-pulse"}`} />
              <span className="text-[10px] font-medium text-primary-foreground">
                {progress >= 100 ? "Concluído" : "A capturar…"}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
              <span className={`text-[10px] font-semibold ${quality.color}`}>
                {quality.text}
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-destructive"
          onClick={() => {
            cancelAnimationFrame(animFrameRef.current);
            setIsCapturing(false);
            setTouchPoints(0);
            setProgress(0);
          }}
        >
          Cancelar captura
        </Button>
      </div>
    );
  }

  // ── Real device mode ──
  if (useRealDevice) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">{label}</label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground"
            onClick={() => setUseRealDevice(false)}
          >
            Modo simulação
          </Button>
        </div>
        <DevicePairingPanel
          deviceType="fingerprint"
          farmerCode={farmerCode}
          onCaptureImage={(dataUrl) => {
            onCapture(dataUrl);
            setUseRealDevice(false);
          }}
          compact={false}
        />
      </div>
    );
  }

  // ── Idle state ──
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <button
        onClick={() => setIsCapturing(true)}
        className="group h-40 w-full rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2.5 hover:bg-muted/60 hover:border-primary/40 active:scale-[0.97] transition-all"
      >
        <div className="h-14 w-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
          <Fingerprint className="h-7 w-7 text-primary/70 group-hover:text-primary transition-colors" />
        </div>
        <span className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">
          Toque para capturar
        </span>
      </button>
      {allowRealDevice && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-[10px] text-muted-foreground gap-1.5"
          onClick={() => setUseRealDevice(true)}
        >
          <Smartphone className="h-3 w-3" />
          Usar leitor G2010
        </Button>
      )}
    </div>
  );
};

export default FingerprintCapture;
