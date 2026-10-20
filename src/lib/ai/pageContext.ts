/**
 * Ctrl+ Inventory - Page-aware Context for AI Agent
 * Maps the current route to a short label + relevant inventory agent tools.
 */
import { currentTranslations } from "@/lib/uiText";

export interface PageContext {
  label: string;
  relevantTools: string[];
}

export function getPageContext(pathname: string): PageContext {
  const t = currentTranslations();
  const contexts: Array<{ prefix: string; context: PageContext }> = [
    {
      prefix: "/admin",
      context: {
        label: t.pageAdmin,
        relevantTools: [
          "trigger_sheet_sync",
          "generate_sku_report",
          "check_item_availability",
          "search_sku_item",
        ],
      },
    },
    {
      prefix: "/scan",
      context: {
        label: t.pageScan,
        relevantTools: [
          "check_item_availability",
          "log_quick_transaction",
          "search_sku_item",
        ],
      },
    },
    {
      prefix: "/auth",
      context: {
        label: t.pageAuth,
        relevantTools: [],
      },
    },
    {
      prefix: "/",
      context: {
        label: t.pageInventory,
        relevantTools: [
          "search_sku_item",
          "check_item_availability",
          "log_quick_transaction",
          "recommend_equipment_kit",
          "generate_sku_report",
          "trigger_sheet_sync",
        ],
      },
    },
  ];

  const fallback: PageContext = {
    label: t.pageDefault,
    relevantTools: ["search_sku_item", "check_item_availability", "recommend_equipment_kit"],
  };

  if (pathname === "/" || pathname === "") {
    return contexts.find((p) => p.prefix === "/")?.context ?? fallback;
  }
  const match = contexts.find((p) => p.prefix !== "/" && pathname.startsWith(p.prefix));
  return match?.context ?? fallback;
}
