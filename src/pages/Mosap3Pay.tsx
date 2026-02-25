import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Store, Monitor, ShoppingCart, TrendingUp, Package, Users, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
      const [suppliers, products, pos, sales] = await Promise.all([
        supabase.from("suppliers").select("*", { count: "exact", head: true }),
        supabase.from("supplier_products").select("*", { count: "exact", head: true }),
        supabase.from("supplier_pos").select("*", { count: "exact", head: true }),
        supabase.from("pos_sales").select("*"),
      ]);

      const salesData = sales.data || [];
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

      // Recent sales
      const { data: recent } = await supabase
        .from("pos_sales")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentSales(recent || []);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const statCards = [
    { icon: Store, label: "Fornecedores", value: stats.suppliers, color: "text-blue-600", link: "/mosap3pay/fornecedores" },
    { icon: Package, label: "Produtos", value: stats.products, color: "text-emerald-600", link: "/mosap3pay/fornecedores" },
    { icon: Monitor, label: "Terminais POS", value: stats.posTerminals, color: "text-violet-600", link: "/mosap3pay/fornecedores" },
    { icon: ShoppingCart, label: "Vendas Totais", value: stats.totalSales, color: "text-amber-600", link: "/mosap3pay/vendas" },
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Store className="h-4 w-4 text-blue-600" /> Gestão de Fornecedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Cadastrar fornecedores, gerir catálogo de produtos, configurar terminais POS e definir limites por época.</p>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/mosap3pay/fornecedores">Gerir Fornecedores</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Monitor className="h-4 w-4 text-violet-600" /> Terminal POS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Realizar vendas, identificar produtores por código/telefone, validar PATEC e processar pagamentos.</p>
            <Button asChild size="sm" className="w-full">
              <Link to="/mosap3pay/pos">Abrir POS</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Histórico de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Consultar todas as transações, filtrar por fornecedor, produtor ou período, e exportar relatórios.</p>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/mosap3pay/vendas">Ver Vendas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Últimas Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
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
