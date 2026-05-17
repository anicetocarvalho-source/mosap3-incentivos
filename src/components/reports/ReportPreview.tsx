import { motion } from "framer-motion";
import { format } from "date-fns";
import { Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { mosapLogo, LOGO_SIZES } from "@/config/brand";
import { ProducaoCharts, AgricultoresCharts, IncentivosCharts, ComprasCharts } from "./ReportCharts";
import { useReportData, type ReportFilters } from "@/hooks/useReportData";

type Filters = ReportFilters;

type Props = {
  reportType: string;
  reportLabel: string;
  filters: Filters;
};

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-AO", { style: "decimal", minimumFractionDigits: 0 }).format(v) + " Kz";
const formatNumber = (v: number) => new Intl.NumberFormat("pt-AO").format(Math.round(v));
const formatDecimal = (v: number) => new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(v);

const ReportPreview = ({ reportType, reportLabel, filters }: Props) => {
  const today = new Date();
  const filterSummary: string[] = [];
  if (filters.provincia && filters.provincia !== "all") filterSummary.push(`Província: ${filters.provincia}`);
  if (filters.municipio && filters.municipio !== "all") filterSummary.push(`Município: ${filters.municipio}`);
  if (filters.escola && filters.escola !== "all") filterSummary.push(`Escola: ${filters.escola}`);
  if (filters.estado && filters.estado !== "all") filterSummary.push(`Estado: ${filters.estado}`);
  if (filters.dateFrom) filterSummary.push(`De: ${format(filters.dateFrom, "dd/MM/yyyy")}`);
  if (filters.dateTo) filterSummary.push(`Até: ${format(filters.dateTo, "dd/MM/yyyy")}`);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bg-card border border-border rounded-xl overflow-hidden print:border-0 print:rounded-none print:shadow-none" id="report-print-area">
        {/* Report Header */}
        <div className="p-6 border-b border-border print:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={mosapLogo} alt="MOSAP3" className={LOGO_SIZES.report} />
              <div>
                <h2 className="font-heading font-bold text-base">MOSAP3 — Projecto Mosap3</h2>
                <p className="text-xs text-muted-foreground">República de Angola • Ministério da Agricultura e Pescas</p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Gerado em: {format(today, "dd/MM/yyyy HH:mm")}</p>
              <p>Utilizador: Admin MOSAP3</p>
            </div>
          </div>
        </div>

        {/* Report Title */}
        <div className="px-6 py-4 bg-primary/5 border-b border-border print:px-4">
          <h3 className="font-heading font-bold text-lg text-primary">{reportLabel}</h3>
          {filterSummary.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {filterSummary.map((f, i) => (
                <span key={i} className="text-xs bg-muted px-2 py-1 rounded-md">{f}</span>
              ))}
            </div>
          )}
          {filterSummary.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">Sem filtros aplicados — a mostrar todos os dados</p>
          )}
        </div>

        {/* Report Body */}
        <div className="p-6 print:p-4">
          {reportType === "producao_provincia" && <ProducaoTable filters={filters} />}
          {reportType === "pecuaria_provincia" && <PecuariaTable filters={filters} />}
          {reportType === "agricultores_estado" && <AgricultoresTable filters={filters} />}
          {reportType === "incentivos_distribuidos" && <IncentivosTable filters={filters} />}
          {reportType === "compras_transacoes" && <ComprasTable filters={filters} />}
        </div>

        {/* Report Footer */}
        <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground text-center print:px-4">
          <p>MOSAP3 — Relatório gerado automaticamente • {format(today, "dd 'de' MMMM 'de' yyyy", { locale: undefined })} • Página 1 de 1</p>
        </div>
      </div>
    </motion.div>
  );
};

