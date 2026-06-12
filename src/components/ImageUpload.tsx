import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Image as ImageIcon } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
}

export const ImageUpload = ({ value, onChange }: Props) => {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [compression, setCompression] = useState<{ before: number; after: number } | null>(null);

  const handle = async (file: File) => {
    if (!file) return;
    setBusy(true);
    setCompression(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error(t.signInToUpload);
        return;
      }
      const beforeKb = Math.round(file.size / 1024);
      const compressed = await compressImage(file);
      const afterKb = Math.round(compressed.size / 1024);
      const path = `${session.session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage
        .from("sku-images")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("sku-images").getPublicUrl(path);
      onChange(data.publicUrl);
      setCompression({ before: beforeKb, after: afterKb });
      toast.success(`${t.uploadedSingle(afterKb)} · ${beforeKb} KB → ${afterKb} KB`);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!value) return;
    const m = value.match(/\/sku-images\/(.+)$/);
    if (m) await supabase.storage.from("sku-images").remove([m[1]]);
    onChange(null);
    setCompression(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="w-4 h-4 mr-1" /> {t.chooseImage}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => camRef.current?.click()} disabled={busy}>
          <Camera className="w-4 h-4 mr-1" /> {t.camera}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy}>
            <X className="w-4 h-4 mr-1" /> {t.remove}
          </Button>
        )}
        <span className="text-xs text-muted-foreground self-center">
          {busy ? t.compressing : compression
            ? <span className="inline-flex items-center gap-1">
                <span className="line-through opacity-50">{compression.before} KB</span>
                <span>→</span>
                <span className="text-green-600 font-medium">{compression.after} KB</span>
                <span className="opacity-50">({Math.round((1 - compression.after / compression.before) * 100)}% {t.reduced})</span>
              </span>
            : t.autoCompress}
        </span>
      </div>
      {value ? (
        <div className="relative w-32 h-32 rounded-md overflow-hidden border border-border bg-muted">
          <img src={value} alt="SKU" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-32 h-32 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground bg-muted/30">
          <ImageIcon className="w-6 h-6" />
        </div>
      )}
    </div>
  );
};
