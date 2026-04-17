import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Search } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

const FornecedorVendas = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("pos_sales").select("*").eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });
    if (err) setError(err as unknown as Error);
    else setSales(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [supplier.id]);

  const filtered = sales.filter((s) =>
    !search || s.sale_code.toLowerCase().includes(search.toLowerCase()) || s.farmer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-heading font-bold flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Histórico de Vendas</h1>

      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <LoadingState rows={6} />
          ) : error ? (
            <ErrorState onRetry={load} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={search ? "Nenhuma venda corresponde à pesquisa" : "Nenhuma venda registada"}
              description={search ? "Tente outros termos de pesquisa." : "As vendas processadas no POS aparecerão aqui."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Produtor</TableHead>
                    <TableHead>PATEC</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.sale_code}</TableCell>
                      <TableCell>{s.farmer_name}</TableCell>
                      <TableCell>{s.patec_number ? `PATEC ${s.patec_number}` : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{Number(s.total).toLocaleString("pt-AO")} Kz</TableCell>
                      <TableCell><Badge variant={s.payment_status === "pago" ? "default" : "outline"}>{s.payment_status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-AO")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FornecedorVendas;
