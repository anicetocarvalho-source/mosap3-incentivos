import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Search, Filter, Edit2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface FarmerPatec {
  id: string;
  code: string;
  full_name: string;
  province: string | null;
  municipality: string | null;
  school: string | null;
  patec: number | null;
  status: string;
}

const patecInfo: Record<number, { title: string; color: string; cultures: string; insumos: string[]; pecuaria: string[]; servicos: string[] }> = {
  1: {
    title: "PATEC 1 — Milho + Feijão + Gado",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    cultures: "Milho + Feijão",
    insumos: [
      "Semente de milho", "Semente de feijão", "Adubo composto", "Adubo simples",
      "Insecticida, fungicida", "Enxada, Catana, Lima, Ancinho, Machado, Carro de mão",
    ],
    pecuaria: [
      "Cabra, Ovelha, Galinha, Boi", "Ração animal", "Vitaminas, Antibióticos",
      "Brincos", "Rede galinheiro", "Pregos, Chapas",
    ],
    servicos: [
      "Preparação de terra mecanizada", "Amanhos culturais",
      "Transporte para escoamento da produção",
    ],
  },
  2: {
    title: "PATEC 2 — Massango + Feijão + Gado",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cultures: "Massango + Feijão",
    insumos: [
      "Semente de massango", "Semente de feijão", "Adubo composto", "Adubo simples",
      "Insecticida, fungicida", "Enxada, Catana, Lima, Ancinho, Machado, Carro de mão",
    ],
    pecuaria: [
      "Cabra, Ovelha, Galinha, Boi", "Ração animal", "Rede galinheiro",
      "Vitaminas, Antibióticos", "Brincos", "Pregos, Chapas",
    ],
    servicos: [
      "Preparação de terra mecanizada", "Amanhos culturais",
      "Transporte para escoamento da produção",
    ],
  },
  3: {
    title: "PATEC 3 — Massambala + Feijão + Gado",
    color: "bg-violet-100 text-violet-800 border-violet-300",
    cultures: "Massambala + Feijão",
    insumos: [
      "Semente de massambala", "Semente de feijão", "Adubo composto", "Adubo simples",
      "Insecticida, fungicida", "Enxada, Catana, Lima, Ancinho, Machado, Carro de mão",
    ],
    pecuaria: [
      "Cabra, Ovelha, Galinha, Boi", "Ração animal", "Rede galinheiro",
      "Vitaminas, Antibióticos", "Brincos", "Pregos, Chapas",
    ],
    servicos: [
      "Preparação de terra mecanizada", "Amanhos culturais",
      "Transporte para escoamento da produção",
    ],
  },
};

