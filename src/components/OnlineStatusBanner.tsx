import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Wifi, WifiOff, CloudUpload, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getPendingCount, syncAll } from "@/lib/offlineDb";
import { toast } from "@/hooks/use-toast";

const OnlineStatusBanner = () => {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const check = async () => {
      const count = await getPendingCount();
      setPending(count);
    };
    check();

    const handler = () => check();
    window.addEventListener("mosap3-sync", handler);
    window.addEventListener("mosap3-saved", handler);
    return () => {
      window.removeEventListener("mosap3-sync", handler);
      window.removeEventListener("mosap3-saved", handler);
    };
  }, [isOnline]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pending > 0 && !syncing) {
      setSyncing(true);
      syncAll().then((result) => {
        setSyncing(false);
        setPending(0);
        if (result.synced > 0) {
          setJustSynced(true);
          toast({
            title: "Sincronização concluída",
            description: `${result.synced} registo(s) sincronizado(s) com sucesso.${result.failed > 0 ? ` ${result.failed} falharam.` : ""}`,
          });
          window.dispatchEvent(new CustomEvent("mosap3-sync", { detail: result }));
          setTimeout(() => setJustSynced(false), 4000);
        }
        if (result.failed > 0 && result.synced === 0) {
          toast({
            title: "Falha na sincronização",
            description: `${result.failed} registo(s) falharam. Serão tentados novamente.`,
            variant: "destructive",
          });
        }
      });
    }
  }, [isOnline, pending, syncing]);

  if (isOnline && pending === 0 && !syncing && !justSynced) return null;

  return (
    <div
      className={`px-4 py-2 text-xs font-medium flex items-center gap-2 ${
        justSynced
          ? "bg-success/10 text-success"
          : syncing
          ? "bg-primary/10 text-primary"
          : isOnline
          ? "bg-primary/10 text-primary"
          : "bg-warning/15 text-warning-foreground"
      }`}
    >
      {justSynced ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Todos os dados foram sincronizados com sucesso!</span>
        </>
      ) : syncing ? (
        <>
          <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
          <span>A sincronizar {pending} registo(s)...</span>
        </>
      ) : isOnline ? (
        <>
          <CloudUpload className="h-3.5 w-3.5" />
          <span>{pending} registo(s) por sincronizar</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>Modo offline — os dados serão sincronizados automaticamente</span>
          {pending > 0 && (
            <span className="ml-auto bg-warning/20 px-2 py-0.5 rounded-full">
              {pending} pendente(s)
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default OnlineStatusBanner;
