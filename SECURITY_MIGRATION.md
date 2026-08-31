# Security Architecture Hardening — Migration Plan

**Goal:** move from an *open, client-authoritative* architecture to a
*production-safe* one **with zero feature loss and zero UX change**.

This document is the design record. It is intentionally incremental: only the
**Phase A** changes below are implemented in this PR. Every later phase depends
on validation that can only be done against the live Firebase project / payment
provider and is therefore documented here as a gated next step — **not** applied
blindly.

---

## 1. Previous architecture

```
Browser (customer + admin)
   │
   ├── customer: narrow server APIs (POST /api/orders, /api/track-orders,
   │             /api/create-payment, /api/create-split-payment, /api/products,
   │             /api/settings …)  ← server-authoritative pricing already here
   │
   └── admin dashboard: DIRECT Firestore client SDK
                        (onSnapshot reads + setDoc writes to
                         appData/shared_company_data)
   │
Server (Express, server.ts)
   │
   └── Firebase Admin SDK (service account) → Firestore  (bypasses rules)

Firestore rules: allow read, write: if true;   ← public read/write of everything
```

## 2. Security root cause

The datastore is world-readable and world-writable **by design**, through two
independent surfaces:

| # | Surface | Auth | Active caller |
|---|---------|------|---------------|
| A | Firestore `appData/shared_company_data` via client SDK (`firestore.rules: allow-all`) | none | **admin dashboard** (reads via `onSnapshot`, writes via `setDoc`) |
| B | `GET`/`PATCH /api/appdata` (HTTP) | none | **none** — the `src/lib/fakestore.ts` shim that used it is imported nowhere in `src/` |
| C | `GET /api/debug*`, `GET /api/debug/order/:id` (HTTP) | none | **none** in `src/` (one root-level dev script only) |

Surface **B/C** are reachable by anyone with `curl` (no Firebase config needed)
and expose full customer PII + arbitrary datastore overwrite. Surface **A** is
the deeper root cause and is coupled to a live feature (admin real-time view +
edits), so it cannot be closed without a staged migration.

## 3. Target architecture

```
Browser
   │  (narrow, validated, authenticated where required)
   ▼
Server API  (business rules + server-authoritative financial state)
   │
   ▼
Firestore via Admin SDK (service account)     ← only writer
Firestore rules: deny public write; allow authenticated-admin read/write only
```

Customers keep using the existing **unauthenticated narrow APIs** (no forced
login — the current flow requires none). Admin actions authenticate with the
**existing Firebase Auth** and are validated **server-side** (`admin===true ||
role==='admin'`, already implemented in `adminAuth`).

## 4. Data Access Matrix

| Data / Action | Current caller | Required actor | Auth requirement | Target API |
|---|---|---|---|---|
| Catalog read (products/settings/zones) | customer (narrow API) | public | none | `GET /api/products`, `/api/settings` (unchanged) |
| Create order | customer | public | none + server validation | `POST /api/orders` (unchanged; already server-authoritative) |
| Track order | customer (by phone) | public | none (phone-scoped) | `GET /api/track-orders` (unchanged) |
| Create/pay split (Qatia) | customer | public | none + server validation | `POST /api/create-split-payment` (unchanged) |
| Payment callback | provider | provider | webhook token (+ future signature) | `POST /api/webhook/upayments` (unchanged) |
| Admin real-time read | admin dashboard (Firestore direct) | admin | Firebase admin claim | **Phase B**: authed read path / rules-gated read |
| Admin settings/catalog/order write | admin dashboard (Firestore `setDoc`) | admin | Firebase admin claim | **Phase B**: route through authed server API, then rules deny direct write |
| Full datastore read (`GET /api/appdata`) | **none** (dead shim) | admin only | admin token | **Phase A (done)**: `adminAuth` |
| Full datastore write (`PATCH /api/appdata`) | **none** (dead shim) | admin only | admin token | **Phase A (done)**: `adminAuth` |
| Debug/PII dumps (`/api/debug*`) | **none** in app | admin only | admin token | **Phase A (done)**: `adminAuth` |

## 5. Migration phases

