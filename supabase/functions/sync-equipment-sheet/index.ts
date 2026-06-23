import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://wilan-stockcheck.pages.dev",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
]);

// Fallback sheet used when no registry row exists (main warehouse, no prefix).
const DEFAULT_SHEET_ID = "10JzJsTHJaahqsJ0xFtGxOQX_Q0pPuHxuRQiXN-_jr-w";

// Meta/template tabs that never contain inventory rows — skip them.
const SKIP_TABS = new Set([
  "Lists", "README", "Template", "Overview", "Summary", "Index", "Equipment",
]);

// Known tabs: preserve their prefix so existing SKU codes never change.
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

function deriveTabConfig(
  name: string,
  gid: string,
): { prefix: string; schema: "standard" | "charging" } {
  const schema: "standard" | "charging" = /charging/i.test(name) ? "charging" : "standard";
  const ascii = name.replace(/[^A-Za-z]/g, "");
  const prefix = ascii.length >= 3
    ? ascii.substring(0, 4).toUpperCase()
    : ("X" + gid).slice(-4).toUpperCase();
  return { prefix, schema };
}

// Normalize a tab name for fuzzy PREFIX_MAP lookup: lowercase, collapse
// whitespace around "&", collapse repeated spaces.
function normKey(s: string): string {
  return s.toLowerCase().replace(/\s*&\s*/g, " & ").replace(/\s+/g, " ").trim();
}

// Look up a tab config by exact name first, then by fuzzy normalized name.
// This tolerates sheet tab names like "Lighting &Light control&light stand"
// matching the canonical "Lighting & Light Control & Light Stand" key.
function lookupTabConfig(name: string): { prefix: string; schema: "standard" | "charging" } | undefined {
  if (PREFIX_MAP[name]) return PREFIX_MAP[name];
  const n = normKey(name);
  for (const [key, val] of Object.entries(PREFIX_MAP)) {
    if (normKey(key) === n) return val;
  }
  return undefined;
}

