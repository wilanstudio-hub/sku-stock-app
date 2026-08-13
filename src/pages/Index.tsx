import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/hooks/useLang";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkuTable } from "@/components/SkuTable";
import { TransactionHistoryDialog } from "@/components/TransactionHistoryDialog";
import { LinkSheetDialog } from "@/components/LinkSheetDialog";
import { cn } from "@/lib/utils";
import {
  LogIn, LogOut, Package, Clapperboard, Shirt, Camera,
  ShieldCheck, ClipboardList, Plus,
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
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();
  const isAdmin = roles.includes("admin");

  const [txHistoryOpen,    setTxHistoryOpen]   = useState(false);
  const [linkSheetOpen,    setLinkSheetOpen]    = useState(false);
  const [registeredSheets, setRegisteredSheets] = useState<RegisteredSheet[]>([]);

  // Primary department tab
  const [activeDept, setActiveDept] = useState<Department | "">("");

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadRegisteredSheets = async () => {
    const { data } = await supabase
      .from("google_sheets_registry")
      .select("id, name, sheet_id, sku_prefix")
      .eq("department", "equipment")
      .eq("is_active", true)
      .order("sku_prefix");
    setRegisteredSheets((data ?? []) as RegisteredSheet[]);
  };

  useEffect(() => {
    if (!user) { setRegisteredSheets([]); return; }
    loadRegisteredSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Primary-tab initialisation ────────────────────────────────────────────

  const visibleDepts = (["art", "wd", "equipment"] as Department[]).filter(canView);

  useEffect(() => {
    if (visibleDepts.length > 0 && !visibleDepts.includes(activeDept as Department)) {
      setActiveDept(visibleDepts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDepts.join(",")]);

  // ── Derived values ────────────────────────────────────────────────────────

  const deptLabel: Record<Department, string> = {
    art: t.tabArt,
    wd:  t.tabWd,
    equipment: t.tabEquipment,
  };

  // Main equipment sheet — accept "" or legacy "B-" as the warehouse prefix.
  const mainSheet = registeredSheets
    .filter((s) => s.sku_prefix === "" || s.sku_prefix === "B-")
    .sort((a, b) => a.sku_prefix.length - b.sku_prefix.length)[0];

  // Admin-only button to register a new Google Sheet into the Equipment ecosystem.
  // Rendered between the stats cards and the toolbar row via the subNav slot.
  const equipAdminAction = isAdmin ? (
    <div className="flex justify-end pb-1">
      <button
        onClick={() => setLinkSheetOpen(true)}
        title="เพิ่ม Google Sheet ใหม่เป็นแท็บ"
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium",
          "border border-dashed transition-colors",
          "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-accent",
        )}
      >
        <Plus className="w-3 h-3" />
        เพิ่มคลัง
      </button>
    </div>
  ) : undefined;

  // ── Early return: loading ─────────────────────────────────────────────────

  if (loading) {
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
              <h1 className="font-bold leading-tight">SKU Stock</h1>
              <p className="text-xs text-muted-foreground font-th">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setLang(lang === "th" ? "en" : "th")}
              className="text-xs font-mono px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
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
        {user && visibleDepts.length > 0 && (
          <div className="flex border-t overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {visibleDepts.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={cn(
                  "flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium",
                  "whitespace-nowrap shrink-0 border-b-2 -mb-px transition-colors",
                  activeDept === dept
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                {DEPT_ICONS[dept]}
                {deptLabel[dept]}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 py-6">

        {/* Not signed in */}
        {!user && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Package className="w-12 h-12 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">{t.pleaseSignIn}</p>
            <Button onClick={() => nav("/auth")} className="gap-2">
              <LogIn className="w-4 h-4" /> {t.signIn}
            </Button>
          </div>
        )}

        {/* Signed in but no accessible sections */}
        {user && visibleDepts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground opacity-30" />
            <p className="font-medium">{t.noSections}</p>
            <p className="text-sm text-muted-foreground">{t.contactAdmin}</p>
          </div>
        )}

        {/* Art — keep mounted while tab is active; pause loading when user is
            temporarily null so we avoid the unmount→remount flash that wipes
            in-progress fetches and resets the loading spinner on every auth
            state cycle (token refresh briefly fires SIGNED_OUT on mobile). */}
        {activeDept === "art" && (
          <SkuTable key="art" department="art" enabled={!!user} />
        )}

        {/* WD */}
        {activeDept === "wd" && (
          <SkuTable key="wd" department="wd" enabled={!!user} />
        )}

        {/* Equipment */}
        {activeDept === "equipment" && (
          <SkuTable
            key="equipment"
            department="equipment"
            sheetId={mainSheet?.sheet_id}
            subNav={equipAdminAction}
            enabled={!!user}
          />
        )}
      </main>

      <TransactionHistoryDialog open={txHistoryOpen} onOpenChange={setTxHistoryOpen} />

      {isAdmin && (
        <LinkSheetDialog
          open={linkSheetOpen}
          onOpenChange={setLinkSheetOpen}
          onLinked={() => { loadRegisteredSheets(); }}
        />
      )}
    </div>
  );
};

export default Index;
