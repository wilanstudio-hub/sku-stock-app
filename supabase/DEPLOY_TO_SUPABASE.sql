-- ==============================================================================
-- FilmFlow-Inventory: 100% Idempotent Migration & RLS Deployment Script
-- Project: vztmwwfbhxlzyantrnmq (FilmFlow-Inventory)
-- ==============================================================================

-- 1. Departments Table & Schema Migration
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_th text NOT NULL,
  icon text DEFAULT 'package',
  sync_format text DEFAULT 'equipment',
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Ensure all optional columns exist if table was created previously
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS name_en text DEFAULT '';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS color text DEFAULT 'text-amber-500';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS sync_format text DEFAULT 'equipment';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

INSERT INTO public.departments (code, name_th, name_en, icon, sync_format, order_index)
VALUES
  ('art', 'Art / อาร์ต', 'Art', 'clapperboard', 'art', 1),
  ('wd', 'WD / เสื้อผ้า', 'Wardrobe', 'shirt', 'wd', 2),
  ('equipment', 'Equipment / อุปกรณ์', 'Equipment', 'camera', 'equipment', 3)
ON CONFLICT (code) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  icon = EXCLUDED.icon,
  sync_format = EXCLUDED.sync_format,
  order_index = EXCLUDED.order_index;

-- 2. Google Sheets Registry Table
CREATE TABLE IF NOT EXISTS public.google_sheets_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  sheet_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  sheet_name text NOT NULL DEFAULT '',
  sku_prefix text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.google_sheets_registry ADD COLUMN IF NOT EXISTS name text DEFAULT '';
ALTER TABLE public.google_sheets_registry ADD COLUMN IF NOT EXISTS sheet_name text DEFAULT '';
ALTER TABLE public.google_sheets_registry ADD COLUMN IF NOT EXISTS sku_prefix text DEFAULT '';
ALTER TABLE public.google_sheets_registry ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.google_sheets_registry ENABLE ROW LEVEL SECURITY;

-- 3. Viewer Section Access Table
CREATE TABLE IF NOT EXISTS public.viewer_section_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, department)
);

ALTER TABLE public.viewer_section_access ENABLE ROW LEVEL SECURITY;

-- 4. Multi-Tenant Companies (Control Plane) Table
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  contact_name text,
  contact_email text,
  logo_url text,
  subscription_expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

INSERT INTO public.companies (slug, name, status, contact_name, contact_email)
VALUES ('wilan', 'Wilan Studio', 'active', 'Platform Admin', 'wilanstudio@gmail.com')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status;

