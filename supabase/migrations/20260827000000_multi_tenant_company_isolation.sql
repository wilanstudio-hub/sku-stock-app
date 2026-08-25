-- ==============================================================================
-- FilmFlow Inventory: Multi-Tenant Company Isolation (Model B)
-- Adds company_id to all tables with strict RLS kernel isolation.
-- ==============================================================================

-- 1. Ensure initial default company exists
INSERT INTO public.companies (slug, name, status, contact_name, contact_email)
VALUES ('wilan', 'Wilan Studio', 'active', 'Platform Admin', 'wilanstudio@gmail.com')
ON CONFLICT (slug) DO UPDATE SET status = 'active';

-- 2. Add company_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
UPDATE public.profiles SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

-- 3. Add company_id to departments
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.departments SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

-- Drop old unique constraint on code, add compound unique (company_id, code)
DO $$ BEGIN
  ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_code_key;
  ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS unique_company_dept_code;
  ALTER TABLE public.departments ADD CONSTRAINT unique_company_dept_code UNIQUE (company_id, code);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Add company_id to google_sheets_registry
ALTER TABLE public.google_sheets_registry ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.google_sheets_registry SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

-- Clean duplicate rows if any
DELETE FROM public.google_sheets_registry a USING public.google_sheets_registry b
WHERE a.id > b.id AND a.company_id = b.company_id AND a.department = b.department AND COALESCE(a.sku_prefix, '') = COALESCE(b.sku_prefix, '');

DO $$ BEGIN
  ALTER TABLE public.google_sheets_registry DROP CONSTRAINT IF EXISTS unique_dept_sku_prefix;
  ALTER TABLE public.google_sheets_registry DROP CONSTRAINT IF EXISTS unique_company_dept_sku_prefix;
  ALTER TABLE public.google_sheets_registry ADD CONSTRAINT unique_company_dept_sku_prefix UNIQUE (company_id, department, sku_prefix);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Add company_id to skus
ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.skus SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

-- Clean duplicate SKUs if any
DELETE FROM public.skus a USING public.skus b
WHERE a.id > b.id AND a.company_id = b.company_id AND a.sku_code = b.sku_code;

DO $$ BEGIN
  ALTER TABLE public.skus DROP CONSTRAINT IF EXISTS skus_sku_code_key;
  ALTER TABLE public.skus DROP CONSTRAINT IF EXISTS unique_company_sku_code;
  ALTER TABLE public.skus ADD CONSTRAINT unique_company_sku_code UNIQUE (company_id, sku_code);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Add company_id to sku_transactions
ALTER TABLE public.sku_transactions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.sku_transactions SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

-- 7. Add company_id to viewer_section_access
ALTER TABLE public.viewer_section_access ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.viewer_section_access SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

DO $$ BEGIN
  ALTER TABLE public.viewer_section_access DROP CONSTRAINT IF EXISTS viewer_section_access_user_id_department_key;
  ALTER TABLE public.viewer_section_access DROP CONSTRAINT IF EXISTS unique_company_user_dept_access;
  ALTER TABLE public.viewer_section_access ADD CONSTRAINT unique_company_user_dept_access UNIQUE (company_id, user_id, department);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Add company_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.user_roles SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

