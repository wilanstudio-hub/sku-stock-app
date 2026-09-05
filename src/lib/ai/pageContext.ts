/**
 * FilmFlow Inventory - Page-aware Context for AI Agent
 * Maps the current route to a short label + relevant inventory agent tools.
 */
export interface PageContext {
  label: string;
  relevantTools: string[];
}

const PAGE_CONTEXTS: Array<{ prefix: string; context: PageContext }> = [
  {
    prefix: "/admin",
    context: {
      label: "แผงควบคุมและสตูดิโอ (Admin)",
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
      label: "สแกน QR Code หน้ากองถ่าย",
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
      label: "เข้าสู่ระบบสตูดิโอ",
      relevantTools: [],
    },
  },
  {
    prefix: "/",
    context: {
      label: "คลังอุปกรณ์และสต๊อก (Inventory)",
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

const DEFAULT_CONTEXT: PageContext = {
  label: "ระบบจัดการสต๊อก FilmFlow",
  relevantTools: ["search_sku_item", "check_item_availability", "recommend_equipment_kit"],
};

export function getPageContext(pathname: string): PageContext {
  if (pathname === "/" || pathname === "") {
    return PAGE_CONTEXTS.find((p) => p.prefix === "/")?.context ?? DEFAULT_CONTEXT;
  }
  const match = PAGE_CONTEXTS.find((p) => p.prefix !== "/" && pathname.startsWith(p.prefix));
  return match?.context ?? DEFAULT_CONTEXT;
}
