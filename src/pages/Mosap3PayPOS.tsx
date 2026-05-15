import { useState, useEffect, useCallback, useRef } from "react";
import { Monitor, Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, User, Package, AlertTriangle, Check, Printer, Maximize, Minimize, Keyboard, Banknote, Smartphone, ArrowRightLeft, Settings2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ban, ShieldAlert, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InvoicePDF, generateFiscalHash, buildQRContent, type InvoiceData } from "@/components/InvoicePDF";
import { classifyError, withRetry } from "@/lib/errorHandling";
import { FARMER_PAGE_SIZE, buildFarmerOrParts, farmerPageRange, shouldSearch } from "@/lib/farmerSearch";

interface Farmer {
  code: string;
  full_name: string;
  phone: string | null;
  patec: number | null;
  photo_frontal_url: string | null;
  saldo_final: string | null;
  sim_status: string | null;
}

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  patec_number: number | null;
  max_per_farmer_per_season: number | null;
  iva_rate: number;
  supplier_id: string;
}

interface PatecItemFull {
  id: string;
  name: string;
  category: string;
  patec_number: number;
  base_quantity: number | null;
  unit: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  recommendedQty: number; // quantidade obrigatória/máxima calculada por PATEC × parcela
}

const PARCEL_OPTIONS = [
  { value: 0.3, label: "0,3 Ha" },
  { value: 0.5, label: "0,5 Ha" },
  { value: 1, label: "1 Ha" },
] as const;
const PARCEL_REFERENCE = 0.5; // base_quantity é definida para 0,5 Ha

interface Supplier {
  id: string;
  name: string;
}

const patecLabels: Record<number, string> = {
  1: "PATEC 1 — Milho",
  2: "PATEC 2 — Massango",
  3: "PATEC 3 — Massambala",
};

interface Mosap3PayPOSProps {
  forcedSupplierId?: string;
}

