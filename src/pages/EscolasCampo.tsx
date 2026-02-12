import { motion } from "framer-motion";
import { Plus, MapPin, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const schools = [
  { name: "EC Caimbambo", province: "Benguela", municipality: "Caimbambo", village: "Aldeia Saca", technician: "José Fernandes", farmers: 45, status: "Ativa" },
  { name: "EC Longonjo", province: "Huambo", municipality: "Longonjo", village: "Aldeia Chiva", technician: "Ana Pereira", farmers: 38, status: "Ativa" },
  { name: "EC Cuemba", province: "Bié", municipality: "Cuemba", village: "Aldeia Soqui", technician: "Manuel Costa", farmers: 52, status: "Ativa" },
  { name: "EC Lobito", province: "Benguela", municipality: "Lobito", village: "Aldeia Hanha", technician: "Teresa Luís", farmers: 31, status: "Ativa" },
  { name: "EC Bailundo", province: "Huambo", municipality: "Bailundo", village: "Aldeia Bimbe", technician: "Carlos Dias", farmers: 27, status: "Inativa" },
  { name: "EC Lubango", province: "Huíla", municipality: "Lubango", village: "Aldeia Chibia", technician: "Isabel Santos", farmers: 41, status: "Ativa" },
  { name: "EC Ganda", province: "Benguela", municipality: "Ganda", village: "Aldeia Ebanga", technician: "Francisco Miguel", farmers: 36, status: "Ativa" },
  { name: "EC Cacuso", province: "Malanje", municipality: "Cacuso", village: "Aldeia Pungo", technician: "Rita Domingos", farmers: 29, status: "Ativa" },
];

const EscolasCampo = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Escolas de Campo</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão das escolas de campo e extensionistas</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Escola
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schools.map((school, i) => (
          <motion.div
            key={school.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-heading font-semibold text-base">{school.name}</h3>
                  <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
                    <MapPin className="h-3 w-3" />
                    <span>{school.village}, {school.municipality}</span>
                  </div>
                </div>
                <span className={school.status === "Ativa" ? "badge-active" : "badge-suspended"}>
                  {school.status}
                </span>
              </div>
              <div className="flex items-center gap-4 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{school.farmers}</span>
                  <span className="text-muted-foreground text-xs">agricultores</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">{school.technician}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{school.province}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default EscolasCampo;
