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

export default Mosap3Pay;
