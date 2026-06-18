import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Package, Monitor, ShoppingCart, LogOut, Menu, X, Warehouse, Settings, Store, Receipt, UserCog, Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mosapLogo, LOGO_SIZES } from "@/config/brand";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  status: string;
  user_id: string;
}

const navItems = [
  { to: "/fornecedor", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/fornecedor/catalogo", icon: Package, label: "Catálogo & Stock" },
  { to: "/fornecedor/pos/venda", icon: ShoppingCart, label: "Vender (Terminal POS)" },
  { to: "/fornecedor/pos", icon: Monitor, label: "Terminais POS" },
  { to: "/fornecedor/vendedores", icon: UserCog, label: "Vendedores", badge: "Novo" },
  { to: "/fornecedor/turnos", icon: Clock, label: "Turnos", badge: "Novo" },
  { to: "/fornecedor/vendas", icon: ShoppingCart, label: "Vendas" },
  { to: "/fornecedor/relatorios/vendedores", icon: BarChart3, label: "Relatório Vendedores", badge: "Novo" },
  { to: "/fornecedor/facturas", icon: Receipt, label: "Facturas" },
  { to: "/fornecedor/lojas", icon: Store, label: "Lojas" },
  { to: "/fornecedor/perfil", icon: Settings, label: "Perfil da Empresa" },
];

const FornecedorLayout = () => {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth?profile=fornecedor"); return; }
      const { data } = await supabase.from("suppliers").select("id, name, status, user_id").eq("user_id", user.id).maybeSingle();
      if (!data) { await supabase.auth.signOut(); navigate("/auth?profile=fornecedor"); toast.error("Conta não associada a fornecedor"); return; }
      setSupplier(data);
      setLoading(false);
    };
    check();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth?profile=fornecedor");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  if (supplier?.status === "Pendente") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <img src={mosapLogo} alt="MOSAP3" className={LOGO_SIZES.supplierPending} />
          <h1 className="text-xl font-bold font-heading">Conta Pendente de Activação</h1>
          <p className="text-muted-foreground">A sua conta de fornecedor está a aguardar aprovação pelo administrador do MOSAP3. Será notificado por email quando a conta for activada.</p>
          <Button variant="outline" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" /> Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
          <img src={mosapLogo} alt="MOSAP3" className={LOGO_SIZES.supplierSidebar} />
          <div>
            <p className="font-heading font-bold text-sm text-sidebar-primary">MOSAP3Pay</p>
            <p className="text-[10px] text-sidebar-foreground/60 truncate">{supplier?.name}</p>
          </div>
          <button className="lg:hidden ml-auto" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            // Highlight rules:
            // - Dashboard (/fornecedor) only on exact match.
            // - Other items match the exact path OR any nested sub-path, so things
            //   like /fornecedor/catalogo?tab=stock or legacy /fornecedor/stock and
            //   /fornecedor/precos (which redirect to ?tab=stock) keep the
            //   "Catálogo & Stock" entry highlighted.
            const path = location.pathname;
            const isCatalogoLegacy =
              item.to === "/fornecedor/catalogo" &&
              (path === "/fornecedor/stock" || path === "/fornecedor/precos");
            const active =
              item.to === "/fornecedor"
                ? path === "/fornecedor"
                : path === item.to || path.startsWith(item.to + "/") || isCatalogoLegacy;
            return (
              <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"}`}>
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {(item as any).badge && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-semibold">{(item as any).badge}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-3 right-3">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Terminar sessão
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <main className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <span className="font-heading font-bold text-sm">MOSAP3Pay</span>
        </header>
        <div className="p-4 lg:p-6">
          <Outlet context={{ supplier }} />
        </div>
      </main>
    </div>
  );
};

export default FornecedorLayout;
