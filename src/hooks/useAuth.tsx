import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { User } from "@supabase/supabase-js";
import { normalizeAuthSessionClockSkew, normalizeStoredAuthSessionClockSkew } from "@/lib/authSessionClockSkew";
import { cacheSession as doCacheSession, getLastSession, clearCachedSession, type CachedSession } from "@/lib/offlineAuth";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthState {
  user: User | null;
  profile: { full_name: string; phone: string | null } | null;
  roles: AppRole[];
  loading: boolean;
  authReady: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  isAdmin: boolean;
  isOfflineSession: boolean;
  offlineLogout: () => void;
  setOfflineSession: (session: CachedSession) => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  roles: [],
  loading: true,
  authReady: false,
  hasRole: () => false,
  hasAnyRole: () => false,
  isAdmin: false,
  isOfflineSession: false,
  offlineLogout: () => {},
  setOfflineSession: () => {},
});

export const useAuth = () => useContext(AuthContext);

function sameUserId(a: User | null, b: User | null) {
  return (a?.id ?? null) === (b?.id ?? null);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);

  // Guards against concurrent fetches and double initialization
  const fetchingRef = useRef<string | null>(null);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const initializedRef = useRef(false);
  const authCycleRef = useRef(0);
  const mountedRef = useRef(true);
  const authDispatchTimeoutsRef = useRef<number[]>([]);

  // Keep track of current email for offline caching
  const emailRef = useRef<string | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    // Prevent concurrent fetches for the same user
    if (fetchingRef.current === userId && fetchPromiseRef.current) {
      await fetchPromiseRef.current;
      return;
    }

    fetchingRef.current = userId;
    fetchPromiseRef.current = (async () => {
      try {
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("full_name, phone").eq("user_id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);

        const prof = profileRes.data ?? null;
        const fetchedRoles = rolesRes.data?.map((r) => r.role) ?? [];

        setProfile(prof);
        setRoles(fetchedRoles);

        // Auto-cache session for offline use (fire-and-forget)
        const email = emailRef.current;
        if (email) {
          doCacheSession(email, "", userId, prof, fetchedRoles).catch(() => {});
        }
      } finally {
        fetchingRef.current = null;
        fetchPromiseRef.current = null;
      }
    })();

    await fetchPromiseRef.current;
  }, []);

  // Restore offline session if no online session
  const tryRestoreOffline = useCallback(async () => {
    if (!navigator.onLine) {
      const cached = await getLastSession();
      if (cached) {
        setUser({ id: cached.userId, email: cached.email } as User);
        setProfile(cached.profile);
        setRoles(cached.roles as AppRole[]);
        setIsOfflineSession(true);
        return true;
      }
    }
    return false;
  }, []);

  const offlineLogout = useCallback(() => {
    clearCachedSession();
    setUser(null);
    setProfile(null);
    setRoles([]);
    setIsOfflineSession(false);
    setAuthReady(true);
    setLoading(false);
  }, []);

  const setOfflineSession = useCallback((session: CachedSession) => {
    setUser({ id: session.userId, email: session.email } as User);
    setProfile(session.profile);
    setRoles(session.roles as AppRole[]);
    setIsOfflineSession(true);
    setAuthReady(true);
    setLoading(false);
  }, []);

  const setResolvedAuthUser = useCallback((nextUser: User | null) => {
    setAuthUser((prev) => {
      if (prev !== undefined && sameUserId(prev, nextUser)) {
        return prev;
      }

      return nextUser;
    });
  }, []);

  const queueAuthWork = useCallback((callback: () => void) => {
    if (typeof window === "undefined") {
      callback();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      authDispatchTimeoutsRef.current = authDispatchTimeoutsRef.current.filter((id) => id !== timeoutId);

      if (!mountedRef.current) return;
      callback();
    }, 0);

    authDispatchTimeoutsRef.current.push(timeoutId);
  }, []);

  const resolveAuthState = useCallback(async (currentUser: User | null) => {
    const cycle = ++authCycleRef.current;

    setLoading(true);
    setAuthReady(false);

    if (currentUser) {
      setUser(currentUser);
      setIsOfflineSession(false);
      emailRef.current = currentUser.email ?? null;

      await fetchUserData(currentUser.id);

      if (authCycleRef.current !== cycle) return;

      setLoading(false);
      setAuthReady(true);
      return;
    }

    setUser(null);
    setProfile(null);
    setRoles([]);
    setIsOfflineSession(false);

    await tryRestoreOffline();

    if (authCycleRef.current !== cycle) return;

    setLoading(false);
    setAuthReady(true);
  }, [fetchUserData, tryRestoreOffline]);

  // Proactive token refresh: ensures the session is fresh on focus/visibility/online,
  // and forces sign-out + redirect to /auth if refresh fails (avoids 401 loops).
  const ensureFreshSession = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const expiresAt = (session.expires_at ?? 0) * 1000;
      const msUntilExpiry = expiresAt - Date.now();

      // Refresh if already expired OR within 2 minutes of expiring.
      if (msUntilExpiry < 2 * 60 * 1000) {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn("[auth] Refresh failed, signing out", error.message);
          await supabase.auth.signOut().catch(() => {});
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
            window.location.replace("/auth");
          }
        }
      }
    } catch (e) {
      console.warn("[auth] ensureFreshSession error", e);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    normalizeStoredAuthSessionClockSkew();

    // CRITICAL: Set up onAuthStateChange FIRST, BEFORE getSession.
    // The callback must NOT do Supabase work synchronously to avoid auth deadlocks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") return;

        queueAuthWork(() => {
          const normalizedSession = normalizeAuthSessionClockSkew(session);

          // Keep the stored session normalized on refresh, but do not re-run
          // profile/roles queries when only the token changed.
          if (event === "TOKEN_REFRESHED") return;

          // If signed out remotely (e.g. refresh failed), force redirect to /auth.
          if (event === "SIGNED_OUT") {
            setResolvedAuthUser(null);
            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
              window.location.replace("/auth");
            }
            return;
          }

          setResolvedAuthUser(normalizedSession?.user ?? null);
        });
      }
    );

    // Then restore session from storage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Guard against double init (StrictMode)
      if (initializedRef.current || !mountedRef.current) return;
      initializedRef.current = true;

      const normalizedSession = normalizeAuthSessionClockSkew(session);

      // If session is expired at boot, try to refresh once before resolving.
      if (normalizedSession && (normalizedSession.expires_at ?? 0) * 1000 < Date.now() + 60 * 1000) {
        await ensureFreshSession();
        const { data: { session: refreshed } } = await supabase.auth.getSession();
        const renorm = normalizeAuthSessionClockSkew(refreshed);
        setResolvedAuthUser(renorm?.user ?? null);
        return;
      }

      setResolvedAuthUser(normalizedSession?.user ?? null);
    });

    // Re-check session on focus / visibility / online to refresh proactively.
    const onFocus = () => { void ensureFreshSession(); };
    const onVisibility = () => { if (document.visibilityState === "visible") void ensureFreshSession(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // Periodic safety check every 4 minutes.
    const interval = window.setInterval(() => { void ensureFreshSession(); }, 4 * 60 * 1000);

    return () => {
      mountedRef.current = false;
      authDispatchTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      authDispatchTimeoutsRef.current = [];
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [queueAuthWork, setResolvedAuthUser, ensureFreshSession]);

  useEffect(() => {
    if (authUser === undefined) return;
    void resolveAuthState(authUser);
  }, [authUser, resolveAuthState]);

  // Listen for online event to re-sync if we were in offline mode
  useEffect(() => {
    const handler = () => {
      if (isOfflineSession) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          const normalizedSession = normalizeAuthSessionClockSkew(session);
          setResolvedAuthUser(normalizedSession?.user ?? null);
        });
      }
    };
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [isOfflineSession, setResolvedAuthUser]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback((r: AppRole[]) => r.some((role) => roles.includes(role)), [roles]);
  const isAdmin = roles.includes("admin");

  return (
    <AuthContext.Provider
      value={{ user, profile, roles, loading, authReady, hasRole, hasAnyRole, isAdmin, isOfflineSession, offlineLogout, setOfflineSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/** Helper to cache session after a successful online login */
export { doCacheSession as cacheAuthSession };
