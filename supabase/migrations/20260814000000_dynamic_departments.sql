CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_th TEXT NOT NULL,
  icon TEXT DEFAULT 'package',
  sync_format TEXT DEFAULT 'equipment',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.departments (code, name_th, icon, sync_format, order_index) VALUES
('art', 'Art / อาร์ต', 'clapperboard', 'art', 1),
('wd', 'WD', 'shirt', 'wd', 2),
('equipment', 'Equipment / อุปกรณ์', 'camera', 'equipment', 3)
ON CONFLICT (code) DO UPDATE SET 
  name_th = EXCLUDED.name_th,
  icon = EXCLUDED.icon,
  sync_format = EXCLUDED.sync_format;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "departments_select_authenticated" ON public.departments FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "departments_write_admin" ON public.departments FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
