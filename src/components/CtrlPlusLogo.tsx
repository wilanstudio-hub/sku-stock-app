import { useEffect, useState, type ImgHTMLAttributes } from "react";

export type CtrlPlusLogoTheme = "dark" | "light" | "auto";
export type CtrlPlusLogoVariant = "full" | "icon";

export interface CtrlPlusLogoProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  theme?: CtrlPlusLogoTheme;
  variant?: CtrlPlusLogoVariant;
  alt?: string;
}

const LOGO_ASSETS: Record<Exclude<CtrlPlusLogoTheme, "auto">, Record<CtrlPlusLogoVariant, string>> = {
  dark: {
    full: "/branding/ctrlplus-logo-dark.png",
    icon: "/branding/ctrlplus-icon-dark.png",
  },
  light: {
    full: "/branding/ctrlplus-logo-light.png",
    icon: "/branding/ctrlplus-icon-light.png",
  },
};

function getSystemTheme(): Exclude<CtrlPlusLogoTheme, "auto"> {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function useSystemTheme(): Exclude<CtrlPlusLogoTheme, "auto"> {
  const [theme, setTheme] = useState<Exclude<CtrlPlusLogoTheme, "auto">>(getSystemTheme);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const updateTheme = (event: MediaQueryListEvent) => setTheme(event.matches ? "light" : "dark");

    setTheme(mediaQuery.matches ? "light" : "dark");
    mediaQuery.addEventListener?.("change", updateTheme);
    return () => mediaQuery.removeEventListener?.("change", updateTheme);
  }, []);

  return theme;
}

/** Portable Ctrl+ Production logo for Film & Video Production suite. */
export function CtrlPlusLogo({
  className,
  theme = "dark",
  variant = "full",
  alt = "Ctrl+ Production",
  draggable = false,
  ...imageProps
}: CtrlPlusLogoProps) {
  const systemTheme = useSystemTheme();
  const resolvedTheme = theme === "auto" ? systemTheme : theme;

  return (
    <img
      {...imageProps}
      src={LOGO_ASSETS[resolvedTheme][variant]}
      alt={alt}
      draggable={draggable}
      className={["block object-contain select-none", className].filter(Boolean).join(" ")}
    />
  );
}
