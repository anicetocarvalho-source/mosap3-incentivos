import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  delay?: number;
  children: ReactNode;
  action?: ReactNode;
}

const ChartCard = ({ title, description, icon: Icon, delay = 0, children, action }: ChartCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow"
  >
    <div className="mb-4 md:mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent">
            <Icon className="h-4 w-4 text-accent-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-heading text-sm md:text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[11px] md:text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
    {children}
  </motion.div>
);

export default ChartCard;
