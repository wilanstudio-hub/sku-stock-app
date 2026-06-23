-- Create the Google Sheets registry table if it doesn't exist yet.
-- This tracks all linked spreadsheets per department together with the
-- sku_prefix that gets prepended to every generated SKU code for that sheet.
-- The main warehouse always has sku_prefix = '' so its existing codes are unchanged.
CREATE TABLE IF NOT EXISTS public.google_sheets_registry (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  sheet_id    TEXT        NOT NULL,
  department  TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  sku_prefix  TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add sku_prefix in case the table already existed without it.
ALTER TABLE public.google_sheets_registry
  ADD COLUMN IF NOT EXISTS sku_prefix TEXT NOT NULL DEFAULT '';

-- Seed the main Equipment warehouse row (prefix = '' means no prepend).
INSERT INTO public.google_sheets_registry (name, sheet_id, department, is_active, sku_prefix)
VALUES (
  'คลังหลัก Equipment',
  '10JzJsTHJaahqsJ0xFtGxOQX_Q0pPuHxuRQiXN-_jr-w',
  'equipment',
  true,
  ''
)
ON CONFLICT DO NOTHING;

-- RLS: admins and equipment role can manage; all authenticated users can read.
ALTER TABLE public.google_sheets_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "registry_select_authenticated"
    ON public.google_sheets_registry FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "registry_write_admin"
    ON public.google_sheets_registry FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
