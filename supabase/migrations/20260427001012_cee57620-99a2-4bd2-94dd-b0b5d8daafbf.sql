-- Add new enum values
ALTER TYPE public.department ADD VALUE IF NOT EXISTS 'equipment';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'equipment';