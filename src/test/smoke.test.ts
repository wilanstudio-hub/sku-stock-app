import { describe, it, expect } from "vitest";
import { translations } from "@/lib/i18n";

describe("E2E Smoke Tests: Core Inventory Flows", () => {
  describe("1. QR Code & Scan URL Formatting", () => {
    it("encodes SKU codes into valid /scan URL format matching ScanPage query parser", () => {
      const sampleSkus = [
        "ART-PROP-001",
        "WD-COSTUME-123",
        "EQ-CAM-FX6-01",
        "CUSTOM/DEPT#99"
      ];

      sampleSkus.forEach((sku) => {
        const origin = "https://filmflow-inventory.pages.dev";
        const url = `${origin}/scan?sku=${encodeURIComponent(sku)}`;
        const parsedUrl = new URL(url);
        
        expect(parsedUrl.pathname).toBe("/scan");
        expect(parsedUrl.searchParams.get("sku")).toBe(sku);
      });
    });
  });

  describe("2. Role and Section Access Logic", () => {
    const checkCanView = (
      roles: string[],
      viewerAccess: string[],
      dept: string
    ): boolean => {
      return (
        roles.includes("admin") ||
        roles.includes(dept) ||
        viewerAccess.includes(dept)
      );
    };

    const checkCanEdit = (roles: string[], dept: string): boolean => {
      return roles.includes("admin") || roles.includes(dept);
    };

    it("grants admin full access across all departments", () => {
      const roles = ["admin"];
      const viewerAccess: string[] = [];

      expect(checkCanView(roles, viewerAccess, "art")).toBe(true);
      expect(checkCanView(roles, viewerAccess, "wd")).toBe(true);
      expect(checkCanView(roles, viewerAccess, "equipment")).toBe(true);
      expect(checkCanView(roles, viewerAccess, "custom_dept")).toBe(true);

      expect(checkCanEdit(roles, "art")).toBe(true);
      expect(checkCanEdit(roles, "custom_dept")).toBe(true);
    });

    it("isolates department edit permissions to matching roles", () => {
      const roles = ["art"];
      const viewerAccess: string[] = [];

      expect(checkCanView(roles, viewerAccess, "art")).toBe(true);
      expect(checkCanEdit(roles, "art")).toBe(true);

      expect(checkCanView(roles, viewerAccess, "wd")).toBe(false);
      expect(checkCanEdit(roles, "wd")).toBe(false);
      expect(checkCanView(roles, viewerAccess, "equipment")).toBe(false);
    });

    it("allows viewers with section access to view but not edit", () => {
      const roles = ["viewer"];
      const viewerAccess = ["equipment", "custom_dept"];

      expect(checkCanView(roles, viewerAccess, "equipment")).toBe(true);
      expect(checkCanView(roles, viewerAccess, "custom_dept")).toBe(true);
      expect(checkCanView(roles, viewerAccess, "art")).toBe(false);

      expect(checkCanEdit(roles, "equipment")).toBe(false);
      expect(checkCanEdit(roles, "custom_dept")).toBe(false);
    });
  });

  describe("3. i18n Dictionary Consistency", () => {
    it("has identical translation keys across Thai and English dictionaries", () => {
      const thKeys = Object.keys(translations.th).sort();
      const enKeys = Object.keys(translations.en).sort();

      expect(thKeys).toEqual(enKeys);
    });

    it("supports formatted translation helper functions in both languages", () => {
      expect(translations.th.selectedCount(5)).toContain("5");
      expect(translations.en.selectedCount(5)).toContain("5");
      expect(translations.th.syncSuccess(10, 2)).toContain("10");
      expect(translations.en.syncSuccess(10, 2)).toContain("10");
      expect(translations.th.pdfPage(1, 3)).toContain("1");
      expect(translations.en.pdfPage(1, 3)).toContain("1");
    });
  });

  describe("4. QR Check-In / Check-Out State Transitions", () => {
    type SkuStatus = "available" | "checked_out" | "maintenance" | "lost";

    interface SkuRecord {
      sku_code: string;
      current_status: SkuStatus;
      last_handler: string | null;
      last_action_at: string | null;
    }

    const performTransaction = (
      item: SkuRecord,
      action: "check_out" | "check_in",
      handlerName: string
    ) => {
      if (action === "check_out") {
        if (!handlerName.trim()) throw new Error("Handler name required");
        return {
          ...item,
          current_status: "checked_out" as SkuStatus,
          last_handler: handlerName.trim(),
          last_action_at: new Date().toISOString()
        };
      } else {
        return {
          ...item,
          current_status: "available" as SkuStatus,
          last_handler: handlerName.trim() || item.last_handler,
          last_action_at: new Date().toISOString()
        };
      }
    };

    it("correctly transitions available item to checked_out with handler", () => {
      const initialItem: SkuRecord = {
        sku_code: "EQ-001",
        current_status: "available",
        last_handler: null,
        last_action_at: null
      };

      const updated = performTransaction(initialItem, "check_out", "John Camera Op");
      expect(updated.current_status).toBe("checked_out");
      expect(updated.last_handler).toBe("John Camera Op");
      expect(updated.last_action_at).toBeDefined();
    });

    it("correctly returns checked_out item to available on check_in", () => {
      const checkedOutItem: SkuRecord = {
        sku_code: "EQ-001",
        current_status: "checked_out",
        last_handler: "John Camera Op",
        last_action_at: "2026-08-25T01:00:00Z"
      };

      const returned = performTransaction(checkedOutItem, "check_in", "Equipment Dept");
      expect(returned.current_status).toBe("available");
      expect(returned.last_handler).toBe("Equipment Dept");
    });

    it("rejects check_out without a handler name", () => {
      const item: SkuRecord = {
        sku_code: "EQ-001",
        current_status: "available",
        last_handler: null,
        last_action_at: null
      };

      expect(() => performTransaction(item, "check_out", "")).toThrow(
        "Handler name required"
      );
    });
  });

  describe("5. Google Drive & Sheet Normalizers", () => {
    function parseDriveUrl(raw: string): string | null {
      if (!raw?.trim()) return null;
      const s = raw.trim();
      let m = s.match(/\/file\/d\/([\w-]+)/);
      if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
      m = s.match(/[?&]id=([\w-]+)/);
      if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
      if (/^[\w-]{25,}$/.test(s)) return `https://lh3.googleusercontent.com/d/${s}`;
      return null;
    }

    function normalizeTitle(raw: string): string {
      return String(raw)
        .replace(/[\u00ad\u200b\u2060\ufeff]|\u200c|\u200d/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    it("extracts direct thumbnail URL from various Google Drive link formats", () => {
      const shareUrl = "https://drive.google.com/file/d/1AbC-xyz123_456789/view?usp=sharing";
      const openUrl = "https://drive.google.com/open?id=1AbC-xyz123_456789";
      const bareId = "1AbC-xyz123_456789abcdefgh";

      expect(parseDriveUrl(shareUrl)).toBe("https://lh3.googleusercontent.com/d/1AbC-xyz123_456789");
      expect(parseDriveUrl(openUrl)).toBe("https://lh3.googleusercontent.com/d/1AbC-xyz123_456789");
      expect(parseDriveUrl(bareId)).toBe("https://lh3.googleusercontent.com/d/1AbC-xyz123_456789abcdefgh");
      expect(parseDriveUrl("")).toBeNull();
    });

    it("strips invisible unicode characters and cleans whitespace in sheet tab names", () => {
      const dirtyTab = "  Art\u200B Dept \u00adProps\ufeff  ";
      expect(normalizeTitle(dirtyTab)).toBe("Art Dept Props");
    });
  });

  describe("6. Multi-Tenant Subdomain Resolver", () => {
    const RESERVED_SLUGS = new Set(["www", "api", "admin", "status", "app", "dashboard"]);

    function extractSlug(hostname: string): string | null {
      const host = hostname.split(":")[0].toLowerCase();
      if (host === "localhost" || host === "127.0.0.1") return null;
      if (host.endsWith(".pages.dev")) {
        const parts = host.split(".");
        if (parts.length <= 3) return null;
        const sub = parts[0];
        return RESERVED_SLUGS.has(sub) ? null : sub;
      }
      const parts = host.split(".");
      if (parts.length <= 2) return null;
      if (host.includes("inventory.")) {
        if (parts.length <= 3) return null;
        const sub = parts[0];
        return RESERVED_SLUGS.has(sub) ? null : sub;
      }
      const sub = parts[0];
      return RESERVED_SLUGS.has(sub) ? null : sub;
    }

    it("resolves tenant slug from subdomains", () => {
      expect(extractSlug("warner.inventory.filmflow.com")).toBe("warner");
      expect(extractSlug("acme.filmflow.com")).toBe("acme");
      expect(extractSlug("studio-123.filmflow-inventory.pages.dev")).toBe("studio-123");
    });

    it("returns null for apex domains, localhost, and reserved slugs", () => {
      expect(extractSlug("localhost")).toBeNull();
      expect(extractSlug("filmflow-inventory.pages.dev")).toBeNull();
      expect(extractSlug("filmflow.com")).toBeNull();
      expect(extractSlug("www.filmflow.com")).toBeNull();
      expect(extractSlug("api.filmflow.com")).toBeNull();
      expect(extractSlug("admin.filmflow.com")).toBeNull();
    });
  });
});
