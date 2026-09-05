import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEAT_LIMITS_MAP: Record<string, number> = {
  free: 3,
  solo: 1,
  team: 8,
  studio: 20,
};

async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",").reduce((acc: Record<string, string>, item) => {
      const [k, v] = item.trim().split("=");
      if (k && v) acc[k] = v;
      return acc;
    }, {});

    const timestamp = parts["t"];
    const v1Signatures = sigHeader
      .split(",")
      .map((item) => item.trim().split("="))
      .filter(([key]) => key === "v1")
      .map(([, value]) => value)
      .filter(Boolean) as string[];
    if (!timestamp || v1Signatures.length === 0) return false;

    // Reject timestamps older than 5 minutes
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - parseInt(timestamp, 10)) > 300) return false;

    const payload = `${timestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedSig = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const computedBytes = new Uint8Array(signatureBuffer);
    return v1Signatures.some((signature) => {
      if (signature.length !== computedSig.length) return false;
      let difference = 0;
      for (let i = 0; i < signature.length; i += 1) {
        difference |= signature.charCodeAt(i) ^ computedSig.charCodeAt(i);
      }
      // Keep the byte conversion alive so the comparison remains tied to the HMAC output.
      return difference === 0 && computedBytes.length === 32;
    });
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const rawBody = await req.text();
  const stripeSig = req.headers.get("Stripe-Signature");
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  // Billing webhooks must be authenticated; never accept an unsigned production request.
  if (!stripeWebhookSecret || !stripeSig) {
    return new Response(JSON.stringify({ error: "Missing Stripe webhook signature" }), { status: 400 });
  }

  const isValid = await verifyStripeSignature(rawBody, stripeSig, stripeWebhookSecret);
  if (!isValid) {
    return new Response(JSON.stringify({ error: "Invalid Stripe signature" }), { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const eventId = event?.id;
  const eventType = event?.type || "unknown";
  const provider = "stripe";
  if (!eventId || typeof eventId !== "string") {
    return new Response(JSON.stringify({ error: "Missing event id" }), { status: 400 });
  }

  // Step 1: Webhook Idempotency Check in billing_events table
  const { data: existingEvent } = await supabaseAdmin
    .from("billing_events")
    .select("status")
    .eq("provider", provider)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent && existingEvent.status === "processed") {
    return new Response(JSON.stringify({ received: true, note: "Already processed" }), { status: 200 });
  }

  // Insert processing record
  const { error: eventInsertError } = await supabaseAdmin.from("billing_events").upsert({
    provider,
    event_id: eventId,
    event_type: eventType,
    status: "processing",
    received_at: new Date().toISOString(),
  });
  if (eventInsertError) throw eventInsertError;

  try {
    let companyId: string | null = null;
    let planId: string = "team";
    let customerId: string | null = null;
    let subscriptionId: string | null = null;

    if (eventType === "checkout.session.completed") {
      const session = event.data?.object;
      companyId = session?.metadata?.company_id;
      planId = session?.metadata?.plan || "team";
      customerId = session?.customer;
      subscriptionId = session?.subscription;
    } else if (
      eventType === "invoice.payment_succeeded" ||
      eventType === "customer.subscription.updated" ||
      eventType === "customer.subscription.deleted" ||
      eventType === "invoice.payment_failed"
    ) {
      const sub = event.data?.object;
      companyId = sub?.metadata?.company_id;
      planId = sub?.metadata?.plan || "team";
      customerId = sub?.customer;
      subscriptionId = sub?.id;
    }

    if (companyId) {
      const seatLimit = SEAT_LIMITS_MAP[planId] || 5;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const billingStatus = eventType === "customer.subscription.deleted"
        ? "cancelled"
        : eventType === "invoice.payment_failed"
        ? "past_due"
        : "active";
      const { error: companyUpdateError } = await supabaseAdmin
        .from("companies")
        .update({
          billing_plan: planId,
          billing_status: billingStatus,
          billing_provider: provider,
          billing_customer_id: customerId,
          billing_subscription_id: subscriptionId,
          billing_expires_at: expiresAt.toISOString(),
          seat_limit: seatLimit,
        })
        .eq("id", companyId);
      if (companyUpdateError) throw companyUpdateError;

      // Mark event processed
      const { error: eventUpdateError } = await supabaseAdmin
        .from("billing_events")
        .update({
          status: "processed",
          company_id: companyId,
          processed_at: new Date().toISOString(),
        })
        .eq("provider", provider)
        .eq("event_id", eventId);
      if (eventUpdateError) throw eventUpdateError;
    } else {
      const { error: eventUpdateError } = await supabaseAdmin
        .from("billing_events")
        .update({
          status: "ignored_no_company",
          processed_at: new Date().toISOString(),
        })
        .eq("provider", provider)
        .eq("event_id", eventId);
      if (eventUpdateError) throw eventUpdateError;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    await supabaseAdmin
      .from("billing_events")
      .update({
        status: "error",
        error_message: err?.message || String(err),
      })
      .eq("provider", provider)
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
});
