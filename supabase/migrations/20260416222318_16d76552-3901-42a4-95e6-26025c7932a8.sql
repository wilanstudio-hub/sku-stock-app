CREATE TYPE public.sku_availability AS ENUM ('available', 'unavailable');
ALTER TABLE public.skus ADD COLUMN availability public.sku_availability NOT NULL DEFAULT 'available';