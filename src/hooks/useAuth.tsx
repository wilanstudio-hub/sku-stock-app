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

  const loadRoles = async (uid: string) => {
    if (loadedForUid.current === uid) return;
    loadedForUid.current = uid;
    const [{ data: roleData }, { data: accessData }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("viewer_section_access").select("department").eq("user_id", uid),
    ]);
    setRoles((roleData?.map((r) => r.role as Role)) ?? []);
    setViewerAccess((accessData?.map((a) => a.department as Department)) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => loadRoles(s.user.id), 0);
      else { setRoles([]); setViewerAccess([]); }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadRoles(s.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const canView = (dept: Department): boolean =>
    roles.includes("admin") || roles.includes(dept) || viewerAccess.includes(dept);

  const canEdit = (dept: Department): boolean =>
    roles.includes("admin") || roles.includes(dept);

  const signOut = async () => {
    loadedForUid.current = null;
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
