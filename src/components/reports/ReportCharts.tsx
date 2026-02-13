import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
  "hsl(var(--accent))",
];

const formatNumber = (v: number) => new Intl.NumberFormat("pt-AO", { notation: "compact" }).format(v);

type ProducaoRow = { provincia: string; escola: string; agricultores: number; producaoTon: number; areaTotalHa: number };
type AgricultoresRow = { provincia: string; ativo: number; pendente: number; suspenso: number; validado: number; total: number };
type IncentivosRow = { provincia: string; escola: string; beneficiarios: number; totalKz: number; kitsEntregues: number };
type ComprasRow = { empresa: string; provincia: string; transacoes: number; volumeKz: number };

export const ProducaoCharts = ({ data }: { data: ProducaoRow[] }) => {
  const barData = data.map(r => ({ name: r.escola.replace("EC ", ""), producao: r.producaoTon, area: r.areaTotalHa }));
  const pieData = data.map(r => ({ name: r.escola.replace("EC ", ""), value: r.producaoTon }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 print:grid-cols-2">
      <ChartCard title="Produção por Escola (ton)">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
            <Tooltip formatter={(v: number) => formatNumber(v)} />
            <Bar dataKey="producao" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Produção (ton)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Distribuição da Produção">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatNumber(v)} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

export const AgricultoresCharts = ({ data }: { data: AgricultoresRow[] }) => {
  const barData = data.map(r => ({ name: r.provincia, ativo: r.ativo, pendente: r.pendente, suspenso: r.suspenso, validado: r.validado }));
  const totals = data.reduce((a, r) => ({ ativo: a.ativo + r.ativo, pendente: a.pendente + r.pendente, suspenso: a.suspenso + r.suspenso, validado: a.validado + r.validado }), { ativo: 0, pendente: 0, suspenso: 0, validado: 0 });
  const pieData = [
    { name: "Ativo", value: totals.ativo },
    { name: "Pendente", value: totals.pendente },
    { name: "Suspenso", value: totals.suspenso },
    { name: "Validado", value: totals.validado },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 print:grid-cols-2">
      <ChartCard title="Agricultores por Província">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="ativo" fill={COLORS[0]} name="Ativo" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pendente" fill={COLORS[2]} name="Pendente" radius={[4, 4, 0, 0]} />
            <Bar dataKey="suspenso" fill={COLORS[4]} name="Suspenso" radius={[4, 4, 0, 0]} />
            <Bar dataKey="validado" fill={COLORS[1]} name="Validado" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Distribuição por Estado">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

export const IncentivosCharts = ({ data }: { data: IncentivosRow[] }) => {
  const barData = data.map(r => ({ name: r.escola.replace("EC ", ""), beneficiarios: r.beneficiarios, kits: r.kitsEntregues }));
  const pieData = data.map(r => ({ name: r.escola.replace("EC ", ""), value: r.totalKz }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 print:grid-cols-2">
      <ChartCard title="Beneficiários e Kits por Escola">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="beneficiarios" fill={COLORS[0]} name="Beneficiários" radius={[4, 4, 0, 0]} />
            <Bar dataKey="kits" fill={COLORS[1]} name="Kits" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Investimento por Escola (Kz)">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatNumber(v)} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

export const ComprasCharts = ({ data }: { data: ComprasRow[] }) => {
  const barData = data.map(r => ({ name: r.empresa.length > 12 ? r.empresa.slice(0, 12) + "…" : r.empresa, transacoes: r.transacoes }));
  const pieData = data.map(r => ({ name: r.empresa.length > 12 ? r.empresa.slice(0, 12) + "…" : r.empresa, value: r.volumeKz }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 print:grid-cols-2">
      <ChartCard title="Transações por Empresa">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="transacoes" fill={COLORS[0]} name="Transações" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Volume por Empresa (Kz)">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatNumber(v)} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-border rounded-lg p-4 bg-card">
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h4>
    {children}
  </div>
);
