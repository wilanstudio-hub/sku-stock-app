import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Search, Trash2, Package, QrCode, RefreshCw, FileDown, Printer, FlaskConical, History, ClipboardList } from "lucide-react";
import { exportSkusToPdf } from "@/lib/pdfExport";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/hooks/useLang";
import { SkuDialog, Sku } from "./SkuDialog";
import { QrDialog } from "./QrDialog";
import { QrSheet, QrSheetHandle } from "./QrSheet";
import { SkuGalleryDialog } from "./SkuGalleryDialog";
import { SyncStatus } from "./SyncStatus";
import { DryRunDialog, DryRunResult } from "./DryRunDialog";
import { SyncHistoryDialog } from "./SyncHistoryDialog";
import { TransactionHistoryDialog } from "./TransactionHistoryDialog";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatDateTime(iso: string) {
  const d    = new Date(iso);
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh   = String(d.getHours()).padStart(2, "0");
  const min  = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} - ${hh}:${min} น.`;
}

const galleryImages = (i: Sku & { image_urls?: string[] | null }): string[] => {
  const arr = (i.image_urls ?? []).filter(Boolean) as string[];
  if (arr.length > 0) return arr;
  return i.image_url ? [i.image_url] : [];
};

interface Props {
  department: "art" | "wd" | "equipment";
}

export const SkuTable = ({ department }: Props) => {
  const { user, canEdit } = useAuth();
  const { t, lang } = useLang();
  const editable = canEdit(department);
  const nav = useNavigate();
  const [items, setItems] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sku | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [qrSku, setQrSku] = useState<Sku | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [gallery, setGallery] = useState<{ images: string[]; alt: string } | null>(null);
  const [syncRefresh, setSyncRefresh] = useState(0);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [txLogOpen, setTxLogOpen] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const qrSheetRef = useRef<QrSheetHandle>(null);

  const fnName = department === "art" ? "sync-art-sheets" : department === "equipment" ? "sync-equipment-sheet" : department === "wd" ? "sync-wd-sheets" : null;

  const runSync = async (dryRun: boolean) => {
    if (!editable) {
      toast.error(t.needPermission);
      return null;
    }
    if (!fnName) return null;
    const { data, error } = await supabase.functions.invoke(fnName, { body: { dryRun } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSync = async () => {
    setSyncing(true);
    const toastId = toast.loading(t.syncingMsg);
    try {
      const data = await runSync(false);
      if (!data) { toast.dismiss(toastId); return; }
      const tabs = data?.perTab ?? {};
      const detail = Object.entries(tabs)
        .map(([k, v]: [string, any]) => `${k}: +${v?.inserted ?? 0} / ~${v?.updated ?? 0}`)
        .join(", ");
      const ins = data?.inserted ?? 0;
      const upd = data?.updated ?? 0;
      toast.success(t.syncSuccess(ins, upd), { id: toastId, description: detail });
      if (data?.errors?.length) toast.error(data.errors.join("\n"));
      setSyncRefresh((n) => n + 1);
      load();
    } catch (e: any) {
      toast.error(t.syncFailed(e.message ?? e), { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleDryRun = async () => {
    if (!editable) {
      toast.error(t.needPermission);
      return;
    }
    setDryRunOpen(true);
    setDryRunLoading(true);
    setDryRunResult(null);
    try {
      const data = await runSync(true);
      setDryRunResult({
        inserted: data?.inserted ?? 0,
        updated: data?.updated ?? 0,
        perTab: data?.perTab ?? {},
        errors: data?.errors ?? [],
      });
    } catch (e: any) {
      toast.error(t.dryRunFailed(e.message ?? e));
      setDryRunOpen(false);
    } finally {
      setDryRunLoading(false);
    }
  };

  const handleConfirmFromDryRun = async () => {
    setDryRunOpen(false);
    await handleSync();
  };

  const handleAddClick = () => {
    if (!user) {
      toast.info(t.needSignIn);
      nav("/auth");
      return;
    }
    if (!editable) {
      toast.error(t.needDeptPermission(department));
      return;
    }
    setEditing(null);
    setOpen(true);
  };

  const load = async () => {
    setLoading(true);
    const all: Sku[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("skus")
        .select("*")
        .eq("department", department)
        .order("sku_code")
        .range(from, from + 999);
      if (error) { toast.error(error.message); break; }
      all.push(...(data ?? []) as Sku[]);
      if (!data || data.length < 1000) break;
    }
    setItems(all);
    setLoading(false);
  };

  useEffect(() => { setCategoryFilter("all"); load(); }, [department]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])).sort(),
    [items]
  );

  useEffect(() => {
    if (categoryFilter !== "all" && !categories.includes(categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categories]);

  const filtered = useMemo(() => {
    let r = items;
    if (categoryFilter !== "all") r = r.filter((i) => (i.category ?? "") === categoryFilter);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((i) =>
        i.sku_code.toLowerCase().includes(s) ||
        i.name_th.toLowerCase().includes(s) ||
        i.name_en.toLowerCase().includes(s) ||
        (i.category ?? "").toLowerCase().includes(s) ||
        (i.location ?? "").toLowerCase().includes(s)
      );
    }
    return r;
  }, [items, q, categoryFilter]);

  const totalQty = items.reduce((a, b) => a + b.quantity, 0);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("skus").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success(t.deleted); load(); }
    setDeleteId(null);
  };

  const handleExportPdf = async (print: boolean) => {
    const ids = selected;
    const rows = items.filter((i) => ids.has(i.id!));
    if (rows.length === 0) return;
    try {
      await exportSkusToPdf(
        rows.map((r) => ({
          sku_code: r.sku_code,
          name_th: r.name_th,
          category: r.category,
          location: r.location,
          quantity: r.quantity,
          unit: r.unit,
          availability: r.availability,
          image_url: (r.image_urls && r.image_urls.length > 0 ? r.image_urls[0] : r.image_url) ?? null,
        })),
        department,
        { print, lang }
      );
      toast.success(print ? t.pdfOpened : t.pdfDownloaded);
    } catch (e: any) {
      toast.error(t.exportFailed(e.message ?? e));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await supabase.from("skus").delete().in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(t.deletedN(ids.length)); setSelected(new Set()); load(); }
    setBulkDeleteOpen(false);
  };

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.id!)),
    [items, selected]
  );

  const handlePrintLabels = (itemsToPrint?: Sku[]) => {
    const dataToPrint = itemsToPrint && itemsToPrint.length > 0 ? itemsToPrint : filtered;
    if (dataToPrint.length === 0) return;
    qrSheetRef.current?.printItems(dataToPrint);
    if (itemsToPrint && itemsToPrint.length > 0) setSelected(new Set());
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id!));
  const someFilteredSelected = filtered.some((i) => selected.has(i.id!));

  const toggleAll = (checked: boolean) => {
    const next = new Set(selected);
    if (checked) filtered.forEach((i) => next.add(i.id!));
    else filtered.forEach((i) => next.delete(i.id!));
    setSelected(next);
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const accent = department === "art" ? "var(--gradient-art)" : department === "wd" ? "var(--gradient-wd)" : "var(--gradient-hero)";

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t.itemsLabel}</div>
          <div className="text-2xl font-bold">{items.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t.totalQtyLabel}</div>
          <div className="text-2xl font-bold">{totalQty.toLocaleString()}</div>
        </Card>
      </div>

      {(department === "art" || department === "equipment" || department === "wd") && (
        <SyncStatus department={department} refreshKey={syncRefresh} />
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder={t.categoryCol} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allCategories}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <QrSheet ref={qrSheetRef} items={filtered} />
        <Button variant="outline" onClick={() => handlePrintLabels()} disabled={filtered.length === 0} className="gap-1">
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">{t.printLabelsBtn}</span>
          <span>({filtered.length})</span>
        </Button>
        {(department === "art" || department === "equipment" || department === "wd") && (
          <Button onClick={() => setHistoryOpen(true)} variant="outline" className="gap-1" title={t.historyBtn}>
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">{t.historyBtn}</span>
          </Button>
        )}
        <Button onClick={() => setTxLogOpen(true)} variant="outline" className="gap-1" title="ประวัติการเบิก-คืน">
          <ClipboardList className="w-4 h-4" />
          <span className="hidden sm:inline font-th">History / Log</span>
        </Button>
        {(department === "art" || department === "equipment" || department === "wd") && editable && (
          <>
            <Button onClick={handleDryRun} disabled={syncing || dryRunLoading} variant="outline" className="gap-1" title={t.dryRunBtn}>
              <FlaskConical className={`w-4 h-4 ${dryRunLoading ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">{t.dryRunBtn}</span>
            </Button>
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-1">
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {t.syncSheetsBtn}
            </Button>
          </>
        )}
        <Button onClick={handleAddClick} style={{ background: accent }} className="text-primary-foreground border-0">
          <Plus className="w-4 h-4 mr-1" /> {t.addSkuBtn}
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-accent/40 flex-wrap">
          <div className="text-sm font-medium">
            {t.selectedCount(selected.size)}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              {t.clearSelection}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportPdf(false)}>
              <FileDown className="w-4 h-4 mr-1" /> {t.exportPdf}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportPdf(true)}>
              <Printer className="w-4 h-4 mr-1" /> {t.printPdf}
            </Button>
            <button
              onClick={() => handlePrintLabels(selectedItems)}
              className="flex items-center gap-2 px-3 py-1 bg-white border rounded"
            >
              <Printer className="w-4 h-4" /> พิมพ์
            </button>
            {editable && (
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-4 h-4 mr-1" /> {t.deleteSelected}
              </Button>
            )}
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(!!v)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-16">{t.imageCol}</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>{t.nameCol}</TableHead>
                <TableHead>{t.categoryCol}</TableHead>
                <TableHead>{t.locationCol}</TableHead>
                <TableHead className="text-right">{t.qtyCol}</TableHead>
                <TableHead>{t.statusCol}</TableHead>
                <TableHead className="min-w-[140px]">ผู้ดำเนินการ / วันเวลา</TableHead>
                <TableHead className="w-32 text-right">{t.actionsCol}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  {t.noItems}
                </TableCell></TableRow>
              ) : filtered.map((i) => {
                return (
                  <TableRow key={i.id} data-state={selected.has(i.id!) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(i.id!)}
                        onCheckedChange={(v) => toggleOne(i.id!, !!v)}
                        aria-label={`Select ${i.sku_code}`}
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const imgs = galleryImages(i);
                        const cover = imgs[0];
                        const imgFailed = imgErrors.has(cover ?? "");
                        return cover && !imgFailed ? (
                          <button
                            type="button"
                            onClick={() => setGallery({ images: imgs, alt: i.name_en })}
                            className="relative w-12 h-12 p-0 flex-shrink-0 rounded overflow-hidden border hover:ring-2 hover:ring-primary transition focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label={`ดูรูป / View images ${i.sku_code}`}
                          >
                            <img
                              src={cover}
                              alt={i.name_en}
                              className="w-12 h-12 object-cover"
                              loading="eager"
                              onError={() => setImgErrors((prev) => new Set(prev).add(cover))}
                            />
                            {imgs.length > 1 && (
                              <span className="absolute bottom-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold leading-none px-1 py-0.5 rounded-tl">
                                +{imgs.length - 1}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                            <Package className="w-5 h-5 text-muted-foreground opacity-50" />
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="font-mono font-medium">{i.sku_code}</TableCell>
                    <TableCell>
                      <div className="font-th font-medium">{i.name_th}</div>
                      <div className="text-xs text-muted-foreground">{i.name_en}</div>
                    </TableCell>
                    <TableCell className="text-sm">{i.category || "—"}</TableCell>
                    <TableCell className="text-sm">{i.location || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {i.quantity.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">{i.unit}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {i.current_status === "check_out" ? (
                          <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 font-th font-medium">📤 Check Out</Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-400 bg-emerald-50 text-emerald-800 font-th font-medium">🟢 In Stock</Badge>
                        )}
                        {i.availability === "unavailable" && (
                          <Badge variant="outline" className="border-destructive text-destructive text-[10px]">{t.unavailable}</Badge>
                        )}
                        {i.availability === "on_event" && (
                          <Badge className="bg-warning text-warning-foreground hover:bg-warning text-[10px]">{t.onEvent}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {i.current_status === "check_out" && i.last_handler ? (
                        <div>
                          <p className="text-sm font-semibold font-th leading-snug">{i.last_handler}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatDateTime(i.updated_at!)}</p>
                        </div>
                      ) : i.last_handler ? (
                        <div>
                          <p className="text-xs text-muted-foreground font-th leading-snug">คืนโดย: {i.last_handler}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatDateTime(i.updated_at!)}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setQrSku(i)} title="QR Code">
                          <QrCode className="w-4 h-4" />
                        </Button>
                        {editable && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(i.id!)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <SkuDialog open={open} onOpenChange={setOpen} department={department} initial={editing} onSaved={load} />
      <QrDialog open={!!qrSku} onOpenChange={(o) => !o && setQrSku(null)} sku={qrSku} />

      <SkuGalleryDialog
        open={!!gallery}
        onOpenChange={(o) => !o && setGallery(null)}
        images={gallery?.images ?? []}
        alt={gallery?.alt ?? "Image"}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteSkuTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteSkuDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteSelected_n(selected.size)}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteSkuDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">{t.deleteAll}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DryRunDialog
        open={dryRunOpen}
        onOpenChange={setDryRunOpen}
        result={dryRunResult}
        loading={dryRunLoading}
        onConfirm={editable ? handleConfirmFromDryRun : undefined}
      />

      <SyncHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        department={department}
      />

      <TransactionHistoryDialog
        open={txLogOpen}
        onOpenChange={setTxLogOpen}
        defaultDept={department}
      />
    </div>
  );
};
