import { Outlet, Link, useLocation } from "react-router-dom";
import AppNavbar, { navItems, NavItem } from "./AppNavbar";
import OnlineStatusBanner from "./OnlineStatusBanner";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

const AppLayout = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { roles, isAdmin, user } = useAuth();

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
        {/* Mini sidebar */}
        {!isMobile && sidebarItems.length > 0 && (
          <aside className="w-14 flex-shrink-0 border-r border-border bg-card sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col items-center py-3 gap-1">
            {sidebarItems.map((item) => {
              if (item.children) {
                const active = isChildActive(item);
                return item.children.map((child) => (
                  <Link
                    key={child.path}
                    to={child.path}
                    title={child.label}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                      location.pathname === child.path
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {child.icon ? <child.icon className="h-5 w-5" /> : <item.icon className="h-5 w-5" />}
                  </Link>
                ));
              }
              return (
                <Link
                  key={item.path}
                  to={item.path!}
                  title={item.label}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              );
            })}
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
