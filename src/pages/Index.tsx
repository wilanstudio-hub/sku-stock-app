import { useEffect, useRef, useState } from "react";
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
  const subTabStripRef = useRef<HTMLDivElement>(null);

  const [txHistoryOpen,    setTxHistoryOpen]    = useState(false);
  const [linkSheetOpen,    setLinkSheetOpen]     = useState(false);
  const [registeredSheets, setRegisteredSheets]  = useState<RegisteredSheet[]>([]);
  const [equipCategories,  setEquipCategories]   = useState<string[]>([]);

  // Primary department tab
  const [activeDept, setActiveDept] = useState<Department | "">("");
  // Equipment sub-tab ("all" or a category name)
  const [activeSubTab, setActiveSubTab] = useState<string>("all");

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

  // ── Primary-tab initialisation ────────────────────────────────────────────

  const visibleDepts = (["art", "wd", "equipment"] as Department[]).filter(canView);

  // Set the default active dept once roles resolve; never override a user pick.
  useEffect(() => {
    if (visibleDepts.length > 0 && !visibleDepts.includes(activeDept as Department)) {
      setActiveDept(visibleDepts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDepts.join(",")]);

  // Reset sub-tab to "all" whenever a stale category is no longer in the list.
  useEffect(() => {
    if (activeSubTab !== "all" && equipCategories.length > 0 && !equipCategories.includes(activeSubTab)) {
      setActiveSubTab("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipCategories.join("|")]);

  // Scroll the active sub-tab pill into view.
  useEffect(() => {
    if (!subTabStripRef.current) return;
    const buttons = subTabStripRef.current.querySelectorAll<HTMLElement>("[data-subtab]");
    for (const btn of Array.from(buttons)) {
      if (btn.dataset.subtab === activeSubTab) {
        btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        break;
      }
    }
  }, [activeSubTab]);

  // ── Derived values ────────────────────────────────────────────────────────

  const deptLabel: Record<Department, string> = {
    art: t.tabArt,
    wd:  t.tabWd,
    equipment: t.tabEquipment,
  };

  const mainSheet = registeredSheets.find((s) => s.sku_prefix === "");

  // Equipment sub-nav: pill strip passed as a slot into SkuTable.
  // Rendered after stats cards, before the toolbar row.
  const equipSubNav = canView("equipment") ? (
    <div
      ref={subTabStripRef}
      className="flex items-center gap-1.5 overflow-x-auto py-2"
      style={{ scrollbarWidth: "none" }}
    >
      {/* "Show all" pill */}
      <button
        data-subtab="all"
        onClick={() => setActiveSubTab("all")}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium",
          "whitespace-nowrap shrink-0 border transition-colors font-th",
          activeSubTab === "all"
            ? "bg-primary text-primary-foreground border-primary"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
        )}
      >
        แสดงทั้งหมด
      </button>

      {/* One pill per equipment category */}
      {equipCategories.map((cat) => (
        <button
          key={cat}
          data-subtab={cat}
          onClick={() => setActiveSubTab(cat)}
          className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium",
            "whitespace-nowrap shrink-0 border transition-colors font-th",
            activeSubTab === cat
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          {cat}
        </button>
      ))}

      {/* Admin: register a new sheet into the Equipment ecosystem */}
      {isAdmin && (
        <button
          onClick={() => setLinkSheetOpen(true)}
          title="เพิ่ม Google Sheet ใหม่เป็นแท็บ"
          className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium",
            "whitespace-nowrap shrink-0 border border-dashed transition-colors",
            "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-accent",
          )}
        >
          <Plus className="w-3 h-3" />
          เพิ่มแท็บ
        </button>
      )}
    </div>
  ) : null;

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

        {/* Art */}
        {user && activeDept === "art" && (
          <SkuTable key="art" department="art" />
        )}

        {/* WD */}
        {user && activeDept === "wd" && (
          <SkuTable key="wd" department="wd" />
        )}

        {/* Equipment — single stable instance; lockedCategory changes on sub-tab
            switch so items are loaded once and filtered client-side. */}
        {user && activeDept === "equipment" && (
          <SkuTable
            key="equipment"
            department="equipment"
            lockedCategory={activeSubTab === "all" ? undefined : activeSubTab}
            sheetId={mainSheet?.sheet_id}
            subNav={equipSubNav}
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
