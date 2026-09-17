import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppLogoTheme = "dark" | "light" | "auto";
export type AppLogoVariant = "full" | "icon";

export interface AppLogoProps {
  theme?: AppLogoTheme;
  variant?: AppLogoVariant;
  alt?: string;
  className?: string;
}

/** SKU Stock logo: the original Package-icon-in-gradient-box mark. */
export function AppLogo({
  className,
  variant = "full",
  alt = "SKU Stock",
}: AppLogoProps) {
  const icon = (
    <div
      className={cn("rounded-2xl flex items-center justify-center shrink-0 aspect-square", variant === "icon" ? "h-full w-full" : "h-full")}
      style={{ background: "var(--gradient-hero)" }}
      role="img"
      aria-label={alt}
    >
      <Package className="w-[60%] h-[60%] text-white" />
    </div>
  );

  if (variant === "icon") {
    return <div className={cn("shrink-0", className)}>{icon}</div>;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {icon}
      <span className="font-bold text-lg text-foreground whitespace-nowrap">SKU Stock</span>
    </div>
  );
}
