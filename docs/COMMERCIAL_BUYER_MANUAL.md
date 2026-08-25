# FilmFlow Inventory — Commercial Buyer & Deployment Manual

> A complete guide for enterprise customers, film production houses, and SaaS subscribers to deploy, configure, and operate FilmFlow Inventory.

---

## 1. Architecture Overview

FilmFlow Inventory is built for zero-maintenance serverless operation:
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Radix UI (Hosted on Cloudflare Pages / Vercel).
- **Backend / Database**: Supabase PostgreSQL with Row Level Security (RLS) and real-time triggers.
- **Sync Engine**: Deno Edge Functions using Google Sheets API v4 with Service Account OAuth2 authentication.
- **Tenant Isolation**: Control-plane `companies` table with Subdomain routing (`<tenant>.inventory.yourdomain.com` or `?tenant=<slug>`).

---

## 2. On-Premise / Private Deployment (For Enterprise Buyers)

### Step 1: Clone Repository & Install Dependencies
```bash
git clone <your-private-repo-url>
cd FilmFlow-Inventory
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

### Step 3: Initialize Database Schema
Run the SQL migration script in your Supabase SQL Editor:
- [`supabase/DEPLOY_TO_SUPABASE.sql`](../supabase/DEPLOY_TO_SUPABASE.sql)

### Step 4: Deploy Serverless Edge Functions
```bash
# Login to Supabase CLI
npx supabase login

# Set Google Cloud Service Account secrets
npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@gcp.iam.gserviceaccount.com"
npx supabase secrets set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
npx supabase secrets set APP_URL="https://your-domain.pages.dev"
npx supabase secrets set APP_NAME="Your Studio Inventory"

# Deploy functions
npx supabase functions deploy sync-art-sheets
npx supabase functions deploy sync-wd-sheets
npx supabase functions deploy sync-equipment-sheet
npx supabase functions deploy forgot-password
```

### Step 5: Build & Deploy Frontend to Cloudflare Pages
```bash
npm run build
npx wrangler pages deploy dist --project-name your-inventory-app
```

---

## 3. Connecting Google Spreadsheets

1. Create a Google Sheet following the specifications in [`GOOGLE_SHEETS_TEMPLATE_GUIDE.md`](./GOOGLE_SHEETS_TEMPLATE_GUIDE.md).
2. Share the Google Sheet with your configured Service Account email as **Viewer**.
3. In FilmFlow Inventory, log in as Admin and navigate to `/admin` or click **"จัดการคลัง"** on the target department tab.
4. Paste the Google Sheet URL and click **Sync ข้อมูล**.

---

## 4. Multi-Tenant Subdomain Routing Setup (Cloudflare)

To enable automatic subdomain routing for multiple client studios (`studio-a.yourdomain.com`, `studio-b.yourdomain.com`):

1. In the Cloudflare DNS dashboard for `yourdomain.com`, add a CNAME record:
   - **Type**: `CNAME`
   - **Name**: `*` (Wildcard) or `*.inventory`
   - **Target**: `your-inventory-app.pages.dev`
   - **Proxy status**: `Proxied (Orange cloud)`
2. In Cloudflare Pages Settings → **Custom Domains**, add `*.yourdomain.com`.
3. When a user navigates to `https://acme.yourdomain.com`, FilmFlow automatically scopes their workspace, branding, and access permissions to `acme`.

---

## 5. Security & Access Control Reference

| Role | Access Scope |
| :--- | :--- |
| **`admin`** | Full system control: Manage users, approve pending studios, delete records, configure Google Sheets. |
| **`equipment`** / **`art`** / **`wd`** | Read and write access to their respective department's inventory and transactions. |
| **`viewer`** | Read-only access to specific departments granted via `viewer_section_access`. |
| **`anon` (Public)** | Scan physical QR codes at `/scan?sku=...` and log check-in/out transitions without logging in. |
