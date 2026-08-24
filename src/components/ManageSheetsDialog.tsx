import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  departmentCode: string;
  departmentName: string;
  onUpdated: () => void;
}

function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

const PREFIX_RE = /^[A-Z0-9][A-Z0-9-]*-$/;

export const ManageSheetsDialog = ({ open, onOpenChange, departmentCode, departmentName, onUpdated }: Props) => {
  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [name, setName] = useState("");
  const [sheetInput, setSheetInput] = useState("");
  const [skuPrefix, setSkuPrefix] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("google_sheets_registry")
      .select("*")
      .eq("department", departmentCode)
      .eq("is_active", true)
      .order("sku_prefix");
    if (error) toast.error(error.message);
    else setSheets(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, departmentCode]);

  const resetForm = () => {
    setName("");
    setSheetInput("");
    setSkuPrefix("");
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const sheetId = extractSheetId(sheetInput);
    if (!sheetId) {
      toast.error("กรุณาระบุ Google Sheet URL หรือ Sheet ID");
      return;
    }
    if (!name.trim()) {
      toast.error("กรุณาระบุชื่อคลัง/ชีท");
      return;
    }
    const prefix = skuPrefix.trim().toUpperCase();
    if (prefix && !PREFIX_RE.test(prefix)) {
      toast.error('SKU Prefix ควรลงท้ายด้วยขีด เช่น "B-" หรือปล่อยว่างไว้สำหรับคลังหลัก');
      return;
    }

    setIsSaving(true);
    const payload = {
      name: name.trim(),
      sheet_id: sheetId,
      department: departmentCode,
      sku_prefix: prefix,
      is_active: true,
    };

    if (editingId) {
      const { error } = await supabase.from("google_sheets_registry").update(payload).eq("id", editingId);
      if (error) toast.error(error.message);
      else toast.success("อัปเดตลิงก์ชีทสำเร็จ");
    } else {
      const { error } = await supabase.from("google_sheets_registry").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("เพิ่มลิงก์ชีทสำเร็จ");
    }

    setIsSaving(false);
    resetForm();
    load();
    onUpdated();
  };

  const handleDelete = async (id: string, sheetName: string) => {
    if (!confirm(`คุณต้องการลบการเชื่อมต่อชีท "${sheetName}" ใช่หรือไม่?\nข้อมูลสินค้าที่เคยซิงก์มาแล้วจะไม่ถูกลบ แต่จะไม่ถูกอัปเดตอีกต่อไป`)) return;
    const { error } = await supabase.from("google_sheets_registry").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("ลบชีทสำเร็จ");
      load();
      onUpdated();
    }
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setName(s.name);
    setSheetInput(`https://docs.google.com/spreadsheets/d/${s.sheet_id}/edit`);
    setSkuPrefix(s.sku_prefix || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>จัดการ Google Sheets - {departmentName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {/* List existing sheets */}
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : sheets.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center border rounded bg-accent/20">ยังไม่มีการเชื่อมต่อชีทในหมวดหมู่นี้</p>
            ) : sheets.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 border rounded bg-card">
                <div className="overflow-hidden pr-2">
                  <div className="font-semibold flex items-center gap-2">
                    {s.name}
                    {s.sku_prefix === "" && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">คลังหลัก</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={s.sheet_id}>
                    ID: {s.sheet_id}
                  </div>
                  {s.sku_prefix && (
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      Prefix: {s.sku_prefix}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id, s.name)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <hr />

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <h4 className="font-semibold">{editingId ? "แก้ไขการเชื่อมต่อ" : "เชื่อมต่อชีทใหม่"}</h4>
            
            <div className="space-y-1.5">
              <Label>ชื่อคลัง / คำอธิบาย *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. คลังสาขา B" required />
            </div>

            <div className="space-y-1.5">
              <Label>Google Sheet URL หรือ Sheet ID *</Label>
              <Input value={sheetInput} onChange={e => setSheetInput(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." required />
            </div>

            <div className="space-y-1.5">
              <Label>SKU Prefix Code (เว้นว่างไว้ถ้าเป็นคลังหลัก)</Label>
              <Input value={skuPrefix} onChange={e => setSkuPrefix(e.target.value.toUpperCase())} placeholder="e.g. B-" className="font-mono" />
              <p className="text-[10px] text-muted-foreground">ถ้ากรอก ตัวอย่างรหัสสินค้าจะเป็น: {skuPrefix || "PREFIX"}EQ-CAM-001</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetForm}>ยกเลิก</Button>
              )}
              <Button type="submit" disabled={isSaving} className="gap-2">
                <Save className="w-4 h-4" /> {editingId ? "บันทึกการแก้ไข" : "เพิ่มลิงก์ชีท"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
