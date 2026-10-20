import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import type { Sku, SkuTransaction } from "@/components/SkuDialog";
import { Package, LogOut, LogIn } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/AppLogo";
import { useTenant } from "@/contexts/TenantContext";
import { useLang } from "@/hooks/useLang";
import { isDemoMode } from "@/lib/demo/mode";
import { demoCheck, demoSkuByCode, demoTransactions } from "@/lib/demo/catalog";
import { displayItemName, displayItemSubtitle, displayPlain, displayUnit, formatStamp } from "@/lib/uiText";
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

const AVAIL_STYLE = {
  available:   { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  on_event:    { bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500"   },
  unavailable: { bg: "bg-red-50",      text: "text-red-700",     dot: "bg-red-500"     },
};

const STATUS_STYLE = {
  available: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  check_out: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  },
};

const ACTION_STYLE = {
  check_out: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200"     },
  check_in:  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ── Component ─────────────────────────────────────────────────────────────────

type TxFilter = "all" | "check_out" | "check_in";

export default function ScanPage() {
  const [params] = useSearchParams();
  const skuCode = params.get("sku") ?? "";
  const { tenant } = useTenant();
  const { t, lang } = useLang();

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

  const fetchData = async () => {
    if (!skuCode) {
      setError(t.scanMissingCode);
      setLoading(false);
      return;
    }

    setLoading(true);
    setTxLoading(true);

    if (isDemoMode()) {
      const found = demoSkuByCode(skuCode, lang);
      setSku(found);
      setError(found ? null : t.scanMissingItem(skuCode));
      setTransactions(demoTransactions(lang).filter((tx) => tx.sku_code === skuCode));
      setLoading(false);
      setTxLoading(false);
      return;
    }

    try {
      let skuQuery = supabase.from("skus").select("*").eq("sku_code", skuCode);
      if (tenant?.id) {
        skuQuery = skuQuery.eq("company_id", tenant.id);
      }

      let txQuery = supabase
        .from("sku_transactions")
        .select("*")
        .eq("sku_code", skuCode)
        .order("created_at", { ascending: false })
        .limit(50);
      if (tenant?.id) {
        txQuery = txQuery.eq("company_id", tenant.id);
      }

      const [{ data, error: e }, { data: txData }] = await Promise.all([
        skuQuery.maybeSingle(),
        txQuery,
      ]);

      if (e) {
        setError(e.message);
      } else if (!data) {
        setError(t.scanMissingItem(skuCode));
      } else {
        setSku(data as Sku);
      }
      setTransactions((txData ?? []) as SkuTransaction[]);
    } catch (err: any) {
      setError(err?.message ?? t.scanLoadError);
    } finally {
      setLoading(false);
      setTxLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [skuCode, lang]);

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
  const actionLabel = isCheckedOut ? t.scanCheckIn : t.scanCheckOut;

  const filteredTx = txFilter === "all"
    ? transactions
    : transactions.filter(t => t.action_type === txFilter);

  const handleSubmit = async () => {
    if (!sku || !personName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    if (isDemoMode()) {
      demoCheck(sku.sku_code, actionType, personName.trim(), lang);
      setSheetOpen(false);
      setSubmitting(false);
      fetchData();
      return;
    }

    const [txResult, skuResult] = await Promise.all([
      supabase.from("sku_transactions").insert({
        sku_code:    sku.sku_code,
        sku_id:      sku.id,
        company_id:  sku.company_id,
        department:  sku.department,
        action_type: actionType,
        person_name: personName.trim(),
      }),
      supabase
        .from("skus")
        .update({ current_status: nextStatus, last_handler: personName.trim() })
        .eq("id", sku.id),
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
          <p className="text-sm font-mono">{t.scanLoading}</p>
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
          <p className="text-sm text-gray-500 font-th">{error ?? t.scanNotFound}</p>
          {skuCode && (
            <p className="font-mono text-xs text-gray-400 bg-gray-50 rounded px-3 py-1">{skuCode}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const itemName = displayItemName(sku, lang);
  const itemSubtitle = displayItemSubtitle(sku, lang);
  const locationText = displayPlain(sku.location, lang);
  const notesText = displayPlain(lang === "en" ? (sku.notes_en || sku.notes_th) : sku.notes_th, lang);
  const dept         = DEPT_LABEL[sku.department] ?? sku.department.toUpperCase();
  const categoryText = displayPlain(sku.category, lang);
  const categoryLine = [dept, categoryText].filter(Boolean).join(" · ");
  const availStyle   = AVAIL_STYLE[sku.availability] ?? AVAIL_STYLE.available;
  const availLabel   = sku.availability === "on_event" ? t.availOnEvent : sku.availability === "unavailable" ? t.availUnavailable : t.availAvailable;
  const statusStyle  = STATUS_STYLE[currentStatus as keyof typeof STATUS_STYLE] ?? STATUS_STYLE.available;
  const statusLabel  = currentStatus === "check_out" ? t.statusCheckedOut : t.statusReady;
  const coverImage   = (sku.image_urls ?? []).filter(Boolean)[0] ?? sku.image_url ?? null;
  const footerParts  = [
    `LOC  ${locationText ? clip(locationText, 18) : "—"}`,
    `BOX  ${notesText ? clip(notesText, 22) : "—"}`,
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8 pb-32 gap-4">

        {/* ── Item card ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md w-full max-w-xs flex flex-col select-none overflow-hidden">

          <div className="flex justify-between items-center px-5 pt-5 pb-3 font-mono text-[11px] tracking-[0.1em] uppercase text-gray-400">
            <span className="flex items-center gap-1.5 font-bold text-gray-700">
              <AppLogo theme="light" variant="icon" className="h-4 w-4" />
              <span>{tenant?.name || "Ctrl+ Inventory"}</span>
            </span>
            <span>Ctrl+ Inventory</span>
          </div>

          <hr className="border-gray-100 mx-5" />

          {coverImage && (
            <div className="flex justify-center px-5 pt-4">
              <img
                src={coverImage}
                alt={itemName}
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
            <p className="text-lg font-semibold leading-snug text-gray-800 font-th">{itemName}</p>
            {itemSubtitle && (
              <p className="text-sm leading-snug text-gray-500 font-th">{itemSubtitle}</p>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center px-5 pt-1 font-th">{categoryLine || "—"}</p>

          <div className="flex items-center justify-center gap-3 px-5 pt-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${availStyle.bg} ${availStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${availStyle.dot}`} />
              {availLabel}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {sku.quantity} {displayUnit(sku.unit, lang)}
            </span>
          </div>

          <hr className="border-gray-100 mx-5 mt-4" />

          <div className={`mx-5 my-4 rounded-xl border px-4 py-3 ${statusStyle.bg} ${statusStyle.border}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold font-th ${statusStyle.text}`}>
                {statusLabel}
              </span>
              {isCheckedOut && displayPlain(sku.last_handler, lang) && (
                <span className="text-xs text-orange-600 font-th">{t.checkedOutBy(displayPlain(sku.last_handler, lang))}</span>
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
              {t.scanHistoryTitle}
            </p>
            <Select value={txFilter} onValueChange={v => setTxFilter(v as TxFilter)}>
              <SelectTrigger className="h-7 text-xs w-auto min-w-[130px] border-gray-200 font-th">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-th">{t.filterAll}</SelectItem>
                <SelectItem value="check_out" className="text-xs font-th">{t.filterCheckOutOnly}</SelectItem>
                <SelectItem value="check_in"  className="text-xs font-th">{t.filterCheckInOnly}</SelectItem>
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
            <p className="text-xs text-gray-400 text-center py-8 font-th">{t.noHistory}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredTx.map(tx => {
                const badge = ACTION_STYLE[tx.action_type] ?? ACTION_STYLE.check_out;
                const badgeLabel = tx.action_type === "check_in" ? t.actionCheckIn : t.actionCheckOut;
                return (
                  <div key={tx.id} className="flex items-start gap-3 px-4 py-3">
                    {/* Action badge */}
                    <span className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium font-th ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badgeLabel}
                    </span>
                    {/* Name + date */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate font-th">
                        {displayPlain(tx.person_name, lang) || tx.person_name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {formatStamp(tx.created_at, lang)}
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
            ? <><LogIn  className="w-4 h-4" /> {t.scanCheckIn}</>
            : <><LogOut className="w-4 h-4" /> {t.scanCheckOut}</>
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
              <label className="text-sm text-gray-600 font-th">{t.operatorName}</label>
              <Input
                ref={inputRef}
                placeholder={t.operatorPlaceholder}
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
              {submitting ? t.saving : t.confirmAction(actionLabel)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
