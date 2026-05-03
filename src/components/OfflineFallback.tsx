import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, RefreshCw, Database, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getPendingCount } from "@/lib/offlineDb";

interface OfflineFallbackProps {
  /** The error that triggered the fallback (optional) */
  error?: Error | null;
  /** Callback to retry the failed operation */
  onRetry?: () => void;
  /** If true, renders as a full-page fallback; otherwise inline */
  fullPage?: boolean;
  /** Override the title */
  title?: string;
  /** Override the description */
  description?: string;
  /** Additional CSS classes */
  className?: string;
  /** The children to render when online or when no error */
  children?: React.ReactNode;
}

/**
 * OfflineFallback — shows a contextual message when the user is offline
 * and an API call has failed, with actionable alternatives.
 *
 * Usage:
 *   <OfflineFallback error={queryError} onRetry={refetch}>
 *     <MyDataTable />
 *   </OfflineFallback>
 */
const OfflineFallback = ({
  error,
  onRetry,
  fullPage = false,
  title,
  description,
  className,
  children,
}: OfflineFallbackProps) => {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    getPendingCount().then(setPendingCount).catch(() => setPendingCount(0));
  }, [isOnline]);

  // Determine if we should show the fallback
  const isNetworkError =
    error &&
    (error.message?.toLowerCase().includes("fetch") ||
      error.message?.toLowerCase().includes("network") ||
      error.message?.toLowerCase().includes("failed to fetch") ||
      error.message?.toLowerCase().includes("load failed") ||
      error.message?.toLowerCase().includes("timeout") ||
      error.message?.toLowerCase().includes("err_internet_disconnected"));

  const shouldShow = !isOnline && (!!error || !children);
  const shouldShowNetworkError = isNetworkError && !isOnline;

  // If online and no network error, or offline but no error and children exist, render children
  if (!shouldShow && !shouldShowNetworkError) {
    return <>{children}</>;
  }

  const resolvedTitle =
    title ||
    (!isOnline
      ? "Sem ligação à internet"
      : "Falha na comunicação com o servidor");

  const resolvedDescription =
    description ||
    (!isOnline
      ? "Está a trabalhar no modo offline. Algumas funcionalidades podem estar limitadas até a ligação ser restabelecida."
      : "Não foi possível obter os dados. Verifique a sua ligação e tente novamente.");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-4",
        fullPage ? "min-h-[60vh]" : "py-12",
        className
      )}
    >
      <div className="mb-5 h-20 w-20 rounded-full bg-warning/10 flex items-center justify-center">
        {isOnline ? (
          <CloudOff className="h-10 w-10 text-warning" />
        ) : (
          <WifiOff className="h-10 w-10 text-warning" />
        )}
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-1">
        {resolvedTitle}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {resolvedDescription}
      </p>

      {/* Pending sync indicator */}
      {pendingCount > 0 && (
        <Card className="p-3 mb-4 max-w-sm w-full">
          <div className="flex items-center gap-3 text-sm">
            <Database className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium">
                {pendingCount} registo(s) guardado(s) localmente
              </p>
              <p className="text-xs text-muted-foreground">
                Serão sincronizados automaticamente quando a ligação for
                restabelecida.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        {onRetry && (
          <Button onClick={onRetry} size="sm" variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        )}
        <Button
          onClick={() => window.location.reload()}
          size="sm"
          variant="ghost"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Recarregar página
        </Button>
      </div>

      {/* Tips */}
      <Card className="mt-6 p-4 max-w-sm w-full text-left">
        <h4 className="text-sm font-semibold mb-2">O que pode fazer offline:</h4>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-success mt-0.5">✓</span>
            Consultar dados previamente carregados (cache local)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-success mt-0.5">✓</span>
            Registar novos produtores — serão sincronizados depois
          </li>
          <li className="flex items-start gap-2">
            <span className="text-success mt-0.5">✓</span>
            Navegar entre páginas já visitadas
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning mt-0.5">✗</span>
            Acções que requerem o servidor (login, relatórios em tempo real)
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default OfflineFallback;
