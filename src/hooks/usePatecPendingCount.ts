import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveScope, applyFarmerScopeFilter } from "@/lib/farmerScope";

const isAuthError = (err: unknown): boolean => {
  if (!err) return false;
  const anyErr = err as any;
  const status = anyErr?.status ?? anyErr?.code;
  if (status === 401 || status === "401" || status === "PGRST301") return true;
  const msg = String(anyErr?.message || "").toLowerCase();
  return msg.includes("jwt") || msg.includes("invalid token") || msg.includes("expired");
};

export const usePatecPendingCount = () => {
  const { user, roles, authReady } = useAuth();

  return useQuery({
    queryKey: ["patec-pending-count", user?.id, roles.join(",")],
    queryFn: async () => {
      if (!user) return 0;
      const scope = await resolveScope(user.id, roles);
      const query = applyFarmerScopeFilter(
        supabase.from("farmers").select("*", { count: "exact", head: true }).is("patec", null),
        scope
      );
      const { count, error } = await query;
      if (error) {
        if (isAuthError(error)) {
          // Try a single refresh; if it fails, silently return 0 so we don't loop.
          try {
            await supabase.auth.refreshSession();
          } catch {
            /* noop */
          }
          return 0;
        }
        throw error;
      }
      return count ?? 0;
    },
    enabled: !!user && authReady,
    refetchInterval: authReady ? 5 * 60 * 1000 : false,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => !isAuthError(error) && failureCount < 1,
  });
};
