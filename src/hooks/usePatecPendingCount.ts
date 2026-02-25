import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePatecPendingCount = () => {
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
    refetchInterval: 60000,
  });
};
