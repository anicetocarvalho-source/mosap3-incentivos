import { Outlet, Link, useLocation } from "react-router-dom";
import AppNavbar, { navItems, NavItem } from "./AppNavbar";
import OnlineStatusBanner from "./OnlineStatusBanner";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";

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
        {/* Sidebar with labels and submenus */}
        {!isMobile && sidebarItems.length > 0 && (
          <aside className="w-48 flex-shrink-0 border-r border-border bg-card sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col py-3 px-2 gap-0.5 overflow-y-auto">
            {sidebarItems.map((item, idx) => (
              <div key={item.label}>
                {idx > 0 && <Separator className="my-2" />}
                {item.children ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
                      {item.label}
                    </p>
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${
                          location.pathname === child.path
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {child.icon ? <child.icon className="h-4 w-4 flex-shrink-0" /> : <item.icon className="h-4 w-4 flex-shrink-0" />}
                        <span className="truncate">{child.label}</span>
                      </Link>
                    ))}
                  </>
                ) : (
                  <Link
                    to={item.path!}
                    className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )}
              </div>
            ))}
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
