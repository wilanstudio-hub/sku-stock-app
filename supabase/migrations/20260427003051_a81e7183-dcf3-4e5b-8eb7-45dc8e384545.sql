CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department public.department NOT NULL,
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  per_category jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors text[] NOT NULL DEFAULT '{}',
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_logs_dept_created ON public.sync_logs (department, created_at DESC);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view sync_logs"
ON public.sync_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Dept or admin insert sync_logs"
ON public.sync_logs FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (department = 'art'::public.department AND public.has_role(auth.uid(), 'art'::public.app_role))
  OR (department = 'wd'::public.department AND public.has_role(auth.uid(), 'wd'::public.app_role))
  OR (department = 'equipment'::public.department AND public.has_role(auth.uid(), 'equipment'::public.app_role))
);