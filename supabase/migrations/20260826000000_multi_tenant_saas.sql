-- Migration: 20260826000000_multi_tenant_saas.sql
-- Description: Multi-Tenant SaaS control plane schema, company registration, and data isolation policies.

-- 1. Create companies table (control-plane metadata)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | active | suspended
  contact_name text,
  contact_email text,
  logo_url text,
  subscription_expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Seed initial company
INSERT INTO public.companies (slug, name, status, contact_name, contact_email)
VALUES ('wilan', 'Wilan Studio', 'active', 'Platform Admin', 'wilanstudio@gmail.com')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status;

-- 3. RLS Policies for companies table
DO $$ BEGIN
  -- Public registration: anyone can request a company registration with pending status
  DROP POLICY IF EXISTS "Anon create pending company" ON public.companies;
  CREATE POLICY "Anon create pending company"
    ON public.companies FOR INSERT TO anon
    WITH CHECK (status = 'pending');

  -- Public read of active company metadata by slug (for subdomain resolution)
  DROP POLICY IF EXISTS "Public read active companies" ON public.companies;
  CREATE POLICY "Public read active companies"
    ON public.companies FOR SELECT TO anon
    USING (status = 'active');

  -- Authenticated read: All authenticated users can read active company details
  DROP POLICY IF EXISTS "Authenticated read active companies" ON public.companies;
  CREATE POLICY "Authenticated read active companies"
    ON public.companies FOR SELECT TO authenticated
    USING (true);

  -- Admin manage: Admins can update/delete company status and details
  DROP POLICY IF EXISTS "Admins manage companies" ON public.companies;
  CREATE POLICY "Admins manage companies"
    ON public.companies FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
