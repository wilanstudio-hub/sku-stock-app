-- Fix overly permissive USING (true) policies across the inventory schema

-- 1. profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. skus
DROP POLICY IF EXISTS "Authenticated view skus" ON public.skus;
DROP POLICY IF EXISTS "Public read skus by sku_code" ON public.skus;
DROP POLICY IF EXISTS "Users view dept skus" ON public.skus;

CREATE POLICY "Users view dept skus"
  ON public.skus FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (department = 'art' AND public.has_role(auth.uid(), 'art'))
    OR (department = 'wd' AND public.has_role(auth.uid(), 'wd'))
    OR (department = 'equipment' AND public.has_role(auth.uid(), 'equipment'))
  );

-- 3. sync_logs
DROP POLICY IF EXISTS "Authenticated view sync_logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users view dept sync_logs" ON public.sync_logs;
CREATE POLICY "Users view dept sync_logs"
  ON public.sync_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (department = 'art' AND public.has_role(auth.uid(), 'art'))
    OR (department = 'wd' AND public.has_role(auth.uid(), 'wd'))
    OR (department = 'equipment' AND public.has_role(auth.uid(), 'equipment'))
  );

-- 4. sku_transactions
DROP POLICY IF EXISTS "auth_select_transactions" ON public.sku_transactions;
DROP POLICY IF EXISTS "anon_select_transactions" ON public.sku_transactions;
DROP POLICY IF EXISTS "Users view dept transactions" ON public.sku_transactions;
CREATE POLICY "Users view dept transactions"
  ON public.sku_transactions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- 5. google_sheets_registry
DROP POLICY IF EXISTS "registry_select_authenticated" ON public.google_sheets_registry;
DROP POLICY IF EXISTS "Admins and equipment view registry" ON public.google_sheets_registry;
CREATE POLICY "Admins and equipment view registry"
  ON public.google_sheets_registry FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'equipment')
  );

-- 6. departments
DROP POLICY IF EXISTS "departments_select_authenticated" ON public.departments;
DROP POLICY IF EXISTS "Users view departments" ON public.departments;
CREATE POLICY "Users view departments"
  ON public.departments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
