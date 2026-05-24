// Helper to detect non-production environments.
// True when running in Vite dev mode, on localhost, or on a Lovable
// preview subdomain (`id-preview--*.lovable.app`).
//
// The published `.lovable.app` URL is treated as PRODUCTION by default
// so test profiles and demo auto-fill are hidden from real users.
// Set `VITE_FORCE_DEV_MODE=true` to opt-in (e.g. for staging tests).
export function isDevOrPreview(): boolean {
  if (import.meta.env.DEV) return true;
  if ((import.meta.env.VITE_FORCE_DEV_MODE as string | undefined) === "true") return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;
  // Only the editor preview subdomain counts as preview.
  // The published `.lovable.app` is treated as production.
  return host.startsWith("id-preview--") && host.endsWith(".lovable.app");
}
