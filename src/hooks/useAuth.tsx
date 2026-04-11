import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { User } from "@supabase/supabase-js";
import { cacheSession, getLastSession, clearCachedSession, type CachedSession } from "@/lib/offlineAuth";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthState {
  user: User | null;
  profile: { full_name: string; phone: string | null } | null;
  roles: AppRole[];
  loading: boolean;
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
  hasRole: () => false,
  hasAnyRole: () => false,
  isAdmin: false,
  isOfflineSession: false,
  offlineLogout: () => {},
  setOfflineSession: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  // Guards against concurrent fetches and double initialization
  const fetchingRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const fetchUserData = useCallback(async (userId: string) => {
    // Prevent concurrent fetches for the same user
    if (fetchingRef.current === userId) return;
    fetchingRef.current = userId;

    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      const prof = profileRes.data ?? null;
      const fetchedRoles = rolesRes.data?.map((r) => r.role) ?? [];

      setProfile(prof);
      setRoles(fetchedRoles);
    } finally {
      fetchingRef.current = null;
    }
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
        setLoading(false);
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
  }, []);

  const setOfflineSession = useCallback((session: CachedSession) => {
    setUser({ id: session.userId, email: session.email } as User);
    setProfile(session.profile);
    setRoles(session.roles as AppRole[]);
    setIsOfflineSession(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    // CRITICAL: Set up onAuthStateChange FIRST, BEFORE getSession
    // The callback must NOT be async to avoid deadlocks (Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Skip INITIAL_SESSION — we handle that via getSession() below
        if (event === "INITIAL_SESSION") return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsOfflineSession(false);

        if (currentUser) {
          // Fire-and-forget — no await in this callback
          fetchUserData(currentUser.id);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    // Then restore session from storage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Guard against double init (StrictMode)
      if (initializedRef.current) return;
      initializedRef.current = true;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.id);
        setLoading(false);
      } else {
        const restored = await tryRestoreOffline();
        if (!restored) setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData, tryRestoreOffline]);

  // Listen for online event to re-sync if we were in offline mode
  useEffect(() => {
    const handler = () => {
      if (isOfflineSession) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user);
            setIsOfflineSession(false);
            fetchUserData(session.user.id);
          }
        });
      }
    };
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [isOfflineSession, fetchUserData]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback((r: AppRole[]) => r.some((role) => roles.includes(role)), [roles]);
  const isAdmin = roles.includes("admin");

  return (
    <AuthContext.Provider
      value={{ user, profile, roles, loading, hasRole, hasAnyRole, isAdmin, isOfflineSession, offlineLogout, setOfflineSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/** Helper to cache session after a successful online login */
export { cacheSession as cacheAuthSession };
