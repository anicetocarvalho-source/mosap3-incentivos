import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, ArrowLeftRight, UserCog, Settings,
  ChevronDown, ChevronRight, UserPlus, School, Wheat, Gift, ShoppingCart,
  MapPin, Smartphone, FileText,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type AppRole = Database["public"]["Enums"]["app_role"];

interface NavGroupItem {
  icon: any;
  label: string;
  path: string;
  allowedRoles?: AppRole[];
}

interface NavGroup {
  label: string;
  items: NavGroupItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: UserPlus, label: "Registo Produtor", path: "/agricultores" },
      { icon: School, label: "Escolas de Campo", path: "/escolas" },
      { icon: MapPin, label: "Parcelas", path: "/parcelas" },
      { icon: Wheat, label: "Produção", path: "/producao" },
    ],
  },
  {
    label: "Incentivos & Compras",
    items: [
      { icon: Gift, label: "Incentivos", path: "/incentivos", allowedRoles: ["admin", "gestor_incentivos"] },
      { icon: ArrowLeftRight, label: "Transações", path: "/transacoes", allowedRoles: ["admin", "gestor_incentivos"] },
      { icon: ShoppingCart, label: "Compras", path: "/compras", allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"] },
      { icon: Building2, label: "Empresas", path: "/empresas", allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"] },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { icon: FileText, label: "Relatórios", path: "/relatorios" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { icon: UserCog, label: "Utilizadores", path: "/utilizadores", allowedRoles: ["admin"] },
      { icon: Settings, label: "Configurações", path: "/configuracoes", allowedRoles: ["admin"] },
      { icon: MapPin, label: "Províncias", path: "/provincias", allowedRoles: ["admin"] },
      { icon: Smartphone, label: "Instalar App", path: "/instalar" },
    ],
  },
];

const AppSidebar = () => {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { roles, isAdmin, user } = useAuth();

  const canSee = (item: NavGroupItem): boolean => {
    if (!user || roles.length === 0) return true;
    if (isAdmin) return true;
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return item.allowedRoles.some((r) => roles.includes(r));
  };

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSee(item)),
    }))
    .filter((group) => group.items.length > 0);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    filteredGroups.forEach((g) => {
      initial[g.label] = g.items.some(
        (item) => location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path))
      );
    });
    initial["Principal"] = true;
    return initial;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 top-[calc(0.25rem+3.75rem)] h-[calc(100vh-0.25rem-3.75rem)]">
      <SidebarContent className="bg-sidebar py-2 px-1">
        {filteredGroups.map((group) => {
          const isOpen = openGroups[group.label] ?? false;
          const hasActive = group.items.some(
            (item) => location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path))
          );

          return (
            <SidebarGroup key={group.label}>
              {!collapsed && (
                <SidebarGroupLabel asChild>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer",
                      hasActive ? "text-sidebar-primary" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
                    )}
                  >
                    {group.label}
                    <ChevronDown className={cn("h-3 w-3 transition-transform", !isOpen && "-rotate-90")} />
                  </button>
                </SidebarGroupLabel>
              )}

              {(isOpen || collapsed) && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        location.pathname === item.path ||
                        (item.path !== "/" && location.pathname.startsWith(item.path));
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.label}
                          >
                            <Link
                              to={item.path}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                active
                                  ? "bg-sidebar-primary/15 text-sidebar-primary"
                                  : "text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground/90"
                              )}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{item.label}</span>
                              {active && !collapsed && <ChevronRight className="h-3 w-3 ml-auto text-sidebar-primary/60" />}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
};

export { navGroups };
export default AppSidebar;
