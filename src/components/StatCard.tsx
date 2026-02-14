import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconBg?: string;
  variant?: "default" | "primary" | "accent" | "success";
  trend?: { value: number; label: string };
}

const variantStyles = {
  default: "bg-card border-border",
  primary: "bg-primary/5 border-primary/20",
  accent: "bg-accent border-accent/20",
  success: "bg-success/10 border-success/20",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent-foreground",
  success: "bg-success/10 text-success",
};

const StatCard = ({ title, value, subtitle, change, changeType = "neutral", icon: Icon, iconBg, variant = "default", trend }: StatCardProps) => {
  return (
    <div className={`rounded-xl border p-5 animate-fade-in ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-card-foreground font-heading">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {change && (
            <p className={`text-xs font-semibold ${
              changeType === "positive" ? "text-success" : changeType === "negative" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {change}
            </p>
          )}
          {trend && (
            <p className={`text-xs font-medium ${trend.value >= 0 ? "text-success" : "text-destructive"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${!iconBg ? iconVariantStyles[variant] : ""}`}
          style={iconBg ? { background: iconBg } : undefined}
        >
          <Icon className="h-5 w-5" style={iconBg ? { color: "hsl(var(--primary-foreground))" } : undefined} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
