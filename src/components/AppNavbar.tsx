import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  ArrowLeftRight,
  UserCog,
  Settings,
  ChevronDown,
  UserPlus,
  School,
  Wheat,
  Gift,
  ShoppingCart,
  MapPin,
  Smartphone,
  Bell,
  Search,
  User,
  LogOut,
  Menu,
  X,
  FileText,
  Package,
  CreditCard,
  Store,
  Monitor,
} from "lucide-react";
import mosapLogo from "@/assets/mosap3-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { usePatecPendingCount } from "@/hooks/usePatecPendingCount";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import NotificationBell from "@/components/NotificationBell";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type NavItem = {
  icon: any;
  label: string;
  path?: string;
  children?: { label: string; path: string; icon?: any }[];
  allowedRoles?: AppRole[];
  sidebar?: boolean;
};

export type { NavItem, AppRole };

const ALL_ROLES: AppRole[] = [
  "admin", "gestor_incentivos",
  "senior_agricultura", "senior_monitoria", "senior_agronegocio",
  "junior_agricultura", "junior_monitoria", "junior_agronegocio",
  "tecnico_extensionista",
];

export const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", sidebar: true },
  {
    icon: Users,
    label: "Produtores",
    sidebar: true,
    children: [
      { label: "Registo do Pequeno Produtor", path: "/agricultores", icon: UserPlus },
    ],
  },
  { icon: Package, label: "PATEC", path: "/patec", sidebar: true },
  { icon: School, label: "Escolas", path: "/escolas" },
  {
    icon: Gift,
    label: "Incentivos",
    sidebar: true,
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
    sidebar: true,
    allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"],
  },
  { icon: MapPin, label: "Parcelas", path: "/parcelas" },
  {
    icon: Building2,
    label: "Empresas",
    path: "/empresas",
    sidebar: true,
    allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"],
  },
  { icon: Wheat, label: "Produção", path: "/producao" },
  {
    icon: CreditCard,
    label: "MOSAP3Pay",
    sidebar: true,
    allowedRoles: ["admin", "gestor_incentivos"],
    children: [
      { label: "Dashboard", path: "/mosap3pay", icon: CreditCard },
      { label: "Fornecedores", path: "/mosap3pay/fornecedores", icon: Store },
      { label: "Terminal POS", path: "/mosap3pay/pos", icon: Monitor },
      { label: "Vendas", path: "/mosap3pay/vendas", icon: ShoppingCart },
    ],
  },
  {
    icon: FileText,
    label: "Relatórios",
    path: "/relatorios",
    allowedRoles: ["admin", "gestor_incentivos", "senior_agricultura", "senior_monitoria", "junior_monitoria", "junior_agricultura", "senior_agronegocio"],
  },
  {
    icon: UserCog,
    label: "Utilizadores",
    sidebar: true,
    allowedRoles: ["admin"],
    children: [
      { label: "Lista de Utilizadores", path: "/utilizadores" },
      { label: "Perfis", path: "/perfis" },
    ],
  },
  {
    icon: Settings,
    label: "Configurações",
    sidebar: true,
    allowedRoles: ["admin"],
    children: [
      { label: "Geral", path: "/configuracoes", icon: Settings },
      { label: "Províncias", path: "/provincias", icon: MapPin },
    ],
  },
  { icon: Smartphone, label: "Instalar", path: "/instalar" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gestor_incentivos: "Gestor de Incentivos",
  senior_agricultura: "Sénior Agricultura",
  senior_monitoria: "Sénior Monitoria",
  junior_monitoria: "Júnior Monitoria",
  junior_agricultura: "Júnior Agricultura",
  senior_agronegocio: "Sénior Agronegócio",
  junior_agronegocio: "Júnior Agronegócio",
  tecnico_extensionista: "Técnico Extensionista",
};

const AppNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, profile, roles, isAdmin } = useAuth();
  const { data: patecPending = 0 } = usePatecPendingCount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownTimeout = useRef<NodeJS.Timeout | null>(null);

  const displayName = profile?.full_name || user?.email || "Utilizador";
  const primaryRole = roles.length > 0 ? ROLE_LABELS[roles[0]] || roles[0] : "Sem perfil";

  const canSee = (item: NavItem): boolean => {
    if (!user || roles.length === 0) return true;
    if (isAdmin) return true;
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return item.allowedRoles.some((r) => roles.includes(r));
  };

  const visibleItems = navItems.filter((item) => canSee(item) && !item.sidebar);
  const mobileVisibleItems = navItems.filter((item) => canSee(item));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isActive = (path?: string) => path && location.pathname === path;
  const isChildActive = (item: NavItem) => item.children?.some((c) => location.pathname === c.path);

  const handleDropdownEnter = (label: string) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    setOpenDropdown(label);
  };

  const handleDropdownLeave = () => {
    dropdownTimeout.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border" style={{ background: "hsl(var(--sidebar-background))" }}>
      {/* Top bar: logo + user */}
      <div className="flex items-center justify-between h-14 px-3 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="h-9 w-auto bg-card rounded-lg p-0.5">
            <img src={mosapLogo} alt="MOSAP3" className="h-full w-auto" />
          </div>
          <span className="font-heading font-bold text-base" style={{ color: "hsl(var(--sidebar-primary))" }}>
            MOSAP3
          </span>
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
          <nav className="flex items-center gap-0.5 flex-1 justify-center mx-4 overflow-x-auto">
            {visibleItems.map((item) => {
              if (item.children) {
                const active = isChildActive(item);
                return (
                  <div
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => handleDropdownEnter(item.label)}
                    onMouseLeave={handleDropdownLeave}
                  >
                    <button
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]"
                          : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {openDropdown === item.label && (
                      <div
                        className="absolute top-full left-0 mt-1 min-w-[200px] rounded-lg border border-border bg-card shadow-lg py-1 z-50"
                        onMouseEnter={() => handleDropdownEnter(item.label)}
                        onMouseLeave={handleDropdownLeave}
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                              location.pathname === child.path
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            {child.icon && <child.icon className="h-4 w-4" />}
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path!}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive(item.path)
                      ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]"
                      : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.label === "PATEC" && patecPending > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      {patecPending}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right side: user info */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <NotificationBell />
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="text-xs">
              <p className="font-semibold leading-none truncate max-w-[100px]" style={{ color: "hsl(var(--sidebar-foreground))" }}>{displayName}</p>
              <p className="text-[10px]" style={{ color: "hsl(var(--sidebar-foreground) / 0.6)" }}>{primaryRole}</p>
            </div>
          </div>
          {user && (
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Terminar sessão">
              <LogOut className="h-4 w-4" style={{ color: "hsl(var(--sidebar-foreground))" }} />
            </Button>
          )}
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? (
                <X className="h-5 w-5" style={{ color: "hsl(var(--sidebar-foreground))" }} />
              ) : (
                <Menu className="h-5 w-5" style={{ color: "hsl(var(--sidebar-foreground))" }} />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {isMobile && mobileOpen && (
        <nav className="border-t px-3 py-2 max-h-[70vh] overflow-y-auto" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          {mobileVisibleItems.map((item) => {
            if (item.children) {
              const open = openDropdown === item.label;
              const active = isChildActive(item);
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setOpenDropdown(open ? null : item.label)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]"
                        : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="ml-6 border-l pl-3 my-1 space-y-0.5" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
                      {item.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                            location.pathname === child.path
                              ? "text-[hsl(var(--sidebar-primary))] font-medium"
                              : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                          }`}
                        >
                          {child.icon && <child.icon className="h-4 w-4" />}
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path!}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]"
                    : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.label === "PATEC" && patecPending > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                    {patecPending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
};

export default AppNavbar;
