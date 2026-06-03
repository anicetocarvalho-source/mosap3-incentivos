import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Shift {
  id: string; status: string; opened_at: string; closed_at: string | null;
  opening_note: string | null; closing_note: string | null;
  totals: any; seller_id: string; pos_id: string | null;
  supplier_sellers?: { full_name: string; username: string } | null;
  supplier_pos?: { pos_code: string; label: string | null } | null;
}

const fmtKz = (n: number) => new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(n || 0);

const FornecedorTurnos = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  const [list, setList] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supplier?.id) return;
      const { data, error } = await (supabase as any)
        .from("pos_shifts")
        .select("id, status, opened_at, closed_at, opening_note, closing_note, totals, seller_id, pos_id, supplier_sellers:seller_id(full_name, username), supplier_pos:pos_id(pos_code, label)")
        .eq("supplier_id", supplier.id)
        .order("opened_at", { ascending: false })
        .limit(100);
      if (!error) setList(data as Shift[]);
      setLoading(false);
    })();
  }, [supplier?.id]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2"><Clock className="h-6 w-6 text-primary" /> Turnos de Caixa</h1>
        <p className="text-sm text-muted-foreground">Histórico de turnos abertos pelos vendedores nos terminais POS.</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />A carregar…</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Sem turnos registados ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>POS</TableHead>
                  <TableHead>Aberto</TableHead>
                  <TableHead>Fechado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.supplier_sellers?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.supplier_sellers?.username}</div>
                    </TableCell>
                    <TableCell>{s.supplier_pos?.label || s.supplier_pos?.pos_code || "—"}</TableCell>
                    <TableCell className="text-xs">{format(new Date(s.opened_at), "dd/MM HH:mm")}</TableCell>
                    <TableCell className="text-xs">{s.closed_at ? format(new Date(s.closed_at), "dd/MM HH:mm") : "—"}</TableCell>
                    <TableCell>
                      {s.status === "aberto"
                        ? <Badge className="bg-success text-success-foreground">Aberto</Badge>
                        : <Badge variant="secondary">Fechado</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{s.totals?.count ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">{fmtKz(Number(s.totals?.total || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FornecedorTurnos;
