import { motion } from "framer-motion";
import { MapPin, School, Users, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useProvincesData } from "@/hooks/useProvincesData";

const EscolasCampo = () => {
  const { provinces, schools, loading } = useProvincesData();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const provincesWithStats = provinces.map((p) => {
    const provSchools = schools.filter((s) => s.province_id === p.id);
    return {
      ...p,
      schoolCount: provSchools.length,
      farmerCount: provSchools.reduce((sum, s) => sum + s.total_farmers, 0),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Escolas de Campo</h1>
        <p className="text-muted-foreground text-sm mt-1">Selecione uma província para ver as escolas de campo</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {provincesWithStats.map((province, i) => (
          <motion.div
            key={province.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Link to={`/escolas/provincia/${province.slug}`}>
              <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-heading font-semibold text-base">{province.name}</h3>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mb-3">Capital: {province.capital}</p>
                <div className="flex items-center gap-4 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-sm">
                    <School className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{province.schoolCount}</span>
                    <span className="text-muted-foreground text-xs">escolas</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{province.farmerCount}</span>
                    <span className="text-muted-foreground text-xs">produtores</span>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default EscolasCampo;
