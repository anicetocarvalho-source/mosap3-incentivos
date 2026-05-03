import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { type PrintLayoutOptions, DEFAULT_PRINT_LAYOUT, PRINT_PRESETS } from "@/lib/cardExport";

interface Props {
  value: PrintLayoutOptions;
  onChange: (opts: PrintLayoutOptions) => void;
}

const PrintLayoutDialog = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<PrintLayoutOptions>(value);

  const handleOpen = (o: boolean) => {
    if (o) setLocal(value);
    setOpen(o);
  };

  const apply = () => {
    onChange(local);
    setOpen(false);
  };

  const applyPreset = (name: string) => {
    if (name in PRINT_PRESETS) {
      setLocal({ ...PRINT_PRESETS[name] });
    }
  };

  const set = <K extends keyof PrintLayoutOptions>(key: K, val: PrintLayoutOptions[K]) =>
    setLocal((prev) => ({ ...prev, [key]: val }));

  const previewPage = local.orientation === "portrait" ? { w: 210, h: 297 } : { w: 297, h: 210 };
  const previewScale = 0.35;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1" /> Layout de Impressão
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuração de Layout para Impressão</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Presets */}
          <div>
            <Label className="text-xs text-muted-foreground">Predefinição</Label>
            <Select onValueChange={applyPreset}>
              <SelectTrigger><SelectValue placeholder="Escolher predefinição..." /></SelectTrigger>
              <SelectContent>
                {Object.keys(PRINT_PRESETS).map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Largura do cartão (mm)</Label>
              <Input type="number" step="0.1" value={local.cardWidth} onChange={(e) => set("cardWidth", parseFloat(e.target.value) || 85.6)} />
            </div>
            <div>
              <Label className="text-xs">Altura do cartão (mm)</Label>
              <Input type="number" step="0.1" value={local.cardHeight} onChange={(e) => set("cardHeight", parseFloat(e.target.value) || 54)} />
            </div>
            <div>
              <Label className="text-xs">Margem da página (mm)</Label>
              <Input type="number" step="1" value={local.margin} onChange={(e) => set("margin", parseFloat(e.target.value) || 10)} />
            </div>
            <div>
              <Label className="text-xs">Espaço entre cartões (mm)</Label>
              <Input type="number" step="1" value={local.gap} onChange={(e) => set("gap", parseFloat(e.target.value) || 4)} />
            </div>
            <div>
              <Label className="text-xs">Colunas</Label>
              <Input type="number" min={1} max={4} value={local.cols} onChange={(e) => set("cols", Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div>
              <Label className="text-xs">Linhas</Label>
              <Input type="number" min={1} max={6} value={local.rows} onChange={(e) => set("rows", Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
          </div>

          {/* Orientation */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs">Orientação</Label>
              <Select value={local.orientation} onValueChange={(v: "portrait" | "landscape") => set("orientation", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Retrato (A4)</SelectItem>
                  <SelectItem value="landscape">Paisagem (A4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <Switch checked={local.cropMarks} onCheckedChange={(v) => set("cropMarks", v)} />
              <Label className="text-xs">Marcas de corte</Label>
            </div>
          </div>

          {/* Mini preview */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Pré-visualização ({local.cols}×{local.rows} = {local.cols * local.rows} cartões/página)</Label>
            <div className="flex justify-center">
              <div
                className="border rounded bg-white relative"
                style={{
                  width: previewPage.w * previewScale,
                  height: previewPage.h * previewScale,
                }}
              >
                {Array.from({ length: local.cols * local.rows }).map((_, i) => {
                  const col = i % local.cols;
                  const row = Math.floor(i / local.cols);
                  const totalW = local.cols * local.cardWidth + (local.cols - 1) * local.gap;
                  const totalH = local.rows * local.cardHeight + (local.rows - 1) * local.gap;
                  const startX = Math.max(local.margin, (previewPage.w - totalW) / 2);
                  const startY = Math.max(local.margin, (previewPage.h - totalH) / 2);
                  const x = startX + col * (local.cardWidth + local.gap);
                  const y = startY + row * (local.cardHeight + local.gap);

                  const fits = x + local.cardWidth <= previewPage.w - local.margin + 1 &&
                               y + local.cardHeight <= previewPage.h - local.margin + 1;

                  return (
                    <div
                      key={i}
                      className={`absolute rounded-sm ${fits ? "bg-primary/20 border border-primary/40" : "bg-destructive/20 border border-destructive/40"}`}
                      style={{
                        left: x * previewScale,
                        top: y * previewScale,
                        width: local.cardWidth * previewScale,
                        height: local.cardHeight * previewScale,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <Button onClick={apply} className="w-full">Aplicar Layout</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintLayoutDialog;
