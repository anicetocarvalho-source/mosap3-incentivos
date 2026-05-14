import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download, Loader2, CheckSquare, Square, CreditCard, CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFarmersList } from "@/hooks/useFarmersList";
import FarmerIdCard, { FarmerCardData } from "@/components/cartao/FarmerIdCard";
import { generateBatchPdf, DEFAULT_PRINT_LAYOUT, type PrintLayoutOptions } from "@/lib/cardExport";
import PrintLayoutDialog from "@/components/cartao/PrintLayoutDialog";
import PageHeader from "@/components/PageHeader";

interface FarmerResult {
  code: string;
  name: string;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
}

const CartaoIdLote = () => {
  const { farmers, loading: farmersLoading } = useFarmersList();
  const [search, setSearch] = useState("");
  const [filterProvince, setFilterProvince] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [printLayout, setPrintLayout] = useState<PrintLayoutOptions>(DEFAULT_PRINT_LAYOUT);
  const renderContainerRef = useRef<HTMLDivElement>(null);

  // Progress state
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressPhase, setProgressPhase] = useState<"db" | "render" | "pdf" | "done">("db");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [results, setResults] = useState<FarmerResult[]>([]);

  const provinces = [...new Set(farmers.map((f) => f.province).filter(Boolean))].sort();

  const filtered = farmers.filter((f) => {
    if (f.status === "Removido") return false;
    if (filterProvince !== "all" && f.province !== filterProvince) return false;
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.full_name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((f) => f.code)));
    }
  };

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const progressPct = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  const phaseLabel: Record<string, string> = {
    db: "A registar cartões na base de dados…",
    render: "A renderizar cartões…",
    pdf: "A gerar PDF…",
    done: "Concluído",
  };

  const handleGenerate = useCallback(async () => {
    if (selected.size === 0) {
      toast.error("Selecione pelo menos um agricultor");
      return;
    }

    const selectedFarmers = farmers.filter((f) => selected.has(f.code));
    const total = selectedFarmers.length;

    // Init progress
    const initResults: FarmerResult[] = selectedFarmers.map((f) => ({
      code: f.code,
      name: f.full_name,
      status: "pending",
    }));
    setResults(initResults);
    setProgressTotal(total);
    setProgressCurrent(0);
    setProgressPhase("db");
    setProgressVisible(true);
    setGenerating(true);

    const updateResult = (code: string, patch: Partial<FarmerResult>) => {
      setResults((prev) => prev.map((r) => (r.code === code ? { ...r, ...patch } : r)));
    };

    try {
      // Phase 1: DB — gerar todos os cartões numa única chamada (RPC em lote)
      const codes = selectedFarmers.map((f) => f.code);
      selectedFarmers.forEach((f) => updateResult(f.code, { status: "processing" }));

      const tokens: Map<string, string> = new Map();
      const { data: batchData, error: batchErr } = await (supabase as any)
        .rpc("generate_farmer_cards_batch", { _codes: codes });

      if (batchErr) {
        selectedFarmers.forEach((f) =>
          updateResult(f.code, { status: "error", error: batchErr.message })
        );
        throw batchErr;
      }

      for (const row of (batchData || []) as Array<{ farmer_code: string; card_token: string }>) {
        tokens.set(row.farmer_code, row.card_token);
        updateResult(row.farmer_code, { status: "success" });
      }
      // Marcar como erro qualquer agricultor sem token retornado
      selectedFarmers.forEach((f) => {
        if (!tokens.has(f.code)) updateResult(f.code, { status: "error", error: "Cartão não retornado" });
      });
      setProgressCurrent(selectedFarmers.length);

      // Phase 2: Render cards off-screen
      setProgressPhase("render");
      setProgressCurrent(0);
      const successfulFarmers = selectedFarmers.filter((f) => tokens.has(f.code));
      setProgressTotal(successfulFarmers.length);

      if (successfulFarmers.length === 0) {
        toast.error("Nenhum cartão gerado com sucesso");
        setProgressPhase("done");
        setGenerating(false);
        return;
      }

      const container = renderContainerRef.current;
      if (!container) throw new Error("Container não encontrado");

      const cardElements: { front: HTMLElement; back: HTMLElement }[] = [];

      for (let i = 0; i < successfulFarmers.length; i++) {
        const f = successfulFarmers[i];
        const token = tokens.get(f.code)!;

        const wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = "-9999px";
        wrapper.style.top = "0";
        container.appendChild(wrapper);

        const frontDiv = document.createElement("div");
        frontDiv.setAttribute("data-card-side", "front");
        wrapper.appendChild(frontDiv);

        const backDiv = document.createElement("div");
        backDiv.setAttribute("data-card-side", "back");
        wrapper.appendChild(backDiv);

        const { createRoot } = await import("react-dom/client");

        const farmerData: FarmerCardData = {
          code: f.code,
          full_name: f.full_name,
          province: f.province,
          status: f.status,
          patec: f.patec,
          valor_recebido: f.valor_recebido,
          saldo_final: f.saldo_final,
        };

        const frontRoot = createRoot(frontDiv);
        frontRoot.render(
          <FarmerIdCard farmer={farmerData} cardToken={token} side="front" />
        );

        const backRoot = createRoot(backDiv);
        backRoot.render(
          <FarmerIdCard farmer={farmerData} cardToken={token} side="back" />
        );

        await new Promise((r) => setTimeout(r, 200));

        const frontEl = frontDiv.querySelector("[data-card-side='front']") as HTMLElement || frontDiv;
        const backEl = backDiv.querySelector("[data-card-side='back']") as HTMLElement || backDiv;

        cardElements.push({ front: frontEl, back: backEl });
        setProgressCurrent(i + 1);
      }

      // Phase 3: Generate PDF
      setProgressPhase("pdf");
      setProgressCurrent(0);
      setProgressTotal(1);

      const blob = await generateBatchPdf(cardElements, printLayout);

      // Cleanup
      while (container.firstChild) container.removeChild(container.firstChild);

      setProgressCurrent(1);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartoes-id-lote-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setProgressPhase("done");
      toast.success(`${successfulFarmers.length} cartões gerados com sucesso`);
      if (errorCount > 0) {
        toast.warning(`${errorCount} cartões falharam — veja o relatório`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro fatal ao gerar cartões em lote");
      setProgressPhase("done");
    }
    setGenerating(false);
  }, [selected, farmers, printLayout]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6">
      <PageHeader title="Geração em Lote" description="Selecione agricultores para gerar cartões ID em massa" />

      {/* Progress Panel */}
      <AnimatePresence>
        {progressVisible && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <Card className="border-primary/30">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {progressPhase !== "done" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : errorCount > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                  {phaseLabel[progressPhase]}
                </CardTitle>
                {progressPhase === "done" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setProgressVisible(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{progressCurrent} / {progressTotal}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>

                {/* Summary badges */}
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    {successCount} sucesso
                  </Badge>
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      {errorCount} erro{errorCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {results.filter((r) => r.status === "pending").length > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      {results.filter((r) => r.status === "pending").length} pendente{results.filter((r) => r.status === "pending").length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {/* Per-farmer results list */}
                <ScrollArea className="max-h-52">
                  <div className="divide-y rounded-md border">
                    {results.map((r) => (
                      <div key={r.code} className="flex items-center gap-2 px-3 py-2 text-sm">
                        {r.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />}
                        {r.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />}
                        {r.status === "success" && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
                        {r.status === "error" && <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                        <span className="font-mono text-xs text-muted-foreground w-24 flex-shrink-0 truncate">{r.code}</span>
                        <span className="flex-1 truncate">{r.name}</span>
                        {r.error && (
                          <span className="text-xs text-destructive truncate max-w-[200px]" title={r.error}>{r.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterProvince} onValueChange={setFilterProvince}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Província" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Províncias</SelectItem>
            {provinces.map((p) => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Aprovado">Aprovado</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value="Validado">Validado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selection actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {selected.size === filtered.length && filtered.length > 0 ? (
              <><CheckSquare className="h-4 w-4 mr-1" /> Desmarcar Todos</>
            ) : (
              <><Square className="h-4 w-4 mr-1" /> Selecionar Todos ({filtered.length})</>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">{selected.size} seleccionados</span>
        </div>
        <div className="flex items-center gap-2">
          <PrintLayoutDialog value={printLayout} onChange={setPrintLayout} />
          <Button onClick={handleGenerate} disabled={generating || selected.size === 0}>
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A gerar...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Gerar PDF ({selected.size})</>
            )}
          </Button>
        </div>
      </div>

      {/* List */}
      {farmersLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="rounded-lg border divide-y max-h-[60vh] overflow-y-auto">
          {filtered.map((f) => (
            <div
              key={f.code}
              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors ${selected.has(f.code) ? "bg-primary/5" : ""}`}
              onClick={() => toggle(f.code)}
            >
              <Checkbox checked={selected.has(f.code)} onCheckedChange={() => toggle(f.code)} />
              <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.full_name}</p>
                <p className="text-xs text-muted-foreground">{f.code} — {f.province || "Sem província"}</p>
              </div>
              <span className="text-xs text-muted-foreground">{f.status}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="p-6 text-center text-muted-foreground text-sm">Nenhum agricultor encontrado</p>
          )}
        </div>
      )}

      {/* Hidden render container for PDF generation */}
      <div ref={renderContainerRef} style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }} />
    </motion.div>
  );
};

export default CartaoIdLote;
