import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import sarabunRegular from "@/assets/fonts/Sarabun-Regular.ttf?url";
import sarabunBold from "@/assets/fonts/Sarabun-Bold.ttf?url";
import { translations, type Lang } from "@/lib/i18n";

let fontsLoaded = false;
let regularB64: string | null = null;
let boldB64: string | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}

async function ensureFonts() {
  if (fontsLoaded) return;
  [regularB64, boldB64] = await Promise.all([
    fetchAsBase64(sarabunRegular),
    fetchAsBase64(sarabunBold),
  ]);
  fontsLoaded = true;
}

export interface SkuRowForPdf {
  sku_code: string;
  name_th: string;
  category?: string | null;
  location?: string | null;
  quantity: number;
  unit?: string | null;
  availability: "available" | "unavailable" | "on_event";
  image_url?: string | null;
}

const statusLabel = (a: SkuRowForPdf["availability"], lang: Lang) => {
  const t = translations[lang];
  return a === "unavailable" ? t.pdfUnavailable : a === "on_event" ? t.pdfOnEvent : t.pdfAvailable;
};

async function loadImageAsResizedDataUrl(url: string, size = 120): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmpUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = bmpUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // Fit cover-style: scale to fill, center crop
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      return canvas.toDataURL("image/jpeg", 0.75);
    } finally {
      URL.revokeObjectURL(bmpUrl);
    }
  } catch {
    return null;
  }
}

export async function exportSkusToPdf(
  rows: SkuRowForPdf[],
  department: "art" | "wd" | "equipment",
  options: { print?: boolean; lang?: Lang } = {}
) {
  const lang: Lang = options.lang ?? "th";
  const t = translations[lang];
  await ensureFonts();

  // Pre-load images in parallel
  const imageDataUrls = await Promise.all(
    rows.map((r) => (r.image_url ? loadImageAsResizedDataUrl(r.image_url) : Promise.resolve(null)))
  );

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  if (regularB64 && boldB64) {
    doc.addFileToVFS("Sarabun-Regular.ttf", regularB64);
    doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
    doc.addFileToVFS("Sarabun-Bold.ttf", boldB64);
    doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
    doc.setFont("Sarabun", "normal");
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const fileDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

  // Header
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(16);
  doc.text(t.pdfTitle(department.toUpperCase()), 40, 40);
  doc.setFont("Sarabun", "normal");
  doc.setFontSize(10);
  doc.text(t.pdfMeta(rows.length, dateStr), 40, 58);

  autoTable(doc, {
    startY: 75,
    head: [t.pdfColumns],
    body: rows.map((r) => [
      "",
      r.sku_code,
      r.name_th,
      r.category ?? "—",
      r.location ?? "—",
      `${r.quantity.toLocaleString()}${r.unit ? " " + r.unit : ""}`,
      statusLabel(r.availability, lang),
    ]),
    styles: { font: "Sarabun", fontSize: 9, cellPadding: 4, minCellHeight: 50, valign: "middle" },
    headStyles: {
      font: "Sarabun",
      fontStyle: "bold",
      fillColor: [40, 40, 40],
      textColor: 255,
      minCellHeight: 18,
    },
    columnStyles: {
      0: { cellWidth: 50, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 75 },
      4: { cellWidth: 60 },
      5: { cellWidth: 50, halign: "right" },
      6: { cellWidth: 50 },
    },
    margin: { left: 40, right: 40 },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const dataUrl = imageDataUrls[data.row.index];
        if (dataUrl) {
          const size = 46;
          const x = data.cell.x + (data.cell.width - size) / 2;
          const y = data.cell.y + (data.cell.height - size) / 2;
          try {
            doc.addImage(dataUrl, "JPEG", x, y, size, size);
          } catch {
            // ignore broken image
          }
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageNum = data.pageNumber;
      doc.setFont("Sarabun", "normal");
      doc.setFontSize(8);
      doc.text(
        t.pdfPage(pageNum, pageCount),
        doc.internal.pageSize.getWidth() - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" }
      );
    },
  });

  const filename = `SKU_${department}_${fileDate}.pdf`;
  if (options.print) {
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  } else {
    doc.save(filename);
  }
}
