import { motion } from "framer-motion";
import { Filter, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HeroHeaderProps {
  roleName: string;
  filterScope: "global" | "province" | "eca" | string;
  filterLabel?: string;
  volumeFormatted: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const HeroHeader = ({ roleName, filterScope, filterLabel, volumeFormatted, onRefresh, refreshing }: HeroHeaderProps) => {
  const today = new Date().toLocaleDateString("pt-AO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-border/50"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Decorative gold glow */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: "hsl(var(--secondary))" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full opacity-10 blur-3xl"
        style={{ background: "hsl(var(--primary))" }}
      />

      <div className="relative p-5 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: "hsl(var(--secondary) / 0.2)" }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(var(--secondary))" }} />
              </div>
              <span
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: "hsl(var(--secondary))" }}
              >
                Painel Executivo
              </span>
            </div>
            <h1
              className="font-heading text-2xl font-bold tracking-tight md:text-4xl"
              style={{ color: "hsl(var(--sidebar-foreground))" }}
            >
              Bem-vindo de volta
            </h1>
            <p className="text-xs md:text-sm capitalize" style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}>
              {today} · {roleName}
            </p>
            {filterScope !== "global" && filterLabel && (
              <Badge
                variant="outline"
                className="mt-1 flex w-fit items-center gap-1.5 border-white/20 bg-white/5 text-xs"
                style={{ color: "hsl(var(--sidebar-foreground))" }}
              >
                <Filter className="h-3 w-3" />
                {filterScope === "province" ? "Províncias" : "ECAs"}: {filterLabel}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
                className="border-white/20 bg-white/5 text-[hsl(var(--sidebar-foreground))] hover:bg-white/10"
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            )}
            <div
              className="rounded-xl border border-white/10 p-4 md:p-5 backdrop-blur-sm min-w-[260px]"
              style={{ background: "hsl(0 0% 100% / 0.06)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: "var(--gradient-gold)" }}
                >
                  <TrendingUp className="h-6 w-6" style={{ color: "hsl(var(--secondary-foreground))" }} />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "hsl(var(--sidebar-foreground) / 0.6)" }}
                  >
                    Volume Movimentado
                  </p>
                  <p
                    className="font-heading text-xl md:text-2xl font-bold tracking-tight truncate"
                    style={{ color: "hsl(var(--sidebar-foreground))" }}
                  >
                    {volumeFormatted}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HeroHeader;
