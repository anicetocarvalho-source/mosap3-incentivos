import { Users, ThumbsUp, ArrowRightLeft, Building2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
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

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          <span className="text-primary font-medium">Dashboard</span> &gt; Administrador
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Registado"
          value="14.819"
          icon={Users}
          iconBg="hsl(160 50% 90%)"
        />
        <StatCard
          title="Total Aprovado"
          value="14.818"
          change="(Carteira Money)"
          changeType="neutral"
          icon={ThumbsUp}
          iconBg="hsl(160 50% 90%)"
        />
        <StatCard
          title="Total Transações"
          value="66.430"
          icon={ArrowRightLeft}
          iconBg="hsl(160 50% 90%)"
        />
        <StatCard
          title="Total Empresas"
          value="23"
          icon={Building2}
          iconBg="hsl(190 70% 90%)"
        />
      </div>

      {/* Volume */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold font-heading tracking-tight">2.138.548.919,33 AOA</p>
              <p className="text-sm text-primary font-semibold mt-1">Volume Movimentado</p>
            </div>
            <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "hsl(160 50% 90%)" }}>
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Province Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-6">
            <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-6">
              Produtores Registados por Província
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={provinceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
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

        {/* Gender Pie Chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6">
            <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-6">
              Produtores Registados por Género
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  dataKey="value"
                  label={({ name, value }) => `${value}%`}
                  labelLine={false}
                >
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

      {/* Transaction History */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="p-6">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-6">
            Histórico de Transações Realizadas
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={transactionHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
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
  );
};

export default Dashboard;
