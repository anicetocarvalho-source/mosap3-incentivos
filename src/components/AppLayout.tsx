import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import AppNavbar, { navItems, NavItem } from "./AppNavbar";
import OnlineStatusBanner from "./OnlineStatusBanner";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const AppLayout = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { roles, isAdmin, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const canSee = (item: NavItem): boolean => {
    if (!user || roles.length === 0) return true;
    if (isAdmin) return true;
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return item.allowedRoles.some((r) => roles.includes(r));
  };

  const sidebarItems = navItems.filter((item) => item.sidebar && canSee(item));

  const isActive = (path?: string) => path && location.pathname === path;
  const isChildActive = (item: NavItem) => item.children?.some((c) => location.pathname === c.path);

  return (
    <div className="min-h-screen bg-background">
      <OnlineStatusBanner />
      <AppNavbar />
      <div className="flex">
        {!isMobile && sidebarItems.length > 0 && (
          <aside
            className={`flex-shrink-0 border-r border-border bg-card sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col py-3 gap-0.5 overflow-y-auto transition-all duration-200 ${
              sidebarCollapsed ? "w-14 px-1 items-center" : "w-48 px-2"
            }`}
          >
            {sidebarItems.map((item, idx) => (
              <div key={item.label}>
                {idx > 0 && <Separator className="my-2" />}
                {item.children ? (
                  <>
                    {!sidebarCollapsed && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
                        {item.label}
                      </p>
                    )}
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        title={child.label}
                        className={`flex items-center rounded-md transition-colors ${
                          sidebarCollapsed
                            ? "justify-center w-10 h-10 mx-auto"
                            : "gap-2 px-2 py-2 text-sm"
                        } ${
                          location.pathname === child.path
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {child.icon ? <child.icon className="h-4 w-4 flex-shrink-0" /> : <item.icon className="h-4 w-4 flex-shrink-0" />}
                        {!sidebarCollapsed && <span className="truncate">{child.label}</span>}
                      </Link>
                    ))}
                  </>
                ) : (
                  <Link
                    to={item.path!}
                    title={item.label}
                    className={`flex items-center rounded-md transition-colors ${
                      sidebarCollapsed
                        ? "justify-center w-10 h-10 mx-auto"
                        : "gap-2 px-2 py-2 text-sm"
                    } ${
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )}
              </div>
            ))}

            {/* Collapse/expand button */}
            <div className="mt-auto pt-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={`h-8 w-8 ${sidebarCollapsed ? "mx-auto" : "ml-1"}`}
                title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </aside>
        )}
        <main className="flex-1 p-4 md:p-6 pt-2 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
