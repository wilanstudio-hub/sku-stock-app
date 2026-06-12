import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";
import { useLang } from "@/hooks/useLang";

export interface DryRunResult {
  inserted: number;
  updated: number;
  perTab: Record<string, { inserted: number; updated: number }>;
  errors: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  result: DryRunResult | null;
  loading?: boolean;
  onConfirm?: () => void;
}

export const DryRunDialog = ({ open, onOpenChange, result, loading, onConfirm }: Props) => {
  const { t } = useLang();
  const entries = Object.entries(result?.perTab ?? {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            {t.dryRunTitle}
          </DialogTitle>
          <DialogDescription>{t.dryRunDesc}</DialogDescription>
        </DialogHeader>

        {loading || !result ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{t.dryRunRunning}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-mono text-sm">{t.dryRunNew(result.inserted)}</Badge>
              <Badge variant="secondary" className="font-mono text-sm">{t.dryRunUpdate(result.updated)}</Badge>
              {result.errors?.length > 0 && (
                <Badge variant="destructive" className="font-mono text-sm">{result.errors.length} errors</Badge>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-2">{t.dryRunPerCategory}</div>
              <ScrollArea className="max-h-72 rounded-md border">
                <div className="p-2 space-y-1">
                  {entries.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">{t.dryRunNoChanges}</div>
                  ) : entries.map(([tab, v]) => (
                    <div key={tab} className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-accent/50">
                      <span className="truncate font-medium">{tab}</span>
                      <span className="font-mono text-xs text-muted-foreground shrink-0 ml-2">
                        +{v.inserted} / ~{v.updated}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {result.errors?.length > 0 && (
              <div>
                <div className="text-xs text-destructive mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Errors
                </div>
                <ScrollArea className="max-h-32 rounded-md border border-destructive/30 bg-destructive/5">
                  <div className="p-2 space-y-1">
                    {result.errors.map((e, i) => (
                      <div key={i} className="text-xs font-mono text-destructive">{e}</div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.close}</Button>
          {onConfirm && (
            <Button onClick={onConfirm} disabled={loading || !result}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {t.runRealSync}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
