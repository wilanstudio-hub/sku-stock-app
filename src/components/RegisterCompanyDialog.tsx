import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CheckCircle2, Sparkles, Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RegisterCompanyDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const RegisterCompanyDialog: React.FC<RegisterCompanyDialogProps> = ({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !slug.trim() || !contactEmail.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Check if slug already exists
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (existing) {
        setError(`ชื่อ Subdomain "${slug}" ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น`);
        setSubmitting(false);
        return;
      }

      // Insert pending company
      const { error: insertErr } = await supabase.from("companies").insert({
        name: companyName.trim(),
        slug: slug.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim().toLowerCase(),
        status: "pending",
      });

      if (insertErr) throw insertErr;

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCompanyName("");
    setSlug("");
    setContactName("");
    setContactEmail("");
    setError(null);
    setSuccess(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        {success ? (
          <div className="flex flex-col items-center text-center py-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <DialogTitle className="text-2xl font-bold mb-2">ลงทะเบียนสตูดิโอสำเร็จ!</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground max-w-sm mb-6">
              เราได้รับคำขอสร้างระบบสำหรับ <strong className="text-foreground">{companyName}</strong> แล้ว ทีมงานจะเปิดใช้งาน Workspace ของคุณภายใน 24 ชม.
            </DialogDescription>
            <div className="bg-muted/60 p-4 rounded-xl border text-left w-full mb-6 text-sm">
              <div className="flex items-center gap-2 text-primary font-medium mb-1">
                <Globe className="w-4 h-4" />
                <span>ลิงก์ Workspace ของคุณ:</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all">
                https://{slug}.inventory.filmflow.com
              </p>
            </div>
            <Button onClick={handleReset} className="w-full">
              เสร็จสิ้น
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                <Building2 className="w-5 h-5" />
              </div>
              <DialogTitle className="text-xl">สร้างระบบสต็อกสำหรับสตูดิโอของคุณ</DialogTitle>
              <DialogDescription>
                ลงทะเบียนรับระบบจัดการสต็อก FilmFlow แยกฐานข้อมูลและ Subdomain เฉพาะของบริษัทคุณ
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="companyName">ชื่อสตูดิโอ / บริษัท *</Label>
                <Input
                  id="companyName"
                  placeholder="เช่น Acme Production Studio"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="slug">Subdomain ที่ต้องการ *</Label>
                <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                  <Input
                    id="slug"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm"
                    placeholder="acme"
                    value={slug}
                    onChange={handleSlugChange}
                    required
                  />
                  <span className="pr-3 text-xs text-muted-foreground font-mono select-none">
                    .inventory.app
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  ใช้อักษรภาษาอังกฤษพิมพ์เล็ก ตัวเลข และขีดกลาง (-) เท่านั้น
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="contactName">ชื่อผู้ติดต่อ</Label>
                  <Input
                    id="contactName"
                    placeholder="คุณสมชาย"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactEmail">อีเมลผู้ติดต่อ *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="admin@studio.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> กำลังส่งข้อมูล...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> เริ่มต้นใช้งาน
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
