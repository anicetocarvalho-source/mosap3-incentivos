import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Download, Loader2, CheckSquare, Square, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFarmersList } from "@/hooks/useFarmersList";
import FarmerIdCard, { FarmerCardData } from "@/components/cartao/FarmerIdCard";
import { generateBatchPdf, DEFAULT_PRINT_LAYOUT, type PrintLayoutOptions } from "@/lib/cardExport";
import PrintLayoutDialog from "@/components/cartao/PrintLayoutDialog";
import PageHeader from "@/components/PageHeader";

const CartaoIdLote = () => {
  const { farmers, loading: farmersLoading } = useFarmersList();
  const [search, setSearch] = useState("");
  const [filterProvince, setFilterProvince] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const renderContainerRef = useRef<HTMLDivElement>(null);

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

  const handleGenerate = useCallback(async () => {
    if (selected.size === 0) {
      toast.error("Selecione pelo menos um agricultor");
      return;
    }

    setGenerating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;

      const selectedFarmers = farmers.filter((f) => selected.has(f.code));

      // Create/update cards in batches of 50
      const tokens: Map<string, string> = new Map();
      for (let i = 0; i < selectedFarmers.length; i += 50) {
        const batch = selectedFarmers.slice(i, i + 50);
        for (const f of batch) {
          const { data: existing } = await supabase
            .from("farmer_cards")
            .select("id, card_token")
            .eq("farmer_code", f.code)
            .neq("status", "Revogado")
            .maybeSingle();

          if (existing) {
            await supabase.from("farmer_cards").update({
              status: "Gerado", generated_at: new Date().toISOString(), generated_by: userId,
            }).eq("id", existing.id);
            tokens.set(f.code, existing.card_token);
          } else {
            const { data: newCard } = await supabase.from("farmer_cards").insert({
              farmer_code: f.code, status: "Gerado",
              generated_at: new Date().toISOString(), generated_by: userId,
            }).select("card_token").single();
            if (newCard) tokens.set(f.code, newCard.card_token);
          }

          await supabase.from("farmer_card_logs").insert({
            farmer_code: f.code, action: "gerado", performed_by: userId,
            details: { batch: true },
          });
        }
      }

      // Render cards off-screen and capture
      const container = renderContainerRef.current;
      if (!container) throw new Error("Container não encontrado");

      // We need to render each card, wait for it, capture, then remove
      const cardElements: { front: HTMLElement; back: HTMLElement }[] = [];

      for (const f of selectedFarmers) {
        const token = tokens.get(f.code);
        if (!token) continue;

        // Create temporary card elements
        const wrapper = document.createElement("div");
        wrapper.style.position = "absolute";
        wrapper.style.left = "-9999px";
        wrapper.style.top = "0";
        container.appendChild(wrapper);

        // Render front
        const frontDiv = document.createElement("div");
        frontDiv.setAttribute("data-card-side", "front");
        wrapper.appendChild(frontDiv);

        const backDiv = document.createElement("div");
        backDiv.setAttribute("data-card-side", "back");
        wrapper.appendChild(backDiv);

        // Use ReactDOM to render cards into these divs
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

        // Render front card
        const frontRoot = createRoot(frontDiv);
        frontRoot.render(
          <FarmerIdCard farmer={farmerData} cardToken={token} side="front" />
        );

        const backRoot = createRoot(backDiv);
        backRoot.render(
          <FarmerIdCard farmer={farmerData} cardToken={token} side="back" />
        );

        // Wait for render
        await new Promise((r) => setTimeout(r, 200));

        const frontEl = frontDiv.querySelector("[data-card-side='front']") as HTMLElement || frontDiv;
        const backEl = backDiv.querySelector("[data-card-side='back']") as HTMLElement || backDiv;

        cardElements.push({ front: frontEl, back: backEl });
      }

      // Generate PDF
      const blob = await generateBatchPdf(cardElements);

      // Cleanup
      while (container.firstChild) container.removeChild(container.firstChild);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartoes-id-lote-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${selectedFarmers.length} cartões gerados com sucesso`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar cartões em lote");
    }
    setGenerating(false);
  }, [selected, farmers]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6">
      <PageHeader title="Geração em Lote" description="Selecione agricultores para gerar cartões ID em massa" />

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
        <Button onClick={handleGenerate} disabled={generating || selected.size === 0}>
          {generating ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A gerar...</>
          ) : (
            <><Download className="h-4 w-4 mr-2" /> Gerar PDF ({selected.size})</>
          )}
        </Button>
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
