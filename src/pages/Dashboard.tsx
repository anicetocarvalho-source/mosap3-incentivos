import { Users, ThumbsUp, ArrowRightLeft, Building2, TrendingUp, School, MapPin, Wheat, ShoppingCart, Gift, AlertTriangle, CheckCircle2, Clock, Beef } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";

const provinceData = [
  { name: "Benguela", value: 35200 },
  { name: "Cunene", value: 1800 },
  { name: "Namibe", value: 2500 },
  { name: "Huila", value: 11500 },
  { name: "Cuando Cubango", value: 6200 },
];

const provinceColors = ["hsl(65, 70%, 40%)", "hsl(55, 90%, 55%)", "hsl(210, 80%, 55%)", "hsl(30, 60%, 45%)", "hsl(0, 65%, 60%)"];

const genderData = [
  { name: "Masculino", value: 54.6, color: "hsl(65, 70%, 40%)" },
  { name: "Feminino", value: 45.4, color: "hsl(0, 60%, 55%)" },
];

const transactionHistory = [
  { name: "Benguela", value: 35400 },
  { name: "Cunene", value: 1900 },
  { name: "Namibe", value: 2600 },
  { name: "Huila", value: 11200 },
  { name: "Cuando Cubango", value: 6800 },
];

const monthlyRegistrations = [
  { month: "Set", registados: 1200, aprovados: 1150 },
  { month: "Out", registados: 1850, aprovados: 1790 },
  { month: "Nov", registados: 2100, aprovados: 2050 },
  { month: "Dez", registados: 1600, aprovados: 1580 },
  { month: "Jan", registados: 2400, aprovados: 2350 },
  { month: "Fev", registados: 1950, aprovados: 1900 },
];

const productionByCulture = [
  { name: "Milho", area: 4200, producao: 8400 },
  { name: "Feijão", area: 2800, producao: 3920 },
  { name: "Mandioca", area: 3500, producao: 14000 },
  { name: "Amendoim", area: 1200, producao: 1440 },
  { name: "Soja", area: 800, producao: 1280 },
  { name: "Batata-doce", area: 1500, producao: 6000 },
];

const livestockBySpecies = [
  { name: "Bovinos", quantidade: 4250, produtores: 1820 },
  { name: "Caprinos", quantidade: 6800, produtores: 2450 },
  { name: "Suínos", quantidade: 3100, produtores: 1200 },
  { name: "Aves", quantidade: 28500, produtores: 5600 },
  { name: "Ovinos", quantidade: 2200, produtores: 890 },
];

const incentivesByMonth = [
  { month: "Set", distribuido: 45000000, gasto: 38000000 },
  { month: "Out", distribuido: 52000000, gasto: 44000000 },
  { month: "Nov", distribuido: 48000000, gasto: 41000000 },
  { month: "Dez", distribuido: 60000000, gasto: 55000000 },
  { month: "Jan", distribuido: 55000000, gasto: 48000000 },
  { month: "Fev", distribuido: 42000000, gasto: 35000000 },
];

const recentActivities = [
  { action: "Novo produtor registado", detail: "João Manuel Silva — Benguela, Caimbambo", time: "Há 2 horas", type: "register" },
  { action: "Incentivo distribuído", detail: "45.000 Kz — EC Caimbambo (12 produtores)", time: "Há 3 horas", type: "incentive" },
  { action: "Compra subsidiada", detail: "Fertilizante NPK — AgriPlus Lda", time: "Há 5 horas", type: "purchase" },
  { action: "Visita técnica registada", detail: "EC Longonjo — Ana Pereira (32 presentes)", time: "Há 6 horas", type: "visit" },
  { action: "Colheita finalizada", detail: "Francisco Lopes — 2.0 ha de Milho", time: "Há 8 horas", type: "harvest" },
  { action: "Nova escola criada", detail: "EC Sumbe — Cuanza Sul", time: "Há 1 dia", type: "school" },
];

const topProvinces = [
  { name: "Benguela", farmers: 35200, schools: 5, progress: 85 },
  { name: "Huambo", farmers: 18400, schools: 6, progress: 72 },
  { name: "Huíla", farmers: 11500, schools: 5, progress: 65 },
  { name: "Cuanza Sul", farmers: 8900, schools: 5, progress: 58 },
  { name: "Bié", farmers: 6200, schools: 4, progress: 45 },
];

