import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useModulePermissions, canAccessModule } from "@/hooks/useModulePermissions";
import type { Database } from "@/integrations/supabase/types";
import AcessoNegado from "@/pages/AcessoNegado";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  /** Kept for backwards compat but now secondary to DB matrix */
  allowedRoles: AppRole[];
  /** Module name in the permissions matrix (optional – if provided, DB check takes priority) */
  moduleName?: string;
  children: React.ReactNode;
}

const RoleGuard = ({ allowedRoles, moduleName, children }: RoleGuardProps) => {
  const { roles, isAdmin, user, loading, authReady } = useAuth();
  const { data: matrix } = useModulePermissions();
  const toastShown = useRef(false);

  // Determine access: DB matrix takes priority if available
  let hasAccess = true;
  if (user && !loading && authReady && !isAdmin && roles.length > 0) {
    if (moduleName && matrix && matrix[moduleName]) {
      hasAccess = canAccessModule(moduleName, roles, matrix, isAdmin);
    } else {
      // Fallback to hardcoded allowedRoles
      hasAccess = allowedRoles.some((r) => roles.includes(r));
    }
  }

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

  if (loading || !authReady) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <>{children}</>;
  if (roles.length === 0) return null;
  if (!hasAccess) return <cessoNegado />;

  return <>{children}</>;
};

export default RoleGuard;
