import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, Users, ShoppingCart, Coins } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const FornecedorRelatorioVendedores = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const start = new Date(from + "T00:00:00").toISOString();
    const end = new Date(to + "T23:59:59").toISOString();
    const { data, error: err } = await supabase
      .from("pos_sales")
      .select("id,total,seller_id,seller_name,created_at,payment_status")
      .eq("supplier_id", supplier.id)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false });
    if (err) setError(err as unknown as Error);
    else setSales(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [supplier.id, from, to]);

  // Aggregations: per seller per day
  const { rows, totals, perSeller } = useMemo(() => {
    const map = new Map<string, { seller: string; day: string; count: number; total: number }>();
    const sellerMap = new Map<string, { seller: string; count: number; total: number }>();
    let totalCount = 0;
    let totalAmount = 0;
    const sellerSet = new Set<string>();

    for (const s of sales) {
      const seller = s.seller_name || "Sem vendedor";
      const day = new Date(s.created_at).toISOString().slice(0, 10);
      const key = `${seller}__${day}`;
      const amt = Number(s.total) || 0;
      const cur = map.get(key) || { seller, day, count: 0, total: 0 };
      cur.count += 1;
      cur.total += amt;
      map.set(key, cur);

      const sc = sellerMap.get(seller) || { seller, count: 0, total: 0 };
      sc.count += 1;
      sc.total += amt;
      sellerMap.set(seller, sc);

      totalCount += 1;
      totalAmount += amt;
      sellerSet.add(seller);
    }

    const rows = Array.from(map.values()).sort((a, b) =>
      b.day.localeCompare(a.day) || a.seller.localeCompare(b.seller)
    );
    const perSeller = Array.from(sellerMap.values()).sort((a, b) => b.total - a.total);

    return {
      rows,
      perSeller,
      totals: { count: totalCount, amount: totalAmount, sellers: sellerSet.size },
    };
  }, [sales]);

  const exportCSV = () => {
    const header = ["Data", "Vendedor", "Nº Vendas", "Total (Kz)"];
    const lines = rows.map((r) => [r.day, r.seller, r.count, r.total.toFixed(2)].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas_por_vendedor_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => n.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Relatório de Vendas por Vendedor
        </h1>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label htmlFor="from" className="text-xs">De</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label htmlFor="to" className="text-xs">Até</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setFrom(todayISO()); setTo(todayISO()); }}>Hoje</Button>
            <Button variant="ghost" size="sm" onClick={() => { setFrom(daysAgoISO(7)); setTo(todayISO()); }}>7 dias</Button>
            <Button variant="ghost" size="sm" onClick={() => { setFrom(daysAgoISO(30)); setTo(todayISO()); }}>30 dias</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendedores activos</p>
                  <p className="text-xl font-bold">{totals.sellers}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><ShoppingCart className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de vendas</p>
                  <p className="text-xl font-bold">{totals.count}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Coins className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor total</p>
                  <p className="text-xl font-bold">{fmt(totals.amount)} Kz</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Totais por vendedor</CardTitle></CardHeader>
            <CardContent>
              {perSeller.length === 0 ? (
                <EmptyState icon={Users} title="Sem dados no período" description="Ajuste o filtro de datas." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Nº Vendas</TableHead>
                        <TableHead className="text-right">Total (Kz)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perSeller.map((r) => (
                        <TableRow key={r.seller}>
                          <TableCell className="font-medium">{r.seller}</TableCell>
                          <TableCell className="text-right">{r.count}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(r.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Detalhe por vendedor e dia</CardTitle></CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <EmptyState icon={BarChart3} title="Sem vendas no período" description="Não há vendas registadas no intervalo seleccionado." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Nº Vendas</TableHead>
                        <TableHead className="text-right">Total (Kz)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={`${r.day}-${r.seller}`}>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(r.day).toLocaleDateString("pt-AO")}
                          </TableCell>
                          <TableCell>{r.seller}</TableCell>
                          <TableCell className="text-right">{r.count}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(r.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default FornecedorRelatorioVendedores;