function normalizeTitle(raw: string): string {
  return String(raw).replace(/[­​‌‍⁠﻿]/g, "").replace(/\s+/g, " ").trim();
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
      const config = lookupTabConfig(name) ?? deriveTabConfig(name, gid);
      return { name, gid, ...config };
    })
    .filter(
      (t) => t.name !== "" && !SKIP_TABS.has(t.name) && !t.name.toLowerCase().startsWith("copy of"),
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

// Column index constants (positional, matching template blueprint).
const STD = { no: 0, free: 1, busy: 2, type: 3, name: 4, serial: 5, locMin: 6, locNon: 7, remark: 8, weight: 9 };
const CHG = { status: 1, qty: 2, name: 3, date: 4 };

// Template keywords accepted for the Location column header.
const LOC_KEYWORDS = ["location", "loc.", "ที่เก็บ", "มีนบุรี", "สาขา"];

function normalizeCell(raw: unknown): string {
  return String(raw ?? "").replace(/[­​‌‍⁠﻿]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const HEADER_IDENT_RE = /^(no\.?|sku|#)$/i;

// Returns header row index + soft warnings if the tab looks like an inventory
// sheet; returns null if no recognisable inventory header is found (skip tab).
function detectInventoryHeader(
  rows: string[][],
  tabName: string,
): { headerRowIdx: number; warnings: string[] } | null {
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if ([0, 1, 2].some((col) => HEADER_IDENT_RE.test(normalizeCell(rows[i][col] ?? "")))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) return null;

  const headerRow = rows[headerRowIdx];
  const warnings: string[] = [];
  const hasName = headerRow.some((c) => {
    const n = normalizeCell(c);
    return n.includes("ชื่อ") || n.includes("name");
  });
  if (!hasName) warnings.push(`Name column missing (${tabName})`);
  const hasLoc = headerRow.some((c) => LOC_KEYWORDS.some((k) => normalizeCell(c).includes(k)));
  if (!hasLoc) warnings.push(`Location column missing (${tabName})`);
  return { headerRowIdx, warnings };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://wilan-stockcheck.pages.dev";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    let dryRun = false;
    let bodySheetId: string | undefined;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        dryRun = !!body?.dryRun;
        bodySheetId = body?.sheetId ?? undefined;
      } catch { /* no body */ }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supaUser.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return respond({ error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub;

    const supaAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRoles } = await supaAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = (userRoles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "equipment",
    );
    if (!allowed) {
      return respond({ error: "ต้องมีสิทธิ์ Equipment หรือ Admin" }, 403);
    }

    // ── Resolve which sheet + prefix to use ─────────────────────────────────
    let sheetToSync: string;
    let skuPrefix: string;

    if (bodySheetId) {
      const { data: regRow, error: regErr } = await supaAdmin
        .from("google_sheets_registry")
        .select("sheet_id, sku_prefix")
        .eq("sheet_id", bodySheetId)
        .eq("department", "equipment")
        .eq("is_active", true)
        .single();

      if (regErr || !regRow) {
        return respond({ error: "ไม่พบ Sheet ในระบบ หรือถูกปิดใช้งานแล้ว" }, 400);
      }
      sheetToSync = regRow.sheet_id as string;
      skuPrefix = (regRow.sku_prefix as string) ?? "";
    } else {
      // Default: main sheet (sku_prefix = '') or hardcoded fallback.
      const { data: mainRow } = await supaAdmin
        .from("google_sheets_registry")
        .select("sheet_id, sku_prefix")
        .eq("department", "equipment")
        .eq("sku_prefix", "")
        .eq("is_active", true)
        .maybeSingle();

      sheetToSync = (mainRow?.sheet_id as string) ?? DEFAULT_SHEET_ID;
      skuPrefix = (mainRow?.sku_prefix as string) ?? "";
    }
    // ────────────────────────────────────────────────────────────────────────

    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_SHEETS_API_KEY secret is not set");
    const TABS = await fetchAllTabs(sheetToSync, apiKey);

    const errors: string[] = [];
    const tabData: { tab: typeof TABS[0]; rows: string[][]; dataStart: number }[] = [];
    for (const tab of TABS) {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetToSync}/gviz/tq?tqx=out:csv&gid=${tab.gid}`;
        const res = await fetch(url);
        if (!res.ok) {
          errors.push(`[WARN] ${tab.name}: fetch failed (${res.status})`);
          continue;
        }
        const csv = await res.text();
        const rows = parseCSV(csv);

        let dataStart = 0;
        if (tab.schema === "standard") {
          if (rows.length < 1) {
            console.log(`[SKIP] ${tab.name}: empty tab`);
            continue;
          }
          const hd = detectInventoryHeader(rows, tab.name);
          if (!hd) {
            console.log(`[SKIP] ${tab.name}: no inventory header found`);
            continue;
          }
          for (const w of hd.warnings) console.warn(`[COLUMN-WARN] ${w}`);
          dataStart = hd.headerRowIdx + 1;
        }

        tabData.push({ tab, rows, dataStart });
      } catch (tabErr) {
        errors.push(`[ERROR] ${tab.name}: ${tabErr instanceof Error ? tabErr.message : String(tabErr)}`);
      }
    }

    // Scope existingSet to this sheet's prefix — isolates each registered sheet.
    const skuPattern = `${skuPrefix}EQ-%`;
    const existingSet = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supaAdmin
        .from("skus")
        .select("sku_code")
        .eq("department", "equipment")
        .like("sku_code", skuPattern)
        .range(from, from + 999);
      if (!page?.length) break;
      for (const r of page) existingSet.add(r.sku_code);
      if (page.length < 1000) break;
    }

    const insertRecords: any[] = [];
    const updateRecords: any[] = [];
    let inserted = 0;
    let updated = 0;
    const perTab: Record<string, { inserted: number; updated: number }> = {};
    const sheetSkus = new Set<string>();

    for (const { tab, rows, dataStart } of tabData) {
      try {
      if (rows.length < 2) { perTab[tab.name] = { inserted: 0, updated: 0 }; continue; }

      let seq = 0;
      perTab[tab.name] = perTab[tab.name] ?? { inserted: 0, updated: 0 };

      for (let r = dataStart; r < rows.length; r++) {
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

          // sku_prefix prepended here — empty string for main warehouse is a no-op.
          const sku = `${skuPrefix}EQ-${tab.prefix}-${String(seq).padStart(3, "0")}`;
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
          if (existingSet.has(sku)) {
            updateRecords.push(record);
            updated++;
            perTab[tab.name].updated++;
          } else {
            insertRecords.push({ ...record, created_by: userId, availability });
            inserted++;
            perTab[tab.name].inserted++;
          }
        } else {
          // Charging checklist schema
          const name = (row[CHG.name] ?? "").trim();
          const status = (row[CHG.status] ?? "").trim();
          if (!name) continue;
          if (name.toLowerCase() === "charge date" || status.toLowerCase() === "status") continue;
          const qtyCell = (row[CHG.qty] ?? "").trim();
          const dateCell = (row[CHG.date] ?? "").trim();
          if (!qtyCell && !dateCell && !status) continue;
          seq++;

          const qty = parseQtyMultiplier(qtyCell);
          const sku = `${skuPrefix}EQ-${tab.prefix}-${String(seq).padStart(3, "0")}`;
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
          sheetSkus.add(sku);
          if (existingSet.has(sku)) {
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
      } catch (tabErr) {
        errors.push(`[ERROR] ${tab.name}: ${tabErr instanceof Error ? tabErr.message : String(tabErr)}`);
        perTab[tab.name] = perTab[tab.name] ?? { inserted: 0, updated: 0 };
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

    // Orphan cleanup — scoped to this sheet's prefix pattern so sheets never
    // delete each other's rows. E.g. prefix "B-" only touches "B-EQ-*" codes.
    const orphanedSkus = Array.from(existingSet).filter((s) => !sheetSkus.has(s));
    let deleted = 0;

    if (orphanedSkus.length > 0) {
      if (!dryRun) {
        for (let i = 0; i < orphanedSkus.length; i += 500) {
          const chunk = orphanedSkus.slice(i, i + 500);
          const { error } = await supaAdmin
            .from("skus")
            .delete()
            .eq("department", "equipment")
            .in("sku_code", chunk);
          if (error) errors.push(`cleanup: ${error.message}`);
          else deleted += chunk.length;
        }
      } else {
        deleted = orphanedSkus.length;
      }
    }

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

    return respond({
      success: true,
      dryRun,
      sheetId: sheetToSync,
      skuPrefix,
      inserted,
      updated,
      deleted,
      orphanedSkus: dryRun ? orphanedSkus : [],
      perTab,
      errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
