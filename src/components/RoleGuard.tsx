import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

/**
 * Protects a route so only users with one of the allowed roles can access it.
 * Admin always passes. If roles haven't loaded yet, renders nothing (avoids flash).
 * Unauthorized users are redirected to the dashboard.
 */
const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const { roles, isAdmin, user, loading } = useAuth();

  if (loading) return null;

  // Not logged in — ProtectedRoute handles this, but just in case
  if (!user) return <Navigate to="/auth" replace />;

  // Admin sees everything
  if (isAdmin) return <>{children}</>;

  // Roles not yet loaded — wait
  if (roles.length === 0) return null;

  const hasAccess = allowedRoles.some((r) => roles.includes(r));

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
