import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { navItems, NavItem } from "./AppNavbar";
import OnlineStatusBanner from "./OnlineStatusBanner";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  Search,
  User,
  LogOut,
  Menu,
  X,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import mosapLogo from "@/assets/mosap3-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { roles, isAdmin, user, profile } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const displayName = profile?.full_name || user?.email || "Utilizador";
  const primaryRole = roles.length > 0 ? ROLE_LABELS[roles[0]] || roles[0] : "Sem perfil";
  const initials = displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const canSee = (item: NavItem): boolean => {
    if (!user || roles.length === 0) return true;
    if (isAdmin) return true;
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return item.allowedRoles.some((r) => roles.includes(r));
  };

  const allItems = navItems.filter((item) => canSee(item));

  const isActive = (path?: string) => path && location.pathname === path;
  const isChildActive = (item: NavItem) => item.children?.some((c) => location.pathname === c.path);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Find current page title
  const currentPage = allItems.find(item => {
    if (item.path && isActive(item.path)) return true;
    if (item.children?.some(c => location.pathname === c.path)) return true;
    return false;
  });
  const currentChild = currentPage?.children?.find(c => location.pathname === c.path);
  const pageTitle = currentChild?.label || currentPage?.label || "Dashboard";

  const sidebarWidth = sidebarCollapsed ? "w-[68px]" : "w-[250px]";

  const renderSidebarContent = (mobile = false) => (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className={`flex items-center h-16 px-4 border-b border-sidebar-border flex-shrink-0 ${sidebarCollapsed && !mobile ? "justify-center px-2" : "gap-3"}`}>
        <div className="h-9 w-9 bg-card rounded-lg p-0.5 flex-shrink-0">
          <img src={mosapLogo} alt="MOSAP3" className="h-full w-full object-contain" />
        </div>
        {(!sidebarCollapsed || mobile) && (
          <div className="flex flex-col min-w-0">
            <span className="font-heading font-bold text-sm text-sidebar-primary truncate">MOSAP3</span>
            <span className="text-[10px] text-sidebar-foreground/50 truncate">Agro Boost</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {allItems.map((item) => {
          if (item.children) {
            const active = isChildActive(item);
            const expanded = expandedGroups.includes(item.label) || active;

            return (
              <div key={item.label} className="space-y-0.5">
                <button
                  onClick={() => !sidebarCollapsed && toggleGroup(item.label)}
                  title={item.label}
                  className={`w-full flex items-center rounded-lg transition-all duration-200 group ${
                    sidebarCollapsed && !mobile
                      ? "justify-center h-10 w-10 mx-auto"
                      : "gap-3 px-3 py-2.5 text-[13px]"
                  } ${
                    active
                      ? "bg-sidebar-primary/15 text-sidebar-primary font-semibold"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {(!sidebarCollapsed || mobile) && (
                    <>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 opacity-50 ${expanded ? "rotate-180" : ""}`} />
                    </>
                  )}
                </button>
                <AnimatePresence>
                  {expanded && (!sidebarCollapsed || mobile) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 pl-3 border-l-2 border-sidebar-border space-y-0.5">
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => mobile && setMobileOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                              location.pathname === child.path
                                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            }`}
                          >
                            {child.icon ? <child.icon className="h-4 w-4 flex-shrink-0" /> : <item.icon className="h-4 w-4 flex-shrink-0" />}
                            <span className="truncate">{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path!}
              title={item.label}
              onClick={() => mobile && setMobileOpen(false)}
              className={`flex items-center rounded-lg transition-all duration-200 ${
                sidebarCollapsed && !mobile
                  ? "justify-center h-10 w-10 mx-auto"
                  : "gap-3 px-3 py-2.5 text-[13px]"
              } ${
                isActive(item.path)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
              {(!sidebarCollapsed || mobile) && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user section */}
      <div className={`border-t border-sidebar-border p-3 flex-shrink-0 ${sidebarCollapsed && !mobile ? "px-2" : ""}`}>
        {(!sidebarCollapsed || mobile) ? (
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer group">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-xs font-bold text-sidebar-primary-foreground">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-sidebar-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-sidebar-foreground/50 truncate">{primaryRole}</p>
            </div>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                title="Terminar sessão"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shadow-sm">
              <span className="text-[10px] font-bold text-sidebar-primary-foreground">{initials}</span>
            </div>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                title="Terminar sessão"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={`${sidebarWidth} flex-shrink-0 bg-sidebar border-r border-sidebar-border sticky top-0 h-screen transition-all duration-300 ease-in-out z-30`}
        >
          {renderSidebarContent()}
          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-border bg-card shadow-md flex items-center justify-center hover:bg-muted transition-colors z-40"
          >
            {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-sidebar z-50 shadow-2xl"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 gap-4">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="font-heading font-bold text-base text-foreground">{pageTitle}</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                MOSAP3 &rsaquo; {pageTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                className="pl-9 w-56 h-9 bg-muted/50 border-0 focus-visible:ring-1 text-sm"
              />
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-[18px] w-[18px] text-muted-foreground" />
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                3
              </span>
            </Button>

            {/* Reports shortcut */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hidden sm:flex"
              onClick={() => navigate("/relatorios")}
              title="Relatórios"
            >
              <BarChart3 className="h-[18px] w-[18px] text-muted-foreground" />
            </Button>
          </div>
        </header>

        <OnlineStatusBanner />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
