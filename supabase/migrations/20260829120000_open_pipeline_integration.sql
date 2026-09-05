-- Open / Pipeline integration
--
-- Open remains the owner of projects and workflow. Inventory remains the owner
-- of SKU, stock, and reservation state. The integration API uses the service
-- role and these tables are intentionally not exposed through the browser.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS open_company_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS open_tenant_slug TEXT;

CREATE TABLE IF NOT EXISTS public.app_integration_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  app_key TEXT NOT NULL,
  external_company_id TEXT NOT NULL UNIQUE,
  external_tenant_slug TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, app_key)
);

CREATE INDEX IF NOT EXISTS idx_app_integration_links_company
  ON public.app_integration_links(company_id, app_key, enabled);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  external_project_id TEXT NOT NULL,
  external_project_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'checked_out', 'cancelled', 'returned')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  requested_by TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  UNIQUE (company_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_project
  ON public.inventory_reservations(company_id, external_project_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_window
  ON public.inventory_reservations(company_id, start_at, end_at);

CREATE TABLE IF NOT EXISTS public.inventory_reservation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.inventory_reservations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku_id UUID REFERENCES public.skus(id) ON DELETE SET NULL,
  sku_code TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, sku_code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservation_items_sku
  ON public.inventory_reservation_items(company_id, sku_code);

CREATE TABLE IF NOT EXISTS public.app_integration_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  app_key TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  reservation_id UUID REFERENCES public.inventory_reservations(id) ON DELETE SET NULL,
  detail JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_integration_audit_company
  ON public.app_integration_audit(company_id, created_at DESC);

ALTER TABLE public.app_integration_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_integration_audit ENABLE ROW LEVEL SECURITY;

-- Row Level Security policies:
-- Edge function operates via service_role.
-- Authenticated users within the company can view reservations and update status.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users view company reservations" ON public.inventory_reservations;
  CREATE POLICY "Users view company reservations" ON public.inventory_reservations
    FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "Users update company reservations" ON public.inventory_reservations;
  CREATE POLICY "Users update company reservations" ON public.inventory_reservations
    FOR UPDATE TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()))
    WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "Users view company reservation items" ON public.inventory_reservation_items;
  CREATE POLICY "Users view company reservation items" ON public.inventory_reservation_items
    FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "Users view company integration links" ON public.app_integration_links;
  CREATE POLICY "Users view company integration links" ON public.app_integration_links
    FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));

  DROP POLICY IF EXISTS "Users view company integration audit" ON public.app_integration_audit;
  CREATE POLICY "Users view company integration audit" ON public.app_integration_audit
    FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.create_inventory_reservation(
  p_company_id UUID,
  p_external_project_id TEXT,
  p_external_project_name TEXT,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_requested_by TEXT,
  p_idempotency_key TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
  reservation_id UUID;
  item JSONB;
  sku_row RECORD;
  reserved_qty INTEGER;
  requested_qty INTEGER;
  code TEXT;
BEGIN
  IF p_external_project_id IS NULL OR trim(p_external_project_id) = ''
     OR p_external_project_name IS NULL OR trim(p_external_project_name) = ''
     OR p_requested_by IS NULL OR trim(p_requested_by) = ''
     OR p_idempotency_key IS NULL OR trim(p_idempotency_key) = ''
     OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Invalid reservation request';
  END IF;

  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Reservation end must be after start';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_items) AS item
     GROUP BY trim(item->>'sku_code')
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate SKU in reservation';
  END IF;

  SELECT id INTO existing_id
  FROM inventory_reservations
  WHERE company_id = p_company_id AND idempotency_key = p_idempotency_key;
  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('reservation_id', existing_id, 'status', 'existing');
  END IF;

  -- Lock every requested SKU before calculating overlapping reservations. This
  -- prevents two concurrent Open requests from reserving the same stock.
  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    code := trim(item->>'sku_code');
    requested_qty := (item->>'quantity')::INTEGER;
    IF code IS NULL OR code = '' OR requested_qty IS NULL OR requested_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid SKU reservation item';
    END IF;

    SELECT id, sku_code, department, quantity
      INTO sku_row
      FROM skus
     WHERE company_id = p_company_id AND sku_code = code
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SKU not found: %', code;
    END IF;

    SELECT COALESCE(SUM(ri.quantity), 0)::INTEGER INTO reserved_qty
      FROM inventory_reservation_items ri
      JOIN inventory_reservations r ON r.id = ri.reservation_id
     WHERE ri.company_id = p_company_id
       AND ri.sku_code = code
       AND r.status IN ('reserved', 'checked_out')
       AND r.start_at < p_end_at
       AND r.end_at > p_start_at;

    IF sku_row.quantity - reserved_qty < requested_qty THEN
      RAISE EXCEPTION 'Insufficient availability for SKU %', code;
    END IF;
  END LOOP;

  INSERT INTO inventory_reservations (
    company_id, external_project_id, external_project_name,
    start_at, end_at, requested_by, idempotency_key
  ) VALUES (
    p_company_id, trim(p_external_project_id), trim(p_external_project_name),
    p_start_at, p_end_at, trim(p_requested_by), trim(p_idempotency_key)
  ) RETURNING id INTO reservation_id;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    code := trim(item->>'sku_code');
    requested_qty := (item->>'quantity')::INTEGER;
    SELECT id INTO sku_row FROM skus
     WHERE company_id = p_company_id AND sku_code = code;
    INSERT INTO inventory_reservation_items (
      reservation_id, company_id, sku_id, sku_code, quantity
    ) VALUES (reservation_id, p_company_id, sku_row.id, code, requested_qty);
  END LOOP;

  INSERT INTO app_integration_audit (
    company_id, app_key, actor_email, action, reservation_id, detail
  ) VALUES (
    p_company_id, 'open_pipeline', p_requested_by, 'reservation.created', reservation_id,
    jsonb_build_object('project_id', p_external_project_id, 'project_name', p_external_project_name,
                       'start_at', p_start_at, 'end_at', p_end_at, 'items', p_items)
  );

  RETURN jsonb_build_object('reservation_id', reservation_id, 'status', 'reserved');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_inventory_reservation_status(
  p_company_id UUID,
  p_reservation_id UUID,
  p_status TEXT,
  p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
  project_name TEXT;
BEGIN
  IF p_status NOT IN ('checked_out', 'cancelled', 'returned') THEN
    RAISE EXCEPTION 'Invalid reservation status';
  END IF;

  SELECT status, external_project_name INTO current_status, project_name
    FROM inventory_reservations
   WHERE id = p_reservation_id AND company_id = p_company_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF current_status IN ('cancelled', 'returned') THEN
    RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', current_status);
  END IF;
  IF p_status = 'returned' AND current_status <> 'checked_out' THEN
    RAISE EXCEPTION 'Only checked-out reservations can be returned';
  END IF;
  IF p_status = 'checked_out' AND current_status <> 'reserved' THEN
    RAISE EXCEPTION 'Only reserved items can be checked out';
  END IF;

  UPDATE inventory_reservations
     SET status = p_status, updated_at = now()
   WHERE id = p_reservation_id AND company_id = p_company_id;

  INSERT INTO app_integration_audit (
    company_id, app_key, actor_email, action, reservation_id, detail
  ) VALUES (
    p_company_id, 'open_pipeline', p_actor, 'reservation.' || p_status, p_reservation_id,
    jsonb_build_object('previous_status', current_status, 'new_status', p_status)
  );

  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'status', p_status, 'project_name', project_name);
END;
$$;

-- These SECURITY DEFINER RPCs are internal implementation details of the
-- signed Edge Function. Supabase grants EXECUTE on new functions to PUBLIC by
-- default, so explicitly remove that privilege before granting service_role.
REVOKE ALL ON FUNCTION public.create_inventory_reservation(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_inventory_reservation_status(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_inventory_reservation(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_inventory_reservation_status(UUID, UUID, TEXT, TEXT) TO service_role;
