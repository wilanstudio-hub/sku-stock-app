import { useEffect, useMemo, useRef, useState } from "react";
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

interface TabDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  dept: Department;
  lockedCategory?: string;
}

const EQ_TAB_PREFIX = "eq:";

const DEPT_ICONS: Record<Department, React.ReactNode> = {
  art:       <Clapperboard className="w-3.5 h-3.5 shrink-0" />,
  wd:        <Shirt        className="w-3.5 h-3.5 shrink-0" />,
  equipment: <Camera       className="w-3.5 h-3.5 shrink-0" />,
};

const Index = () => {
  const { user, loading, roles, canView, signOut } = useAuth();
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();
  const isAdmin = roles.includes("admin");
  const tabStripRef = useRef<HTMLDivElement>(null);

  const [txHistoryOpen, setTxHistoryOpen]   = useState(false);
  const [linkSheetOpen, setLinkSheetOpen]   = useState(false);
  const [registeredSheets, setRegisteredSheets] = useState<RegisteredSheet[]>([]);
  const [equipCategories, setEquipCategories]   = useState<string[]>([]);
  const [activeTabId, setActiveTabId]           = useState<string>("");

  // ── Data loaders ─────────────────────────────────────────────────────────

  const loadRegisteredSheets = async () => {
    const { data } = await supabase
      .from("google_sheets_registry")
      .select("id, name, sheet_id, sku_prefix")
      .eq("department", "equipment")
      .eq("is_active", true)
      .order("sku_prefix");
    setRegisteredSheets((data ?? []) as RegisteredSheet[]);
  };

  const loadEquipCategories = async () => {
    const { data } = await supabase
      .from("skus")
      .select("category")
      .eq("department", "equipment")
      .not("category", "is", null);
    if (data) {
      const cats = Array.from(
        new Set(data.map((r) => r.category).filter(Boolean) as string[]),
      ).sort();
      setEquipCategories(cats);
    }
  };

  useEffect(() => {
    if (!user) {
      setRegisteredSheets([]);
      setEquipCategories([]);
      return;
    }
    loadRegisteredSheets();
    if (canView("equipment")) loadEquipCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Tab list ─────────────────────────────────────────────────────────────

  const deptLabel: Record<Department, string> = {
    art: t.tabArt,
    wd:  t.tabWd,
    equipment: t.tabEquipment,
  };

  const allTabs = useMemo<TabDef[]>(() => {
    const tabs: TabDef[] = [];

    // Non-equipment departments first
    for (const d of ["art", "wd"] as Department[]) {
      if (canView(d)) {
        tabs.push({ id: d, label: deptLabel[d], icon: DEPT_ICONS[d], dept: d });
      }
    }

    // One tab per equipment category — mirrors Google Sheet bottom tabs
    if (canView("equipment")) {
      for (const cat of equipCategories) {
        tabs.push({
          id: `${EQ_TAB_PREFIX}${cat}`,
          label: cat,
          icon: DEPT_ICONS.equipment,
          dept: "equipment",
          lockedCategory: cat,
        });
      }
    }

    return tabs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipCategories.join("|"), canView("art"), canView("wd"), canView("equipment")]);

  // Set the default active tab once tabs are available; never override a
  // user-initiated selection.
  const tabIdsKey = allTabs.map((tb) => tb.id).join("|");
  useEffect(() => {
    if (allTabs.length > 0 && !allTabs.find((tb) => tb.id === activeTabId)) {
      setActiveTabId(allTabs[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIdsKey]);

  // Scroll the active tab into view when it changes
  useEffect(() => {
    if (!tabStripRef.current) return;
    const el = tabStripRef.current.querySelector<HTMLElement>(`[data-tab="${activeTabId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const activeTab = allTabs.find((tb) => tb.id === activeTabId);
  const mainSheet = registeredSheets.find((s) => s.sku_prefix === "");

  // ── Early returns ─────────────────────────────────────────────────────────

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

      {/* ── Top header bar ─────────────────────────────────────────────── */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
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

        {/* ── Flat tab strip — mirrors Google Sheet bottom tabs ─────────── */}
        {user && allTabs.length > 0 && (
          <div
            ref={tabStripRef}
            className="flex overflow-x-auto border-t scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap",
                  "border-b-2 -mb-px font-medium transition-colors shrink-0 font-th",
                  activeTabId === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}

            {/* Admin-only: register a new Google Sheet as additional tabs */}
            {isAdmin && canView("equipment") && (
              <button
                onClick={() => setLinkSheetOpen(true)}
                title="เพิ่ม Google Sheet ใหม่เป็นแท็บ"
                className={cn(
                  "flex items-center gap-1 px-3 py-2.5 text-sm shrink-0",
                  "border-b-2 border-transparent border-dashed",
                  "text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors",
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เพิ่มแท็บ</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 py-6">

        {!user && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Package className="w-12 h-12 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">{t.pleaseSignIn}</p>
            <Button onClick={() => nav("/auth")} className="gap-2">
              <LogIn className="w-4 h-4" /> {t.signIn}
            </Button>
          </div>
        )}

        {user && allTabs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground opacity-30" />
            <p className="font-medium">{t.noSections}</p>
            <p className="text-sm text-muted-foreground">{t.contactAdmin}</p>
          </div>
        )}

        {/* Art / WD: one stable SkuTable instance per department */}
        {user && activeTab?.dept === "art" && (
          <SkuTable key="art" department="art" />
        )}
        {user && activeTab?.dept === "wd" && (
          <SkuTable key="wd" department="wd" />
        )}

        {/* Equipment: one stable instance; lockedCategory changes on tab switch.
            The data is loaded once and client-side filtered — no re-fetch when
            the user switches between equipment category tabs. */}
        {user && activeTab?.dept === "equipment" && (
          <SkuTable
            key="equipment"
            department="equipment"
            lockedCategory={activeTab.lockedCategory}
            sheetId={mainSheet?.sheet_id}
          />
        )}
      </main>

      <TransactionHistoryDialog open={txHistoryOpen} onOpenChange={setTxHistoryOpen} />

      {isAdmin && (
        <LinkSheetDialog
          open={linkSheetOpen}
          onOpenChange={setLinkSheetOpen}
          onLinked={() => { loadRegisteredSheets(); loadEquipCategories(); }}
        />
      )}
    </div>
  );
};

export default Index;
