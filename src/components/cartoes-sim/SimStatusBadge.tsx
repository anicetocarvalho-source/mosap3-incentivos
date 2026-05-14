import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  status?: string | null;
  className?: string;
};

const MAP: Record<string, string> = {
  Activo: "bg-success/15 text-success border-success/30",
  Removido: "bg-destructive/15 text-destructive border-destructive/30",
  Barrado: "bg-warning/15 text-warning border-warning/30",
  "Pré desactivado": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Desconhecido: "bg-muted text-muted-foreground border-border",
};

export function SimStatusBadge({ status, className }: Props) {
  const s = status || "Desconhecido";
  return (
    <Badge variant="outline" className={cn("font-medium", MAP[s] || MAP.Desconhecido, className)}>
      {s}
    </Badge>
  );
}
