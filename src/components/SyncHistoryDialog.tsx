import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/hooks/useLang";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, History, AlertTriangle } from "lucide-react";

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
  open: boolean;
  onOpenChange: (o: boolean) => void;
  department: "art" | "wd" | "equipment";
}

export const SyncHistoryDialog = ({ open, onOpenChange, department }: Props) => {
  const { t, lang } = useLang();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("department", department)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) { setLogs((data as any) ?? []); setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [open, department]);

  const toggle = (id: string) => {
    const next = new Set(openRows);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpenRows(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            {t.syncHistoryTitle} — {department.toUpperCase()}
          </DialogTitle>
          <DialogDescription>{t.syncHistoryDesc}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t.loading}</div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t.noSyncHistory}</div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-2">
              {logs.map((log) => {
                const isOpen = openRows.has(log.id);
                const entries = Object.entries(log.per_category ?? {}).filter(
                  ([, v]: any) => (v?.inserted ?? 0) > 0 || (v?.updated ?? 0) > 0,
                );
                const dateStr = new Date(log.created_at).toLocaleString(
                  lang === "th" ? "th-TH" : "en-GB",
                  { dateStyle: "medium", timeStyle: "short" },
                );
                return (
                  <Card key={log.id} className="p-3">
                    <Collapsible open={isOpen} onOpenChange={() => toggle(log.id)}>
                      <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                          <span className="text-sm font-medium">{dateStr}</span>
                          <Badge variant="secondary" className="font-mono text-xs">+{log.inserted}</Badge>
                          <Badge variant="secondary" className="font-mono text-xs">~{log.updated}</Badge>
                          {log.errors?.length > 0 && (
                            <Badge variant="destructive" className="font-mono text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />{log.errors.length}
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3 space-y-2">
                        {entries.length > 0 && (
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">{t.categoriesSection}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {entries.map(([cat, v]: any) => (
                                <span key={cat} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/60 border">
                                  {cat} <span className="text-muted-foreground">+{v.inserted}/~{v.updated}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {log.errors?.length > 0 && (
                          <div>
                            <div className="text-[11px] text-destructive mb-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Errors
                            </div>
                            <div className="space-y-1 rounded border border-destructive/30 bg-destructive/5 p-2">
                              {log.errors.map((e, i) => (
                                <div key={i} className="text-[11px] font-mono text-destructive break-all">{e}</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {entries.length === 0 && log.errors.length === 0 && (
                          <div className="text-xs text-muted-foreground">{t.noChanges}</div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
