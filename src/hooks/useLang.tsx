import { createContext, useContext, useState, ReactNode } from "react";
import { translations, type Lang } from "@/lib/i18n";

export type TranslationDict = typeof translations[Lang];

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TranslationDict;
}

const Ctx = createContext<LangCtx | undefined>(undefined);

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem("lang") as Lang) ?? "th"; } catch { return "th"; }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch { /* ignore */ }
  };

  return (
    <Ctx.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </Ctx.Provider>
  );
};

export const useLang = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLang must be used inside LangProvider");
  return c;
};
