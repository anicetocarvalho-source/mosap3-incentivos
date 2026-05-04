import { useState, useCallback, useEffect, useRef } from "react";
import {
  createDeviceSession,
  closeDeviceSession,
  subscribeToSession,
  type DeviceType,
  type DeviceSession,
  type DeviceCapture,
} from "@/lib/deviceBridge";
import { toast } from "sonner";

interface UseDeviceSessionOptions {
  deviceType: DeviceType;
  farmerCode?: string;
  onCapture?: (capture: DeviceCapture) => void;
  onPaired?: () => void;
  autoClose?: boolean;
}

export function useDeviceSession({
  deviceType,
  farmerCode,
  onCapture,
  onPaired,
  autoClose = true,
}: UseDeviceSessionOptions) {
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [captures, setCaptures] = useState<DeviceCapture[]>([]);
  const [loading, setLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      const s = await createDeviceSession(deviceType, farmerCode);
      setSession(s);
      setStatus("pending");
      setCaptures([]);

      // Subscribe to realtime
      unsubRef.current = subscribeToSession(
        s.id,
        (newStatus) => {
          setStatus(newStatus);
          if (newStatus === "paired") {
            toast.success("Dispositivo emparelhado!");
            onPaired?.();
          }
          if (newStatus === "expired" || newStatus === "closed") {
            toast.info("Sessão encerrada");
          }
        },
        (capture) => {
          setCaptures((prev) => [...prev, capture]);
          onCapture?.(capture);
          toast.success(
            capture.capture_type.startsWith("fingerprint")
              ? "Impressão digital recebida"
              : "Tag NFC lida",
          );
        },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao iniciar sessão";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [deviceType, farmerCode, onCapture, onPaired]);

  const stop = useCallback(async () => {
    unsubRef.current?.();
    unsubRef.current = null;
    if (session) {
      await closeDeviceSession(session.id);
    }
    setSession(null);
    setStatus("idle");
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      if (autoClose && session) {
        closeDeviceSession(session.id).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    session,
    status,
    captures,
    loading,
    isActive: ["pending", "paired", "active"].includes(status),
    start,
    stop,
  };
}