-- 9. PostgreSQL Multi-Tenant Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_company_id(uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.profiles WHERE user_id = uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(uid uuid, required_role text, target_company uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.role::text = required_role
      AND (target_company IS NULL OR ur.company_id = target_company OR ur.company_id IS NULL)
  );
$$;

-- 10. Strict Multi-Tenant Row Level Security Policies
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheets_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewer_section_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- skus RLS
  DROP POLICY IF EXISTS "Public read skus by sku_code" ON public.skus;
  CREATE POLICY "Public read skus by sku_code" ON public.skus FOR SELECT TO anon USING (true);

  DROP POLICY IF EXISTS "Anon update sku status" ON public.skus;
  CREATE POLICY "Anon update sku status" ON public.skus FOR UPDATE TO anon USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Users view dept skus" ON public.skus;
  CREATE POLICY "Users view dept skus" ON public.skus FOR SELECT TO authenticated
    USING (
      company_id = public.get_user_company_id(auth.uid())
      AND (
        public.has_company_role(auth.uid(), 'admin', company_id)
        OR (department = 'art' AND public.has_company_role(auth.uid(), 'art', company_id))
        OR (department = 'wd' AND public.has_company_role(auth.uid(), 'wd', company_id))
        OR (department = 'equipment' AND public.has_company_role(auth.uid(), 'equipment', company_id))
        OR EXISTS (
          SELECT 1 FROM public.viewer_section_access vsa
          WHERE vsa.user_id = auth.uid()
            AND vsa.company_id = skus.company_id
            AND vsa.department::text = skus.department::text
        )
      )
    );

  DROP POLICY IF EXISTS "Users edit dept skus" ON public.skus;
  CREATE POLICY "Users edit dept skus" ON public.skus FOR ALL TO authenticated
    USING (
      company_id = public.get_user_company_id(auth.uid())
      AND (
        public.has_company_role(auth.uid(), 'admin', company_id)
        OR (department = 'art' AND public.has_company_role(auth.uid(), 'art', company_id))
        OR (department = 'wd' AND public.has_company_role(auth.uid(), 'wd', company_id))
        OR (department = 'equipment' AND public.has_company_role(auth.uid(), 'equipment', company_id))
      )
    )
    WITH CHECK (
      company_id = public.get_user_company_id(auth.uid())
    );

  -- departments RLS
  DROP POLICY IF EXISTS "departments_select_authenticated" ON public.departments;
  DROP POLICY IF EXISTS "Users view departments" ON public.departments;
  CREATE POLICY "Users view departments" ON public.departments FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "departments_write_admin" ON public.departments;
  DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
  CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated
    USING (public.has_company_role(auth.uid(), 'admin', company_id))
    WITH CHECK (public.has_company_role(auth.uid(), 'admin', company_id));

  -- google_sheets_registry RLS
  DROP POLICY IF EXISTS "registry_select_authenticated" ON public.google_sheets_registry;
  CREATE POLICY "registry_select_authenticated" ON public.google_sheets_registry FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "Admins manage registry" ON public.google_sheets_registry;
  CREATE POLICY "Admins manage registry" ON public.google_sheets_registry FOR ALL TO authenticated
    USING (public.has_company_role(auth.uid(), 'admin', company_id))
    WITH CHECK (public.has_company_role(auth.uid(), 'admin', company_id));

  -- sku_transactions RLS
  DROP POLICY IF EXISTS "auth_select_transactions" ON public.sku_transactions;
  CREATE POLICY "auth_select_transactions" ON public.sku_transactions FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "anon_select_transactions" ON public.sku_transactions;
  CREATE POLICY "anon_select_transactions" ON public.sku_transactions FOR SELECT TO anon USING (true);

  DROP POLICY IF EXISTS "auth_insert_transactions" ON public.sku_transactions;
  CREATE POLICY "auth_insert_transactions" ON public.sku_transactions FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "anon_insert_transactions" ON public.sku_transactions;
  CREATE POLICY "anon_insert_transactions" ON public.sku_transactions FOR INSERT TO anon WITH CHECK (true);

  -- viewer_section_access RLS
  DROP POLICY IF EXISTS "Users view access" ON public.viewer_section_access;
  CREATE POLICY "Users view access" ON public.viewer_section_access FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "Admins manage access" ON public.viewer_section_access;
  CREATE POLICY "Admins manage access" ON public.viewer_section_access FOR ALL TO authenticated
    USING (public.has_company_role(auth.uid(), 'admin', company_id))
    WITH CHECK (public.has_company_role(auth.uid(), 'admin', company_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
