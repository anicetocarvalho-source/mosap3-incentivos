import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="pl-64 transition-all duration-300">
        <AppHeader />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
