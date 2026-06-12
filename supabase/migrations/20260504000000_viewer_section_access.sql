-- viewer_section_access: ให้ admin กำหนดว่า viewer คนไหนเห็น section ไหนได้
CREATE TABLE public.viewer_section_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department public.department NOT NULL,
  UNIQUE(user_id, department)
);
ALTER TABLE public.viewer_section_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage viewer_section_access" ON public.viewer_section_access
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users view own section access" ON public.viewer_section_access
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- อัปเดต skus SELECT policy: admin เห็นทุก, dept role เห็น dept ตัวเอง, viewer เห็นแค่ที่ได้รับสิทธิ์
DROP POLICY IF EXISTS "Authenticated view skus" ON public.skus;
CREATE POLICY "Authenticated view skus" ON public.skus
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (department = 'art'::public.department      AND public.has_role(auth.uid(), 'art'::public.app_role))
    OR (department = 'wd'::public.department       AND public.has_role(auth.uid(), 'wd'::public.app_role))
    OR (department = 'equipment'::public.department AND public.has_role(auth.uid(), 'equipment'::public.app_role))
    OR EXISTS (
      SELECT 1 FROM public.viewer_section_access vsa
      WHERE vsa.user_id = auth.uid() AND vsa.department = skus.department
    )
  );

-- sync_logs ด้วย
DROP POLICY IF EXISTS "Authenticated view sync_logs" ON public.sync_logs;
CREATE POLICY "Authenticated view sync_logs" ON public.sync_logs
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (department = 'art'::public.department      AND public.has_role(auth.uid(), 'art'::public.app_role))
    OR (department = 'wd'::public.department       AND public.has_role(auth.uid(), 'wd'::public.app_role))
    OR (department = 'equipment'::public.department AND public.has_role(auth.uid(), 'equipment'::public.app_role))
    OR EXISTS (
      SELECT 1 FROM public.viewer_section_access vsa
      WHERE vsa.user_id = auth.uid() AND vsa.department = sync_logs.department
    )
  );
