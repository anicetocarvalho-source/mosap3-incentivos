import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { useEffect, useState } from "react";
import { getPendingCount } from "@/lib/offlineDb";

const OnlineStatusBanner = () => {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState(0);

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

  if (isOnline && pending === 0) return null;

  return (
    <div
      className={`px-4 py-2 text-xs font-medium flex items-center gap-2 ${
        isOnline
          ? "bg-primary/10 text-primary"
          : "bg-warning/15 text-warning-foreground"
      }`}
    >
      {isOnline ? (
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
