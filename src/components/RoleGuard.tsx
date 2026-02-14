import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import AcessoNegado from "@/pages/AcessoNegado";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const { roles, isAdmin, user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <>{children}</>;
  if (roles.length === 0) return null;

  const hasAccess = allowedRoles.some((r) => roles.includes(r));

  if (!hasAccess) return <AcessoNegado />;

  return <>{children}</>;
};

export default RoleGuard;
