import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type FontSize = "normal" | "large" | "xlarge";

interface FontSizeCtx {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  toggleFontSize: () => void;
}

const Ctx = createContext<FontSizeCtx | undefined>(undefined);

export const FontSizeProvider = ({ children }: { children: ReactNode }) => {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    try {
      return (localStorage.getItem("fontSize") as FontSize) || "normal";
    } catch {
      return "normal";
    }
  });

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    try {
      localStorage.setItem("fontSize", size);
    } catch {
      /* ignore */
    }
  };

  const toggleFontSize = () => {
    if (fontSize === "normal") setFontSize("large");
    else if (fontSize === "large") setFontSize("xlarge");
    else setFontSize("normal");
  };

  // Apply the font size to the document root element
  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === "normal") {
      root.style.fontSize = "16px";
    } else if (fontSize === "large") {
      root.style.fontSize = "18px";
    } else if (fontSize === "xlarge") {
      root.style.fontSize = "20px";
    }
  }, [fontSize]);

  return (
    <Ctx.Provider value={{ fontSize, setFontSize, toggleFontSize }}>
      {children}
    </Ctx.Provider>
  );
};

export const useFontSize = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFontSize must be used inside FontSizeProvider");
  return c;
};
