import { useState, useCallback, useEffect, useRef } from "react";
import {
  createDeviceSession,
  closeDeviceSession,
  subscribeToSession,
  type DeviceType,
  type DeviceSession,
  type DeviceCapture,
  type SdkWorkflowState,
} from "@/lib/deviceBridge";
import { toast } from "sonner";

interface UseDeviceSessionOptions {
  deviceType: DeviceType;
  farmerCode?: string;
  onCapture?: (capture: DeviceCapture) => void;
  onPaired?: () => void;
  onWorkflowUpdate?: (workflow: SdkWorkflowState) => void;
  autoClose?: boolean;
}

export function useDeviceSession({
  deviceType,
  farmerCode,
  onCapture,
  onPaired,
  onWorkflowUpdate,
  autoClose = true,
}: UseDeviceSessionOptions) {
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [captures, setCaptures] = useState<DeviceCapture[]>([]);
  const [sdkWorkflow, setSdkWorkflow] = useState<SdkWorkflowState>({});
  const [loading, setLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      const s = await createDeviceSession(deviceType, farmerCode);
      setSession(s);
      setStatus("pending");
      setCaptures([]);
      setSdkWorkflow({});

      unsubRef.current = subscribeToSession(
        s.id,
        (newStatus, metadata) => {
          setStatus(newStatus);

          // Extract SDK workflow state from metadata
          if (metadata?.sdk_workflow) {
            const wf = metadata.sdk_workflow as SdkWorkflowState;
            setSdkWorkflow(wf);
            onWorkflowUpdate?.(wf);
          }

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

          if (capture.capture_type === "fingerprint_template") {
            toast.success(
              `Template ISO capturado${capture.finger_position ? ` — ${capture.finger_position}` : ""}`,
              { description: capture.quality_score ? `Qualidade: ${capture.quality_score}` : undefined },
            );
          } else if (capture.capture_type === "fingerprint_image") {
            toast.success("Imagem da impressão digital recebida");
          } else {
            toast.success("Tag NFC lida");
          }
        },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao iniciar sessão";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [deviceType, farmerCode, onCapture, onPaired, onWorkflowUpdate]);

  const stop = useCallback(async () => {
    unsubRef.current?.();
    unsubRef.current = null;
    if (session) {
      await closeDeviceSession(session.id);
    }
    setSession(null);
    setStatus("idle");
    setSdkWorkflow({});
  }, [session]);

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
    sdkWorkflow,
    loading,
    isActive: ["pending", "paired", "active"].includes(status),
    start,
    stop,
  };
}
