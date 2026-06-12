import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "art" | "wd" | "equipment" | "viewer";
const ALL_ROLES: AppRole[] = ["admin", "art", "wd", "equipment", "viewer"];

type Profile = { user_id: string; display_name: string | null; department: string | null };
type RoleRow = { id: string; user_id: string; role: AppRole };

export const AdminPanel = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, department"),
      supabase.from("user_roles").select("id, user_id, role"),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setRoles((r ?? []) as RoleRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const userRoles = (uid: string) => roles.filter((r) => r.user_id === uid);

  const addRole = async (uid: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) toast.error(error.message);
    else { toast.success(`เพิ่ม ${role} แล้ว / Added ${role}`); load(); }
  };

  const removeRole = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("ลบแล้ว / Removed"); load(); }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="w-5 h-5 text-primary" />
          จัดการผู้ใช้ / Admin — User Roles
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีผู้ใช้ / No users yet.</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => {
              const ur = userRoles(p.user_id);
              const missing = ALL_ROLES.filter((r) => !ur.some((x) => x.role === r));
              return (
                <div key={p.user_id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
                  <div className="min-w-[160px]">
                    <p className="font-medium text-sm">{p.display_name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[240px]">{p.user_id}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {ur.length === 0 && <span className="text-xs text-muted-foreground">ไม่มี role / No roles</span>}
                    {ur.map((r) => (
                      <Badge key={r.id} variant="secondary" className="gap-1 uppercase text-[10px]">
                        {r.role}
                        <button onClick={() => removeRole(r.id)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {missing.map((r) => (
                      <Button key={r} size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                        onClick={() => addRole(p.user_id, r)}>
                        <UserPlus className="w-3 h-3" /> {r}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
