import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/hooks/useLang";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ShieldCheck, X, Clapperboard, Shirt, Camera } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "art" | "wd" | "equipment" | "viewer";
type Dept = "art" | "wd" | "equipment";

const EDIT_ROLES: AppRole[] = ["admin", "art", "wd", "equipment", "viewer"];
const DEPTS: { key: Dept; label: string; icon: React.ReactNode }[] = [
  { key: "art", label: "Art", icon: <Clapperboard className="w-3.5 h-3.5" /> },
  { key: "wd", label: "WD", icon: <Shirt className="w-3.5 h-3.5" /> },
  { key: "equipment", label: "Equipment", icon: <Camera className="w-3.5 h-3.5" /> },
];

type Profile = { user_id: string; display_name: string | null; email?: string };
type RoleRow = { id: string; user_id: string; role: AppRole };
type AccessRow = { id: string; user_id: string; department: Dept };

const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  art: "bg-purple-100 text-purple-700 border-purple-200",
  wd: "bg-blue-100 text-blue-700 border-blue-200",
  equipment: "bg-amber-100 text-amber-700 border-amber-200",
  viewer: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function AdminPage() {
  const { roles, loading: authLoading } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<RoleRow[]>([]);
  const [sectionAccess, setSectionAccess] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !roles.includes("admin")) nav("/", { replace: true });
  }, [authLoading, roles, nav]);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: a }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name"),
      supabase.from("user_roles").select("id, user_id, role"),
      supabase.from("viewer_section_access").select("id, user_id, department"),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setUserRoles((r ?? []) as RoleRow[]);
    setSectionAccess((a ?? []) as AccessRow[]);
    setLoading(false);
  };

  useEffect(() => { if (roles.includes("admin")) load(); }, [roles]);

  const rolesOf = (uid: string) => userRoles.filter((r) => r.user_id === uid);
  const accessOf = (uid: string) => sectionAccess.filter((a) => a.user_id === uid);
  const isViewer = (uid: string) => {
    const r = rolesOf(uid).map((x) => x.role);
    return r.includes("viewer") && !r.includes("admin") && !r.includes("art") && !r.includes("wd") && !r.includes("equipment");
  };

  const addRole = async (uid: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) toast.error(error.message);
    else { toast.success(t.roleAdded(role)); load(); }
  };

  const removeRole = async (id: string, role: AppRole, uid: string) => {
    if (role === "viewer" && rolesOf(uid).length === 1) {
      toast.error(t.cannotRemoveLastRole);
      return;
    }
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t.roleRemoved); load(); }
  };

  const toggleSectionAccess = async (uid: string, dept: Dept, hasAccess: boolean) => {
    if (hasAccess) {
      const row = sectionAccess.find((a) => a.user_id === uid && a.department === dept);
      if (!row) return;
      const { error } = await supabase.from("viewer_section_access").delete().eq("id", row.id);
      if (error) toast.error(error.message);
      else { toast.success(t.revokedAccess(dept)); load(); }
    } else {
      const { error } = await supabase.from("viewer_section_access").insert({ user_id: uid, department: dept });
      if (error) toast.error(error.message);
      else { toast.success(t.grantedAccess(dept)); load(); }
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav("/")} title={t.back}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="font-bold">{t.adminTitle}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Legend */}
        <Card className="mb-6">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-medium mb-1.5">{t.legendRoles}</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div><Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] mr-1">admin</Badge>{t.roleDescAdmin}</div>
                  <div><Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] mr-1">art</Badge>{t.roleDescArt}</div>
                  <div><Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] mr-1">wd</Badge>{t.roleDescWd}</div>
                  <div><Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] mr-1">equipment</Badge>{t.roleDescEquipment}</div>
                  <div><Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px] mr-1">viewer</Badge>{t.roleDescViewer}</div>
                </div>
              </div>
              <div>
                <p className="font-medium mb-1.5">{t.legendViewAccess}</p>
                <p className="text-xs text-muted-foreground">
                  {t.legendViewDesc}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.usersTitle(profiles.length)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profiles.length === 0 && (
              <p className="text-sm text-muted-foreground">{t.noUsers}</p>
            )}
            {profiles.map((p, i) => {
              const ur = rolesOf(p.user_id);
              const acc = accessOf(p.user_id);
              const missing = EDIT_ROLES.filter((r) => !ur.some((x) => x.role === r));
              const viewer = isViewer(p.user_id);

              return (
                <div key={p.user_id}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="space-y-3">
                    {/* User info */}
                    <div>
                      <p className="font-medium text-sm">{p.display_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.user_id.slice(0, 8)}…</p>
                    </div>

                    {/* Current roles */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">{t.rolesSection}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ur.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">{t.noRoles}</span>
                        )}
                        {ur.map((r) => (
                          <Badge
                            key={r.id}
                            variant="outline"
                            className={`gap-1 text-[11px] uppercase ${ROLE_COLOR[r.role]}`}
                          >
                            {r.role}
                            <button
                              onClick={() => removeRole(r.id, r.role, p.user_id)}
                              className="hover:opacity-60 ml-0.5"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </Badge>
                        ))}
                        {/* Add role buttons */}
                        {missing.map((r) => (
                          <button
                            key={r}
                            onClick={() => addRole(p.user_id, r)}
                            className={`text-[11px] px-2 py-0.5 rounded-full border border-dashed uppercase opacity-40 hover:opacity-100 transition-opacity ${ROLE_COLOR[r]}`}
                          >
                            + {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section access — only shown for pure viewers */}
                    {viewer && (
                      <div className="pl-3 border-l-2 border-muted">
                        <p className="text-xs text-muted-foreground mb-2">
                          {t.viewAccessSection}
                        </p>
                        <div className="flex flex-wrap gap-4">
                          {DEPTS.map(({ key, label, icon }) => {
                            const hasAccess = acc.some((a) => a.department === key);
                            return (
                              <label
                                key={key}
                                className="flex items-center gap-2 cursor-pointer select-none"
                              >
                                <Checkbox
                                  checked={hasAccess}
                                  onCheckedChange={() => toggleSectionAccess(p.user_id, key, hasAccess)}
                                />
                                <span className="flex items-center gap-1 text-sm">
                                  {icon} {label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {acc.length === 0 && (
                          <p className="text-xs text-destructive mt-1.5">
                            {t.noAccessWarning}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
