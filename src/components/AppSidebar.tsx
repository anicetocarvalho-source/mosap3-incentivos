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
} from "lucide-react";
import mosapLogo from "@/assets/mosap3-logo.png";

type NavItem = {
  icon: any;
  label: string;
  path?: string;
  children?: { label: string; path: string; icon?: any }[];
};

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
    icon: Gift,
    label: "Incentivos",
    children: [
      { label: "Incentivos", path: "/incentivos", icon: Gift },
      { label: "Transações", path: "/transacoes", icon: ArrowLeftRight },
    ],
  },
  { icon: ShoppingCart, label: "Compras Subsidiadas", path: "/compras" },
  { icon: MapPin, label: "Parcelas", path: "/parcelas" },
  { icon: Building2, label: "Empresas", path: "/empresas" },
  { icon: ArrowLeftRight, label: "Transações", path: "/transacoes" },
  { icon: Wheat, label: "Produção", path: "/producao" },
  {
    icon: UserCog,
    label: "Utilizadores",
    children: [
      { label: "Lista de Utilizadores", path: "/utilizadores" },
      { label: "Perfis", path: "/perfis" },
    ],
  },
  {
    icon: Settings,
    label: "Configurações",
    children: [
      { label: "Geral", path: "/configuracoes" },
      { label: "Províncias", path: "/provincias" },
    ],
  },
];

const AppSidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(["Registo do Pequeno Produtor"]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isChildActive = (item: NavItem) =>
    item.children?.some((c) => location.pathname === c.path);

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
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
        {navItems.map((item) => {
          if (item.children) {
            const isOpen = openMenus.includes(item.label);
            const childActive = isChildActive(item);
            return (
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
          }

          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path!}
              className={`sidebar-link ${isActive ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
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
