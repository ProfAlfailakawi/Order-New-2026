# Security Review — Order App

## Root cause
The app has **no authentication layer**. The Express API and Firestore both trust
whoever calls them. The most dangerous consequences:

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 1 | `firestore.rules` = `allow read, write: if true` | Any browser can read/overwrite the **entire** database directly | ⚠️ Needs auth (architectural) |
| 2 | Whole company DB (all customers/orders/PII) shipped to every browser via `appData/shared_company_data` | Mass PII leak by design | ⚠️ Needs refactor |
| 3 | No auth on any `/api/admin/*` endpoint | Anyone can mark orders paid, cancel, give free delivery, edit promo codes | ⚠️ Needs auth |
| 4 | `/api/debug*` endpoints dump full DB + PII | Trivial data exfiltration via public URL | ✅ **Fixed** |
| 5 | `/api/payment-webhook` trusts client `status` with no signature | Anyone can forge a "paid" order (free products) | ✅ **Fixed (opt-in)** |
| 6 | Order `total` is client-controlled in `/api/orders` | Price manipulation | ⚠️ Needs server-side recompute |

Good: secrets (`GEMINI_API_KEY`, `UPAYMENTS_API_KEY`) are read from env, **not hardcoded**.

## Files modified
- **`server.ts`** — two safe, non-breaking fixes:
  1. **Debug lockdown** (`~line 1173`): all `/api/debug*` routes return `404` when
     `NODE_ENV=production`, unless `ENABLE_DEBUG_ENDPOINTS=true`.
  2. **Webhook forgery guard** (`~line 4275`): when `PAYMENT_WEBHOOK_SECRET` is set,
     the webhook rejects any request that doesn't present it. **To activate**, set the
     env var and append `?whsec=YOUR_SECRET` to the notification URL in your UPayments
     dashboard (or send header `x-webhook-secret`). No effect until you set it.

## Not fixed here (require code/architecture changes that would break the live app)
Issues 1, 2, 3, 6 all stem from the missing auth layer. Fixing them safely means adding
authentication (e.g. Firebase Auth) and moving admin writes + the full-DB read off the
browser — this cannot be done as a drop-in patch without breaking the current app.
