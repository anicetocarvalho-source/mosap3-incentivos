/**
 * Centralised client-side error reporter.
 * Logs uncaught errors to the `client_errors` table in Lovable Cloud
 * so admins can audit incidents in production via `/diagnostico`.
 *
 * Throttling: same (message + url) is reported at most 1× per minute
 * to avoid flooding the table during render loops.
 */
import { supabase } from "@/integrations/supabase/client";

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";
const recentErrors = new Map<string, number>();
const THROTTLE_MS = 60_000;

export interface ReportContext {
  componentStack?: string;
  source?: string;
  [k: string]: unknown;
}

export async function reportClientError(
  error: unknown,
  context: ReportContext = {},
): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message || "Unknown error";
    const url = typeof window !== "undefined" ? window.location.href : "";
    const key = `${message}::${url}`;

    const last = recentErrors.get(key);
    const now = Date.now();
    if (last && now - last < THROTTLE_MS) return;
    recentErrors.set(key, now);

    let userId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      /* ignore */
    }

    await supabase.from("client_errors").insert({
      user_id: userId,
      message: message.slice(0, 1000),
      stack: err.stack?.slice(0, 5000) ?? null,
      url,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      context: context as any,
      app_version: APP_VERSION,
    });
  } catch (reportErr) {
    // Never let the reporter itself blow up
    console.warn("[errorReporter] failed to report:", reportErr);
  }
}

/** Install global handlers for uncaught errors and unhandled rejections. */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (ev) => {
    reportClientError(ev.error ?? ev.message, { source: "window.onerror" });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    reportClientError(ev.reason, { source: "unhandledrejection" });
  });
}
