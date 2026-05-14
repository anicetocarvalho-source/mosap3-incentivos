import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, School, Users, Loader2, Search, Filter, CheckCircle, XCircle, TrendingUp, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProvincesData } from "@/hooks/useProvincesData";

/* ─── Angola province approximate center coords for the map ─── */
const PROVINCE_COORDS: Record<string, [number, number]> = {
  bengo: [-8.8, 13.7],
  benguela: [-12.6, 13.4],
  bie: [-12.4, 17.7],
  cabinda: [-5.5, 12.2],
  "cuando-cubango": [-16.5, 18.5],
  "cuanza-norte": [-9.2, 14.8],
  "cuanza-sul": [-10.6, 14.6],
  cunene: [-16.3, 15.8],
  huambo: [-12.8, 15.7],
  huila: [-14.9, 14.9],
  "icolo-e-bengo": [-9.2, 13.8],
  "lunda-norte": [-8.8, 19.2],
  "lunda-sul": [-10.3, 20.4],
  luanda: [-8.8, 13.2],
  malanje: [-9.5, 16.3],
  moxico: [-13.4, 20.4],
  namibe: [-15.2, 12.2],
  uige: [-7.6, 15.1],
  zaire: [-6.3, 13.4],
};

const EscolasCampo = () => {
  const { provinces, schools, loading } = useProvincesData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const provincesWithStats = useMemo(() => {
    return provinces.map((p) => {
      const provSchools = schools.filter((s) => s.province_id === p.id);
      const activeSchools = provSchools.filter((s) => s.status === "Ativa").length;
      return {
        ...p,
        schoolCount: provSchools.length,
        activeSchoolCount: activeSchools,
        inactiveSchoolCount: provSchools.length - activeSchools,
        farmerCount: provSchools.reduce((sum, s) => sum + s.total_farmers, 0),
      };
    });
  }, [provinces, schools]);

  const totals = useMemo(() => {
    const totalSchools = schools.length;
    const activeSchools = schools.filter((s) => s.status === "Ativa").length;
    const totalFarmers = schools.reduce((sum, s) => sum + s.total_farmers, 0);
    const activeProvinces = provincesWithStats.filter((p) => p.schoolCount > 0).length;
    return { totalSchools, activeSchools, inactiveSchools: totalSchools - activeSchools, totalFarmers, activeProvinces };
  }, [schools, provincesWithStats]);

  const filtered = useMemo(() => {
    let result = provincesWithStats;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.capital.toLowerCase().includes(q));
    }
    if (statusFilter === "com_escolas") result = result.filter((p) => p.schoolCount > 0);
    if (statusFilter === "sem_escolas") result = result.filter((p) => p.schoolCount === 0);
    return result;
  }, [provincesWithStats, search, statusFilter]);

  /* ─── Leaflet map ─── */
  useEffect(() => {
    if (loading || !mapRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([-12.0, 17.0], 5);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 10,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [loading]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    provincesWithStats.forEach((p) => {
      const coords = PROVINCE_COORDS[p.slug];
      if (!coords || p.schoolCount === 0) return;

      const isHovered = hoveredProvince === p.slug;
      const size = Math.max(24, Math.min(48, 20 + p.schoolCount * 4));
      const icon = L.divIcon({
        className: "custom-map-marker",
        html: `<div style="
          width:${isHovered ? size + 8 : size}px;height:${isHovered ? size + 8 : size}px;
          background:hsl(130 55% ${isHovered ? "25%" : "30%"});
          border:3px solid hsl(130 55% ${isHovered ? "20%" : "40%"});
          border-radius:50%;display:flex;align-items:center;justify-content:center;
          color:white;font-weight:700;font-size:${isHovered ? 14 : 12}px;
          box-shadow:0 2px 8px rgba(0,0,0,${isHovered ? 0.4 : 0.25});
          transition:all 0.2s;cursor:pointer;
        ">${p.schoolCount}</div>`,
        iconSize: [isHovered ? size + 8 : size, isHovered ? size + 8 : size],
        iconAnchor: [(isHovered ? size + 8 : size) / 2, (isHovered ? size + 8 : size) / 2],
      });

      const marker = L.marker(coords, { icon })
        .bindTooltip(`<strong>${p.name}</strong><br/>${p.schoolCount} escolas · ${p.farmerCount} produtores`, { direction: "top", offset: [0, -size / 2] })
        .addTo(map);

      marker.on("click", () => {
        window.location.href = `/escolas/provincia/${p.slug}`;
      });

      markersRef.current.push(marker);
    });
  }, [provincesWithStats, hoveredProvince]);

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-3 md:p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-[280px] md:h-[360px] w-full rounded-none" />
        </Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-[200px]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4 md:p-5 h-full flex flex-col border-2 border-transparent">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full mb-3" />
              <div className="flex items-center gap-4 pt-3 border-t border-border mt-auto">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total Escolas", value: totals.totalSchools, icon: School, color: "text-primary", bg: "bg-primary/10" },
    { label: "Escolas Ativas", value: totals.activeSchools, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
    { label: "Escolas Inativas", value: totals.inactiveSchools, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Total Produtores", value: totals.totalFarmers, icon: Users, color: "text-info", bg: "bg-info/10" },
    { label: "Províncias Ativas", value: totals.activeProvinces, icon: Globe, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title text-xl md:text-2xl flex items-center gap-2">
            <School className="h-6 w-6 text-primary" />
            Escolas de Campo
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-1">
            Gestão e acompanhamento das escolas de campo por província
          </p>
        </div>
        <ValidateSchoolCountsButton />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-3 md:p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-lg md:text-xl font-bold font-heading leading-none">{s.value.toLocaleString("pt-AO")}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Map */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-sm">Mapa de Escolas por Província</h2>
          </div>
          <div ref={mapRef} className="h-[280px] md:h-[360px] w-full" />
        </Card>
      </motion.div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            placeholder="Pesquisar província ou capital..."
            className="pl-10 bg-muted border-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as províncias</SelectItem>
            <SelectItem value="com_escolas">Com escolas</SelectItem>
            <SelectItem value="sem_escolas">Sem escolas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Province Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {filtered.map((province, i) => (
          <motion.div
            key={province.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.025 }}
            onMouseEnter={() => setHoveredProvince(province.slug)}
            onMouseLeave={() => setHoveredProvince(null)}
            className="h-full"
          >
            <Link to={`/escolas/provincia/${province.slug}`} className="block h-full">
              <Card className={`p-4 md:p-5 h-full flex flex-col hover:shadow-lg transition-all cursor-pointer border-2 ${
                hoveredProvince === province.slug ? "border-primary shadow-md" : "border-transparent hover:border-primary/30"
              }`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-bold text-sm md:text-base leading-tight break-words">{province.name}</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{province.capital}</span>
                    </p>
                  </div>
                  {province.schoolCount > 0 ? (
                    <Badge variant="default" className="text-xs whitespace-nowrap shrink-0">
                      {province.activeSchoolCount} ativas
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                      Sem escolas
                    </Badge>
                  )}
                </div>

                {/* Mini bar chart — sempre presente para manter altura consistente */}
                <div className="mb-3">
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                    {province.schoolCount > 0 && (
                      <>
                        <div
                          className="bg-primary rounded-full transition-all"
                          style={{ width: `${(province.activeSchoolCount / Math.max(province.schoolCount, 1)) * 100}%` }}
                        />
                        {province.inactiveSchoolCount > 0 && (
                          <div
                            className="bg-destructive/40 rounded-full"
                            style={{ width: `${(province.inactiveSchoolCount / Math.max(province.schoolCount, 1)) * 100}%` }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap pt-3 border-t border-border mt-auto">
                  <div className="flex items-center gap-1.5 text-xs md:text-sm">
                    <School className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold">{province.schoolCount}</span>
                    <span className="text-muted-foreground text-[10px] md:text-xs">escolas</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs md:text-sm">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-bold">{province.farmerCount}</span>
                    <span className="text-muted-foreground text-[10px] md:text-xs">produtores</span>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma província encontrada</p>
        </div>
      )}
    </div>
  );
};

export default EscolasCampo;
