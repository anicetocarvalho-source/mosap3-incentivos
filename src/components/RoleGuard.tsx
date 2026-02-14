import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import AcessoNegado from "@/pages/AcessoNegado";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const { roles, isAdmin, user, loading } = useAuth();
  const toastShown = useRef(false);

  const hasAccess =
    !user || loading || isAdmin || roles.length === 0
      ? true
      : allowedRoles.some((r) => roles.includes(r));

  useEffect(() => {
    if (!loading && user && roles.length > 0 && !isAdmin && !hasAccess && !toastShown.current) {
      toastShown.current = true;
      toast({
        title: "Acesso negado",
        description: "Não tem permissão para aceder a este módulo.",
        variant: "destructive",
      });
    }
  }, [loading, user, roles, isAdmin, hasAccess]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <>{children}</>;
  if (roles.length === 0) return null;
  if (!hasAccess) return <AcessoNegado />;

  return <>{children}</>;
};

export default RoleGuard;
