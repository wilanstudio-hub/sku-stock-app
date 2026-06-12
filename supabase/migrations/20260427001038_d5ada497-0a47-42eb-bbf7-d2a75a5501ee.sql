DROP POLICY IF EXISTS "Dept or admin insert skus" ON public.skus;
DROP POLICY IF EXISTS "Dept or admin update skus" ON public.skus;
DROP POLICY IF EXISTS "Dept or admin delete skus" ON public.skus;

CREATE POLICY "Dept or admin insert skus" ON public.skus
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (department = 'art'::department AND has_role(auth.uid(), 'art'::app_role))
    OR (department = 'wd'::department AND has_role(auth.uid(), 'wd'::app_role))
    OR (department = 'equipment'::department AND has_role(auth.uid(), 'equipment'::app_role))
  );

CREATE POLICY "Dept or admin update skus" ON public.skus
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (department = 'art'::department AND has_role(auth.uid(), 'art'::app_role))
    OR (department = 'wd'::department AND has_role(auth.uid(), 'wd'::app_role))
    OR (department = 'equipment'::department AND has_role(auth.uid(), 'equipment'::app_role))
  );

CREATE POLICY "Dept or admin delete skus" ON public.skus
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (department = 'art'::department AND has_role(auth.uid(), 'art'::app_role))
    OR (department = 'wd'::department AND has_role(auth.uid(), 'wd'::app_role))
    OR (department = 'equipment'::department AND has_role(auth.uid(), 'equipment'::app_role))
  );