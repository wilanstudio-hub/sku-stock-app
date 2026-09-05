import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Sparkles, CreditCard, Shield, Zap, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Company } from "@/contexts/TenantContext";

export interface PlanConfig {
  id: string;
  name: string;
  priceBaht: number;
  seatLimit: number;
  popular?: boolean;
  features: string[];
}

export const SAAS_PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Starter / ทดลองใช้",
    priceBaht: 0,
    seatLimit: 3,
    features: [
      "ใช้งานได้สูงสุด 3 สมาชิก",
      "ระบบสต๊อกพื้นฐาน & QR Scan",
      "ส่งออก PDF Catalog",
      "ซิงก์ Google Sheets 1 คลัง",
    ],
  },
  {
    id: "solo",
    name: "Solo Production",
    priceBaht: 550,
    seatLimit: 1,
    features: [
      "1 ผู้ดูแลระบบ (Single Admin)",
      "ไม่จำกัดจำนวนรายการ SKU",
      "Google Sheets Real-time Sync",
      "Ctrl+ Production AI Agent พื้นฐาน",
    ],
  },
  {
    id: "team",
    name: "Team Studio",
    priceBaht: 2500,
    seatLimit: 8,
    popular: true,
    features: [
      "สูงสุด 8 สมาชิกพร้อมกัน",
      "รองรับแยกแผนก Art, WD, Equipment อิสระ",
      "Ctrl+ Production AI Agent เต็มรูปแบบ",
      "ประวัติการเบิก-คืน & Timeline ละเอียด",
      "QR Batch Sheets & Label Generator",
    ],
  },
  {
    id: "studio",
    name: "Studio Pro",
    priceBaht: 5000,
    seatLimit: 20,
    features: [
      "สูงสุด 20 สมาชิกในสตูดิโอ",
      "จัดการหลายคลังสินค้าพร้อมกัน",
      "AI Inventory Audit & Auto-PM Follow-up",
      "Subdomain เฉพาะสตูดิโอระดับ Enterprise",
      "ระบบความปลอดภัย Row-Level Security สูงสุด",
    ],
  },
];

interface BillingPlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  onPlanUpdated: () => void;
}

export const BillingPlansDialog: React.FC<BillingPlansDialogProps> = ({
  open,
  onOpenChange,
  company,
  onPlanUpdated,
}) => {
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (plan: PlanConfig) => {
    if (!company) return;
    if (company.billing_plan === plan.id) {
      toast.info(`สตูดิโอของคุณใช้งานแผน ${plan.name} อยู่แล้ว`);
      return;
    }

    setSubmittingPlan(plan.id);
    try {
      // Call server billing-checkout endpoint
      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: {
          planId: plan.id,
          companyId: company.id,
        },
      });

      if (!error && data?.url) {
        // Redirect to hosted payment page (Stripe / Beam)
        window.location.href = data.url;
        return;
      }

      if (!data?.success) {
        throw new Error("Billing service did not confirm the plan change");
      }

      toast.success(`อัปเกรดเป็นแผน "${plan.name}" สำเร็จ! (โควต้า ${plan.seatLimit} ที่นั่ง)`);
      onPlanUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("เกิดข้อผิดพลาดในการเปลี่ยนแผน: " + (err?.message || String(err)));
    } finally {
      setSubmittingPlan(null);
    }
  };

  const currentPlanId = company?.billing_plan || "free";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1 text-primary">
            <CreditCard className="w-5 h-5" />
            <DialogTitle className="text-xl font-bold">แผนการใช้งานและการสมัครสมาชิก</DialogTitle>
          </div>
          <DialogDescription>
            เลือกแผนที่เหมาะสมสำหรับสตูดิโอ <strong>{company?.name || "ของคุณ"}</strong> เพื่อขยายโควต้าสมาชิกและฟีเจอร์ระดับโปร
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
          {SAAS_PLANS.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between border-2 transition-all duration-200 ${
                  isCurrent
                    ? "border-primary bg-primary/5 shadow-md"
                    : plan.popular
                    ? "border-orange-500/50 hover:border-orange-500 bg-card"
                    : "border-border hover:border-muted-foreground/30 bg-card"
                }`}
              >
                {plan.popular && !isCurrent && (
                  <Badge className="absolute -top-2.5 right-4 bg-orange-500 hover:bg-orange-600 text-white text-[10px] uppercase font-bold tracking-wider">
                    ยอดนิยม (Popular)
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[10px] uppercase font-bold tracking-wider">
                    แผนปัจจุบัน
                  </Badge>
                )}

                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span>{plan.name}</span>
                  </CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-extrabold text-foreground">
                      {plan.priceBaht === 0 ? "ฟรี" : `฿${plan.priceBaht.toLocaleString()}`}
                    </span>
                    <span className="text-xs text-muted-foreground">/เดือน</span>
                  </div>
                  <p className="text-xs text-primary font-medium mt-1">
                    👥 โควต้าสมาชิก: {plan.seatLimit} ที่นั่ง (Seats)
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 flex-1 flex flex-col justify-between pt-0">
                  <div className="space-y-2 border-t pt-3">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant={isCurrent ? "outline" : plan.popular ? "default" : "secondary"}
                    disabled={isCurrent || submittingPlan !== null}
                    onClick={() => handleSelectPlan(plan)}
                    className="w-full gap-2 text-xs font-semibold mt-4"
                  >
                    {submittingPlan === plan.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังดำเนินการ...
                      </>
                    ) : isCurrent ? (
                      "ใช้งานอยู่"
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" /> เลือกแผนนี้
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
