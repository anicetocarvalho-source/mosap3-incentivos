import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, ShoppingCart, Filter, Eye, Package, Truck, CheckCircle2, Clock, XCircle } from "lucide-react";
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

const comprasData = [
  { id: "CMP-001", farmer: "João Mateus", farmerId: "PP-14819", empresa: "AgroSul Lda", items: "Enxada, Catana, Sementes Milho", quantity: 3, total: "45.000,00", subsidio: "70%", valorPagar: "13.500,00", status: "Entregue", date: "12/02/2026", province: "Benguela" },
  { id: "CMP-002", farmer: "Maria Silva", farmerId: "PP-14818", empresa: "Fazenda Verde", items: "Fertilizante NPK, Pulverizador", quantity: 2, total: "120.000,00", subsidio: "50%", valorPagar: "60.000,00", status: "Em Trânsito", date: "11/02/2026", province: "Huila" },
  { id: "CMP-003", farmer: "Pedro Neto", farmerId: "PP-14817", empresa: "SemPro Angola", items: "Sementes Feijão, Sementes Soja", quantity: 2, total: "30.000,00", subsidio: "80%", valorPagar: "6.000,00", status: "Aprovada", date: "10/02/2026", province: "Benguela" },
  { id: "CMP-004", farmer: "Ana Luísa", farmerId: "PP-14816", empresa: "MecAgro SA", items: "Arado Manual, Regador", quantity: 2, total: "85.000,00", subsidio: "60%", valorPagar: "34.000,00", status: "Pendente", date: "09/02/2026", province: "Namibe" },
  { id: "CMP-005", farmer: "Carlos Manuel", farmerId: "PP-14815", empresa: "FertiPlus", items: "Fertilizante Orgânico x3", quantity: 3, total: "75.000,00", subsidio: "70%", valorPagar: "22.500,00", status: "Rejeitada", date: "08/02/2026", province: "Cuando Cubango" },
  { id: "CMP-006", farmer: "Teresa João", farmerId: "PP-14814", empresa: "AgroSul Lda", items: "Kit Irrigação Gota-a-Gota", quantity: 1, total: "250.000,00", subsidio: "50%", valorPagar: "125.000,00", status: "Entregue", date: "07/02/2026", province: "Huila" },
  { id: "CMP-007", farmer: "Manuel Costa", farmerId: "PP-14813", empresa: "SemPro Angola", items: "Sementes Mandioca, Amendoim", quantity: 2, total: "40.000,00", subsidio: "80%", valorPagar: "8.000,00", status: "Aprovada", date: "06/02/2026", province: "Benguela" },
  { id: "CMP-008", farmer: "Isabel Santos", farmerId: "PP-14812", empresa: "Agro Cuando", items: "Enxada, Machete, Balde", quantity: 3, total: "25.000,00", subsidio: "70%", valorPagar: "7.500,00", status: "Entregue", date: "05/02/2026", province: "Cunene" },
];

const Compras = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = comprasData.filter((c) =>
    c.farmer.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase()) ||
    c.empresa.toLowerCase().includes(search.toLowerCase())
  );

  const totalEntregue = comprasData.filter(c => c.status === "Entregue").length;
  const totalPendente = comprasData.filter(c => c.status === "Pendente" || c.status === "Aprovada" || c.status === "Em Trânsito").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Compras Subsidiadas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de compras de insumos agrícolas com subsídio MOSAP3</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Compra
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Registar Compra Subsidiada</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Produtor</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecionar produtor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pp-14819">João Mateus (PP-14819)</SelectItem>
                    <SelectItem value="pp-14818">Maria Silva (PP-14818)</SelectItem>
                    <SelectItem value="pp-14817">Pedro Neto (PP-14817)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Empresa Fornecedora</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agrosul">AgroSul Lda</SelectItem>
                    <SelectItem value="fazendaverde">Fazenda Verde</SelectItem>
                    <SelectItem value="sempro">SemPro Angola</SelectItem>
                    <SelectItem value="mecagro">MecAgro SA</SelectItem>
                    <SelectItem value="fertiplus">FertiPlus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Itens</Label>
                <Input placeholder="Ex: Enxada, Sementes Milho..." />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor Total (AOA)</Label>
                  <Input placeholder="0,00" type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Subsídio (%)</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="%" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50%</SelectItem>
                      <SelectItem value="60">60%</SelectItem>
                      <SelectItem value="70">70%</SelectItem>
                      <SelectItem value="80">80%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input placeholder="0" type="number" />
                </div>
              </div>
              <Button onClick={() => setDialogOpen(false)}>Registar Compra</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Compras" value="8" change="Campanha 2025/2026" icon={ShoppingCart} />
        <StatCard title="Entregues" value={String(totalEntregue)} change={`${Math.round(totalEntregue / comprasData.length * 100)}% concluídas`} changeType="positive" icon={CheckCircle2} iconBg="hsl(var(--success) / 0.15)" />
        <StatCard title="Em Processamento" value={String(totalPendente)} change="Aguardando entrega" changeType="neutral" icon={Truck} iconBg="hsl(var(--warning) / 0.15)" />
        <StatCard title="Volume Subsidiado" value="670.000 AOA" change="Total em compras" changeType="positive" icon={Package} iconBg="hsl(var(--info) / 0.15)" />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por produtor, ID ou empresa..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="transito">Em Trânsito</SelectItem>
              <SelectItem value="aprovada">Aprovada</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="rejeitada">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-44"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="agrosul">AgroSul Lda</SelectItem>
              <SelectItem value="fazendaverde">Fazenda Verde</SelectItem>
              <SelectItem value="sempro">SemPro Angola</SelectItem>
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
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produtor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Itens</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Total (AOA)</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Subsídio</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">A Pagar</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{c.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{c.farmer}</p>
                        <p className="text-xs text-muted-foreground">{c.farmerId} · {c.province}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.empresa}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs max-w-[180px] truncate" title={c.items}>{c.items}</p>
                      <p className="text-xs text-muted-foreground">{c.quantity} item(s)</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{c.total}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{c.subsidio}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{c.valorPagar}</td>
                    <td className="px-4 py-3">
                      <span className={
                        c.status === "Entregue" ? "badge-active" :
                        c.status === "Rejeitada" ? "badge-suspended" : "badge-pending"
                      }>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>A mostrar {filtered.length} de {comprasData.length} compras</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Compras;
