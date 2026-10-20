import { translations, type Lang } from "@/lib/i18n";

const THAI = /[\u0E00-\u0E7F]/;

export function readLang(): Lang {
  try {
    if (typeof window === "undefined") return "th";
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "en" || q === "th") return q;
    const stored = localStorage.getItem("lang");
    if (stored === "en" || stored === "th") return stored;
  } catch {
    /* ignore */
  }
  return "th";
}

export function currentTranslations() {
  return translations[readLang()];
}

export function hasThai(value: string) {
  return THAI.test(value);
}

export function formatStamp(iso: string, lang: Lang = readLang()) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return lang === "th"
    ? `${dd}/${mm}/${yyyy} - ${hh}:${min} น.`
    : `${dd}/${mm}/${yyyy} - ${hh}:${min}`;
}

const UNIT_EN: Record<string, string> = {
  "ชิ้น": "pcs",
  "ชุด": "sets",
  "กล่อง": "boxes",
  "อัน": "pcs",
  "คู่": "pairs",
  "เส้น": "pcs",
  "ม้วน": "rolls",
  "ใบ": "pcs",
};

export function displayUnit(unit: string | null | undefined, lang: Lang) {
  const raw = (unit ?? "").trim();
  if (lang === "th") return raw || "ชิ้น";
  if (!raw || raw === "ชิ้น") return "pcs";
  return UNIT_EN[raw] ?? (hasThai(raw) ? "pcs" : raw);
}

export function displayItemName(
  item: { name_th?: string | null; name_en?: string | null },
  lang: Lang,
) {
  const th = (item.name_th ?? "").trim();
  const en = (item.name_en ?? "").trim();
  if (lang === "en") return en || th;
  return th || en;
}

export function displayItemSubtitle(
  item: { name_th?: string | null; name_en?: string | null },
  lang: Lang,
) {
  if (lang === "en") return "";
  const th = (item.name_th ?? "").trim();
  const en = (item.name_en ?? "").trim();
  return en && en !== th ? en : "";
}

export function displayDeptName(dept: { code: string; name_th: string }, lang: Lang) {
  if (lang === "th") return dept.name_th;
  const t = translations.en;
  if (dept.code === "art") return t.tabArt;
  if (dept.code === "wd") return t.tabWd;
  if (dept.code === "equipment") return t.tabEquipment;
  const head = dept.name_th.split("/")[0]?.trim() ?? "";
  if (head && !hasThai(head)) return head;
  return dept.code;
}

export function displayPlain(value: string | null | undefined, lang: Lang) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (lang === "th" || !hasThai(raw)) return raw;
  return "";
}

export function displayZoneName(zone: { name_th: string; name_en?: string | null }, lang: Lang) {
  if (lang === "th") return zone.name_th;
  const en = (zone.name_en ?? "").trim();
  if (en && !hasThai(en)) return en;
  return hasThai(zone.name_th) ? "" : zone.name_th;
}
