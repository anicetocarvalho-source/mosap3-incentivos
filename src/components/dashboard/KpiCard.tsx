import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "primary" | "secondary" | "success" | "warning" | "info" | "destructive";
  delay?: number;
}

const accentMap: Record<NonNullable<KpiCardProps["accent"]>, { bg: string; fg: string; ring: string }> = {
  primary: { bg: "hsl(var(--primary) / 0.1)", fg: "hsl(var(--primary))", ring: "hsl(var(--primary) / 0.2)" },
  secondary: { bg: "hsl(var(--secondary) / 0.15)", fg: "hsl(38 90% 35%)", ring: "hsl(var(--secondary) / 0.3)" },
  success: { bg: "hsl(var(--success) / 0.12)", fg: "hsl(var(--success))", ring: "hsl(var(--success) / 0.25)" },
  warning: { bg: "hsl(var(--warning) / 0.12)", fg: "hsl(var(--warning))", ring: "hsl(var(--warning) / 0.25)" },
  info: { bg: "hsl(var(--info) / 0.12)", fg: "hsl(var(--info))", ring: "hsl(var(--info) / 0.25)" },
  destructive: { bg: "hsl(var(--destructive) / 0.1)", fg: "hsl(var(--destructive))", ring: "hsl(var(--destructive) / 0.2)" },
};

const KpiCard = ({ title, value, subtitle, icon: Icon, accent = "primary", delay = 0 }: KpiCardProps) => {
  const c = accentMap[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-4 md:p-5",
        "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all"
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
          <p className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] md:text-xs text-muted-foreground font-medium">{subtitle}</p>
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
