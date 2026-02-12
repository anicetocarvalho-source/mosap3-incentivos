import { Users, School, Gift, TrendingUp, MapPin, ShoppingCart, Wheat, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";
import { Card } from "@/components/ui/card";

const recentFarmers = [
  { name: "João Mateus", province: "Benguela", school: "EC Caimbambo", status: "Ativo", date: "12/02/2026" },
  { name: "Maria Silva", province: "Huambo", school: "EC Longonjo", status: "Pendente", date: "11/02/2026" },
  { name: "Pedro Neto", province: "Bié", school: "EC Cuemba", status: "Ativo", date: "10/02/2026" },
  { name: "Ana Luísa", province: "Benguela", school: "EC Lobito", status: "Ativo", date: "09/02/2026" },
  { name: "Carlos Manuel", province: "Huambo", school: "EC Bailundo", status: "Suspenso", date: "08/02/2026" },
];

const recentIncentives = [
  { farmer: "João Mateus", amount: "45.000 Kz", type: "Insumos", status: "Pago", date: "12/02/2026" },
  { farmer: "Maria Silva", amount: "30.000 Kz", type: "Sementes", status: "Pendente", date: "11/02/2026" },
  { farmer: "Pedro Neto", amount: "60.000 Kz", type: "Mecanização", status: "Pago", date: "10/02/2026" },
  { farmer: "Ana Luísa", amount: "25.000 Kz", type: "Fertilizantes", status: "Processando", date: "09/02/2026" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Painel de Controlo</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema de gestão de incentivos MOSAP3</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Agricultores"
          value="12.458"
          change="+234 este mês"
          changeType="positive"
          icon={Users}
        />
        <StatCard
          title="Escolas de Campo"
          value="386"
          change="+12 novas"
          changeType="positive"
          icon={School}
          iconBg="hsl(var(--secondary))"
        />
        <StatCard
          title="Incentivos Distribuídos"
          value="2.4B Kz"
          change="+18% vs mês anterior"
          changeType="positive"
          icon={Gift}
          iconBg="hsl(var(--success) / 0.15)"
        />
        <StatCard
          title="Parcelas Registadas"
          value="8.921"
          change="45.230 hectares"
          changeType="neutral"
          icon={MapPin}
          iconBg="hsl(var(--info) / 0.15)"
        />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Farmers */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-heading font-semibold text-lg">Agricultores Recentes</h2>
              <span className="text-xs text-muted-foreground">Últimos 5 registos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Província</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFarmers.map((f, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{f.school}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{f.province}</td>
                      <td className="px-4 py-3">
                        <span className={
                          f.status === "Ativo" ? "badge-active" :
                          f.status === "Pendente" ? "badge-pending" : "badge-suspended"
                        }>{f.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Recent Incentives */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-heading font-semibold text-lg">Incentivos Recentes</h2>
              <span className="text-xs text-muted-foreground">Últimos pagamentos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Agricultor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIncentives.map((inc, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <div>
                          <p className="font-medium">{inc.farmer}</p>
                          <p className="text-xs text-muted-foreground">{inc.type}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{inc.amount}</td>
                      <td className="px-4 py-3">
                        <span className={
                          inc.status === "Pago" ? "badge-active" :
                          inc.status === "Pendente" ? "badge-pending" : "badge-suspended"
                        }>{inc.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Provinces quick stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Distribuição por Província</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: "Benguela", farmers: 3240, pct: 26 },
              { name: "Huambo", farmers: 2890, pct: 23 },
              { name: "Bié", farmers: 2150, pct: 17 },
              { name: "Huíla", farmers: 1680, pct: 14 },
              { name: "Malanje", farmers: 1320, pct: 11 },
              { name: "Outras", farmers: 1178, pct: 9 },
            ].map((prov) => (
              <div key={prov.name} className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold font-heading text-primary">{prov.farmers.toLocaleString()}</p>
                <p className="text-sm font-medium mt-1">{prov.name}</p>
                <div className="w-full bg-border rounded-full h-1.5 mt-2">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${prov.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Dashboard;
