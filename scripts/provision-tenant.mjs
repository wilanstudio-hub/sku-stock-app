#!/usr/bin/env node

/**
 * FilmFlow Inventory — Tenant Provisioning Script
 *
 * Usage:
 *   node scripts/provision-tenant.mjs --slug <subdomain> --name <"Studio Name"> [--email <admin@email.com>]
 *
 * Example:
 *   node scripts/provision-tenant.mjs --slug acme --name "Acme Production Studio" --email admin@acme.com
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load environment variables from .env if present
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [k, ...rest] = trimmed.split("=");
      if (k && rest.length) process.env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const slug = getArg("slug");
const name = getArg("name");
const email = getArg("email");

if (!slug || !name) {
  console.error("❌ Error: Missing required arguments.");
  console.log("\nUsage:");
  console.log('  node scripts/provision-tenant.mjs --slug <slug> --name "<Studio Name>" [--email <email>]');
  process.exit(1);
}

const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env or environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`🚀 Provisioning tenant: ${name} (slug: ${cleanSlug})...`);

  // 1. Upsert company record
  const { data: company, error: compErr } = await supabase
    .from("companies")
    .upsert(
      {
        slug: cleanSlug,
        name: name.trim(),
        contact_email: email ? email.trim().toLowerCase() : null,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (compErr) {
    console.error("❌ Failed to register company in control plane:", compErr.message);
    process.exit(1);
  }

  console.log("✅ Company record activated in control plane:", company.id);

  // 2. Output next steps & workspace link
  const appUrl = process.env.APP_URL || "https://filmflow-inventory.pages.dev";
  console.log("\n=======================================================");
  console.log(`🎉 Studio Workspace Ready: ${name}`);
  console.log(`🔗 Workspace URL: ${appUrl}/?tenant=${cleanSlug}`);
  console.log(`🌐 Subdomain: https://${cleanSlug}.inventory.filmflow.com`);
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
