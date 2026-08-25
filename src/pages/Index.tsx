import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useLang } from "@/hooks/useLang";
import { useFontSize } from "@/hooks/useFontSize";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkuTable } from "@/components/SkuTable";
import { TransactionHistoryDialog } from "@/components/TransactionHistoryDialog";
import { ManageDepartmentsDialog } from "@/components/ManageDepartmentsDialog";
import { ManageSheetsDialog } from "@/components/ManageSheetsDialog";
import { Landing } from "@/components/Landing";
import { cn } from "@/lib/utils";
import {
  LogIn, LogOut, Package, Clapperboard, Shirt, Camera,
  ShieldCheck, ClipboardList, Plus, Edit2
} from "lucide-react";
import type { Department } from "@/hooks/useAuth";

interface RegisteredSheet {
  id: string;
  name: string;
  sheet_id: string;
  sku_prefix: string;
}

const DEPT_ICONS: Record<Department, React.ReactNode> = {
  art:       <Clapperboard className="w-4 h-4 shrink-0" />,
  wd:        <Shirt        className="w-4 h-4 shrink-0" />,
  equipment: <Camera       className="w-4 h-4 shrink-0" />,
};

const Index = () => {
  const { user, loading, roles, canView, signOut } = useAuth();
  const { tenant } = useTenant();
  const { lang, setLang, t } = useLang();
  const { fontSize, setFontSize } = useFontSize();
  const nav = useNavigate();
  const isAdmin = roles.includes("admin");

  const [txHistoryOpen, setTxHistoryOpen] = useState(false);
  
  // Dynamic Departments State
  const [departments, setDepartments] = useState<any[]>([]);
  const [activeDept, setActiveDept] = useState<string>("");
  const [manageDeptsOpen, setManageDeptsOpen] = useState(false);
  const [manageSheetsOpen, setManageSheetsOpen] = useState(false);
  const [registeredSheets, setRegisteredSheets] = useState<RegisteredSheet[]>([]);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadDepartments = async () => {
    const { data } = await supabase.from("departments").select("*").order("order_index");
    setDepartments(data ?? []);
  };

  const loadRegisteredSheets = async (deptCode: string) => {
    const { data } = await supabase
      .from("google_sheets_registry")
      .select("id, name, sheet_id, sku_prefix")
      .eq("department", deptCode)
      .eq("is_active", true)
      .order("sku_prefix");
    setRegisteredSheets((data ?? []) as RegisteredSheet[]);
  };

  useEffect(() => {
    if (user) loadDepartments();
  }, [user]);

  useEffect(() => {
    if (activeDept) loadRegisteredSheets(activeDept);
  }, [activeDept]);

  // ── Primary-tab initialisation ────────────────────────────────────────────

  // Filter departments based on user roles
  const visibleDepts = departments.filter(d => canView(d.code as any));

  useEffect(() => {
    if (visibleDepts.length > 0 && !visibleDepts.find(d => d.code === activeDept)) {
      setActiveDept(visibleDepts[0].code);
    }
  }, [departments, roles]); // re-run when departments or roles change

  // ── Derived values ────────────────────────────────────────────────────────

  const activeDeptObj = departments.find(d => d.code === activeDept);

  const renderIcon = (iconName: string) => {
    const props = { className: "w-4 h-4 shrink-0" };
    switch (iconName) {
      case "clapperboard": return <Clapperboard {...props} />;
      case "shirt": return <Shirt {...props} />;
      case "camera": return <Camera {...props} />;
      case "package": return <Package {...props} />;
      default: return <Package {...props} />;
    }
  };

  // Main equipment sheet — accept "" or legacy "B-" as the warehouse prefix.
  const mainSheet = registeredSheets
    .filter((s) => s.sku_prefix === "" || s.sku_prefix === "B-")
    .sort((a, b) => a.sku_prefix.length - b.sku_prefix.length)[0];

  // Admin-only button to manage sheets for the current department.
  const deptAdminAction = isAdmin && activeDept ? (
    <div className="flex justify-end pb-1">
      <button
        onClick={() => setManageSheetsOpen(true)}
        title={`จัดการคลัง Google Sheets (${activeDeptObj?.name_th})`}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium",
          "border border-dashed transition-colors",
          "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-accent",
        )}
      >
        <Plus className="w-3 h-3" />
        จัดการคลัง
      </button>
    </div>
  ) : undefined;

  // ── Early return: loading ─────────────────────────────────────────────────

  if (loading || (user && departments.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {t.loading}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">

        {/* App bar: logo + user controls */}
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold leading-tight">{tenant?.name || "FilmFlow-Inventory"}</h1>
                {tenant && (
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
                    {tenant.slug}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-th">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center border border-border rounded overflow-hidden">
              <button
                onClick={() => setFontSize("normal")}
                title="ขนาดปกติ"
                className={cn(
                  "flex items-center justify-center px-2.5 h-7 text-xs font-semibold transition-colors",
                  fontSize === "normal" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
                )}
              >
                A
              </button>
              <button
                onClick={() => setFontSize("large")}
                title="ขนาดใหญ่"
                className={cn(
                  "flex items-center justify-center px-2.5 h-7 text-sm font-semibold border-l border-border transition-colors",
                  fontSize === "large" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
                )}
              >
                A+
              </button>
              <button
                onClick={() => setFontSize("xlarge")}
                title="ขนาดใหญ่พิเศษ"
                className={cn(
                  "flex items-center justify-center px-2.5 h-7 text-base font-semibold border-l border-border transition-colors",
                  fontSize === "xlarge" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
                )}
              >
                A++
              </button>
            </div>
            <button
              onClick={() => setLang(lang === "th" ? "en" : "th")}
              className="text-xs font-mono px-2 h-7 rounded border border-border hover:bg-accent transition-colors"
            >
              {lang === "th" ? "EN" : "TH"}
            </button>

            {user ? (
              <>
                <div className="hidden sm:flex gap-1">
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary" className="uppercase text-[10px]">
                      {r}
                    </Badge>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground hidden md:inline">
                  {user.email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTxHistoryOpen(true)}
                  title="ประวัติการเบิก-คืน"
                  className="gap-1.5"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden sm:inline font-th text-xs">History / Log</span>
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => nav("/admin")}
                    title={t.adminPanel}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={signOut} title={t.signOut}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button variant="default" size="sm" onClick={() => nav("/auth")} className="gap-2">
                <LogIn className="w-4 h-4" /> {t.signIn}
              </Button>
            )}
          </div>
        </div>

        {/* Primary department tab strip */}
        {user && (
          <div className="flex border-t overflow-x-auto items-center pr-2" style={{ scrollbarWidth: "none" }}>
            {visibleDepts.map((dept) => (
              <button
                key={dept.code}
                onClick={() => setActiveDept(dept.code)}
                className={cn(
                  "flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium",
                  "whitespace-nowrap shrink-0 border-b-2 -mb-px transition-colors",
                  activeDept === dept.code
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                {renderIcon(dept.icon)}
                {dept.name_th}
              </button>
            ))}
            
            {isAdmin && (
              <button
                onClick={() => setManageDeptsOpen(true)}
                title="จัดการแท็บหลัก (หมวดหมู่)"
                className="ml-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-accent transition-colors border border-transparent hover:border-border"
              >
                <Edit2 className="w-3.5 h-3.5" />
                จัดการแท็บหลัก
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 py-6">

        {/* Not signed in: Show Landing Page */}
        {!user && <Landing />}

        {/* Signed in but no accessible sections */}
        {user && visibleDepts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground opacity-30" />
            <p className="font-medium">{t.noSections}</p>
            <p className="text-sm text-muted-foreground">{t.contactAdmin}</p>
          </div>
        )}

        {/* Render active department dynamically */}
        {user && activeDeptObj && (
          <SkuTable
            key={activeDeptObj.code}
            department={activeDeptObj.code as any}
            sheetId={mainSheet?.sheet_id}
            subNav={deptAdminAction}
            enabled={!!user}
            syncFormat={activeDeptObj.sync_format}
          />
        )}

      </main>

      <TransactionHistoryDialog open={txHistoryOpen} onOpenChange={setTxHistoryOpen} />

      {isAdmin && (
        <>
          <ManageDepartmentsDialog
            open={manageDeptsOpen}
            onOpenChange={setManageDeptsOpen}
            onUpdated={loadDepartments}
          />
          {activeDeptObj && (
            <ManageSheetsDialog
              open={manageSheetsOpen}
              onOpenChange={setManageSheetsOpen}
              departmentCode={activeDeptObj.code}
              departmentName={activeDeptObj.name_th}
              onUpdated={() => loadRegisteredSheets(activeDeptObj.code)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Index;
