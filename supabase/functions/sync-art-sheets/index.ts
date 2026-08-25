import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SHEET_ID = Deno.env.get("DEFAULT_ART_SHEET_ID") || "";

const SKIP_TABS = new Set([
  "Lists", "README", "Props", "Template", "Overview", "Summary", "Index",
]);

function parseDriveUrl(raw: string): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  let m = s.match(/\/file\/d\/([\w-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  m = s.match(/[?&]id=([\w-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  if (/^[\w-]{25,}$/.test(s)) return `https://lh3.googleusercontent.com/d/${s}`;
  return null;
}

function normalizeTitle(raw: string): string {
  return String(raw).replace(/[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g, "").replace(/\s+/g, " ").trim();
}


async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const formattedKey = privateKey.replace(/\\n/g, "\n");
  const privateKeyObj = await importPKCS8(formattedKey, "RS256");
  const jwt = await new SignJWT({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: tokenUrl,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKeyObj);
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to get Google access token: " + JSON.stringify(data));
  return data.access_token;
}

async function fetchAllTabs(sheetId: string, accessToken: string): Promise<{ name: string; gid: string }[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    let message = `Google Sheets API ${res.status}: ${body}`;
    try {
      const json = JSON.parse(body);
      if (json.error?.message) message = json.error.message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  const meta = await res.json();
  return (meta.sheets as any[])
    .map((s: any) => ({ originalName: s.properties.title, name: normalizeTitle(s.properties.title), gid: String(s.properties.sheetId) }))
    .filter((t) => t.name !== "" && !SKIP_TABS.has(t.name) && !t.name.toLowerCase().startsWith("copy of"));
}

function parseQty(s: string): { qty: number; unit: string | null } {
  if (!s) return { qty: 0, unit: null };
  const m = s.trim().match(/^([\d,.]+)\s*(.*)$/);
  if (!m) return { qty: 0, unit: s.trim() || null };
  const qty = parseInt(m[1].replace(/[,.]/g, ""), 10);
  return { qty: isNaN(qty) ? 0 : qty, unit: m[2].trim() || null };
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(cell); cell = ""; }
      else if (c === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || cur.length) { cur.push(cell); rows.push(cur); }
  return rows;
}

type TabResult = {
  tabName: string;
  insertRecords: any[];
  updateRecords: any[];
  sheetSkusInTab: string[];
  stat: { inserted: number; updated: number };
  error?: string;
};

async function processTab(
  tab: { originalName: string; name: string; gid: string },
  sheetId: string,
  existingSet: Set<string>,
  userId: string,
  departmentCode: string,
  accessToken: string
): Promise<TabResult> {
  const tabName = tab.name;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("'" + tab.originalName + "'")}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    return { tabName, insertRecords: [], updateRecords: [], sheetSkusInTab: [], stat: { inserted: 0, updated: 0 }, error: `${tabName}: HTTP ${res.status} ${errorBody.substring(0, 100)}` };
  }
  const json = await res.json();
  const rows = (json.values as string[][]) || [];
  if (rows.length < 2) return { tabName, insertRecords: [], updateRecords: [], sheetSkusInTab: [], stat: { inserted: 0, updated: 0 } };

  const header = rows[0].map((h) => h.trim());
  const idx = (n: string) => header.findIndex((h) => h.toLowerCase() === n.toLowerCase());
  const iCheck = idx("Check the date");
  const iStyle = idx("Era/Style");
  const iColor = idx("Color");
  const iSize  = idx("Size");
  const iMat   = idx("Material");
  const iSku   = idx("SKU (Auto)");
  const iDesc  = idx("Description");
  const iQty   = idx("Quantity");
  const iLoc   = idx("Location");
  const iCond  = idx("Condition");
  const iNotes = idx("Notes");
  const iImage = [
    "Image", "Photo", "Photos", "Picture", "Pictures",
    "WD PHOTO (Front)", "WD PHOTO", "WD PHOTO (Side)", "WD PHOTO (Group)",
    "Image URL", "Image Link", "Photo URL", "Drive Link", "Drive URL", "Link",
    "รูปภาพ", "รูป", "ลิงค์รูปภาพ", "ลิงก์รูปภาพ", "ลิงค์รูป", "ลิงก์รูป",
    "ลิงค์", "ลิงก์", "URL รูป", "URL รูปภาพ", "Google Drive", "ลิงค์ Google Drive",
  ].map(idx).find((i) => i >= 0) ?? -1;

  if (iSku < 0 || iDesc < 0) {
    return { tabName, insertRecords: [], updateRecords: [], sheetSkusInTab: [], stat: { inserted: 0, updated: 0 }, error: `${tabName}: missing SKU/Description column` };
  }

  const insertRecords: any[] = [];
  const updateRecords: any[] = [];
  const sheetSkusInTab: string[] = [];
  const seenInTab = new Set<string>();
  let tabInserted = 0;
  let tabUpdated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !c?.trim())) continue;
    const sku = (row[iSku] ?? "").trim();
    if (!sku || sku.startsWith("---")) continue;
    sheetSkusInTab.push(sku);
    if (iCheck >= 0 && (row[iCheck] ?? "").trim().toUpperCase() !== "TRUE") continue;
    const desc = (row[iDesc] ?? "").trim();
    if (!desc || seenInTab.has(sku)) continue;
    seenInTab.add(sku);

    const isUpdate = existingSet.has(sku);
    if (isUpdate) tabUpdated++; else tabInserted++;
    const { qty, unit } = parseQty(iQty >= 0 ? (row[iQty] ?? "") : "");
    const features = [
      iCond >= 0 && row[iCond] && `Condition: ${row[iCond]}`,
      iSize >= 0 && row[iSize] && `Size: ${row[iSize]}`,
      iMat  >= 0 && row[iMat]  && `Material: ${row[iMat]}`,
    ].filter(Boolean).join(" | ") || null;

    const record: any = {
      department: departmentCode, sku_code: sku, name_th: desc, name_en: desc, category: tabName,
      color: iColor >= 0 ? ((row[iColor] ?? "").trim() || null) : null,
      style: iStyle >= 0 ? ((row[iStyle] ?? "").trim() || null) : null,
      location: iLoc >= 0 ? ((row[iLoc] ?? "").trim() || null) : null,
      quantity: qty, unit, special_features: features,
      notes_th: iNotes >= 0 ? ((row[iNotes] ?? "").trim() || null) : null,
      ...(iImage >= 0 && { image_url: parseDriveUrl(row[iImage] ?? "") }),
    };
    if (isUpdate) updateRecords.push(record);
    else insertRecords.push({ ...record, created_by: userId, availability: "available" });
  }

  return { tabName, insertRecords, updateRecords, sheetSkusInTab, stat: { inserted: tabInserted, updated: tabUpdated } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    const supaAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const departmentCode = url.searchParams.get("department") || "art";
    const { data } = await supaAdmin.from("sync_logs").select("errors").eq("department", departmentCode).order("created_at", { ascending: false }).limit(1);
    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    let dryRun = false;
    let bodySheetId: string | undefined;
    let departmentCode = "art";
    if (req.method === "POST") {
      try { const body = await req.json(); dryRun = !!body?.dryRun; bodySheetId = body?.sheetId; if (body?.department) departmentCode = body.department; } catch { /* no body */ }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supaUser.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const supaAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supaAdmin.from("user_roles").select("role").eq("user_id", userId),
      supaAdmin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle(),
    ]);

    const companyId = profile?.company_id || null;
    if (!(roles ?? []).some((r: any) => r.role === "admin" || r.role === departmentCode)) {
      return new Response(JSON.stringify({ error: `ต้องมีสิทธิ์ ${departmentCode} หรือ Admin` }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
    if (!clientEmail || !privateKey) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY not set");
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    
    let sheetToSync = DEFAULT_SHEET_ID;
    if (bodySheetId) {
      const query = supaAdmin.from("google_sheets_registry").select("sheet_id").eq("sheet_id", bodySheetId).eq("department", departmentCode).eq("is_active", true);
      if (companyId) query.eq("company_id", companyId);
      const { data: regRow } = await query.single();
      if (regRow) sheetToSync = regRow.sheet_id as string;
    } else {
      const query = supaAdmin.from("google_sheets_registry").select("sheet_id").eq("department", departmentCode).eq("is_active", true).eq("sku_prefix", "");
      if (companyId) query.eq("company_id", companyId);
      const { data: mainRows } = await query;
      if (mainRows && mainRows.length > 0) sheetToSync = mainRows[0].sheet_id as string;
    }

    if (!sheetToSync) {
      return new Response(
        JSON.stringify({ error: `ไม่พบ Google Sheet สำหรับแผนก ${departmentCode} กรุณาตั้งค่า Google Sheet ID ในหน้าจัดการชีทหรือจัดการแผนก` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Phase 1: fetch tab list + existing SKUs in parallel ───────────────────
    const [TABS, existingPage] = await Promise.all([
      fetchAllTabs(sheetToSync, accessToken),
      (async () => {
        const set = new Set<string>();
        for (let from = 0; ; from += 1000) {
          const q = supaAdmin.from("skus").select("sku_code").eq("department", departmentCode);
          if (companyId) q.eq("company_id", companyId);
          const { data: page } = await q.range(from, from + 999);
          if (!page?.length) break;
          for (const r of page) set.add(r.sku_code);
          if (page.length < 1000) break;
        }
        return set;
      })(),
    ]);
    const existingSet = existingPage;

    // ── Phase 2: fetch + parse ALL tabs in parallel ───────────────────────────
    const tabResults = [];
    for (const tab of TABS) {
      tabResults.push(await processTab(tab, sheetToSync, existingSet, userId, departmentCode, accessToken));
    }

    // ── Phase 3: collect results ──────────────────────────────────────────────
    let inserted = 0;
    let updated = 0;
    const perTab: Record<string, { inserted: number; updated: number }> = {};
    const errors: string[] = [];
    const allInsert: any[] = [];
    const allUpdate: any[] = [];
    const sheetSkus = new Set<string>();

    for (const r of tabResults) {
      if (r.error) errors.push(r.error);
      for (const rec of r.insertRecords) allInsert.push({ ...rec, company_id: companyId });
      for (const rec of r.updateRecords) allUpdate.push({ ...rec, company_id: companyId });
      for (const s of r.sheetSkusInTab) sheetSkus.add(s);
      perTab[r.tabName] = r.stat;
      inserted += r.stat.inserted;
      updated += r.stat.updated;
    }

    // ── Phase 4: single combined upsert ───────────────────────────────────────
    if (!dryRun) {
      const allRecords = [...allInsert, ...allUpdate];
      for (let i = 0; i < allRecords.length; i += 500) {
        const chunk = allRecords.slice(i, i + 500);
        const { error } = await supaAdmin
          .from("skus").upsert(chunk, { onConflict: "company_id,sku_code", ignoreDuplicates: false });
        if (error) errors.push(`upsert: ${error.message}`);
      }

      // Orphan cleanup
      const orphanedSkus = Array.from(existingSet).filter((s) => !sheetSkus.has(s));
      let deleted = 0;
      for (let i = 0; i < orphanedSkus.length; i += 500) {
        const chunk = orphanedSkus.slice(i, i + 500);
        const q = supaAdmin.from("skus").delete().eq("department", departmentCode).in("sku_code", chunk);
        if (companyId) q.eq("company_id", companyId);
        const { error } = await q;
        if (error) errors.push(`cleanup: ${error.message}`);
        else deleted += chunk.length;
      }

      await supaAdmin.from("sync_logs").insert({
        department: departmentCode, inserted, updated, deleted,
        per_category: perTab, errors, triggered_by: userId,
      });
    } else {
      // dry-run: count orphans without deleting
    }

    return new Response(
      JSON.stringify({ success: true, dryRun, inserted, updated, perTab, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
