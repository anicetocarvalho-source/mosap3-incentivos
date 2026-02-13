import { useState } from "react";
import { MapPin, Search, School, Users, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { provinces } from "@/data/escolasData";
import { useNavigate } from "react-router-dom";

const GestaoProvincias = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = provinces.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.capital.toLowerCase().includes(search.toLowerCase())
  );

  const totalEscolas = provinces.reduce((a, p) => a + p.schools, 0);
  const totalProdutores = provinces.reduce((a, p) => a + p.farmers, 0);
  const totalMunicipios = provinces.reduce((a, p) => a + p.municipalities.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Gestão de Províncias</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das províncias, municípios e cobertura do programa</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{provinces.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Províncias</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalMunicipios}</p>
          <p className="text-xs text-muted-foreground mt-1">Municípios</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalEscolas}</p>
          <p className="text-xs text-muted-foreground mt-1">Escolas de Campo</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalProdutores.toLocaleString("pt-AO")}</p>
          <p className="text-xs text-muted-foreground mt-1">Produtores</p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar província ou capital..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Province cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((prov) => (
          <Card
            key={prov.slug}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate(`/escolas/provincia/${prov.slug}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{prov.name}</h3>
                  <p className="text-xs text-muted-foreground">Capital: {prov.capital}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center bg-muted/50 rounded-md py-2">
                <p className="text-sm font-bold">{prov.municipalities.length}</p>
                <p className="text-[10px] text-muted-foreground">Municípios</p>
              </div>
              <div className="text-center bg-muted/50 rounded-md py-2">
                <p className="text-sm font-bold">{prov.schools}</p>
                <p className="text-[10px] text-muted-foreground">Escolas</p>
              </div>
              <div className="text-center bg-muted/50 rounded-md py-2">
                <p className="text-sm font-bold">{prov.farmers}</p>
                <p className="text-[10px] text-muted-foreground">Produtores</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {prov.municipalities.slice(0, 4).map((m) => (
                <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {m}
                </Badge>
              ))}
              {prov.municipalities.length > 4 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  +{prov.municipalities.length - 4}
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma província encontrada para "{search}"</p>
        </div>
      )}
    </div>
  );
};

export default GestaoProvincias;
