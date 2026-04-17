import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, CloudUpload, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getPendingCount, syncAll } from "@/lib/offlineDb";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

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
          setTimeout(() => setJustSynced(false), 3500);
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

  const visible = !isOnline || pending > 0 || syncing || justSynced;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-50 pointer-events-none"
        >
          <div
            className={`pointer-events-auto px-3.5 py-2 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg backdrop-blur-md border ${
              justSynced
                ? "bg-success/90 text-success-foreground border-success/30"
                : syncing
                ? "bg-primary/90 text-primary-foreground border-primary/30"
                : !isOnline
                ? "bg-warning/90 text-warning-foreground border-warning/30"
                : "bg-card/95 text-foreground border-border"
            }`}
          >
            {justSynced ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Sincronizado com sucesso</span>
              </>
            ) : syncing ? (
              <>
                <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
                <span>A sincronizar {pending} registo(s)…</span>
              </>
            ) : !isOnline ? (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>Modo offline</span>
                {pending > 0 && (
                  <span className="ml-1 bg-warning-foreground/20 px-1.5 py-0.5 rounded-full text-[10px]">
                    {pending}
                  </span>
                )}
              </>
            ) : (
              <>
                <CloudUpload className="h-3.5 w-3.5" />
                <span>{pending} registo(s) por sincronizar</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OnlineStatusBanner;
