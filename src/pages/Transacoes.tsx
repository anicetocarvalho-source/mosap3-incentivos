import { motion } from "framer-motion";
import { ArrowRightLeft, Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const transacoes = [
  { id: "TXN-001", farmer: "João Mateus", farmerId: "PP-14819", amount: "45.000,00", province: "Benguela", type: "Compra Subsidiada", status: "Concluída", date: "12/02/2026", empresa: "AgroSul Lda" },
  { id: "TXN-002", farmer: "Maria Silva", farmerId: "PP-14818", amount: "30.000,00", province: "Huila", type: "Incentivo", status: "Concluída", date: "11/02/2026", empresa: "Fazenda Verde" },
  { id: "TXN-003", farmer: "Pedro Neto", farmerId: "PP-14817", amount: "120.000,00", province: "Benguela", type: "Compra Subsidiada", status: "Pendente", date: "10/02/2026", empresa: "SemPro Angola" },
  { id: "TXN-004", farmer: "Ana Luísa", farmerId: "PP-14816", amount: "25.000,00", province: "Namibe", type: "Incentivo", status: "Concluída", date: "09/02/2026", empresa: "FertiPlus" },
  { id: "TXN-005", farmer: "Carlos Manuel", farmerId: "PP-14815", amount: "85.000,00", province: "Cuando Cubango", type: "Compra Subsidiada", status: "Rejeitada", date: "08/02/2026", empresa: "Agro Cuando" },
  { id: "TXN-006", farmer: "Teresa João", farmerId: "PP-14814", amount: "60.000,00", province: "Huila", type: "Incentivo", status: "Concluída", date: "07/02/2026", empresa: "Fazenda Verde" },
  { id: "TXN-007", farmer: "Manuel Costa", farmerId: "PP-14813", amount: "95.000,00", province: "Benguela", type: "Compra Subsidiada", status: "Pendente", date: "06/02/2026", empresa: "MecAgro SA" },
  { id: "TXN-008", farmer: "Isabel Santos", farmerId: "PP-14812", amount: "40.000,00", province: "Cunene", type: "Incentivo", status: "Concluída", date: "05/02/2026", empresa: "AgroSul Lda" },
];

const Transacoes = () => {
  const [search, setSearch] = useState("");
  const filtered = transacoes.filter((t) =>
    t.farmer.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    t.empresa.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Transações</h1>
          <p className="text-muted-foreground text-sm mt-1">Histórico de todas as transações do sistema</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar transações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produtor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Tipo</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor (AOA)</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{t.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{t.farmer}</p>
                        <p className="text-xs text-muted-foreground">{t.farmerId} · {t.province}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.empresa}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{t.amount}</td>
                    <td className="px-4 py-3">
                      <span className={
                        t.status === "Concluída" ? "badge-active" :
                        t.status === "Pendente" ? "badge-pending" : "badge-suspended"
                      }>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{t.date}</td>
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

export default Transacoes;
