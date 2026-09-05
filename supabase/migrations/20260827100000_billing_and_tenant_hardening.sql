-- ==============================================================================
-- FilmFlow Inventory: Billing & Tenant Hardening Migration
-- Adds billing columns, seat limits, billing_events idempotency table,
-- and updates handle_new_user trigger to bind company_id on signup.
-- ==============================================================================

-- 1. Add billing metadata and seat limits to companies table
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS billing_plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_provider TEXT,
  ADD COLUMN IF NOT EXISTS billing_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 3;

-- Keep existing Starter tenants aligned with the public plan definition.
UPDATE public.companies
SET seat_limit = 3
WHERE billing_plan = 'free' AND seat_limit = 5;

-- 2. Create billing_events table for webhook idempotency
CREATE TABLE IF NOT EXISTS public.billing_events (
  provider       TEXT NOT NULL,
  event_id       TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'processing',
  company_id     UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  processed_at   TIMESTAMPTZ,
  error_message  TEXT,
  PRIMARY KEY (provider, event_id)
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read billing events" ON public.billing_events;
  CREATE POLICY "Admins read billing events"
    ON public.billing_events FOR SELECT TO authenticated
    USING (public.has_company_role(auth.uid(), 'admin', company_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Update handle_new_user() trigger function to auto-assign company_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
  assigned_role public.app_role;
  target_company_id UUID;
  meta_company_id TEXT;
  meta_tenant_slug TEXT;
BEGIN
  meta_company_id := NEW.raw_user_meta_data ->> 'company_id';
  meta_tenant_slug := NEW.raw_user_meta_data ->> 'tenant_slug';

  IF meta_company_id IS NOT NULL AND meta_company_id <> '' THEN
    BEGIN
      target_company_id := meta_company_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      target_company_id := NULL;
    END;
  END IF;

  IF target_company_id IS NULL AND meta_tenant_slug IS NOT NULL AND meta_tenant_slug <> '' THEN
    SELECT id INTO target_company_id FROM public.companies WHERE slug = meta_tenant_slug LIMIT 1;
  END IF;

  IF target_company_id IS NULL THEN
    SELECT id INTO target_company_id FROM public.companies WHERE slug = 'wilan' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, department, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'department',
    target_company_id
  );

  SELECT COUNT(*) INTO user_count FROM public.user_roles WHERE company_id = target_company_id;
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'viewer';
  END IF;

  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (NEW.id, assigned_role, target_company_id);

  RETURN NEW;
END; $$;

-- Enforce seats in the database so concurrent clients cannot bypass the UI guard.
CREATE OR REPLACE FUNCTION public.enforce_company_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_seats INTEGER;
  max_seats INTEGER;
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT seat_limit INTO max_seats
  FROM public.companies
  WHERE id = NEW.company_id
  FOR UPDATE;

  IF max_seats IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(DISTINCT user_id)::INTEGER INTO current_seats
  FROM public.user_roles
  WHERE company_id = NEW.company_id
    AND user_id <> NEW.user_id;

  IF current_seats >= max_seats THEN
    RAISE EXCEPTION 'Company seat limit reached (% seats)', max_seats
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_company_seat_limit_on_role_insert ON public.user_roles;
CREATE TRIGGER enforce_company_seat_limit_on_role_insert
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_seat_limit();