const Mosap3PayPOS = ({ forcedSupplierId }: Mosap3PayPOSProps = {}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(forcedSupplierId || "");
  const [products, setProducts] = useState<Product[]>([]);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [farmerSearch, setFarmerSearch] = useState("");
  const [farmerSuggestions, setFarmerSuggestions] = useState<Farmer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [farmerHasMore, setFarmerHasMore] = useState(false);
  const [farmerLoadingMore, setFarmerLoadingMore] = useState(false);
  const [farmerTotalCount, setFarmerTotalCount] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [processing, setProcessing] = useState(false);
  const [contactingManager, setContactingManager] = useState(false);
  const [contactConfirmOpen, setContactConfirmOpen] = useState(false);
  const [managers, setManagers] = useState<Array<{ user_id: string; full_name: string; role: string }>>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managerRoleFilter, setManagerRoleFilter] = useState<string>("__all__");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSaleCode, setLastSaleCode] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "polling" | "paid" | "failed">("idle");
  const [lastSaleId, setLastSaleId] = useState("");
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceHash, setInvoiceHash] = useState("");
  const [invoiceQR, setInvoiceQR] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);
  const [kioskCategory, setKioskCategory] = useState("Todos");
  const [kioskPayMethod, setKioskPayMethod] = useState("unitel_money");
  const [kioskDocType, setKioskDocType] = useState<"factura" | "frecibo">("factura");
  const farmerSearchRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const posContainerRef = useRef<HTMLDivElement>(null);

  // Purchased quantities this season (per farmer)
  const [seasonPurchases, setSeasonPurchases] = useState<Record<string, number>>({});
  const [patecItems, setPatecItems] = useState<PatecItemFull[]>([]);
  const [farmerBalance, setFarmerBalance] = useState<number>(0);

  // Parcela selecionada (após escolher agricultor)
  const [parcelSize, setParcelSize] = useState<number | null>(null);
  const [parcelDialogOpen, setParcelDialogOpen] = useState(false);

  // Toggle fullscreen API
  const toggleFullscreen = useCallback(async (enable?: boolean) => {
    const shouldEnable = enable ?? !kioskMode;
    try {
      if (shouldEnable && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (!shouldEnable && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch { /* fullscreen not supported */ }
    setKioskMode(shouldEnable);
  }, [kioskMode]);

  // Sync kiosk state when user exits fullscreen via browser (Esc on fullscreen)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement && kioskMode) setKioskMode(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [kioskMode]);

  // Kiosk keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Inside input fields: Enter submits context, Escape blurs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        // F-keys still work from inputs
        if (!e.key.startsWith("F")) return;
      }

      switch (e.key) {
        case "F1": e.preventDefault(); farmerSearchRef.current?.focus(); break;
        case "F2": e.preventDefault(); productSearchRef.current?.focus(); break;
        case "F3": e.preventDefault(); if (cart.length > 0 && farmer) setConfirmOpen(true); break;
        case "F4": e.preventDefault(); if (cart.length > 0) { setCart([]); toast.info("Carrinho limpo"); } break;
        case "F5": e.preventDefault(); toggleFullscreen(); break;
        case "Enter":
          // If not in an input and cart is ready, open payment
          if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
            if (cart.length > 0 && farmer && !confirmOpen) {
              e.preventDefault();
              setConfirmOpen(true);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          if (confirmOpen) setConfirmOpen(false);
          else if (kioskMode) toggleFullscreen(false);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, farmer, kioskMode, confirmOpen, toggleFullscreen]);

  useEffect(() => {
    if (forcedSupplierId) {
      supabase.from("suppliers").select("id, name").eq("id", forcedSupplierId)
        .then(({ data }) => {
          setSuppliers((data as Supplier[]) || []);
          setSelectedSupplierId(forcedSupplierId);
        });
      return;
    }
    supabase.from("suppliers").select("id, name").eq("status", "Ativo").order("name")
      .then(({ data }) => setSuppliers((data as Supplier[]) || []));
  }, [forcedSupplierId]);

  useEffect(() => {
    if (selectedSupplierId) {
      supabase.from("supplier_products").select("*").eq("supplier_id", selectedSupplierId).eq("status", "Ativo").order("name")
        .then(({ data }) => setProducts((data as Product[]) || []));
    }
  }, [selectedSupplierId]);

  // Autocomplete suggestions as user types (search logic in src/lib/farmerSearch.ts)
  useEffect(() => {
    const q = farmerSearch.trim();
    if (!shouldSearch(q)) {
      setFarmerSuggestions([]);
      setShowSuggestions(false);
      setFarmerHasMore(false);
      setFarmerTotalCount(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const orParts = buildFarmerOrParts(q);
      const { from, to } = farmerPageRange(0);
      const { data, count } = await supabase
        .from("farmers")
        .select("code, full_name, phone, patec, photo_frontal_url, saldo_final, sim_status", { count: "exact" })
        .or(orParts.join(","))
        .order("full_name", { ascending: true })
        .range(from, to);
      const rows = (data as Farmer[]) || [];
      setFarmerSuggestions(rows);
      setShowSuggestions(rows.length > 0);
      setFarmerTotalCount(typeof count === "number" ? count : rows.length);
      setFarmerHasMore(rows.length === FARMER_PAGE_SIZE && (count ?? rows.length) > rows.length);
    }, 300);
    return () => clearTimeout(timeout);
  }, [farmerSearch]);

  const loadMoreFarmerSuggestions = async () => {
    const q = farmerSearch.trim();
    if (!q || farmerLoadingMore || !farmerHasMore) return;
    setFarmerLoadingMore(true);
    try {
      const orParts = buildFarmerOrParts(q);
      const from = farmerSuggestions.length;
      const to = from + FARMER_PAGE_SIZE - 1;
      const { data } = await supabase
        .from("farmers")
        .select("code, full_name, phone, patec, photo_frontal_url, saldo_final, sim_status")
        .or(orParts.join(","))
        .order("full_name", { ascending: true })
        .range(from, to);
      const rows = (data as Farmer[]) || [];
      // Dedupe by code (defensive against ordering ties)
      const existing = new Set(farmerSuggestions.map((f) => f.code));
      const fresh = rows.filter((r) => !existing.has(r.code));
      setFarmerSuggestions((prev) => [...prev, ...fresh]);
      setFarmerHasMore(rows.length === FARMER_PAGE_SIZE);
    } finally {
      setFarmerLoadingMore(false);
    }
  };

  const fetchFarmerBalance = async (farmerCode: string) => {
    const [incRes, salesRes] = await Promise.all([
      supabase.from("farmer_incentives").select("amount").eq("farmer_code", farmerCode).in("status", ["Aprovado", "Pendente", "Pago"]),
      supabase.from("pos_sales").select("total").eq("farmer_code", farmerCode),
    ]);
    const totalInc = (incRes.data || []).reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
    const totalSpent = (salesRes.data || []).reduce((s, sale) => s + Number(sale.total || 0), 0);
    const balance = totalInc - totalSpent;
    setFarmerBalance(balance);
    return balance;
  };

  const loadPatecAndPurchases = async (f: Farmer): Promise<PatecItemFull[]> => {
    let items: PatecItemFull[] = [];
    if (f.patec) {
      const { data } = await supabase.from("patec_items").select("*").eq("patec_number", f.patec);
      items = (data as PatecItemFull[]) || [];
      setPatecItems(items);
    } else {
      setPatecItems([]);
    }
    const { data: sales } = await supabase.from("pos_sales").select("id").eq("farmer_code", f.code);
    if (sales && sales.length > 0) {
      const saleIds = sales.map((s) => s.id);
      const { data: saleItems } = await supabase.from("pos_sale_items").select("product_id, quantity").in("sale_id", saleIds);
      const purchases: Record<string, number> = {};
      saleItems?.forEach((item) => { purchases[item.product_id] = (purchases[item.product_id] || 0) + item.quantity; });
      setSeasonPurchases(purchases);
    } else {
      setSeasonPurchases({});
    }
    return items;
  };

  const isSimBlocked = (status: string | null | undefined) =>
    status === "Barrado" || status === "Removido";

  const simStatusReason = (status: string | null | undefined): { title: string; reason: string; recomendacao: string } | null => {
    switch (status) {
      case "Barrado":
        return {
          title: "Cartão SIM Barrado",
          reason: "O cartão SIM do produtor encontra-se barrado pela operadora ou foi bloqueado administrativamente por irregularidade detectada na reconciliação.",
          recomendacao: "Encaminhe o produtor ao gestor de incentivos para regularização antes de qualquer compra.",
        };
      case "Removido":
        return {
          title: "Cartão SIM Removido",
          reason: "O cartão SIM foi removido do registo do produtor (cancelamento, perda, devolução ou substituição não concluída).",
          recomendacao: "É necessário registar/substituir o SIM e reactivar o cadastro antes de processar pagamentos.",
        };
      case "Pré desactivado":
        return {
          title: "Cartão SIM Pré desactivado",
          reason: "O SIM está marcado para desactivação iminente. As vendas ainda são permitidas, mas serão bloqueadas após confirmação.",
          recomendacao: "Confirme com o produtor antes de finalizar a transação.",
        };
      default:
        return null;
    }
  };

  const loadManagers = async () => {
    setManagersLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_backoffice_managers", { _role: null });
      if (error) throw error;
      setManagers((data ?? []) as any);
    } catch (e) {
      console.warn("loadManagers failed", e);
      setManagers([]);
    } finally {
      setManagersLoading(false);
    }
  };

  const filteredManagers = managerRoleFilter === "__all__"
    ? managers
    : managers.filter((m) => m.role === managerRoleFilter);

  const availableManagerRoles = Array.from(new Set(managers.map((m) => m.role))).sort();

  const contactarGestor = async (f: Farmer) => {
    const r = simStatusReason(f.sim_status);
    if (!r) return;
    setContactingManager(true);
    try {
      const title = `⛔ Apoio solicitado — SIM ${f.sim_status}`;
      const body = `Operador POS sinalizou bloqueio: agricultor ${f.full_name} (${f.code})${f.phone ? ` · Tel: ${f.phone}` : ""}. Motivo: ${r.reason}`;
      const roleArg = managerRoleFilter === "__all__" ? null : managerRoleFilter;
      const { data: count, error } = await supabase.rpc("notify_users_by_role", {
        _title: title,
        _body: body,
        _role: roleArg,
        _category: "cartoes_sim",
        _entity_type: "farmer",
        _entity_id: f.code,
      });
      if (error) throw error;
      try {
        await supabase.from("audit_logs").insert({
          action: "pos_contact_manager_sim_blocked",
          entity_type: "farmer",
          entity_id: f.code,
          details: { sim_status: f.sim_status, farmer_name: f.full_name, phone: f.phone, reason: r.reason, role_filter: roleArg, recipients: count } as any,
        });
      } catch {}
      toast.success(`${count ?? 0} gestor(es) notificado(s)`, {
        description: `Ocorrência do agricultor ${f.code} enviada via sino in-app${roleArg ? ` (função: ${roleArg})` : ""}.`,
      });
    } catch (e: any) {
      toast.error("Não foi possível notificar os gestores", { description: e?.message ?? String(e) });
    } finally {
      setContactingManager(false);
    }
  };

  const notifySimBlockedFarmer = async (
    f: Farmer,
    event: "identificacao_pos" | "tentativa_pagamento"
  ) => {
    try {
      await supabase.rpc("notify_farmer_sim_blocked" as any, {
        _farmer_code: f.code,
        _phone: f.phone,
        _farmer_name: f.full_name,
        _sim_status: f.sim_status,
        _event: event,
        _source: "pos",
      });
    } catch (e) {
      console.warn("notify_farmer_sim_blocked failed", e);
    }
  };

  const selectFarmerFromSuggestion = async (f: Farmer) => {
    if (isSimBlocked(f.sim_status)) {
      const r = simStatusReason(f.sim_status);
      toast.error(`⛔ ${r?.title} — ${f.full_name} (${f.code})`, {
        description: r?.reason,
        duration: 8000,
      });
      setFarmer(f);
      setFarmerSearch(f.code);
      setShowSuggestions(false);
      setFarmerSuggestions([]);
      setCart([]);
      setParcelSize(null);
      setFarmerBalance(0);
      try {
        await supabase.from("audit_logs").insert({
          action: "pos_sale_blocked_sim",
          entity_type: "farmer",
          entity_id: f.code,
          details: { sim_status: f.sim_status, farmer_name: f.full_name, event: "identificacao_pos" } as any,
        });
      } catch {}
      notifySimBlockedFarmer(f, "identificacao_pos");
      return;
    }
    setFarmer(f);
    setFarmerSearch(f.code);
    setShowSuggestions(false);
    setFarmerSuggestions([]);
    setCart([]);
    setParcelSize(null);
    await loadPatecAndPurchases(f);
    const balance = await fetchFarmerBalance(f.code);
    if (balance <= 0) {
      toast.warning(`${f.full_name} tem saldo de incentivo de ${balance.toLocaleString("pt-AO")} Kz. Compras bloqueadas.`);
      return;
    }
    if (!f.patec) {
      toast.error(`${f.full_name} não tem PATEC atribuído. Não é possível efectuar venda.`);
      return;
    }
    if (f.sim_status === "Pré desactivado") {
      toast.warning(`Atenção: cartão SIM em estado "Pré desactivado". Confirme antes de finalizar.`);
    }
    toast.success(`Produtor identificado: ${f.full_name} — Saldo: ${balance.toLocaleString("pt-AO")} Kz`);
    setParcelDialogOpen(true);
  };

  const searchFarmer = async () => {
    if (!farmerSearch.trim()) return;
    const query = farmerSearch.trim();
    setShowSuggestions(false);
    const { data } = await supabase
      .from("farmers")
      .select("code, full_name, phone, patec, photo_frontal_url, saldo_final, sim_status")
      .or(`code.eq.${query},phone.eq.${query},bi.eq.${query},full_name.ilike.%${query}%`)
      .limit(1)
      .single();
    
    if (data) {
      await selectFarmerFromSuggestion(data as Farmer);
    } else {
      toast.error("Produtor não encontrado. Verifique o código, BI, telefone ou nome e tente novamente.");
      setFarmer(null);
    }
  };

  /** Calcula a quantidade recomendada para um item PATEC consoante a parcela escolhida. */
  const computeRecommendedQty = (item: PatecItemFull, parcel: number): number => {
    if (!item.base_quantity || item.base_quantity <= 0) return 0;
    const factor = parcel / PARCEL_REFERENCE;
    return Math.max(1, Math.round(item.base_quantity * factor));
  };

  /** Encontra o produto do fornecedor que corresponde a um item do PATEC (match por nome). */
  const findProductForPatecItem = (item: PatecItemFull): Product | undefined => {
    return products.find(
      (p) =>
        p.patec_number === item.patec_number &&
        p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );
  };

  /** Pré-popula o carrinho com todos os itens do PATEC, nas quantidades calculadas. */
  const prefillCartFromPatec = (items: PatecItemFull[], parcel: number) => {
    const newCart: CartItem[] = [];
    let missingQty = 0;
    let missingProduct = 0;
    for (const item of items) {
      const product = findProductForPatecItem(item);
      if (!product) { missingProduct++; continue; }
      const qty = computeRecommendedQty(item, parcel);
      if (qty <= 0) { missingQty++; continue; }
      const stockCap = Math.max(0, product.stock);
      const finalQty = Math.min(qty, stockCap);
      if (finalQty <= 0) continue;
      newCart.push({ product, quantity: finalQty, recommendedQty: qty });
    }
    setCart(newCart);
    if (missingQty > 0) {
      toast.warning(`${missingQty} item(s) do PATEC sem quantidade base configurada. Contacte o administrador.`);
    }
    if (missingProduct > 0) {
      toast.info(`${missingProduct} item(s) do PATEC sem produto correspondente neste fornecedor.`);
    }
  };

  const handleSelectParcel = (size: number) => {
    setParcelSize(size);
    setParcelDialogOpen(false);
    if (patecItems.length > 0) {
      prefillCartFromPatec(patecItems, size);
    }
  };

  const getAvailableProducts = () => {
    if (!farmer) return [];
    return products.filter((p) => {
      // Filter by PATEC eligibility
      if (p.patec_number && farmer.patec && p.patec_number !== farmer.patec) return false;
      if (p.patec_number && !farmer.patec) return false;
      // Filter by search
      if (productSearch && !p.name.toLowerCase().includes(productSearch.toLowerCase())) return false;
      // Filter by stock
      if (p.stock <= 0) return false;
      return true;
    });
  };

  const getRemainingLimit = (product: Product) => {
    if (!product.max_per_farmer_per_season) return Infinity;
    const purchased = seasonPurchases[product.id] || 0;
    const inCart = cart.find((c) => c.product.id === product.id)?.quantity || 0;
    return product.max_per_farmer_per_season - purchased - inCart;
  };

  const notifyNoBalance = async (farmerName: string, farmerCode: string, balance: number) => {
    try {
      await supabase.rpc("notify_all_users", {
        _title: "Tentativa de Compra Sem Saldo",
        _body: `O produtor ${farmerName} (${farmerCode}) tentou comprar mas tem saldo de ${balance.toLocaleString("pt-AO")} Kz.`,
        _category: "incentivos",
        _entity_type: "farmer",
        _entity_id: farmerCode,
      });
    } catch (e) {
      console.warn("Failed to notify:", e);
    }
  };

  const addToCart = (product: Product) => {
    if (farmerBalance <= 0) {
      toast.error("Compra bloqueada — este produtor não tem saldo de incentivo disponível.");
      if (farmer) notifyNoBalance(farmer.full_name, farmer.code, farmerBalance);
      return;
    }
    if (!parcelSize) {
      toast.error("Seleccione primeiro o tamanho da parcela.");
      setParcelDialogOpen(true);
      return;
    }
    // Só produtos do PATEC do agricultor são permitidos
    const patecItem = patecItems.find(
      (i) => i.name.trim().toLowerCase() === product.name.trim().toLowerCase()
    );
    if (!patecItem) {
      toast.error(`"${product.name}" não pertence ao pacote tecnológico deste produtor.`);
      return;
    }
    const recommendedQty = computeRecommendedQty(patecItem, parcelSize);
    if (recommendedQty <= 0) {
      toast.error(`Item "${product.name}" sem quantidade base configurada. Contacte o administrador.`);
      return;
    }
    const currentCartTotal = cart.reduce((sum, c) => sum + c.product.price * c.quantity * (1 + c.product.iva_rate / 100), 0);
    const itemTotal = product.price * (1 + product.iva_rate / 100);
    if (currentCartTotal + itemTotal > farmerBalance) {
      toast.error(`Saldo insuficiente (${farmerBalance.toLocaleString("pt-AO")} Kz).`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= existing.recommendedQty) {
          toast.error(`Quantidade máxima atingida (${existing.recommendedQty} ${product.unit}) para esta parcela.`);
          return prev;
        }
        return prev.map((c) => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product, quantity: 1, recommendedQty }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((c) => {
        if (c.product.id !== productId) return c;
        const newQty = c.quantity + delta;
        if (newQty <= 0) return c;
        if (delta > 0) {
          if (newQty > c.recommendedQty) {
            toast.error(`Quantidade máxima atingida (${c.recommendedQty} ${c.product.unit}) para esta parcela.`);
            return c;
          }
          const currentCartTotal = prev.reduce((sum, item) => sum + item.product.price * item.quantity * (1 + item.product.iva_rate / 100), 0);
          const itemCost = c.product.price * (1 + c.product.iva_rate / 100);
          if (currentCartTotal + itemCost > farmerBalance) {
            toast.error("Saldo de incentivo insuficiente");
            return c;
          }
        }
        return { ...c, quantity: newQty };
      }).filter((c) => c.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);
  const cartIva = cart.reduce((sum, c) => sum + (c.product.price * c.quantity * c.product.iva_rate / 100), 0);
  const cartTotal = cartSubtotal + cartIva;

  const generateSaleCode = () => {
    const now = new Date();
    const prefix = "VND";
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    return `${prefix}-${date}-${rand}`;
  };

  const processSale = async () => {
    if (!farmer || cart.length === 0 || !selectedSupplierId) return;

    if (isSimBlocked(farmer.sim_status)) {
      const r = simStatusReason(farmer.sim_status);
      toast.error(`⛔ ${r?.title} — pagamento recusado`, {
        description: `${r?.reason} ${r?.recomendacao}`,
        duration: 8000,
      });
      notifySimBlockedFarmer(farmer, "tentativa_pagamento");
      return;
    }
    
    // Final balance check before processing
    if (farmerBalance <= 0) {
      toast.error("Compra bloqueada — produtor sem saldo de incentivo.");
      notifyNoBalance(farmer.full_name, farmer.code, farmerBalance);
      return;
    }
    if (cartTotal > farmerBalance) {
      toast.error(`Saldo insuficiente. Saldo: ${farmerBalance.toLocaleString("pt-AO")} Kz, Total: ${cartTotal.toLocaleString("pt-AO")} Kz.`);
      return;
    }
    
    setProcessing(true);
    setPaymentStatus("processing");

    const saleCode = generateSaleCode();
    const { data: { user } } = await supabase.auth.getUser();

    try {
      const { data: sale, error: saleError } = await withRetry(
        () => Promise.resolve(supabase.from("pos_sales").insert({
          sale_code: saleCode,
          supplier_id: selectedSupplierId,
          farmer_code: farmer.code,
          farmer_name: farmer.full_name,
          farmer_phone: farmer.phone,
          patec_number: farmer.patec,
          parcel_size: parcelSize,
          parcel_size_label: parcelSize ? PARCEL_OPTIONS.find((p) => p.value === parcelSize)?.label : null,
          subtotal: cartSubtotal,
          iva_total: cartIva,
          total: cartTotal,
          payment_method: kioskPayMethod || "unitel_money",
          payment_status: "pendente",
          created_by: user?.id,
        }).select().single()).then((res) => {
          if (res.error) throw res.error;
          return res;
        }),
        {
          maxAttempts: 2,
          baseDelay: 2000,
          onRetry: () => toast.info("Erro de rede — a tentar registar a venda novamente..."),
        },
      );

      if (!sale) {
        toast.error("Não foi possível registar a venda. Verifique a ligação à internet e tente novamente.");
        setProcessing(false);
        setPaymentStatus("idle");
        return;
      }

    // Insert items
    const items = cart.map((c) => ({
      sale_id: sale.id,
      product_id: c.product.id,
      product_name: c.product.name,
      quantity: c.quantity,
      unit_price: c.product.price,
      iva_rate: c.product.iva_rate,
      iva_amount: c.product.price * c.quantity * c.product.iva_rate / 100,
      line_total: c.product.price * c.quantity * (1 + c.product.iva_rate / 100),
    }));

    await supabase.from("pos_sale_items").insert(items);

    // Update stock
    for (const c of cart) {
      await supabase.from("supplier_products").update({ stock: c.product.stock - c.quantity }).eq("id", c.product.id);
    }

    setLastSaleCode(saleCode);
    setLastSaleId(sale.id);

    // Audit log (best-effort)
    try {
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        user_name: user?.email,
        action: "pos_sale_created",
        entity_type: "pos_sale",
        entity_id: sale.id,
        details: {
          sale_code: saleCode,
          supplier_id: selectedSupplierId,
          farmer_code: farmer.code,
          farmer_name: farmer.full_name,
          subtotal: cartSubtotal,
          iva_total: cartIva,
          total: cartTotal,
          items_count: cart.length,
          payment_method: kioskPayMethod || "unitel_money",
        },
      });
    } catch (e) {
      console.warn("Audit log failed:", e);
    }

    // Generate sequential invoice number
    let invoiceNumber = "";
    try {
      const currentYear = new Date().getFullYear();
      const { data: invNum } = await supabase.rpc("next_invoice_number", {
        _supplier_id: selectedSupplierId,
        _year: currentYear,
      });
      if (invNum) {
        invoiceNumber = invNum as string;
        await supabase.from("pos_sales").update({ invoice_number: invoiceNumber }).eq("id", sale.id);
      }
    } catch (e) {
      console.warn("Invoice numbering failed:", e);
    }

    // Build invoice data
    const supplierData = suppliers.find((s) => s.id === selectedSupplierId);
    const invoiceInfo: InvoiceData = {
      sale_code: saleCode,
      invoice_number: invoiceNumber || undefined,
      created_at: new Date().toISOString(),
      farmer_name: farmer.full_name,
      farmer_code: farmer.code,
      farmer_phone: farmer.phone,
      patec_number: farmer.patec,
      supplier_name: supplierData?.name,
      subtotal: cartSubtotal,
      iva_total: cartIva,
      total: cartTotal,
      payment_method: "unitel_money",
      payment_status: "pendente",
      items: cart.map((c) => ({
        product_name: c.product.name,
        quantity: c.quantity,
        unit_price: c.product.price,
        iva_rate: c.product.iva_rate,
        iva_amount: c.product.price * c.quantity * c.product.iva_rate / 100,
        line_total: c.product.price * c.quantity * (1 + c.product.iva_rate / 100),
      })),
    };
    setInvoiceData(invoiceInfo);
    const hash = await generateFiscalHash(invoiceInfo);
    setInvoiceHash(hash);
    setInvoiceQR(buildQRContent(invoiceInfo, hash));

    // Try Unitel Money payment
    if (farmer.phone) {
      try {
        const { data: payRes, error: payErr } = await supabase.functions.invoke("unitel-money-payment", {
          body: {
            action: "pay",
            sale_id: sale.id,
            sale_code: saleCode,
            amount: cartTotal,
            phone_number: farmer.phone,
          },
        });

        if (payErr || !payRes?.success) {
          console.warn("Unitel Money payment initiation failed:", payErr || payRes?.error);
          toast.warning("Venda registada. Pagamento Unitel Money não iniciado — verifique credenciais.");
          setPaymentStatus("idle");
        } else {
          toast.info("Pagamento Unitel Money iniciado. Aguardando confirmação...");
          setPaymentStatus("polling");
          // Start polling for payment status
          pollPaymentStatus(sale.id, payRes.conversation_id);
        }
      } catch (e) {
        console.warn("Unitel Money error:", e);
        toast.warning("Venda registada. Integração Unitel Money indisponível.");
        setPaymentStatus("idle");
      }
    } else {
      toast.warning("Produtor sem telefone — pagamento manual necessário.");
      setPaymentStatus("idle");
    }

    setProcessing(false);
    setConfirmOpen(false);
    setReceiptOpen(true);
    setCart([]);
    } catch (err) {
      const classified = classifyError(err);
      toast.error(classified.description + (classified.retryable ? " Tente novamente." : ""));
      setProcessing(false);
      setPaymentStatus("idle");
    }
  };

  const pollPaymentStatus = async (saleId: string, conversationId: string) => {
    let attempts = 0;
    const maxAttempts = 12; // ~60 seconds (5s intervals)

    const poll = async () => {
      attempts++;
      try {
        const { data, error } = await supabase.functions.invoke("unitel-money-payment", {
          body: { action: "query", sale_id: saleId, conversation_id: conversationId },
        });

        if (!error && data?.payment_status === "pago") {
          setPaymentStatus("paid");
          toast.success("Pagamento confirmado via Unitel Money!");
          return;
        }
        if (!error && data?.payment_status === "falhado") {
          setPaymentStatus("failed");
          toast.error("Pagamento Unitel Money falhou: " + (data.result_description || ""));
          return;
        }
      } catch (e) {
        console.warn("Poll error:", e);
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      } else {
        setPaymentStatus("idle");
        toast.info("Tempo de espera do pagamento esgotado. Verifique o estado manualmente.");
      }
    };

    setTimeout(poll, 5000);
  };

  // Get unique categories for kiosk filter
  const productCategories = ["Todos", ...Array.from(new Set(products.map(p => p.category)))];

  const getKioskProducts = () => {
    let filtered = farmer ? getAvailableProducts() : products.filter(p => p.stock > 0);
    if (kioskCategory !== "Todos") filtered = filtered.filter(p => p.category === kioskCategory);
    if (productSearch) filtered = filtered.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    return filtered;
  };

  // ─── KIOSK MODE ───
  if (kioskMode) {
    return (
      <div ref={posContainerRef} className="fixed inset-0 z-50 flex bg-[hsl(220,20%,10%)] text-[hsl(0,0%,90%)]">
        {/* LEFT — Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(220,15%,18%)]">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[hsl(45,90%,50%)] flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-[hsl(220,20%,10%)]" />
              </div>
              <span className="font-heading font-bold text-sm">MOSAP3 POS</span>
            </div>
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,40%)]" />
                <input
                  ref={productSearchRef}
                  type="text"
                  placeholder="Pesquisar produtos..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[hsl(220,15%,15%)] border border-[hsl(220,15%,20%)] text-sm text-[hsl(0,0%,85%)] placeholder:text-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(45,90%,50%)]"
                />
              </div>
            </div>
            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {productCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setKioskCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    kioskCategory === cat
                      ? "bg-[hsl(45,90%,50%)] text-[hsl(220,20%,10%)]"
                      : "bg-[hsl(220,15%,18%)] text-[hsl(220,10%,55%)] hover:bg-[hsl(220,15%,22%)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => toggleFullscreen(false)} className="p-2 rounded-lg bg-[hsl(220,15%,15%)] hover:bg-[hsl(220,15%,20%)] transition-colors" title="Sair Kiosk (F5)">
                <Minimize className="h-4 w-4" />
              </button>
              <button className="p-2 rounded-lg bg-[hsl(220,15%,15%)] hover:bg-[hsl(220,15%,20%)] transition-colors" title="Atalhos: F1-F5">
                <Settings2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Supplier selector (if none selected) */}
          {!selectedSupplierId && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-4">
                <Monitor className="h-12 w-12 mx-auto text-[hsl(220,10%,30%)]" />
                <p className="text-[hsl(220,10%,50%)]">Seleccione um fornecedor para começar</p>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="w-64 mx-auto bg-[hsl(220,15%,15%)] border-[hsl(220,15%,25%)] text-[hsl(0,0%,85%)]">
                    <SelectValue placeholder="Fornecedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Product grid */}
          {selectedSupplierId && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {getKioskProducts().map((p) => {
                  const remaining = farmer ? getRemainingLimit(p) : Infinity;
                  const inCart = cart.find((c) => c.product.id === p.id);
                  return (
                    <button
                      key={p.id}
                      disabled={farmer ? remaining <= 0 : false}
                      onClick={() => farmer ? (remaining > 0 && addToCart(p)) : toast.info("Identifique o cliente primeiro")}
                      className={`relative flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                        inCart
                          ? "border-[hsl(45,90%,50%)] bg-[hsl(220,15%,15%)]"
                          : "border-[hsl(220,15%,20%)] bg-[hsl(220,15%,13%)] hover:border-[hsl(220,15%,30%)] hover:bg-[hsl(220,15%,16%)]"
                      } ${remaining <= 0 && farmer ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <div className="h-16 w-full flex items-center justify-center mb-2 rounded-lg bg-[hsl(220,15%,18%)]">
                        <ShoppingCart className="h-8 w-8 text-[hsl(220,10%,35%)]" />
                      </div>
                      <p className="text-xs font-medium leading-tight line-clamp-2">{p.name}</p>
                      <p className="text-sm font-bold text-[hsl(45,90%,55%)] mt-1 font-mono">
                        {Number(p.price).toLocaleString("pt-AO")} Kz
                      </p>
                      {inCart && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[hsl(45,90%,50%)] text-[hsl(220,20%,10%)] flex items-center justify-center text-[10px] font-bold">
                          {inCart.quantity}
                        </div>
                      )}
                    </button>
                  );
                })}
                {getKioskProducts().length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-16 text-[hsl(220,10%,35%)]">
                    <Package className="h-10 w-10 mb-2" />
                    <p className="text-sm">Nenhum produto encontrado</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Cart */}
        <div className="w-80 lg:w-96 flex flex-col border-l border-[hsl(220,15%,18%)] bg-[hsl(220,18%,12%)]">
          {/* Cart header */}
          <div className="px-4 py-3 border-b border-[hsl(220,15%,18%)]">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[hsl(45,90%,50%)]" />
              <span className="font-heading font-bold text-sm">Carrinho</span>
              {cart.length > 0 && (
                <span className="ml-auto text-xs text-[hsl(220,10%,50%)]">{cart.length} item(s)</span>
              )}
            </div>
          </div>

          {/* Client button */}
          <div className="px-4 py-2 border-b border-[hsl(220,15%,18%)]">
            {farmer ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(220,15%,15%)]">
                <div className="h-8 w-8 rounded-full bg-[hsl(45,90%,50%)]/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-[hsl(45,90%,55%)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{farmer.full_name}</p>
                  <p className="text-[10px] text-[hsl(220,10%,45%)]">{farmer.code}</p>
                  <p className={`text-[10px] font-semibold ${farmerBalance > 0 ? "text-[hsl(120,60%,50%)]" : "text-[hsl(0,70%,60%)]"}`}>
                    Saldo: {farmerBalance.toLocaleString("pt-AO")} Kz
                  </p>
                  {parcelSize && (
                    <button onClick={() => setParcelDialogOpen(true)} className="text-[9px] text-[hsl(45,90%,55%)] hover:underline mt-0.5">
                      🌾 {PARCEL_OPTIONS.find((p) => p.value === parcelSize)?.label} · alterar
                    </button>
                  )}
                </div>
                <button onClick={() => { setFarmer(null); setFarmerSearch(""); setCart([]); setParcelSize(null); setPatecItems([]); }} className="text-[hsl(220,10%,40%)] hover:text-[hsl(0,70%,60%)]">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    ref={farmerSearchRef}
                    type="text"
                    placeholder="Nome / código / telefone / BI..."
                    value={farmerSearch}
                    onChange={(e) => setFarmerSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchFarmer()}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => farmerSuggestions.length > 0 && setShowSuggestions(true)}
                    className="flex-1 px-3 py-2 rounded-lg bg-[hsl(220,15%,15%)] border border-[hsl(220,15%,22%)] text-xs text-[hsl(0,0%,85%)] placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-[hsl(45,90%,50%)]"
                  />
                  <button onClick={searchFarmer} className="px-3 rounded-lg bg-[hsl(220,15%,18%)] border border-[hsl(220,15%,22%)] hover:bg-[hsl(220,15%,22%)] transition-colors">
                    <Users className="h-4 w-4" />
                  </button>
                </div>
                {showSuggestions && farmerSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,22%)] rounded-lg shadow-lg max-h-72 overflow-y-auto">
                    {farmerSuggestions.map((s) => (
                      <button key={s.code} onClick={() => selectFarmerFromSuggestion(s)} className="w-full text-left px-3 py-2 hover:bg-[hsl(220,15%,18%)] flex items-center gap-2 text-xs border-b border-[hsl(220,15%,18%)] last:border-0">
                        <User className="h-3 w-3 text-[hsl(220,10%,45%)] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-[hsl(0,0%,85%)]">{s.full_name}</p>
                          <p className="text-[10px] text-[hsl(220,10%,45%)]">{s.code} • {s.phone || "—"}</p>
                        </div>
                      </button>
                    ))}
                    {farmerTotalCount !== null && (
                      <div className="sticky bottom-0 bg-[hsl(220,15%,10%)] border-t border-[hsl(220,15%,22%)]">
                        <div className="px-3 py-1.5 text-[10px] text-[hsl(220,10%,60%)] text-center">
                          {farmerSuggestions.length} de <strong className="text-[hsl(0,0%,80%)]">{farmerTotalCount}</strong> resultado{farmerTotalCount === 1 ? "" : "s"}
                          {farmerHasMore && farmerTotalCount > FARMER_PAGE_SIZE && (
                            <span className="text-[hsl(45,90%,55%)]"> · refine para precisão</span>
                          )}
                        </div>
                        {farmerHasMore && (
                          <button
                            onMouseDown={(e) => { e.preventDefault(); loadMoreFarmerSuggestions(); }}
                            disabled={farmerLoadingMore}
                            className="w-full px-3 py-2 text-[10px] text-[hsl(45,90%,55%)] text-center border-t border-[hsl(220,15%,22%)] hover:bg-[hsl(220,15%,14%)] disabled:opacity-50"
                          >
                            {farmerLoadingMore ? "A carregar…" : `Carregar mais ${Math.min(FARMER_PAGE_SIZE, farmerTotalCount - farmerSuggestions.length)}`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[hsl(220,10%,30%)]">
                <ShoppingCart className="h-12 w-12 mb-3" />
                <p className="font-medium text-sm">Carrinho vazio</p>
                <p className="text-xs text-[hsl(220,10%,25%)]">Toque nos produtos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((c) => (
                  <div key={c.product.id} className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(220,15%,15%)]">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.product.name}</p>
                      <p className="text-[10px] text-[hsl(220,10%,45%)]">
                        {Number(c.product.price).toLocaleString("pt-AO")} Kz × {c.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(c.product.id, -1)} className="h-6 w-6 rounded bg-[hsl(220,15%,20%)] flex items-center justify-center hover:bg-[hsl(220,15%,25%)]">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center">{c.quantity}</span>
                      <button onClick={() => updateQuantity(c.product.id, 1)} className="h-6 w-6 rounded bg-[hsl(220,15%,20%)] flex items-center justify-center hover:bg-[hsl(220,15%,25%)]">
                        <Plus className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeFromCart(c.product.id)} className="h-6 w-6 rounded flex items-center justify-center text-[hsl(0,60%,55%)] hover:bg-[hsl(0,50%,20%)]">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom: totals + payment */}
          <div className="border-t border-[hsl(220,15%,18%)] px-4 py-3 space-y-2">
            <div className="flex justify-between text-xs text-[hsl(220,10%,55%)]">
              <span>Subtotal</span>
              <span className="font-mono">{cartSubtotal.toLocaleString("pt-AO")} Kz</span>
            </div>
            <div className="flex justify-between text-xs text-[hsl(220,10%,45%)]">
              <span>IVA (14%)</span>
              <span className="font-mono">{cartIva.toLocaleString("pt-AO")} Kz</span>
            </div>
            <div className="flex justify-between items-center font-bold">
              <span>Total</span>
              <span className="text-lg font-mono text-[hsl(45,90%,55%)]">{cartTotal.toLocaleString("pt-AO")} Kz</span>
            </div>
            {farmer && (
              <div className={`flex justify-between items-center text-xs mt-1 ${farmerBalance - cartTotal >= 0 ? "text-[hsl(120,60%,50%)]" : "text-[hsl(0,70%,60%)]"}`}>
                <span>Saldo restante</span>
                <span className="font-mono font-semibold">{(farmerBalance - cartTotal).toLocaleString("pt-AO")} Kz</span>
              </div>
            )}
            {/* Doc type */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setKioskDocType("factura")}
                className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                  kioskDocType === "factura"
                    ? "bg-[hsl(220,15%,25%)] text-[hsl(0,0%,90%)] border border-[hsl(220,10%,40%)]"
                    : "bg-[hsl(220,15%,15%)] text-[hsl(220,10%,45%)] border border-[hsl(220,15%,20%)]"
                }`}
              >
                Factura
              </button>
              <button
                onClick={() => setKioskDocType("frecibo")}
                className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                  kioskDocType === "frecibo"
                    ? "bg-[hsl(45,80%,45%)] text-[hsl(220,20%,10%)] border border-[hsl(45,80%,50%)]"
                    : "bg-[hsl(220,15%,15%)] text-[hsl(220,10%,45%)] border border-[hsl(220,15%,20%)]"
                }`}
              >
                F-Recibo
              </button>
            </div>

            {/* Payment methods */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { key: "numerario", icon: Banknote, label: "Numerário" },
                { key: "cartao", icon: CreditCard, label: "Cartão" },
                { key: "transferencia", icon: ArrowRightLeft, label: "Transf." },
                { key: "unitel_money", icon: Smartphone, label: "Mobile" },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setKioskPayMethod(m.key)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                    kioskPayMethod === m.key
                      ? "bg-[hsl(200,60%,35%)] text-[hsl(0,0%,95%)] border border-[hsl(200,60%,45%)]"
                      : "bg-[hsl(220,15%,15%)] text-[hsl(220,10%,50%)] border border-[hsl(220,15%,20%)] hover:bg-[hsl(220,15%,18%)]"
                  }`}
                >
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </button>
              ))}
            </div>

            {/* Submit */}
            <button
              disabled={cart.length === 0 || !farmer || processing || farmerBalance <= 0 || cartTotal > farmerBalance || isSimBlocked(farmer?.sim_status)}
              onClick={() => setConfirmOpen(true)}
              className="w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[hsl(45,70%,40%)] text-[hsl(220,20%,10%)] hover:bg-[hsl(45,75%,45%)]"
            >
              <CreditCard className="h-4 w-4" />
              Emitir {kioskDocType === "factura" ? "FT" : "FR"}
            </button>
          </div>
        </div>

        {/* Kiosk dialogs reuse normal dialogs */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="bg-[hsl(220,18%,14%)] border-[hsl(220,15%,22%)] text-[hsl(0,0%,88%)]">
            <DialogHeader><DialogTitle>Confirmar Venda</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="p-3 bg-[hsl(220,15%,12%)] rounded-lg">
                <p className="font-medium">{farmer?.full_name}</p>
                <p className="text-xs text-[hsl(220,10%,45%)]">{farmer?.code} • {farmer?.patec ? patecLabels[farmer.patec] : "Sem PATEC"}</p>
              </div>
              <div className="space-y-1">
                {cart.map((c) => (
                  <div key={c.product.id} className="flex justify-between text-sm">
                    <span>{c.product.name} × {c.quantity}</span>
                    <span className="font-mono">{(c.product.price * c.quantity).toLocaleString("pt-AO")} Kz</span>
                  </div>
                ))}
              </div>
              <Separator className="bg-[hsl(220,15%,22%)]" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-[hsl(45,90%,55%)] font-mono">{cartTotal.toLocaleString("pt-AO")} Kz</span>
              </div>
              <div className={`flex justify-between text-xs mt-1 ${farmerBalance - cartTotal >= 0 ? "text-[hsl(120,60%,50%)]" : "text-[hsl(0,70%,60%)]"}`}>
                <span>Saldo restante</span>
                <span className="font-mono font-semibold">{(farmerBalance - cartTotal).toLocaleString("pt-AO")} Kz</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={processSale} disabled={processing} className="bg-[hsl(45,70%,40%)] text-[hsl(220,20%,10%)] hover:bg-[hsl(45,75%,45%)]">
                {processing ? "Processando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogContent className="bg-[hsl(220,18%,14%)] border-[hsl(220,15%,22%)] text-[hsl(0,0%,88%)]">
            <div className="text-center space-y-3">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto ${paymentStatus === "paid" ? "bg-[hsl(140,60%,20%)]" : paymentStatus === "failed" ? "bg-[hsl(0,60%,20%)]" : "bg-[hsl(220,15%,18%)]"}`}>
                {paymentStatus === "polling" ? (
                  <div className="h-8 w-8 border-4 border-[hsl(45,90%,50%)] border-t-transparent rounded-full animate-spin" />
                ) : paymentStatus === "paid" ? (
                  <Check className="h-8 w-8 text-[hsl(140,60%,60%)]" />
                ) : paymentStatus === "failed" ? (
                  <AlertTriangle className="h-8 w-8 text-[hsl(0,70%,60%)]" />
                ) : (
                  <Check className="h-8 w-8 text-[hsl(45,90%,55%)]" />
                )}
              </div>
              <h2 className="text-lg font-bold">
                {paymentStatus === "polling" ? "Aguardando..." : paymentStatus === "paid" ? "Pago!" : paymentStatus === "failed" ? "Falhou" : "Registada!"}
              </h2>
              <p className="text-sm text-[hsl(220,10%,50%)]">Código: <span className="font-mono font-bold text-[hsl(0,0%,85%)]">{lastSaleCode}</span></p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowInvoice(true)} disabled={!invoiceData}>
                  <Printer className="h-4 w-4 mr-1" /> Ver Factura
                </Button>
                <Button onClick={() => { setReceiptOpen(false); setFarmer(null); setFarmerSearch(""); setPaymentStatus("idle"); setInvoiceData(null); setParcelSize(null); setPatecItems([]); }} className="flex-1 bg-[hsl(45,70%,40%)] text-[hsl(220,20%,10%)] hover:bg-[hsl(45,75%,45%)]">
                  Nova Venda
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Parcel selection (kiosk) */}
        <Dialog open={parcelDialogOpen} onOpenChange={(o) => { if (!o && parcelSize === null) return; setParcelDialogOpen(o); }}>
          <DialogContent className="bg-[hsl(220,18%,14%)] border-[hsl(220,15%,22%)] text-[hsl(0,0%,88%)]">
            <DialogHeader><DialogTitle>Tamanho da parcela</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-[hsl(220,10%,55%)]">
                Seleccione a parcela de terra para calcular as quantidades do {farmer?.patec ? patecLabels[farmer.patec] : "PATEC"}.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {PARCEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelectParcel(opt.value)}
                    className={`p-6 rounded-xl border-2 transition-all font-bold text-lg ${
                      parcelSize === opt.value
                        ? "bg-[hsl(45,90%,50%)] text-[hsl(220,20%,10%)] border-[hsl(45,90%,55%)]"
                        : "bg-[hsl(220,15%,15%)] border-[hsl(220,15%,22%)] hover:border-[hsl(45,90%,40%)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Factura / Recibo</DialogTitle></DialogHeader>
            {invoiceData && <InvoicePDF data={invoiceData} hash={invoiceHash} qrContent={invoiceQR} />}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── NORMAL MODE ───
  return (
    <div ref={posContainerRef} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-heading font-bold">Terminal POS — MOSAP3Pay</h1>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => toggleFullscreen()} title="F5 — Modo Kiosk">
            <Maximize className="h-4 w-4" /> Modo Kiosk (F5)
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" title="Atalhos de teclado">
            <Keyboard className="h-4 w-4" />
            <span className="hidden md:inline">F1-F5 • Enter • Esc</span>
          </Button>
        </div>
      </div>

      {/* Supplier selection */}
      <div className="flex gap-3 flex-wrap">
        <div className="w-64">
          <Label className="text-xs">Fornecedor</Label>
          <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
            <SelectTrigger><SelectValue placeholder="Seleccionar fornecedor..." /></SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedSupplierId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Seleccione um fornecedor para começar</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Farmer ID + Products */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Identificar Produtor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="flex gap-2">
                    <Input ref={farmerSearchRef} placeholder="Nome, código, telefone ou BI do produtor..." value={farmerSearch} onChange={(e) => setFarmerSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchFarmer()} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} onFocus={() => farmerSuggestions.length > 0 && setShowSuggestions(true)} className="flex-1" />
                    <Button onClick={searchFarmer}><Search className="h-4 w-4 mr-1" /> Pesquisar</Button>
                  </div>
                  {showSuggestions && farmerSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                      {farmerSuggestions.map((s) => (
                        <button key={s.code} onClick={() => selectFarmerFromSuggestion(s)} className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm border-b border-border last:border-0">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{s.full_name}</p>
                            <p className="text-xs text-muted-foreground">{s.code} • {s.phone || "—"}</p>
                          </div>
                          {s.patec ? <Badge variant="secondary" className="text-[10px]">{patecLabels[s.patec]}</Badge> : null}
                        </button>
                      ))}
                      {farmerTotalCount !== null && (
                        <div className="sticky bottom-0 bg-muted/50 border-t border-border">
                          <div className="px-3 py-1.5 text-[11px] text-muted-foreground text-center">
                            {farmerSuggestions.length} de <strong className="text-foreground">{farmerTotalCount}</strong> resultado{farmerTotalCount === 1 ? "" : "s"}
                            {farmerHasMore && farmerTotalCount > FARMER_PAGE_SIZE && (
                              <span className="text-primary"> · refine para precisão</span>
                            )}
                          </div>
                          {farmerHasMore && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); loadMoreFarmerSuggestions(); }}
                              disabled={farmerLoadingMore}
                              className="w-full px-3 py-2 text-[11px] text-primary text-center border-t border-border hover:bg-muted disabled:opacity-50"
                            >
                              {farmerLoadingMore ? "A carregar…" : `Carregar mais ${Math.min(FARMER_PAGE_SIZE, farmerTotalCount - farmerSuggestions.length)}`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {farmer && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-6 w-6 text-primary" /></div>
                    <div className="flex-1">
                      <p className="font-semibold">{farmer.full_name}</p>
                      <p className="text-xs text-muted-foreground">Código: {farmer.code} • Tel: {farmer.phone || "—"}</p>
                      {parcelSize && (
                        <button
                          onClick={() => setParcelDialogOpen(true)}
                          className="text-[11px] text-primary hover:underline mt-1 inline-flex items-center gap-1"
                          title="Alterar tamanho da parcela"
                        >
                          🌾 Parcela: <strong>{PARCEL_OPTIONS.find((p) => p.value === parcelSize)?.label}</strong> · Alterar
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      {farmer.patec ? <Badge className="text-xs">{patecLabels[farmer.patec]}</Badge> : <Badge variant="destructive" className="text-xs">Sem PATEC</Badge>}
                      <p className={`text-xs font-semibold mt-1 ${farmerBalance > 0 ? "text-primary" : "text-destructive"}`}>
                        Saldo: {farmerBalance.toLocaleString("pt-AO")} Kz
                      </p>
                      {farmerBalance <= 0 && (
                        <p className="text-[10px] text-destructive font-medium">⚠ Sem saldo — compras bloqueadas</p>
                      )}
                    </div>
                  </div>
                )}
                {farmer && (isSimBlocked(farmer.sim_status) || farmer.sim_status === "Pré desactivado") && (() => {
                  const r = simStatusReason(farmer.sim_status);
                  if (!r) return null;
                  const blocked = isSimBlocked(farmer.sim_status);
                  return (
                    <Alert variant={blocked ? "destructive" : "default"} className={`mt-3 ${blocked ? "" : "border-warning bg-warning/10 text-warning-foreground"}`}>
                      {blocked ? <Ban className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4 text-warning" />}
                      <AlertTitle className="font-bold">
                        {blocked ? "⛔ Venda recusada — " : "⚠ Atenção — "}{r.title}
                      </AlertTitle>
                      <AlertDescription className="text-xs space-y-1 mt-1">
                        <p><strong>Estado do SIM:</strong> {farmer.sim_status}</p>
                        <p><strong>Motivo:</strong> {r.reason}</p>
                        <p><strong>Recomendação:</strong> {r.recomendacao}</p>
                        {blocked && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs gap-1.5 bg-background hover:bg-background/80"
                            onClick={() => { setManagerRoleFilter("__all__"); loadManagers(); setContactConfirmOpen(true); }}
                            disabled={contactingManager}
                          >
                            <Send className="h-3 w-3" />
                            {contactingManager ? "A enviar…" : "Contactar gestor"}
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  );
                })()}
              </CardContent>
            </Card>

            {farmer && patecItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Itens do {farmer.patec ? patecLabels[farmer.patec] : "PATEC"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {["Insumos", "Pecuária", "Serviços"].map((cat) => {
                      const items = patecItems.filter((i) => i.category === cat);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">{cat}</p>
                          {items.map((item) => {
                            const hasProduct = products.some(p =>
                              p.patec_number === farmer!.patec &&
                              p.name.toLowerCase() === item.name.toLowerCase() &&
                              p.stock > 0
                            );
                            const hasProductNoStock = !hasProduct && products.some(p =>
                              p.patec_number === farmer!.patec &&
                              p.name.toLowerCase() === item.name.toLowerCase()
                            );
                            return (
                              <div key={item.id} className="flex items-center gap-1.5 text-xs">
                                {hasProduct ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : hasProductNoStock ? (
                                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-muted-foreground/40" />
                                )}
                                <span className={!hasProduct && !hasProductNoStock ? "text-muted-foreground" : ""}>{item.name}</span>
                                {hasProductNoStock && <span className="text-[9px] text-amber-600 ml-auto">Sem stock</span>}
                                {!hasProduct && !hasProductNoStock && <span className="text-[9px] text-muted-foreground ml-auto">Indisponível</span>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {farmer && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" /> Produtos Elegíveis
                    {farmer.patec && <Badge variant="outline" className="text-[10px]">Filtrado por {patecLabels[farmer.patec]}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input ref={productSearchRef} placeholder="Pesquisar produto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="mb-3" />
                  {!farmer.patec ? (
                    <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <p className="text-sm text-destructive font-medium">Este produtor não tem PATEC atribuído.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {getAvailableProducts().map((p) => {
                        const remaining = getRemainingLimit(p);
                        const inCart = cart.find((c) => c.product.id === p.id);
                        return (
                          <div key={p.id} className={`p-3 rounded-lg border cursor-pointer transition-colors ${inCart ? "border-primary bg-primary/5" : "hover:border-primary/50"} ${remaining <= 0 ? "opacity-50 cursor-not-allowed" : ""}`} onClick={() => remaining > 0 && addToCart(p)}>
                            <p className="font-medium text-sm truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{Number(p.price).toLocaleString("pt-AO")} Kz/{p.unit}</p>
                            <div className="flex items-center justify-between mt-1">
                              <Badge variant="outline" className="text-[9px]">{p.category}</Badge>
                              {p.max_per_farmer_per_season && <span className={`text-[10px] font-medium ${remaining <= 0 ? "text-destructive" : "text-muted-foreground"}`}>Resta: {Math.max(0, remaining)}</span>}
                            </div>
                            {inCart && <div className="mt-1 text-[10px] text-primary font-bold">No carrinho: {inCart.quantity}</div>}
                          </div>
                        );
                      })}
                      {getAvailableProducts().length === 0 && <p className="col-span-full text-center text-muted-foreground py-4 text-sm">Nenhum produto disponível</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Cart */}
          <div className="space-y-4">
            <Card className="sticky top-20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Carrinho
                  {cart.length > 0 && <Badge className="text-[10px]">{cart.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Carrinho vazio</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((c) => (
                      <div key={c.product.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{c.product.name}</p>
                          <p className="text-[10px] text-muted-foreground">{Number(c.product.price).toLocaleString("pt-AO")} Kz × {c.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(c.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                          <span className="text-xs font-bold w-6 text-center">{c.quantity}</span>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(c.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeFromCart(c.product.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                    <Separator className="my-2" />
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Subtotal</span><span>{cartSubtotal.toLocaleString("pt-AO")} Kz</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>{cartIva.toLocaleString("pt-AO")} Kz</span></div>
                      <Separator />
                      <div className="flex justify-between font-bold text-base"><span>Total</span><span>{cartTotal.toLocaleString("pt-AO")} Kz</span></div>
                      {farmer && (
                        <div className={`flex justify-between text-xs mt-1 ${farmerBalance - cartTotal >= 0 ? "text-primary" : "text-destructive"}`}>
                          <span>Saldo restante</span>
                          <span className="font-mono font-semibold">{(farmerBalance - cartTotal).toLocaleString("pt-AO")} Kz</span>
                        </div>
                      )}
                    </div>
                    <Button className="w-full mt-3" onClick={() => setConfirmOpen(true)} disabled={!farmer || cart.length === 0 || farmerBalance <= 0 || cartTotal > farmerBalance || isSimBlocked(farmer?.sim_status)}>
                      <CreditCard className="h-4 w-4 mr-2" /> Processar Pagamento
                    </Button>
                    {farmer && isSimBlocked(farmer.sim_status) && (
                      <Alert variant="destructive" className="mt-2">
                        <Ban className="h-4 w-4" />
                        <AlertTitle className="text-xs font-bold">⛔ Pagamento recusado — SIM {farmer.sim_status}</AlertTitle>
                        <AlertDescription className="text-[11px]">
                          {simStatusReason(farmer.sim_status)?.recomendacao}
                        </AlertDescription>
                      </Alert>
                    )}
                    {farmer && farmerBalance <= 0 && (
                      <p className="text-xs text-destructive text-center mt-2 font-medium">⚠ Produtor sem saldo de incentivo</p>
                    )}
                    {farmer && farmerBalance > 0 && cartTotal > farmerBalance && (
                      <p className="text-xs text-destructive text-center mt-2 font-medium">⚠ Saldo insuficiente ({farmerBalance.toLocaleString("pt-AO")} Kz)</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Venda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="font-medium">{farmer?.full_name}</p>
              <p className="text-xs text-muted-foreground">{farmer?.code} • {farmer?.patec ? patecLabels[farmer.patec] : "Sem PATEC"}</p>
            </div>
            <div className="space-y-1">
              {cart.map((c) => (
                <div key={c.product.id} className="flex justify-between text-sm">
                  <span>{c.product.name} × {c.quantity}</span>
                  <span>{(c.product.price * c.quantity).toLocaleString("pt-AO")} Kz</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{cartTotal.toLocaleString("pt-AO")} Kz</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={processSale} disabled={processing}>{processing ? "Processando..." : "Confirmar e Pagar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          <div className="text-center space-y-3">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto ${paymentStatus === "paid" ? "bg-primary/10" : paymentStatus === "failed" ? "bg-destructive/10" : "bg-muted"}`}>
              {paymentStatus === "polling" ? (
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              ) : paymentStatus === "paid" ? (
                <Check className="h-8 w-8 text-primary" />
              ) : paymentStatus === "failed" ? (
                <AlertTriangle className="h-8 w-8 text-destructive" />
              ) : (
                <Check className="h-8 w-8 text-primary" />
              )}
            </div>
            <h2 className="text-lg font-bold">
              {paymentStatus === "polling" ? "Aguardando Pagamento..." : paymentStatus === "paid" ? "Pagamento Confirmado!" : paymentStatus === "failed" ? "Pagamento Falhou" : "Venda Registada!"}
            </h2>
            <p className="text-sm text-muted-foreground">Código: <span className="font-mono font-bold">{lastSaleCode}</span></p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowInvoice(true)} disabled={!invoiceData}><Printer className="h-4 w-4 mr-1" /> Ver Factura</Button>
              <Button onClick={() => { setReceiptOpen(false); setFarmer(null); setFarmerSearch(""); setPaymentStatus("idle"); setInvoiceData(null); setParcelSize(null); setPatecItems([]); }} className="flex-1">Nova Venda</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Factura / Recibo</DialogTitle></DialogHeader>
          {invoiceData && <InvoicePDF data={invoiceData} hash={invoiceHash} qrContent={invoiceQR} />}
        </DialogContent>
      </Dialog>

      {/* Parcel selection (normal) */}
      <Dialog open={parcelDialogOpen} onOpenChange={(o) => { if (!o && parcelSize === null) return; setParcelDialogOpen(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tamanho da parcela de terra</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Seleccione a parcela a produzir. As quantidades dos produtos do {farmer?.patec ? patecLabels[farmer.patec] : "PATEC"} serão calculadas automaticamente.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {PARCEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelectParcel(opt.value)}
                  className={`p-6 rounded-xl border-2 transition-all font-bold text-lg ${
                    parcelSize === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {cart.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Alterar a parcela vai recalcular as quantidades do carrinho.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={contactConfirmOpen} onOpenChange={setContactConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" /> Contactar gestor
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Esta ocorrência será enviada via sino in-app aos gestores selecionados. Confirma o envio?</p>
                {farmer && (() => {
                  const r = simStatusReason(farmer.sim_status);
                  return (
                    <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-xs">
                      <p><strong>Agricultor:</strong> {farmer.full_name}</p>
                      <p><strong>Código:</strong> {farmer.code}</p>
                      {farmer.phone && <p><strong>Telefone:</strong> {farmer.phone}</p>}
                      <p><strong>Estado do SIM:</strong> {farmer.sim_status}</p>
                      {r && <p><strong>Motivo:</strong> {r.reason}</p>}
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-semibold">Destinatários</Label>
                    <Select value={managerRoleFilter} onValueChange={setManagerRoleFilter} disabled={managersLoading || managers.length === 0}>
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue placeholder="Todas as funções" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas as funções</SelectItem>
                        {availableManagerRoles.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-md border bg-background max-h-44 overflow-auto">
                    {managersLoading ? (
                      <p className="p-3 text-xs text-muted-foreground">A carregar gestores…</p>
                    ) : filteredManagers.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">Sem gestores para esta função.</p>
                    ) : (
                      <ul className="divide-y">
                        {filteredManagers.map((m) => (
                          <li key={`${m.user_id}-${m.role}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                            <span className="truncate">{m.full_name || "(sem nome)"}</span>
                            <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {filteredManagers.length} destinatário(s) {managerRoleFilter !== "__all__" ? `com função "${managerRoleFilter}"` : "no total"}.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={contactingManager}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={contactingManager || !farmer || filteredManagers.length === 0}
              onClick={async (e) => {
                e.preventDefault();
                if (!farmer) return;
                await contactarGestor(farmer);
                setContactConfirmOpen(false);
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              {contactingManager ? "A enviar…" : `Enviar a ${filteredManagers.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Mosap3PayPOS;
