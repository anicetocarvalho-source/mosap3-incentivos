import { useState } from "react";
import { MapPin, Search, School, Users, ChevronRight, Plus, Trash2, Edit2, X, Building } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { provinces as initialProvinces, allSchools, type ProvinceInfo, type School as SchoolType } from "@/data/escolasData";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const GestaoProvincias = () => {
  const [search, setSearch] = useState("");
  const [provincesData, setProvincesData] = useState<ProvinceInfo[]>(initialProvinces);
  const [selectedProvince, setSelectedProvince] = useState<ProvinceInfo | null>(null);
  const [newMunicipio, setNewMunicipio] = useState("");
  const [editingMunicipio, setEditingMunicipio] = useState<{ index: number; value: string } | null>(null);

  // School dialog
  const [showSchoolDialog, setShowSchoolDialog] = useState(false);
  const [schoolForm, setSchoolForm] = useState({ name: "", municipality: "", village: "", technician: "", phone: "" });

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const filtered = provincesData.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.capital.toLowerCase().includes(search.toLowerCase())
  );

  const totalEscolas = provincesData.reduce((a, p) => a + p.schools, 0);
  const totalProdutores = provincesData.reduce((a, p) => a + p.farmers, 0);
  const totalMunicipios = provincesData.reduce((a, p) => a + p.municipalities.length, 0);

  const provinceSchools = selectedProvince
    ? allSchools.filter((s) => s.provinceSlug === selectedProvince.slug)
    : [];

  const handleAddMunicipio = () => {
    if (!selectedProvince || !newMunicipio.trim()) return;
    const trimmed = newMunicipio.trim();
    if (selectedProvince.municipalities.includes(trimmed)) {
      toast({ title: "Duplicado", description: "Este município já existe.", variant: "destructive" });
      return;
    }
    setProvincesData((prev) =>
      prev.map((p) =>
        p.slug === selectedProvince.slug
          ? { ...p, municipalities: [...p.municipalities, trimmed] }
          : p
      )
    );
    setSelectedProvince((prev) =>
      prev ? { ...prev, municipalities: [...prev.municipalities, trimmed] } : prev
    );
    setNewMunicipio("");
    toast({ title: "Município adicionado", description: `${trimmed} foi adicionado a ${selectedProvince.name}.` });
  };

  const handleRemoveMunicipio = (index: number) => {
    if (!selectedProvince) return;
    const name = selectedProvince.municipalities[index];
    const updated = selectedProvince.municipalities.filter((_, i) => i !== index);
    setProvincesData((prev) =>
      prev.map((p) =>
        p.slug === selectedProvince.slug ? { ...p, municipalities: updated } : p
      )
    );
    setSelectedProvince((prev) => (prev ? { ...prev, municipalities: updated } : prev));
    toast({ title: "Município removido", description: `${name} foi removido.` });
  };

  const handleSaveEditMunicipio = () => {
    if (!selectedProvince || !editingMunicipio || !editingMunicipio.value.trim()) return;
    const updated = [...selectedProvince.municipalities];
    updated[editingMunicipio.index] = editingMunicipio.value.trim();
    setProvincesData((prev) =>
      prev.map((p) =>
        p.slug === selectedProvince.slug ? { ...p, municipalities: updated } : p
      )
    );
    setSelectedProvince((prev) => (prev ? { ...prev, municipalities: updated } : prev));
    setEditingMunicipio(null);
    toast({ title: "Município actualizado" });
  };

  const handleAddSchool = () => {
    if (!selectedProvince || !schoolForm.name.trim() || !schoolForm.municipality) return;
    toast({
      title: "Escola adicionada (demo)",
      description: `${schoolForm.name} foi registada em ${selectedProvince.name}. Para persistir, conecte à base de dados.`,
    });
    setShowSchoolDialog(false);
    setSchoolForm({ name: "", municipality: "", village: "", technician: "", phone: "" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Gestão de Províncias</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geral das províncias, municípios e cobertura do programa
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{provincesData.length}</p>
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
            onClick={() => setSelectedProvince(prov)}
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

      {/* Province Detail Dialog */}
      <Dialog open={!!selectedProvince} onOpenChange={(open) => !open && setSelectedProvince(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedProvince && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  {selectedProvince.name}
                </DialogTitle>
                <DialogDescription>Capital: {selectedProvince.capital}</DialogDescription>
              </DialogHeader>

              {/* Municipalities Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" />
                    Municípios ({selectedProvince.municipalities.length})
                  </h3>
                </div>
                <Separator />

                <div className="space-y-1.5">
                  {selectedProvince.municipalities.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 group/item"
                    >
                      {editingMunicipio?.index === i ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingMunicipio.value}
                            onChange={(e) => setEditingMunicipio({ index: i, value: e.target.value })}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleSaveEditMunicipio()}
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveEditMunicipio}>
                            Guardar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingMunicipio(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm">{m}</span>
                          {isAdmin && (
                            <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingMunicipio({ index: i, value: m })}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveMunicipio(i)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Novo município..."
                      value={newMunicipio}
                      onChange={(e) => setNewMunicipio(e.target.value)}
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && handleAddMunicipio()}
                    />
                    <Button size="sm" className="h-8 gap-1" onClick={handleAddMunicipio} disabled={!newMunicipio.trim()}>
                      <Plus className="h-3 w-3" />
                      Adicionar
                    </Button>
                  </div>
                )}
              </div>

              {/* Schools Section */}
              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <School className="h-4 w-4 text-primary" />
                    Escolas de Campo ({provinceSchools.length})
                  </h3>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowSchoolDialog(true)}>
                      <Plus className="h-3 w-3" />
                      Nova Escola
                    </Button>
                  )}
                </div>
                <Separator />

                {provinceSchools.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">Município</TableHead>
                        <TableHead className="text-xs">Técnico</TableHead>
                        <TableHead className="text-xs text-center">Produtores</TableHead>
                        <TableHead className="text-xs text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provinceSchools.map((s) => (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/escolas/${s.id}`)}
                        >
                          <TableCell className="text-sm font-medium">{s.name}</TableCell>
                          <TableCell className="text-sm">{s.municipality}</TableCell>
                          <TableCell className="text-sm">{s.technician}</TableCell>
                          <TableCell className="text-sm text-center">{s.totalFarmers}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={s.status === "Ativa" ? "default" : "secondary"} className="text-[10px]">
                              {s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma escola registada nesta província.
                  </p>
                )}
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => navigate(`/escolas/provincia/${selectedProvince.slug}`)}>
                  Ver Página da Província
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New School Dialog */}
      <Dialog open={showSchoolDialog} onOpenChange={setShowSchoolDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Escola de Campo</DialogTitle>
            <DialogDescription>
              Registar uma nova escola em {selectedProvince?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Escola</Label>
              <Input
                value={schoolForm.name}
                onChange={(e) => setSchoolForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: EC Caimbambo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Município</Label>
              <Select
                value={schoolForm.municipality}
                onValueChange={(v) => setSchoolForm((f) => ({ ...f, municipality: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar município" /></SelectTrigger>
                <SelectContent>
                  {selectedProvince?.municipalities.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aldeia / Localidade</Label>
              <Input
                value={schoolForm.village}
                onChange={(e) => setSchoolForm((f) => ({ ...f, village: e.target.value }))}
                placeholder="Ex: Aldeia Saca"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Técnico Responsável</Label>
                <Input
                  value={schoolForm.technician}
                  onChange={(e) => setSchoolForm((f) => ({ ...f, technician: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={schoolForm.phone}
                  onChange={(e) => setSchoolForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+244 9XX XXX XXX"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSchoolDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddSchool} disabled={!schoolForm.name.trim() || !schoolForm.municipality}>
              Registar Escola
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestaoProvincias;
