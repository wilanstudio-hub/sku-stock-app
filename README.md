# FilmFlow Inventory — Production Equipment & SKU Tracker

> A modern, bilingual (Thai / English) inventory management and field tracking platform built for film productions, broadcast studios, rental houses, and dynamic multi-department operations.

---

## ✨ Features

- **🎬 Dynamic Multi-Department Architecture**: Built-in native support for **Art**, **Wardrobe (WD)**, **Equipment / Camera**, and unlimited custom departments configured on the fly.
- **📊 Real-Time Google Sheets Sync**: Connect Google Spreadsheets directly to departments. Sync thousands of SKU items, images, categories, and locations in seconds via Google Cloud Service Accounts.
- **📱 On-Set QR Scanning & Mobile Check-in/out**: Scan physical product labels via smartphone camera without requiring mobile app installation. Instant check-out with borrower/operator assignment and return logging.
- **🏷️ Printable QR Sheets & Single Labels**: Generate 24-up label sheets, standard Avery sheets, or single product stickers with auto-generated QR codes and SKU metadata.
- **📄 Bulk PDF Export**: Export categorized SKU catalogs, inventory lists, and equipment manifests with high-res thumbnails and Thai/English typography.
- **🔐 Enterprise Role-Based Access Control (RBAC)**: Fine-grained permissions (`admin`, department operators, and read-only `viewer` accounts with per-department section access).
- **🌐 100% Bilingual Interface**: Instant one-click toggle between Thai and English with fully synchronized translation dictionaries.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Radix UI (shadcn/ui), Lucide Icons, QR Code SVG.
- **Backend / Database**: Supabase PostgreSQL with strict Row Level Security (RLS) and real-time triggers.
- **Serverless Compute**: Deno Edge Functions for parallel Google Sheets API v4 syncing and password recovery.
- **Hosting / CDN**: Cloudflare Pages / Vercel / Netlify with zero-config edge routing.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ & npm
- A free or pro [Supabase](https://supabase.com) project

### 2. Installation
```bash
git clone <repository-url>
cd FilmFlow-Inventory
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 📦 Production Deployment

### 1. Database Migrations
Run the SQL migration scripts located in `supabase/migrations/` sequentially in your Supabase SQL Editor:
1. `20260814000000_dynamic_departments.sql`
2. `20260815100000_secure_rls_inventory.sql`
3. `20260825000000_fix_rls_and_scan_access.sql`

### 2. Deploy Supabase Edge Functions
Configure your Supabase CLI and deploy the synchronization functions:
```bash
# Set required secrets
npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@gcp-project.iam.gserviceaccount.com"
npx supabase secrets set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
npx supabase secrets set RESEND_API_KEY="re_..."
npx supabase secrets set APP_URL="https://your-domain.pages.dev"
npx supabase secrets set APP_NAME="FilmFlow Inventory"

# Deploy edge functions
npx supabase functions deploy sync-art-sheets
npx supabase functions deploy sync-wd-sheets
npx supabase functions deploy sync-equipment-sheet
npx supabase functions deploy forgot-password
```

### 3. Build & Deploy Frontend (Cloudflare Pages)
```bash
npm run build
npx wrangler pages deploy dist --project-name filmflow-inventory
```

---

## 🔒 Security & RLS Model

- **Public QR Lookup (`/scan?sku=...`)**: Unauthenticated field crew can scan labels to check item availability and submit check-in/out records.
- **Authenticated Access**: Authenticated users can only read and modify data for departments they hold explicit roles for, or sections granted via `viewer_section_access`.
- **System Admin**: Only users with the `admin` role can manage user roles, delete records in bulk, or configure connected Google Sheets.

---

## 🧪 Testing

Run unit and integration smoke tests:
```bash
npm run test
```
Verify type safety:
```bash
npx tsc -b --noEmit
```
