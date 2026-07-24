# Security Review & Fixes — Order App

## Root cause
The app has **no authentication layer**: the API and Firestore trust whoever calls
them. All findings below stem from that. Fixes were made **safe-by-default** — nothing
changes on deploy until you set the matching environment variable, so the live site
keeps working exactly as it does now. Payment, notifications, and features were not
touched.

## What changed (files modified)

### 1. `server.ts`
- **Debug endpoints locked (ON by default).** `/api/debug*` dumped the full DB + PII.
  They now return `404` in production (override with `ENABLE_DEBUG_ENDPOINTS=true`).
  *Safe:* the frontend's only debug call handles a 404 silently (returns `null`).
- **Admin authentication (opt-in via `ADMIN_PASSWORD`).** Every `/api/admin/*` route
  (mark-as-paid, cancel, free delivery, promo codes, settings, zones) was callable by
  anyone. Set `ADMIN_PASSWORD` → the dashboard asks for it once and sends a signed
  HttpOnly cookie automatically. **Unset → behaviour unchanged (nothing breaks).**
  New routes: `/api/admin/login`, `/api/admin/logout`, `/api/admin/auth-status`.
- **Payment webhook forgery guard (opt-in via `PAYMENT_WEBHOOK_SECRET`).** The webhook
  marked orders "paid" from an unsigned request body — anyone could forge it. When the
  secret is set, requests must present it (`?whsec=...` in the UPayments notification
  URL, or header `x-webhook-secret`). Unset → unchanged.
- **New `/api/admin/settings/general`** endpoint — the admin dashboard now saves the
  3 store settings through the (authenticated) server instead of writing straight to
  Firestore from the browser. Same result, no direct client write.
- **Order-amount guard.** `/api/orders` now rejects impossible totals (negative / NaN)
  always. The proportional under-pricing floor is **opt-in** (`ORDER_TOTAL_FLOOR_RATIO`,
  e.g. `0.05`) so it can never reject a legitimate free / fully-discounted order.

### 2. `src/pages/AdminDashboard.tsx`
- The 3 direct-to-Firestore `setDoc` writes (free delivery, threshold, WhatsApp number)
  now call `/api/admin/settings/general`.
- Added a **fail-open login screen**: shown only when the server reports admin auth is
  enabled and the session isn't logged in. If auth is off or the check fails for any
  reason, the dashboard renders as before — it can never lock you out.

### 3. `firestore.rules.hardened` (NEW — not yet deployed, needs one check first)
Closes the biggest hole: today `allow read, write: if true` lets any browser read or
**wipe the whole database**. The hardened rules make the browser read-only and route all
writes through the backend (Admin SDK bypasses rules).

**Do NOT deploy blindly.** First confirm the backend uses the Admin SDK — in the Cloud
Run logs this line must be **absent**:
`[ADMIN_DB_INFO] ... Disabling Admin Firestore ... using Client SDK`
If it's absent, deploy safely:
```
cp firestore.rules.hardened firestore.rules && firebase deploy --only firestore:rules
```
If it's present, grant the Cloud Run service account the **Cloud Datastore User** role
first (otherwise locking writes would break order saving).

## How to activate (set these env vars on Cloud Run, then redeploy)
| Variable | Effect |
|----------|--------|
| `ADMIN_PASSWORD` | Turns on admin login (fixes unauthenticated admin endpoints) |
| `PAYMENT_WEBHOOK_SECRET` | Stops forged "paid" webhooks (also add `?whsec=...` in UPayments) |
| `ORDER_TOTAL_FLOOR_RATIO=0.05` | Enables the under-pricing guard (optional) |

## Residual (needs an architecture change, not a safe patch)
The customer split-payment page and admin dashboard read the whole company document in
real time, so `appData` stays publicly **readable** even with the hardened rules. Fully
closing that requires splitting the data model + real auth — a refactor that would touch
the payment page, which was intentionally left untouched per your instruction.

## Good news
Secrets (`GEMINI_API_KEY`, `UPAYMENTS_API_KEY`) are read from env — **not hardcoded**.
