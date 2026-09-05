import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVER_PLANS: Record<string, { name: string; priceBaht: number; seatLimit: number; stripePriceId?: string }> = {
  free: { name: "Starter", priceBaht: 0, seatLimit: 3 },
  solo: { name: "Solo Production", priceBaht: 550, seatLimit: 1 },
  team: { name: "Team Studio", priceBaht: 2500, seatLimit: 8 },
  studio: { name: "Studio Pro", priceBaht: 5000, seatLimit: 20 },
};

Deno.serve(async (req) => {
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  const respond = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Missing authorization token" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) return respond({ error: "Unauthorized user" }, 401);

    const body = await req.json();
    const { planId, companyId, provider = "stripe" } = body;

    const plan = SERVER_PLANS[planId];
    if (!plan) return respond({ error: `Invalid plan: ${planId}` }, 400);

    // Resolve company and ensure calling user has admin rights for this company
    const { data: company, error: compErr } = await supabaseAdmin
      .from("companies")
      .select("id, name, slug, billing_plan, seat_limit")
      .eq("id", companyId)
      .maybeSingle();

    if (compErr || !company) return respond({ error: "Company not found" }, 404);

    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_company_role", {
      uid: user.id,
      required_role: "admin",
      target_company: company.id,
    });
    if (roleErr || !isAdmin) return respond({ error: "Admin role required for this company" }, 403);

    const appUrl = Deno.env.get("APP_URL") || "https://filmflow-inventory.pages.dev";
    const checkoutAttemptId = crypto.randomUUID();

    // If free plan, update company directly
    if (plan.priceBaht === 0) {
      const { error: updateErr } = await supabaseAdmin
        .from("companies")
        .update({
          billing_plan: "free",
          billing_status: "active",
          seat_limit: plan.seatLimit,
        })
        .eq("id", company.id);
      if (updateErr) throw updateErr;

      return respond({ success: true, mode: "instant", plan: planId, seatLimit: plan.seatLimit });
    }

    // Hosted Stripe Checkout creation
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeSecretKey && provider === "stripe") {
      const params = new URLSearchParams();
      params.append("mode", "subscription");
      params.append("client_reference_id", checkoutAttemptId);
      params.append("success_url", `${appUrl}/admin?session_id={CHECKOUT_SESSION_ID}&billing=success`);
      params.append("cancel_url", `${appUrl}/admin?billing=cancelled`);
      params.append("metadata[company_id]", company.id);
      params.append("metadata[plan]", planId);
      params.append("metadata[seat_limit]", String(plan.seatLimit));
      params.append("subscription_data[metadata][company_id]", company.id);
      params.append("subscription_data[metadata][plan]", planId);

      // Line item (recurring monthly THB)
      params.append("line_items[0][price_data][currency]", "thb");
      params.append("line_items[0][price_data][product_data][name]", `FilmFlow Ctrl+ ${plan.name} (${plan.seatLimit} Seats)`);
      params.append("line_items[0][price_data][recurring][interval]", "month");
      params.append("line_items[0][price_data][unit_amount]", String(plan.priceBaht * 100));
      params.append("line_items[0][quantity]", "1");

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const session = await stripeRes.json();
      if (!stripeRes.ok) {
        throw new Error(session?.error?.message || "Failed to create Stripe session");
      }

      return respond({
        success: true,
        mode: "hosted_checkout",
        url: session.url,
        sessionId: session.id,
        attemptId: checkoutAttemptId,
      });
    }

    // Direct simulation fallback if gateway keys are not configured yet
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: updateErr } = await supabaseAdmin
      .from("companies")
      .update({
        billing_plan: planId,
        billing_status: "active",
        seat_limit: plan.seatLimit,
        billing_expires_at: expiresAt.toISOString(),
      })
      .eq("id", company.id);
    if (updateErr) throw updateErr;

    return respond({
      success: true,
      mode: "direct_activation",
      plan: planId,
      seatLimit: plan.seatLimit,
      message: `Activated ${plan.name} successfully`,
    });
  } catch (err: any) {
    return respond({ error: err?.message || String(err) }, 500);
  }
});
