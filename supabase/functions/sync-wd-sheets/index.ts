import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHEET_ID = "1ZVRs-havfr9b--LYYSdXDODKmNbiHBCQZpuswM3DFog";

// Meta/template tabs that never contain inventory rows — skip them.
const SKIP_TABS = new Set([
  "Lists", "Wardrobe", "README", "Template", "Overview", "Summary", "Index",
]);

// Extracts a Google Drive file ID from any standard share/view link and returns
// a direct lh3.googleusercontent.com CDN URL.  This format avoids the 302
// redirect that uc?export=view issues, which browsers increasingly block in
// <img> tags. The file must be shared as "Anyone with the link – Viewer".
function parseDriveUrl(raw: string): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  // /file/d/ID/...
  let m = s.match(/\/file\/d\/([\w-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  // ?id=ID or &id=ID  (open?id=..., uc?id=..., etc.)
  m = s.match(/[?&]id=([\w-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  // Bare file ID (Google Drive IDs are typically 25-44 URL-safe chars)
  if (/^[\w-]{25,}$/.test(s)) return `https://lh3.googleusercontent.com/d/${s}`;
  return null;
}

function normalizeTitle(raw: string): string {
  return String(raw)
    .replace(/[­​‌‍⁠﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAllTabs(
  sheetId: string,
  apiKey: string,
): Promise<{ name: string; gid: string }[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties&key=${apiKey}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API ${res.status}: ${body}`);
  }
  const meta = await res.json();
  return (meta.sheets as any[])
    .map((s: any) => ({
      name: normalizeTitle(s.properties.title),
      gid: String(s.properties.sheetId),
    }))
    .filter(
      (t) =>
        t.name !== "" &&
        !SKIP_TABS.has(t.name) &&
        !t.name.toLowerCase().startsWith("copy of"),
    );
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let dryRun = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        dryRun = !!body?.dryRun;
      } catch { /* no body */ }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supaUser.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const supaAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await supaAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "wd",
    );
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "ต้องมีสิทธิ์ WD หรือ Admin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Discover all data tabs dynamically from the spreadsheet.
    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_SHEETS_API_KEY secret is not set");
    const TABS = await fetchAllTabs(SHEET_ID, apiKey);

    // Paginate to bypass PostgREST's 1000-row default cap.
    const existingSet = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supaAdmin
        .from("skus")
        .select("sku_code")
        .eq("department", "wd")
        .range(from, from + 999);
      if (!page?.length) break;
      for (const r of page) existingSet.add(r.sku_code);
      if (page.length < 1000) break;
    }

    let inserted = 0;
    let updated = 0;
    const perTab: Record<string, { inserted: number; updated: number }> = {};
    const errors: string[] = [];
    const sheetSkus = new Set<string>();

    for (const tab of TABS) {
      const tabName = tab.name;
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${tab.gid}`;
      const res = await fetch(url);
      if (!res.ok) { errors.push(`${tabName}: HTTP ${res.status}`); continue; }
      const csv = await res.text();
      const rows = parseCSV(csv);
      if (rows.length < 2) { perTab[tabName] = { inserted: 0, updated: 0 }; continue; }

      const header = rows[0].map((h) => h.trim());
      const idx = (n: string) =>
        header.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      const iStyle = idx("Era/Style");
      const iGender = idx("Gender");
      const iColor = idx("Color");
      const iSize = idx("Size");
      const iSerial = idx("Serial");
      const iSku = idx("SKU (Auto)");
      const iDesc = idx("Description");
      const iLoc = idx("Location");
      const iCond = idx("Condition");
      const iCost = idx("Replacement Cost");
      const iSource = idx("Source/Rental");
      const iScene = idx("Scene(s)");
      const iNotes = idx("Notes");
      const iRemark = idx("Remark");
      // Probe common image-column names (EN + TH variants); first match wins.
      const iImage = [
        "Image", "Photo", "Photos", "Picture", "Pictures",
        "Image URL", "Image Link", "Photo URL", "Drive Link", "Drive URL", "Link",
        "รูปภาพ", "รูป", "ลิงค์รูปภาพ", "ลิงก์รูปภาพ", "ลิงค์รูป", "ลิงก์รูป",
        "ลิงค์", "ลิงก์", "URL รูป", "URL รูปภาพ", "Google Drive", "ลิงค์ Google Drive",
      ].map(idx).find((i) => i >= 0) ?? -1;

      if (iSku < 0) {
        errors.push(`${tabName}: missing SKU column`);
        perTab[tabName] = { inserted: 0, updated: 0 };
        continue;
      }

      const insertRecords: any[] = [];
      const updateRecords: any[] = [];
      let tabInserted = 0;
      let tabUpdated = 0;
      const seenInTab = new Set<string>();

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every((c) => !c?.trim())) continue;

        const sku = (row[iSku] ?? "").trim();
        if (!sku || sku.startsWith("---") || sku.toUpperCase() === "SKU (AUTO)") continue;
        sheetSkus.add(sku);
        const desc = ((iDesc >= 0 ? row[iDesc] : "") ?? "").trim() || sku;
        if (seenInTab.has(sku)) continue;
        seenInTab.add(sku);

        const isUpdate = existingSet.has(sku);
        if (isUpdate) tabUpdated++; else tabInserted++;

        const features =
          [
            iCond >= 0 && row[iCond] && `Condition: ${row[iCond]}`,
            iSize >= 0 && row[iSize] && `Size: ${row[iSize]}`,
            iGender >= 0 && row[iGender] && `Gender: ${row[iGender]}`,
            iSerial >= 0 && row[iSerial] && `Serial: ${row[iSerial]}`,
            iCost >= 0 && row[iCost] && `Cost: ${row[iCost]}`,
            iSource >= 0 && row[iSource] && `Source: ${row[iSource]}`,
            iScene >= 0 && row[iScene] && `Scene: ${row[iScene]}`,
          ]
            .filter(Boolean)
            .join(" | ") || null;

        const noteParts = [
          iNotes >= 0 && row[iNotes] ? row[iNotes].trim() : "",
          iRemark >= 0 && row[iRemark] ? `Remark: ${row[iRemark].trim()}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        const record: any = {
          department: "wd",
          sku_code: sku,
          name_th: desc,
          name_en: desc,
          category: tabName,
          color: iColor >= 0 ? ((row[iColor] ?? "").trim() || null) : null,
          style: iStyle >= 0 ? ((row[iStyle] ?? "").trim() || null) : null,
          location: iLoc >= 0 ? ((row[iLoc] ?? "").trim() || null) : null,
          quantity: 1,
          unit: null,
          special_features: features,
          notes_th: noteParts || null,
          ...(iImage >= 0 && { image_url: parseDriveUrl(row[iImage] ?? "") }),
        };
        if (isUpdate) {
          updateRecords.push(record);
        } else {
          insertRecords.push({ ...record, created_by: userId, availability: "available" });
        }
      }

      if (!dryRun) {
        const runBatch = async (records: any[]) => {
          for (let i = 0; i < records.length; i += 500) {
            const chunk = records.slice(i, i + 500);
            const { error } = await supaAdmin
              .from("skus")
              .upsert(chunk, { onConflict: "sku_code", ignoreDuplicates: false });
            if (error) { errors.push(`${tabName}: ${error.message}`); break; }
          }
        };
        await runBatch(insertRecords);
        await runBatch(updateRecords);
      }

      perTab[tabName] = { inserted: tabInserted, updated: tabUpdated };
      inserted += tabInserted;
      updated += tabUpdated;
    }

    // ── Orphan cleanup ──────────────────────────────────────────────────────────
    const orphanedSkus = Array.from(existingSet).filter((s) => !sheetSkus.has(s));
    let deleted = 0;

    if (orphanedSkus.length > 0) {
      if (!dryRun) {
        for (let i = 0; i < orphanedSkus.length; i += 500) {
          const chunk = orphanedSkus.slice(i, i + 500);
          const { error } = await supaAdmin
            .from("skus")
            .delete()
            .eq("department", "wd")   // CRITICAL: never delete other departments
            .in("sku_code", chunk);
          if (error) errors.push(`cleanup: ${error.message}`);
          else deleted += chunk.length;
        }
      } else {
        deleted = orphanedSkus.length;
      }
    }
    // ───────────────────────────────────────────────────────────────────────────

    if (!dryRun) {
      await supaAdmin.from("sync_logs").insert({
        department: "wd",
        inserted, updated, deleted,
        per_category: perTab,
        errors,
        triggered_by: userId,
      });
    }

    return new Response(
      JSON.stringify({ success: true, dryRun, inserted, updated, deleted, perTab, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
