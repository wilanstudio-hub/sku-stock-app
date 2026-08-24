import { QRCodeSVG } from "qrcode.react";
import type { Sku } from "./SkuDialog";

const DEPT_LABEL: Record<string, string> = {
  art: "Art",
  wd: "WD",
  equipment: "Equip",
};

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

interface Props {
  sku: Sku;
  /** Optional fixed width class; defaults to w-60 (240 px ≈ 63 mm) */
  className?: string;
}

export function ProductLabel({ sku, className = "" }: Props) {
  const dept = DEPT_LABEL[sku.department] ?? sku.department.toUpperCase();
  const categoryLine = [dept, sku.category].filter(Boolean).join(" · ");

  // Footer: show LOC and BOX labels with their values, then any extra notes, all on one clipped line.
  const footerParts = [
    `LOC  ${sku.location ? clip(sku.location, 14) : "—"}`,
    `BOX  ${sku.notes_th ? clip(sku.notes_th, 20) : "—"}`,
  ];
  const footerLine = footerParts.join("   ");

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-md p-4 flex flex-col gap-2 select-none w-60 ${className}`}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex justify-between items-center font-mono text-[10px] tracking-[0.2em] uppercase text-gray-400">
        <span>SKU</span>
        <span>STOCK</span>
      </div>

      <hr className="border-gray-100" />

      {/* ── QR Code ──────────────────────────────────────────── */}
      <div className="flex justify-center py-1">
        <QRCodeSVG
          value={`${typeof window !== "undefined" ? window.location.origin : ""}/scan?sku=${encodeURIComponent(sku.sku_code)}`}
          size={128}
          marginSize={1}
          className="rounded"
        />
      </div>

      <hr className="border-gray-100" />

      {/* ── SKU Code ─────────────────────────────────────────── */}
      <p className="font-mono font-bold text-sm tracking-wide text-gray-900 text-center">
        {sku.sku_code}
      </p>

      {/* ── Name ─────────────────────────────────────────────── */}
      <div className="text-center space-y-0.5">
        <p className="text-base font-semibold leading-snug text-gray-800 font-th">
          {sku.name_th}
        </p>
        {sku.name_en && sku.name_en !== sku.name_th && (
          <p className="text-sm leading-snug text-gray-500 font-th">
            {sku.name_en}
          </p>
        )}
      </div>

      {/* ── Category ─────────────────────────────────────────── */}
      <p className="text-xs text-gray-400 text-center font-th">
        {categoryLine || "—"}
      </p>

      <hr className="border-gray-100" />

      {/* ── Footer ───────────────────────────────────────────── */}
      <p className="font-mono text-[10px] text-gray-400 truncate">
        {footerLine}
      </p>
    </div>
  );
}

// ── Demo / storybook usage ────────────────────────────────────────────────────
export const DEMO_SKU: Sku = {
  id: "demo-001",
  department: "art",
  sku_code: "CLK-MOD-PLT-BLU-M-CLK008",
  name_th: "นาฬิกา ตั้งโต๊ะ สีน้ำเงิน",
  name_en: "Blue Desk Clock",
  category: "อุปกรณ์อิเล็กทรอนิกส์",
  location: "ใต้ชั้น A3",
  quantity: 1,
  unit: "ชิ้น",
  min_stock: 1,
  image_url: null,
  image_urls: null,
  notes_th: "อุปกรณ์อิเล็กทรอนิกส์&นาฬิกา",
  notes_en: null,
  color: "Blue",
  special_features: null,
  style: "Modern",
  availability: "available",
};