const Dashboard = () => {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title text-lg md:text-2xl">Dashboard</h1>
        <p className="text-muted-foreground text-xs md:text-sm mt-1">
          <span className="text-primary font-medium">Dashboard</span> &gt; Administrador
        </p>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Total Registado" value="14.819" icon={Users} iconBg="hsl(160 50% 90%)" />
        <StatCard title="Total Aprovado" value="14.818" change="(Carteira Money)" changeType="neutral" icon={ThumbsUp} iconBg="hsl(160 50% 90%)" />
        <StatCard title="Total Transações" value="66.430" icon={ArrowRightLeft} iconBg="hsl(160 50% 90%)" />
        <StatCard title="Total Empresas" value="23" icon={Building2} iconBg="hsl(190 70% 90%)" />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Escolas de Campo" value="72" change="+4 este mês" changeType="positive" icon={School} iconBg="hsl(45 90% 88%)" />
        <StatCard title="Parcelas Registadas" value="9.245" change="12.850 ha total" changeType="neutral" icon={MapPin} iconBg="hsl(130 40% 90%)" />
        <StatCard title="Produção (ton)" value="35.040" change="+12% vs anterior" changeType="positive" icon={Wheat} iconBg="hsl(38 80% 88%)" />
        <StatCard title="Efectivo Pecuário" value="44.850" change="11.960 produtores" changeType="neutral" icon={Beef} iconBg="hsl(25 70% 90%)" />
      </div>

      {/* Volume */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg md:text-3xl font-bold font-heading tracking-tight truncate">2.138.548.919,33 AOA</p>
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
              Produtores por Província
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={provinceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Bar dataKey="value" name="Produtores" radius={[4, 4, 0, 0]}>
                  {provinceData.map((_, index) => (
                    <Cell key={index} fill={provinceColors[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
              Produtores por Género
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ value }) => `${value}%`} labelLine={false}>
                  {genderData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
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
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
              Evolução de Registos Mensais
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyRegistrations}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="registados" name="Registados" stroke="hsl(130, 55%, 30%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="aprovados" name="Aprovados" stroke="hsl(45, 95%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
              Produção por Cultura (ton)
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productionByCulture} layout="vertical">
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
      </div>

      {/* Pecuária Chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
        <Card className="p-4 md:p-6">
          <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
            Efectivo Pecuário por Espécie
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={livestockBySpecies}>
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

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
              Incentivos — Distribuído vs Gasto
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={incentivesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={35} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(value: number) => `${(value / 1000000).toFixed(1)}M Kz`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="distribuido" name="Distribuído" stroke="hsl(130, 55%, 30%)" fill="hsl(130, 55%, 30%)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="gasto" name="Gasto" stroke="hsl(0, 60%, 55%)" fill="hsl(0, 60%, 55%)" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4 md:mb-6">
              Histórico de Transações
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={transactionHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" name="Transações" radius={[4, 4, 0, 0]}>
                  {transactionHistory.map((_, index) => (
                    <Cell key={index} fill={provinceColors[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4">
              Top Províncias por Cobertura
            </h2>
            <div className="space-y-3 md:space-y-4">
              {topProvinces.map((prov) => (
                <div key={prov.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="font-medium">{prov.name}</span>
                    <span className="text-muted-foreground text-[10px] md:text-xs">{prov.farmers.toLocaleString()} prod. • {prov.schools} esc.</span>
                  </div>
                  <Progress value={prov.progress} className="h-2" />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="p-4 md:p-6">
            <h2 className="font-heading font-semibold text-xs md:text-sm uppercase tracking-wider text-muted-foreground mb-4">
              Actividade Recente
            </h2>
            <div className="space-y-2.5 md:space-y-3">
              {recentActivities.map((activity, i) => (
                <div key={i} className="flex items-start gap-2.5 md:gap-3 pb-2.5 md:pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className={`h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    activity.type === "register" ? "bg-accent" :
                    activity.type === "incentive" ? "bg-secondary/20" :
                    activity.type === "purchase" ? "bg-muted" :
                    activity.type === "visit" ? "bg-accent" :
                    activity.type === "harvest" ? "bg-secondary/20" :
                    "bg-muted"
                  }`}>
                    {activity.type === "register" && <Users className="h-3.5 w-3.5 text-primary" />}
                    {activity.type === "incentive" && <Gift className="h-3.5 w-3.5 text-secondary-foreground" />}
                    {activity.type === "purchase" && <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />}
                    {activity.type === "visit" && <School className="h-3.5 w-3.5 text-primary" />}
                    {activity.type === "harvest" && <Wheat className="h-3.5 w-3.5 text-secondary-foreground" />}
                    {activity.type === "school" && <MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium">{activity.action}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground truncate">{activity.detail}</p>
                  </div>
                  <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