const Patec = () => {
  const [farmers, setFarmers] = useState<FarmerPatec[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPatec, setFilterPatec] = useState<string>("all");
  const [editFarmer, setEditFarmer] = useState<FarmerPatec | null>(null);
  const [editPatec, setEditPatec] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [viewPatec, setViewPatec] = useState<number | null>(null);

  const fetchFarmers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("farmers")
      .select("id, code, full_name, province, municipality, school, patec, status")
      .order("code");
    setFarmers((data as FarmerPatec[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFarmers(); }, []);

  const filtered = farmers.filter((f) => {
    const matchesSearch =
      f.full_name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase());
    const matchesPatec =
      filterPatec === "all" ||
      (filterPatec === "none" && !f.patec) ||
      String(f.patec) === filterPatec;
    return matchesSearch && matchesPatec;
  });

  const stats = {
    total: farmers.length,
    patec1: farmers.filter((f) => f.patec === 1).length,
    patec2: farmers.filter((f) => f.patec === 2).length,
    patec3: farmers.filter((f) => f.patec === 3).length,
    semPatec: farmers.filter((f) => !f.patec).length,
  };

  const handleSavePatec = async () => {
    if (!editFarmer) return;
    setSaving(true);
    const newPatec = editPatec ? parseInt(editPatec) : null;
    const { error } = await supabase
      .from("farmers")
      .update({ patec: newPatec })
      .eq("id", editFarmer.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atribuir PATEC");
    } else {
      toast.success(`PATEC ${newPatec || "removido"} atribuído a ${editFarmer.full_name}`);
      setEditFarmer(null);
      fetchFarmers();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          Pacotes Tecnológicos (PATEC)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestão e atribuição dos pacotes tecnológicos aos produtores — Ano de Arranque MOSAP III
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterPatec("all")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Produtores</p>
          </CardContent>
        </Card>
        {[1, 2, 3].map((p) => (
          <Card key={p} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterPatec(String(p))}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{p === 1 ? stats.patec1 : p === 2 ? stats.patec2 : stats.patec3}</p>
              <p className="text-xs text-muted-foreground">PATEC {p}</p>
              <Badge variant="outline" className={`mt-1 text-[10px] ${patecInfo[p].color}`}>
                {patecInfo[p].cultures}
              </Badge>
            </CardContent>
          </Card>
        ))}
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setFilterPatec("none")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.semPatec}</p>
            <p className="text-xs text-muted-foreground">Sem PATEC</p>
          </CardContent>
        </Card>
      </div>

      {/* Composition cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((p) => (
          <Card key={p} className="border-l-4" style={{ borderLeftColor: p === 1 ? "hsl(var(--chart-1))" : p === 2 ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                {patecInfo[p].title}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewPatec(p)}>
                  <Eye className="h-3 w-3 mr-1" /> Detalhes
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div>
                <p className="font-semibold text-muted-foreground mb-1">Insumos</p>
                <p className="leading-relaxed">{patecInfo[p].insumos.slice(0, 3).join(", ")}…</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground mb-1">Pecuária</p>
                <p className="leading-relaxed">{patecInfo[p].pecuaria[0]}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground mb-1">Serviços</p>
                <p className="leading-relaxed">{patecInfo[p].servicos.join(", ")}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterPatec} onValueChange={setFilterPatec}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar PATEC" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="1">PATEC 1 — Milho</SelectItem>
            <SelectItem value="2">PATEC 2 — Massango</SelectItem>
            <SelectItem value="3">PATEC 3 — Massambala</SelectItem>
            <SelectItem value="none">Sem PATEC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Província</TableHead>
                <TableHead>Escola</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>PATEC</TableHead>
                <TableHead className="text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produtor encontrado</TableCell></TableRow>
              ) : filtered.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.code}</TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/agricultores/${f.code}`} className="text-primary hover:underline">{f.full_name}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.province || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.school || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === "Ativo" ? "default" : "secondary"} className="text-[10px]">{f.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {f.patec ? (
                      <Badge variant="outline" className={`text-[10px] ${patecInfo[f.patec]?.color || ""}`}>
                        PATEC {f.patec}
                      </Badge>
                    ) : (
                      <span className="text-xs text-destructive font-medium">Não atribuído</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditFarmer(f); setEditPatec(f.patec ? String(f.patec) : ""); }}>
                      <Edit2 className="h-3 w-3 mr-1" /> Atribuir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editFarmer} onOpenChange={(o) => !o && setEditFarmer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir PATEC — {editFarmer?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Código: <span className="font-mono font-semibold">{editFarmer?.code}</span>
            </p>
            <Select value={editPatec} onValueChange={setEditPatec}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar PATEC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">PATEC 1 — Milho + Feijão + Gado</SelectItem>
                <SelectItem value="2">PATEC 2 — Massango + Feijão + Gado</SelectItem>
                <SelectItem value="3">PATEC 3 — Massambala + Feijão + Gado</SelectItem>
              </SelectContent>
            </Select>
            {editPatec && patecInfo[parseInt(editPatec)] && (
              <div className="border rounded-lg p-3 text-xs space-y-2 bg-muted/30">
                <p className="font-semibold">{patecInfo[parseInt(editPatec)].title}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Insumos</p>
                    <ul className="space-y-0.5">{patecInfo[parseInt(editPatec)].insumos.map((i, idx) => <li key={idx}>• {i}</li>)}</ul>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Pecuária</p>
                    <ul className="space-y-0.5">{patecInfo[parseInt(editPatec)].pecuaria.map((i, idx) => <li key={idx}>• {i}</li>)}</ul>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Serviços</p>
                    <ul className="space-y-0.5">{patecInfo[parseInt(editPatec)].servicos.map((i, idx) => <li key={idx}>• {i}</li>)}</ul>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFarmer(null)}>Cancelar</Button>
            <Button onClick={handleSavePatec} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View PATEC detail Dialog */}
      <Dialog open={viewPatec !== null} onOpenChange={(o) => !o && setViewPatec(null)}>
        <DialogContent className="max-w-lg">
          {viewPatec && patecInfo[viewPatec] && (
            <>
              <DialogHeader>
                <DialogTitle>{patecInfo[viewPatec].title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2 text-sm">
                <div>
                  <h3 className="font-semibold mb-2 text-primary">Insumos Agrícolas</h3>
                  <ul className="space-y-1">{patecInfo[viewPatec].insumos.map((i, idx) => <li key={idx} className="flex items-start gap-2"><span className="text-primary">•</span>{i}</li>)}</ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-primary">Pecuária e Materiais</h3>
                  <ul className="space-y-1">{patecInfo[viewPatec].pecuaria.map((i, idx) => <li key={idx} className="flex items-start gap-2"><span className="text-primary">•</span>{i}</li>)}</ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-primary">Serviços Incluídos</h3>
                  <ul className="space-y-1">{patecInfo[viewPatec].servicos.map((i, idx) => <li key={idx} className="flex items-start gap-2"><span className="text-primary">•</span>{i}</li>)}</ul>
                </div>
                <div className="text-xs text-muted-foreground border-t pt-3">
                  Produtores com este pacote: <span className="font-bold">{farmers.filter((f) => f.patec === viewPatec).length}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Patec;
