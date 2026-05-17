import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Package, AlertCircle, CalendarDays, ListTree } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PatecFormDialog from "./PatecFormDialog";
import PatecCompositionDialog from "./PatecCompositionDialog";
import type { Patec } from "@/hooks/usePatecs";
import type { Season, PatecSeasonLink } from "@/hooks/useSeasons";

interface Props {
  patecs: Patec[];
  seasons: Season[];
  links: PatecSeasonLink[];
  farmerCounts: Record<string, number>; // by code
  isAdmin: boolean;
  refetch: () => void;
}

export default function PatecsTab({ patecs, seasons, links, farmerCounts, isAdmin, refetch }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Patec | null>(null);
  const [deleting, setDeleting] = useState<Patec | null>(null);
  const [composing, setComposing] = useState<Patec | null>(null);

  const seasonsByPatec = useMemo(() => {
    const m: Record<string, Season[]> = {};
    for (const link of links) {
      const s = seasons.find((x) => x.id === link.season_id);
      if (s) (m[link.patec_id] ||= []).push(s);
    }
    return m;
  }, [links, seasons]);

  const handleToggleActive = async (p: Patec) => {
    const { error } = await supabase.from("patecs" as any)
      .update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) toast.error("Erro ao alterar estado");
    else { toast.success(`${p.code} ${!p.is_active ? "activado" : "desactivado"}`); refetch(); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const count = farmerCounts[deleting.code] || 0;
    if (count > 0) {
      toast.error(`Não pode remover: ${count} agricultor(es) ainda atribuídos. Desactive em vez de remover.`);
      setDeleting(null);
      return;
    }
    const { error } = await supabase.from("patecs" as any).delete().eq("id", deleting.id);
    if (error) toast.error("Erro ao remover");
    else { toast.success("Pacote removido"); refetch(); }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold">Catálogo de Pacotes</h2>
          <p className="text-xs text-muted-foreground">{patecs.length} pacote(s) configurado(s)</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Novo Pacote
          </Button>
        )}
      </div>

      {patecs.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Sem pacotes. {isAdmin && "Clique em 'Novo Pacote' para começar."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {patecs.map((p) => {
            const linkedSeasons = seasonsByPatec[p.id] || [];
            const count = farmerCounts[p.code] || 0;
            const hasActiveSeason = linkedSeasons.some((s) => {
              if (!s.is_active) return false;
              const today = new Date().toISOString().slice(0, 10);
              return today >= s.start_date && today <= s.end_date;
            });
            return (
              <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                        <h3 className="font-semibold text-sm">{p.name}</h3>
                        {p.cultures && <p className="text-xs text-muted-foreground">{p.cultures}</p>}
                      </div>
                    </div>
                    {isAdmin && (
                      <Switch checked={p.is_active} onCheckedChange={() => handleToggleActive(p)} aria-label="Activar" />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">
                      {p.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {count} agricultor(es)
                    </Badge>
                    {p.is_active && !hasActiveSeason && (
                      <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">
                        <AlertCircle className="h-2.5 w-2.5 mr-1" /> Fora de época
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      <span>Épocas ({linkedSeasons.length}):</span>
                    </div>
                    {linkedSeasons.length === 0 ? (
                      <p className="text-[11px] text-warning italic ml-4">Nenhuma — vendas POS bloqueadas</p>
                    ) : (
                      <div className="flex flex-wrap gap-1 ml-4">
                        {linkedSeasons.map((s) => (
                          <Badge key={s.id} variant="outline" className="text-[10px] font-normal">{s.name}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-1.5 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs"
                        onClick={() => { setEditing(p); setFormOpen(true); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive"
                        onClick={() => setDeleting(p)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PatecFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        patec={editing}
        seasons={seasons}
        initialSeasonIds={editing ? (seasonsByPatec[editing.id] || []).map((s) => s.id) : []}
        onSaved={refetch}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pacote {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Se houver agricultores atribuídos, prefira desactivar em vez de remover.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
