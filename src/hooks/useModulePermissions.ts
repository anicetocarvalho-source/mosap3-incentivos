import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ModulePermission {
  module_name: string;
  role: string;
  has_access: boolean;
}

/**
 * Fetches the full permissions matrix from module_permissions table.
 * Returns a Record<moduleName, Record<role, boolean>> for easy lookup.
 */
export const useModulePermissions = () => {
  const { user, authReady } = useAuth();

  return useQuery({
    queryKey: ["module_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_permissions")
        .select("module_name, role, has_access");
      if (error) throw error;

      const matrix: Record<string, Record<string, boolean>> = {};
      for (const row of data ?? []) {
        if (!matrix[row.module_name]) matrix[row.module_name] = {};
        matrix[row.module_name][row.role] = row.has_access;
      }
      return matrix;
    },
    enabled: !!user && authReady,
    staleTime: 10 * 60 * 1000, // 10 min
  });
};

/**
 * Mutation to toggle a single permission cell.
 */
export const useTogglePermission = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      module_name,
      role,
      has_access,
    }: ModulePermission) => {
      const { error } = await supabase
        .from("module_permissions")
        .update({ has_access, updated_at: new Date().toISOString() })
        .eq("module_name", module_name)
        .eq("role", role);
      if (error) throw error;
    },
    onMutate: async ({ module_name, role, has_access }) => {
      await qc.cancelQueries({ queryKey: ["module_permissions"] });
      const prev = qc.getQueryData<Record<string, Record<string, boolean>>>(["module_permissions"]);
      if (prev) {
        const next = { ...prev, [module_name]: { ...prev[module_name], [role]: has_access } };
        qc.setQueryData(["module_permissions"], next);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["module_permissions"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["module_permissions"] });
    },
  });
};

/**
 * Maps a module display name (from the permissions matrix) to the
 * corresponding route-level check used in RoleGuard / AppLayout.
 * This allows the admin to control visibility of sidebar items + route access.
 */
export const MODULE_ROUTE_MAP: Record<string, string[]> = {
  Dashboard: ["/"],
  "Cadastro de Agricultores": ["/agricultores"],
  "Escolas de Campo": ["/escolas"],
  Parcelas: ["/parcelas"],
  "Produção": ["/producao"],
  Incentivos: ["/incentivos", "/patec"],
  "Transações": ["/transacoes"],
  "Relatórios": ["/relatorios"],
  "Gestão de Províncias": ["/provincias"],
  Utilizadores: ["/utilizadores"],
  "Configurações": ["/configuracoes"],
  "Gestão de ECAs": ["/escolas"],
};

/**
 * Given a user's roles array and the permissions matrix,
 * returns whether the user can access the given module.
 */
export const canAccessModule = (
  moduleName: string,
  roles: string[],
  matrix: Record<string, Record<string, boolean>> | undefined,
  isAdmin: boolean
): boolean => {
  if (isAdmin) return true;
  if (!matrix || !matrix[moduleName]) return true; // fallback: allow if no data
  return roles.some((r) => matrix[moduleName]?.[r] === true);
};
