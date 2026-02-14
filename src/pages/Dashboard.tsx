import { Users, ThumbsUp, ArrowRightLeft, Building2, TrendingUp, School, MapPin, Wheat, ShoppingCart, Gift, Beef, Filter, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/hooks/useDashboardData";

const PROVINCE_COLORS = [
  "hsl(65, 70%, 40%)", "hsl(55, 90%, 55%)", "hsl(210, 80%, 55%)",
  "hsl(30, 60%, 45%)", "hsl(0, 65%, 60%)", "hsl(160, 50%, 40%)",
  "hsl(280, 50%, 50%)", "hsl(190, 70%, 45%)",
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
  n.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AOA";

const Dashboard = () => {
  const { roles } = useAuth();
  const { data: stats, isLoading } = useDashboardData();
  const roleName = roles.length > 0 ? (roleLabels[roles[0]] ?? roles[0]) : "Utilizador";

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="page-title text-lg md:text-2xl">Dashboard</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">
            <span className="text-primary font-medium">Dashboard</span> &gt; {roleName}
          </p>
        </div>
        {stats.filterScope !== "global" && (
          <Badge variant="outline" className="flex items-center gap-1.5 text-xs w-fit">
            <Filter className="h-3 w-3" />
            {stats.filterScope === "province" ? "Províncias" : "ECAs"}: {stats.filterLabel}
          </Badge>
        )}
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Registado" value={formatNumber(stats.totalFarmers)} icon={Users} iconBg="hsl(160 50% 90%)" />
        <StatCard title="Total Aprovado" value={formatNumber(stats.totalApproved)} icon={ThumbsUp} iconBg="hsl(160 50% 90%)" />
        <StatCard title="Total Transações" value={formatNumber(stats.totalTransactions)} icon={ArrowRightLeft} iconBg="hsl(160 50% 90%)" />
        <StatCard title="Total Empresas" value={formatNumber(stats.totalCompanies)} icon={Building2} iconBg="hsl(190 70% 90%)" />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Escolas de Campo" value={formatNumber(stats.totalSchools)} icon={School} iconBg="hsl(45 90% 88%)" />
        <StatCard title="Parcelas Registadas" value={formatNumber(stats.totalParcels)} change={`${formatNumber(stats.totalAreaHa)} ha total`} changeType="neutral" icon={MapPin} iconBg="hsl(130 40% 90%)" />
        <StatCard title="Produção (ton)" value={formatNumber(stats.totalProduction)} icon={Wheat} iconBg="hsl(38 80% 88%)" />
        <StatCard title="Efectivo Pecuário" value={formatNumber(stats.totalLivestock)} change={`${formatNumber(stats.totalLivestockProducers)} produtores`} changeType="neutral" icon={Beef} iconBg="hsl(25 70% 90%)" />
      </div>

      {/* Volume */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg md:text-3xl font-bold font-heading tracking-tight truncate">{formatCurrency(stats.volumeTransactions)}</p>
              <p className="text-xs md:text-sm text-primary font-semibold mt-1">Volume Movimentado</p>
            </div>
            <div className="h-10 w-10 md:h-14 md:w-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "hsl(160 50% 90%)" }}>
              <TrendingUp className="h-5 w-5 md:h-7 md:w-7 text-primary" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Farmers by Province */}
        {stats.farmersByProvince.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="p-4 md:p-6">
              <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
                Produtores por Província
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.farmersByProvince}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip />
                  <Bar dataKey="value" name="Produtores" radius={[4, 4, 0, 0]}>
                    {stats.farmersByProvince.map((_, i) => (
                      <Cell key={i} fill={PROVINCE_COLORS[i % PROVINCE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}

        {/* Gender */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
              Produtores por Género
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={stats.genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ value }) => `${value}%`} labelLine={false}>
                  {stats.genderData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Production by Culture */}
        {stats.productionByCulture.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="p-4 md:p-6">
              <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
                Produção por Cultura (ton)
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.productionByCulture} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={65} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="area" name="Área (ha)" fill="hsl(210, 70%, 55%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="producao" name="Produção (ton)" fill="hsl(130, 55%, 40%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}

        {/* Livestock by Species */}
        {stats.livestockBySpecies.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="p-4 md:p-6">
              <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
                Efectivo Pecuário por Espécie
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.livestockBySpecies}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="quantidade" name="Cabeças" fill="hsl(25, 65%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="produtores" name="Produtores" fill="hsl(45, 80%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Transactions by Province */}
      {stats.transactionsByProvince.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
              Transações por Província
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.transactionsByProvince}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Bar dataKey="value" name="Transações" radius={[4, 4, 0, 0]}>
                  {stats.transactionsByProvince.map((_, i) => (
                    <Cell key={i} fill={PROVINCE_COLORS[i % PROVINCE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {stats.totalFarmers === 0 && (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading font-semibold text-lg mb-1">Sem dados disponíveis</h3>
          <p className="text-muted-foreground text-sm">
            {stats.filterScope === "global"
              ? "Ainda não existem produtores registados no sistema."
              : `Não existem produtores registados na(s) ${stats.filterScope === "province" ? "província(s)" : "ECA(s)"} atribuída(s) ao seu perfil.`}
          </p>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
