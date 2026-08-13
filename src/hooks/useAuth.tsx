import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "art" | "wd" | "equipment" | "viewer";
export type Department = "art" | "wd" | "equipment";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  viewerAccess: Department[];
  loading: boolean;
  canView: (dept: Department) => boolean;
  canEdit: (dept: Department) => boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [viewerAccess, setViewerAccess] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedForUid = useRef<string | null>(null);
  const signOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRoles = async (uid: string) => {
    if (loadedForUid.current === uid) return;
    loadedForUid.current = uid;
    try {
      const [{ data: roleData }, { data: accessData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("viewer_section_access").select("department").eq("user_id", uid),
      ]);
      setRoles((roleData?.map((r) => r.role as Role)) ?? []);
      setViewerAccess((accessData?.map((a) => a.department as Department)) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Safety: if getSession never resolves (Web Locks deadlock on some mobile browsers),
    // release the loading state after 6 seconds so the UI isn't stuck.
    const safetyTimer = setTimeout(() => setLoading(false), 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user) {
        // Cancel any pending sign-out debounce — session is alive again.
        if (signOutTimer.current) { clearTimeout(signOutTimer.current); signOutTimer.current = null; }
        setSession(s);
        setUser(s.user);
        setTimeout(() => loadRoles(s.user!.id), 0);
      } else {
        // Debounce the signed-out state: token refresh briefly fires SIGNED_OUT
        // before TOKEN_REFRESHED on Firefox iOS / some WebViews. Without debouncing,
        // the UI flashes between logged-in and logged-out dozens of times per second.
        setSession(null);
        signOutTimer.current = setTimeout(() => {
          signOutTimer.current = null;
          setUser(null);
          setRoles([]);
          setViewerAccess([]);
          loadedForUid.current = null;
        }, 2000);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      clearTimeout(safetyTimer);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadRoles(s.user.id);
      else setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      if (signOutTimer.current) clearTimeout(signOutTimer.current);
      subscription.unsubscribe();
    };
  }, []);

  const canView = (dept: Department): boolean =>
    roles.includes("admin") || roles.includes(dept) || viewerAccess.includes(dept);

  const canEdit = (dept: Department): boolean =>
    roles.includes("admin") || roles.includes(dept);

  const signOut = async () => {
    // Cancel any pending debounce and clear state immediately on explicit sign-out.
    if (signOutTimer.current) { clearTimeout(signOutTimer.current); signOutTimer.current = null; }
    loadedForUid.current = null;
    setUser(null);
    setRoles([]);
    setViewerAccess([]);
    setSession(null);
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, roles, viewerAccess, loading, canView, canEdit, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
};
