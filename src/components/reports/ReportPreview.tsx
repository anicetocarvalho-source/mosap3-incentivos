import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import mosapLogo from "@/assets/mosap3-logo.png";
import { ProducaoCharts, AgricultoresCharts, IncentivosCharts, ComprasCharts } from "./ReportCharts";

type Filters = {
  provincia: string;
  municipio: string;
  escola: string;
  estado: string;
  dateFrom?: Date;
  dateTo?: Date;
};

type Props = {
  reportType: string;
  reportLabel: string;
  filters: Filters;
};

// Mock data generators per report type
const generateProducaoData = (filters: Filters) => {
  const rows = [
    { provincia: "Benguela", escola: "EC Caimbambo", agricultores: 245, parcelas: 412, areaTotalHa: 890.5, producaoTon: 4520.3, mediaHa: 5.08 },
    { provincia: "Benguela", escola: "EC Lobito", agricultores: 180, parcelas: 290, areaTotalHa: 620.0, producaoTon: 3100.0, mediaHa: 5.0 },
    { provincia: "Benguela", escola: "EC Ganda", agricultores: 150, parcelas: 230, areaTotalHa: 510.2, producaoTon: 2450.8, mediaHa: 4.8 },
    { provincia: "Huambo", escola: "EC Longonjo", agricultores: 310, parcelas: 520, areaTotalHa: 1150.0, producaoTon: 6200.5, mediaHa: 5.39 },
    { provincia: "Huambo", escola: "EC Bailundo", agricultores: 200, parcelas: 350, areaTotalHa: 780.3, producaoTon: 3800.0, mediaHa: 4.87 },
    { provincia: "Bié", escola: "EC Cuemba", agricultores: 190, parcelas: 310, areaTotalHa: 700.8, producaoTon: 3400.2, mediaHa: 4.86 },
    { provincia: "Huíla", escola: "EC Lubango", agricultores: 220, parcelas: 380, areaTotalHa: 850.0, producaoTon: 4100.0, mediaHa: 4.82 },
    { provincia: "Malanje", escola: "EC Cacuso", agricultores: 170, parcelas: 270, areaTotalHa: 590.5, producaoTon: 2800.0, mediaHa: 4.75 },
  ];
  let filtered = rows;
  if (filters.provincia && filters.provincia !== "all") filtered = filtered.filter(r => r.provincia === filters.provincia);
  if (filters.escola && filters.escola !== "all") filtered = filtered.filter(r => r.escola === filters.escola);
  return filtered;
};

const generateAgricultoresData = (filters: Filters) => {
  const rows = [
    { provincia: "Benguela", ativo: 420, pendente: 35, suspenso: 12, validado: 108, total: 575 },
    { provincia: "Huambo", ativo: 380, pendente: 42, suspenso: 8, validado: 80, total: 510 },
    { provincia: "Bié", ativo: 150, pendente: 18, suspenso: 5, validado: 17, total: 190 },
    { provincia: "Huíla", ativo: 190, pendente: 22, suspenso: 3, validado: 5, total: 220 },
    { provincia: "Malanje", ativo: 140, pendente: 15, suspenso: 4, validado: 11, total: 170 },
  ];
  let filtered = rows;
  if (filters.provincia && filters.provincia !== "all") filtered = filtered.filter(r => r.provincia === filters.provincia);
  return filtered;
};

const generateIncentivosData = (filters: Filters) => {
  const rows = [
    { provincia: "Benguela", escola: "EC Caimbambo", beneficiarios: 210, totalKz: 45200000, kitsEntregues: 198, sementesKg: 2400 },
    { provincia: "Benguela", escola: "EC Lobito", beneficiarios: 155, totalKz: 33100000, kitsEntregues: 148, sementesKg: 1800 },
    { provincia: "Huambo", escola: "EC Longonjo", beneficiarios: 280, totalKz: 62000000, kitsEntregues: 265, sementesKg: 3200 },
    { provincia: "Huambo", escola: "EC Bailundo", beneficiarios: 175, totalKz: 38000000, kitsEntregues: 170, sementesKg: 2100 },
    { provincia: "Bié", escola: "EC Cuemba", beneficiarios: 160, totalKz: 34000000, kitsEntregues: 152, sementesKg: 1900 },
    { provincia: "Huíla", escola: "EC Lubango", beneficiarios: 195, totalKz: 41000000, kitsEntregues: 188, sementesKg: 2300 },
    { provincia: "Malanje", escola: "EC Cacuso", beneficiarios: 140, totalKz: 28000000, kitsEntregues: 132, sementesKg: 1600 },
  ];
  let filtered = rows;
  if (filters.provincia && filters.provincia !== "all") filtered = filtered.filter(r => r.provincia === filters.provincia);
  if (filters.escola && filters.escola !== "all") filtered = filtered.filter(r => r.escola === filters.escola);
  return filtered;
};

