import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  School,
  Gift,
  ShoppingCart,
  MapPin,
  Wheat,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from "lucide-react";
import mosapLogo from "@/assets/mosap3-logo.png";

const navItems = [
  { icon: LayoutDashboard, label: "Painel", path: "/" },
  { icon: Users, label: "Agricultores", path: "/agricultores" },
  { icon: School, label: "Escolas de Campo", path: "/escolas" },
  { icon: Gift, label: "Incentivos", path: "/incentivos" },
  { icon: ShoppingCart, label: "Compras", path: "/compras" },
  { icon: MapPin, label: "Parcelas", path: "/parcelas" },
  { icon: Wheat, label: "Produção", path: "/producao" },
];

const AppSidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
      style={{ background: "hsl(var(--sidebar-background))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <img src={mosapLogo} alt="MOSAP3" className="h-10 w-auto flex-shrink-0" />
        {!collapsed && (
          <span className="font-heading font-bold text-lg" style={{ color: "hsl(var(--sidebar-primary))" }}>
            MOSAP3
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-xs font-semibold uppercase tracking-wider px-4 mb-3" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>
            Menu Principal
          </p>
        )}
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
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
      <div className="px-3 py-4 space-y-1 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <Link to="/configuracoes" className="sidebar-link" title={collapsed ? "Configurações" : undefined}>
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Configurações</span>}
        </Link>
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
