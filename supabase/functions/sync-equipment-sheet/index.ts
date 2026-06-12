import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHEET_ID = "10JzJsTHJaahqsJ0xFtGxOQX_Q0pPuHxuRQiXN-_jr-w";

// Meta/template tabs that never contain inventory rows — skip them.
const SKIP_TABS = new Set([
  "Lists", "README", "Template", "Overview", "Summary", "Index", "Equipment",
]);

// Known tabs: preserve their prefix so existing SKU codes never change.
// Any tab added to the spreadsheet later gets a derived prefix automatically.
const PREFIX_MAP: Record<string, { prefix: string; schema: "standard" | "charging" }> = {
  "Camera & Battery":                         { prefix: "CAM", schema: "standard" },
  "Accessories & Support":                    { prefix: "ACC", schema: "standard" },
  "Lens & Filter & Stepdown Ring":            { prefix: "LEN", schema: "standard" },
  "Lighting & Light Control & Light Stand":   { prefix: "LIT", schema: "standard" },
  "Grip & Tripods":                           { prefix: "GRP", schema: "standard" },
  "Sound":                                    { prefix: "SND", schema: "standard" },
  "HDD & Memory Card":                        { prefix: "HDD", schema: "standard" },
  "Charging Checklist":                       { prefix: "CHG", schema: "charging" },
  "Charging Checklist 02":                    { prefix: "CH2", schema: "charging" },
};

