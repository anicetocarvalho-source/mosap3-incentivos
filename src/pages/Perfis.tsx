import { useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

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
};

const ROLES = Object.keys(ROLE_LABELS);

const MODULE_NAMES = [
  "Dashboard",
  "Cadastro de Agricultores",
  "Registo do Pequeno Produtor",
  "Escolas de Campo",
  "Incentivos",
  "Transações",
  "Compras",
  "Parcelas",
  "Empresas",
  "Produção",
  "Utilizadores",
  "Configurações",
  "Gestão de ECAs",
];

const DEFAULT_ACCESS: Record<string, Record<string, boolean>> = {};
MODULE_NAMES.forEach((mod) => {
  DEFAULT_ACCESS[mod] = {};
  ROLES.forEach((role) => {
    const allAccess = ["Dashboard", "Cadastro de Agricultores", "Registo do Pequeno Produtor", "Escolas de Campo", "Parcelas", "Produção"];
    if (allAccess.includes(mod)) {
      DEFAULT_ACCESS[mod][role] = true;
    } else if (mod === "Incentivos" || mod === "Transações") {
      DEFAULT_ACCESS[mod][role] = ["admin", "gestor_incentivos"].includes(role);
    } else if (mod === "Compras" || mod === "Empresas") {
      DEFAULT_ACCESS[mod][role] = ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"].includes(role);
    } else if (mod === "Utilizadores" || mod === "Configurações") {
      DEFAULT_ACCESS[mod][role] = role === "admin";
    } else if (mod === "Gestão de ECAs") {
      DEFAULT_ACCESS[mod][role] = ["admin", "tecnico_extensionista"].includes(role);
    } else {
      DEFAULT_ACCESS[mod][role] = false;
    }
  });
});

const Perfis = () => {
  const [access, setAccess] = useState<Record<string, Record<string, boolean>>>(DEFAULT_ACCESS);

  const toggleAccess = useCallback((mod: string, role: string) => {
    setAccess((prev) => {
      const newVal = !prev[mod][role];
      toast({
        title: newVal ? "Acesso ativado" : "Acesso desativado",
        description: `${ROLE_LABELS[role]} → ${mod}`,
      });
      return {
        ...prev,
        [mod]: { ...prev[mod], [role]: newVal },
      };
    });
  }, []);

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
                      checked={access[mod][role]}
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
          const accessCount = MODULE_NAMES.filter((m) => access[m][role]).length;
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