const generateComprasData = (filters: Filters) => {
  const rows = [
    { empresa: "AgroTech Angola", provincia: "Benguela", transacoes: 145, volumeKz: 89500000, produtosComprados: "Milho, Feijão" },
    { empresa: "Campo Verde", provincia: "Huambo", transacoes: 210, volumeKz: 125000000, produtosComprados: "Milho, Soja, Mandioca" },
    { empresa: "Agri-Sul", provincia: "Huíla", transacoes: 95, volumeKz: 52000000, produtosComprados: "Feijão, Batata" },
    { empresa: "Sementes Plus", provincia: "Bié", transacoes: 78, volumeKz: 38000000, produtosComprados: "Milho, Feijão" },
    { empresa: "AgroNorte", provincia: "Malanje", transacoes: 62, volumeKz: 29000000, produtosComprados: "Mandioca, Amendoim" },
    { empresa: "CerealAngola", provincia: "Benguela", transacoes: 120, volumeKz: 72000000, produtosComprados: "Milho, Soja" },
  ];
  let filtered = rows;
  if (filters.provincia && filters.provincia !== "all") filtered = filtered.filter(r => r.provincia === filters.provincia);
  return filtered;
};

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-AO", { style: "decimal", minimumFractionDigits: 0 }).format(v) + " Kz";
const formatNumber = (v: number) => new Intl.NumberFormat("pt-AO").format(v);

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
              <img src={mosapLogo} alt="MOSAP3" className="h-12 w-auto" />
              <div>
                <h2 className="font-heading font-bold text-base">MOSAP3 — Sistema de Gestão Agrícola</h2>
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

const ProducaoTable = ({ filters }: { filters: Filters }) => {
  const data = generateProducaoData(filters);
  const totals = data.reduce((acc, r) => ({
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
            {data.map((r, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className={tdClass}>{r.provincia}</td>
                <td className={tdClass}>{r.escola}</td>
                <td className={tdNumClass}>{formatNumber(r.agricultores)}</td>
                <td className={tdNumClass}>{formatNumber(r.parcelas)}</td>
                <td className={tdNumClass}>{formatNumber(r.areaTotalHa)}</td>
                <td className={tdNumClass}>{formatNumber(r.producaoTon)}</td>
                <td className={tdNumClass}>{r.mediaHa.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={tfClass} colSpan={2}>TOTAL</td>
              <td className={tfNumClass}>{formatNumber(totals.agricultores)}</td>
              <td className={tfNumClass}>{formatNumber(totals.parcelas)}</td>
              <td className={tfNumClass}>{formatNumber(totals.areaTotalHa)}</td>
              <td className={tfNumClass}>{formatNumber(totals.producaoTon)}</td>
              <td className={tfNumClass}>{totals.producaoTon && totals.areaTotalHa ? (totals.producaoTon / totals.areaTotalHa).toFixed(2) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <ProducaoCharts data={data} />
    </>
  );
};

const generatePecuariaData = (filters: Filters) => {
  const rows = [
    { provincia: "Benguela", escola: "EC Caimbambo", bovinos: 320, caprinos: 480, suinos: 150, aves: 2800, produtores: 145, leiteL: 4800, ovosUn: 18500 },
    { provincia: "Benguela", escola: "EC Lobito", bovinos: 180, caprinos: 310, suinos: 90, aves: 1500, produtores: 95, leiteL: 2700, ovosUn: 9800 },
    { provincia: "Huambo", escola: "EC Longonjo", bovinos: 450, caprinos: 620, suinos: 200, aves: 3500, produtores: 210, leiteL: 6800, ovosUn: 22000 },
    { provincia: "Huambo", escola: "EC Bailundo", bovinos: 280, caprinos: 390, suinos: 120, aves: 2200, produtores: 140, leiteL: 4200, ovosUn: 14500 },
    { provincia: "Bié", escola: "EC Cuemba", bovinos: 350, caprinos: 520, suinos: 180, aves: 3000, produtores: 165, leiteL: 5300, ovosUn: 19800 },
    { provincia: "Huíla", escola: "EC Lubango", bovinos: 520, caprinos: 700, suinos: 250, aves: 4200, produtores: 195, leiteL: 7800, ovosUn: 27500 },
    { provincia: "Malanje", escola: "EC Cacuso", bovinos: 200, caprinos: 340, suinos: 100, aves: 1800, produtores: 110, leiteL: 3000, ovosUn: 11800 },
  ];
  let filtered = rows;
  if (filters.provincia && filters.provincia !== "all") filtered = filtered.filter(r => r.provincia === filters.provincia);
  if (filters.escola && filters.escola !== "all") filtered = filtered.filter(r => r.escola === filters.escola);
  return filtered;
};

const PecuariaTable = ({ filters }: { filters: Filters }) => {
  const data = generatePecuariaData(filters);
  const totals = data.reduce((acc, r) => ({
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
          {data.map((r, i) => (
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
  const data = generateAgricultoresData(filters);
  const totals = data.reduce((acc, r) => ({
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
          {data.map((r, i) => (
            <tr key={i} className="hover:bg-muted/20">
              <td className={tdClass}>{r.provincia}</td>
              <td className={tdNumClass}>{formatNumber(r.ativo)}</td>
              <td className={tdNumClass}>{formatNumber(r.pendente)}</td>
              <td className={tdNumClass}>{formatNumber(r.suspenso)}</td>
              <td className={tdNumClass}>{formatNumber(r.validado)}</td>
              <td className={tdNumClass}>{formatNumber(r.total)}</td>
              <td className={tdNumClass}>{((r.ativo / r.total) * 100).toFixed(1)}%</td>
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
            <td className={tfNumClass}>{((totals.ativo / totals.total) * 100).toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <AgricultoresCharts data={data} />
    </>
  );
};

const IncentivosTable = ({ filters }: { filters: Filters }) => {
  const data = generateIncentivosData(filters);
  const totals = data.reduce((acc, r) => ({
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
          {data.map((r, i) => (
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
    <IncentivosCharts data={data} />
    </>
  );
};

const ComprasTable = ({ filters }: { filters: Filters }) => {
  const data = generateComprasData(filters);
  const totals = data.reduce((acc, r) => ({
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
          {data.map((r, i) => (
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
    <ComprasCharts data={data} />
    </>
  );
};

export default ReportPreview;