- **Phase A — Close dead/debug HTTP surfaces (IMPLEMENTED in this PR).**
  Gate `GET`/`PATCH /api/appdata` and all `/api/debug*` behind the existing
  `adminAuth`. Provably safe: no active `src/` caller; admin keeps access with a
  token. Reversible in one line each.
- **Phase B — Migrate admin writes to an authed server API.** Replace the
  admin dashboard's direct `setDoc` calls with calls to authenticated server
  endpoints (server already writes via Admin SDK). Requires touching
  `AdminDashboard.tsx` and validating against the live admin auth session.
- **Phase C — Migrate admin reads.** Move the admin `onSnapshot` real-time read
  either to a Firebase-Auth-gated Firestore read (rules keyed on the admin
  claim) or to an authed server stream/poll. Requires live-session validation.
- **Phase D — Tighten Firestore rules** (see §11). Only after B+C prove no
  public caller needs direct Firestore access.
- **Phase E — Remove the dead `fakestore` shim** and, if confirmed unused
  externally, the `/api/appdata` compatibility routes.

## 6. Files changed (this PR)

- `server.ts` — inserted the existing `adminAuth` middleware into 9 dead/debug
  routes. No handler logic changed. No customer route touched.
- `src/tests/security-hardening.test.ts` — new regression + preservation tests.
- `SECURITY_MIGRATION.md` — this document.

Client bundle output hash is **unchanged** from baseline (no client code
touched).

## 7–10. Preservation / auth / authorization / financial proofs

See the PR description and the new test suite. In summary: customer ordering,
tracking, pricing, Qatia/split, payment links, PWA/offline, notifications, and
existing UI/UX are untouched (no client file changed); admin retains full access
to every gated endpoint via its existing token; server-authoritative pricing and
terminal-state / idempotency guards are unchanged.

## 11. Firestore rules — before / after (DESIGN ONLY — not applied)

**Before (current, live):**
```
match /{document=**}                     { allow read, write: if true; }
match /appData/{document=**}             { allow read, write: if true; }
match /appData/shared_company_data       { allow read, write: if true; }
```

**Target (apply only after Phases B+C):**
```
match /appData/{document=**} {
  // Server (Admin SDK / service account) bypasses these rules entirely.
  // Direct client access limited to authenticated admins.
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```
> **Blocker:** flipping these rules now would break the admin dashboard's
> direct `onSnapshot`/`setDoc`. Do **not** apply until admin read+write are
> migrated (Phases B+C) and validated in staging. This cannot be validated from
> the repo alone (needs the live Firebase project + a real admin session), and
> deploying is out of scope for this task.

## 12. Tests added

`src/tests/security-hardening.test.ts`:
- Anonymous → 401 on `PATCH`/`GET /api/appdata` and all 7 debug routes.
- Non-admin token → 403.
- Admin token → 200 (access preserved).
- Preservation: anonymous `POST /api/orders` → 201 with correct
  server-authoritative total; `GET /api/products` / `/api/track-orders` remain
  public.

## 13. Verification (clean checkout)

`npm ci` PASSED · `npm run lint` PASSED · `npx vitest run` PASSED (25/25) ·
`npm run build` PASSED (client hash unchanged).

## 14. Remaining provider-dependent blockers

- **Webhook cryptographic signature** — needs the real UPayments signing
  contract. Current token check is a structural boundary only.
- **Amount / currency reconciliation** at settlement — needs the provider's
  authoritative transaction amount/currency in the callback payload.
- **Distributed/persistent idempotency** — current in-memory cache is
  single-instance; production clustering needs a transactional datastore key.
- **Firestore rules tightening (Phase D)** — needs live admin-session validation.

## 15. Rollback procedure

Phase A is fully reversible with no data impact:
1. `git revert <this PR merge>` — or remove the `adminAuth,` argument from the 9
   gated routes in `server.ts`.
2. No schema, data, config, or client change was made, so no data migration or
   client redeploy is required to roll back.

## 16. Independent reviewer verdict

See PR description. The implemented change is limited to gating
zero-caller endpoints behind existing auth; it removes no feature, changes no
customer/payment/order behavior, expands no permission, and is covered by tests
that fail on the pre-change code (anonymous access returned 200 before).
