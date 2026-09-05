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
import { ArrowLeft, ShieldCheck, X, Clapperboard, Shirt, Camera, RefreshCw, Link as LinkIcon, Building2, CheckCircle2, AlertCircle, ExternalLink, CreditCard, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CtrlPlusLogo } from "@/components/CtrlPlusLogo";
import { BillingPlansDialog } from "@/components/BillingPlansDialog";
import { useTenant } from "@/contexts/TenantContext";
import type { Company } from "@/contexts/TenantContext";

type AppRole = "admin" | "art" | "wd" | "equipment" | "viewer";
type Dept = "art" | "wd" | "equipment";

const EDIT_ROLES: AppRole[] = ["admin", "art", "wd", "equipment", "viewer"];
const DEPTS: { key: Dept; label: string; icon: React.ReactNode }[] = [
  { key: "art", label: "Art", icon: <Clapperboard className="w-3.5 h-3.5" /> },
  { key: "wd", label: "WD", icon: <Shirt className="w-3.5 h-3.5" /> },
  { key: "equipment", label: "Equipment", icon: <Camera className="w-3.5 h-3.5" /> },
];

type Profile = { user_id: string; display_name: string | null; company_id?: string | null; email?: string };
type RoleRow = { id: string; user_id: string; role: AppRole; company_id?: string | null };
type AccessRow = { id: string; user_id: string; department: Dept };

