import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import EscolasCampo from "@/pages/EscolasCampo";
import EscolaDetalhe from "@/pages/EscolaDetalhe";
import ProvinciaEscolas from "@/pages/ProvinciaEscolas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleGuard from "@/components/RoleGuard";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Agricultores from "@/pages/Agricultores";
import Empresas from "@/pages/Empresas";
import Transacoes from "@/pages/Transacoes";
import Utilizadores from "@/pages/Utilizadores";
import Perfis from "@/pages/Perfis";
import Incentivos from "@/pages/Incentivos";
import Compras from "@/pages/Compras";
import Parcelas from "@/pages/Parcelas";
import Producao from "@/pages/Producao";
import FarmerProfile from "@/pages/FarmerProfile";
import FichaProdutor from "@/pages/FichaProdutor";
import FichaEscola from "@/pages/FichaEscola";
import Instalar from "@/pages/Instalar";
import Relatorios from "@/pages/Relatorios";
import Configuracoes from "@/pages/Configuracoes";
import GestaoProvincias from "@/pages/GestaoProvincias";
import Patec from "@/pages/Patec";
import Mosap3Pay from "@/pages/Mosap3Pay";
import Mosap3PayFornecedores from "@/pages/Mosap3PayFornecedores";
import Mosap3PayPOS from "@/pages/Mosap3PayPOS";
import Mosap3PayVendas from "@/pages/Mosap3PayVendas";
import FornecedorAuth from "@/pages/fornecedor/FornecedorAuth";
import FornecedorLayout from "@/components/fornecedor/FornecedorLayout";
import FornecedorDashboard from "@/pages/fornecedor/FornecedorDashboard";
import FornecedorProdutos from "@/pages/fornecedor/FornecedorProdutos";
import FornecedorPOS from "@/pages/fornecedor/FornecedorPOS";
import FornecedorVendas from "@/pages/fornecedor/FornecedorVendas";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Acesso livre a todos os perfis */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/agricultores" element={<Agricultores />} />
              <Route path="/agricultores/:id" element={<FarmerProfile />} />
              <Route path="/escolas" element={<EscolasCampo />} />
              <Route path="/escolas/provincia/:slug" element={<ProvinciaEscolas />} />
              <Route path="/escolas/:id" element={<EscolaDetalhe />} />
              <Route path="/escolas/:id/ficha" element={<FichaEscola />} />
              <Route path="/agricultores/:id/ficha" element={<FichaProdutor />} />
              <Route path="/parcelas" element={<Parcelas />} />
              <Route path="/producao" element={<Producao />} />
              <Route path="/instalar" element={<Instalar />} />
              <Route path="/patec" element={<Patec />} />
              <Route path="/mosap3pay" element={<Mosap3Pay />} />
              <Route path="/mosap3pay/fornecedores" element={<Mosap3PayFornecedores />} />
              <Route path="/mosap3pay/pos" element={<Mosap3PayPOS />} />
              <Route path="/mosap3pay/vendas" element={<Mosap3PayVendas />} />

              {/* Incentivos & Transações: admin, gestor_incentivos */}
              <Route path="/incentivos" element={<RoleGuard allowedRoles={["admin", "gestor_incentivos"]}><Incentivos /></RoleGuard>} />
              <Route path="/transacoes" element={<RoleGuard allowedRoles={["admin", "gestor_incentivos"]}><Transacoes /></RoleGuard>} />

              {/* Compras & Empresas: admin, gestor_incentivos, senior/junior agronegócio */}
              <Route path="/compras" element={<RoleGuard allowedRoles={["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"]}><Compras /></RoleGuard>} />
              <Route path="/empresas" element={<RoleGuard allowedRoles={["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"]}><Empresas /></RoleGuard>} />

              {/* Relatórios: todos excepto junior_agronegocio e tecnico_extensionista */}
              <Route path="/relatorios" element={<RoleGuard allowedRoles={["admin", "gestor_incentivos", "senior_agricultura", "senior_monitoria", "junior_monitoria", "junior_agricultura", "senior_agronegocio"]}><Relatorios /></RoleGuard>} />

              {/* Admin only */}
              <Route path="/utilizadores" element={<RoleGuard allowedRoles={["admin"]}><Utilizadores /></RoleGuard>} />
              <Route path="/perfis" element={<RoleGuard allowedRoles={["admin"]}><Perfis /></RoleGuard>} />
              <Route path="/configuracoes" element={<RoleGuard allowedRoles={["admin"]}><Configuracoes /></RoleGuard>} />
              <Route path="/provincias" element={<RoleGuard allowedRoles={["admin"]}><GestaoProvincias /></RoleGuard>} />
            </Route>
          </Route>

          {/* Supplier Portal (isolated) */}
          <Route path="/fornecedor/login" element={<FornecedorAuth />} />
          <Route path="/fornecedor" element={<FornecedorLayout />}>
            <Route index element={<FornecedorDashboard />} />
            <Route path="produtos" element={<FornecedorProdutos />} />
            <Route path="pos" element={<FornecedorPOS />} />
            <Route path="vendas" element={<FornecedorVendas />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
