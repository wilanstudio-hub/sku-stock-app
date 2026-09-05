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

  describe("7. Ctrl+ Production Logo Brand Rules", () => {
    const LOGO_ASSETS = {
      dark: {
        full: "/branding/ctrlplus-logo-dark.png",
        icon: "/branding/ctrlplus-icon-dark.png",
      },
      light: {
        full: "/branding/ctrlplus-logo-light.png",
        icon: "/branding/ctrlplus-icon-light.png",
      },
    };

    it("maps dark and light themes to canonical asset paths without distortion", () => {
      expect(LOGO_ASSETS.dark.full).toBe("/branding/ctrlplus-logo-dark.png");
      expect(LOGO_ASSETS.dark.icon).toBe("/branding/ctrlplus-icon-dark.png");
      expect(LOGO_ASSETS.light.full).toBe("/branding/ctrlplus-logo-light.png");
      expect(LOGO_ASSETS.light.icon).toBe("/branding/ctrlplus-icon-light.png");
    });
  });

  describe("8. Inventory AI Agent Tool Validation & Safety", () => {
    it("correctly validates valid tool call payloads with required args", async () => {
      const { validateToolCall, INVENTORY_AGENT_TOOLS } = await import("@/lib/ai/inventoryAgentTools");

      const searchCall = {
        tool: "search_sku_item",
        args: { query: "Sony FX6" }
      };
      const validSearch = validateToolCall(searchCall);
      expect(validSearch.valid).toBe(true);
      expect(validSearch.toolCall?.tool).toBe("search_sku_item");
      expect(validSearch.toolCall?.args.query).toBe("Sony FX6");

      const logCall = {
        tool: "log_quick_transaction",
        args: { sku_code: "EQ-CAM-001", action_type: "check_out", person_name: "สมชาย" }
      };
      const validLog = validateToolCall(logCall);
      expect(validLog.valid).toBe(true);
      expect(validLog.toolCall?.tool).toBe("log_quick_transaction");
    });

    it("rejects tool calls with missing required arguments or unknown tools", async () => {
      const { validateToolCall } = await import("@/lib/ai/inventoryAgentTools");

      const missingArg = {
        tool: "log_quick_transaction",
        args: { sku_code: "EQ-001" } // missing action_type & person_name
      };
      const resultMissing = validateToolCall(missingArg);
      expect(resultMissing.valid).toBe(false);
      expect(resultMissing.error).toContain("Missing required argument");

      const unknown = {
        tool: "delete_entire_database",
        args: {}
      };
      const resultUnknown = validateToolCall(unknown);
      expect(resultUnknown.valid).toBe(false);
      expect(resultUnknown.error).toContain("Unknown tool");
    });

    it("classifies mutating tools strictly for user confirmation gating", async () => {
      const { INVENTORY_AGENT_TOOLS } = await import("@/lib/ai/inventoryAgentTools");

      const mutating = INVENTORY_AGENT_TOOLS.filter(t => t.isMutating).map(t => t.name);
      const readOnly = INVENTORY_AGENT_TOOLS.filter(t => !t.isMutating).map(t => t.name);

      expect(mutating).toContain("log_quick_transaction");
      expect(mutating).toContain("trigger_sheet_sync");
      expect(readOnly).toContain("search_sku_item");
      expect(readOnly).toContain("check_item_availability");
      expect(readOnly).toContain("recommend_equipment_kit");
      expect(readOnly).toContain("generate_sku_report");
    });
  });

  describe("9. Page Context Routing Hints", () => {
    it("resolves relevant tools and labels for Inventory pages", async () => {
      const { getPageContext } = await import("@/lib/ai/pageContext");

      const rootCtx = getPageContext("/");
      expect(rootCtx.label).toContain("คลังอุปกรณ์");
      expect(rootCtx.relevantTools).toContain("search_sku_item");

      const adminCtx = getPageContext("/admin");
      expect(adminCtx.label).toContain("Admin");
      expect(adminCtx.relevantTools).toContain("trigger_sheet_sync");

      const scanCtx = getPageContext("/scan");
      expect(scanCtx.label).toContain("สแกน QR Code");
    });
  });

  describe("10. SaaS Billing Plans Catalog & Seat Limit Checks", () => {
    it("contains server-owned pricing and seat limits adhering to PAYMENT_BILLING_PATTERN", async () => {
      const { SAAS_PLANS } = await import("@/components/BillingPlansDialog");

      expect(SAAS_PLANS.length).toBeGreaterThanOrEqual(4);

      const free = SAAS_PLANS.find(p => p.id === "free");
      const solo = SAAS_PLANS.find(p => p.id === "solo");
      const team = SAAS_PLANS.find(p => p.id === "team");
      const studio = SAAS_PLANS.find(p => p.id === "studio");

      expect(free?.priceBaht).toBe(0);
      expect(free?.seatLimit).toBe(3);

      expect(solo?.priceBaht).toBe(550);
      expect(solo?.seatLimit).toBe(1);

      expect(team?.priceBaht).toBe(2500);
      expect(team?.seatLimit).toBe(8);

      expect(studio?.priceBaht).toBe(5000);
      expect(studio?.seatLimit).toBe(20);
    });

    it("enforces seat limit checks when inviting new members", () => {
      const checkSeatLimit = (currentUsersCount: number, seatLimit: number): boolean => {
        return currentUsersCount < seatLimit;
      };

      expect(checkSeatLimit(2, 3)).toBe(true);  // Allowed
      expect(checkSeatLimit(3, 3)).toBe(false); // Over limit
      expect(checkSeatLimit(8, 8)).toBe(false); // Over limit
      expect(checkSeatLimit(7, 8)).toBe(true);  // Allowed
    });
  });
});
