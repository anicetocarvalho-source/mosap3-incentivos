import { Users, ThumbsUp, ArrowRightLeft, Building2, School, MapPin, Wheat, Beef, Loader2, BarChart3, PieChart as PieIcon, Activity, Sprout, Target, Gauge, AlertTriangle, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/hooks/useDashboardData";
import HeroHeader from "@/components/dashboard/HeroHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import ChartCard from "@/components/dashboard/ChartCard";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

const PROVINCE_COLORS = [
  "hsl(130, 55%, 35%)", "hsl(45, 90%, 50%)", "hsl(210, 75%, 50%)",
  "hsl(25, 75%, 50%)", "hsl(340, 65%, 55%)", "hsl(165, 55%, 40%)",
  "hsl(280, 50%, 55%)", "hsl(190, 70%, 45%)",
];

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  gestor_incentivos: "Gestor de Incentivos",
  senior_agricultura: "Sénior Agricultura",
  senior_monitoria: "Sénior Monitoria",
  junior_monitoria: "Júnior Monitoria",
  junior_agricultura: "Júnior Agricultura",
  senior_agronegocio: "Sénior Agronegócio",
  junior_agronegocio: "Júnior Agronegócio",
  tecnico_extensionista: "Técnico Extensionista",
};

const formatNumber = (n: number) =>
  n.toLocaleString("pt-AO", { maximumFractionDigits: 1 });

const formatCurrency = (n: number) =>
  n.toLocaleString("pt-AO", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " AOA";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "12px",
  boxShadow: "var(--shadow-elevated)",
};

