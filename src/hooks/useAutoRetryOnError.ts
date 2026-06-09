import { useEffect, useRef } from "react";

/**
 * Re-invokes `refetch` whenever the current `error` is non-null and one of the
 * following recovery signals fires:
 *   - the tab regains focus / becomes visible
 *   - the browser comes back online
 *   - a `mosap3-data-refresh` custom event is dispatched
 *   - a periodic timer (exponential backoff, capped at 60s)
 *
 * Intended for pages whose data may transiently fail due to permission
 * (42501), network, or RLS issues that get resolved server-side (e.g. an
 * admin grants EXECUTE) — the UI then recovers without a manual reload.
 */
export function useAutoRetryOnError(
  error: unknown,
  refetch: () => void | Promise<unknown>,
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!error) return;

    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (cancelled) return;
      try {
        const r = refetchRef.current?.();
        if (r && typeof (r as Promise<unknown>).then === "function") {
          (r as Promise<unknown>).catch(() => {});
        }
      } catch {
        /* swallow — error state from the caller will retrigger */
      }
    };

    const schedule = () => {
      if (cancelled) return;
      const delay = Math.min(5000 * Math.pow(2, attempt), 60_000);
      attempt += 1;
      timer = setTimeout(() => {
        run();
        schedule();
      }, delay);
    };

    const onFocus = () => run();
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    const onOnline = () => run();
    const onRefresh = () => run();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("mosap3-data-refresh", onRefresh);

    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("mosap3-data-refresh", onRefresh);
    };
  }, [error]);
}
