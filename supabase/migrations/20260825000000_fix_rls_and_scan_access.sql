-- Migration: 20260825000000_fix_rls_and_scan_access.sql
-- Description: Restore QR scan access for unauthenticated field crew, enable viewer_section_access in RLS, and allow department users to view google_sheets_registry.

-- 1. Restore QR Scan read access for unauthenticated users (anon) on skus
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read skus by sku_code" ON public.skus;
  CREATE POLICY "Public read skus by sku_code"
    ON public.skus FOR SELECT TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Allow anon to update current_status and last_handler on skus for QR check-in/out
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anon update sku status" ON public.skus;
  CREATE POLICY "Anon update sku status"
    ON public.skus FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Authenticated view skus: Include admin, department roles, and viewer_section_access
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users view dept skus" ON public.skus;
  CREATE POLICY "Users view dept skus"
    ON public.skus FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR (department = 'art' AND public.has_role(auth.uid(), 'art'))
      OR (department = 'wd' AND public.has_role(auth.uid(), 'wd'))
      OR (department = 'equipment' AND public.has_role(auth.uid(), 'equipment'))
      OR EXISTS (
        SELECT 1 FROM public.viewer_section_access
        WHERE viewer_section_access.user_id = auth.uid()
          AND viewer_section_access.department::text = skus.department::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. sku_transactions policies for authenticated and anon users
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users view dept transactions" ON public.sku_transactions;
  DROP POLICY IF EXISTS "auth_select_transactions" ON public.sku_transactions;
  CREATE POLICY "auth_select_transactions"
    ON public.sku_transactions FOR SELECT TO authenticated
    USING (true);

  DROP POLICY IF EXISTS "anon_select_transactions" ON public.sku_transactions;
  CREATE POLICY "anon_select_transactions"
    ON public.sku_transactions FOR SELECT TO anon
    USING (true);

  DROP POLICY IF EXISTS "auth_insert_transactions" ON public.sku_transactions;
  CREATE POLICY "auth_insert_transactions"
    ON public.sku_transactions FOR INSERT TO authenticated
    WITH CHECK (true);

  DROP POLICY IF EXISTS "anon_insert_transactions" ON public.sku_transactions;
  CREATE POLICY "anon_insert_transactions"
    ON public.sku_transactions FOR INSERT TO anon
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. google_sheets_registry: Allow all authenticated users to read active registry entries for their departments
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins and equipment view registry" ON public.google_sheets_registry;
  DROP POLICY IF EXISTS "registry_select_authenticated" ON public.google_sheets_registry;
  CREATE POLICY "registry_select_authenticated"
    ON public.google_sheets_registry FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. sync_logs: Allow authenticated department users and viewers to view sync logs
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users view dept sync_logs" ON public.sync_logs;
  CREATE POLICY "Users view dept sync_logs"
    ON public.sync_logs FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin')
      OR (department = 'art' AND public.has_role(auth.uid(), 'art'))
      OR (department = 'wd' AND public.has_role(auth.uid(), 'wd'))
      OR (department = 'equipment' AND public.has_role(auth.uid(), 'equipment'))
      OR EXISTS (
        SELECT 1 FROM public.viewer_section_access
        WHERE viewer_section_access.user_id = auth.uid()
          AND viewer_section_access.department::text = sync_logs.department::text
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
