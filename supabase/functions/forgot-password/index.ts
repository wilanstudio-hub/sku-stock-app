import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let email: string;
  try {
    ({ email } = await req.json());
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!email || typeof email !== "string") {
    return json({ error: "email is required" }, 400);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Generate recovery link. Return success even if email not found to prevent
  // email enumeration on this internal tool.
  let recoveryLink: string;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: "https://wilan-stockcheck.pages.dev/update-password" },
    });
    if (error || !data?.properties?.action_link) {
      // User not found or error — return success silently
      return json({ success: true, lineSent: false });
    }
    recoveryLink = data.properties.action_link;
  } catch {
    return json({ success: true, lineSent: false });
  }

  // Look up LINE user ID
  let lineUserId: string | null = null;
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (authUser?.user?.id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("line_user_id")
        .eq("user_id", authUser.user.id)
        .single();
      lineUserId = profile?.line_user_id ?? null;
    }
  } catch {
    // Non-fatal — proceed without LINE
  }

  // Send email via Resend
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return json({ error: "RESEND_API_KEY not configured" }, 500);
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Wilan Studio <noreply@wilanstudioresend.xyz>",
      to: [email],
      subject: "รีเซ็ตรหัสผ่าน — Wilan Studio",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#1a1a1a;">
          <div style="margin-bottom:24px;">
            <span style="font-size:22px;font-weight:700;">SKU Stock</span>
            <span style="font-size:14px;color:#888;margin-left:8px;">by Wilan Studio</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:20px;">รีเซ็ตรหัสผ่าน</h2>
          <p style="color:#555;margin:0 0 24px;">คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
          <a href="${recoveryLink}"
            style="display:inline-block;background:#ff5a1f;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
            ตั้งรหัสผ่านใหม่
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px;">
            ลิงก์นี้ใช้ได้ครั้งเดียวและจะหมดอายุใน 1 ชั่วโมง<br>
            หากคุณไม่ได้ขอรีเซ็ต กรุณาเพิกเฉยต่ออีเมลนี้
          </p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const body = await emailRes.text();
    return json({ error: `Resend error: ${body}` }, 502);
  }

  // Send LINE push message (best-effort — failure does not block email)
  let lineSent = false;
  if (lineUserId) {
    try {
      const accessToken = await getLineAccessToken();
      if (accessToken) {
        const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: lineUserId,
            messages: [
              {
                type: "text",
                text: `🔐 รีเซ็ตรหัสผ่าน — Wilan Studio SKU Stock\n\nคลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่:\n\n${recoveryLink}\n\n⏱ ลิงก์หมดอายุใน 1 ชั่วโมง`,
              },
            ],
          }),
        });
        lineSent = pushRes.ok;
      }
    } catch {
      // Non-fatal
    }
  }

  return json({ success: true, lineSent });
});

async function getLineAccessToken(): Promise<string | null> {
  // Prefer a pre-issued long-lived token stored as a secret
  const stored = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (stored) return stored;

  // Fall back to issuing a short-lived token from Channel credentials
  const channelId = Deno.env.get("LINE_CHANNEL_ID");
  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
  if (!channelId || !channelSecret) return null;

  try {
    const res = await fetch("https://api.line.me/v2/oauth/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });
    if (!res.ok) return null;
    const { access_token } = await res.json();
    return access_token ?? null;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
