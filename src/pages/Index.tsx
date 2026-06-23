import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/hooks/useLang";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkuTable } from "@/components/SkuTable";
import { TransactionHistoryDialog } from "@/components/TransactionHistoryDialog";
import { LinkSheetDialog } from "@/components/LinkSheetDialog";
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
  art: <Clapperboard className="w-4 h-4" />,
  wd: <Shirt className="w-4 h-4" />,
  equipment: <Camera className="w-4 h-4" />,
};

const Index = () => {
  const { user, loading, roles, canView, signOut } = useAuth();
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();
  const isAdmin = roles.includes("admin");

  const [txHistoryOpen, setTxHistoryOpen] = useState(false);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [registeredSheets, setRegisteredSheets] = useState<RegisteredSheet[]>([]);

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
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {t.loading}
      </div>
    );
  }

  const visibleDepts = (["art", "wd", "equipment"] as Department[]).filter(canView);
  const deptLabel: Record<Department, string> = {
    art: t.tabArt,
    wd: t.tabWd,
    equipment: t.tabEquipment,
  };

  // Secondary sheets (non-empty prefix) become their own tabs — visible to any
  // user who can view the equipment section.
  const mainSheet = registeredSheets.find((s) => s.sku_prefix === "");
  const extraSheets = canView("equipment")
    ? registeredSheets.filter((s) => s.sku_prefix !== "")
    : [];

  // First available tab key for the Tabs defaultValue.
  const firstTabKey =
    visibleDepts.length > 0
      ? visibleDepts[0]
      : extraSheets.length > 0
      ? `sheet:${extraSheets[0].sheet_id}`
      : "";

  const hasContent = visibleDepts.length > 0 || extraSheets.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-2">
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
              <Button
                variant="default"
                size="sm"
                onClick={() => nav("/auth")}
                className="gap-2"
              >
                <LogIn className="w-4 h-4" /> {t.signIn}
              </Button>
            )}
          </div>
        </div>
      </header>

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

        {user && !hasContent && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground opacity-30" />
            <p className="font-medium">{t.noSections}</p>
            <p className="text-sm text-muted-foreground">{t.contactAdmin}</p>
          </div>
        )}

        {user && hasContent && (
          <Tabs defaultValue={firstTabKey}>
            {/* Tab strip: triggers + inline admin "add tab" button in one row */}
            <div className="flex items-center gap-1.5 mb-6 flex-wrap">
              <TabsList className="flex flex-wrap h-auto gap-px">
                {/* Static department tabs */}
                {visibleDepts.map((dept) => (
                  <TabsTrigger key={dept} value={dept} className="gap-1.5">
                    {DEPT_ICONS[dept]} {deptLabel[dept]}
                  </TabsTrigger>
                ))}

                {/* Dynamic tabs — one per secondary registered sheet */}
                {extraSheets.map((s) => (
                  <TabsTrigger
                    key={`sheet:${s.sheet_id}`}
                    value={`sheet:${s.sheet_id}`}
                    className="gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {s.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Admin-only "add tab" pill — sits flush next to the tab list */}
              {isAdmin && canView("equipment") && (
                <button
                  onClick={() => setLinkSheetOpen(true)}
                  title="เพิ่ม Google Sheet ใหม่เป็นแท็บ"
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-md text-sm font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-accent transition-colors shrink-0 select-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">เพิ่มแท็บ</span>
                </button>
              )}
            </div>

            {/* Static department tab content */}
            {visibleDepts.map((dept) => (
              <TabsContent key={dept} value={dept}>
                {dept === "equipment" ? (
                  // Pass skuPrefix="" so this tab only shows main-warehouse EQ-* items
                  // when secondary sheets exist as separate tabs.
                  <SkuTable
                    department="equipment"
                    skuPrefix=""
                    sheetId={mainSheet?.sheet_id}
                  />
                ) : (
                  <SkuTable department={dept} />
                )}
              </TabsContent>
            ))}

            {/* Dynamic sheet tab content */}
            {extraSheets.map((s) => (
              <TabsContent key={`sheet:${s.sheet_id}`} value={`sheet:${s.sheet_id}`}>
                <SkuTable
                  department="equipment"
                  skuPrefix={s.sku_prefix}
                  sheetId={s.sheet_id}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>

      <TransactionHistoryDialog open={txHistoryOpen} onOpenChange={setTxHistoryOpen} />

      {isAdmin && (
        <LinkSheetDialog
          open={linkSheetOpen}
          onOpenChange={setLinkSheetOpen}
          onLinked={loadRegisteredSheets}
        />
      )}
    </div>
  );
};

export default Index;