const tableClass = "w-full text-sm border-collapse";
const thClass = "text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground bg-muted/50 border border-border";
const tdClass = "px-3 py-2 border border-border text-sm";
const tdNumClass = "px-3 py-2 border border-border text-sm text-right font-mono";
const tfClass = "px-3 py-2 border border-border text-sm font-bold bg-muted/30";
const tfNumClass = "px-3 py-2 border border-border text-sm font-bold text-right font-mono bg-muted/30";

const LoadingRow = () => (
  <div className="flex items-center justify-center py-12 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin mr-2" />
    <span className="text-sm">A carregar dados...</span>
  </div>
);

const EmptyRow = () => (
  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
    <Inbox className="h-8 w-8 mb-2 opacity-50" />
    <p className="text-sm">Sem dados para os filtros aplicados.</p>
  </div>
);

const ProducaoTable = ({ filters }: { filters: Filters }) => {
  const { data = [], isLoading } = useReportData("producao_provincia", filters);
  if (isLoading) return <LoadingRow />;
  if (data.length === 0) return <EmptyRow />;

  const totals = (data as any[]).reduce((acc, r) => ({
    agricultores: acc.agricultores + r.agricultores,
    parcelas: acc.parcelas + r.parcelas,
    areaTotalHa: acc.areaTotalHa + r.areaTotalHa,
    producaoTon: acc.producaoTon + r.producaoTon,
  }), { agricultores: 0, parcelas: 0, areaTotalHa: 0, producaoTon: 0 });

  return (
    <>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Província</th>
              <th className={thClass}>Escola de Campo</th>
              <th className={cn(thClass, "text-right")}>Agricultores</th>
              <th className={cn(thClass, "text-right")}>Parcelas</th>
              <th className={cn(thClass, "text-right")}>Área (ha)</th>
              <th className={cn(thClass, "text-right")}>Produção (ton)</th>
              <th className={cn(thClass, "text-right")}>Média/ha</th>
            </tr>
          </thead>
          <tbody>
            {(data as any[]).map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className={tdClass}>{r.provincia}</td>
                <td className={tdClass}>{r.escola}</td>
                <td className={tdNumClass}>{formatNumber(r.agricultores)}</td>
                <td className={tdNumClass}>{formatNumber(r.parcelas)}</td>
                <td className={tdNumClass}>{formatDecimal(r.areaTotalHa)}</td>
                <td className={tdNumClass}>{formatDecimal(r.producaoTon)}</td>
                <td className={tdNumClass}>{r.mediaHa.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={tfClass} colSpan={2}>TOTAL</td>
              <td className={tfNumClass}>{formatNumber(totals.agricultores)}</td>
              <td className={tfNumClass}>{formatNumber(totals.parcelas)}</td>
              <td className={tfNumClass}>{formatDecimal(totals.areaTotalHa)}</td>
              <td className={tfNumClass}>{formatDecimal(totals.producaoTon)}</td>
              <td className={tfNumClass}>{totals.producaoTon && totals.areaTotalHa ? (totals.producaoTon / totals.areaTotalHa).toFixed(2) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <ProducaoCharts data={data as any} />
    </>
  );
};

const PecuariaTable = ({ filters }: { filters: Filters }) => {
  const { data = [], isLoading } = useReportData("pecuaria_provincia", filters);
  if (isLoading) return <LoadingRow />;
  if (data.length === 0) return <EmptyRow />;

  const totals = (data as any[]).reduce((acc, r) => ({
    bovinos: acc.bovinos + r.bovinos, caprinos: acc.caprinos + r.caprinos,
    suinos: acc.suinos + r.suinos, aves: acc.aves + r.aves,
    produtores: acc.produtores + r.produtores, leiteL: acc.leiteL + r.leiteL, ovosUn: acc.ovosUn + r.ovosUn,
  }), { bovinos: 0, caprinos: 0, suinos: 0, aves: 0, produtores: 0, leiteL: 0, ovosUn: 0 });

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Província</th>
            <th className={thClass}>Escola</th>
            <th className={cn(thClass, "text-right")}>Produtores</th>
            <th className={cn(thClass, "text-right")}>Bovinos</th>
            <th className={cn(thClass, "text-right")}>Caprinos</th>
            <th className={cn(thClass, "text-right")}>Suínos</th>
            <th className={cn(thClass, "text-right")}>Aves</th>
            <th className={cn(thClass, "text-right")}>Leite (L)</th>
            <th className={cn(thClass, "text-right")}>Ovos</th>
          </tr>
        </thead>
        <tbody>
          {(data as any[]).map((r, i) => (
            <tr key={i} className="hover:bg-muted/20">
              <td className={tdClass}>{r.provincia}</td>
              <td className={tdClass}>{r.escola}</td>
              <td className={tdNumClass}>{formatNumber(r.produtores)}</td>
              <td className={tdNumClass}>{formatNumber(r.bovinos)}</td>
              <td className={tdNumClass}>{formatNumber(r.caprinos)}</td>
              <td className={tdNumClass}>{formatNumber(r.suinos)}</td>
              <td className={tdNumClass}>{formatNumber(r.aves)}</td>
              <td className={tdNumClass}>{formatNumber(r.leiteL)}</td>
              <td className={tdNumClass}>{formatNumber(r.ovosUn)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={tfClass} colSpan={2}>TOTAL</td>
            <td className={tfNumClass}>{formatNumber(totals.produtores)}</td>
            <td className={tfNumClass}>{formatNumber(totals.bovinos)}</td>
            <td className={tfNumClass}>{formatNumber(totals.caprinos)}</td>
            <td className={tfNumClass}>{formatNumber(totals.suinos)}</td>
            <td className={tfNumClass}>{formatNumber(totals.aves)}</td>
            <td className={tfNumClass}>{formatNumber(totals.leiteL)}</td>
            <td className={tfNumClass}>{formatNumber(totals.ovosUn)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const AgricultoresTable = ({ filters }: { filters: Filters }) => {
  const { data = [], isLoading } = useReportData("agricultores_estado", filters);
  if (isLoading) return <LoadingRow />;
  if (data.length === 0) return <EmptyRow />;

  const totals = (data as any[]).reduce((acc, r) => ({
    ativo: acc.ativo + r.ativo, pendente: acc.pendente + r.pendente,
    suspenso: acc.suspenso + r.suspenso, validado: acc.validado + r.validado, total: acc.total + r.total,
  }), { ativo: 0, pendente: 0, suspenso: 0, validado: 0, total: 0 });

  return (
    <>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Província</th>
              <th className={cn(thClass, "text-right")}>Ativo</th>
              <th className={cn(thClass, "text-right")}>Pendente</th>
              <th className={cn(thClass, "text-right")}>Suspenso</th>
              <th className={cn(thClass, "text-right")}>Validado</th>
              <th className={cn(thClass, "text-right")}>Total</th>
              <th className={cn(thClass, "text-right")}>% Ativo</th>
            </tr>
          </thead>
          <tbody>
            {(data as any[]).map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className={tdClass}>{r.provincia}</td>
                <td className={tdNumClass}>{formatNumber(r.ativo)}</td>
                <td className={tdNumClass}>{formatNumber(r.pendente)}</td>
                <td className={tdNumClass}>{formatNumber(r.suspenso)}</td>
                <td className={tdNumClass}>{formatNumber(r.validado)}</td>
                <td className={tdNumClass}>{formatNumber(r.total)}</td>
                <td className={tdNumClass}>{r.total > 0 ? ((r.ativo / r.total) * 100).toFixed(1) : "0.0"}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={tfClass}>TOTAL</td>
              <td className={tfNumClass}>{formatNumber(totals.ativo)}</td>
              <td className={tfNumClass}>{formatNumber(totals.pendente)}</td>
              <td className={tfNumClass}>{formatNumber(totals.suspenso)}</td>
              <td className={tfNumClass}>{formatNumber(totals.validado)}</td>
              <td className={tfNumClass}>{formatNumber(totals.total)}</td>
              <td className={tfNumClass}>{totals.total > 0 ? ((totals.ativo / totals.total) * 100).toFixed(1) : "0.0"}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <AgricultoresCharts data={data as any} />
    </>
  );
};

const IncentivosTable = ({ filters }: { filters: Filters }) => {
  const { data = [], isLoading } = useReportData("incentivos_distribuidos", filters);
  if (isLoading) return <LoadingRow />;
  if (data.length === 0) return <EmptyRow />;

  const totals = (data as any[]).reduce((acc, r) => ({
    beneficiarios: acc.beneficiarios + r.beneficiarios,
    totalKz: acc.totalKz + r.totalKz,
    kitsEntregues: acc.kitsEntregues + r.kitsEntregues,
    sementesKg: acc.sementesKg + r.sementesKg,
  }), { beneficiarios: 0, totalKz: 0, kitsEntregues: 0, sementesKg: 0 });

  return (
    <>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Província</th>
              <th className={thClass}>Escola</th>
              <th className={cn(thClass, "text-right")}>Beneficiários</th>
              <th className={cn(thClass, "text-right")}>Total (Kz)</th>
              <th className={cn(thClass, "text-right")}>Kits Entregues</th>
              <th className={cn(thClass, "text-right")}>Sementes (kg)</th>
            </tr>
          </thead>
          <tbody>
            {(data as any[]).map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className={tdClass}>{r.provincia}</td>
                <td className={tdClass}>{r.escola}</td>
                <td className={tdNumClass}>{formatNumber(r.beneficiarios)}</td>
                <td className={tdNumClass}>{formatCurrency(r.totalKz)}</td>
                <td className={tdNumClass}>{formatNumber(r.kitsEntregues)}</td>
                <td className={tdNumClass}>{formatNumber(r.sementesKg)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={tfClass} colSpan={2}>TOTAL</td>
              <td className={tfNumClass}>{formatNumber(totals.beneficiarios)}</td>
              <td className={tfNumClass}>{formatCurrency(totals.totalKz)}</td>
              <td className={tfNumClass}>{formatNumber(totals.kitsEntregues)}</td>
              <td className={tfNumClass}>{formatNumber(totals.sementesKg)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <IncentivosCharts data={data as any} />
    </>
  );
};

const ComprasTable = ({ filters }: { filters: Filters }) => {
  const { data = [], isLoading } = useReportData("compras_transacoes", filters);
  if (isLoading) return <LoadingRow />;
  if (data.length === 0) return <EmptyRow />;

  const totals = (data as any[]).reduce((acc, r) => ({
    transacoes: acc.transacoes + r.transacoes,
    volumeKz: acc.volumeKz + r.volumeKz,
  }), { transacoes: 0, volumeKz: 0 });

  return (
    <>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Empresa</th>
              <th className={thClass}>Província</th>
              <th className={cn(thClass, "text-right")}>Transações</th>
              <th className={cn(thClass, "text-right")}>Volume (Kz)</th>
              <th className={thClass}>Produtos Comprados</th>
            </tr>
          </thead>
          <tbody>
            {(data as any[]).map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className={tdClass}>{r.empresa}</td>
                <td className={tdClass}>{r.provincia}</td>
                <td className={tdNumClass}>{formatNumber(r.transacoes)}</td>
                <td className={tdNumClass}>{formatCurrency(r.volumeKz)}</td>
                <td className={tdClass}>{r.produtosComprados}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={tfClass} colSpan={2}>TOTAL</td>
              <td className={tfNumClass}>{formatNumber(totals.transacoes)}</td>
              <td className={tfNumClass}>{formatCurrency(totals.volumeKz)}</td>
              <td className={tfClass}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <ComprasCharts data={data as any} />
    </>
  );
};

export default ReportPreview;