-- 5. Row-Level Security Policies
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- skus policies
  DROP POLICY IF EXISTS "Public read skus by sku_code" ON public.skus;
  CREATE POLICY "Public read skus by sku_code" ON public.skus FOR SELECT TO anon USING (true);

  DROP POLICY IF EXISTS "Anon update sku status" ON public.skus;
  CREATE POLICY "Anon update sku status" ON public.skus FOR UPDATE TO anon USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS "Users view dept skus" ON public.skus;
  CREATE POLICY "Users view dept skus" ON public.skus FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR (department = 'art' AND public.has_role(auth.uid(), 'art'))
      OR (department = 'wd' AND public.has_role(auth.uid(), 'wd'))
      OR (department = 'equipment' AND public.has_role(auth.uid(), 'equipment'))
      OR EXISTS (SELECT 1 FROM public.viewer_section_access WHERE viewer_section_access.user_id = auth.uid() AND viewer_section_access.department::text = skus.department::text)
    );

  DROP POLICY IF EXISTS "Users edit dept skus" ON public.skus;
  CREATE POLICY "Users edit dept skus" ON public.skus FOR ALL TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR (department = 'art' AND public.has_role(auth.uid(), 'art'))
      OR (department = 'wd' AND public.has_role(auth.uid(), 'wd'))
      OR (department = 'equipment' AND public.has_role(auth.uid(), 'equipment'))
    );

  -- sku_transactions policies
  DROP POLICY IF EXISTS "auth_select_transactions" ON public.sku_transactions;
  CREATE POLICY "auth_select_transactions" ON public.sku_transactions FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "anon_select_transactions" ON public.sku_transactions;
  CREATE POLICY "anon_select_transactions" ON public.sku_transactions FOR SELECT TO anon USING (true);

  DROP POLICY IF EXISTS "auth_insert_transactions" ON public.sku_transactions;
  CREATE POLICY "auth_insert_transactions" ON public.sku_transactions FOR INSERT TO authenticated WITH CHECK (true);

  DROP POLICY IF EXISTS "anon_insert_transactions" ON public.sku_transactions;
  CREATE POLICY "anon_insert_transactions" ON public.sku_transactions FOR INSERT TO anon WITH CHECK (true);

  -- google_sheets_registry policies
  DROP POLICY IF EXISTS "registry_select_authenticated" ON public.google_sheets_registry;
  CREATE POLICY "registry_select_authenticated" ON public.google_sheets_registry FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "Admins manage registry" ON public.google_sheets_registry;
  CREATE POLICY "Admins manage registry" ON public.google_sheets_registry FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

  -- departments policies
  DROP POLICY IF EXISTS "departments_select_authenticated" ON public.departments;
  DROP POLICY IF EXISTS "Users view departments" ON public.departments;
  CREATE POLICY "departments_select_authenticated" ON public.departments FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "departments_write_admin" ON public.departments;
  DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
  CREATE POLICY "departments_write_admin" ON public.departments FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

  -- companies policies
  DROP POLICY IF EXISTS "Anon create pending company" ON public.companies;
  CREATE POLICY "Anon create pending company" ON public.companies FOR INSERT TO anon WITH CHECK (status = 'pending');

  DROP POLICY IF EXISTS "Public read active companies" ON public.companies;
  CREATE POLICY "Public read active companies" ON public.companies FOR SELECT TO anon USING (status = 'active');

  DROP POLICY IF EXISTS "Authenticated read active companies" ON public.companies;
  CREATE POLICY "Authenticated read active companies" ON public.companies FOR SELECT TO authenticated USING (true);

  DROP POLICY IF EXISTS "Admins manage companies" ON public.companies;
  CREATE POLICY "Admins manage companies" ON public.companies FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- 11. Multi-Tenant Company Isolation (Model B) Schema & RLS
-- ==============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
UPDATE public.profiles SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.departments SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

DO $$ BEGIN
  ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_code_key;
  ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS unique_company_dept_code;
  ALTER TABLE public.departments ADD CONSTRAINT unique_company_dept_code UNIQUE (company_id, code);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.google_sheets_registry ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.google_sheets_registry SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

DO $$ BEGIN
  ALTER TABLE public.google_sheets_registry DROP CONSTRAINT IF EXISTS unique_dept_sku_prefix;
  ALTER TABLE public.google_sheets_registry DROP CONSTRAINT IF EXISTS unique_company_dept_sku_prefix;
  ALTER TABLE public.google_sheets_registry ADD CONSTRAINT unique_company_dept_sku_prefix UNIQUE (company_id, department, sku_prefix);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.skus SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

DO $$ BEGIN
  ALTER TABLE public.skus DROP CONSTRAINT IF EXISTS skus_sku_code_key;
  ALTER TABLE public.skus DROP CONSTRAINT IF EXISTS unique_company_sku_code;
  ALTER TABLE public.skus ADD CONSTRAINT unique_company_sku_code UNIQUE (company_id, sku_code);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.sku_transactions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.sku_transactions SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

ALTER TABLE public.viewer_section_access ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.viewer_section_access SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

DO $$ BEGIN
  ALTER TABLE public.viewer_section_access DROP CONSTRAINT IF EXISTS viewer_section_access_user_id_department_key;
  ALTER TABLE public.viewer_section_access DROP CONSTRAINT IF EXISTS unique_company_user_dept_access;
  ALTER TABLE public.viewer_section_access ADD CONSTRAINT unique_company_user_dept_access UNIQUE (company_id, user_id, department);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.user_roles SET company_id = (SELECT id FROM public.companies WHERE slug = 'wilan' LIMIT 1) WHERE company_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_user_company_id(uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM public.profiles WHERE user_id = uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(uid uuid, required_role text, target_company uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.role = required_role
      AND (target_company IS NULL OR ur.company_id = target_company OR ur.company_id IS NULL)
  );
$$;