// Derive a stable 3-4 char prefix for tabs not in PREFIX_MAP.
// Uses first ASCII alpha characters; falls back to a GID-based suffix for Thai names.
function deriveTabConfig(
  name: string,
  gid: string,
): { prefix: string; schema: "standard" | "charging" } {
  const schema: "standard" | "charging" = /charging/i.test(name)
    ? "charging"
    : "standard";
  const ascii = name.replace(/[^A-Za-z]/g, "");
  const prefix = ascii.length >= 3
    ? ascii.substring(0, 4).toUpperCase()
    : ("X" + gid).slice(-4).toUpperCase();
  return { prefix, schema };
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
): Promise<{ name: string; gid: string; prefix: string; schema: "standard" | "charging" }[]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties&key=${apiKey}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API ${res.status}: ${body}`);
  }
  const meta = await res.json();
  return (meta.sheets as any[])
    .map((s: any) => {
      const name = normalizeTitle(s.properties.title);
      const gid = String(s.properties.sheetId);
      const config = PREFIX_MAP[name] ?? deriveTabConfig(name, gid);
      return { name, gid, ...config };
    })
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

function parseQtyMultiplier(s: string): number {
  if (!s) return 1;
  const m = s.trim().match(/x\s*(\d+)/i);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return isNaN(n) || n <= 0 ? 1 : n;
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
      (r: any) => r.role === "admin" || r.role === "equipment",
    );
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "ต้องมีสิทธิ์ Equipment หรือ Admin" }),
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
        .eq("department", "equipment")
        .range(from, from + 999);
      if (!page?.length) break;
      for (const r of page) existingSet.add(r.sku_code);
      if (page.length < 1000) break;
    }

    const insertRecords: any[] = [];
    const updateRecords: any[] = [];
    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;
    const perTab: Record<string, { inserted: number; updated: number }> = {};
    const sheetSkus = new Set<string>();

    // Standard schema columns: 0=No 1=ว่าง 2=ติดงาน 3=ประเภท(qty x3) 4=ชื่อ 5=Serial 6=Loc.มีนบุรี 7=Loc.นนทบุรี 8=Remark 9=น้ำหนัก
    // Charging schema: 0=(empty) 1=Status 2=Quantity 3=ชื่อ 4=Charge Date
    const STD = { no: 0, free: 1, busy: 2, type: 3, name: 4, serial: 5, locMin: 6, locNon: 7, remark: 8, weight: 9 };
    const CHG = { status: 1, qty: 2, name: 3, date: 4 };

    for (const tab of TABS) {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${tab.gid}`;
      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`${tab.name}: HTTP ${res.status}`);
        continue;
      }
      const csv = await res.text();
      const rows = parseCSV(csv);
      if (rows.length < 2) { perTab[tab.name] = { inserted: 0, updated: 0 }; continue; }

      let seq = 0;
      perTab[tab.name] = perTab[tab.name] ?? { inserted: 0, updated: 0 };

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every((c) => !c?.trim())) continue;

        if (tab.schema === "standard") {
          const noStr = (row[STD.no] ?? "").trim();
          const name = (row[STD.name] ?? "").trim();
          if (noStr.toLowerCase() === "no." || (noStr === "" && !name)) continue;
          if (name.toLowerCase() === "ชื่อ") continue;
          if (!name) continue;
          const noNum = parseInt(noStr.replace(/\D/g, ""), 10);
          if (isNaN(noNum) || noNum <= 0) continue;
          seq++;

          const qty = parseQtyMultiplier(row[STD.type] ?? "");
          const serial = (row[STD.serial] ?? "").trim();
          const remark = (row[STD.remark] ?? "").trim();
          const weight = (row[STD.weight] ?? "").trim();
          const locMin = (row[STD.locMin] ?? "").trim();
          const locNon = (row[STD.locNon] ?? "").trim();

          const locParts: string[] = [];
          if (locMin) locParts.push(`มีนบุรี: ${locMin}`);
          if (locNon) locParts.push(`นนทบุรี: ${locNon}`);
          const location = locParts.join(" | ") || null;

          const noteParts: string[] = [];
          if (serial) noteParts.push(`Serial: ${serial}`);
          if (weight) noteParts.push(`น้ำหนัก: ${weight}`);
          if (remark) noteParts.push(`Remark: ${remark}`);
          const notes = noteParts.join(" | ") || null;

          const busy = (row[STD.busy] ?? "").trim();
          const availability: "available" | "on_event" | "unavailable" = busy
            ? "on_event"
            : "available";

          const sku = `EQ-${tab.prefix}-${String(seq).padStart(3, "0")}`;
          sheetSkus.add(sku);
          const record: any = {
            department: "equipment",
            sku_code: sku,
            name_th: name,
            name_en: name,
            category: tab.name,
            location,
            quantity: qty,
            unit: "ชิ้น",
            notes_th: notes,
            special_features: weight ? `น้ำหนัก: ${weight}` : null,
          };
          const isUpdate = existingSet.has(sku);
          if (isUpdate) {
            updateRecords.push(record);
            updated++;
            perTab[tab.name].updated++;
          } else {
            insertRecords.push({ ...record, created_by: userId, availability });
            inserted++;
            perTab[tab.name].inserted++;
          }
        } else {
          // charging checklist schema
          const name = (row[CHG.name] ?? "").trim();
          const status = (row[CHG.status] ?? "").trim();
          if (!name) continue;
          if (name.toLowerCase() === "charge date" || status.toLowerCase() === "status") continue;
          // skip pure section header rows (no qty + no status + no date)
          const qtyCell = (row[CHG.qty] ?? "").trim();
          const dateCell = (row[CHG.date] ?? "").trim();
          if (!qtyCell && !dateCell && !status) continue;
          seq++;

          const qty = parseQtyMultiplier(qtyCell);
          const sku = `EQ-${tab.prefix}-${String(seq).padStart(3, "0")}`;
          const noteParts: string[] = [];
          if (status) noteParts.push(`Status: ${status}`);
          if (dateCell) noteParts.push(`Charge Date: ${dateCell}`);
          const record: any = {
            department: "equipment",
            sku_code: sku,
            name_th: name,
            name_en: name,
            category: tab.name,
            location: null,
            quantity: qty,
            unit: "ชิ้น",
            notes_th: noteParts.join(" | ") || null,
            special_features: null,
          };
          const isUpdate = existingSet.has(sku);
          if (isUpdate) {
            updateRecords.push(record);
            updated++;
            perTab[tab.name].updated++;
          } else {
            insertRecords.push({ ...record, created_by: userId, availability: "available" });
            inserted++;
            perTab[tab.name].inserted++;
          }
        }
      }
    }

    if (!dryRun) {
      const runBatch = async (records: any[]) => {
        for (let i = 0; i < records.length; i += 500) {
          const chunk = records.slice(i, i + 500);
          const { error } = await supaAdmin
            .from("skus")
            .upsert(chunk, { onConflict: "sku_code", ignoreDuplicates: false });
          if (error) { errors.push(error.message); break; }
        }
      };
      await runBatch(insertRecords);
      await runBatch(updateRecords);
    }

    // ── Orphan cleanup ──────────────────────────────────────────────────────────
    // Any SKU that was in the DB but is no longer anywhere in the sheet is orphaned.
    // Deletion is SCOPED to department="equipment" to never touch Art or WD rows.
    const orphanedSkus = Array.from(existingSet).filter((s) => !sheetSkus.has(s));
    let deleted = 0;

    if (orphanedSkus.length > 0) {
      if (!dryRun) {
        for (let i = 0; i < orphanedSkus.length; i += 500) {
          const chunk = orphanedSkus.slice(i, i + 500);
          const { error } = await supaAdmin
            .from("skus")
            .delete()
            .eq("department", "equipment")   // CRITICAL: never delete other departments
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
        department: "equipment",
        inserted,
        updated,
        deleted,
        per_category: perTab,
        errors,
        triggered_by: userId,
      });
    }

    return new Response(
      JSON.stringify({ success: true, dryRun, inserted, updated, deleted, orphanedSkus: dryRun ? orphanedSkus : [], perTab, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
