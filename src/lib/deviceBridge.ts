/**
 * Device Bridge — abstraction layer for G2010 Fingerprint & SOTEN NFC SDKs.
 *
 * Flow:
 * 1. Web creates a "device_session" with a 6-char code
 * 2. User scans QR/types code on Android companion app
 * 3. Android pairs via Edge Function, captures data, sends to DB
 * 4. Web listens to Realtime for new captures
 */
import { supabase } from "@/integrations/supabase/client";

export type DeviceType = "fingerprint" | "nfc";

export type CaptureType =
  | "fingerprint_template"
  | "fingerprint_image"
  | "nfc_uid"
  | "nfc_ndef";

export interface DeviceSession {
  id: string;
  session_code: string;
  device_type: DeviceType;
  status: string;
  farmer_code: string | null;
  expires_at: string;
  metadata: Record<string, unknown>;
}

export interface DeviceCapture {
  id: string;
  session_id: string;
  capture_type: CaptureType;
  data: string;
  finger_position: string | null;
  quality_score: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Create a new pairing session */
export async function createDeviceSession(
  deviceType: DeviceType,
  farmerCode?: string,
): Promise<DeviceSession> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Utilizador não autenticado");

  const sessionCode = generateSessionCode();

  const { data, error } = await supabase
    .from("device_sessions")
    .insert({
      session_code: sessionCode,
      device_type: deviceType,
      user_id: user.id,
      farmer_code: farmerCode || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DeviceSession;
}

/** Close a session */
export async function closeDeviceSession(sessionId: string): Promise<void> {
  await supabase
    .from("device_sessions")
    .update({ status: "closed" })
    .eq("id", sessionId);
}

/** Get captures for a session */
export async function getSessionCaptures(
  sessionId: string,
): Promise<DeviceCapture[]> {
  const { data, error } = await supabase
    .from("device_captures")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as DeviceCapture[];
}

/** Subscribe to session status changes */
export function subscribeToSession(
  sessionId: string,
  onStatusChange: (status: string) => void,
  onCapture: (capture: DeviceCapture) => void,
) {
  const channel = supabase
    .channel(`device-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "device_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        onStatusChange((payload.new as DeviceSession).status);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "device_captures",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        onCapture(payload.new as DeviceCapture);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Build the QR code URL for Android companion app */
export function buildPairingUrl(sessionCode: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
  return `mosap3://pair?code=${sessionCode}&project=${projectId}`;
}

/** Build the Edge Function URL for the Android app */
export function getEdgeFunctionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  return `${supabaseUrl}/functions/v1/device-bridge`;
}
