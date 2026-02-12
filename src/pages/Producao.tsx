import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Wheat, Sprout, TrendingUp, Calendar, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";

const producaoData = [
  { id: "PRD-001", farmer: "João Mateus", farmerId: "PP-14819", parcel: "PRC-001", culture: "Milho", area: "2.5 ha", planted: "15/10/2025", expected: "15/03/2026", estimatedYield: "5.000 kg", actualYield: "4.800 kg", status: "Colhida", province: "Benguela" },
  { id: "PRD-002", farmer: "João Mateus", farmerId: "PP-14819", parcel: "PRC-002", culture: "Feijão", area: "2.0 ha", planted: "20/10/2025", expected: "20/02/2026", estimatedYield: "2.000 kg", actualYield: "-", status: "Em Crescimento", province: "Benguela" },
  { id: "PRD-003", farmer: "Maria Silva", farmerId: "PP-14818", parcel: "PRC-003", culture: "Mandioca", area: "3.2 ha", planted: "01/09/2025", expected: "01/06/2026", estimatedYield: "8.000 kg", actualYield: "-", status: "Em Crescimento", province: "Huila" },
  { id: "PRD-004", farmer: "Pedro Neto", farmerId: "PP-14817", parcel: "PRC-004", culture: "Soja", area: "4.0 ha", planted: "10/10/2025", expected: "10/03/2026", estimatedYield: "6.400 kg", actualYield: "6.100 kg", status: "Colhida", province: "Benguela" },
  { id: "PRD-005", farmer: "Pedro Neto", farmerId: "PP-14817", parcel: "PRC-005", culture: "Amendoim", area: "1.8 ha", planted: "05/11/2025", expected: "05/04/2026", estimatedYield: "1.800 kg", actualYield: "-", status: "Semeada", province: "Benguela" },
  { id: "PRD-006", farmer: "Ana Luísa", farmerId: "PP-14816", parcel: "PRC-006", culture: "Batata Doce", area: "1.5 ha", planted: "20/09/2025", expected: "20/01/2026", estimatedYield: "3.000 kg", actualYield: "2.750 kg", status: "Colhida", province: "Namibe" },
  { id: "PRD-007", farmer: "Teresa João", farmerId: "PP-14814", parcel: "PRC-007", culture: "Milho", area: "5.0 ha", planted: "12/10/2025", expected: "12/03/2026", estimatedYield: "10.000 kg", actualYield: "-", status: "Em Crescimento", province: "Huila" },
  { id: "PRD-008", farmer: "Isabel Santos", farmerId: "PP-14812", parcel: "PRC-009", culture: "Massango", area: "3.5 ha", planted: "01/11/2025", expected: "01/04/2026", estimatedYield: "4.200 kg", actualYield: "-", status: "Semeada", province: "Cunene" },
];

const cultureProdChart = [
  { name: "Milho", estimada: 15000, real: 4800 },
  { name: "Feijão", estimada: 2000, real: 0 },
  { name: "Mandioca", estimada: 8000, real: 0 },
  { name: "Soja", estimada: 6400, real: 6100 },
  { name: "Amendoim", estimada: 1800, real: 0 },
  { name: "Batata Doce", estimada: 3000, real: 2750 },
  { name: "Massango", estimada: 4200, real: 0 },
];

const Producao = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = producaoData.filter((p) =>
    p.farmer.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    p.culture.toLowerCase().includes(search.toLowerCase())
  );

  const totalColhida = producaoData.filter(p => p.status === "Colhida").length;
  const totalCrescimento = producaoData.filter(p => p.status === "Em Crescimento").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Gestão da Produção</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhamento do ciclo produtivo por cultura e parcela</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Produção
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Registar Produção</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produtor</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pp-14819">João Mateus</SelectItem>
                      <SelectItem value="pp-14818">Maria Silva</SelectItem>
                      <SelectItem value="pp-14817">Pedro Neto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Parcela</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prc-001">PRC-001 (2.5 ha)</SelectItem>
                      <SelectItem value="prc-002">PRC-002 (2.0 ha)</SelectItem>
                      <SelectItem value="prc-003">PRC-003 (3.2 ha)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cultura</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="milho">Milho</SelectItem>
                      <SelectItem value="feijao">Feijão</SelectItem>
                      <SelectItem value="mandioca">Mandioca</SelectItem>
                      <SelectItem value="soja">Soja</SelectItem>
                      <SelectItem value="amendoim">Amendoim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data de Plantio</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produção Estimada (kg)</Label>
                  <Input placeholder="0" type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Data Prevista Colheita</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea placeholder="Condições do solo, tipo de semente..." rows={3} />
              </div>
              <Button onClick={() => setDialogOpen(false)}>Registar Produção</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Registos" value={String(producaoData.length)} change="Campanha 2025/2026" icon={Wheat} />
        <StatCard title="Colhidas" value={String(totalColhida)} change={`${Math.round(totalColhida / producaoData.length * 100)}% concluídas`} changeType="positive" icon={Sprout} iconBg="hsl(var(--success) / 0.15)" />
        <StatCard title="Em Crescimento" value={String(totalCrescimento)} change="Monitorização activa" changeType="neutral" icon={TrendingUp} iconBg="hsl(var(--warning) / 0.15)" />
        <StatCard title="Prod. Estimada Total" value="40.400 kg" change="Todas as culturas" changeType="positive" icon={Calendar} iconBg="hsl(var(--info) / 0.15)" />
      </div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-6">
          <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-6">
            Produção Estimada vs Real por Cultura (kg)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cultureProdChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(100 10% 89%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="estimada" name="Estimada" fill="hsl(130, 55%, 30%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="real" name="Real" fill="hsl(45, 95%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por produtor, cultura..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select>
            <SelectTrigger className="w-40"><SelectValue placeholder="Cultura" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="milho">Milho</SelectItem>
              <SelectItem value="feijao">Feijão</SelectItem>
              <SelectItem value="mandioca">Mandioca</SelectItem>
              <SelectItem value="soja">Soja</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="semeada">Semeada</SelectItem>
              <SelectItem value="crescimento">Em Crescimento</SelectItem>
              <SelectItem value="colhida">Colhida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produtor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cultura</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Área</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Plantio</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Colheita Prev.</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Est. (kg)</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Real (kg)</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{p.farmer}</p>
                        <p className="text-xs text-muted-foreground">{p.farmerId} · {p.province}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{p.culture}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{p.area}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.planted}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.expected}</td>
                    <td className="px-4 py-3 text-right">{p.estimatedYield}</td>
                    <td className="px-4 py-3 text-right font-semibold">{p.actualYield}</td>
                    <td className="px-4 py-3">
                      <span className={
                        p.status === "Colhida" ? "badge-active" :
                        p.status === "Em Crescimento" ? "badge-pending" : "badge-suspended"
                      }>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>A mostrar {filtered.length} de {producaoData.length} registos</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Producao;
