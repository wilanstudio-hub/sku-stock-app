# FilmFlow Open — Security Remediation Plan

Derived from the UrboyTK white-box report (14 Aug 2026, 65 findings) **plus a live
deployment audit on the same day** that corrected several of its severities.

Repo: `/Volumes/AHQISSD-008/App/filmflow-open`
Live surface: Cloudflare Pages project `filmflow-open` → `filmflow-open-5sz.pages.dev`

---

## How to use this file

Work **one task at a time**, top to bottom. Each task has:

- **Status** — whether it is confirmed exploitable on the live deployment
- **Location** — ✅ verified means the file was opened and the line number is current;
  ⚠️ from-report means it must be confirmed with the *Verify location* command first
- **Test** — run before and after; the "before" result is your proof the bug was real

Do not batch tasks. One task → one commit → one deploy → one test.

### Ground rules

1. **Never assume a line number.** If a *Verify location* command returns nothing,
   stop and search the file rather than editing blind.
2. **Fail closed.** Every guard added here returns 401/403/503 on the failure path.
   No `console.warn` + continue, ever.
3. **State the regression risk before applying.** Closing an open endpoint breaks
   whatever was calling it.
4. **Test on the live URL after deploy**, not just locally — the whole point is that
   these are internet-reachable.

### Deployment facts that shape this plan

Verified 14 Aug 2026 via `wrangler`:

- Only `filmflow-open` (Pages) is deployed. `wilan-ai-hub`, `filmflow-cron`,
  `wilan-line-ai`, `filmflow-checklist-api` do not exist on the account. Their source
  was removed in commit `6b2bed2`.
- Secrets set on production (8): `AUTH_SECRET`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `SUPER_ADMIN_EMAIL`,
  `DISCORD_ALERTS_WEBHOOK_URL`, `INTEGRATION_ENCRYPTION_KEY`.
