import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/hooks/useLang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Package } from "lucide-react";

const UpdatePassword = () => {
  const nav = useNavigate();
  const { lang, setLang, t } = useLang();

  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the page loads with a recovery token in the URL hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setChecking(false);
      }
    });

    // If the hash contains type=recovery but the event already fired before we subscribed,
    // check the current session as a fallback.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type%3Drecovery")) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setIsRecovery(true);
        }
        setChecking(false);
      });
    } else {
      // Give the auth state change a moment to fire before giving up.
      const timer = setTimeout(() => setChecking(false), 1500);
      return () => {
        clearTimeout(timer);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(t.passwordMismatch);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.passwordUpdated);
      await supabase.auth.signOut();
      nav("/auth", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 -z-10 opacity-20" style={{ backgroundImage: "var(--gradient-hero)" }} />
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: "var(--gradient-hero)" }}>
            <Package className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">SKU Stock</h1>
          <p className="text-sm text-muted-foreground font-th">{t.appSubtitle}</p>
          <button
            onClick={() => setLang(lang === "th" ? "en" : "th")}
            className="mt-2 text-xs font-mono px-2 py-0.5 rounded border border-border hover:bg-accent transition-colors"
          >
            {lang === "th" ? "EN" : "TH"}
          </button>
        </div>

        {checking ? (
          <p className="text-center text-sm text-muted-foreground py-4">{t.loading}</p>
        ) : !isRecovery ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-600">{t.invalidResetLink}</p>
            <button
              onClick={() => nav("/auth", { replace: true })}
              className="text-sm text-gray-500 hover:text-orange-500 transition-colors"
            >
              ← {t.backToSignIn}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{t.updatePasswordTitle}</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>{t.newPasswordLabel}</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  autoFocus
                />
              </div>
              <div>
                <Label>{t.confirmPasswordLabel}</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#ff5a1f] hover:bg-orange-600 text-white"
                disabled={loading}
              >
                {loading ? "..." : t.updatePasswordBtn}
              </Button>
            </form>
            <button
              onClick={() => nav("/auth", { replace: true })}
              className="block w-full text-center text-sm text-gray-500 hover:text-orange-500 transition-colors"
            >
              ← {t.backToSignIn}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default UpdatePassword;
