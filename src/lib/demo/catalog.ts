import type { Lang } from "@/lib/i18n";
import type { Sku, SkuTransaction } from "@/components/SkuDialog";

export interface DemoDepartment {
  id: string;
  code: string;
  name_th: string;
  icon: string;
  sync_format: string;
  order_index: number;
  is_active: boolean;
  company_id: string | null;
}

export interface DemoZone {
  id: string;
  key: string;
  name_th: string;
  name_en: string;
  image_url: string | null;
  order_index: number;
}

type SkuSeed = {
  id: string;
  department: Sku["department"];
  sku_code: string;
  name_th: string;
  name_en: string;
  category_th: string;
  category_en: string;
  location_th: string;
  location_en: string;
  quantity: number;
  unit_th: string;
  unit_en: string;
  notes_th: string;
  notes_en: string;
  availability: Sku["availability"];
  current_status: "available" | "check_out";
  handler_th: string | null;
  handler_en: string | null;
};

type TxSeed = {
  id: string;
  sku_code: string;
  department: string;
  action_type: "check_out" | "check_in";
  person_th: string;
  person_en: string;
  created_at: string;
};

const COMPANY = "demo-company";

export const DEMO_DEPARTMENTS: DemoDepartment[] = [
  { id: "dept-art", code: "art", name_th: "Art / อาร์ต", icon: "clapperboard", sync_format: "art", order_index: 1, is_active: true, company_id: COMPANY },
  { id: "dept-wd", code: "wd", name_th: "WD / เสื้อผ้า", icon: "shirt", sync_format: "wd", order_index: 2, is_active: true, company_id: COMPANY },
  { id: "dept-eq", code: "equipment", name_th: "Equipment / อุปกรณ์", icon: "camera", sync_format: "equipment", order_index: 3, is_active: true, company_id: COMPANY },
];

const SKUS: SkuSeed[] = [
  {
    id: "sku-lantern",
    department: "art",
    sku_code: "ART-LIG-SIL-RUS-001",
    name_th: "ตะเกียงน้ำมันก๊าด",
    name_en: "Pressure kerosene lantern",
    category_th: "ไฟ",
    category_en: "Lighting",
    location_th: "ใต้ชั้น A3",
    location_en: "Under shelf A3",
    quantity: 4,
    unit_th: "ชิ้น",
    unit_en: "pcs",
    notes_th: "พร็อพกอง",
    notes_en: "Set prop",
    availability: "available",
    current_status: "check_out",
    handler_th: "มายด์ (วอร์ดโรบ)",
    handler_en: "Mind (Wardrobe)",
  },
  {
    id: "sku-clock",
    department: "art",
    sku_code: "ART-PRP-CLK-008",
    name_th: "นาฬิกาตั้งโต๊ะสีน้ำเงิน",
    name_en: "Blue desk clock",
    category_th: "พร็อพ",
    category_en: "Props",
    location_th: "กล่องอาร์ต 2",
    location_en: "Art box 2",
    quantity: 1,
    unit_th: "ชิ้น",
    unit_en: "pcs",
    notes_th: "",
    notes_en: "",
    availability: "available",
    current_status: "available",
    handler_th: null,
    handler_en: null,
  },
  {
    id: "sku-camera",
    department: "equipment",
    sku_code: "EQ-CAM-FX6-001",
    name_th: "กล้อง Sony FX6",
    name_en: "Sony FX6 camera",
    category_th: "กล้อง",
    category_en: "Camera",
    location_th: "ชั้นวางที่ 1",
    location_en: "Shelving unit 1",
    quantity: 2,
    unit_th: "ตัว",
    unit_en: "pcs",
    notes_th: "พร้อมแบตเตอรี่",
    notes_en: "Batteries included",
    availability: "available",
    current_status: "available",
    handler_th: null,
    handler_en: null,
  },
  {
    id: "sku-suit",
    department: "wd",
    sku_code: "WD-CST-NAV-004",
    name_th: "ชุดสูทสีกรมท่า",
    name_en: "Navy suit",
    category_th: "ชุด",
    category_en: "Costume",
    location_th: "ราวเสื้อผ้า B",
    location_en: "Wardrobe rack B",
    quantity: 1,
    unit_th: "ชุด",
    unit_en: "set",
    notes_th: "ไซส์ M",
    notes_en: "Size M",
    availability: "on_event",
    current_status: "check_out",
    handler_th: "ณัฐ (ฝ่ายอาร์ต)",
    handler_en: "Nathan (Art)",
  },
];