- Secrets **not** set: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`,
  `GEMINI_API_KEY`, `SKU_SUPABASE_*`, `VILARN_SUPABASE_*`, `GOOGLE_DRIVE_SA_KEY`,
  `PIXEL_EVENTS_SECRET`.

Consequences: LINE messaging is non-functional (so hardening it breaks nothing);
email relays are fully functional (so they are live risk); the AI agent's cross-app
tools return "not configured" instead of touching SKU/Vilarn data.

### Corrections to the original report

| Finding | Report | Corrected | Why |
|---|---|---|---|
| FF-C-08 | Critical | **Not applicable** | Workers never deployed; source removed |
| FF-H-15 | High | **Not applicable** | same |
| FF-L-17 | Low | **Not applicable** | same |
| FF-C-04 | 3 production DBs | **1 DB (FilmFlow only)** | SKU/Vilarn keys not set on this project |
| FF-C-12 | Critical | **High (latent)** | `RESEND_API_KEY` is set, so the leak path is closed today — but returns on any rotation or self-host |
| FF-C-02 | Critical | **Critical, confirmed live** | `curl` with an invalid signature returned `200` |

---

# Phase 0 — Stop the bleed

Five tasks. All are reachable without credentials.

---

## Task 0.1 — FF-C-02 · LINE webhook accepts forged requests

**Status:** 🔴 Confirmed live. An invalid `X-Line-Signature` returned `200`.
**Location:** ✅ `functions/api/webhook/index.ts:1401-1417`
**Blocks:** FF-C-03 and FF-C-04 both require this entry point.

### Why it's broken

Two failure paths, both fall through:

- Signature mismatch → logs `"Continuing to process for debugging"` and continues
- `LINE_CHANNEL_SECRET` unset → check skipped entirely (this is the current state)

### Verify location

```bash
cd /Volumes/AHQISSD-008/App/filmflow-open
sed -n '1399,1420p' functions/api/webhook/index.ts
```

Expect to see `const rawBody = await request.text();` then the `if (hasSecret) {` block.

### Test before

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://filmflow-open-5sz.pages.dev/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: invalid" -d '{"events":[]}'
```

Expect `200` (the bug).

### Patch

Replace the whole `// ── Signature check ──` block:

```ts
    // Fail closed: an unverified body must never reach the handler below.
    if (!hasSecret) {
      console.error("[LINE webhook] LINE_CHANNEL_SECRET not set — refusing all requests");
      return new Response("Webhook not configured", { status: 503, headers: CORS });
    }

    const valid = await verifySignature(
      rawBody,
      env.LINE_CHANNEL_SECRET,
      request.headers.get("X-Line-Signature")
    );
    if (!valid) {
      console.warn("[LINE webhook] Signature mismatch — request rejected");
      return new Response("Unauthorized", { status: 401, headers: CORS });
    }
```

`rawBody` is already read before the check and `JSON.parse` already happens after it —
that ordering is correct, don't change it.

### Sweep for the same pattern elsewhere

```bash
grep -rn "Continuing to process\|continue anyway\|for debugging" functions/
```

Every hit is the same bug shape. Report them; do not fix them in this commit.

### Test after

```bash
npm run build && npx wrangler pages deploy dist --config wrangler.open.toml
# wait for deploy, then:
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://filmflow-open-5sz.pages.dev/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: invalid" -d '{"events":[]}'
```

Expect `503` (secret still unset). After `LINE_CHANNEL_SECRET` is set, an invalid
signature should give `401` and a valid one `200`.

### Regression risk

**None on this deployment** — `LINE_CHANNEL_ACCESS_TOKEN` is also unset, so LINE
replies already fail. If LINE is enabled later, set the secret *before* re-testing.

```
git commit -m "fix(webhook): fail closed on LINE signature mismatch and missing secret (FF-C-02)"
```

---

## Task 0.2 — FF-C-05 · Email relay outside the auth middleware

**Status:** 🔴 Live. `RESEND_API_KEY` and `RESEND_FROM` are both set.
**Location:** ⚠️ from-report — `functions/send-assignment-email.ts`

### Why it's broken

Pages Functions middleware only covers its own directory and below. A handler at
`functions/send-assignment-email.ts` is **not** covered by
`functions/api/_middleware.ts`. Recipients and body fields come from the request and
are interpolated raw into the email HTML.

### Verify location

```bash
cd /Volumes/AHQISSD-008/App/filmflow-open
ls -la functions/send-assignment-email.ts
find functions -name '*.ts' -not -path 'functions/api/*'
```

The `find` output is the complete list of unguarded handlers — check every one, not
just this file.

### Test before

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://filmflow-open-5sz.pages.dev/send-assignment-email \
  -H "Content-Type: application/json" \
  -d '{"recipients":["nobody@example.invalid"],"stepName":"t","projectName":"t"}'
```

Anything other than 401/403/404 means it is reachable.

### Patch

1. Move it under the guarded prefix:
   ```bash
   git mv functions/send-assignment-email.ts functions/api/send-assignment-email.ts
   ```
2. Update any caller — find them first:
   ```bash
   grep -rn "send-assignment-email" src/ functions/
   ```
3. Restrict recipients to project members derived **server-side** from the session,
   not from the request body.
4. HTML-escape every interpolated field:
   ```ts
   const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g,
     c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]!));
   ```
5. Cap recipient count (suggest 20) and rate-limit per session.

### Test after

- Unauthenticated POST → `401`
- Authenticated, recipient not on the caller's project → `403`
- `<b>x</b>` in `stepName` → renders as literal text in the email, not bold

### Regression risk

⚠️ **Real.** Whatever currently calls this endpoint breaks. Run the `grep` in step 2
and check for external callers (n8n, LINE bot, cron on another host) before deploying.

```
git commit -m "fix(email): move assignment relay under auth middleware, escape fields, cap recipients (FF-C-05)"
```

---

## Task 0.3 — FF-C-06 · Notification relays without JWT

**Status:** 🔴 Live for Discord (`DISCORD_ALERTS_WEBHOOK_URL` set). LINE paths are
inert today (no token) but must still be gated — they ship to buyers.
**Location:** ⚠️ from-report — `functions/api/notify/{line,line-step,process,verify-group,test-push}.ts`

### Why it's broken

`notify/admin.ts`, `notify/assignment.ts`, and `notify/discord.ts` verify a JWT.
These five do not. `line-step` can multicast to every admin; `test-push`'s guard is
conditional on `TEST_SECRET` being set (it isn't); `verify-group` interpolates
`groupId` unencoded.

### Verify location

```bash
cd /Volumes/AHQISSD-008/App/filmflow-open
ls functions/api/notify/
grep -ln "verifyToken\|verifyJWT\|requireAuth" functions/api/notify/*.ts
```

The second command lists the **gated** files. Anything in the directory not listed is
a target for this task.

### Patch

1. Read the working pattern:
   ```bash
   sed -n '1,40p' functions/api/notify/admin.ts
   ```
2. Apply the same JWT gate to each ungated file.
3. `test-push` fails closed:
   ```ts
   if (!env.TEST_SECRET) return new Response("Unavailable", { status: 503 });
   ```
4. `verify-group` validates `groupId` as a bare LINE group id before use:
   ```ts
   if (!/^C[0-9a-f]{32}$/.test(groupId)) return new Response("Bad request", { status: 400 });
   ```
   Confirm the real format against a live group id before trusting this regex.

### Test after

```bash
for ep in line line-step process verify-group test-push; do
  printf "%s: " "$ep"
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    "https://filmflow-open-5sz.pages.dev/api/notify/$ep" \
    -H "Content-Type: application/json" -d '{}'
done
```

Expect `401` for all five (`test-push` may give `503`).

```
git commit -m "fix(notify): JWT-gate line/line-step/process/verify-group, fail closed on test-push (FF-C-06)"
```

---

## Task 0.4 — FF-C-07 · Unauthenticated finance-record injection

**Status:** 🔴 Live. Public by design, but with no anti-automation or bounds.
**Location:** ⚠️ from-report — `functions/api/fuel-reimbursement/index.ts`,
`functions/api/invoice-submissions/index.ts`

### Why it's broken

Attacker-chosen `total_amount` and `driver_name` are inserted and flow to accounting.
`formData.getAll` is unbounded. The magic-byte check reads only 8 bytes.
`fuel-reimbursement/projects.ts` also publicly lists recent project ids (FF-M-11),
which supplies the ids that make FF-C-03 targeted rather than blind.

### Verify location

```bash
cd /Volumes/AHQISSD-008/App/filmflow-open
ls functions/api/fuel-reimbursement/ functions/api/invoice-submissions/
grep -n "formData.getAll\|total_amount\|driver_name" \
  functions/api/fuel-reimbursement/index.ts functions/api/invoice-submissions/index.ts
```

### Patch

These forms are meant to be opened from a bot link, so keep them public but bind them
to a signed token instead of leaving them open:

```ts
// Issuing side (authenticated): payload = `${projectId}.${expiresAtMs}`
// token = `${payload}.${base64url(HMAC-SHA256(payload, env.LINK_SECRET))}`

// Receiving side:
const [projectId, exp, sig] = (token ?? "").split(".");
if (!projectId || !exp || !sig) return json({ error: "Invalid link" }, 400);
if (Number(exp) < Date.now())   return json({ error: "Link expired" }, 400);
const expected = await hmacBase64Url(`${projectId}.${exp}`, env.LINK_SECRET);
if (!timingSafeEqualStr(sig, expected)) return json({ error: "Invalid link" }, 403);
// Use projectId FROM THE TOKEN. Never read it from the body.
```

Plus bounds:

- file count ≤ 5 → `400`
- file size ≤ 10 MB each → `413`
- per-IP rate limit → `429`
- require auth on `fuel-reimbursement/projects.ts` (FF-M-11)

Add `LINK_SECRET` as a Pages secret:
```bash
npx wrangler pages secret put LINK_SECRET --project-name filmflow-open
```

### Test after

- Submit with no token → rejected
- Submit with an expired token → `400`
- 10 files → `400`; a 50 MB file → `413`
- 20 rapid submissions → `429`
- `GET /api/fuel-reimbursement/projects` unauthenticated → `401`

### Regression risk

⚠️ **Real.** Existing links in LINE/Discord history stop working. Plan how links get
re-issued before deploying.

```
git commit -m "fix(finance): require signed link token, bound uploads, gate project list (FF-C-07, FF-M-11)"
```

---

## Task 0.5 — FF-C-12 · OTP returned in the response when email is unconfigured

**Status:** 🟡 Not exploitable today (`RESEND_API_KEY` is set) — but one rotation, one
preview branch, or one self-hosting buyer brings it back as a one-request takeover.
**Location:** ⚠️ from-report — `functions/api/auth/resend-otp.ts:99-102`,
`functions/api/auth/login.ts:165-168`

### Verify location

```bash
cd /Volumes/AHQISSD-008/App/filmflow-open
grep -rn "dev_code\|debug_code" functions/ src/
```

### Patch

Delete the branch. Do **not** replace it with a `NODE_ENV` guard — this runs on the
edge where that flag isn't reliable.

```ts
if (!env.RESEND_API_KEY) {
  return new Response(JSON.stringify({ error: "Email delivery unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
```

### Test after

```bash
grep -rn "dev_code\|debug_code" functions/ src/    # expect no hits
```

Then, on a preview deployment with `RESEND_API_KEY` unset, call `login` and
`resend-otp` and confirm `503` with no code anywhere in the body.

```
git commit -m "fix(auth): fail closed when email delivery is unconfigured, drop dev_code leak (FF-C-12)"
```

---

# Phase 1 — Tenant isolation (Supabase)

**Scope is much smaller than the report implies.** Only three files touch Supabase
from the client, across three tables:

| File | Tables | Direction |
|---|---|---|
| `src/hooks/useLedgerData.ts` | `projects`, `department_budgets`, `role_budgets` | read |
| `src/components/LedgerPanel.tsx` | `projects`, `department_budgets` | write |
| `src/components/CsvImportButton.tsx` | `projects`, `department_budgets`, `role_budgets` | write |

## Task 1.1 — Decide: fix RLS, or retire the Supabase plane

Two viable paths. Pick one before writing any SQL.

**Option A — enable RLS and keep Supabase.** Faster; keeps whatever reads this data
from outside FilmFlow (likely LedgerPro) working unchanged.

**Option B — move these three tables to D1 and drop Supabase from the client.**
Closes FF-C-01, FF-H-11, FF-M-15, FF-M-16, FF-M-17, FF-L-11 in one move and removes a
whole data plane. Requires finding every other consumer of these tables first.

Before choosing, find the other consumers:

```bash
# in the LedgerPro repo, not this one
grep -rn "department_budgets\|role_budgets" --include='*.ts' --include='*.tsx' .
```

If FilmFlow is the only writer and LedgerPro the only reader, Option B means building
one authenticated endpoint instead of maintaining RLS policies forever.

## Task 1.2 — If Option A: enable RLS per table

Survey first:

```sql
SELECT tablename, policyname, qual FROM pg_policies
WHERE schemaname = 'public' AND qual = 'true';

SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (SELECT relname FROM pg_class WHERE relrowsecurity = true);
```

Then, **one table at a time** (adjust column names to the real schema):

```sql
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.projects;

CREATE POLICY projects_owner_rw ON public.projects
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE ALL ON public.projects FROM anon;
```

⚠️ **Regression risk is high.** Every client query above uses the anon key. Apply on a
Supabase branch first, then load `useLedgerData.ts`'s screens and confirm they still
return rows.

## Task 1.3 — FF-H-11 · Drop the unguarded email-harvest function

```sql
DROP FUNCTION IF EXISTS public.get_user_emails();          -- keep _v2
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
```

Verify: calling the RPC with the anon key returns a permission error or "function does
not exist".

---

# Phase 2 — Takeover chains

| # | Finding | What to do |
|---|---|---|
| 2.1 | **FF-H-01** | `functions/api/_middleware.ts:99` — split the condition: `if (isPublic) return next();` then `if (!env.AUTH_SECRET) return 503;`. Never treat a missing secret as "allow". |
| 2.2 | **FF-H-02** | `functions/api/calendar/book-crew/index.ts:39` — add the missing `await`. Sweep: `grep -rn "if (!verifyToken\|if (!verifyJWT" functions/` |
| 2.3 | **FF-C-09** | `login.ts` issues a 5-minute signed pending-login token after the password check; `verify-otp.ts` requires it, bound to email + IP. Without it, OTP alone is the whole auth factor. |
| 2.4 | **FF-C-10** | `forgot-password.ts:275-314` — resolve the reset target from `users.line_user_id` only. Never from a project crew blob. Delete the reset-over-LINE-bot flow. |
| 2.5 | **FF-H-10** | `forgot-password.ts:317-343` — delete the fallback that pushes another account's reset link to `ADMIN_LINE_USER_ID`. No condition justifies it. |
| 2.6 | **FF-C-11** | `src/utils/offline.ts:4` — `isOfflineMode` must be `import.meta.env.DEV` only. Keep desktop offline UX; never inject a `super_admin` identity. |
| 2.7 | **FF-C-04** | `functions/api/utils/aiHandler.ts:384-685` — require a resolved user identity in the tool executor; drop mutation tools from any unauthenticated surface; split read tools from write tools. |

Each of these is its own commit. 2.1 and 2.2 are small and should go first.

---

# Phase 3 — Authorization correctness

| # | Finding | What to do |
|---|---|---|
| 3.1 | **FF-H-03** | Re-check `role` + `status` from D1 in the main middleware, or bump `token_version` on logout/suspend/role change. Currently only `reset-password.ts:67` bumps it, so a demoted admin keeps privileges for up to 7 days. Pairs with 2.6 — until this lands, a client-side role claim can be honoured server-side. |
| 3.2 | **FF-H-06** | `functions/api/projects/[id].ts:103,131` — require owner/admin for whole-project DELETE and PATCH; separate read authority from write. Fix the soft-deleted re-upsert path that lets an attacker take `owner_email`. |
| 3.3 | **FF-H-07** | `functions/api/attendance.ts:166-210` — default to self-only; return GPS fields only to admins. |
| 3.4 | **FF-H-08** | `functions/api/admin/users/[id]/role.ts:36` — only `super_admin` may modify admin-level rows. |
| 3.5 | **FF-H-04** | `functions/api/utils/projectIntegrations.ts:83-104` — verify caller membership of `projectId` before decrypting credentials. Apply the same check to the `project_integrations` GET branch (FF-M-14). |
| 3.6 | **FF-H-05** | `functions/api/send-email.ts:31`, `functions/api/tasks/nudge/index.ts:229` — restrict recipients to crew on a project the caller can access; escape all fields. |
| 3.7 | **FF-M-08/09/10** | `dept-status.ts`, `schedule-assignment/index.ts`, `crew/index.ts` — add the missing role/membership checks on read paths. |

---

# Phase 4 — Hardening

| # | Finding | What to do |
|---|---|---|
| 4.1 | **FF-H-09** | Replace the KV fixed-window limiter with a per-attempt counter in D1; invalidate the OTP on a wrong guess; add account lockout; fail closed when KV is unbound. |
| 4.2 | **FF-H-12** | Set an explicit CSP in `src-tauri/tauri.conf.json` (currently `null`) and a matching Pages `_headers`. Externalize the inline theme script so `unsafe-inline` can be dropped for scripts. |
| 4.3 | **FF-H-13** | Stop mirroring the session token into `localStorage` (`ff_token`). If the Safari fallback is unavoidable, make it short-TTL and device-bound. |
| 4.4 | **FF-H-14** | Sign the license payload server-side, verify in Rust against an embedded public key, and bind entitlement checks to the data API. Shorten or remove the offline grace window. |
| 4.5 | **FF-M-01/02** | Raise PBKDF2 to ~600k iterations with the count stored per hash; add a pepper; use a timing-safe compare for password hashes. |
| 4.6 | **FF-M-18** | Constant-time compares for every secret. Sweep: `grep -rn "secret\|signature\|hmac" functions/ \| grep "==="` |
| 4.7 | **FF-M-19** | `encodeURIComponent` + validate every value interpolated into a PostgREST filter. |
| 4.8 | **FF-M-04** | Neutral responses and equalized timing across account states in `login`, `signup`, `resend-otp`, `forgot-password`. |

---

# Phase 5 — Pre-sale / pre-billing gates

## 5.1 Separate the sellable build from internal-org code

`wrangler.open.toml` says the sellable app is *"completely separate from the internal
org app"*, but the code is not separated. 22 files reference internal systems, and
`Wilan Studio` reaches the shipped bundle:

```bash
cd /Volumes/AHQISSD-008/App/filmflow-open
grep -rln "SKU_SUPABASE\|VILARN_SUPABASE\|Wilan Studio\|PIXEL_EVENTS" functions/ src/
npm run build && grep -ro "Wilan Studio\|VILARN\|SKU_SUPABASE" dist/ | sort -u
```

Also inside the sellable tree: table schemas for `skus`, `publish_queue`, `episodes`
(`functions/api/utils/supabase.ts`), a hardcoded Google Drive folder id in
`wrangler.toml` `[vars]`, and hardcoded LINE group ids (FF-L-09).

Preferred fix: a separate branch or repo for the sellable build with
`ai-agent.ts`, `pixel-events.ts`, `discord/interactions.ts`, and the SKU/Vilarn halves
of `supabase.ts` removed entirely — not feature-flagged, removed.

## 5.2 Housekeeping

- `wrangler.toml` still declares `name = "your-app-name"`. Set the real name before
  the internal app is ever deployed.
- Three production builds show `Failure` (`fbefea1a`, `79a175e5`, `43ad0303`). Check
  their build logs in the Cloudflare dashboard — a broken build is how a stale bundle
  stays live.
- Placeholder URLs still in code: `useSyncCrew.ts:4`, `Dashboard.tsx:123`,
  `aiHandler.ts:51` all point at `your-*.workers.dev`. Make them env-driven and
  **disable the feature when unset** rather than falling back to a domain you don't own.

## 5.3 Billing checklist (before any payment integration)

Every item is a go-live blocker:

- Webhook signature verified with the async/Web-Crypto variant, failing closed.
  Do not repeat the FF-C-02 pattern on a billing endpoint.
- Raw body read and verified before parsing.
- Idempotency: `stripe_events(event_id PRIMARY KEY)` + `INSERT OR IGNORE`.
- The webhook is the only writer of subscription state.
- Hosted Checkout/Elements so card data never reaches the Worker, D1, or logs.
- No price or amount accepted from the client — plan label → server-side price id.
- Replay/ordering: timestamp tolerance, stored event ids, period end only moves forward.
- Keys as Wrangler secrets, never in `[vars]`.
- ⚠️ Check the public-route allowlist: `/api/webhook` is a **prefix** match, so
  `/api/webhooks/stripe` may be inheriting public status. Verify explicitly.

---

# Progress tracker

| Task | Finding | Status | Commit |
|---|---|---|---|
| 0.1 | FF-C-02 | ⬜ | |
| 0.2 | FF-C-05 | ⬜ | |
| 0.3 | FF-C-06 | ⬜ | |
| 0.4 | FF-C-07 | ⬜ | |
| 0.5 | FF-C-12 | ⬜ | |
| 1.1 | decision | ⬜ | |
| 1.2 | FF-C-01 | ⬜ | |
| 1.3 | FF-H-11 | ⬜ | |
| 2.1 | FF-H-01 | ⬜ | |
| 2.2 | FF-H-02 | ⬜ | |
| 2.3 | FF-C-09 | ⬜ | |
| 2.4 | FF-C-10 | ⬜ | |
| 2.5 | FF-H-10 | ⬜ | |
| 2.6 | FF-C-11 | ⬜ | |
| 2.7 | FF-C-04 | ⬜ | |

Phase 3–5 tasks are tracked in their own tables above.

---

# Shared helpers

Both of these are needed by more than one task. Put them somewhere importable
(e.g. `functions/api/utils/crypto.ts`) rather than duplicating them.

```ts
/** Constant-time string comparison — Workers has no crypto.timingSafeEqual. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 → base64url. Used for signed link tokens. */
export async function hmacBase64Url(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
```

---

# Not fixed here, and why

- **FF-C-08, FF-H-15, FF-L-17, FF-L-16** — the standalone Workers were never deployed
  and their source is gone as of `6b2bed2`. Nothing to fix.
- **FF-L-14** — committed infrastructure identifiers (D1/KV/R2 ids). Not secrets, but
  they should not ship in a sold codebase. Folded into 5.1.
- **FF-L-18** — dependency freshness. Run `npm audit` as routine maintenance; no
  reachable exploit path was identified, so it is not a blocker.
