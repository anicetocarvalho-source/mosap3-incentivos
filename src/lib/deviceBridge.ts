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

export type FingerPosition =
  | "polegar_dir"
  | "indicador_dir"
  | "medio_dir"
  | "anelar_dir"
  | "polegar_esq"
  | "indicador_esq"
  | "medio_esq"
  | "anelar_esq";

export const FINGER_LABELS: Record<FingerPosition, string> = {
  polegar_dir: "Polegar Direito",
  indicador_dir: "Indicador Direito",
  medio_dir: "Médio Direito",
  anelar_dir: "Anelar Direito",
  polegar_esq: "Polegar Esquerdo",
  indicador_esq: "Indicador Esquerdo",
  medio_esq: "Médio Esquerdo",
  anelar_esq: "Anelar Esquerdo",
};

export const FINGER_POSITIONS: FingerPosition[] = [
  "polegar_dir",
  "indicador_dir",
  "medio_dir",
  "anelar_dir",
  "polegar_esq",
  "indicador_esq",
  "medio_esq",
  "anelar_esq",
];

export interface SdkWorkflowState {
  device_found?: boolean;
  device_opened?: boolean;
  capture_ready?: boolean;
  last_step?: string;
  last_status?: string;
  [key: string]: unknown;
}

export interface DeviceSession {
  id: string;
  session_code: string;
  device_type: DeviceType;
  status: string;
  farmer_code: string | null;
  expires_at: string;
  metadata: {
    sdk_workflow?: SdkWorkflowState;
    [key: string]: unknown;
  };
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

export interface FarmerFingerprint {
  id: string;
  farmer_code: string;
  finger_position: FingerPosition;
  template_iso: string;
  quality_score: number | null;
  is_active: boolean;
  created_at: string;
}

export interface FingerprintVerification {
  id: string;
  farmer_code: string;
  finger_position: string | null;
  match_score: number;
  match_result: "match" | "no_match" | "error";
  created_at: string;
}

export const MATCH_THRESHOLD = 580;
export const MATCH_MAX = 2000;
export const ISO_TEMPLATE_SIZE = 498;
export const RAW_IMAGE_SIZE = { width: 256, height: 360 };

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
  return data as unknown as DeviceSession;
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

/** Get enrolled fingerprints for a farmer */
export async function getEnrolledFingerprints(
  farmerCode: string,
): Promise<FarmerFingerprint[]> {
  const { data, error } = await supabase
    .from("farmer_fingerprints")
    .select("*")
    .eq("farmer_code", farmerCode)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as FarmerFingerprint[];
}

/** Get verification history for a farmer */
export async function getVerificationHistory(
  farmerCode: string,
  limit = 10,
): Promise<FingerprintVerification[]> {
  const { data, error } = await supabase
    .from("fingerprint_verifications")
    .select("*")
    .eq("farmer_code", farmerCode)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as FingerprintVerification[];
}

/** Deactivate a fingerprint */
export async function deactivateFingerprint(id: string): Promise<void> {
  const { error } = await supabase
    .from("farmer_fingerprints")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
}

/** Subscribe to session status changes */
export function subscribeToSession(
  sessionId: string,
  onStatusChange: (status: string, metadata?: Record<string, unknown>) => void,
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
        const s = payload.new as unknown as DeviceSession;
        onStatusChange(s.status, s.metadata);
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

/** Get quality label for ISO score */
export function getQualityLabel(score: number | null): {
  label: string;
  color: string;
} {
  if (score == null) return { label: "N/A", color: "text-muted-foreground" };
  if (score < 40) return { label: "Fraca", color: "text-destructive" };
  if (score < 70) return { label: "Média", color: "text-warning" };
  return { label: "Boa", color: "text-success" };
}

/** Get match result label */
export function getMatchLabel(score: number): {
  label: string;
  color: string;
  percentage: number;
} {
  const pct = Math.min(100, Math.round(((score - MATCH_THRESHOLD) / (MATCH_MAX - MATCH_THRESHOLD)) * 100));
  if (score < MATCH_THRESHOLD) return { label: "Sem correspondência", color: "text-destructive", percentage: 0 };
  if (pct < 50) return { label: "Correspondência fraca", color: "text-warning", percentage: pct };
  if (pct < 80) return { label: "Correspondência boa", color: "text-info", percentage: pct };
  return { label: "Correspondência excelente", color: "text-success", percentage: pct };
}
