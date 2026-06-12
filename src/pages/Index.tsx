import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/hooks/useLang";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkuTable } from "@/components/SkuTable";
import { TransactionHistoryDialog } from "@/components/TransactionHistoryDialog";
import { LogIn, LogOut, Package, Clapperboard, Shirt, Camera, ShieldCheck, ClipboardList } from "lucide-react";
import type { Department } from "@/hooks/useAuth";

const DEPT_ICONS: Record<Department, React.ReactNode> = {
  art: <Clapperboard className="w-4 h-4" />,
  wd: <Shirt className="w-4 h-4" />,
  equipment: <Camera className="w-4 h-4" />,
};

const Index = () => {
  const { user, loading, roles, canView, signOut } = useAuth();
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();
  const [txHistoryOpen, setTxHistoryOpen] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t.loading}</div>;
  }

  const visibleDepts = (["art", "wd", "equipment"] as Department[]).filter(canView);
  const deptLabel: Record<Department, string> = { art: t.tabArt, wd: t.tabWd, equipment: t.tabEquipment };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold leading-tight">SKU Stock</h1>
              <p className="text-xs text-muted-foreground font-th">{t.appSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
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
                    <Badge key={r} variant="secondary" className="uppercase text-[10px]">{r}</Badge>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground hidden md:inline">{user.email}</span>
                {user && (
                  <Button variant="outline" size="sm" onClick={() => setTxHistoryOpen(true)} title="ประวัติการเบิก-คืน" className="gap-1.5">
                    <ClipboardList className="w-4 h-4" />
                    <span className="hidden sm:inline font-th text-xs">History / Log</span>
                  </Button>
                )}
                {roles.includes("admin") && (
                  <Button variant="ghost" size="icon" onClick={() => nav("/admin")} title={t.adminPanel}>
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

        {user && visibleDepts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground opacity-30" />
            <p className="font-medium">{t.noSections}</p>
            <p className="text-sm text-muted-foreground">{t.contactAdmin}</p>
          </div>
        )}

        {user && visibleDepts.length > 0 && (
          <Tabs defaultValue={visibleDepts[0]}>
            <TabsList className="grid w-full max-w-2xl mb-6" style={{ gridTemplateColumns: `repeat(${visibleDepts.length}, 1fr)` }}>
              {visibleDepts.map((key) => (
                <TabsTrigger key={key} value={key} className="gap-2">
                  {DEPT_ICONS[key]} {deptLabel[key]}
                </TabsTrigger>
              ))}
            </TabsList>
            {visibleDepts.map((key) => (
              <TabsContent key={key} value={key}>
                <SkuTable department={key} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>

      <TransactionHistoryDialog open={txHistoryOpen} onOpenChange={setTxHistoryOpen} />
    </div>
  );
};

export default Index;
