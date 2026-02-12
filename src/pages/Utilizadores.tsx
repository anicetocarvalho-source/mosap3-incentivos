import { motion } from "framer-motion";
import { Plus, Search, User, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const utilizadores = [
  { id: 1, name: "Joaquim Manuel", email: "jm@mwangoclick.ao", role: "Administrador", province: "Benguela", status: "Disponível", lastLogin: "12/02/2026" },
  { id: 2, name: "Ana Pereira", email: "ana.pereira@mosap3.ao", role: "Extensionista", province: "Huila", status: "Disponível", lastLogin: "11/02/2026" },
  { id: 3, name: "José Fernandes", email: "jose.f@mosap3.ao", role: "Extensionista", province: "Benguela", status: "Indisponível", lastLogin: "09/02/2026" },
  { id: 4, name: "Maria Santos", email: "maria.s@mosap3.ao", role: "Supervisor", province: "Namibe", status: "Disponível", lastLogin: "12/02/2026" },
  { id: 5, name: "Carlos Dias", email: "carlos.d@mosap3.ao", role: "Fornecedor", province: "Cuando Cubango", status: "Disponível", lastLogin: "10/02/2026" },
];

const Utilizadores = () => {
  const [search, setSearch] = useState("");
  const filtered = utilizadores.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Utilizadores</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de utilizadores do sistema</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Utilizador
        </Button>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Pesquisar utilizadores..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Utilizador</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Perfil</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Província</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Último Login</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{u.role}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.province}</td>
                    <td className="px-4 py-3">
                      <span className={u.status === "Disponível" ? "badge-active" : "badge-suspended"}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{u.lastLogin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Utilizadores;
