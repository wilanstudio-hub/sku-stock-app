import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Company = Database["public"]["Tables"]["companies"]["Row"];

interface TenantContextValue {
  tenant: Company | null;
  tenantSlug: string | null;
  isApex: boolean;
  loading: boolean;
  error: string | null;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const RESERVED_SLUGS = new Set(["www", "api", "admin", "status", "app", "dashboard"]);

export function extractSlug(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();
  
  // Localhost / IP check
  if (host === "localhost" || host === "127.0.0.1") return null;

  // If on Cloudflare Pages default domain (*.pages.dev)
  if (host.endsWith(".pages.dev")) {
    const parts = host.split(".");
    if (parts.length <= 3) return null; // e.g. "filmflow-inventory.pages.dev" is apex
    const sub = parts[0];
    return RESERVED_SLUGS.has(sub) ? null : sub;
  }

  // Custom domain (e.g. *.inventory.filmflow.com or *.app.com)
  const parts = host.split(".");
  if (parts.length <= 2) return null; // e.g. "filmflow.com" is apex
  
  if (host.includes("inventory.")) {
    if (parts.length <= 3) return null;
    const sub = parts[0];
    return RESERVED_SLUGS.has(sub) ? null : sub;
  }

  const sub = parts[0];
  return RESERVED_SLUGS.has(sub) ? null : sub;
}

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Company | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [isApex, setIsApex] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const resolveTenant = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check query parameter override first (e.g. ?tenant=acme for dev/preview)
      const urlParams = new URLSearchParams(window.location.search);
      const paramSlug = urlParams.get("tenant");
      const hostSlug = extractSlug(window.location.hostname);
      const slug = (paramSlug || hostSlug || "").trim().toLowerCase();

      if (!slug) {
        setIsApex(true);
        setTenant(null);
        setTenantSlug(null);
        setLoading(false);
        return;
      }

      setIsApex(false);
      setTenantSlug(slug);

      // Fetch company record from Supabase
      const { data, error: fetchErr } = await supabase
        .from("companies")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (fetchErr) {
        setError(fetchErr.message);
        setTenant(null);
      } else if (!data) {
        setError(`ไม่พบสตูดิโอ "${slug}" ในระบบ`);
        setTenant(null);
      } else {
        setTenant(data as Company);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to resolve tenant");
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resolveTenant();
  }, []);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantSlug,
        isApex,
        loading,
        error,
        refreshTenant: resolveTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used inside a TenantProvider");
  }
  return ctx;
};
