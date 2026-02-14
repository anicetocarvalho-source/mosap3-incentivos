import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconBg?: string;
}

const StatCard = ({ title, value, change, changeType = "neutral", icon: Icon, iconBg }: StatCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 md:space-y-2 min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">{title}</p>
          <p className="text-xl md:text-3xl font-bold font-heading tracking-tight">{value}</p>
          {change && (
            <p className={`text-[10px] md:text-xs font-semibold ${
              changeType === "positive" ? "text-success" : changeType === "negative" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {change}
            </p>
          )}
        </div>
        <div
          className="h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg || "hsl(var(--primary) / 0.1)" }}
        >
          <Icon className="h-5 w-5 md:h-6 md:w-6" style={{ color: iconBg ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))" }} />
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
