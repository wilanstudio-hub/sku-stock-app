import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit2, Save } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated: () => void;
}

function extractSheetId(input: string): string {
  if (!input) return "";
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

export const ManageDepartmentsDialog = ({ open, onOpenChange, onUpdated }: Props) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [code, setCode] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [icon, setIcon] = useState("package");
  const [syncFormat, setSyncFormat] = useState("equipment");
  const [sheetUrl, setSheetUrl] = useState("");
  const [registryId, setRegistryId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("departments").select("*").order("order_index");
    if (error) toast.error(error.message);
    else setDepartments(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const resetForm = () => {
    setCode("");
    setNameTh("");
    setIcon("package");
    setSyncFormat("equipment");
    setSheetUrl("");
    setRegistryId(null);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!code.trim() || !nameTh.trim()) {
      toast.error("กรุณากรอก Code และ ชื่อหมวดหมู่ให้ครบถ้วน");
      return;
    }

    const deptCode = code.trim().toLowerCase();
    const payload = {
      code: deptCode,
      name_th: nameTh.trim(),
      icon,
      sync_format: syncFormat,
    };

    if (editingId) {
      const { error } = await supabase.from("departments").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("departments").insert({
        ...payload,
        order_index: departments.length + 1,
      });
      if (error) { toast.error(error.message); return; }
    }

    // Save Sheet URL to registry
    const extractedId = extractSheetId(sheetUrl);
    if (extractedId) {
      const regPayload = {
        name: `คลังหลัก ${nameTh.trim()}`,
        sheet_id: extractedId,
        department: deptCode,
        sku_prefix: "",
        is_active: true
      };
      if (registryId) {
        await supabase.from("google_sheets_registry").update(regPayload).eq("id", registryId);
      } else {
        // Only insert if it doesn't exist (avoid duplicates if they changed code but registry already has it)
        const { data: existing } = await supabase.from("google_sheets_registry").select("id").eq("department", deptCode).eq("sku_prefix", "").maybeSingle();
        if (existing) {
          await supabase.from("google_sheets_registry").update(regPayload).eq("id", existing.id);
        } else {
          await supabase.from("google_sheets_registry").insert(regPayload);
        }
      }
    } else if (registryId) {
      // If they cleared the URL but it had one, we could delete it or leave it. We'll leave it or they should use ManageSheetsDialog.
    }

    toast.success(editingId ? "อัปเดตหมวดหมู่สำเร็จ" : "เพิ่มหมวดหมู่สำเร็จ");
    resetForm();
    load();
    onUpdated();
  };

  const handleDelete = async (id: string, deptCode: string) => {
    if (!confirm(`คุณต้องการลบหมวดหมู่ "${deptCode}" ใช่หรือไม่?\nข้อมูลสินค้าจะไม่ถูกลบ แต่จะเข้าถึงผ่านแท็บนี้ไม่ได้`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("ลบหมวดหมู่สำเร็จ");
      load();
      onUpdated();
    }
  };

  const startEdit = async (d: any) => {
    setEditingId(d.id);
    setCode(d.code);
    setNameTh(d.name_th);
    setIcon(d.icon);
    setSyncFormat(d.sync_format);
    
    // Fetch main sheet for this department
    const { data } = await supabase
      .from("google_sheets_registry")
      .select("id, sheet_id")
      .eq("department", d.code)
      .eq("sku_prefix", "")
      .maybeSingle();
      
    if (data) {
      setRegistryId(data.id);
      setSheetUrl(`https://docs.google.com/spreadsheets/d/${data.sheet_id}/edit`);
    } else {
      setRegistryId(null);
      setSheetUrl("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>จัดการแท็บหลัก (หมวดหมู่แผนก)</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* List existing departments */}
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : departments.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 border rounded bg-card">
                <div>
                  <div className="font-semibold">{d.name_th}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Code: {d.code} | Format: {d.sync_format}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(d)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id, d.code)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <hr />

          <div className="space-y-4 pt-2">
            <h4 className="font-semibold">{editingId ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Department Code (ภาษาอังกฤษพิมพ์เล็ก)</Label>
                <Input value={code} onChange={e => setCode(e.target.value.toLowerCase())} placeholder="e.g. location" disabled={!!editingId} />
                <p className="text-[10px] text-muted-foreground">ใช้สำหรับสิทธิ์ผู้ใช้ (User Roles)</p>
              </div>
              <div className="space-y-1.5">
                <Label>ชื่อแท็บที่แสดง (Name)</Label>
                <Input value={nameTh} onChange={e => setNameTh(e.target.value)} placeholder="e.g. Location / โลเคชั่น" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>ลิงก์ Google Sheet (คลังหลัก)</Label>
              <Input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
              <p className="text-[10px] text-muted-foreground">ถ้ามีหลายชีทย่อยในหมวดนี้ ให้ไปกด '+ จัดการคลัง' ที่หน้าตารางแทน</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>รูปแบบตาราง (Sync Format)</Label>
                <Select value={syncFormat} onValueChange={setSyncFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipment">รูปแบบมาตรฐาน (Equipment)</SelectItem>
                    <SelectItem value="art">รูปแบบ Props (Art)</SelectItem>
                    <SelectItem value="wd">รูปแบบเสื้อผ้า (WD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ไอคอน (Icon name)</Label>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="package">Package (กล่อง)</SelectItem>
                    <SelectItem value="clapperboard">Clapperboard (สเลท)</SelectItem>
                    <SelectItem value="shirt">Shirt (เสื้อผ้า)</SelectItem>
                    <SelectItem value="camera">Camera (กล้อง)</SelectItem>
                    <SelectItem value="map-pin">Map Pin (สถานที่)</SelectItem>
                    <SelectItem value="car">Car (ยานพาหนะ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {editingId && (
                <Button variant="ghost" onClick={resetForm}>ยกเลิก</Button>
              )}
              <Button onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" /> {editingId ? "บันทึกการแก้ไข" : "เพิ่มหมวดหมู่"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
