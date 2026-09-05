import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_CLOCK_SKEW_SECONDS = 300;
const APP_KEY = "open_pipeline";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(rawBody: string, req: Request, secret: string): Promise<boolean> {
  const timestamp = req.headers.get("X-Open-Timestamp") ?? "";
  const signature = req.headers.get("X-Open-Signature") ?? "";
  const timestampNumber = Number(timestamp);
  if (!timestamp || !signature || !Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > MAX_CLOCK_SKEW_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${timestamp}.POST./functions/v1/open-pipeline-integration.${rawBody}`;
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  return timingSafeEqual(toHex(new Uint8Array(digest)), signature.toLowerCase());
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("OPEN_PIPELINE_INTEGRATION_SECRET");
  if (!secret) return json({ error: "Integration is not configured" }, 503);

  const rawBody = await req.text();
  if (!(await verifySignature(rawBody, req, secret))) return json({ error: "Unauthorized" }, 401);

  let body: {
    action?: string;
    company_id?: string;
    project_id?: string;
    project_name?: string;
    start_at?: string;
    end_at?: string;
    idempotency_key?: string;
    items?: Array<{ sku_code?: string; quantity?: number }>;
    reservation_id?: string;
    status?: string;
    user_id?: string;
    user_email?: string;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const companyId = body.company_id?.trim();
  const openCompanyId = req.headers.get("X-Open-Company-Id")?.trim();
  if (!companyId || !openCompanyId || companyId !== openCompanyId) {
    return json({ error: "Company binding is required" }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: link, error: linkError } = await supabaseAdmin
    .from("app_integration_links")
    .select("company_id, external_company_id, enabled")
    .eq("app_key", APP_KEY)
    .eq("external_company_id", companyId)
    .eq("enabled", true)
    .maybeSingle();
  if (linkError || !link) return json({ error: "Company integration is not linked" }, 403);

  const tenantCompanyId = link.company_id as string;
  const action = body.action;

  try {
    if (action === "availability") {
      const codes = Array.isArray(body.items)
        ? body.items.map((item) => item.sku_code?.trim()).filter((value): value is string => Boolean(value))
        : [];
      let query = supabaseAdmin
        .from("skus")
        .select("id, sku_code, name_th, name_en, department, category, location, quantity, unit, current_status")
        .eq("company_id", tenantCompanyId)
        .limit(50);
      if (codes.length > 0) query = query.in("sku_code", codes);
      const { data: skus, error } = await query;
      if (error) throw error;

      const skuCodes = (skus ?? []).map((sku) => sku.sku_code);
      const { data: reservations, error: reservationError } = await supabaseAdmin
        .from("inventory_reservation_items")
        .select("sku_code, quantity, inventory_reservations!inner(status, start_at, end_at)")
        .eq("company_id", tenantCompanyId)
        .in("sku_code", skuCodes.length ? skuCodes : ["__none__"]);
      if (reservationError) throw reservationError;

      const now = Date.now();
      const reserved = new Map<string, number>();
      for (const row of reservations ?? []) {
        const relation = row.inventory_reservations as unknown as { status: string; start_at: string; end_at: string } | Array<{ status: string; start_at: string; end_at: string }>;
        const reservation = Array.isArray(relation) ? relation[0] : relation;
        if (!reservation) continue;
        if (["reserved", "checked_out"].includes(reservation.status)
          && Date.parse(reservation.start_at) <= now && Date.parse(reservation.end_at) > now) {
          reserved.set(row.sku_code, (reserved.get(row.sku_code) ?? 0) + row.quantity);
        }
      }
      return json({
        company_id: companyId,
        items: (skus ?? []).map((sku) => ({
          ...sku,
          reserved_quantity: reserved.get(sku.sku_code) ?? 0,
          available_quantity: Math.max(0, sku.quantity - (reserved.get(sku.sku_code) ?? 0)),
        })),
      });
    }

    if (action === "reserve") {
      if (!body.project_id || !body.project_name || !isValidDate(body.start_at) || !isValidDate(body.end_at)
        || !body.idempotency_key || !body.user_email || !Array.isArray(body.items)) {
        return json({ error: "project, date window, actor, idempotency key, and items are required" }, 400);
      }
      const { data, error } = await supabaseAdmin.rpc("create_inventory_reservation", {
        p_company_id: tenantCompanyId,
        p_external_project_id: body.project_id,
        p_external_project_name: body.project_name,
        p_start_at: body.start_at,
        p_end_at: body.end_at,
        p_requested_by: body.user_email,
        p_idempotency_key: body.idempotency_key,
        p_items: body.items,
      });
      if (error) throw error;
      return json({ company_id: companyId, reservation: data }, 201);
    }

    if (action === "reservation") {
      if (!body.reservation_id) return json({ error: "reservation_id is required" }, 400);
      const { data, error } = await supabaseAdmin
        .from("inventory_reservations")
        .select("id, external_project_id, external_project_name, status, start_at, end_at, requested_by, created_at, updated_at, inventory_reservation_items(sku_code, quantity)")
        .eq("id", body.reservation_id)
        .eq("company_id", tenantCompanyId)
        .eq("external_project_id", body.project_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Reservation not found" }, 404);
      return json({ company_id: companyId, reservation: data });
    }

    if (action === "reservations") {
      const { data, error } = await supabaseAdmin
        .from("inventory_reservations")
        .select("id, external_project_id, external_project_name, status, start_at, end_at, requested_by, created_at, updated_at, inventory_reservation_items(sku_code, quantity)")
        .eq("company_id", tenantCompanyId)
        .eq("external_project_id", body.project_id)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return json({ company_id: companyId, reservations: data ?? [] });
    }

    if (action === "set_reservation_status") {
      if (!body.project_id || !body.reservation_id || !body.status || !body.user_email) {
        return json({ error: "project_id, reservation_id, status, and actor are required" }, 400);
      }
      const { data: ownedReservation, error: ownershipError } = await supabaseAdmin
        .from("inventory_reservations")
        .select("id")
        .eq("id", body.reservation_id)
        .eq("company_id", tenantCompanyId)
        .eq("external_project_id", body.project_id)
        .maybeSingle();
      if (ownershipError) throw ownershipError;
      if (!ownedReservation) return json({ error: "Reservation not found" }, 404);

      const { data, error } = await supabaseAdmin.rpc("set_inventory_reservation_status", {
        p_company_id: tenantCompanyId,
        p_reservation_id: body.reservation_id,
        p_status: body.status,
        p_actor: body.user_email,
      });
      if (error) throw error;
      return json({ company_id: companyId, reservation: data });
    }

    return json({ error: "Unknown integration action" }, 400);
  } catch (error) {
    console.error("[open-pipeline-integration] request failed", error instanceof Error ? error.message : String(error));
    return json({ error: error instanceof Error ? error.message : "Integration request failed" }, 400);
  }
});
