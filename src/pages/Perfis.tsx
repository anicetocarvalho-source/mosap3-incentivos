import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

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

type Module = {
  name: string;
  allowedRoles: string[] | "all";
};

const MODULES: Module[] = [
  { name: "Dashboard", allowedRoles: "all" },
  { name: "Registo do Pequeno Produtor", allowedRoles: "all" },
  { name: "Escolas de Campo", allowedRoles: "all" },
  { name: "Incentivos", allowedRoles: ["admin", "gestor_incentivos"] },
  { name: "Transações", allowedRoles: ["admin", "gestor_incentivos"] },
  { name: "Compras", allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"] },
  { name: "Parcelas", allowedRoles: "all" },
  { name: "Empresas", allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"] },
  { name: "Produção", allowedRoles: "all" },
  { name: "Utilizadores", allowedRoles: ["admin"] },
  { name: "Configurações", allowedRoles: ["admin"] },
  { name: "Gestão de ECAs", allowedRoles: ["admin", "tecnico_extensionista"] },
];

const hasAccess = (module: Module, role: string) =>
  module.allowedRoles === "all" || module.allowedRoles.includes(role);

const Perfis = () => {
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
            {MODULES.map((mod) => (
              <TableRow key={mod.name}>
                <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">
                  {mod.name}
                </TableCell>
                {ROLES.map((role) => (
                  <TableCell key={role} className="text-center">
                    {hasAccess(mod, role) ? (
                      <Badge variant="outline" className="bg-accent text-accent-foreground border-0 h-7 w-7 p-0 inline-flex items-center justify-center">
                        <Check className="h-4 w-4" />
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center justify-center h-7 w-7 text-muted-foreground/40">
                        <X className="h-4 w-4" />
                      </span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ROLES.map((role) => {
          const accessCount = MODULES.filter((m) => hasAccess(m, role)).length;
          return (
            <div key={role} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                {accessCount}
              </div>
              <div>
                <p className="font-medium text-sm">{ROLE_LABELS[role]}</p>
                <p className="text-xs text-muted-foreground">{accessCount} de {MODULES.length} módulos</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Perfis;
