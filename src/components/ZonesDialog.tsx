import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MultiImageUpload } from "./MultiImageUpload";
import { toast } from "sonner";
import { Trash2, Plus, MapPin } from "lucide-react";

interface Zone {
  id: string;
  key: string;
  name_th: string;
  name_en: string | null;
  image_url: string | null;
  order_index: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export const ZonesDialog = ({ open, onOpenChange }: Props) => {
  const { roles, companyId } = useAuth();
  const isAdmin = roles.includes("admin");

  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [newKey, setNewKey] = useState("");
  const [newNameTh, setNewNameTh] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("zones").select("*").order("order_index");
    if (error) toast.error(error.message);
    else setZones((data ?? []) as Zone[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const setZoneImage = async (zone: Zone, url: string | null) => {
    const { error } = await supabase.from("zones").update({ image_url: url }).eq("id", zone.id);
    if (error) { toast.error(error.message); return; }
    setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, image_url: url } : z)));
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newNameTh.trim()) {
      toast.error("กรุณากรอกรหัสโซนและชื่อโซนให้ครบถ้วน");
      return;
    }
    if (!companyId) {
      toast.error("ไม่พบข้อมูลบริษัทของผู้ใช้");
      return;
    }
    const { error } = await supabase.from("zones").insert({
      company_id: companyId,
      key: newKey.trim(),
      name_th: newNameTh.trim(),
      order_index: zones.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("เพิ่มโซนสำเร็จ");
    setNewKey("");
    setNewNameTh("");
    load();
  };

  const handleDelete = async (zone: Zone) => {
    if (!confirm(`ต้องการลบโซน "${zone.name_th}" ใช่หรือไม่?`)) return;
    const { error } = await supabase.from("zones").delete().eq("id", zone.id);
    if (error) toast.error(error.message);
    else {
      toast.success("ลบโซนสำเร็จ");
      load();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4" /> รูปพื้นที่เก็บของ (Storage Zones)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : zones.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีโซนที่บันทึกไว้</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {zones.map((z) => (
                <div key={z.id} className="border rounded-lg p-2 space-y-2 bg-card">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate" title={z.name_th}>
                        {z.key} · {z.name_th}
                      </div>
                      {z.name_en && (
                        <div className="text-xs text-muted-foreground truncate">{z.name_en}</div>
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive shrink-0"
                        onClick={() => handleDelete(z)}
                        title="ลบโซน"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {isAdmin ? (
                    <MultiImageUpload
                      values={z.image_url ? [z.image_url] : []}
                      onChange={(urls) => setZoneImage(z, urls[0] ?? null)}
                      max={1}
                    />
                  ) : z.image_url ? (
                    <img
                      src={z.image_url}
                      alt={z.name_th}
                      className="w-full aspect-square object-cover rounded-md border border-border"
                    />
                  ) : (
                    <div className="w-full aspect-square rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">
                      ยังไม่มีรูป
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <>
              <hr />
              <div className="space-y-3 pt-1">
                <h4 className="font-semibold text-sm">เพิ่มโซนใหม่</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>รหัสโซน (Key)</Label>
                    <Input value={newKey} onChange={(e) => setNewKey(e.target.value.toUpperCase())} placeholder="e.g. N" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ชื่อโซน</Label>
                    <Input value={newNameTh} onChange={(e) => setNewNameTh(e.target.value)} placeholder="e.g. ZONE BOX ART 6" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleAdd} className="gap-2">
                    <Plus className="w-4 h-4" /> เพิ่มโซน
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
