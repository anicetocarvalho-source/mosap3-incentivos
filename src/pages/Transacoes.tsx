import { motion } from "framer-motion";
import { Search, Filter, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/supabaseFetchAll";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 10;

const Transacoes = () => {
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: transactions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["farmer_transactions"],
    queryFn: async () => {
      return await fetchAllPages<any>(() =>
        supabase
          .from("farmer_transactions")
          .select(
            "*, farmers!farmer_transactions_farmer_code_fkey(full_name, province)",
            { count: "exact" }
          )
          .order("created_at", { ascending: false })
      );
    },
  });

  useEffect(() => { setPage(1); }, [search, empresaFilter]);

  const empresas = [...new Set(transactions.map((t: any) => t.empresa))].sort();

  const filtered = transactions.filter((t: any) => {
    const name = t.farmers?.full_name || "";
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      t.farmer_code.toLowerCase().includes(search.toLowerCase()) ||
      t.empresa.toLowerCase().includes(search.toLowerCase()) ||
      t.product.toLowerCase().includes(search.toLowerCase());
    const matchesEmpresa = empresaFilter === "all" || t.empresa === empresaFilter;
    return matchesSearch && matchesEmpresa;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">Histórico de todas as transações do sistema</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar transações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {empresas.map((e: string) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {isError ? (
          <Card><ErrorState onRetry={() => refetch()} /></Card>
        ) : (
        <Card className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produtor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produto</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor (AOA)</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-6 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      Nenhuma transação encontrada
                    </td>
                  </tr>
                ) : paginated.map((t: any) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{t.farmer_code}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{t.farmers?.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{t.farmers?.province || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.empresa}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">
                        {t.product}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{t.valor}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {t.transaction_date || new Date(t.created_at).toLocaleDateString("pt-AO")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma transação encontrada</div>
            ) : paginated.map((t: any) => (
              <div key={t.id} className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">{t.farmers?.full_name || "—"}</p>
                  <span className="font-semibold text-sm">{t.valor} AOA</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{t.farmer_code}</span>
                  <span>•</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{t.product}</span>
                  <span>•</span>
                  <span>{t.empresa}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t.transaction_date || new Date(t.created_at).toLocaleDateString("pt-AO")}
                </p>
              </div>
            ))}
          </div>

          <div className="px-4 md:px-6 py-3 border-t border-border flex items-center justify-between text-xs md:text-sm text-muted-foreground">
            <span>{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} transações</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{page} / {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
        )}
      </motion.div>
    </div>
  );
};

export default Transacoes;
