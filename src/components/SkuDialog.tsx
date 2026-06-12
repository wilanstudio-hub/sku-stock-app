import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiImageUpload } from "./MultiImageUpload";
import { SyncStatus } from "./SyncStatus";
import { useLang } from "@/hooks/useLang";
import { toast } from "sonner";

const OTHER_SENTINEL = "__other__";

const STYLES = [
  "Modern",
  "Contemporary",
  "Minimalist",
  "Scandinavian",
  "Industrial",
  "Vintage",
  "Retro",
  "Classic",
  "Traditional",
  "Rustic",
  "Country",
  "Bohemian",
  "Mid-Century",
  "Art Deco",
  "Japandi",
  "Loft",
  "Luxury",
  "Tropical",
  "Oriental",
  "Thai",
  "Other",
];

const COLORS: { name: string; hex: string }[] = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#000000" },
  { name: "Gray", hex: "#9CA3AF" },
  { name: "Brown", hex: "#8B5A2B" },
  { name: "Beige", hex: "#E8DCC4" },
  { name: "Cream", hex: "#FFF8DC" },
  { name: "Ivory", hex: "#FFFFF0" },
  { name: "Wood", hex: "#C19A6B" },
  { name: "Red", hex: "#DC2626" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Orange", hex: "#F97316" },
  { name: "Yellow", hex: "#FACC15" },
  { name: "Gold", hex: "#D4AF37" },
  { name: "Green", hex: "#16A34A" },
  { name: "Olive", hex: "#808000" },
  { name: "Mint", hex: "#A8E6CF" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Navy", hex: "#1E3A8A" },
  { name: "Sky", hex: "#7DD3FC" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Purple", hex: "#9333EA" },
  { name: "Violet", hex: "#7C3AED" },
  { name: "Magenta", hex: "#D946EF" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Bronze", hex: "#CD7F32" },
  { name: "Multicolor", hex: "linear-gradient(90deg,#ef4444,#eab308,#22c55e,#3b82f6,#a855f7)" },
  { name: "Transparent", hex: "transparent" },
  { name: "Other", hex: "#E5E7EB" },
];

export type Sku = {
  id?: string;
  department: "art" | "wd" | "equipment";
  sku_code: string;
  name_th: string;
  name_en: string;
  category: string | null;
  location: string | null;
  quantity: number;
  unit: string | null;
  min_stock: number;
  image_url: string | null;
  image_urls: string[] | null;
  notes_th: string | null;
  notes_en: string | null;
  color: string | null;
  special_features: string | null;
  style: string | null;
  availability: "available" | "on_event" | "unavailable";
  zone_key?: string | null;
  current_status?: 'available' | 'check_out' | null;
  last_handler?: string | null;
  updated_at?: string;
};

export type SkuTransaction = {
  id: string;
  sku_code: string;
  department: string;
  action_type: 'check_out' | 'check_in';
  person_name: string;
  created_at: string;
  sku_id?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  department: "art" | "wd" | "equipment";
  initial?: Sku | null;
  onSaved: () => void;
}

const empty = (dept: "art" | "wd" | "equipment"): Sku => ({
  department: dept, sku_code: "", name_th: "", name_en: "",
  category: "", location: "", quantity: 0, unit: "", min_stock: 0,
  image_url: "", image_urls: [], notes_th: "", notes_en: "", color: "", special_features: "", style: "", availability: "available",
});

const prefix3 = (s: string) =>
  (s || "").replace(/[^a-zA-Z0-9ก-๙]/g, "").slice(0, 3).toUpperCase() || "XXX";

const buildSkuCode = async (
  dept: "art" | "wd" | "equipment",
  category: string,
  color: string,
  style: string
): Promise<string> => {
  const base = `${dept.toUpperCase()}-${prefix3(category)}-${prefix3(color)}-${prefix3(style)}`;
  const { data } = await supabase
    .from("skus")
    .select("sku_code")
    .eq("department", dept)
    .like("sku_code", `${base}-%`);
  let max = 0;
  (data ?? []).forEach((r: { sku_code: string }) => {
    const m = r.sku_code.match(new RegExp(`^${base}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${base}-${String(max + 1).padStart(3, "0")}`;
};

export const SkuDialog = ({ open, onOpenChange, department, initial, onSaved }: Props) => {
  const { t, lang } = useLang();
  const [form, setForm] = useState<Sku>(empty(department));
  const [saving, setSaving] = useState(false);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const customRef = useRef<HTMLInputElement>(null);

  // Load unique category values for this department from the DB whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    supabase
      .from("skus")
      .select("category")
      .eq("department", department)
      .then(({ data }) => {
        const unique = Array.from(
          new Set((data ?? []).map((r: any) => r.category).filter(Boolean))
        ).sort() as string[];
        setDbCategories(unique);
      });
  }, [open, department]);

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? empty(department));
  }, [open, initial, department]);

  // Auto-generate SKU code when creating new and category/color/style change
  useEffect(() => {
    if (!open || initial) return;
    if (!form.category && !form.color && !form.style) return;
    let cancelled = false;
    buildSkuCode(department, form.category ?? "", form.color ?? "", form.style ?? "").then((code) => {
      if (!cancelled) setForm((f) => ({ ...f, sku_code: code }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, department, form.category, form.color, form.style]);

  const set = <K extends keyof Sku>(k: K, v: Sku[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    const imgs = form.image_urls ?? [];
    const payload = {
      ...form,
      quantity: Number(form.quantity),
      min_stock: Number(form.min_stock),
      image_urls: imgs,
      // keep legacy image_url in sync with cover (first image) for backwards compat
      image_url: imgs[0] ?? null,
    };
    const { error } = form.id
      ? await supabase.from("skus").update(payload).eq("id", form.id)
      : await supabase.from("skus").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(t.savedSuccess); onSaved(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {form.id ? t.editSkuTitle : t.addSkuTitle} — {department.toUpperCase()}
          </DialogTitle>
        </DialogHeader>
        {(department === "art" || department === "equipment") && (
          <SyncStatus department={department} compact />
        )}
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 sm:col-span-1">
            <Label>{t.categoryLabel}</Label>
            {(() => {
              // Build the option list: DB categories + current value (if not already there) + Other
              const current = form.category ?? "";
              const isOther = current !== "" && current !== OTHER_SENTINEL && !dbCategories.includes(current);
              const options = Array.from(new Set([...dbCategories, ...(isOther ? [current] : [])])).sort();
              const selectValue = isOther ? OTHER_SENTINEL : current;
              return (
                <>
                  <Select
                    value={selectValue}
                    onValueChange={(v) => {
                      if (v === OTHER_SENTINEL) {
                        set("category", "");
                        setCustomCategory("");
                        setTimeout(() => customRef.current?.focus(), 50);
                      } else {
                        set("category", v);
                        setCustomCategory("");
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={t.selectCategory} /></SelectTrigger>
                    <SelectContent>
                      {options.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      <SelectItem value={OTHER_SENTINEL}>{lang === "th" ? "อื่นๆ (พิมพ์เอง)" : "Other (custom)"}</SelectItem>
                    </SelectContent>
                  </Select>
                  {(selectValue === OTHER_SENTINEL || isOther) && (
                    <input
                      ref={customRef}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-th"
                      placeholder={lang === "th" ? "พิมพ์ชื่อหมวดหมู่..." : "Type category name…"}
                      value={isOther ? current : customCategory}
                      onChange={(e) => {
                        setCustomCategory(e.target.value);
                        set("category", e.target.value);
                      }}
                    />
                  )}
                </>
              );
            })()}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>{t.colorLabel}</Label>
            <Select value={form.color ?? ""} onValueChange={(v) => set("color", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectColor} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COLORS.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-4 h-4 rounded border border-border"
                        style={{ background: c.hex }}
                      />
                      <span>{c.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>{t.styleLabel}</Label>
            <Select value={form.style ?? ""} onValueChange={(v) => set("style", v)}>
              <SelectTrigger><SelectValue placeholder={t.selectStyle} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>{t.statusLabel}</Label>
            <Select
              value={form.availability}
              onValueChange={(v) => set("availability", v as "available" | "on_event" | "unavailable")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">{t.statusAvailable}</SelectItem>
                <SelectItem value="on_event">{t.statusOnEvent}</SelectItem>
                <SelectItem value="unavailable">{t.statusUnavailable}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>{t.skuCodeLabel} * <span className="text-xs text-muted-foreground font-normal">{t.skuCodeHint}</span></Label>
            <Input className="font-mono" value={form.sku_code} onChange={(e) => set("sku_code", e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>{t.nameTh}</Label>
            <Input className="font-th" value={form.name_th} onChange={(e) => set("name_th", e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>{t.nameEn}</Label>
            <Input value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
          </div>
          <div>
            <Label>{t.qtyLabel}</Label>
            <Input type="number" value={form.quantity} onChange={(e) => set("quantity", Number(e.target.value))} />
          </div>
          <div>
            <Label>{t.unitLabel}</Label>
            <Input value={form.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder={t.unitPlaceholder} />
          </div>
          <div>
            <Label>Min stock</Label>
            <Input type="number" value={form.min_stock} onChange={(e) => set("min_stock", Number(e.target.value))} />
          </div>
          <div>
            <Label>{t.locationLabel}</Label>
            <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>{t.specialFeaturesLabel}</Label>
            <Textarea
              className="font-th"
              value={form.special_features ?? ""}
              onChange={(e) => set("special_features", e.target.value)}
              placeholder={t.specialFeaturesPlaceholder}
            />
          </div>
          <div className="col-span-2">
            <Label>{t.imagesLabel} <span className="text-xs text-muted-foreground font-normal">{t.imagesHint}</span></Label>
            <MultiImageUpload
              values={form.image_urls ?? []}
              onChange={(urls) => set("image_urls", urls)}
              max={5}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>{t.notesTh}</Label>
            <Textarea className="font-th" value={form.notes_th ?? ""} onChange={(e) => set("notes_th", e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>{t.notesEn}</Label>
            <Textarea value={form.notes_en ?? ""} onChange={(e) => set("notes_en", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button onClick={submit} disabled={saving || !form.sku_code || !form.name_th || !form.name_en}>
            {saving ? "..." : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
