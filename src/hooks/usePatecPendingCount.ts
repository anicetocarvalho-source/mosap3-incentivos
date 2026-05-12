import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveScope, applyFarmerScopeFilter } from "@/lib/farmerScope";

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
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user && authReady,
    refetchInterval: authReady ? 60000 : false,
  });
};
