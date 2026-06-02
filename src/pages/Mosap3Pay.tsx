import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard, Store, Monitor, ShoppingCart, TrendingUp, Package, Users, AlertTriangle, Loader2,
  Receipt, FileText, BarChart3, Wand2, Smartphone, Shield, Settings, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import { usePriceAnalysis, usePriceAlertReviews } from "@/hooks/usePriceAnalysis";

const Mosap3Pay = () => {
  const [stats, setStats] = useState({
    suppliers: 0,
    products: 0,
    posTerminals: 0,
    totalSales: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const [suppliers, products, pos, salesData, recent] = await Promise.all([
        supabase.from("suppliers").select("*", { count: "exact", head: true }),
        supabase.from("supplier_products").select("*", { count: "exact", head: true }),
        supabase.from("supplier_pos").select("*", { count: "exact", head: true }),
        fetchAllPages<{ total: number | string; payment_status: string }>(() =>
          supabase.from("pos_sales").select("total, payment_status", { count: "exact" })
        ),
        supabase.from("pos_sales").select("*").order("created_at", { ascending: false }).limit(5),
      ]);

      const totalRevenue = salesData.reduce((sum, s) => sum + Number(s.total || 0), 0);
      const pendingPayments = salesData.filter((s) => s.payment_status === "pendente").length;

      setStats({
        suppliers: suppliers.count || 0,
        products: products.count || 0,
        posTerminals: pos.count || 0,
        totalSales: salesData.length,
        totalRevenue,
        pendingPayments,
      });

      setRecentSales(recent.data || []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const statCards = [
    { icon: Store, label: "Fornecedores", value: stats.suppliers, color: "text-info", link: "/mosap3pay/fornecedores" },
    { icon: Package, label: "Produtos", value: stats.products, color: "text-success", link: "/mosap3pay/fornecedores" },
    { icon: Monitor, label: "Terminais POS", value: stats.posTerminals, color: "text-accent-foreground", link: "/mosap3pay/fornecedores" },
    { icon: ShoppingCart, label: "Vendas Totais", value: stats.totalSales, color: "text-warning", link: "/mosap3pay/vendas" },
    { icon: TrendingUp, label: "Receita Total", value: `${stats.totalRevenue.toLocaleString("pt-AO")} Kz`, color: "text-primary", link: "/mosap3pay/vendas" },
    { icon: AlertTriangle, label: "Pagamentos Pendentes", value: stats.pendingPayments, color: "text-destructive", link: "/mosap3pay/vendas" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            MOSAP3Pay
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sistema de gestão de vendas, POS e pagamentos — Unitel Money
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/mosap3pay/fornecedores">
              <Store className="h-4 w-4 mr-2" /> Fornecedores
            </Link>
          </Button>
          <Button asChild>
            <Link to="/mosap3pay/pos">
              <Monitor className="h-4 w-4 mr-2" /> Abrir POS
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <Link key={s.label} to={s.link}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 text-center">
                <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                <p className="text-xl font-bold">{loading ? "..." : s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Banner contextual: alertas de preço alta severidade não revistos */}
      <PriceAlertsBanner />

      {/* Acessos rápidos agrupados por área */}
      <FeatureGrid />


      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Últimas Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Carregando...</span>
            </div>
          ) : recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda registada</p>
          ) : (
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{sale.farmer_name}</p>
                    <p className="text-xs text-muted-foreground">{sale.sale_code} • {new Date(sale.created_at).toLocaleDateString("pt-AO")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{Number(sale.total).toLocaleString("pt-AO")} Kz</p>
                    <Badge variant={sale.payment_status === "pago" ? "default" : "secondary"} className="text-[10px]">
                      {sale.payment_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Banner contextual: alertas de preço com severidade alta ainda não revistos
// ----------------------------------------------------------------------------
function PriceAlertsBanner() {
  const { data: alerts } = usePriceAnalysis();
  const { data: reviews } = usePriceAlertReviews();

  const pending = useMemo(() => {
    if (!alerts) return [];
    const reviewedKeys = new Set(
      (reviews ?? []).map((r) => `${r.product_id}::${r.supplier_id}`),
    );
    return alerts.filter(
      (a) => a.severity === "alta" && !reviewedKeys.has(`${a.product_id}::${a.supplier_id}`),
    );
  }, [alerts, reviews]);

  if (pending.length === 0) return null;

  const supplierCount = new Set(pending.map((p) => p.supplier_id)).size;

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {pending.length} {pending.length === 1 ? "alerta" : "alertas"} de preço anormal por rever
            </p>
            <p className="text-xs text-muted-foreground">
              {supplierCount} {supplierCount === 1 ? "fornecedor" : "fornecedores"} com produtos em severidade alta
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="default">
          <Link to="/mosap3pay/analise-precos">Rever alertas</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Grelha de funcionalidades agrupada por área
// ----------------------------------------------------------------------------
type FeatureCard = {
  icon: any;
  label: string;
  desc: string;
  to: string;
  color: string;
  badge?: string;
};

type FeatureGroup = {
  title: string;
  items: FeatureCard[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "Operação",
    items: [
      { icon: Monitor, label: "Terminal POS", desc: "Registar vendas e validar PATEC do produtor", to: "/mosap3pay/pos", color: "text-primary" },
      { icon: ShoppingCart, label: "Vendas", desc: "Histórico de transações e filtros avançados", to: "/mosap3pay/vendas", color: "text-success" },
      { icon: Receipt, label: "Facturas", desc: "Documentos fiscais emitidos (Série FT)", to: "/mosap3pay/facturas", color: "text-info" },
      { icon: FileText, label: "Notas de Crédito", desc: "Anular ou ajustar facturas (Série NC)", to: "/mosap3pay/notas-credito", color: "text-warning", badge: "Novo" },
    ],
  },
  {
    title: "Catálogo & Stock",
    items: [
      { icon: Store, label: "Fornecedores", desc: "Cadastro, catálogo e zonas de atuação", to: "/mosap3pay/fornecedores", color: "text-info" },
      { icon: Package, label: "Stock", desc: "Existências por loja com alertas de mínimo", to: "/mosap3pay/stock", color: "text-success" },
      { icon: ShieldCheck, label: "Aprovação de Fornecedores", desc: "Validar candidaturas pendentes", to: "/mosap3pay/fornecedores/aprovacoes", color: "text-primary" },
    ],
  },
  {
    title: "Análise & Controlo",
    items: [
      { icon: TrendingUp, label: "Análise de Preços", desc: "Detectar variações anormais entre fornecedores", to: "/mosap3pay/analise-precos", color: "text-warning", badge: "Novo" },
      { icon: BarChart3, label: "Painel de Vendas", desc: "KPIs comerciais e séries temporais", to: "/mosap3pay/painel-vendas", color: "text-primary", badge: "Novo" },
      { icon: Wand2, label: "Reconciliação", desc: "Conferência financeira e fecho de caixa", to: "/mosap3pay/reconciliacao", color: "text-info" },
      { icon: BarChart3, label: "Relatórios", desc: "Relatórios financeiros e fiscais (SAF-T AO)", to: "/mosap3pay/relatorios", color: "text-success" },
    ],
  },
  {
    title: "Administração",
    items: [
      { icon: Shield, label: "Auditoria", desc: "Histórico de ações críticas no módulo", to: "/mosap3pay/auditoria", color: "text-primary" },
      { icon: AlertTriangle, label: "Ocorrências", desc: "Incidentes e reclamações registadas", to: "/mosap3pay/ocorrencias", color: "text-destructive" },
      { icon: Smartphone, label: "Cartões SIM", desc: "Gestão de SIMs Unitel Money por terminal", to: "/mosap3pay/cartoes-sim", color: "text-info" },
      { icon: Settings, label: "Configurações", desc: "Séries fiscais, integrações e parâmetros", to: "/mosap3pay/configuracoes", color: "text-muted-foreground" },
    ],
  },
];

function FeatureGrid() {
  return (
    <div className="space-y-5">
      {FEATURE_GROUPS.map((group) => (
        <div key={group.title}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {group.title}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {group.items.map((item) => (
              <Link key={item.to} to={item.to}>
                <Card className="h-full hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <item.icon className={`h-5 w-5 ${item.color}`} />
                      {item.badge && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-tight">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{item.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Mosap3Pay;

