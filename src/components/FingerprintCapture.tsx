import { useRef, useState, useEffect, useCallback } from "react";
import { Fingerprint, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  onCapture: (imageData: string) => void;
  captured?: string;
  onRemove?: () => void;
};

const FingerprintCapture = ({ label, onCapture, captured, onRemove }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [touchPoints, setTouchPoints] = useState(0);
  const [progress, setProgress] = useState(0);
  const isDrawing = useRef(false);
  const requiredPoints = 150;

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Dark background like real scanners
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Fingerprint guide circle
    ctx.strokeStyle = "rgba(34,197,94,0.3)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(rect.width / 2, rect.height / 2, Math.min(rect.width, rect.height) / 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Guide text
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pressione o dedo aqui", rect.width / 2, rect.height - 16);
  }, []);

  useEffect(() => {
    if (isCapturing) {
      initCanvas();
      setTouchPoints(0);
      setProgress(0);
    }
  }, [isCapturing, initCanvas]);

  const drawTouch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const px = x - rect.left;
    const py = y - rect.top;

    // Simulate fingerprint ridge lines
    ctx.strokeStyle = `rgba(34,197,94,${0.3 + Math.random() * 0.4})`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();

    const angle = Math.atan2(py - rect.height / 2, px - rect.width / 2);
    const len = 4 + Math.random() * 8;
    ctx.moveTo(px - Math.cos(angle + 1.2) * len, py - Math.sin(angle + 1.2) * len);
    ctx.lineTo(px + Math.cos(angle + 1.2) * len, py + Math.sin(angle + 1.2) * len);
    ctx.stroke();

    // Small dots
    ctx.fillStyle = `rgba(34,197,94,${0.4 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(px, py, 1 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();

    setTouchPoints((prev) => {
      const next = prev + 1;
      setProgress(Math.min(100, (next / requiredPoints) * 100));
      if (next >= requiredPoints) {
        // Capture complete
        setTimeout(() => {
          const dataUrl = canvas.toDataURL("image/png");
          onCapture(dataUrl);
          setIsCapturing(false);
        }, 300);
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
  };
  const handleEnd = () => {
    isDrawing.current = false;
  };

  if (captured) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium">{label}</label>
        <div className="relative h-36 rounded-lg overflow-hidden border border-border bg-gray-900">
          <img src={captured} alt={label} className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-xs text-center py-1.5 font-medium flex items-center justify-center gap-1">
            <Check className="h-3 w-3" />
            Capturado
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="absolute top-1.5 right-1.5 bg-muted/80 hover:bg-destructive text-foreground hover:text-destructive-foreground rounded-full p-1.5 transition-colors"
              title="Recapturar"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isCapturing) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium">{label}</label>
        <div className="relative rounded-lg overflow-hidden border-2 border-primary bg-gray-900">
          <canvas
            ref={canvasRef}
            className="w-full touch-none cursor-crosshair"
            style={{ height: 160 }}
            onTouchStart={handleStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleEnd}
            onMouseDown={handleStart}
            onMouseMove={handleMouseMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
          />
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Status */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            <span className="text-xs text-green-400 font-medium bg-black/50 px-2 py-0.5 rounded">
              {progress < 100 ? "A capturar..." : "Concluído!"}
            </span>
            <span className="text-xs text-white/60 bg-black/50 px-2 py-0.5 rounded">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => { setIsCapturing(false); setTouchPoints(0); setProgress(0); }}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium">{label}</label>
      <button
        onClick={() => setIsCapturing(true)}
        className="h-36 w-full rounded-lg border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 hover:bg-muted active:scale-[0.98] transition-all"
      >
        <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
          <Fingerprint className="h-6 w-6 text-accent-foreground" />
        </div>
        <span className="text-xs text-muted-foreground font-medium">Toque para capturar</span>
      </button>
    </div>
  );
};

export default FingerprintCapture;
