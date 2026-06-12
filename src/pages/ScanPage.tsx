import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import type { Sku, SkuTransaction } from "@/components/SkuDialog";
import { Package, LogOut, LogIn } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPT_LABEL: Record<string, string> = {
  art: "Art",
  wd: "WD",
  equipment: "Equipment",
};

const AVAIL_CONFIG = {
  available:   { label: "ว่าง",    bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  on_event:    { label: "ติดงาน",  bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500"   },
  unavailable: { label: "ไม่ว่าง", bg: "bg-red-50",      text: "text-red-700",     dot: "bg-red-500"     },
};

const STATUS_CONFIG = {
  available: { label: "พร้อมใช้งาน", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  check_out: { label: "ถูกเบิกออก",  bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  },
};

const ACTION_BADGE = {
  check_out: { label: "📤 เบิกออก", bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200"     },
  check_in:  { label: "📥 นำคืน",  bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh   = String(d.getHours()).padStart(2, "0");
  const min  = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} - ${hh}:${min} น.`;
}

// ── Component ─────────────────────────────────────────────────────────────────

type TxFilter = "all" | "check_out" | "check_in";

export default function ScanPage() {
  const [params] = useSearchParams();
  const skuCode = params.get("sku") ?? "";

  const [sku, setSku]               = useState<Sku | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [transactions, setTransactions]   = useState<SkuTransaction[]>([]);
  const [txLoading, setTxLoading]         = useState(false);
  const [txFilter, setTxFilter]           = useState<TxFilter>("all");

  const [sheetOpen, setSheetOpen]         = useState(false);
  const [personName, setPersonName]       = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchData = () => {
    if (!skuCode) {
      setError("ไม่พบรหัสสินค้าใน URL");
      setLoading(false);
      return;
    }

    setLoading(true);
    setTxLoading(true);

    supabase
      .from("skus")
      .select("*")
      .eq("sku_code", skuCode)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        if (!data) { setError(`ไม่พบสินค้ารหัส "${skuCode}"`); return; }
        setSku(data as Sku);
      })
      .finally(() => setLoading(false));

    supabase
      .from("sku_transactions")
      .select("*")
      .eq("sku_code", skuCode)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setTransactions((data ?? []) as SkuTransaction[]))
      .finally(() => setTxLoading(false));
  };

  useEffect(() => { fetchData(); }, [skuCode]);

  useEffect(() => {
    if (sheetOpen) {
      setPersonName("");
      setSubmitError(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [sheetOpen]);

  const currentStatus = sku?.current_status ?? "available";
  const isCheckedOut  = currentStatus === "check_out";
  const actionType: SkuTransaction["action_type"] = isCheckedOut ? "check_in" : "check_out";
  const nextStatus: Sku["current_status"]         = isCheckedOut ? "available" : "check_out";
  const actionLabel = isCheckedOut ? "นำคืน" : "เบิกออก";

  const filteredTx = txFilter === "all"
    ? transactions
    : transactions.filter(t => t.action_type === txFilter);

  const handleSubmit = async () => {
    if (!sku || !personName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    const [txResult, skuResult] = await Promise.all([
      supabase.from("sku_transactions").insert({
        sku_code:    sku.sku_code,
        department:  sku.department,
        action_type: actionType,
        person_name: personName.trim(),
      }),
      supabase
        .from("skus")
        .update({ current_status: nextStatus, last_handler: personName.trim() })
        .eq("sku_code", sku.sku_code),
    ]);

    if (txResult.error || skuResult.error) {
      setSubmitError((txResult.error ?? skuResult.error)!.message);
      setSubmitting(false);
      return;
    }

    setSheetOpen(false);
    setSubmitting(false);
    fetchData();
  };

  const pageUrl = `${window.location.origin}/scan?sku=${encodeURIComponent(skuCode)}`;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <p className="text-sm font-mono">กำลังโหลด…</p>
        </div>
      </div>
    );
  }

  // ── Error / Not Found ──────────────────────────────────────────────────────
  if (error || !sku) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 w-full max-w-xs text-center flex flex-col items-center gap-4">
          <Package className="w-12 h-12 text-gray-300" />
          <p className="text-sm text-gray-500 font-th">{error ?? "ไม่พบสินค้า"}</p>
          {skuCode && (
            <p className="font-mono text-xs text-gray-400 bg-gray-50 rounded px-3 py-1">{skuCode}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const dept         = DEPT_LABEL[sku.department] ?? sku.department.toUpperCase();
  const categoryLine = [dept, sku.category].filter(Boolean).join(" · ");
  const avail        = AVAIL_CONFIG[sku.availability] ?? AVAIL_CONFIG.available;
  const statusCfg    = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.available;
  const coverImage   = (sku.image_urls ?? []).filter(Boolean)[0] ?? sku.image_url ?? null;
  const footerParts  = [
    `LOC  ${sku.location ? clip(sku.location, 18) : "—"}`,
    `BOX  ${sku.notes_th ? clip(sku.notes_th, 22) : "—"}`,
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8 pb-32 gap-4">

        {/* ── Item card ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md w-full max-w-xs flex flex-col select-none overflow-hidden">

          <div className="flex justify-between items-center px-5 pt-5 pb-3 font-mono text-[11px] tracking-[0.2em] uppercase text-gray-400">
            <span>SKU</span>
            <span>STOCK</span>
          </div>

          <hr className="border-gray-100 mx-5" />

          {coverImage && (
            <div className="flex justify-center px-5 pt-4">
              <img
                src={coverImage}
                alt={sku.name_th}
                className="w-full max-h-52 object-contain rounded-xl border border-gray-100"
                loading="lazy"
              />
            </div>
          )}

          <div className="flex justify-center px-5 py-4">
            <QRCodeSVG value={pageUrl} size={180} marginSize={1} className="rounded" />
          </div>

          <hr className="border-gray-100 mx-5" />

          <p className="font-mono font-bold text-sm tracking-wide text-gray-900 text-center px-5 pt-4">
            {sku.sku_code}
          </p>

          <div className="text-center px-5 pt-1 space-y-0.5">
            <p className="text-lg font-semibold leading-snug text-gray-800 font-th">{sku.name_th}</p>
            {sku.name_en && sku.name_en !== sku.name_th && (
              <p className="text-sm leading-snug text-gray-500 font-th">{sku.name_en}</p>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center px-5 pt-1 font-th">{categoryLine || "—"}</p>

          <div className="flex items-center justify-center gap-3 px-5 pt-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${avail.bg} ${avail.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${avail.dot}`} />
              {avail.label}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {sku.quantity} {sku.unit ?? "ชิ้น"}
            </span>
          </div>

          <hr className="border-gray-100 mx-5 mt-4" />

          <div className={`mx-5 my-4 rounded-xl border px-4 py-3 ${statusCfg.bg} ${statusCfg.border}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold font-th ${statusCfg.text}`}>
                {statusCfg.label}
              </span>
              {isCheckedOut && sku.last_handler && (
                <span className="text-xs text-orange-600 font-th">โดย {sku.last_handler}</span>
              )}
            </div>
          </div>

          <p className="font-mono text-[10px] text-gray-400 truncate px-5 pb-4">
            {footerParts.join("   ")}
          </p>
        </div>

        {/* ── Transaction history ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md w-full max-w-xs overflow-hidden">

          {/* Header + filter */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider font-th">
              ประวัติการเบิก-คืน
            </p>
            <Select value={txFilter} onValueChange={v => setTxFilter(v as TxFilter)}>
              <SelectTrigger className="h-7 text-xs w-auto min-w-[130px] border-gray-200 font-th">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-th">ทั้งหมด</SelectItem>
                <SelectItem value="check_out" className="text-xs font-th">📤 Check Out เท่านั้น</SelectItem>
                <SelectItem value="check_in"  className="text-xs font-th">📥 Check In เท่านั้น</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <hr className="border-gray-100" />

          {/* Rows */}
          {txLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            </div>
          ) : filteredTx.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8 font-th">ไม่มีประวัติ</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredTx.map(tx => {
                const badge = ACTION_BADGE[tx.action_type] ?? ACTION_BADGE.check_out;
                return (
                  <div key={tx.id} className="flex items-start gap-3 px-4 py-3">
                    {/* Action badge */}
                    <span className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium font-th ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badge.label}
                    </span>
                    {/* Name + date */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate font-th">
                        {tx.person_name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Sticky action button ─────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <button
          onClick={() => setSheetOpen(true)}
          className={`w-full max-w-xs mx-auto flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm font-th transition-opacity active:opacity-70 ${
            isCheckedOut ? "bg-emerald-600 text-white" : "bg-gray-900 text-white"
          }`}
        >
          {isCheckedOut
            ? <><LogIn  className="w-4 h-4" /> นำคืน</>
            : <><LogOut className="w-4 h-4" /> เบิกออก</>
          }
        </button>
      </div>

      {/* ── Action sheet ─────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-th text-base">
              {actionLabel} — {sku.sku_code}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-gray-600 font-th">ชื่อผู้ดำเนินการ</label>
              <Input
                ref={inputRef}
                placeholder="กรอกชื่อ-นามสกุล"
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                className="font-th"
              />
            </div>

            {submitError && (
              <p className="text-xs text-red-500 font-th">{submitError}</p>
            )}

            <Button
              className="w-full font-th"
              disabled={!personName.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "กำลังบันทึก…" : `ยืนยัน${actionLabel}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
