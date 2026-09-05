import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clapperboard, Camera, Shirt, FileSpreadsheet, ShieldCheck, Building2 } from "lucide-react";
import { Button } from "./ui/button";
import { useLang } from "@/hooks/useLang";
import { RegisterCompanyDialog } from "./RegisterCompanyDialog";
import { CtrlPlusLogo } from "./CtrlPlusLogo";

export const Landing = () => {
  const nav = useNavigate();
  const { t } = useLang();

  return (
    <div className="flex flex-col items-center pt-16 pb-32 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Brand Logo */}
      <CtrlPlusLogo theme="auto" variant="full" className="h-12 w-auto mb-6" />

      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        {t.landingBadge}
      </div>

      {/* Hero Text */}
      <h1 className="text-5xl md:text-7xl font-extrabold text-center tracking-tight text-foreground max-w-4xl mb-6 leading-[1.1]">
        {t.landingTitle1} <br className="hidden sm:block" />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
          {t.landingTitle2}
        </span>
      </h1>

      <p className="text-lg md:text-xl text-muted-foreground text-center max-w-2xl mb-10">
        {t.landingDesc}
      </p>

      {/* Call to Action */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          size="lg"
          onClick={() => nav("/auth")}
          className="gap-2 text-base h-14 px-8 rounded-full shadow-elegant hover:scale-105 transition-transform"
        >
          {t.getStarted} <ArrowRight className="w-5 h-5" />
        </Button>
        <RegisterCompanyDialog
          trigger={
            <Button
              size="lg"
              variant="outline"
              className="gap-2 text-base h-14 px-8 rounded-full hover:scale-105 transition-transform"
            >
              <Building2 className="w-5 h-5 text-primary" /> ลงทะเบียนสตูดิโอใหม่
            </Button>
          }
        />
      </div>
      
      {/* Google Sheets Sync Highlight */}
      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full border">
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        <span>{t.landingSync}</span>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-20">
        <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border shadow-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Clapperboard className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-2">{t.landingArt}</h3>
          <p className="text-sm text-muted-foreground">
            {t.landingArtDesc}
          </p>
        </div>
        
        <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border shadow-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-2">{t.landingCamera}</h3>
          <p className="text-sm text-muted-foreground">
            {t.landingCameraDesc}
          </p>
        </div>

        <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border shadow-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Shirt className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-2">{t.landingWd}</h3>
          <p className="text-sm text-muted-foreground">
            {t.landingWdDesc}
          </p>
        </div>
      </div>

      {/* How it works / Security & Sync section */}
      <div className="mt-32 flex flex-col items-center w-full max-w-5xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">{t.landingHowItWorks}</h2>
        <p className="text-muted-foreground text-center max-w-2xl mb-12">
          {t.landingHowItWorksDesc}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {/* Easy to use */}
          <div className="flex flex-col gap-3 p-6 rounded-2xl bg-accent/30 border">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold">{t.landingFeature1Title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t.landingFeature1Desc}
            </p>
          </div>

          {/* Sync */}
          <div className="flex flex-col gap-3 p-6 rounded-2xl bg-accent/30 border">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold">{t.landingFeature2Title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t.landingFeature2Desc}
            </p>
          </div>

          {/* Security */}
          <div className="flex flex-col gap-3 p-6 rounded-2xl bg-accent/30 border">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold">{t.landingFeature3Title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t.landingFeature3Desc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

