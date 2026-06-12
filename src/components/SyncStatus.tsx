import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/hooks/useLang";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, RefreshCw } from "lucide-react";

interface SyncLog {
  id: string;
  department: string;
  inserted: number;
  updated: number;
  per_category: Record<string, { inserted: number; updated: number }>;
  errors: string[];
  created_at: string;
}

interface Props {
  department: "art" | "wd" | "equipment";
  refreshKey?: number;
  compact?: boolean;
}

export const SyncStatus = ({ department, refreshKey, compact }: Props) => {
  const { t, lang } = useLang();
  const [log, setLog] = useState<SyncLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("department", department)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) { setLog((data as any) ?? null); setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [department, refreshKey]);

  const timeAgo = (iso: string) => {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const m = Math.floor(diff / 60000);
    if (m < 1) return t.justNow;
    if (m < 60) return t.minutesAgo(m);
    const h = Math.floor(m / 60);
    if (h < 24) return t.hoursAgo(h);
    return t.daysAgo(Math.floor(h / 24));
  };

  if (department === "wd" || loading) return null;

  if (!log) {
    return (
      <Card className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <History className="w-3.5 h-3.5" />
        {t.neverSynced}
      </Card>
    );
  }

  const entries = Object.entries(log.per_category ?? {}).filter(
    ([, v]: any) => (v?.inserted ?? 0) > 0 || (v?.updated ?? 0) > 0,
  );
  const dateStr = new Date(log.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-GB", {
    dateStyle: "short", timeStyle: "short",
  });

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw className="w-3.5 h-3.5 text-primary" />
          {t.lastSync}
        </div>
        <div className="text-xs text-muted-foreground">
          {timeAgo(log.created_at)} · {dateStr}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap text-xs">
        <Badge variant="secondary" className="font-mono">+{log.inserted} {t.newBadge}</Badge>
        <Badge variant="secondary" className="font-mono">~{log.updated} {t.updatedBadge}</Badge>
        {log.errors?.length > 0 && (
          <Badge variant="destructive" className="font-mono">{log.errors.length} errors</Badge>
        )}
      </div>
      {!compact && entries.length > 0 && (
        <div className="pt-1 border-t">
          <div className="text-[11px] text-muted-foreground mb-1">{t.categoriesChanged}</div>
          <div className="flex flex-wrap gap-1.5">
            {entries.map(([cat, v]: any) => (
              <span key={cat} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/60 border"
                title={`+${v.inserted} ${t.newBadge} / ~${v.updated} ${t.updatedBadge}`}>
                {cat} <span className="text-muted-foreground">+{v.inserted}/~{v.updated}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
