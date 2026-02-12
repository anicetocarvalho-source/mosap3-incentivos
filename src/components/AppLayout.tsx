import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import OnlineStatusBanner from "./OnlineStatusBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const AppLayout = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppSidebar
        mobileOpen={isMobile ? sidebarOpen : undefined}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className={`transition-all duration-300 ${isMobile ? "pl-0" : "pl-64"}`}>
        <OnlineStatusBanner />
        <AppHeader onMenuClick={isMobile ? () => setSidebarOpen(true) : undefined} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
