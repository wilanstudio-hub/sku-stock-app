CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT,
  image_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, key)
);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view zones" ON public.zones FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage zones" ON public.zones FOR ALL TO authenticated
    USING (public.has_company_role(auth.uid(), 'admin', company_id))
    WITH CHECK (public.has_company_role(auth.uid(), 'admin', company_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed the 13 basement zones already in use (see src/constants/zones.ts) for the default tenant.
INSERT INTO public.zones (company_id, key, name_th, name_en, order_index)
SELECT c.id, z.key, z.name_th, z.name_en, z.order_index
FROM (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) c
CROSS JOIN (VALUES
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
) AS z(key, name_th, name_en, order_index)
WHERE c.id IS NOT NULL
ON CONFLICT (company_id, key) DO NOTHING;
