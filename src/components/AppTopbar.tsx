import { Link, useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import NotificationBell from "@/components/NotificationBell";
import { Separator } from "@/components/ui/separator";
import { Fragment, useMemo } from "react";

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  agricultores: "Produtores",
  escolas: "Escolas de Campo",
  "escolas-campo": "Escolas de Campo",
  "notas-credito": "Notas de Crédito",
  provincia: "Província",
  ficha: "Ficha",
  parcelas: "Parcelas",
  producao: "Produção",
  incentivos: "Incentivos",
  transacoes: "Transações",
  patec: "PATEC",
  mosap3pay: "MOSAP3Pay",
  fornecedores: "Fornecedores",
  pos: "Terminal POS",
  vendas: "Vendas",
  stock: "Stock",
  relatorios: "Relatórios",
  auditoria: "Auditoria",
  configuracoes: "Configurações",
  utilizadores: "Utilizadores",
  perfis: "Perfis",
  provincias: "Províncias",
  instalar: "Instalar App",
};

const labelFor = (segment: string) => {
  if (ROUTE_LABELS[segment]) return ROUTE_LABELS[segment];
  const spaced = segment.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const AppTopbar = () => {
  const location = useLocation();

  const crumbs = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [{ label: "Dashboard", path: "/", isLast: true }];
    return [
      { label: "Início", path: "/", isLast: false },
      ...segments.map((seg, i) => ({
        label: labelFor(seg),
        path: "/" + segments.slice(0, i + 1).join("/"),
        isLast: i === segments.length - 1,
      })),
    ];
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-md px-3 md:px-4">
      <SidebarTrigger className="text-foreground" />
      <Separator orientation="vertical" className="h-5" />

      <Breadcrumb className="flex-1 min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, i) => (
            <Fragment key={crumb.path}>
              <BreadcrumbItem className="hidden md:inline-flex">
                {crumb.isLast ? (
                  <BreadcrumbPage className="capitalize text-sm font-medium truncate max-w-[200px]">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.path} className="capitalize text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {i < crumbs.length - 1 && (
                <BreadcrumbSeparator className="hidden md:inline-flex text-muted-foreground/50" />
              )}
            </Fragment>
          ))}
          {/* Mobile: only last crumb */}
          <BreadcrumbItem className="md:hidden">
            <BreadcrumbPage className="capitalize text-sm font-medium truncate">
              {crumbs[crumbs.length - 1].label}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-1 ml-auto">
        <NotificationBell />
      </div>
    </header>
  );
};

export default AppTopbar;
