// Helper to detect non-production environments.
// True when running in Vite dev mode OR when served from the Lovable
// preview/published subdomain. False on real custom production domains.
export function isDevOrPreview(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith(".lovable.app") || host === "localhost" || host === "127.0.0.1";
}
