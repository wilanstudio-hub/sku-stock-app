CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  key TEXT UNIQUE NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT,
  image_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view zones" ON public.zones FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anon view zones" ON public.zones FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage zones" ON public.zones FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed the 13 existing basement zones already referenced in src/constants/zones.ts.
INSERT INTO public.zones (key, name_th, name_en, order_index) VALUES
  ('A', 'ZONE BOX', 'ZONE BOX', 1),
  ('B', 'SH1-SHELVING UNIT1 (ชั้นวางที่ 1)', 'SH1-SHELVING UNIT1', 2),
  ('C', 'รถเข็นพยาบาล', 'Medical Cart', 3),
  ('D', 'SH2-SHELVING UNIT2 (ชั้นวางที่ 2)', 'SH2-SHELVING UNIT2', 4),
  ('E', 'ZONE BOX ART 1', 'ZONE BOX ART 1', 5),
  ('F', 'ZONE BOX ART 2', 'ZONE BOX ART 2', 6),
  ('G', 'ถุงรองเท้า', 'Shoe Bag', 7),
  ('H', 'BOX WD', 'BOX WD', 8),
  ('I', 'ZONE BOX ART 3', 'ZONE BOX ART 3', 9),
  ('J', 'SH-YLW YELLOW SHELVING (ชั้นวางสีเหลือง)', 'SH-YLW YELLOW SHELVING', 10),
  ('K', 'ZONE BOX ART 4', 'ZONE BOX ART 4', 11),
  ('L', 'FOAM ZONE', 'FOAM ZONE', 12),
  ('M', 'ZONE BOX ART 5', 'ZONE BOX ART 5', 13)
ON CONFLICT (key) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  order_index = EXCLUDED.order_index;
