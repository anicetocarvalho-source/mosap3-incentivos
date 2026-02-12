import { motion } from "framer-motion";
import { Wheat } from "lucide-react";
import { Card } from "@/components/ui/card";

const Producao = () => (
  <div className="space-y-6">
    <div>
      <h1 className="page-title">Gestão da Produção</h1>
      <p className="text-muted-foreground text-sm mt-1">Acompanhamento do ciclo produtivo por cultura e parcela</p>
    </div>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-12 text-center">
        <Wheat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-heading font-semibold text-lg">Módulo em Desenvolvimento</h2>
        <p className="text-muted-foreground text-sm mt-1">O módulo de gestão da produção será disponibilizado em breve.</p>
      </Card>
    </motion.div>
  </div>
);

export default Producao;
