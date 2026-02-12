import { Outlet } from "react-router-dom";
import AppNavbar from "./AppNavbar";
import OnlineStatusBanner from "./OnlineStatusBanner";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <OnlineStatusBanner />
      <AppNavbar />
      <main className="p-4 md:p-6 pt-2">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
