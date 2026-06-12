import { forwardRef, useImperativeHandle, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import type { Sku } from "./SkuDialog";

export interface QrSheetHandle {
  printItems(items: Sku[]): void;
}

interface Props {
  items: Sku[];
}

const DEPT_LABEL: Record<string, string> = { art: "Art", wd: "WD", equipment: "Equipment" };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildPrintWindow(items: Sku[], qrRefs: Map<string, HTMLCanvasElement>) {
  const cells = items.map((s) => {
    const canvas = qrRefs.get(s.id!);
    const dataUrl = canvas?.toDataURL("image/png") ?? "";
    const dept = DEPT_LABEL[s.department] ?? s.department;
    const cat = s.category ? ` · ${s.category}` : "";
    return `
      <div class="cell">
        <div class="header">SKU &nbsp; STOCK</div>
        <hr>
        <img class="qr" src="${dataUrl}" alt="QR">
        <hr>
        <div class="sku">${esc(s.sku_code)}</div>
        <div class="name-th">${esc(s.name_th)}</div>
        <div class="name-en">${esc(s.name_en)}</div>
        <div class="dept">${esc(dept + cat)}</div>
        ${s.location ? `<div class="location"><span class="loc-key">LOC &nbsp;</span>${esc(s.location)}</div>` : ""}
      </div>`;
  }).join("");

  const w = window.open("", "_blank", "width=960,height=1200");
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>QR Labels (${items.length})</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&family=IBM+Plex+Mono:wght@400;700&display=swap');
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; background: #fff; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
  .cell {
    border: 0.5pt solid #d1d5db; border-radius: 1.5mm;
    padding: 3mm 2.5mm; text-align: center;
    break-inside: avoid; page-break-inside: avoid;
  }
  .header {
    font-family: 'IBM Plex Mono', monospace; font-size: 5pt; font-weight: 700;
    letter-spacing: 1.5px; color: #9ca3af; text-transform: uppercase; margin-bottom: 1.5mm;
  }
  hr { border: none; border-top: 0.3pt solid #e5e7eb; margin: 1.5mm 0; }
  .qr { display: block; width: 33mm; height: 33mm; margin: 0 auto; }
  .sku {
    font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt; font-weight: 700;
    color: #111827; margin: 1mm 0 0.5mm; letter-spacing: 0.3px; word-break: break-all;
  }
  .name-th { font-size: 6.5pt; color: #1f2937; line-height: 1.3; word-break: break-word; }
  .name-en { font-size: 5.5pt; color: #6b7280; margin-top: 0.5mm; line-height: 1.3; word-break: break-word; }
  .dept    { font-size: 5pt; color: #9ca3af; margin-top: 1mm; }
  .location {
    font-size: 6.5pt; color: #111827; font-weight: 700;
    margin-top: 1.5mm; padding-top: 1.5mm; border-top: 0.3pt solid #d1d5db;
    font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.3px;
  }
  .location .loc-key { font-size: 4.5pt; font-weight: 400; color: #6b7280; }
</style>
</head>
<body>
  <div class="grid">${cells}</div>
  <script>window.onload = () => { setTimeout(() => window.print(), 300); }<\/script>
</body></html>`);
  w.document.close();
}

// Pure canvas container — renders hidden QR canvases so SkuTable can call
// printItems() with any subset without needing its own canvas elements.
export const QrSheet = forwardRef<QrSheetHandle, Props>(({ items }, ref) => {
  const qrRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const setRef = (id: string) => (el: HTMLCanvasElement | null) => {
    if (el) qrRefs.current.set(id, el);
    else qrRefs.current.delete(id);
  };

  useImperativeHandle(ref, () => ({
    printItems(itemsToPrint: Sku[]) {
      buildPrintWindow(itemsToPrint, qrRefs.current);
    },
  }));

  return (
    <div className="hidden" aria-hidden="true">
      {items.map((s) => (
        <QRCodeCanvas
          key={s.id}
          ref={setRef(s.id!)}
          value={`${window.location.origin}/scan?sku=${encodeURIComponent(s.sku_code)}`}
          size={264}
          level="H"
        />
      ))}
    </div>
  );
});

QrSheet.displayName = "QrSheet";
