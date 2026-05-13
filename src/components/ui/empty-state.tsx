import { type LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Default: "Sem dados registados" */
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Compact = uso dentro de tabelas/listas; default = páginas inteiras. */
  size?: "default" | "sm";
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Sem dados registados",
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  const compact = size === "sm";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-4",
        compact ? "py-6" : "py-12",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted/60 flex items-center justify-center",
          compact ? "mb-2 h-10 w-10" : "mb-4 h-16 w-16",
        )}
      >
        <Icon className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-8 w-8")} />
      </div>
      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-sm" : "text-base mb-1",
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-sm",
            compact ? "text-xs mt-0.5" : "text-sm mb-4",
          )}
        >
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm" className={compact ? "mt-3" : ""}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
