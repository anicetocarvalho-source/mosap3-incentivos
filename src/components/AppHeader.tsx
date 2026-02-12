import { Bell, Search, User, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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

const AppHeader = () => {
  const { user, profile, roles } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.full_name || user?.email || "Utilizador";
  const primaryRole = roles.length > 0 ? ROLE_LABELS[roles[0]] || roles[0] : "Sem perfil";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar agricultores, escolas..."
          className="pl-10 bg-muted border-0"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
            3
          </span>
        </Button>
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="text-sm">
            <p className="font-semibold font-heading leading-none">{displayName}</p>
            <p className="text-muted-foreground text-xs">{primaryRole}</p>
          </div>
          {user && (
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Terminar sessão">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
