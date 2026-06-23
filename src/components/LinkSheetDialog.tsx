import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onLinked: () => void;
}

function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

const PREFIX_RE = /^[A-Z0-9][A-Z0-9-]*-$/;

export const LinkSheetDialog = ({ open, onOpenChange, onLinked }: Props) => {
  const [name, setName] = useState("");
  const [sheetInput, setSheetInput] = useState("");
  const [skuPrefix, setSkuPrefix] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setSheetInput(""); setSkuPrefix(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sheetId = extractSheetId(sheetInput);
    if (!sheetId) {
      toast.error("กรุณาระบุ Google Sheet URL หรือ Sheet ID");
      return;
    }
    if (!name.trim()) {
      toast.error("กรุณาระบุชื่อคลัง");
      return;
    }

    const prefix = skuPrefix.trim().toUpperCase();
    if (!prefix) {
      toast.error("กรุณาระบุ SKU Prefix Code");
      return;
    }
    if (!PREFIX_RE.test(prefix)) {
      toast.error('SKU Prefix ต้องลงท้ายด้วยขีด เช่น "B-" หรือ "BKK-" และใช้ได้แค่ A-Z 0-9 -');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("google_sheets_registry").insert({
        name: name.trim(),
        sheet_id: sheetId,
        department: "equipment",
        sku_prefix: prefix,
        is_active: true,
      });
      if (error) throw error;
      toast.success(`เชื่อมชีท "${name.trim()}" สำเร็จ`);
      reset();
      onOpenChange(false);
      onLinked();
    } catch (e: any) {
      toast.error(e.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const previewSku = `${skuPrefix.trim().toUpperCase() || "PREFIX"}EQ-CAM-001`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>เชื่อมต่อ Google Sheet ใหม่</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="ls-name">ชื่อคลัง *</Label>
            <Input
              id="ls-name"
              placeholder="เช่น คลังสาขา B"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ls-sheet">Google Sheet URL หรือ Sheet ID *</Label>
            <Input
              id="ls-sheet"
              placeholder="https://docs.google.com/spreadsheets/d/… หรือ ID"
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">วาง URL ทั้งหมดหรือเฉพาะ ID</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ls-prefix">SKU Prefix Code * (เช่น B- หรือ BKK-)</Label>
            <Input
              id="ls-prefix"
              placeholder="B-"
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
              className="font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              SKU จะมีรูปแบบ:{" "}
              <code className="font-mono bg-muted px-1 rounded text-xs">{previewSku}</code>
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก…" : "เชื่อมต่อชีท"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
