import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SkuTransaction } from "@/components/SkuDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { isDemoMode } from "@/lib/demo/mode";
import { demoTransactions } from "@/lib/demo/catalog";
import { displayPlain, formatStamp } from "@/lib/uiText";

// ── Module-level cache (5-minute TTL) ─────────────────────────────────────────
const TX_CACHE_TTL = 5 * 60 * 1000;
let txCache: { rows: SkuTransaction[]; ts: number } | null = null;

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_STYLE = {
  check_out: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200"     },
  check_in:  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

const DEPT_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  art:       { label: "Art",       bg: "bg-violet-50", text: "text-violet-700" },
  wd:        { label: "WD",        bg: "bg-blue-50",   text: "text-blue-700"   },
  equipment: { label: "Equipment", bg: "bg-amber-50",  text: "text-amber-700"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionFilter = "all" | "check_out" | "check_in";
type DeptFilter   = "all" | "art" | "wd" | "equipment";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDept?: DeptFilter;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TransactionHistoryDialog = ({ open, onOpenChange, defaultDept = "all" }: Props) => {
  const { t, lang } = useLang();
  const [rows, setRows]           = useState<SkuTransaction[]>([]);
  const [loading, setLoading]     = useState(false);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [deptFilter, setDeptFilter]     = useState<DeptFilter>(defaultDept);

  useEffect(() => {
    if (open) setDeptFilter(defaultDept);
  }, [open, defaultDept]);

  useEffect(() => {
    if (!open) return;
    if (isDemoMode()) {
      setRows(demoTransactions(lang));
      setLoading(false);
      return;
    }
    const now = Date.now();
    if (txCache && now - txCache.ts < TX_CACHE_TTL) {
      setRows(txCache.rows);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("sku_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        const fetched = (data ?? []) as SkuTransaction[];
        txCache = { rows: fetched, ts: Date.now() };
        if (!cancelled) setRows(fetched);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, lang]);

  const filtered = rows.filter(r => {
    if (actionFilter !== "all" && r.action_type !== actionFilter) return false;
    if (deptFilter   !== "all" && r.department   !== deptFilter)   return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            {t.historyDialogTitle}
          </DialogTitle>
          <DialogDescription className="font-th">
            {t.historyDialogDesc}
          </DialogDescription>
        </DialogHeader>

        {/* ── Filters ─────────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          <Select value={actionFilter} onValueChange={v => setActionFilter(v as ActionFilter)}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[155px] font-th">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"       className="text-xs font-th">{t.filterAll}</SelectItem>
              <SelectItem value="check_out" className="text-xs font-th">{t.filterCheckOutOnly}</SelectItem>
              <SelectItem value="check_in"  className="text-xs font-th">{t.filterCheckInOnly}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={deptFilter} onValueChange={v => setDeptFilter(v as DeptFilter)}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[130px] font-th">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"       className="text-xs font-th">{t.filterAllDepts}</SelectItem>
              <SelectItem value="art"       className="text-xs font-th">{t.deptArt}</SelectItem>
              <SelectItem value="wd"        className="text-xs font-th">{t.deptWd}</SelectItem>
              <SelectItem value="equipment" className="text-xs font-th">{t.deptEquipment}</SelectItem>
            </SelectContent>
          </Select>

          <span className="ml-auto self-center text-xs text-muted-foreground font-mono tabular-nums">
            {t.historyCount(filtered.length)}
          </span>
        </div>

        {/* ── Table header ────────────────────────────────────────── */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 px-3 pb-1 border-b">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-th">{t.colAction}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-th">{t.colSkuOperator}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-th">{t.colDept}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-th text-right">{t.colDateTime}</span>
        </div>

        {/* ── Rows ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground font-th">{t.noHistory}</div>
        ) : (
          <ScrollArea className="max-h-[52vh] pr-1">
            <div className="divide-y divide-border/50">
              {filtered.map(tx => {
                const badge = ACTION_STYLE[tx.action_type] ?? ACTION_STYLE.check_out;
                const badgeLabel = tx.action_type === "check_in" ? t.actionCheckIn : t.actionCheckOut;
                const dept  = DEPT_BADGE[tx.department]   ?? { label: tx.department, bg: "bg-gray-50", text: "text-gray-600" };
                return (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center px-3 py-2.5 hover:bg-accent/30 transition-colors"
                  >
                    {/* Action badge */}
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium font-th whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badgeLabel}
                    </span>

                    {/* SKU + person */}
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-foreground truncate">
                        {tx.sku_code}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-th truncate">
                        {displayPlain(tx.person_name, lang) || tx.person_name}
                      </p>
                    </div>

                    {/* Department badge */}
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium font-th whitespace-nowrap ${dept.bg} ${dept.text}`}>
                      {dept.label}
                    </span>

                    {/* Date */}
                    <p className="text-[10px] text-muted-foreground font-mono whitespace-nowrap text-right">
                      {formatStamp(tx.created_at, lang)}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
