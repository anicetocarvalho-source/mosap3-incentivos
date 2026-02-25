import { useState, useEffect, useCallback, useRef } from "react";
import { Monitor, Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, User, Package, AlertTriangle, Check, Printer, Maximize, Minimize, Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InvoicePDF, generateFiscalHash, buildQRContent, type InvoiceData } from "@/components/InvoicePDF";

interface Farmer {
  code: string;
  full_name: string;
  phone: string | null;
  patec: number | null;
  photo_frontal_url: string | null;
  saldo_final: string | null;
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

interface CartItem {
  product: Product;
  quantity: number;
}

interface Supplier {
  id: string;
  name: string;
}

const patecLabels: Record<number, string> = {
  1: "PATEC 1 — Milho",
  2: "PATEC 2 — Massango",
  3: "PATEC 3 — Massambala",
};

const Mosap3PayPOS = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [farmerSearch, setFarmerSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [processing, setProcessing] = useState(false);
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
  const farmerSearchRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  // Purchased quantities this season (per farmer)
  const [seasonPurchases, setSeasonPurchases] = useState<Record<string, number>>({});
  const [patecItems, setPatecItems] = useState<{ id: string; name: string; category: string; patec_number: number }[]>([]);

  // Kiosk keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      switch (e.key) {
        case "F1": e.preventDefault(); farmerSearchRef.current?.focus(); break;
        case "F2": e.preventDefault(); productSearchRef.current?.focus(); break;
        case "F3": e.preventDefault(); if (cart.length > 0 && farmer) setConfirmOpen(true); break;
        case "F5": e.preventDefault(); setKioskMode(k => !k); break;
        case "Escape": e.preventDefault(); if (kioskMode) setKioskMode(false); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, farmer, kioskMode]);

  useEffect(() => {
    supabase.from("suppliers").select("id, name").eq("status", "Ativo").order("name")
      .then(({ data }) => setSuppliers((data as Supplier[]) || []));
  }, []);

  useEffect(() => {
    if (selectedSupplierId) {
      supabase.from("supplier_products").select("*").eq("supplier_id", selectedSupplierId).eq("status", "Ativo").order("name")
        .then(({ data }) => setProducts((data as Product[]) || []));
    }
  }, [selectedSupplierId]);

  const searchFarmer = async () => {
    if (!farmerSearch.trim()) return;
    const query = farmerSearch.trim();
    const { data } = await supabase
      .from("farmers")
      .select("code, full_name, phone, patec, photo_frontal_url, saldo_final")
      .or(`code.eq.${query},phone.eq.${query},bi.eq.${query}`)
      .limit(1)
      .single();
    
    if (data) {
      setFarmer(data as Farmer);
      // Fetch PATEC items for this farmer's patec
      if (data.patec) {
        supabase.from("patec_items").select("*").eq("patec_number", data.patec)
          .then(({ data: items }) => setPatecItems(items || []));
      } else {
        setPatecItems([]);
      }
      // Fetch season purchases for this farmer
      const { data: sales } = await supabase
        .from("pos_sales")
        .select("id")
        .eq("farmer_code", data.code);
      
      if (sales && sales.length > 0) {
        const saleIds = sales.map((s) => s.id);
        const { data: items } = await supabase
          .from("pos_sale_items")
          .select("product_id, quantity")
          .in("sale_id", saleIds);
        
        const purchases: Record<string, number> = {};
        items?.forEach((item) => {
          purchases[item.product_id] = (purchases[item.product_id] || 0) + item.quantity;
        });
        setSeasonPurchases(purchases);
      } else {
        setSeasonPurchases({});
      }
      setCart([]);
      toast.success(`Produtor identificado: ${data.full_name}`);
    } else {
      toast.error("Produtor não encontrado");
      setFarmer(null);
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

  const addToCart = (product: Product) => {
    const remaining = getRemainingLimit(product);
    if (remaining <= 0) {
      toast.error(`Limite de "${product.name}" atingido para este produtor nesta época`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((c) => {
        if (c.product.id !== productId) return c;
        const newQty = c.quantity + delta;
        if (newQty <= 0) return c;
        // Check limit
        if (delta > 0) {
          const remaining = getRemainingLimit(c.product);
          if (remaining <= 0) {
            toast.error("Limite atingido");
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
    setProcessing(true);
    setPaymentStatus("processing");

    const saleCode = generateSaleCode();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: sale, error: saleError } = await supabase.from("pos_sales").insert({
      sale_code: saleCode,
      supplier_id: selectedSupplierId,
      farmer_code: farmer.code,
      farmer_name: farmer.full_name,
      farmer_phone: farmer.phone,
      patec_number: farmer.patec,
      subtotal: cartSubtotal,
      iva_total: cartIva,
      total: cartTotal,
      payment_method: "unitel_money",
      payment_status: "pendente",
      created_by: user?.id,
    }).select().single();

    if (saleError || !sale) {
      toast.error("Erro ao registar venda");
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-heading font-bold">Terminal POS — MOSAP3Pay</h1>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setKioskMode(k => !k)} title="F5 — Modo Kiosk">
            {kioskMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            {kioskMode ? "Sair Kiosk" : "Modo Kiosk"}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" title="Atalhos de teclado">
            <Keyboard className="h-4 w-4" />
            <span className="hidden md:inline">F1 Produtor • F2 Produto • F3 Pagar • F5 Kiosk</span>
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
            {/* Farmer identification */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> Identificar Produtor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Código, telefone ou BI do produtor..."
                    value={farmerSearch}
                    onChange={(e) => setFarmerSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchFarmer()}
                    className="flex-1"
                  />
                  <Button onClick={searchFarmer}><Search className="h-4 w-4 mr-1" /> Pesquisar</Button>
                </div>
                {farmer && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{farmer.full_name}</p>
                      <p className="text-xs text-muted-foreground">Código: {farmer.code} • Tel: {farmer.phone || "—"}</p>
                    </div>
                    <div className="text-right">
                      {farmer.patec ? (
                        <Badge className="text-xs">{patecLabels[farmer.patec]}</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Sem PATEC</Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Saldo: {farmer.saldo_final || "0,00"} Kz</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Products grid */}
             {farmer && patecItems.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" /> Itens do {farmer.patec ? patecLabels[farmer.patec] : "PATEC"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {["Insumos", "Pecuária", "Serviços"].map((cat) => {
                      const items = patecItems.filter((i) => i.category === cat);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">{cat}</p>
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-1.5 text-xs">
                              <Check className="h-3 w-3 text-primary" />
                              <span>{item.name}</span>
                            </div>
                          ))}
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
                  <Input
                    placeholder="Pesquisar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="mb-3"
                  />
                  {!farmer.patec ? (
                    <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <p className="text-sm text-destructive font-medium">Este produtor não tem PATEC atribuído. Não pode comprar produtos.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {getAvailableProducts().map((p) => {
                        const remaining = getRemainingLimit(p);
                        const inCart = cart.find((c) => c.product.id === p.id);
                        return (
                          <div
                            key={p.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${inCart ? "border-primary bg-primary/5" : "hover:border-primary/50"} ${remaining <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => remaining > 0 && addToCart(p)}
                          >
                            <p className="font-medium text-sm truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{Number(p.price).toLocaleString("pt-AO")} Kz/{p.unit}</p>
                            <div className="flex items-center justify-between mt-1">
                              <Badge variant="outline" className="text-[9px]">{p.category}</Badge>
                              {p.max_per_farmer_per_season && (
                                <span className={`text-[10px] font-medium ${remaining <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                  Resta: {Math.max(0, remaining)}
                                </span>
                              )}
                            </div>
                            {inCart && (
                              <div className="mt-1 text-[10px] text-primary font-bold">No carrinho: {inCart.quantity}</div>
                            )}
                          </div>
                        );
                      })}
                      {getAvailableProducts().length === 0 && (
                        <p className="col-span-full text-center text-muted-foreground py-4 text-sm">Nenhum produto disponível para este PATEC</p>
                      )}
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
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(c.product.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-xs font-bold w-6 text-center">{c.quantity}</span>
                          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(c.product.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeFromCart(c.product.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Separator className="my-2" />

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Subtotal</span><span>{cartSubtotal.toLocaleString("pt-AO")} Kz</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>{cartIva.toLocaleString("pt-AO")} Kz</span></div>
                      <Separator />
                      <div className="flex justify-between font-bold text-base"><span>Total</span><span>{cartTotal.toLocaleString("pt-AO")} Kz</span></div>
                    </div>

                    <Button className="w-full mt-3" onClick={() => setConfirmOpen(true)} disabled={!farmer}>
                      <CreditCard className="h-4 w-4 mr-2" /> Processar Pagamento
                    </Button>
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
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{cartTotal.toLocaleString("pt-AO")} Kz</span>
            </div>
            <p className="text-xs text-muted-foreground">Pagamento via Unitel Money • Telefone: {farmer?.phone || "sem telefone"}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={processSale} disabled={processing}>
              {processing ? "Processando..." : "Confirmar e Pagar"}
            </Button>
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
            <p className="text-xs text-muted-foreground">
              {paymentStatus === "polling" ? "O produtor receberá um pedido de pagamento no telefone..." : paymentStatus === "paid" ? "Pagamento recebido via Unitel Money" : paymentStatus === "failed" ? "O pagamento não foi processado. Tente novamente." : "Pagamento pendente via Unitel Money"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowInvoice(true)} disabled={!invoiceData}>
                <Printer className="h-4 w-4 mr-1" /> Ver Factura
              </Button>
              <Button onClick={() => { setReceiptOpen(false); setFarmer(null); setFarmerSearch(""); setPaymentStatus("idle"); setInvoiceData(null); }} className="flex-1">
                Nova Venda
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Factura / Recibo</DialogTitle></DialogHeader>
          {invoiceData && (
            <InvoicePDF data={invoiceData} hash={invoiceHash} qrContent={invoiceQR} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayPOS;