const Dashboard = () => {
  const { roles } = useAuth();
  const { data: stats, isLoading, isError, refetch } = useDashboardData();
  const navigate = useNavigate();
  const roleName = roles.length > 0 ? (roleLabels[roles[0]] ?? roles[0]) : "Utilizador";

  if (isLoading || (!stats && !isError)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">A carregar painel…</p>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Hero */}
      <HeroHeader
        roleName={roleName}
        filterScope={stats.filterScope}
        filterLabel={stats.filterLabel}
        volumeFormatted={formatCurrency(stats.volumeTransactions)}
      />

      {/* KPIs principais (Produtores) */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Produtores & Operação
        </p>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard title="Total Registado" value={formatNumber(stats.totalFarmers)} icon={Users} accent="primary" delay={0.05} />
          <KpiCard title="Total Aprovado" value={formatNumber(stats.totalApproved)} icon={ThumbsUp} accent="success" delay={0.1} />
          <KpiCard title="Transações" value={formatNumber(stats.totalTransactions)} icon={ArrowRightLeft} accent="info" delay={0.15} />
          <KpiCard title="Empresas" value={formatNumber(stats.totalCompanies)} icon={Building2} accent="secondary" delay={0.2} />
        </div>
      </div>

      {/* KPIs Impacto & Eficiência */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Impacto & Eficiência
        </p>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard
            title="Utilização Incentivos"
            value={`${formatNumber(stats.utilizationRate)}%`}
            subtitle={`${formatCurrency(stats.totalGasto)} de ${formatCurrency(stats.totalRecebido)}`}
            icon={Target}
            accent={stats.utilizationRate >= 70 ? "success" : stats.utilizationRate >= 40 ? "warning" : "destructive"}
            delay={0.05}
          />
          <KpiCard
            title="Produtividade Média"
            value={`${formatNumber(stats.avgYieldPerHa)} kg/ha`}
            subtitle="Rendimento agronómico"
            icon={Gauge}
            accent="info"
            delay={0.1}
          />
          <KpiCard
            title="Volume POS"
            value={formatCurrency(stats.volumeTransactions)}
            subtitle={`${formatNumber(stats.totalTransactions)} transações`}
            icon={TrendingUp}
            accent="primary"
            delay={0.15}
          />
          <KpiCard
            title="Stock Crítico"
            value={formatNumber(stats.criticalStockCount)}
            subtitle={stats.criticalStockCount > 10 ? "Atenção: rupturas iminentes" : "Níveis estáveis"}
            icon={AlertTriangle}
            accent={stats.criticalStockCount > 10 ? "destructive" : stats.criticalStockCount > 0 ? "warning" : "success"}
            delay={0.2}
          />
        </div>
      </div>

      {/* KPIs Agricultura */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Agricultura & Pecuária
        </p>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard title="Escolas de Campo" value={formatNumber(stats.totalSchools)} icon={School} accent="warning" delay={0.05} />
          <KpiCard
            title="Parcelas"
            value={formatNumber(stats.totalParcels)}
            subtitle={`${formatNumber(stats.totalAreaHa)} ha total`}
            icon={MapPin}
            accent="success"
            delay={0.1}
          />
          <KpiCard title="Produção (ton)" value={formatNumber(stats.totalProduction)} icon={Wheat} accent="secondary" delay={0.15} />
          <KpiCard
            title="Pecuário"
            value={formatNumber(stats.totalLivestock)}
            subtitle={`${formatNumber(stats.totalLivestockProducers)} produtores`}
            icon={Beef}
            accent="destructive"
            delay={0.2}
          />
        </div>
      </div>

      {/* Funil do Incentivo + Tendência POS */}
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <ChartCard
          title="Funil de Conversão do Incentivo"
          description="Atribuído → Recebido → Gasto → Reconciliado (AOA)"
          icon={Target}
          delay={0.1}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.incentiveFunnel} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={100} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" name="Valor" radius={[0, 6, 6, 0]}>
                {stats.incentiveFunnel.map((_, i) => (
                  <Cell key={i} fill={["hsl(210, 75%, 55%)", "hsl(165, 55%, 40%)", "hsl(45, 90%, 50%)", "hsl(130, 55%, 35%)"][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Evolução das Vendas POS"
          description="Volume mensal nos últimos 12 meses (AOA)"
          icon={TrendingUp}
          delay={0.15}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stats.posSalesTrend} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              <defs>
                <linearGradient id="posGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(130, 55%, 40%)" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="hsl(130, 55%, 40%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="valor" name="Volume" stroke="hsl(130, 55%, 40%)" strokeWidth={2} fill="url(#posGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
        {stats.farmersByProvince.length > 0 && (
          <div className="lg:col-span-2">
            <ChartCard
              title="Produtores por Província"
              description="Distribuição geográfica do registo"
              icon={BarChart3}
              delay={0.1}
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.farmersByProvince} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-25} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                  <Bar dataKey="value" name="Produtores" radius={[6, 6, 0, 0]}>
                    {stats.farmersByProvince.map((_, i) => (
                      <Cell key={i} fill={PROVINCE_COLORS[i % PROVINCE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        <ChartCard
          title="Distribuição por Género"
          description="Equidade no registo"
          icon={PieIcon}
          delay={0.15}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.genderData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                label={({ value }) => `${value}%`}
                labelLine={false}
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {stats.genderData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        {stats.productionByCulture.length > 0 && (
          <ChartCard
            title="Produção por Cultura"
            description="Área cultivada e produção em toneladas"
            icon={Sprout}
            delay={0.2}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.productionByCulture} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={75} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="area" name="Área (ha)" fill="hsl(210, 75%, 55%)" radius={[0, 6, 6, 0]} />
                <Bar dataKey="producao" name="Produção (ton)" fill="hsl(130, 55%, 40%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {stats.livestockBySpecies.length > 0 && (
          <ChartCard
            title="Efectivo Pecuário"
            description="Cabeças e produtores por espécie"
            icon={Activity}
            delay={0.25}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.livestockBySpecies} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="quantidade" name="Cabeças" fill="hsl(25, 75%, 50%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="produtores" name="Produtores" fill="hsl(45, 90%, 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Transactions by Province */}
      {stats.transactionsByProvince.length > 0 && (
        <ChartCard
          title="Transações por Província"
          description="Volume de movimentação no MOSAP3Pay"
          icon={ArrowRightLeft}
          delay={0.3}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.transactionsByProvince} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-25} textAnchor="end" height={60} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
              <Bar dataKey="value" name="Transações" radius={[6, 6, 0, 0]}>
                {stats.transactionsByProvince.map((_, i) => (
                  <Cell key={i} fill={PROVINCE_COLORS[i % PROVINCE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Empty state */}
      {stats.totalFarmers === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card">
          <EmptyState
            icon={Users}
            title="Sem dados disponíveis"
            description={
              stats.filterScope === "global"
                ? "Ainda não existem produtores registados no sistema. Comece por cadastrar o primeiro produtor."
                : `Não existem produtores registados na(s) ${stats.filterScope === "province" ? "província(s)" : "ECA(s)"} atribuída(s) ao seu perfil.`
            }
            action={
              stats.filterScope === "global"
                ? { label: "Cadastrar primeiro produtor", onClick: () => navigate("/agricultores") }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
