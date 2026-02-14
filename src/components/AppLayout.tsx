import { useState, useRef, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import OnlineStatusBanner from "./OnlineStatusBanner";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Search, LogOut, CheckCheck } from "lucide-react";
import mosapLogo from "@/assets/mosap3-logo.png";
import { supabase } from "@/integrations/supabase/client";

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
  const navigate = useNavigate();
  const { roles, user, profile } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Utilizador";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = roles.length > 0 ? roles.map(r => ROLE_LABELS[r] || r).join(", ") : "Sem perfil";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full">
        {/* Header */}
        <header className="sticky top-0 z-50">
          {/* Angola tricolor stripe */}
          <div className="flex h-1">
            <div className="flex-1 bg-gradient-to-r from-[hsl(0,72%,45%)] to-[hsl(0,72%,50%)]" />
            <div className="flex-1 bg-gradient-to-r from-[hsl(0,0%,10%)] to-[hsl(0,0%,15%)]" />
            <div className="flex-1 bg-gradient-to-r from-[hsl(45,100%,50%)] to-[hsl(45,100%,55%)]" />
          </div>

          {/* Main header */}
          <div className="bg-gradient-to-r from-primary via-[hsl(130,50%,25%)] to-primary backdrop-blur-sm border-b border-white/5">
            <div className="flex items-center justify-between h-14 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="lg:hidden -ml-2 mr-1 text-white/80 hover:text-white hover:bg-white/10" />
                <Link to="/" className="flex items-center gap-3 group">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 border border-white/20 group-hover:bg-white/20 transition-all shadow-lg shadow-black/10 overflow-hidden">
                    <img src={mosapLogo} alt="MOSAP3" className="h-9 w-9 object-contain" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-base font-extrabold tracking-tight text-white leading-none font-heading">MOSAP3</h1>
                      <span className="hidden sm:inline-block rounded-md bg-secondary/20 border border-secondary/30 px-1.5 py-0.5 text-[9px] font-bold text-secondary uppercase tracking-widest">
                        Agro Boost
                      </span>
                    </div>
                    <p className="text-[10px] text-white/50 leading-tight hidden sm:block">
                      Mecanismo de Organização e Sustentabilidade Agro-Pecuária
                    </p>
                  </div>
                </Link>
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-1.5">
                <button
                  className="flex items-center gap-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors h-9 px-2.5"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden md:inline text-xs text-white/30">Pesquisar...</span>
                  <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-white/15 bg-white/5 px-1 text-[9px] font-medium text-white/30">
                    ⌘K
                  </kbd>
                </button>

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen(o => !o)}
                    className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 border-2 border-primary">
                      3
                    </span>
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl z-[9999] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <span className="text-sm font-semibold">Notificações</span>
                        <button className="text-[10px] text-primary font-medium hover:underline flex items-center gap-1">
                          <CheckCheck className="h-3 w-3" /> Marcar todas como lidas
                        </button>
                      </div>
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Sem notificações novas
                      </div>
                    </div>
                  )}
                </div>

                {/* User info */}
                <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-white/10">
                  <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white text-xs font-bold">
                    {initials}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs font-medium text-white/80 leading-none">{displayName}</p>
                    <p className="text-[10px] text-white/40 leading-tight">{roleLabel}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    title="Terminar sessão"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 w-full">
          <AppSidebar />
          <main className="flex-1 min-w-0">
            <OnlineStatusBanner />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="bg-[hsl(210,10%,15%)] text-white/60 py-4 px-6 text-center text-xs mt-auto">
          <p>© {new Date().getFullYear()} República de Angola | MOSAP3 – Mecanismo de Organização e Sustentabilidade Agro-Pecuária</p>
        </footer>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
