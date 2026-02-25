import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  ArrowLeftRight,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserPlus,
  School,
  Wheat,
  Gift,
  ShoppingCart,
  MapPin,
  Smartphone,
  FileText,
  Package,
} from "lucide-react";
import mosapLogo from "@/assets/mosap3-logo.png";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type NavItem = {
  icon: any;
  label: string;
  path?: string;
  children?: { label: string; path: string; icon?: any }[];
  allowedRoles?: AppRole[];
  compact?: boolean;
};

const ALL_ROLES: AppRole[] = [
  "admin", "gestor_incentivos",
  "senior_agricultura", "senior_monitoria", "senior_agronegocio",
  "junior_agricultura", "junior_monitoria", "junior_agronegocio",
  "tecnico_extensionista",
];

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  {
    icon: Users,
    label: "Registo do Pequeno Produtor",
    children: [
      { label: "Registo do Pequeno Produtor", path: "/agricultores", icon: UserPlus },
    ],
  },
  {
    icon: Package,
    label: "PATEC",
    path: "/patec",
  },
  {
    icon: School,
    label: "Escolas de Campo",
    path: "/escolas",
  },
  {
    icon: Gift,
    label: "Incentivos",
    allowedRoles: ["admin", "gestor_incentivos"],
    children: [
      { label: "Incentivos", path: "/incentivos", icon: Gift },
      { label: "Transações", path: "/transacoes", icon: ArrowLeftRight },
    ],
  },
  {
    icon: ShoppingCart,
    label: "Compras",
    path: "/compras",
    allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"],
    compact: true,
  },
  {
    icon: MapPin,
    label: "Parcelas",
    path: "/parcelas",
    compact: true,
  },
  {
    icon: Building2,
    label: "Empresas",
    path: "/empresas",
    allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"],
    compact: true,
  },
  {
    icon: Wheat,
    label: "Produção",
    path: "/producao",
    compact: true,
  },
  {
    icon: FileText,
    label: "Relatórios",
    path: "/relatorios",
    compact: true,
    allowedRoles: ["admin", "gestor_incentivos", "senior_agricultura", "senior_monitoria", "junior_monitoria", "junior_agricultura", "senior_agronegocio"],
  },
  {
    icon: UserCog,
    label: "Utilizadores",
    allowedRoles: ["admin"],
    children: [
      { label: "Lista de Utilizadores", path: "/utilizadores" },
      { label: "Perfis", path: "/perfis" },
    ],
  },
  {
    icon: Settings,
    label: "Configurações",
    allowedRoles: ["admin"],
    children: [
      { label: "Geral", path: "/configuracoes" },
      { label: "Províncias", path: "/provincias" },
    ],
  },
  { icon: Smartphone, label: "Instalar App", path: "/instalar" },
];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const AppSidebar = ({ mobileOpen, onMobileClose }: AppSidebarProps) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(["Registo do Pequeno Produtor"]);
  const { roles, isAdmin, user } = useAuth();
  const isMobile = mobileOpen !== undefined;

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isChildActive = (item: NavItem) =>
    item.children?.some((c) => location.pathname === c.path);

  const canSee = (item: NavItem): boolean => {
    // If no roles assigned yet or not logged in, show all (graceful fallback)
    if (!user || roles.length === 0) return true;
    // Admin sees everything
    if (isAdmin) return true;
    // No restriction defined = visible to all
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    // Check if user has any of the allowed roles
    return item.allowedRoles.some((r) => roles.includes(r));
  };

  const visibleItems = navItems.filter(canSee);

  const handleLinkClick = () => {
    if (isMobile && onMobileClose) onMobileClose();
  };
  const sidebarHidden = isMobile && !mobileOpen;

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-300 ${
        sidebarHidden ? "-translate-x-full" : "translate-x-0"
      } ${isMobile ? "w-64" : collapsed ? "w-[72px]" : "w-64"}`}
      style={{ background: "hsl(var(--sidebar-background))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="h-10 w-auto flex-shrink-0 bg-card rounded-lg p-1">
          <img src={mosapLogo} alt="MOSAP3" className="h-full w-auto" />
        </div>
        {!collapsed && (
          <span className="font-heading font-bold text-lg" style={{ color: "hsl(var(--sidebar-primary))" }}>
            MOSAP3
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {(() => {
          const elements: React.ReactNode[] = [];
          let compactBatch: NavItem[] = [];

          const flushCompact = () => {
            if (compactBatch.length === 0) return;
            const batch = [...compactBatch];
            compactBatch = [];
            elements.push(
              <div key={`compact-${batch[0].label}`} className={collapsed ? "space-y-0.5" : "grid grid-cols-2 gap-1"}>
                {batch.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path!}
                      onClick={handleLinkClick}
                      className={`sidebar-link ${isActive ? "active" : ""} ${!collapsed ? "flex-col gap-1 py-2 text-xs" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          };

          for (const item of visibleItems) {
            if (item.compact && !item.children) {
              compactBatch.push(item);
              continue;
            }
            flushCompact();

            if (item.children) {
              const isOpen = openMenus.includes(item.label);
              const childActive = isChildActive(item);
              elements.push(
                <div key={item.label}>
                  <button
                    onClick={() => !collapsed && toggleMenu(item.label)}
                    className={`sidebar-link w-full justify-between ${childActive ? "active" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!collapsed && (
                      isOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                  {!collapsed && isOpen && (
                    <div className="ml-4 pl-4 border-l space-y-0.5 mt-0.5" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
                      {item.children.map((child) => {
                        const isActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={handleLinkClick}
                            className={`sidebar-link text-xs py-2 ${isActive ? "active" : ""}`}
                          >
                            {child.icon && <child.icon className="h-4 w-4 flex-shrink-0" />}
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            } else {
              const isActive = location.pathname === item.path;
              elements.push(
                <Link
                  key={item.path}
                  to={item.path!}
                  onClick={handleLinkClick}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            }
          }
          flushCompact();
          return elements;
        })()}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-link w-full"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
