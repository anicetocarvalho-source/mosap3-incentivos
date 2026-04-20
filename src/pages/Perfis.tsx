import { useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useModulePermissions, useTogglePermission } from "@/hooks/useModulePermissions";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gestor_incentivos: "Gestor Incentivos",
  senior_agricultura: "Sén. Agricultura",
  senior_monitoria: "Sén. Monitoria",
  junior_monitoria: "Jún. Monitoria",
  junior_agricultura: "Jún. Agricultura",
  senior_agronegocio: "Sén. Agronegócio",
  junior_agronegocio: "Jún. Agronegócio",
  tecnico_extensionista: "Téc. Extensionista",
  fornecedor: "Fornecedor",
};

const ROLES = Object.keys(ROLE_LABELS);

const MODULE_NAMES = [
  "Dashboard",
  "Cadastro de Agricultores",
  "Registo do Pequeno Produtor",
  "Escolas de Campo",
  "Incentivos",
  "MOSAP3Pay",
  "Transações",
  "Compras",
  "Parcelas",
  "Empresas",
  "Produção",
  "Pecuária",
  "Relatórios",
  "Gestão de Províncias",
  "Utilizadores",
  "Configurações",
  "Gestão de ECAs",
];

const Perfis = () => {
  const { data: matrix, isLoading } = useModulePermissions();
  const toggleMutation = useTogglePermission();

  const toggleAccess = useCallback((mod: string, role: string) => {
    if (!matrix) return;
    const current = matrix[mod]?.[role] ?? false;
    const newVal = !current;

    toggleMutation.mutate(
      { module_name: mod, role, has_access: newVal },
      {
        onSuccess: () => {
          toast({
            title: newVal ? "Acesso ativado" : "Acesso desativado",
            description: `${ROLE_LABELS[role]} → ${mod}`,
          });
        },
        onError: () => {
          toast({
            title: "Erro ao guardar",
            description: "Não foi possível actualizar a permissão.",
            variant: "destructive",
          });
        },
      }
    );
  }, [matrix, toggleMutation]);

  if (isLoading || !matrix) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Perfis & Permissões</h1>
          <p className="text-muted-foreground text-sm mt-1">A carregar matriz de permissões…</p>
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Perfis & Permissões</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Matriz de visibilidade dos módulos por perfil de utilizador
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] font-semibold">
                Módulo
              </TableHead>
              {ROLES.map((role) => (
                <TableHead key={role} className="text-center min-w-[100px]">
                  <span className="text-xs leading-tight block">{ROLE_LABELS[role]}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODULE_NAMES.map((mod) => (
              <TableRow key={mod}>
                <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">
                  {mod}
                </TableCell>
                {ROLES.map((role) => (
                  <TableCell key={role} className="text-center">
                    <Switch
                      checked={matrix[mod]?.[role] ?? false}
                      onCheckedChange={() => toggleAccess(mod, role)}
                      className="mx-auto"
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ROLES.map((role) => {
          const accessCount = MODULE_NAMES.filter((m) => matrix[m]?.[role]).length;
          return (
            <div key={role} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                {accessCount}
              </div>
              <div>
                <p className="font-medium text-sm">{ROLE_LABELS[role]}</p>
                <p className="text-xs text-muted-foreground">{accessCount} de {MODULE_NAMES.length} módulos</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Perfis;
