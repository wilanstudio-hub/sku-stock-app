ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS deleted integer NOT NULL DEFAULT 0;
