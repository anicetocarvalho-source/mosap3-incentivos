import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const usePatecPendingCount = () => {
  const { user, authReady } = useAuth();

  return useQuery({
    queryKey: ["patec-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("farmers")
        .select("*", { count: "exact", head: true })
        .is("patec", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user && authReady,
    refetchInterval: authReady ? 60000 : false,
  });
};
