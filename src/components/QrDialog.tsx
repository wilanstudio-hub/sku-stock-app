import { useRef } from "react";
import { useLang } from "@/hooks/useLang";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import type { Sku } from "./SkuDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sku: Sku | null;
}

const DEPT_LABEL: Record<string, string> = { art: "Art", wd: "WD", equipment: "Equipment" };

function clamp(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export const QrDialog = ({ open, onOpenChange, sku }: Props) => {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useLang();

  if (!sku) return null;

  // Encode the scan-page URL so any camera app opens the product page directly.
  const payload = `${window.location.origin}/scan?sku=${encodeURIComponent(sku.sku_code)}`;

  const deptText = `${DEPT_LABEL[sku.department] ?? sku.department}${sku.category ? " · " + sku.category : ""}`;

  const savePng = async () => {
    const qrEl = qrCanvasRef.current;
    if (!qrEl) return;

    await document.fonts.ready;

    const locationText = sku.location ?? null;
    const QR = 240, PAD = 22, W = QR + PAD * 2;
    const H = PAD + 14 + 10 + QR + 12 + 20 + 18 + 16 + 15 + 14 + (locationText ? 13 : 0) + PAD;
    const SCALE = 3;

    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // outer border
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, W - 6, H - 6);

    // header label
    ctx.fillStyle = "#9ca3af";
    ctx.font = "700 8px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("SKU  STOCK", W / 2, PAD);

    // divider below header
    let y = PAD + 6;
    ctx.strokeStyle = "#f3f4f6";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();

    // QR code image
    y += 10;
    ctx.drawImage(qrEl, PAD, y, QR, QR);
    y += QR + 12;

    // divider above text
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 16;

    // SKU code
    ctx.fillStyle = "#111827";
    ctx.font = "700 14px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(sku.sku_code, W / 2, y);
    y += 18;

    // name TH
    ctx.fillStyle = "#1f2937";
    ctx.font = "12px 'Sarabun', sans-serif";
    ctx.fillText(clamp(sku.name_th, 30), W / 2, y);
    y += 16;

    // name EN
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px sans-serif";
    ctx.fillText(clamp(sku.name_en, 36), W / 2, y);
    y += 15;

    // dept · category
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px sans-serif";
    ctx.fillText(clamp(deptText, 42), W / 2, y);

    // storage location
    if (locationText) {
      y += 13;
      ctx.fillStyle = "#b0b7c3";
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillText("LOC  " + clamp(locationText, 38), W / 2, y);
    }

    canvas.toBlob((blob) => {
      if (!blob) { toast.error(t.labelSaveFailed); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sku.sku_code}-label.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.labelSaved);
    }, "image/png");
  };

  const printLabel = () => {
    const qrEl = qrCanvasRef.current;
    if (!qrEl) return;
    const qrDataUrl = qrEl.toDataURL("image/png");

    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${sku.sku_code}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&family=IBM+Plex+Mono:wght@400;700&display=swap');
  @page { size: 62mm 90mm; margin: 0; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Sarabun', sans-serif;
    background: #fff;
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh;
  }
  .label {
    width: 54mm; padding: 4mm;
    border: 0.5pt solid #d1d5db; border-radius: 2mm;
    text-align: center;
  }
  .header {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 5.5pt; font-weight: 700;
    letter-spacing: 2px; color: #9ca3af;
    text-transform: uppercase; margin-bottom: 2mm;
  }
  hr { border: none; border-top: 0.3pt solid #e5e7eb; margin: 2mm 0; }
  .qr { display: block; width: 42mm; height: 42mm; margin: 0 auto; }
  .sku {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9.5pt; font-weight: 700; color: #111827;
    margin: 1.5mm 0 0.5mm; letter-spacing: 0.5px;
  }
  .name-th { font-size: 8pt; color: #1f2937; line-height: 1.3; }
  .name-en  { font-size: 6.5pt; color: #6b7280; margin-top: 0.5mm; line-height: 1.3; }
  .location {
    font-size: 7.5pt; color: #111827; font-weight: 700;
    margin-top: 2mm; padding-top: 1.5mm;
    border-top: 0.3pt solid #d1d5db;
    font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.5px;
  }
  .location .loc-key { font-size: 5pt; font-weight: 400; color: #6b7280; }
  .dept     { font-size: 6pt; color: #9ca3af; margin-top: 1mm; }
  @media screen {
    body { background: #f9fafb; }
    .label { box-shadow: 0 4px 16px rgba(0,0,0,.08); }
  }
</style></head>
<body>
  <div class="label">
    <div class="header">SKU &nbsp; STOCK</div>
    <hr>
    <img class="qr" src="${qrDataUrl}" alt="QR Code">
    <hr>
    <div class="sku">${sku.sku_code}</div>
    <div class="name-th">${sku.name_th}</div>
    <div class="name-en">${sku.name_en}</div>
    ${sku.location ? `<div class="location"><span class="loc-key">LOC &nbsp;</span>${sku.location}</div>` : ""}
    <div class="dept">${deptText}</div>
  </div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }<\/script>
</body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{sku.sku_code}</DialogTitle>
        </DialogHeader>

        {/* Label preview */}
        <div className="flex flex-col items-center gap-4 py-1">
          <div className="border border-border rounded-xl px-5 py-4 w-full text-center shadow-sm bg-white">
            <p className="text-[9px] font-mono tracking-[3px] text-muted-foreground uppercase mb-2.5">
              SKU &nbsp; STOCK
            </p>
            <div className="h-px bg-muted mb-3.5" />
            <div className="flex justify-center">
              <QRCodeSVG value={payload} size={188} level="H" />
            </div>
            <div className="h-px bg-muted mt-3.5 mb-3" />
            <p className="font-mono font-bold text-sm tracking-wide text-foreground">
              {sku.sku_code}
            </p>
            <p className="text-[12px] font-th text-foreground/80 mt-1 leading-snug">
              {sku.name_th}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {sku.name_en}
            </p>
            {sku.location && (
              <p className="font-mono text-[11px] font-bold text-foreground mt-2 pt-2 border-t border-border leading-snug print:text-black print:font-bold">
                <span className="text-[9px] font-normal text-muted-foreground mr-1 print:text-black">LOC</span>
                {sku.location}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">
              {deptText}
            </p>
          </div>

          {/* Hidden high-res canvas used for save + print data URL */}
          <QRCodeCanvas
            ref={qrCanvasRef}
            value={payload}
            size={480}
            level="H"
            className="hidden"
          />

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 gap-2" onClick={savePng}>
              <Download className="w-4 h-4" /> Save PNG
            </Button>
            <Button className="flex-1 gap-2" onClick={printLabel}>
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
