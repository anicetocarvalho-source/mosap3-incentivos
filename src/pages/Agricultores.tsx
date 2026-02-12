import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Download, Eye, Edit, MoreHorizontal, User } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FarmerRegistrationForm from "@/components/FarmerRegistrationForm";

const farmersData = [
  { id: "AGR-001", name: "João Mateus", bi: "001234567LA042", phone: "923 456 789", province: "Benguela", municipality: "Caimbambo", school: "EC Caimbambo", status: "Ativo", parcels: 2, area: "4.5 ha" },
  { id: "AGR-002", name: "Maria Silva", bi: "002345678LA043", phone: "924 567 890", province: "Huambo", municipality: "Longonjo", school: "EC Longonjo", status: "Pendente", parcels: 1, area: "2.0 ha" },
  { id: "AGR-003", name: "Pedro Neto", bi: "003456789LA044", phone: "925 678 901", province: "Bié", municipality: "Cuemba", school: "EC Cuemba", status: "Ativo", parcels: 3, area: "7.2 ha" },
  { id: "AGR-004", name: "Ana Luísa Gomes", bi: "004567890LA045", phone: "926 789 012", province: "Benguela", municipality: "Lobito", school: "EC Lobito", status: "Ativo", parcels: 1, area: "1.8 ha" },
  { id: "AGR-005", name: "Carlos Manuel", bi: "005678901LA046", phone: "927 890 123", province: "Huambo", municipality: "Bailundo", school: "EC Bailundo", status: "Suspenso", parcels: 2, area: "3.5 ha" },
  { id: "AGR-006", name: "Teresa Domingos", bi: "006789012LA047", phone: "928 901 234", province: "Huíla", municipality: "Lubango", school: "EC Lubango", status: "Ativo", parcels: 2, area: "5.1 ha" },
  { id: "AGR-007", name: "Francisco Luís", bi: "007890123LA048", phone: "929 012 345", province: "Malanje", municipality: "Cacuso", school: "EC Cacuso", status: "Ativo", parcels: 1, area: "2.3 ha" },
  { id: "AGR-008", name: "Isabel Fernandes", bi: "008901234LA049", phone: "930 123 456", province: "Benguela", municipality: "Ganda", school: "EC Ganda", status: "Validado", parcels: 2, area: "4.0 ha" },
];

const Agricultores = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = farmersData.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.id.toLowerCase().includes(search.toLowerCase()) ||
    f.province.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Agricultores</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastro e gestão de produtores do MOSAP3</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Agricultor
        </Button>
        <FarmerRegistrationForm open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, ID, província..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select>
            <SelectTrigger className="w-40"><SelectValue placeholder="Província" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="benguela">Benguela</SelectItem>
              <SelectItem value="huambo">Huambo</SelectItem>
              <SelectItem value="bie">Bié</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
        </div>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Agricultor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">BI</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Província</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Escola</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Parcelas</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{f.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{f.bi}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.phone}</td>
                    <td className="px-4 py-3">{f.province}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.school}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{f.parcels}</span>
                      <span className="text-muted-foreground text-xs ml-1">({f.area})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={
                        f.status === "Ativo" ? "badge-active" :
                        f.status === "Pendente" || f.status === "Validado" ? "badge-pending" : "badge-suspended"
                      }>{f.status}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/agricultores/${f.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>A mostrar {filtered.length} de {farmersData.length} agricultores</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Agricultores;
