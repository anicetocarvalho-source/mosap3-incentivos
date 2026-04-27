import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Users, User, Search, ChevronRight, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useProvincesData } from "@/hooks/useProvincesData";

const SchoolCard = ({ school, index }: { school: any; index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(index * 0.03, 0.3) }}
  >
    <Link to={`/escolas/${school.id}`} aria-label={`Abrir perfil da escola ${school.name}`}>
      <Card className="group p-5 hover:shadow-md transition-all cursor-pointer hover:border-primary/40 h-full">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-semibold text-base truncate group-hover:text-primary transition-colors">
              {school.name}
            </h3>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{school.village || "—"}</span>
            </div>
          </div>
          <Badge variant={school.status === "Ativa" ? "default" : "secondary"} className="text-xs shrink-0">
            {school.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold">{school.total_farmers}</span>
            <span className="text-muted-foreground text-xs">produtores</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs truncate">{school.technician || "—"}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </Card>
    </Link>
  </motion.div>
);

const ProvinciaEscolas = () => {
  const { slug } = useParams();
  const { provinces, schools, loading, error, refetch, getMunicipalitiesByProvince, getSchoolsByProvince } = useProvincesData();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ⚠️ Todos os hooks têm de ser chamados antes de qualquer early return,
  // caso contrário o React lança o erro #310 ("Rendered more hooks than during the previous render").
  const province = useMemo(
    () => provinces.find((p) => p.slug === slug) || null,
    [provinces, slug]
  );

  const provSchools = useMemo(
    () => (province ? getSchoolsByProvince(province.id) : []),
    [province, getSchoolsByProvince]
  );

  const provMunicipalities = useMemo(
    () => (province ? getMunicipalitiesByProvince(province.id) : []),
    [province, getMunicipalitiesByProvince]
  );

  const sortedMunicipalities = useMemo(() => {
    const byMun: Record<string, { name: string; schools: typeof provSchools }> = {};
    provSchools.forEach((s) => {
      const mun = provMunicipalities.find((m) => m.id === s.municipality_id);
      const munName = mun?.name || "Desconhecido";
      if (!byMun[s.municipality_id]) {
        byMun[s.municipality_id] = { name: munName, schools: [] };
      }
      byMun[s.municipality_id].schools.push(s);
    });
    return Object.entries(byMun).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [provSchools, provMunicipalities]);

  const municipalitiesWithout = useMemo(() => {
    const idsWith = new Set(sortedMunicipalities.map(([id]) => id));
    return provMunicipalities.filter((m) => !idsWith.has(m.id));
  }, [provMunicipalities, sortedMunicipalities]);

  const filteredSchools = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return provSchools.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        (s.village || "").toLowerCase().includes(term) ||
        (s.technician || "").toLowerCase().includes(term)
      );
    });
  }, [provSchools, searchTerm, statusFilter]);

  const defaultOpen = sortedMunicipalities.length > 0 ? [sortedMunicipalities[0][0]] : [];

  // Outras províncias (com escolas) para sugerir quando esta está vazia
  const suggestedProvinces = useMemo(() => {
    if (!province) return [];
    const counts = new Map<string, number>();
    schools.forEach((s) => counts.set(s.province_id, (counts.get(s.province_id) || 0) + 1));
    return provinces
      .filter((p) => p.id !== province.id && (counts.get(p.id) || 0) > 0)
      .map((p) => ({ ...p, schoolCount: counts.get(p.id) || 0 }))
      .sort((a, b) => b.schoolCount - a.schoolCount)
      .slice(0, 6);
  }, [provinces, schools, province]);

  // Early returns só DEPOIS de todos os hooks acima.
  if (loading) {
    return <LoadingState variant="spinner" label="A carregar escolas..." />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link to="/escolas">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
        <ErrorState
          title="Não foi possível carregar as escolas"
          description="Ocorreu um erro ao obter as províncias e escolas. Verifique a sua ligação e tente novamente."
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!province) {
    return (
      <div className="space-y-6">
        <Link to="/escolas">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
        <EmptyState
          icon={MapPin}
          title="Província não encontrada"
          description="A província pedida não existe ou ainda não foi sincronizada."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/escolas">Escolas de Campo</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{province.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/escolas">
          <Button variant="ghost" size="icon" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Button>
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
          <p className="text-2xl font-bold">{provSchools.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Produtores</p>
          <p className="text-2xl font-bold">{provSchools.reduce((s, sc) => s + sc.total_farmers, 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Municípios</p>
          <p className="text-2xl font-bold">{provMunicipalities.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Escolas Activas</p>
          <p className="text-2xl font-bold">{provSchools.filter((s) => s.status === "Ativa").length}</p>
        </Card>
      </div>

      {/* Conteúdo principal: empty state amigável OU tabs */}
      {provSchools.length === 0 ? (
        <Card className="p-8 md:p-12">
          <div className="flex flex-col items-center text-center max-w-xl mx-auto">
            <div className="mb-5 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <School className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-heading font-semibold text-foreground mb-2">
              Sem escolas de campo em {province.name}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Esta província ainda não tem escolas de campo registadas
              {provMunicipalities.length > 0
                ? ` em nenhum dos seus ${provMunicipalities.length} municípios.`
                : "."}{" "}
              Volte à lista geral ou escolha outra província para continuar.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-8">
              <Link to="/escolas">
                <Button variant="default" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar a Escolas de Campo
                </Button>
              </Link>
            </div>

            {suggestedProvinces.length > 0 && (
              <div className="w-full">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Outras províncias com escolas
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedProvinces.map((p) => (
                    <Link key={p.id} to={`/escolas/provincia/${p.slug}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {p.name}
                        <Badge variant="secondary" className="text-xs ml-1">
                          {p.schoolCount}
                        </Badge>
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="por-municipio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="por-municipio">Visão por Município ({sortedMunicipalities.length})</TabsTrigger>
          <TabsTrigger value="todas">Todas as Escolas ({provSchools.length})</TabsTrigger>
          <TabsTrigger value="sem-escolas">Sem Escolas ({municipalitiesWithout.length})</TabsTrigger>
        </TabsList>

        {/* Tab 1: Por Município com Accordion */}
        <TabsContent value="por-municipio" className="space-y-2">
          {sortedMunicipalities.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Nenhum município com escolas"
              description="Esta província ainda não tem escolas de campo registadas."
            />
          ) : (
            <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
              {sortedMunicipalities.map(([munId, { name, schools: municipalitySchools }]) => (
                <AccordionItem
                  key={munId}
                  value={munId}
                  className="border rounded-lg px-4 bg-card"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1">
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-heading font-semibold text-base">{name}</span>
                      <Badge variant="outline" className="text-xs ml-auto mr-2">
                        {municipalitySchools.length} escola(s) • {municipalitySchools.reduce((s, sc) => s + sc.total_farmers, 0)} produtores
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                      {municipalitySchools.map((school, i) => (
                        <SchoolCard key={school.id} school={school} index={i} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {/* Tab 2: Todas as escolas com pesquisa */}
        <TabsContent value="todas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, aldeia ou técnico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Inativa">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filteredSchools.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhuma escola encontrada"
              description="Tente ajustar a pesquisa ou o filtro de estado."
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                A mostrar {filteredSchools.length} de {provSchools.length} escolas.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSchools.map((school, i) => (
                  <SchoolCard key={school.id} school={school} index={i} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 3: Municípios sem escolas */}
        <TabsContent value="sem-escolas">
          {municipalitiesWithout.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Todos os municípios têm escolas"
              description="Não há municípios sem escolas de campo nesta província."
            />
          ) : (
            <Card className="p-5">
              <h2 className="font-heading font-semibold text-base text-muted-foreground mb-3">
                {municipalitiesWithout.length} município(s) sem escolas de campo
              </h2>
              <div className="flex flex-wrap gap-2">
                {municipalitiesWithout.map((m) => (
                  <Badge key={m.id} variant="outline" className="text-xs text-muted-foreground">
                    {m.name}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
};

export default ProvinciaEscolas;
