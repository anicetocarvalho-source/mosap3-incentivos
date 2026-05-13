import { Info, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "primary" | "secondary" | "success" | "warning" | "info" | "destructive";
  delay?: number;
  /** YoY delta in %. null/undefined hides the badge. */
  delta?: number | null;
  /** Show a "sem dados registados" hint (when value is 0 because module is empty). */
  emptyHint?: boolean;
  /** Optional internal route to navigate on click. */
  to?: string;
}

const formatDelta = (n: number) => {
  const abs = Math.abs(n).toLocaleString("pt-AO", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  return `${abs}%`;
};

const accentMap: Record<NonNullable<KpiCardProps["accent"]>, { bg: string; fg: string; ring: string }> = {
  primary: { bg: "hsl(var(--primary) / 0.1)", fg: "hsl(var(--primary))", ring: "hsl(var(--primary) / 0.2)" },
  secondary: { bg: "hsl(var(--secondary) / 0.15)", fg: "hsl(38 90% 35%)", ring: "hsl(var(--secondary) / 0.3)" },
  success: { bg: "hsl(var(--success) / 0.12)", fg: "hsl(var(--success))", ring: "hsl(var(--success) / 0.25)" },
  warning: { bg: "hsl(var(--warning) / 0.12)", fg: "hsl(var(--warning))", ring: "hsl(var(--warning) / 0.25)" },
  info: { bg: "hsl(var(--info) / 0.12)", fg: "hsl(var(--info))", ring: "hsl(var(--info) / 0.25)" },
  destructive: { bg: "hsl(var(--destructive) / 0.1)", fg: "hsl(var(--destructive))", ring: "hsl(var(--destructive) / 0.2)" },
};

const KpiCard = ({ title, value, subtitle, icon: Icon, accent = "primary", delay = 0, delta, emptyHint, to }: KpiCardProps) => {
  const c = accentMap[accent];
  const navigate = useNavigate();
  const showDelta = delta !== undefined && delta !== null;
  const deltaTone =
    !showDelta ? "" :
    delta! > 0 ? "bg-success/10 text-success ring-1 ring-success/20" :
    delta! < 0 ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20" :
    "bg-muted text-muted-foreground ring-1 ring-border";
  const deltaArrow = !showDelta ? "" : delta! > 0 ? "↑" : delta! < 0 ? "↓" : "–";
  const isClickable = !!to;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      onClick={isClickable ? () => navigate(to!) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter") navigate(to!); } : undefined}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 md:p-5",
        "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all",
        isClickable && "cursor-pointer hover:border-primary/40",
      )}
    >
      {/* accent stripe */}
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: `linear-gradient(90deg, ${c.fg}, transparent)` }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {showDelta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                  deltaTone,
                )}
                title="Variação vs. período homólogo (ano anterior)"
              >
                <span aria-hidden>{deltaArrow}</span>
                {delta !== 0 && formatDelta(delta!)}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium">{subtitle}</p>
          )}
          {emptyHint && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
              <Info className="h-3 w-3" /> Sem dados registados
            </span>
          )}
        </div>
        <div
          className="flex h-11 w-11 md:h-12 md:w-12 flex-shrink-0 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-105"
          style={{ background: c.bg, boxShadow: `inset 0 0 0 1px ${c.ring}` }}
        >
          <Icon className="h-5 w-5 md:h-6 md:w-6" style={{ color: c.fg }} />
        </div>
      </div>
    </motion.div>
  );
};

export default KpiCard;
