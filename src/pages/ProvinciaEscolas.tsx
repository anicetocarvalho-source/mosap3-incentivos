import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Users, User, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProvinceBySlug, getSchoolsByProvince } from "@/data/escolasData";

const ProvinciaEscolas = () => {
  const { slug } = useParams();
  const province = slug ? getProvinceBySlug(slug) : null;
  const schools = slug ? getSchoolsByProvince(slug) : [];

  if (!province) {
    return (
      <div className="space-y-6">
        <Link to="/escolas">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
        <p className="text-muted-foreground">Província não encontrada.</p>
      </div>
    );
  }

  // Group schools by municipality
  const byMunicipality: Record<string, typeof schools> = {};
  schools.forEach((s) => {
    if (!byMunicipality[s.municipality]) byMunicipality[s.municipality] = [];
    byMunicipality[s.municipality].push(s);
  });

  // Municipalities without schools
  const municipalitiesWithSchools = Object.keys(byMunicipality);
  const municipalitiesWithout = province.municipalities.filter((m) => !municipalitiesWithSchools.includes(m));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/escolas">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="page-title">{province.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Escolas de campo na província de {province.name} • Capital: {province.capital}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Escolas</p>
          <p className="text-2xl font-bold">{schools.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Produtores</p>
          <p className="text-2xl font-bold">{schools.reduce((s, sc) => s + sc.totalFarmers, 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Municípios</p>
          <p className="text-2xl font-bold">{province.municipalities.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Escolas Activas</p>
          <p className="text-2xl font-bold">{schools.filter((s) => s.status === "Ativa").length}</p>
        </Card>
      </div>

      {/* Municipalities with schools */}
      {Object.entries(byMunicipality).map(([municipality, municipalitySchools]) => (
        <div key={municipality} className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-lg">{municipality}</h2>
            <Badge variant="outline" className="text-xs">{municipalitySchools.length} escola(s)</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {municipalitySchools.map((school, i) => (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/escolas/${school.id}`}>
                  <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-heading font-semibold text-base">{school.name}</h3>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
                          <MapPin className="h-3 w-3" />
                          <span>{school.village}</span>
                        </div>
                      </div>
                      <Badge variant={school.status === "Ativa" ? "default" : "secondary"} className="text-xs">
                        {school.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{school.totalFarmers}</span>
                        <span className="text-muted-foreground text-xs">produtores</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">{school.technician}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      ))}

      {/* Municipalities without schools */}
      {municipalitiesWithout.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-lg text-muted-foreground">Municípios sem Escolas de Campo</h2>
          <div className="flex flex-wrap gap-2">
            {municipalitiesWithout.map((m) => (
              <Badge key={m} variant="outline" className="text-xs text-muted-foreground">{m}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvinciaEscolas;
