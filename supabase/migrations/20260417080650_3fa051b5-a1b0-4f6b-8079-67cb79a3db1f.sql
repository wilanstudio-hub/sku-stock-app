ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill from existing single image_url
UPDATE public.skus
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND image_url <> '' AND (image_urls IS NULL OR array_length(image_urls,1) IS NULL);