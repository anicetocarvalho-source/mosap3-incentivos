import { useState } from "react";
import { MapPin, Search, School, ChevronRight, Plus, Trash2, Edit2, X, Building, Download, FileText, Loader2 } from "lucide-react";
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
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProvincesData, type DbProvince } from "@/hooks/useProvincesData";

const GestaoProvincias = () => {
  const [search, setSearch] = useState("");
  const [selectedProvince, setSelectedProvince] = useState<DbProvince | null>(null);
  const [newMunicipio, setNewMunicipio] = useState("");
  const [editingMunicipio, setEditingMunicipio] = useState<{ id: string; value: string } | null>(null);

  // School dialog
  const [showSchoolDialog, setShowSchoolDialog] = useState(false);
  const [schoolForm, setSchoolForm] = useState({ name: "", municipality_id: "", village: "", technician: "", phone: "" });

  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const {
    provinces, municipalities, schools, loading,
    getMunicipalitiesByProvince, getSchoolsByProvince,
    addMunicipality, updateMunicipality, deleteMunicipality,
    addSchool,
  } = useProvincesData();

  const filtered = provinces.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.capital.toLowerCase().includes(search.toLowerCase())
  );

  const totalEscolas = schools.length;
  const totalProdutores = schools.reduce((a, s) => a + s.total_farmers, 0);
  const totalMunicipios = municipalities.length;

  const selectedMunicipalities = selectedProvince ? getMunicipalitiesByProvince(selectedProvince.id) : [];
  const selectedSchools = selectedProvince ? getSchoolsByProvince(selectedProvince.id) : [];

  const handleAddMunicipio = async () => {
    if (!selectedProvince || !newMunicipio.trim()) return;
    const trimmed = newMunicipio.trim();
    if (selectedMunicipalities.some((m) => m.name === trimmed)) {
      toast({ title: "Duplicado", description: "Este município já existe.", variant: "destructive" });
      return;
    }
    try {
      await addMunicipality(trimmed, selectedProvince.id);
      setNewMunicipio("");
      toast({ title: "Município adicionado", description: `${trimmed} foi adicionado a ${selectedProvince.name}.` });
    } catch {
      toast({ title: "Erro", description: "Não foi possível adicionar o município.", variant: "destructive" });
    }
  };

  const handleRemoveMunicipio = async (id: string, name: string) => {
    try {
      await deleteMunicipality(id);
      toast({ title: "Município removido", description: `${name} foi removido.` });
    } catch {
      toast({ title: "Erro", description: "Não foi possível remover. Pode ter escolas associadas.", variant: "destructive" });
    }
  };

  const handleSaveEditMunicipio = async () => {
    if (!editingMunicipio || !editingMunicipio.value.trim()) return;
    try {
      await updateMunicipality(editingMunicipio.id, editingMunicipio.value.trim());
      setEditingMunicipio(null);
      toast({ title: "Município actualizado" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível actualizar.", variant: "destructive" });
    }
  };

  const handleAddSchool = async () => {
    if (!selectedProvince || !schoolForm.name.trim() || !schoolForm.municipality_id) return;
    try {
      await addSchool({
        name: schoolForm.name.trim(),
        province_id: selectedProvince.id,
        municipality_id: schoolForm.municipality_id,
        village: schoolForm.village || undefined,
        technician: schoolForm.technician || undefined,
        technician_phone: schoolForm.phone || undefined,
      });
      setShowSchoolDialog(false);
      setSchoolForm({ name: "", municipality_id: "", village: "", technician: "", phone: "" });
      toast({ title: "Escola registada", description: `${schoolForm.name} foi adicionada com sucesso.` });
    } catch {
      toast({ title: "Erro", description: "Não foi possível registar a escola.", variant: "destructive" });
    }
  };

  // Export helpers
  const downloadFile = (content: string, filename: string, type: string) => {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMunicipiosCSV = () => {
    const header = "Província;Município\n";
    const rows = provinces
      .flatMap((p) => getMunicipalitiesByProvince(p.id).map((m) => `${p.name};${m.name}`))
      .join("\n");
    downloadFile(header + rows, "municipios.csv", "text/csv;charset=utf-8");
    toast({ title: "Exportado", description: "Lista de municípios exportada em CSV." });
  };

  const exportEscolasCSV = () => {
    const header = "Província;Município;Escola;Técnico;Telefone;Produtores;Estado\n";
    const rows = schools.map((s) => {
      const prov = provinces.find((p) => p.id === s.province_id);
      const mun = municipalities.find((m) => m.id === s.municipality_id);
      return `${prov?.name ?? ""};${mun?.name ?? ""};${s.name};${s.technician ?? ""};${s.technician_phone ?? ""};${s.total_farmers};${s.status}`;
    }).join("\n");
    downloadFile(header + rows, "escolas_campo.csv", "text/csv;charset=utf-8");
    toast({ title: "Exportado", description: "Lista de escolas exportada em CSV." });
  };

  const exportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const municipiosRows = provinces
      .flatMap((p) => getMunicipalitiesByProvince(p.id).map((m) => `<tr><td>${p.name}</td><td>${m.name}</td></tr>`))
      .join("");

    const escolasRows = schools.map((s) => {
      const prov = provinces.find((p) => p.id === s.province_id);
      const mun = municipalities.find((m) => m.id === s.municipality_id);
      return `<tr><td>${prov?.name ?? ""}</td><td>${mun?.name ?? ""}</td><td>${s.name}</td><td>${s.technician ?? ""}</td><td>${s.total_farmers}</td><td>${s.status}</td></tr>`;
    }).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>MOSAP3 — Províncias, Municípios e Escolas</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin-top: 24px; margin-bottom: 8px; color: #2d6a2e; }
        p.sub { font-size: 11px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #2d6a2e; color: white; font-weight: 600; }
        tr:nth-child(even) { background: #f9f9f9; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>MOSAP3 — Províncias, Municípios e Escolas de Campo</h1>
      <p class="sub">Exportado em ${new Date().toLocaleDateString("pt-AO")}</p>
      <h2>Municípios (${totalMunicipios})</h2>
      <table><thead><tr><th>Província</th><th>Município</th></tr></thead><tbody>${municipiosRows}</tbody></table>
      <h2>Escolas de Campo (${totalEscolas})</h2>
      <table><thead><tr><th>Província</th><th>Município</th><th>Escola</th><th>Técnico</th><th>Produtores</th><th>Estado</th></tr></thead><tbody>${escolasRows}</tbody></table>
      </body></html>`);
    printWindow.document.close();
    printWindow.print();
    toast({ title: "PDF gerado", description: "Use a opção 'Guardar como PDF' na janela de impressão." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Gestão de Províncias</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral das províncias, municípios e cobertura do programa
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportMunicipiosCSV}>
            <Download className="h-3.5 w-3.5" />
            Municípios CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportEscolasCSV}>
            <Download className="h-3.5 w-3.5" />
            Escolas CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPDF}>
            <FileText className="h-3.5 w-3.5" />
            Exportar PDF
          </Button>
        </div>
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
        {filtered.map((prov) => {
          const provMunicipalities = getMunicipalitiesByProvince(prov.id);
          const provSchools = getSchoolsByProvince(prov.id);
          const provFarmers = provSchools.reduce((a, s) => a + s.total_farmers, 0);
          return (
            <Card
              key={prov.id}
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
                  <p className="text-sm font-bold">{provMunicipalities.length}</p>
                  <p className="text-[10px] text-muted-foreground">Municípios</p>
                </div>
                <div className="text-center bg-muted/50 rounded-md py-2">
                  <p className="text-sm font-bold">{provSchools.length}</p>
                  <p className="text-[10px] text-muted-foreground">Escolas</p>
                </div>
                <div className="text-center bg-muted/50 rounded-md py-2">
                  <p className="text-sm font-bold">{provFarmers}</p>
                  <p className="text-[10px] text-muted-foreground">Produtores</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {provMunicipalities.slice(0, 4).map((m) => (
                  <Badge key={m.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {m.name}
                  </Badge>
                ))}
                {provMunicipalities.length > 4 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    +{provMunicipalities.length - 4}
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
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
                    Municípios ({selectedMunicipalities.length})
                  </h3>
                </div>
                <Separator />

                <div className="space-y-1.5">
                  {selectedMunicipalities.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 group/item"
                    >
                      {editingMunicipio?.id === m.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingMunicipio.value}
                            onChange={(e) => setEditingMunicipio({ id: m.id, value: e.target.value })}
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
                          <span className="text-sm">{m.name}</span>
                          {isAdmin && (
                            <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingMunicipio({ id: m.id, value: m.name })}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveMunicipio(m.id, m.name)}
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
                    Escolas de Campo ({selectedSchools.length})
                  </h3>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowSchoolDialog(true)}>
                      <Plus className="h-3 w-3" />
                      Nova Escola
                    </Button>
                  )}
                </div>
                <Separator />

                {selectedSchools.length > 0 ? (
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
                      {selectedSchools.map((s) => {
                        const mun = municipalities.find((m) => m.id === s.municipality_id);
                        return (
                          <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="text-sm font-medium">{s.name}</TableCell>
                            <TableCell className="text-sm">{mun?.name ?? ""}</TableCell>
                            <TableCell className="text-sm">{s.technician ?? ""}</TableCell>
                            <TableCell className="text-sm text-center">{s.total_farmers}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={s.status === "Ativa" ? "default" : "secondary"} className="text-[10px]">
                                {s.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                value={schoolForm.municipality_id}
                onValueChange={(v) => setSchoolForm((f) => ({ ...f, municipality_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar município" /></SelectTrigger>
                <SelectContent>
                  {selectedMunicipalities.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
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
            <Button onClick={handleAddSchool} disabled={!schoolForm.name.trim() || !schoolForm.municipality_id}>
              Registar Escola
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestaoProvincias;
