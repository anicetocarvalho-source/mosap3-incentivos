import { ReactNode } from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
  children?: ReactNode;
}

const PageHeader = ({ title, description, icon: Icon, actions, children }: PageHeaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-5 md:mb-6"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {Icon && (
          <div className="hidden md:flex h-10 w-10 flex-shrink-0 rounded-xl bg-primary/10 items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
          {children}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </motion.div>
  );
};

export default PageHeader;
