import { motion } from "framer-motion";
import { Search, Filter, ChevronLeft, ChevronRight, X, TrendingUp, Package, Building2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowsSkeleton, CardListSkeleton } from "@/components/ui/loading-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerTable, useDebouncedValue } from "@/hooks/useServerTable";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 15;

type SortKey = "recent" | "expensive" | "cheap";

const fmtKz = (v: number) =>
  (v || 0).toLocaleString("pt-AO", { maximumFractionDigits: 0 }) + " Kz";

const Transacoes = () => {
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [farmerFilter, setFarmerFilter] = useState("");
  const [minValor, setMinValor] = useState<string>("");
  const [maxValor, setMaxValor] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);

  const debSearch = useDebouncedValue(search, 300);
  const debFarmer = useDebouncedValue(farmerFilter, 300);
  const debMin = useDebouncedValue(minValor, 300);
  const debMax = useDebouncedValue(maxValor, 300);

  useEffect(() => { setPage(1); }, [debSearch, empresaFilter, productFilter, debFarmer, debMin, debMax, sortKey]);

  const minNum = useMemo(() => (debMin === "" ? null : Number(debMin)), [debMin]);
  const maxNum = useMemo(() => (debMax === "" ? null : Number(debMax)), [debMax]);

  // Listas distintas para os Selects
  const { data: empresas = [] } = useQuery({
    queryKey: ["tx_empresas_distinct"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("farmer_transactions").select("empresa").limit(2000);
      return Array.from(new Set((data || []).map((r: any) => r.empresa).filter(Boolean))).sort();
    },
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ["tx_produtos_distinct"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("farmer_transactions").select("product").limit(5000);
      return Array.from(new Set((data || []).map((r: any) => r.product).filter(Boolean))).sort();
    },
  });

  // KPIs reactivos aos filtros
  const kpisQuery = useQuery({
    queryKey: ["tx_kpis", debSearch, empresaFilter, productFilter, debFarmer, minNum, maxNum],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("transacoes_kpis", {
        p_search: debSearch || null,
        p_empresa: empresaFilter === "all" ? null : empresaFilter,
        p_product: productFilter === "all" ? null : productFilter,
        p_farmer: debFarmer || null,
        p_min: minNum,
        p_max: maxNum,
      });
      if (error) throw error;
      return data as {
        total_count: number;
        total_volume_kz: number;
        min_valor: number;
        max_valor: number;
        avg_valor: number;
        top_products: Array<{ product: string; total_kz: number; count: number }>;
        top_empresas: Array<{ empresa: string; total_kz: number; count: number }>;
        top_products_by_count: Array<{ product: string; total_kz: number; count: number }>;
        top_empresas_by_count: Array<{ empresa: string; total_kz: number; count: number }>;
      };
    },
  });
  const kpis = kpisQuery.data;

  // Filtro OR para produtor (código OU nome via foreign-table)
  const farmerOr = useMemo(() => {
    const t = debFarmer.trim().replace(/[%,()*]/g, " ");
    if (!t) return undefined;
    return `farmer_code.ilike.%${t}%,farmers.full_name.ilike.%${t}%`;
  }, [debFarmer]);

  const sortMap: Record<SortKey, { column: string; dir: "asc" | "desc" }> = {
    recent: { column: "created_at", dir: "desc" },
    expensive: { column: "valor_num", dir: "desc" },
    cheap: { column: "valor_num", dir: "asc" },
  };

  const { rows, total, isLoading, isError, refetch, isFetching } = useServerTable<any>({
    table: "farmer_transactions",
    columns: "id, farmer_code, empresa, product, valor, valor_num, transaction_date, created_at, farmers!farmer_transactions_farmer_code_fkey(full_name, province)",
    page,
    pageSize: PAGE_SIZE,
    search: debSearch,
    searchColumns: ["farmer_code", "empresa", "product"],
    filters: { empresa: empresaFilter, product: productFilter },
    rangeFilters: [{ column: "valor_num", gte: minNum ?? undefined, lte: maxNum ?? undefined }],
    orFilter: farmerOr,
    sort: sortMap[sortKey],
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasFilters =
    !!debSearch || empresaFilter !== "all" || productFilter !== "all" ||
    !!debFarmer || debMin !== "" || debMax !== "" || sortKey !== "recent";

  const clearFilters = () => {
    setSearch(""); setEmpresaFilter("all"); setProductFilter("all");
    setFarmerFilter(""); setMinValor(""); setMaxValor(""); setSortKey("recent");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico de transações ({total.toLocaleString("pt-AO")} no total{hasFilters ? " · com filtros" : ""})
          </p>
        </div>
      </div>

      {/* KPIs analíticos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
            <Wallet className="h-4 w-4" /> Volume vendido
          </div>
          <p className="text-2xl font-bold mt-2">{kpis ? fmtKz(Number(kpis.total_volume_kz)) : "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis ? `${Number(kpis.total_count).toLocaleString("pt-AO")} transacções` : ""}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
            <TrendingUp className="h-4 w-4" /> Ticket (mín · médio · máx)
          </div>
          <p className="text-base font-semibold mt-2">
            {kpis
              ? `${fmtKz(Number(kpis.min_valor))} · ${fmtKz(Number(kpis.avg_valor))} · ${fmtKz(Number(kpis.max_valor))}`
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Valores das transacções filtradas</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
            <Package className="h-4 w-4" /> Top 5 Produtos
          </div>
          <TopList
            byKz={kpis?.top_products}
            byCount={kpis?.top_products_by_count}
            keyField="product"
          />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
            <Building2 className="h-4 w-4" /> Top 5 Empresas
          </div>
          <TopList
            byKz={kpis?.top_empresas}
            byCount={kpis?.top_empresas_by_count}
            keyField="empresa"
          />
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar código, empresa, produto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Input
            placeholder="Produtor (código ou nome)"
            value={farmerFilter}
            onChange={(e) => setFarmerFilter(e.target.value)}
          />
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresas.map((e: string) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtos.map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="expensive">Mais caros</SelectItem>
              <SelectItem value="cheap">Mais baratos</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 xl:col-span-2">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Mín. Kz"
              value={minValor}
              onChange={(e) => setMinValor(e.target.value)}
            />
            <span className="text-muted-foreground text-xs">a</span>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Máx. Kz"
              value={maxValor}
              onChange={(e) => setMaxValor(e.target.value)}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="justify-start">
              <X className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {isError ? (
          <Card><ErrorState onRetry={() => refetch()} /></Card>
        ) : (
        <Card className={`p-0 overflow-hidden transition-opacity ${isFetching && !isLoading ? "opacity-70" : ""}`}>
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
                  <TableRowsSkeleton rows={6} cols={6} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState size="sm" icon={Filter} description="Ajuste os filtros ou aguarde novas transações." />
                    </td>
                  </tr>
                ) : rows.map((t: any) => (
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

          <div className="md:hidden divide-y divide-border">
            {isLoading ? (
              <CardListSkeleton count={5} />
            ) : rows.length === 0 ? (
              <EmptyState size="sm" icon={Filter} description="Ajuste os filtros ou aguarde novas transações." />
            ) : rows.map((t: any) => (
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
            <span>
              {total === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString("pt-AO")}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{page} / {totalPages}</span>
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

type TopRow = { product?: string; empresa?: string; total_kz: number; count: number };

function TopList({
  byKz, byCount, keyField,
}: {
  byKz?: TopRow[];
  byCount?: TopRow[];
  keyField: "product" | "empresa";
}) {
  if (!byKz || byKz.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem dados.</p>;
  }
  // Mapear contagem por chave a partir do "byCount" para mostrar lado a lado
  const countMap = new Map<string, number>();
  (byCount || []).forEach((r) => countMap.set(String(r[keyField]), Number(r.count)));
  return (
    <ul className="space-y-1">
      {byKz.slice(0, 5).map((r, i) => {
        const name = String(r[keyField] || "—");
        return (
          <li key={`${name}-${i}`} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate flex-1" title={name}>
              <span className="text-muted-foreground mr-1">{i + 1}.</span>{name}
            </span>
            <span className="font-semibold tabular-nums">{fmtKz(Number(r.total_kz))}</span>
            <span className="text-muted-foreground tabular-nums w-14 text-right">
              {Number(r.count).toLocaleString("pt-AO")} vd
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default Transacoes;
