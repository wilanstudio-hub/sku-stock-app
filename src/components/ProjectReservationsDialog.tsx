import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Film,
  Package,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCcw,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Box,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReservationItem {
  id: string;
  reservation_id: string;
  company_id: string;
  sku_id: string | null;
  sku_code: string;
  quantity: number;
  skus?: {
    name_th: string;
    name_en: string;
    category: string | null;
    department: string;
    location: string | null;
  } | null;
}

export interface Reservation {
  id: string;
  company_id: string;
  external_project_id: string;
  external_project_name: string;
  status: "reserved" | "checked_out" | "cancelled" | "returned";
  start_at: string;
  end_at: string;
  requested_by: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  items?: ReservationItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReservationsCountChange?: (activeCount: number) => void;
}

type StatusFilter = "all" | "reserved" | "checked_out" | "returned" | "cancelled";

const STATUS_CONFIG: Record<
  Reservation["status"],
  { label: string; labelEn: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  reserved: {
    label: "จองอุปกรณ์",
    labelEn: "Reserved",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  checked_out: {
    label: "เบิกออกกองแล้ว",
    labelEn: "Checked Out",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
    icon: <Truck className="w-3.5 h-3.5" />,
  },
  returned: {
    label: "คืนคลังเรียบร้อย",
    labelEn: "Returned",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  cancelled: {
    label: "ยกเลิกแล้ว",
    labelEn: "Cancelled",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/30",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

function formatThaiDate(iso: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "-";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear() + 543;
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function formatDateRange(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "-";
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";

  const sDay = String(start.getDate()).padStart(2, "0");
  const sMonth = String(start.getMonth() + 1).padStart(2, "0");
  const sYear = start.getFullYear() + 543;
  const sTime = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;

  const eDay = String(end.getDate()).padStart(2, "0");
  const eMonth = String(end.getMonth() + 1).padStart(2, "0");
  const eYear = end.getFullYear() + 543;
  const eTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;

  if (sDay === eDay && sMonth === eMonth && sYear === eYear) {
    return `${sDay}/${sMonth}/${sYear} (${sTime} - ${eTime})`;
  }
  return `${sDay}/${sMonth}/${sYear} ${sTime} → ${eDay}/${eMonth}/${eYear} ${eTime}`;
}

export function ProjectReservationsDialog({
  open,
  onOpenChange,
  onReservationsCountChange,
}: Props) {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadReservations = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      // Fetch reservations
      const { data: resData, error: resError } = await supabase
        .from("inventory_reservations")
        .select("*")
        .eq("company_id", tenant.id)
        .order("start_at", { ascending: false });

      if (resError) throw resError;

      const reservationList = (resData ?? []) as Reservation[];

      if (reservationList.length === 0) {
        setReservations([]);
        onReservationsCountChange?.(0);
        return;
      }

      // Fetch items for these reservations
      const resIds = reservationList.map((r) => r.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from("inventory_reservation_items")
        .select("*, skus(name_th, name_en, category, department, location)")
        .in("reservation_id", resIds);

      if (itemsError) throw itemsError;

      const itemsByRes = new Map<string, ReservationItem[]>();
      for (const item of (itemsData ?? []) as ReservationItem[]) {
        const existing = itemsByRes.get(item.reservation_id) || [];
        existing.push(item);
        itemsByRes.set(item.reservation_id, existing);
      }

      const combined = reservationList.map((r) => ({
        ...r,
        items: itemsByRes.get(r.id) || [],
      }));

      setReservations(combined);

      const activeCount = combined.filter((r) => r.status === "reserved").length;
      onReservationsCountChange?.(activeCount);
    } catch (err: any) {
      console.error("Error loading reservations:", err);
      toast.error("ไม่สามารถโหลดรายการจองอุปกรณ์ได้: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadReservations();
    }
  }, [open, tenant?.id]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleUpdateStatus = async (
    reservation: Reservation,
    nextStatus: "checked_out" | "returned" | "cancelled"
  ) => {
    if (!tenant?.id) return;
    setUpdatingId(reservation.id);

    try {
      const { error: updateError } = await supabase
        .from("inventory_reservations")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reservation.id)
        .eq("company_id", tenant.id);

      if (updateError) throw updateError;

      // Log SKU transactions for stock history tracking if checked out or returned
      if (reservation.items && reservation.items.length > 0 && (nextStatus === "checked_out" || nextStatus === "returned")) {
        const actionType = nextStatus === "checked_out" ? "check_out" : "check_in";
        const txRows = reservation.items.map((item) => ({
          company_id: tenant.id,
          sku_code: item.sku_code,
          sku_id: item.sku_id,
          department: item.skus?.department || "equipment",
          action_type: actionType,
          person_name: `${reservation.external_project_name} (${reservation.requested_by})`,
        }));

        const { error: txError } = await supabase.from("sku_transactions").insert(txRows);
        if (txError) {
          console.warn("Could not record automatic sku_transactions:", txError);
        }
      }

      toast.success(
        nextStatus === "checked_out"
          ? `เบิกอุปกรณ์สำหรับโปรเจกต์ "${reservation.external_project_name}" สำเร็จ`
          : nextStatus === "returned"
          ? `รับคืนอุปกรณ์จากโปรเจกต์ "${reservation.external_project_name}" ครบถ้วนแล้ว`
          : `ยกเลิกการจองโปรเจกต์ "${reservation.external_project_name}" แล้ว`
      );

      await loadReservations();
    } catch (err: any) {
      console.error("Error updating reservation status:", err);
      toast.error("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: " + (err.message || String(err)));
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesProject = r.external_project_name.toLowerCase().includes(q);
        const matchesRequester = r.requested_by.toLowerCase().includes(q);
        const matchesItems = r.items?.some(
          (it) =>
            it.sku_code.toLowerCase().includes(q) ||
            it.skus?.name_th.toLowerCase().includes(q) ||
            it.skus?.name_en.toLowerCase().includes(q)
        );
        return matchesProject || matchesRequester || matchesItems;
      }
      return true;
    });
  }, [reservations, statusFilter, search]);

  const activeReservationsCount = useMemo(() => {
    return reservations.filter((r) => r.status === "reserved").length;
  }, [reservations]);

  const checkedOutCount = useMemo(() => {
    return reservations.filter((r) => r.status === "checked_out").length;
  }, [reservations]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>การจองอุปกรณ์กองถ่าย (Project Reservations)</span>
                  {activeReservationsCount > 0 && (
                    <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white font-mono text-xs">
                      {activeReservationsCount} รอดำเนินการ
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  รายการจองอุปกรณ์จาก FilmFlow Open & Pipeline เชื่อมต่อกับคลัง {tenant?.name || "Ctrl+ Production"}
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadReservations}
              disabled={loading}
              className="gap-1.5 shrink-0 h-8"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline text-xs">รีเฟรช</span>
            </Button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/50">
            <div className="bg-background/80 rounded-lg p-2 border border-border/50 text-center">
              <span className="text-[11px] text-muted-foreground block">ทั้งหมด</span>
              <span className="text-base font-bold text-foreground">{reservations.length}</span>
            </div>
            <div className="bg-amber-500/5 rounded-lg p-2 border border-amber-500/20 text-center">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block font-medium">รอเบิกออก (Reserved)</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">{activeReservationsCount}</span>
            </div>
            <div className="bg-blue-500/5 rounded-lg p-2 border border-blue-500/20 text-center">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 block font-medium">อยู่ระหว่างใช้งาน</span>
              <span className="text-base font-bold text-blue-600 dark:text-blue-400">{checkedOutCount}</span>
            </div>
            <div className="bg-emerald-500/5 rounded-lg p-2 border border-emerald-500/20 text-center">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">คืนคลังแล้ว</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {reservations.filter((r) => r.status === "returned").length}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อโปรเจกต์, รหัส SKU, ผู้จอง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-background"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background">
                <SelectValue placeholder="สถานะทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="reserved">🟡 จองอุปกรณ์ (Reserved)</SelectItem>
                <SelectItem value="checked_out">🔵 เบิกออกกองแล้ว (Checked Out)</SelectItem>
                <SelectItem value="returned">🟢 คืนคลังแล้ว (Returned)</SelectItem>
                <SelectItem value="cancelled">⚪ ยกเลิกแล้ว (Cancelled)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {/* Content list */}
        <ScrollArea className="flex-1 p-4 max-h-[55vh]">
          {loading && reservations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span>กำลังโหลดข้อมูลการจองอุปกรณ์...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <Box className="w-10 h-10 stroke-1 text-muted-foreground/50" />
              <span>ไม่พบรายการจองอุปกรณ์ที่ตรงกับเงื่อนไข</span>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((res) => {
                const statusMeta = STATUS_CONFIG[res.status] || STATUS_CONFIG.reserved;
                const isExpanded = expandedIds.has(res.id);
                const totalItemUnits = res.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                const isUpdating = updatingId === res.id;

                return (
                  <div
                    key={res.id}
                    className="border rounded-xl bg-card hover:border-primary/40 transition-colors overflow-hidden shadow-xs"
                  >
                    {/* Item summary banner */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {res.external_project_name}
                          </h3>
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 font-normal text-xs px-2 py-0.5 border",
                              statusMeta.bg,
                              statusMeta.text,
                              statusMeta.border
                            )}
                          >
                            {statusMeta.icon}
                            <span>{statusMeta.label}</span>
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-primary/70" />
                            {formatDateRange(res.start_at, res.end_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-primary/70" />
                            {res.requested_by}
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-primary/70" />
                            {res.items?.length || 0} รายการ ({totalItemUnits} ชิ้น)
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {res.status === "reserved" && (
                          <Button
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(res, "checked_out")}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8 text-xs font-semibold"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>เบิกอุปกรณ์ออกกอง</span>
                          </Button>
                        )}

                        {res.status === "checked_out" && (
                          <Button
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(res, "returned")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-semibold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ตรวจรับคืนคลัง</span>
                          </Button>
                        )}

                        {res.status === "reserved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(res, "cancelled")}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-8 text-xs"
                          >
                            ยกเลิก
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(res.id)}
                          className="h-8 w-8 text-muted-foreground"
                          title="ดูรายละเอียดอุปกรณ์"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expandable item table */}
                    {isExpanded && (
                      <div className="border-t px-4 py-3 bg-background/50 space-y-2">
                        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center justify-between">
                          <span>รายการอุปกรณ์ที่จองไว้ ({res.items?.length || 0})</span>
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            Created: {formatThaiDate(res.created_at)}
                          </span>
                        </div>

                        <div className="divide-y divide-border/50 border rounded-lg overflow-hidden bg-card">
                          {res.items && res.items.length > 0 ? (
                            res.items.map((item) => (
                              <div
                                key={item.id}
                                className="px-3 py-2 flex items-center justify-between text-xs hover:bg-muted/30"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge
                                    variant="outline"
                                    className="font-mono font-bold text-[11px] px-1.5 py-0 bg-primary/5 text-primary border-primary/20 shrink-0"
                                  >
                                    {item.sku_code}
                                  </Badge>
                                  <div className="truncate">
                                    <span className="font-medium text-foreground">
                                      {item.skus?.name_th || item.skus?.name_en || item.sku_code}
                                    </span>
                                    {item.skus?.location && (
                                      <span className="text-muted-foreground text-[10px] ml-2">
                                        (ที่เก็บ: {item.skus.location})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 font-mono shrink-0 pl-2">
                                  <span className="font-bold text-foreground">x{item.quantity}</span>
                                  <span className="text-muted-foreground text-[10px]">ชิ้น</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-center text-xs text-muted-foreground">
                              ไม่มีรายการย่อย
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
