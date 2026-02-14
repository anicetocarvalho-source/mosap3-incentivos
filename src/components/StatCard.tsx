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
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold font-heading tracking-tight">{value}</p>
          {change && (
            <p className={`text-xs font-semibold ${
              changeType === "positive" ? "text-success" : changeType === "negative" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {change}
            </p>
          )}
        </div>
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg || "hsl(var(--primary) / 0.1)" }}
        >
          <Icon className="h-6 w-6" style={{ color: iconBg ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))" }} />
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
