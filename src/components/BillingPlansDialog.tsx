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
import { useLang } from "@/hooks/useLang";

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
    name: "planStarter",
    priceBaht: 0,
    seatLimit: 3,
    features: ["planFeat1", "planFeat2", "planFeat3", "planFeat4"],
  },
  {
    id: "solo",
    name: "Solo Production",
    priceBaht: 550,
    seatLimit: 1,
    features: ["planFeat5", "planFeat6", "Google Sheets Real-time Sync", "planFeat7"],
  },
  {
    id: "team",
    name: "Team Studio",
    priceBaht: 2500,
    seatLimit: 8,
    popular: true,
    features: ["planFeat8", "planFeat9", "planFeat10", "planFeat11", "QR Batch Sheets & Label Generator"],
  },
  {
    id: "studio",
    name: "Studio Pro",
    priceBaht: 5000,
    seatLimit: 20,
    features: ["planFeat12", "planFeat13", "AI Inventory Audit & Auto-PM Follow-up", "planFeat14", "planFeat15"],
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
  const { t } = useLang();
  const text = (key: string) => {
    const value = (t as unknown as Record<string, unknown>)[key];
    return typeof value === "string" ? value : key;
  };
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (plan: PlanConfig) => {
    if (!company) return;
    if (company.billing_plan === plan.id) {
      toast.info(t.planAlready(text(plan.name)));
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

      toast.success(t.planUpgraded(text(plan.name), plan.seatLimit));
      onPlanUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(t.planChangeError(err?.message || String(err)));
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
            <DialogTitle className="text-xl font-bold">{t.plansTitle}</DialogTitle>
          </div>
          <DialogDescription>
            {t.plansDesc} <strong>{company?.name || t.plansYours}</strong> {t.plansDescTail}
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
                    {t.popular}
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[10px] uppercase font-bold tracking-wider">
                    {t.currentPlan}
                  </Badge>
                )}

                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span>{text(plan.name)}</span>
                  </CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-extrabold text-foreground">
                      {plan.priceBaht === 0 ? t.free : t.priceAmount(plan.priceBaht)}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.perMonth}</span>
                  </div>
                  <p className="text-xs text-primary font-medium mt-1">
                    {t.seatQuota(plan.seatLimit)}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 flex-1 flex flex-col justify-between pt-0">
                  <div className="space-y-2 border-t pt-3">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{text(f)}</span>
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
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t.processing}
                      </>
                    ) : isCurrent ? (
                      t.inUse
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" /> {t.choosePlan}
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
