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
import Dashboard from "@/pages/Dashboard";
import Agricultores from "@/pages/Agricultores";
import Empresas from "@/pages/Empresas";
import Transacoes from "@/pages/Transacoes";
import Utilizadores from "@/pages/Utilizadores";
import Incentivos from "@/pages/Incentivos";
import Compras from "@/pages/Compras";
import Parcelas from "@/pages/Parcelas";
import Producao from "@/pages/Producao";
import FarmerProfile from "@/pages/FarmerProfile";
import FichaProdutor from "@/pages/FichaProdutor";
import FichaEscola from "@/pages/FichaEscola";
import Instalar from "@/pages/Instalar";
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
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agricultores" element={<Agricultores />} />
            <Route path="/agricultores/:id" element={<FarmerProfile />} />
            <Route path="/escolas" element={<EscolasCampo />} />
            <Route path="/escolas/provincia/:slug" element={<ProvinciaEscolas />} />
            <Route path="/escolas/:id" element={<EscolaDetalhe />} />
            <Route path="/escolas/:id/ficha" element={<FichaEscola />} />
            <Route path="/agricultores/:id/ficha" element={<FichaProdutor />} />
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/transacoes" element={<Transacoes />} />
            <Route path="/utilizadores" element={<Utilizadores />} />
            <Route path="/perfis" element={<Utilizadores />} />
            <Route path="/incentivos" element={<Incentivos />} />
            <Route path="/compras" element={<Compras />} />
            <Route path="/parcelas" element={<Parcelas />} />
            <Route path="/producao" element={<Producao />} />
            <Route path="/configuracoes" element={<Dashboard />} />
            <Route path="/instalar" element={<Instalar />} />
            <Route path="/provincias" element={<Dashboard />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
