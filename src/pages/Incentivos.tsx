import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Gift, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, Filter } from "lucide-react";
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

const incentivesData = [
  { id: "INC-001", farmer: "João Mateus", farmerId: "AGR-001", phone: "923 456 789", type: "Insumos Agrícolas", amount: "45.000 Kz", campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "12/02/2026" },
  { id: "INC-002", farmer: "Maria Silva", farmerId: "AGR-002", phone: "924 567 890", type: "Sementes", amount: "30.000 Kz", campaign: "2025/2026", method: "Unitel Money", status: "Pendente", date: "11/02/2026" },
  { id: "INC-003", farmer: "Pedro Neto", farmerId: "AGR-003", phone: "925 678 901", type: "Mecanização", amount: "60.000 Kz", campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "10/02/2026" },
  { id: "INC-004", farmer: "Ana Luísa Gomes", farmerId: "AGR-004", phone: "926 789 012", type: "Fertilizantes", amount: "25.000 Kz", campaign: "2025/2026", method: "Unitel Money", status: "Processando", date: "09/02/2026" },
  { id: "INC-005", farmer: "Carlos Manuel", farmerId: "AGR-005", phone: "927 890 123", type: "Insumos Agrícolas", amount: "40.000 Kz", campaign: "2025/2026", method: "Unitel Money", status: "Rejeitado", date: "08/02/2026" },
  { id: "INC-006", farmer: "Teresa Domingos", farmerId: "AGR-006", phone: "928 901 234", type: "Sementes", amount: "35.000 Kz", campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "07/02/2026" },
  { id: "INC-007", farmer: "Francisco Luís", farmerId: "AGR-007", phone: "929 012 345", type: "Fertilizantes", amount: "28.000 Kz", campaign: "2025/2026", method: "Unitel Money", status: "Pago", date: "06/02/2026" },
  { id: "INC-008", farmer: "Isabel Fernandes", farmerId: "AGR-008", phone: "930 123 456", type: "Mecanização", amount: "55.000 Kz", campaign: "2025/2026", method: "Unitel Money", status: "Pendente", date: "05/02/2026" },
];

const Incentivos = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = incentivesData.filter((inc) =>
    inc.farmer.toLowerCase().includes(search.toLowerCase()) ||
    inc.id.toLowerCase().includes(search.toLowerCase())
  );

  const totalPago = incentivesData.filter(i => i.status === "Pago").length;
  const totalPendente = incentivesData.filter(i => i.status === "Pendente" || i.status === "Processando").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Gestão de Incentivos</h1>
          <p className="text-muted-foreground text-sm mt-1">Distribuição e acompanhamento de incentivos via Unitel Money</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Incentivo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Registar Incentivo</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Agricultor</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecionar agricultor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agr-001">João Mateus (AGR-001)</SelectItem>
                    <SelectItem value="agr-002">Maria Silva (AGR-002)</SelectItem>
                    <SelectItem value="agr-003">Pedro Neto (AGR-003)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Incentivo</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insumos">Insumos Agrícolas</SelectItem>
                      <SelectItem value="sementes">Sementes</SelectItem>
                      <SelectItem value="fertilizantes">Fertilizantes</SelectItem>
                      <SelectItem value="mecanizacao">Mecanização</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor (Kz)</Label>
                  <Input placeholder="0.00" type="number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campanha</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Campanha" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025-2026">2025/2026</SelectItem>
                      <SelectItem value="2024-2025">2024/2025</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Método de Pagamento</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unitel">Unitel Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => setDialogOpen(false)}>Registar Incentivo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Distribuído" value="318.000 Kz" change="Campanha 2025/2026" icon={Gift} />
        <StatCard title="Pagos" value={String(totalPago)} change={`${Math.round(totalPago/incentivesData.length*100)}% do total`} changeType="positive" icon={CheckCircle2} iconBg="hsl(var(--success) / 0.15)" />
        <StatCard title="Pendentes" value={String(totalPendente)} change="Aguardando processamento" changeType="neutral" icon={Clock} iconBg="hsl(var(--warning) / 0.15)" />
        <StatCard title="Rejeitados" value="1" change="Verificar motivo" changeType="negative" icon={XCircle} iconBg="hsl(var(--destructive) / 0.15)" />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por agricultor ou ID..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="insumos">Insumos Agrícolas</SelectItem>
              <SelectItem value="sementes">Sementes</SelectItem>
              <SelectItem value="fertilizantes">Fertilizantes</SelectItem>
              <SelectItem value="mecanizacao">Mecanização</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Agricultor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Campanha</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Método</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inc) => (
                  <tr key={inc.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{inc.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{inc.farmer}</p>
                        <p className="text-xs text-muted-foreground">{inc.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{inc.type}</td>
                    <td className="px-4 py-3 font-semibold">{inc.amount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inc.campaign}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inc.method}</td>
                    <td className="px-4 py-3">
                      <span className={
                        inc.status === "Pago" ? "badge-active" :
                        inc.status === "Pendente" || inc.status === "Processando" ? "badge-pending" : "badge-suspended"
                      }>{inc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inc.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>A mostrar {filtered.length} de {incentivesData.length} incentivos</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Incentivos;
