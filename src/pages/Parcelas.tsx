import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";

const Parcelas = () => (
  <div className="space-y-6">
    <div>
      <h1 className="page-title">Parcelas de Terreno</h1>
      <p className="text-muted-foreground text-sm mt-1">Georreferenciamento e gestão de parcelas agrícolas</p>
    </div>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-12 text-center">
        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-heading font-semibold text-lg">Módulo em Desenvolvimento</h2>
        <p className="text-muted-foreground text-sm mt-1">O módulo de parcelas georreferenciadas será disponibilizado em breve.</p>
      </Card>
    </motion.div>
  </div>
);

export default Parcelas;