const ROLE_COLOR: Record<AppRole, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  art: "bg-purple-100 text-purple-700 border-purple-200",
  wd: "bg-blue-100 text-blue-700 border-blue-200",
  equipment: "bg-amber-100 text-amber-700 border-amber-200",
  viewer: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function AdminPage() {
  const { roles, companyId, loading: authLoading } = useAuth();
  const { tenant, refreshTenant } = useTenant();
  const { t } = useLang();
  const nav = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<RoleRow[]>([]);
  const [sectionAccess, setSectionAccess] = useState<AccessRow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingOpen, setBillingOpen] = useState(false);
  
  // Google Sheets Sync state
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!authLoading && !roles.includes("admin")) nav("/", { replace: true });
  }, [authLoading, roles, nav]);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: a }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, company_id"),
      supabase.from("user_roles").select("id, user_id, role, company_id"),
      supabase.from("viewer_section_access").select("id, user_id, department"),
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setUserRoles((r ?? []) as RoleRow[]);
    setSectionAccess((a ?? []) as AccessRow[]);
    setCompanies((c ?? []) as Company[]);
    setLoading(false);
  };

  useEffect(() => { if (roles.includes("admin")) load(); }, [roles]);

  const billingCompany = tenant ?? companies.find((company) => company.id === companyId) ?? null;
  const billingCompanySeatCount = new Set(
    userRoles
      .filter((role) => !billingCompany || role.company_id === billingCompany.id)
      .map((role) => role.user_id),
  ).size;

  const rolesOf = (uid: string) => userRoles.filter((r) => r.user_id === uid);
  const accessOf = (uid: string) => sectionAccess.filter((a) => a.user_id === uid);
  const isViewer = (uid: string) => {
    const r = rolesOf(uid).map((x) => x.role);
    return r.includes("viewer") && !r.includes("admin") && !r.includes("art") && !r.includes("wd") && !r.includes("equipment");
  };

  const addRole = async (uid: string, role: AppRole) => {
    // Check seat limit when user currently has no roles in this studio
    const userRoleList = rolesOf(uid).filter((roleRow) => !billingCompany || roleRow.company_id === billingCompany.id);
    const seatLimit = billingCompany?.seat_limit || 3;
    if (userRoleList.length === 0 && billingCompanySeatCount >= seatLimit) {
      toast.error(`สตูดิโอของคุณใช้โควต้าที่นั่งครบตามแผนแล้ว (${seatLimit} ที่นั่ง) กรุณาอัปเกรดแผนเพื่อเพิ่มสมาชิก`);
      setBillingOpen(true);
      return;
    }

    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role, company_id: billingCompany?.id || null });
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

  const extractSheetId = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleSyncSheet = async () => {
    if (!sheetUrl) return toast.error("กรุณาวางลิงก์ Google Sheets");
    
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) return toast.error("ลิงก์ไม่ถูกต้อง กรุณาตรวจสอบลิงก์ Google Sheets อีกครั้ง");

    setSyncing(true);
    const toastId = toast.loading("กำลังเตรียมการ Sync ข้อมูล...");

    try {
      // 1. Register the sheet if not already registered
      const { data: existingSheet } = await supabase.from("google_sheets_registry")
        .select("id")
        .eq("sheet_id", sheetId)
        .eq("department", "equipment")
        .maybeSingle();

      if (!existingSheet) {
        const { error: regError } = await supabase.from("google_sheets_registry").insert({
          sheet_id: sheetId,
          department: "equipment",
          is_active: true,
          sku_prefix: "",
          name: "Synced from Admin"
        });
        if (regError) throw new Error("ไม่สามารถลงทะเบียน Sheet ได้: " + regError.message);
      }

      toast.loading("กำลังดึงและอัปเดตข้อมูล... (อาจใช้เวลาสักครู่)", { id: toastId });

      // 2. Trigger the edge function
      const { data, error } = await supabase.functions.invoke("sync-equipment-sheet", {
        body: { sheetId }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`Sync สำเร็จ! เพิ่ม ${data.inserted} รายการ, อัปเดต ${data.updated} รายการ`, { id: toastId });
      setSheetUrl("");
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการ Sync", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const updateCompanyStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("companies").update({ status }).eq("id", id);
    if (error) {
      toast.error("ไม่สามารถอัปเดตสถานะได้: " + error.message);
    } else {
      toast.success(`อัปเดตสถานะเป็น ${status} สำเร็จ`);
      load();
    }
  };

  const deleteCompany = async (id: string, name: string) => {
    if (!window.confirm(`ต้องการลบสตูดิโอ "${name}" ออกจากระบบหรือไม่?`)) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) {
      toast.error("ไม่สามารถลบสตูดิโอได้: " + error.message);
    } else {
      toast.success("ลบสตูดิโอแล้ว");
      load();
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => nav("/")} title={t.back}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <CtrlPlusLogo theme="auto" variant="icon" className="h-6 w-6" />
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h1 className="font-bold">{t.adminTitle}</h1>
            </div>
          </div>
          <CtrlPlusLogo theme="auto" variant="full" className="h-6 w-auto hidden sm:block opacity-75" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Subscription Plan & Seat Limits Card */}
        <Card className="border-primary/20 bg-linear-to-r from-primary/5 via-background to-orange-500/5">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  แผนการใช้งานสตูดิโอ ({billingCompany?.name || "สตูดิโอของคุณ"})
                </span>
                <Badge variant="default" className="text-[10px] uppercase font-bold bg-primary text-primary-foreground">
                  {billingCompany?.billing_plan ? billingCompany.billing_plan.toUpperCase() : "FREE"} PLAN
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-mono ${
                    billingCompany?.billing_status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {billingCompany?.billing_status || "active"}
                </Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  ที่นั่งที่ใช้: {billingCompanySeatCount} / {billingCompany?.seat_limit || 3} ที่นั่ง
                </span>
                <span>•</span>
                <span>
                  หมดอายุ: {billingCompany?.billing_expires_at ? new Date(billingCompany.billing_expires_at).toLocaleDateString("th-TH") : "ไม่ระบุ (Free Cycle)"}
                </span>
              </div>

              <div className="w-full max-w-md pt-1.5">
                <Progress value={Math.min(100, (billingCompanySeatCount / (billingCompany?.seat_limit || 3)) * 100)} className="h-2" />
              </div>
            </div>

            <Button
              onClick={() => setBillingOpen(true)}
              className="gap-2 shrink-0 bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-sm"
            >
              <Sparkles className="w-4 h-4" /> จัดการแผน / ขยายที่นั่ง
            </Button>
          </CardContent>
        </Card>

        {/* Multi-Tenant SaaS Studios Management */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                สตูดิโอในระบบ SaaS Multi-Tenant ({companies.length})
              </CardTitle>
              <Badge variant="outline" className="text-xs font-mono">
                Subdomain Architecture
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {companies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีสตูดิโอลงทะเบียนในระบบ</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {companies.map((c) => (
                  <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{c.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-mono ${
                            c.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : c.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                          slug: {c.slug}
                        </span>
                        <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase text-[10px] font-semibold">
                          plan: {c.billing_plan || "free"} ({c.seat_limit || 3} seats)
                        </span>
                        {c.contact_email && <span>อีเมล: {c.contact_email}</span>}
                        {c.contact_name && <span>ผู้ติดต่อ: {c.contact_name}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href={`/?tenant=${c.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 rounded border hover:bg-muted"
                      >
                        <ExternalLink className="w-3 h-3" /> เปิด Workspace
                      </a>
                      {c.status === "pending" && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateCompanyStatus(c.id, "active")}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> อนุมัติ
                        </Button>
                      )}
                      {c.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-amber-600 hover:bg-amber-50"
                          onClick={() => updateCompanyStatus(c.id, "suspended")}
                        >
                          ระงับ
                        </Button>
                      )}
                      {c.status === "suspended" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-emerald-600 hover:bg-emerald-50"
                          onClick={() => updateCompanyStatus(c.id, "active")}
                        >
                          เปิดใช้งาน
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteCompany(c.id, c.name)}
                        title="ลบสตูดิโอ"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Google Sheets Sync */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              ซิงก์ข้อมูลจาก Google Sheets (Equipment)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              วางลิงก์ Google Sheets ที่คุณต้องการซิงก์ข้อมูลสต๊อก (อย่าลืมแชร์สิทธิ์ Viewer ให้กับอีเมลบอท: <code className="bg-muted px-1.5 py-0.5 rounded text-xs select-all">filmflow-sheet-sync-bot@filmflow-inventory-sync.iam.gserviceaccount.com</code> ก่อนกด Sync)
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/1234567890/edit"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="pl-9"
                  disabled={syncing}
                />
              </div>
              <Button onClick={handleSyncSheet} disabled={syncing}>
                {syncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    กำลังซิงก์...
                  </>
                ) : (
                  "Sync ข้อมูล"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

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

      <BillingPlansDialog
        open={billingOpen}
        onOpenChange={setBillingOpen}
        company={billingCompany}
        onPlanUpdated={() => {
          load();
          refreshTenant();
        }}
      />
    </div>
  );
}
