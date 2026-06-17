import { useEffect, useLayoutEffect, useRef } from "react";
import { useOutletContext, useSearchParams, Navigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, Warehouse } from "lucide-react";
import FornecedorProdutos from "./FornecedorProdutos";
import FornecedorStock from "./FornecedorStock";

type Ctx = { supplier: { id: string; name: string; status: string; user_id: string } };

const VALID_TABS = ["produtos", "stock"] as const;
type TabKey = (typeof VALID_TABS)[number];

const SCROLL_KEY = "fornecedor-catalogo:scroll";

const readScroll = (): Record<TabKey, number> => {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (raw) return { produtos: 0, stock: 0, ...JSON.parse(raw) };
  } catch {}
  return { produtos: 0, stock: 0 };
};

const FornecedorCatalogo = () => {
  const ctx = useOutletContext<Ctx>();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabKey = (VALID_TABS as readonly string[]).includes(raw || "") ? (raw as TabKey) : "produtos";

  const scrollRef = useRef<Record<TabKey, number>>(readScroll());
  const prevTabRef = useRef<TabKey>(tab);
  const pendingRestoreRef = useRef<number | null>(null);

  // Track scroll position per tab.
  useEffect(() => {
    const onScroll = () => {
      scrollRef.current[prevTabRef.current] = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollRef.current)); } catch {}
    };
  }, []);

  const setTab = (next: string) => {
    // Save current tab scroll, then schedule restore for the new tab.
    scrollRef.current[prevTabRef.current] = window.scrollY;
    try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollRef.current)); } catch {}
    pendingRestoreRef.current = scrollRef.current[next as TabKey] ?? 0;
    prevTabRef.current = next as TabKey;
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  // Restore scroll after tab content paints. Retry a couple of frames for async-loaded content.
  useLayoutEffect(() => {
    if (pendingRestoreRef.current == null) return;
    const target = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    let tries = 0;
    const restore = () => {
      window.scrollTo({ top: target, behavior: "auto" });
      if (++tries < 6 && Math.abs(window.scrollY - target) > 4) requestAnimationFrame(restore);
    };
    requestAnimationFrame(restore);
  }, [tab]);

  // Re-expose the outlet context to the embedded pages.
  // Both inner pages read via useOutletContext, which already has `supplier`.
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Catálogo &amp; Stock
        </h1>
        <p className="text-muted-foreground text-sm">
          Gestão de produtos, importação a partir de PATEC, stock, preços e histórico de movimentos da loja {ctx.supplier.name}.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="produtos" className="gap-2">
            <Package className="h-4 w-4" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <Warehouse className="h-4 w-4" /> Stock &amp; Preços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4">
          <FornecedorProdutos />
        </TabsContent>
        <TabsContent value="stock" className="mt-4">
          <FornecedorStock />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const RedirectToCatalogo = ({ tab }: { tab: TabKey }) => (
  <Navigate to={`/fornecedor/catalogo?tab=${tab}`} replace />
);

export default FornecedorCatalogo;
