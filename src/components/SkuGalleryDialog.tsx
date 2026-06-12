import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  images: string[];
  alt: string;
  startIndex?: number;
}

export const SkuGalleryDialog = ({ open, onOpenChange, images, alt, startIndex = 0 }: Props) => {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    if (open) setIdx(startIndex);
  }, [open, startIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  if (images.length === 0) return null;
  const current = images[idx] ?? images[0];
  const multi = images.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-2 sm:p-4 bg-background">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative">
          <img
            src={current}
            alt={`${alt} ${idx + 1}/${images.length}`}
            className="w-full h-auto max-h-[75vh] object-contain rounded"
            loading="lazy"
          />
          {multi && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow"
                onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow"
                onClick={() => setIdx((i) => (i + 1) % images.length)}
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur px-2 py-0.5 rounded text-xs font-medium">
                {idx + 1} / {images.length}
              </div>
            </>
          )}
        </div>
        {multi && (
          <div className="flex gap-2 overflow-x-auto pt-2">
            {images.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={() => setIdx(i)}
                className={`flex-shrink-0 rounded overflow-hidden border-2 transition ${
                  i === idx ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                }`}
                aria-label={`Image ${i + 1}`}
              >
                <img src={url} alt={`thumb ${i + 1}`} className="w-16 h-16 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
