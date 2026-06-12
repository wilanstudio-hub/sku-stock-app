import { useRef, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, CloudUpload, Star, Loader2 } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";
import { cn } from "@/lib/utils";

async function waitForImageReady(url: string, attempts = [200, 500, 1000, 2000, 3000]): Promise<boolean> {
  for (let i = 0; i <= attempts.length; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `${url}?t=${Date.now()}-${i}`;
    });
    if (ok) return true;
    if (i < attempts.length) await new Promise((r) => setTimeout(r, attempts[i]));
  }
  return false;
}

interface Props {
  values: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

export const MultiImageUpload = ({ values, onChange, max = 5 }: Props) => {
  const { t, lang } = useLang();
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadedAt, setUploadedAt] = useState<Record<string, number>>({});
  const [lastCompression, setLastCompression] = useState<{ before: number; after: number; count: number } | null>(null);

  const canAdd = values.length < max;

  const handleFiles = useCallback(async (files: File[]) => {
    const remaining = max - values.length;
    if (remaining <= 0) {
      toast.error(t.maxImages(max));
      return;
    }
    const list = files.slice(0, remaining);
    setBusy(true);
    setLastCompression(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error(t.signInToUpload);
        return;
      }
      const uploaded: string[] = [];
      let totalBefore = 0;
      let totalAfter = 0;
      for (const file of list) {
        totalBefore += file.size;
        const compressed = await compressImage(file);
        totalAfter += compressed.size;
        const path = `${session.session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage
          .from("sku-images")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("sku-images").getPublicUrl(path);
        const ready = await waitForImageReady(data.publicUrl);
        if (!ready) console.warn("Image not ready after retries:", data.publicUrl);
        uploaded.push(data.publicUrl);
      }
      setUploadedAt((prev) => {
        const next = { ...prev };
        const now = Date.now();
        for (const u of uploaded) next[u] = now;
        return next;
      });
      const beforeKb = Math.round(totalBefore / 1024);
      const afterKb = Math.round(totalAfter / 1024);
      setLastCompression({ before: beforeKb, after: afterKb, count: uploaded.length });
      onChange([...values, ...uploaded]);
      toast.success(`${t.uploadedMsg(uploaded.length)} · ${beforeKb} KB → ${afterKb} KB`);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (camRef.current) camRef.current.value = "";
    }
  // values is intentionally excluded — we capture the length snapshot at call time via `remaining`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, values.length, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: true,
    disabled: busy || !canAdd,
    noClick: true,
    onDrop: handleFiles,
  });

  const remove = async (idx: number) => {
    const url = values[idx];
    const m = url.match(/\/sku-images\/(.+)$/);
    if (m) await supabase.storage.from("sku-images").remove([m[1]]);
    onChange(values.filter((_, i) => i !== idx));
  };

  const setCover = (idx: number) => {
    if (idx === 0) return;
    const next = [...values];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    onChange(next);
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative rounded-lg transition-all duration-150",
        isDragActive && "ring-2 ring-primary ring-offset-2",
      )}
    >
      {/* Hidden inputs for the dropzone and camera */}
      <input {...getInputProps()} />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
      />

      {/* Drag-active overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-20 rounded-lg bg-primary/10 border-2 border-dashed border-primary flex flex-col items-center justify-center gap-2 pointer-events-none">
          <CloudUpload className="w-8 h-8 text-primary animate-bounce" />
          <p className="text-sm font-medium text-primary">
            {lang === "th" ? "วางรูปที่นี่" : "Release to upload"}
          </p>
        </div>
      )}

      {values.length === 0 ? (
        /* ── Empty state: large drop zone ── */
        <div
          onClick={() => !busy && canAdd && fileRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/40",
          )}
        >
          <CloudUpload className={cn("w-9 h-9", isDragActive ? "text-primary" : "text-muted-foreground/50")} />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground/80">
              {isDragActive
                ? (lang === "th" ? "วางรูปที่นี่" : "Drop images here")
                : (lang === "th" ? "ลากรูปมาวางที่นี่ หรือคลิกเพื่อเลือก" : "Drop images here, or click to browse")}
            </p>
            <p className="text-xs text-muted-foreground">{t.autoCompress} · {t.maxImages(max)}</p>
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1" /> {t.chooseImage}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => camRef.current?.click()}
            >
              <Camera className="w-4 h-4 mr-1" /> {t.camera}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Has images: thumbnail grid ── */
        <div className="space-y-2">
          {/* Toolbar row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !canAdd}
            >
              <Upload className="w-4 h-4 mr-1" /> {t.chooseImage}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => camRef.current?.click()}
              disabled={busy || !canAdd}
            >
              <Camera className="w-4 h-4 mr-1" /> {t.camera}
            </Button>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1 flex-wrap">
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              {busy ? t.uploadingMulti : (
                <>
                  <span>{t.imagesCount(values.length, max)} · {t.coverHint}</span>
                  {lastCompression && (
                    <span className="inline-flex items-center gap-1 ml-1 border-l pl-1">
                      <span className="line-through opacity-50">{lastCompression.before} KB</span>
                      <span>→</span>
                      <span className="text-green-600 font-medium">{lastCompression.after} KB</span>
                      <span className="opacity-50">
                        ({Math.round((1 - lastCompression.after / lastCompression.before) * 100)}% {t.reduced}
                        {lastCompression.count > 1 ? ` · ${lastCompression.count} ${t.imagesWord}` : ""})
                      </span>
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          {/* Thumbnail grid */}
          <div className="flex flex-wrap gap-2">
            {values.map((url, idx) => (
              <div
                key={url}
                className="relative w-24 h-24 rounded-md overflow-hidden border border-border bg-muted group flex-shrink-0"
              >
                <img
                  src={uploadedAt[url] ? `${url}?t=${uploadedAt[url]}` : url}
                  alt={`Image ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {idx === 0 && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
                    COVER
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                  {idx !== 0 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => setCover(idx)}
                      title={t.setAsCover}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-7 w-7"
                    onClick={() => remove(idx)}
                    title={t.remove}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add-more slot — itself a mini drop target */}
            {canAdd && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className={cn(
                  "w-24 h-24 rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors flex-shrink-0",
                  isDragActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 hover:bg-muted hover:border-muted-foreground/40",
                )}
              >
                <Upload className="w-5 h-5" />
                <span className="text-[10px]">{values.length}/{max}</span>
              </button>
            )}
          </div>

          {/* Drop-more hint when canAdd */}
          {canAdd && (
            <p className="text-xs text-muted-foreground/60">
              {lang === "th"
                ? `ลากรูปมาวางเพื่อเพิ่ม (เหลือ ${max - values.length} รูป)`
                : `Drop images to add more (${max - values.length} remaining)`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
