import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SeasonFormDialog from "./SeasonFormDialog";
import type { Season, PatecSeasonLink } from "@/hooks/useSeasons";
import type { Patec } from "@/hooks/usePatecs";

interface Props {
  seasons: Season[];
  patecs: Patec[];
  links: PatecSeasonLink[];
  isAdmin: boolean;
  refetch: () => void;
}

export default function SeasonsTab({ seasons, patecs, links, isAdmin, refetch }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [deleting, setDeleting] = useState<Season | null>(null);

  const patecsBySeason = useMemo(() => {
    const m: Record<string, Patec[]> = {};
    for (const link of links) {
      const p = patecs.find((x) => x.id === link.patec_id);
      if (p) (m[link.season_id] ||= []).push(p);
    }
    return m;
  }, [links, patecs]);

  const handleToggleActive = async (s: Season) => {
    const { error } = await supabase.from("agricultural_seasons" as any)
      .update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) toast.error("Erro ao alterar estado");
    else { toast.success(`${s.name} ${!s.is_active ? "activada" : "desactivada"}`); refetch(); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("agricultural_seasons" as any).delete().eq("id", deleting.id);
    if (error) toast.error("Erro ao remover");
    else { toast.success("Período removido"); refetch(); }
    setDeleting(null);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold">Períodos Agrícolas</h2>
          <p className="text-xs text-muted-foreground">{seasons.length} período(s) configurado(s)</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Novo Período
          </Button>
        )}
      </div>

      {seasons.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Sem períodos. {isAdmin && "Clique em 'Novo Período' para começar."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {seasons.map((s) => {
            const linkedPatecs = patecsBySeason[s.id] || [];
            const isCurrent = s.is_active && today >= s.start_date && today <= s.end_date;
            return (
              <Card key={s.id} className={!s.is_active ? "opacity-60" : isCurrent ? "border-success/40" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CalendarDays className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{s.name}</h3>
                        <p className="text-xs text-muted-foreground">{s.start_date} → {s.end_date}</p>
                        {s.notes && <p className="text-[11px] text-muted-foreground mt-1">{s.notes}</p>}
                      </div>
                    </div>
                    {isAdmin && (
                      <Switch checked={s.is_active} onCheckedChange={() => handleToggleActive(s)} />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={s.is_active ? "default" : "secondary"} className="text-[10px]">
                      {s.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    {isCurrent && <Badge className="text-[10px] bg-success text-success-foreground">Em curso</Badge>}
                    {!isCurrent && s.is_active && today < s.start_date && (
                      <Badge variant="outline" className="text-[10px]">Futura</Badge>
                    )}
                    {!isCurrent && s.is_active && today > s.end_date && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Encerrada</Badge>
                    )}
                  </div>

                  <div className="text-xs space-y-1">
                    <span className="text-muted-foreground">Pacotes ({linkedPatecs.length}):</span>
                    {linkedPatecs.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic ml-2">Nenhum vinculado</p>
                    ) : (
                      <div className="flex flex-wrap gap-1 ml-2">
                        {linkedPatecs.map((p) => (
                          <Badge key={p.id} variant="outline" className="text-[10px] font-mono">{p.code}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex gap-1.5 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs"
                        onClick={() => { setEditing(s); setFormOpen(true); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive"
                        onClick={() => setDeleting(s)}>
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

      <SeasonFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        season={editing}
        patecs={patecs}
        initialPatecIds={editing ? (patecsBySeason[editing.id] || []).map((p) => p.id) : []}
        onSaved={refetch}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover período {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o período e os vínculos com pacotes. Pacotes só com este período terão vendas POS bloqueadas.
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