const TXS: TxSeed[] = [
  {
    id: "tx-1",
    sku_code: "ART-LIG-SIL-RUS-001",
    department: "art",
    action_type: "check_out",
    person_th: "มายด์ (วอร์ดโรบ)",
    person_en: "Mind (Wardrobe)",
    created_at: "2026-10-18T09:24:00.000Z",
  },
  {
    id: "tx-2",
    sku_code: "ART-LIG-SIL-RUS-001",
    department: "art",
    action_type: "check_in",
    person_th: "อเล็กซ์ (กล้อง)",
    person_en: "Alex (Camera)",
    created_at: "2026-10-17T16:05:00.000Z",
  },
  {
    id: "tx-3",
    sku_code: "WD-CST-NAV-004",
    department: "wd",
    action_type: "check_out",
    person_th: "ณัฐ (ฝ่ายอาร์ต)",
    person_en: "Nathan (Art)",
    created_at: "2026-10-18T11:10:00.000Z",
  },
  {
    id: "tx-4",
    sku_code: "EQ-CAM-FX6-001",
    department: "equipment",
    action_type: "check_in",
    person_th: "มายด์ (วอร์ดโรบ)",
    person_en: "Mind (Wardrobe)",
    created_at: "2026-10-16T14:40:00.000Z",
  },
];

export const DEMO_ZONES: DemoZone[] = [
  { id: "zone-a", key: "A", name_th: "ชั้นวางที่ 1", name_en: "Shelving unit 1", image_url: null, order_index: 1 },
  { id: "zone-b", key: "B", name_th: "รถเข็นพยาบาล", name_en: "Medical cart", image_url: null, order_index: 2 },
  { id: "zone-c", key: "C", name_th: "ราวเสื้อผ้า", name_en: "Wardrobe rack", image_url: null, order_index: 3 },
];

const overrides = new Map<string, { status: "available" | "check_out"; handler_th: string | null; handler_en: string | null }>();
const extraTx: TxSeed[] = [];

export function demoSkus(lang: Lang): Sku[] {
  return SKUS.map((s) => {
    const over = overrides.get(s.sku_code);
    const status = over?.status ?? s.current_status;
    const handlerTh = over ? over.handler_th : s.handler_th;
    const handlerEn = over ? over.handler_en : s.handler_en;
    return {
      id: s.id,
      company_id: COMPANY,
      department: s.department,
      sku_code: s.sku_code,
      name_th: s.name_th,
      name_en: s.name_en,
      category: lang === "en" ? s.category_en : s.category_th,
      location: lang === "en" ? s.location_en : s.location_th,
      quantity: s.quantity,
      unit: lang === "en" ? s.unit_en : s.unit_th,
      min_stock: 1,
      image_url: null,
      image_urls: null,
      notes_th: lang === "en" ? s.notes_en : s.notes_th,
      notes_en: s.notes_en,
      color: null,
      special_features: null,
      style: null,
      availability: s.availability,
      current_status: status,
      last_handler: lang === "en" ? handlerEn : handlerTh,
      updated_at: "2026-10-18T09:24:00.000Z",
    };
  });
}

export function demoSkuByCode(code: string, lang: Lang): Sku | null {
  return demoSkus(lang).find((s) => s.sku_code === code) ?? null;
}

export function demoTransactions(lang: Lang): SkuTransaction[] {
  return [...TXS, ...extraTx].map((tx) => ({
    id: tx.id,
    company_id: COMPANY,
    sku_code: tx.sku_code,
    department: tx.department,
    action_type: tx.action_type,
    person_name: lang === "en" ? tx.person_en : tx.person_th,
    created_at: tx.created_at,
  })).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoCheck(skuCode: string, action: "check_out" | "check_in", person: string, lang: Lang) {
  const handler = person.trim();
  overrides.set(skuCode, {
    status: action === "check_out" ? "check_out" : "available",
    handler_th: handler,
    handler_en: handler,
  });
  const sku = SKUS.find((s) => s.sku_code === skuCode);
  extraTx.push({
    id: `tx-live-${extraTx.length + 1}`,
    sku_code: skuCode,
    department: sku?.department ?? "art",
    action_type: action,
    person_th: handler,
    person_en: handler,
    created_at: new Date().toISOString(),
  });
  return demoSkuByCode(skuCode, lang);
}
