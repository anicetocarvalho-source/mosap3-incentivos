import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { navItems, type NavItem } from "./AppNavbar";
import { useAuth } from "@/hooks/useAuth";
import { useModulePermissions, canAccessModule } from "@/hooks/useModulePermissions";
import { usePatecPendingCount } from "@/hooks/usePatecPendingCount";
import { mosapLogo } from "@/config/brand";
import { LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

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

// Group nav items into logical sections
const SECTION_MAP: Record<string, string> = {
  Dashboard: "Visão geral",
  Produtores: "Operação",
  Escolas: "Operação",
  Parcelas: "Operação",
  Produção: "Operação",
  Incentivos: "Incentivos",
  MOSAP3Pay: "Comercial",
  Relatórios: "Comercial",
  Anomalias: "Comercial",
  Utilizadores: "Sistema",
  Configurações: "Sistema",
  Instalar: "Sistema",
};

const SECTION_ORDER = ["Visão geral", "Operação", "Incentivos", "Comercial", "Sistema"];

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, profile, roles, isAdmin } = useAuth();
  const { data: matrix } = useModulePermissions();
  const { data: patecPending = 0 } = usePatecPendingCount();

  const displayName = profile?.full_name || user?.email || "Utilizador";
  const primaryRole = roles.length > 0 ? ROLE_LABELS[roles[0]] || roles[0] : "Sem perfil";

  const canSee = (item: NavItem): boolean => {
    if (!user || roles.length === 0) return true;
    if (isAdmin) return true;
    if (item.moduleName && matrix && matrix[item.moduleName]) {
      return canAccessModule(item.moduleName, roles, matrix, isAdmin);
    }
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return item.allowedRoles.some((r) => roles.includes(r));
  };

  const visible = navItems.filter(canSee);

  // Group by section
  const grouped: Record<string, NavItem[]> = {};
  visible.forEach((item) => {
    const section = SECTION_MAP[item.label] || "Outros";
    grouped[section] = grouped[section] || [];
    grouped[section].push(item);
  });

  const isActivePath = (path?: string) => path && location.pathname === path;
  const isChildActive = (item: NavItem) => item.children?.some((c) => location.pathname === c.path);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors duration-200 hover:bg-sidebar-accent/60 group/logo"
        >
          <div
            className={`h-10 w-10 flex-shrink-0 rounded-xl bg-sidebar-accent flex items-center justify-center overflow-hidden transition-all duration-200 group-hover/logo:bg-sidebar-primary/15 group-hover/logo:ring-2 group-hover/logo:ring-sidebar-primary/25 ${isActivePath("/") ? "ring-2 ring-sidebar-primary/40 bg-sidebar-primary/20" : ""}`}
          >
            <img
              src={mosapLogo}
              alt="MOSAP3"
              className="h-8 w-8 object-contain transition-transform duration-200 group-hover/logo:scale-[1.08]"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-heading font-bold text-base text-sidebar-primary">MOSAP3</span>
              <span className="text-[10px] text-sidebar-foreground/60">Projecto Mosap3</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {SECTION_ORDER.filter((s) => grouped[s]?.length).map((section) => (
          <SidebarGroup key={section}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
                {section}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {grouped[section].map((item) => {
                  if (item.children) {
                    const childActive = isChildActive(item);
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          tooltip={item.label}
                          isActive={childActive}
                          className="data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-primary data-[active=true]:font-medium"
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        {!collapsed && (
                          <SidebarMenuSub>
                            {item.children.map((child) => {
                              const active = location.pathname === child.path;
                              return (
                                <SidebarMenuSubItem key={child.path}>
                                  <SidebarMenuSubButton asChild isActive={active}>
                                    <Link to={child.path} className="flex items-center gap-2">
                                      {child.icon && <child.icon className="h-3.5 w-3.5" />}
                                      <span>{child.label}</span>
                                      {child.label === "PATEC" && patecPending > 0 && (
                                        <span className="ml-auto inline-flex items-center justify-center h-4 min-w-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                                          {patecPending}
                                        </span>
                                      )}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    );
                  }

                  const active = isActivePath(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={!!active}
                        className="data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-primary data-[active=true]:font-medium relative data-[active=true]:before:content-[''] data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1/2 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:h-5 data-[active=true]:before:w-0.5 data-[active=true]:before:bg-sidebar-primary data-[active=true]:before:rounded-r"
                      >
                        <Link to={item.path!}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className={`flex items-center gap-2 px-1 py-1 ${collapsed ? "justify-center" : ""}`}>
          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
            <UserIcon className="h-4 w-4 text-sidebar-primary" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">{primaryRole}</p>
            </div>
          )}
          {!collapsed && user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              title="Terminar sessão"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
