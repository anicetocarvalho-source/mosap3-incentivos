import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Monitor, ShoppingCart, TrendingUp } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const FornecedorDashboard = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string; name: string; status: string } }>();
  const [stats, setStats] = useState({ products: 0, pos: 0, sales: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, posRes, salesRes] = await Promise.all([
        supabase.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id),
        supabase.from("supplier_pos").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id),
        supabase.from("pos_sales").select("id, total").eq("supplier_id", supplier.id),
      ]);
      if (prodRes.error) throw prodRes.error;
      if (posRes.error) throw posRes.error;
      if (salesRes.error) throw salesRes.error;
      const revenue = (salesRes.data || []).reduce((s, r) => s + Number(r.total), 0);
      setStats({
        products: prodRes.count || 0,
        pos: posRes.count || 0,
        sales: salesRes.data?.length || 0,
        revenue,
      });
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [supplier.id]);

  const cards = [
    { label: "Produtos", value: stats.products, icon: Package, color: "text-primary" },
    { label: "Terminais POS", value: stats.pos, icon: Monitor, color: "text-accent-foreground" },
    { label: "Vendas", value: stats.sales, icon: ShoppingCart, color: "text-secondary-foreground" },
    { label: "Receita Total", value: `${stats.revenue.toLocaleString("pt-AO")} Kz`, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Olá, {supplier.name}</h1>
        <p className="text-muted-foreground text-sm">Bem-vindo ao seu portal de gestão</p>
      </div>

      {error ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
                ))
              : cards.map((c) => (
                  <Card key={c.label}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${c.color}`}>
                          <c.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{c.value}</p>
                          <p className="text-xs text-muted-foreground">{c.label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Últimas Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentSales supplierId={supplier.id} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const RecentSales = ({ supplierId }: { supplierId: string }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("pos_sales").select("*").eq("supplier_id", supplierId)
      .order("created_at", { ascending: false }).limit(10);
    if (err) setError(err as unknown as Error);
    else setSales(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [supplierId]);

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState onRetry={load} />;
  if (sales.length === 0) return <EmptyState icon={ShoppingCart} title="Sem vendas recentes" description="As vendas registadas aparecerão aqui." />;

  return (
    <div className="space-y-2">
      {sales.map((s) => (
        <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm font-medium">{s.farmer_name}</p>
            <p className="text-xs text-muted-foreground">{s.sale_code} • {new Date(s.created_at).toLocaleDateString("pt-AO")}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{Number(s.total).toLocaleString("pt-AO")} Kz</p>
            <Badge variant={s.payment_status === "pago" ? "default" : "outline"} className="text-[10px]">{s.payment_status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FornecedorDashboard;
