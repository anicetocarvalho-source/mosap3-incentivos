import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
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
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  // Cache session data after successful fetch
  const cacheCurrentSession = useCallback(
    (email: string, password: string, userId: string, prof: AuthState["profile"], r: AppRole[]) => {
      cacheSession(email, password, userId, prof, r).catch(() => {});
    },
    [],
  );

  const fetchUserData = useCallback(async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const prof = profileRes.data ?? null;
    const fetchedRoles = rolesRes.data?.map((r) => r.role) ?? [];

    setProfile(prof);
    setRoles(fetchedRoles);

    return { profile: prof, roles: fetchedRoles };
  }, []);

  // Restore offline session if no online session
  const tryRestoreOffline = useCallback(async () => {
    if (!navigator.onLine) {
      const cached = await getLastSession();
      if (cached) {
        // Create a minimal "fake" user for offline
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsOfflineSession(false);

        if (currentUser) {
          setTimeout(() => fetchUserData(currentUser.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserData(currentUser.id);
        setLoading(false);
      } else {
        // No online session — try offline restore
        const restored = await tryRestoreOffline();
        if (!restored) setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData, tryRestoreOffline]);

  // Listen for online event to re-sync if we were in offline mode
  useEffect(() => {
    const handler = async () => {
      if (isOfflineSession) {
        // Try to get a real session now that we're online
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setIsOfflineSession(false);
          fetchUserData(session.user.id);
        }
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
      value={{ user, profile, roles, loading, hasRole, hasAnyRole, isAdmin, isOfflineSession, offlineLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/** Helper to cache session after a successful online login */
export { cacheSession as cacheAuthSession };
