import { motion } from "framer-motion";
import { Plus, Building2, MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const empresas = [
  { id: 1, name: "AgroSul Lda", nif: "5417892301", province: "Benguela", municipality: "Lobito", phone: "+244 923 456 789", email: "info@agrosul.ao", status: "Ativa", products: 12 },
  { id: 2, name: "Fazenda Verde", nif: "5418234501", province: "Huila", municipality: "Lubango", phone: "+244 924 567 890", email: "geral@fazendaverde.ao", status: "Ativa", products: 8 },
  { id: 3, name: "SemPro Angola", nif: "5419876543", province: "Huambo", municipality: "Huambo", phone: "+244 925 678 901", email: "vendas@sempro.ao", status: "Ativa", products: 15 },
  { id: 4, name: "MecAgro SA", nif: "5420123456", province: "Benguela", municipality: "Benguela", phone: "+244 926 789 012", email: "info@mecagro.ao", status: "Pendente", products: 6 },
  { id: 5, name: "FertiPlus", nif: "5421234567", province: "Namibe", municipality: "Moçâmedes", phone: "+244 927 890 123", email: "geral@fertiplus.ao", status: "Ativa", products: 10 },
  { id: 6, name: "Agro Cuando", nif: "5422345678", province: "Cuando Cubango", municipality: "Menongue", phone: "+244 928 901 234", email: "info@agrocuando.ao", status: "Inativa", products: 4 },
];

const Empresas = () => {
  const [search, setSearch] = useState("");
  const filtered = empresas.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.province.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de empresas fornecedoras e parceiras</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Pesquisar empresas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((empresa, i) => (
          <motion.div
            key={empresa.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-base">{empresa.name}</h3>
                    <p className="text-xs text-muted-foreground">NIF: {empresa.nif}</p>
                  </div>
                </div>
                <span className={
                  empresa.status === "Ativa" ? "badge-active" :
                  empresa.status === "Pendente" ? "badge-pending" : "badge-suspended"
                }>
                  {empresa.status}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{empresa.municipality}, {empresa.province}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{empresa.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{empresa.email}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">{empresa.products} produtos registados</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Empresas;
