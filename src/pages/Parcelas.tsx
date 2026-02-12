import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, MapPin, Maximize2, Eye, Layers, Map } from "lucide-react";
import ParcelasMap from "@/components/ParcelasMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const parcelasData = [
  { id: "PRC-001", farmer: "João Mateus", farmerId: "PP-14819", province: "Benguela", municipality: "Caimbambo", village: "Aldeia Saca", area: "2.5 ha", culture: "Milho", lat: "-12.5678", lon: "14.2345", status: "Verificada", season: "2025/2026" },
  { id: "PRC-002", farmer: "João Mateus", farmerId: "PP-14819", province: "Benguela", municipality: "Caimbambo", village: "Aldeia Saca", area: "2.0 ha", culture: "Feijão", lat: "-12.5690", lon: "14.2360", status: "Verificada", season: "2025/2026" },
  { id: "PRC-003", farmer: "Maria Silva", farmerId: "PP-14818", province: "Huila", municipality: "Lubango", village: "Aldeia Chibia", area: "3.2 ha", culture: "Mandioca", lat: "-14.9180", lon: "13.4920", status: "Pendente", season: "2025/2026" },
  { id: "PRC-004", farmer: "Pedro Neto", farmerId: "PP-14817", province: "Benguela", municipality: "Lobito", village: "Aldeia Hanha", area: "4.0 ha", culture: "Soja", lat: "-12.3456", lon: "13.5432", status: "Verificada", season: "2025/2026" },
  { id: "PRC-005", farmer: "Pedro Neto", farmerId: "PP-14817", province: "Benguela", municipality: "Lobito", village: "Aldeia Hanha", area: "1.8 ha", culture: "Amendoim", lat: "-12.3470", lon: "13.5445", status: "Verificada", season: "2025/2026" },
  { id: "PRC-006", farmer: "Ana Luísa", farmerId: "PP-14816", province: "Namibe", municipality: "Moçâmedes", village: "Aldeia Bero", area: "1.5 ha", culture: "Batata Doce", lat: "-15.1940", lon: "12.1520", status: "Rejeitada", season: "2025/2026" },
  { id: "PRC-007", farmer: "Teresa João", farmerId: "PP-14814", province: "Huila", municipality: "Lubango", village: "Aldeia Humpata", area: "5.0 ha", culture: "Milho", lat: "-14.8760", lon: "13.3700", status: "Verificada", season: "2025/2026" },
  { id: "PRC-008", farmer: "Manuel Costa", farmerId: "PP-14813", province: "Benguela", municipality: "Ganda", village: "Aldeia Ebanga", area: "2.8 ha", culture: "Feijão", lat: "-12.9800", lon: "14.6500", status: "Pendente", season: "2025/2026" },
  { id: "PRC-009", farmer: "Isabel Santos", farmerId: "PP-14812", province: "Cunene", municipality: "Ondjiva", village: "Aldeia Namacunde", area: "3.5 ha", culture: "Massango", lat: "-17.0650", lon: "15.7340", status: "Verificada", season: "2025/2026" },
];

const Parcelas = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showMap, setShowMap] = useState(true);

  const filtered = parcelasData.filter((p) =>
    p.farmer.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    p.culture.toLowerCase().includes(search.toLowerCase()) ||
    p.village.toLowerCase().includes(search.toLowerCase())
  );

  const totalArea = parcelasData.reduce((sum, p) => sum + parseFloat(p.area), 0);
  const totalVerificadas = parcelasData.filter(p => p.status === "Verificada").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Parcelas de Terreno</h1>
          <p className="text-muted-foreground text-sm mt-1">Georreferenciamento e gestão de parcelas agrícolas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Parcela
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Registar Parcela</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Produtor</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="Selecionar produtor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pp-14819">João Mateus (PP-14819)</SelectItem>
                    <SelectItem value="pp-14818">Maria Silva (PP-14818)</SelectItem>
                    <SelectItem value="pp-14817">Pedro Neto (PP-14817)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Área (hectares)</Label>
                  <Input placeholder="0.0" type="number" step="0.1" />
                </div>
                <div className="space-y-2">
                  <Label>Cultura</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="milho">Milho</SelectItem>
                      <SelectItem value="feijao">Feijão</SelectItem>
                      <SelectItem value="mandioca">Mandioca</SelectItem>
                      <SelectItem value="soja">Soja</SelectItem>
                      <SelectItem value="amendoim">Amendoim</SelectItem>
                      <SelectItem value="batata">Batata Doce</SelectItem>
                      <SelectItem value="massango">Massango</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input placeholder="-12.0000" />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input placeholder="14.0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Aldeia / Localidade</Label>
                <Input placeholder="Nome da aldeia" />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea placeholder="Informações adicionais sobre a parcela..." rows={3} />
              </div>
              <Button onClick={() => setDialogOpen(false)}>Registar Parcela</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Parcelas" value={String(parcelasData.length)} change="Registadas no sistema" icon={Layers} />
        <StatCard title="Área Total" value={`${totalArea.toFixed(1)} ha`} change="Hectares georreferenciados" changeType="positive" icon={Maximize2} iconBg="hsl(var(--success) / 0.15)" />
        <StatCard title="Verificadas" value={String(totalVerificadas)} change={`${Math.round(totalVerificadas / parcelasData.length * 100)}% do total`} changeType="positive" icon={MapPin} iconBg="hsl(var(--info) / 0.15)" />
        <StatCard title="Culturas" value="7" change="Tipos de cultura" changeType="neutral" icon={Layers} iconBg="hsl(var(--warning) / 0.15)" />
      </div>

      {/* Map Toggle + Map */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Map className="h-4 w-4" />
            Mapa de Parcelas — Vista Satélite
          </h2>
          <Button variant="outline" size="sm" onClick={() => setShowMap(!showMap)}>
            {showMap ? "Ocultar Mapa" : "Mostrar Mapa"}
          </Button>
        </div>
        {showMap && <ParcelasMap parcelas={parcelasData} />}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por produtor, cultura, aldeia..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select>
            <SelectTrigger className="w-40"><SelectValue placeholder="Província" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="benguela">Benguela</SelectItem>
              <SelectItem value="huila">Huila</SelectItem>
              <SelectItem value="namibe">Namibe</SelectItem>
              <SelectItem value="cunene">Cunene</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="verificada">Verificada</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="rejeitada">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produtor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Localização</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cultura</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Área</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Coordenadas</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{p.farmer}</p>
                        <p className="text-xs text-muted-foreground">{p.farmerId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm">{p.village}</p>
                        <p className="text-xs text-muted-foreground">{p.municipality}, {p.province}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{p.culture}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{p.area}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{p.lat}, {p.lon}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={
                        p.status === "Verificada" ? "badge-active" :
                        p.status === "Pendente" ? "badge-pending" : "badge-suspended"
                      }>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>A mostrar {filtered.length} de {parcelasData.length} parcelas</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Parcelas;
