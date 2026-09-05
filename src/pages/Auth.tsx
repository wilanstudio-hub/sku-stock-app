import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/hooks/useLang";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CtrlPlusLogo } from "@/components/CtrlPlusLogo";

type View = "signin" | "forgot";

const Auth = () => {
  const nav = useNavigate();
  const { lang, setLang, t } = useLang();
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("signin");

  const [siEmail, setSiEmail] = useState("");
  const [siPass, setSiPass] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPass, setSuPass] = useState("");
  const [suName, setSuName] = useState("");
  const [suDept, setSuDept] = useState("art");

  const [fpEmail, setFpEmail] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSent, setFpSent] = useState(false);
  const [fpLineSent, setFpLineSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) nav("/", { replace: true });
    });
  }, [nav]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPass });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success(t.signedIn); nav("/", { replace: true }); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPass,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          display_name: suName,
          department: suDept,
          company_id: tenant?.id || null,
          tenant_slug: tenant?.slug || null,
        },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success(t.accountCreated);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forgot-password", {
        body: { email: fpEmail },
      });
      if (error) {
        // Surface actual error body from non-2xx responses
        let msg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      setFpSent(true);
      setFpLineSent(!!data?.lineSent);
      toast.success(t.resetEmailSent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 -z-10 opacity-20" style={{ backgroundImage: "var(--gradient-hero)" }} />
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <div className="flex flex-col items-center mb-6">
          <CtrlPlusLogo theme="auto" variant="full" className="h-11 w-auto mb-3" />
          <h1 className="text-xl font-bold">
            {tenant ? `${tenant.name} · Inventory` : "Ctrl+ Production Inventory"}
          </h1>
          <p className="text-sm text-muted-foreground font-th">{t.appSubtitle}</p>
          <button
            onClick={() => setLang(lang === "th" ? "en" : "th")}
            className="mt-2 text-xs font-mono px-2 py-0.5 rounded border border-border hover:bg-accent transition-colors"
          >
            {lang === "th" ? "EN" : "TH"}
          </button>
        </div>

        {view === "forgot" ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{t.forgotPasswordTitle}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t.forgotPasswordDesc}</p>
            </div>

            {fpSent ? (
              <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 space-y-1">
                <p>{t.resetEmailSent}</p>
                {fpLineSent && (
                  <p className="text-orange-600 text-xs">✓ {t.resetLineSentNote}</p>
                )}
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div>
                  <Label>{t.emailLabel}</Label>
                  <Input
                    type="email"
                    value={fpEmail}
                    onChange={(e) => setFpEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#ff5a1f] hover:bg-orange-600 text-white"
                  disabled={fpLoading}
                >
                  {fpLoading ? "..." : t.sendResetLink}
                </Button>
              </form>
            )}

            <button
              onClick={() => { setView("signin"); setFpSent(false); setFpLineSent(false); setFpEmail(""); }}
              className="block w-full text-center text-sm text-gray-500 hover:text-orange-500 transition-colors"
            >
              ← {t.backToSignIn}
            </button>
          </div>
        ) : (
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">{t.signInTab}</TabsTrigger>
              <TabsTrigger value="signup">{t.signUpTab}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <Label>{t.emailLabel}</Label>
                  <Input type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)} required />
                </div>
                <div>
                  <Label>{t.passwordLabel}</Label>
                  <Input type="password" value={siPass} onChange={(e) => setSiPass(e.target.value)} required />
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-sm text-gray-500 hover:text-orange-500 transition-colors"
                    >
                      {t.forgotPassword}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "..." : t.signInBtn}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                  <Label>{t.displayNameLabel}</Label>
                  <Input value={suName} onChange={(e) => setSuName(e.target.value)} required />
                </div>
                <div>
                  <Label>{t.departmentLabel}</Label>
                  <Select value={suDept} onValueChange={setSuDept}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="art">Art</SelectItem>
                      <SelectItem value="wd">WD</SelectItem>
                      <SelectItem value="both">{lang === "th" ? "ทั้งสอง" : "Both"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.emailLabel}</Label>
                  <Input type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} required />
                </div>
                <div>
                  <Label>{t.passwordLabel}</Label>
                  <Input type="password" value={suPass} onChange={(e) => setSuPass(e.target.value)} minLength={6} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "..." : t.signUpBtn}
                </Button>
                <p className="text-xs text-muted-foreground text-center">{t.firstUserAdmin}</p>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </Card>
    </div>
  );
};

export default Auth;
