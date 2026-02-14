import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Download, Eye, Edit, User } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import FarmerRegistrationForm from "@/components/FarmerRegistrationForm";
import { useFarmersList } from "@/hooks/useFarmersList";

const Agricultores = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<any>(null);
  const { farmers, loading } = useFarmersList();

  const filtered = farmers.filter((f) =>
    f.full_name.toLowerCase().includes(search.toLowerCase()) ||
    f.code.toLowerCase().includes(search.toLowerCase()) ||
    (f.province || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (farmer: any) => {
    setEditingFarmer({
      id: farmer.code,
      name: farmer.full_name,
      bi: farmer.bi || "",
      phone: farmer.phone || "",
      province: farmer.province || "",
      municipality: farmer.municipality || "",
      school: farmer.school || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingFarmer(null);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="page-title text-lg md:text-2xl">Agricultores</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1 hidden sm:block">Cadastro e gestão de produtores do MOSAP3</p>
        </div>
        <Button className="gap-2 flex-shrink-0" size="sm" onClick={() => { setEditingFarmer(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Agricultor</span>
          <span className="sm:hidden">Novo</span>
        </Button>
        <FarmerRegistrationForm open={dialogOpen} onOpenChange={handleCloseDialog} editData={editingFarmer} />
      </div>

      {/* Filters */}
      <Card className="p-3 md:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar nome, ID, província..."
              className="pl-10 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select>
              <SelectTrigger className="w-full sm:w-36 text-xs md:text-sm"><SelectValue placeholder="Província" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="benguela">Benguela</SelectItem>
                <SelectItem value="huambo">Huambo</SelectItem>
                <SelectItem value="bie">Bié</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-full sm:w-32 text-xs md:text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="flex-shrink-0"><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      {/* Table / Cards */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Agricultor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">BI</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Telefone</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Província</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Escola</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-6 py-3"><Skeleton className="h-5 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-6 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : filtered.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {f.photo_frontal_url ? (
                          <img src={f.photo_frontal_url} alt={f.full_name} className="h-9 w-9 rounded-full object-cover flex-shrink-0 border border-border" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{f.full_name}</p>
                          <p className="text-xs text-muted-foreground">{f.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{f.bi || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.phone || "—"}</td>
                    <td className="px-4 py-3">{f.province || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.school || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={
                        f.status === "Ativo" ? "badge-active" :
                        f.status === "Pendente" || f.status === "Validado" ? "badge-pending" : "badge-suspended"
                      }>{f.status}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/agricultores/${f.code}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(f)}><Edit className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            ) : filtered.map((f) => (
              <div key={f.id} className="p-3 flex items-center gap-3">
                {f.photo_frontal_url ? (
                  <img src={f.photo_frontal_url} alt={f.full_name} className="h-10 w-10 rounded-full object-cover flex-shrink-0 border border-border" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{f.full_name}</p>
                    <span className={`text-[10px] flex-shrink-0 ${
                      f.status === "Ativo" ? "badge-active" :
                      f.status === "Pendente" || f.status === "Validado" ? "badge-pending" : "badge-suspended"
                    }`}>{f.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-mono">{f.code}</span>
                    <span>•</span>
                    <span className="truncate">{f.province || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Link to={`/agricultores/${f.code}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(f)}><Edit className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 md:px-6 py-3 border-t border-border flex items-center justify-between text-xs md:text-sm text-muted-foreground">
            <span>{filtered.length} de {farmers.length} agricultores</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Agricultores;
