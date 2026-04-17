import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppTopbar from "./AppTopbar";
import OnlineStatusBanner from "./OnlineStatusBanner";
import PageTransition from "./PageTransition";

const AppLayout = () => {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0">
          <AppTopbar />
          <main className="flex-1 w-full">
            <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 lg:px-8 py-5 md:py-6">
              <PageTransition>
                <Outlet />
              </PageTransition>
            </div>
          </main>
        </SidebarInset>
        <OnlineStatusBanner />
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
