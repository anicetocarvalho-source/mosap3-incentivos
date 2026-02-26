import { useState, useEffect } from "react";
import { Search, User, LogOut, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";
import FarmerAvatar from "@/components/FarmerAvatar";

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

interface AppHeaderProps {
  onMenuClick?: () => void;
}

const AppHeader = ({ onMenuClick }: AppHeaderProps) => {
  const { user, profile, roles, isOfflineSession, offlineLogout } = useAuth();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const q = globalSearch.trim();
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("farmers")
        .select("code, full_name, phone, province, photo_frontal_url")
        .or(`full_name.ilike.%${q}%,code.ilike.%${q}%,phone.ilike.%${q}%,bi.ilike.%${q}%`)
        .limit(8);
      setSuggestions(data || []);
      setShowSuggestions(!!data && data.length > 0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [globalSearch]);

  const displayName = profile?.full_name || user?.email || "Utilizador";
  const primaryRole = roles.length > 0 ? ROLE_LABELS[roles[0]] || roles[0] : "Sem perfil";

  const handleLogout = async () => {
    if (isOfflineSession) {
      import("@/lib/offlineAuth").then((m) => m.clearCachedSession());
      offlineLogout();
      navigate("/auth");
    } else {
      await supabase.auth.signOut();
      navigate("/");
    }
  };

  return (
    <header className="h-14 md:h-16 border-b border-border bg-card flex items-center justify-between px-3 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {onMenuClick && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="flex-shrink-0">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="relative w-full max-w-xs hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            placeholder="Pesquisar produtor..."
            className="pl-10 bg-muted border-0"
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setShowSuggestions(e.target.value.length >= 2); }}
            onFocus={() => globalSearch.length >= 2 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto">
              {suggestions.map((s) => (
                <Link
                  key={s.code}
                  to={`/agricultores/${s.code}`}
                  onClick={() => { setGlobalSearch(""); setShowSuggestions(false); }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0"
                >
                  <FarmerAvatar photoUrl={s.photo_frontal_url} name={s.full_name} size="h-8 w-8" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.code} • {s.province || "—"} • {s.phone || "—"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        <NotificationBell />
        <div className="flex items-center gap-2 pl-2 md:pl-3 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="text-sm hidden sm:block">
            <p className="font-semibold font-heading leading-none truncate max-w-[120px]">{displayName}</p>
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
