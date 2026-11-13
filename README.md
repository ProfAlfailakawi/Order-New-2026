# Customer Ordering Application (Order-New-2026)

[![CI](https://github.com/ProfAlfailakawi/Order-New-2026/actions/workflows/ci.yml/badge.svg)](https://github.com/ProfAlfailakawi/Order-New-2026/actions/workflows/ci.yml)
[![Deploy hosting](https://github.com/ProfAlfailakawi/Order-New-2026/actions/workflows/deploy.yml/badge.svg)](https://github.com/ProfAlfailakawi/Order-New-2026/actions/workflows/deploy.yml)
[![Deploy watchdog](https://github.com/ProfAlfailakawi/Order-New-2026/actions/workflows/deploy-watchdog.yml/badge.svg)](https://github.com/ProfAlfailakawi/Order-New-2026/actions/workflows/deploy-watchdog.yml)

The customer-facing ordering site for Al-Turath (مطبخ التراث): menu, cart and checkout, UPayments online payment, split payment between friends ("القطية"), order tracking, the "Diwaniya" squad/loyalty layer, and a PWA / iOS shell. An Express server ([server.ts](server.ts)) serves the React app and the `/api/*` endpoints, backed by Firestore. It is the sister of **Admin-New-2026** (the owner's admin app), which receives a push nudge for every new order.

**Live:**
- https://alturathkw.shop (custom domain)
- https://gen-lang-client-0200723670.web.app (Firebase Hosting; `/api/**` is rewritten to the Cloud Run service `order` in `europe-west3`, see [firebase.json](firebase.json))
- The commit that is live can be read from `/build-id.json` on either host.

---

## Feature map / خريطة الميزات

| الميزة / Feature | ما تفعله / What it does | الرابط المباشر / Live route | الشيفرة / Code | الحالة / Status |
|---|---|---|---|---|
| Menu & storefront | Product grid with categories, product sheet, cached menu, top products, recent-orders "FOMO" strip, splash and welcome sheet | [/](https://alturathkw.shop/) | [src/pages/CustomerSite.tsx](src/pages/CustomerSite.tsx), [src/lib/customerMenuTransport.ts](src/lib/customerMenuTransport.ts), [src/components/OrderWelcome.tsx](src/components/OrderWelcome.tsx), [src/components/ZenSplashScreen.tsx](src/components/ZenSplashScreen.tsx); API `GET /api/customer-menu`, `/api/top-products`, `/api/recent-fomo` in [server.ts](server.ts) | Works / يعمل |
| Server-authoritative pricing | Item, delivery and discount totals are recomputed on the server from the catalog; client prices are not trusted | — | [src/utils/priceCalculation.ts](src/utils/priceCalculation.ts), `POST /api/orders` in [server.ts](server.ts); test [src/tests/price-calculation.test.ts](src/tests/price-calculation.test.ts) | Works / يعمل |
| Checkout & order creation | Cart, structured Kuwaiti address (منطقة/قطعة/شارع/جادة/منزل), map pin, delivery zones, idempotency key against double submits | / (checkout drawer) | [src/pages/CustomerSite.tsx](src/pages/CustomerSite.tsx), [src/utils/kuwaitAddress.ts](src/utils/kuwaitAddress.ts), [src/components/LeafletLocationPicker.tsx](src/components/LeafletLocationPicker.tsx), [src/utils/geolocation.ts](src/utils/geolocation.ts); API `POST /api/orders`, `GET /api/regions` | Works / يعمل |
| Store hours / open-closed gate | Checkout is refused while the store is closed (Kuwait time zone), with the owner's closing message | / | [src/lib/storeAvailability.ts](src/lib/storeAvailability.ts); test [src/tests/store-availability.test.ts](src/tests/store-availability.test.ts) | Works / يعمل |
| Promo codes | Validates a promo code at checkout | / (checkout) | `POST /api/validate-promo` in [server.ts](server.ts) | Works / يعمل |
| Online payment (UPayments) | Creates a UPayments charge; an order is marked paid only after UPayments confirms the capture (return URL and webhook are no longer trusted on their own); one owner notification per paid order | — | [src/lib/upaymentsVerify.ts](src/lib/upaymentsVerify.ts), [src/utils/redirect.ts](src/utils/redirect.ts); `POST /api/create-payment`, `/api/payment-return/*`, `/api/payment-webhook/*` in [server.ts](server.ts); test [src/tests/payment-verification.test.ts](src/tests/payment-verification.test.ts) | Works / يعمل |
| Split payment ("القطية") | Shareable split link; each friend pays a share; overpay protection; unpaid split orders expire after 90 minutes | /split/:id | [src/pages/SplitPayment.tsx](src/pages/SplitPayment.tsx); `POST /api/create-split-payment`, `GET /split/:id` (WhatsApp link preview) in [server.ts](server.ts) | Works / يعمل — the custom link preview only runs on the Cloud Run origin; on the Hosting domains `/split/*` is served `index.html`, so crawlers get the generic preview |
| Roulette ("who pays?") | Friends join a split order and spin a roulette to pick who pays | /split/:id | [src/components/RouletteSplit.tsx](src/components/RouletteSplit.tsx); `POST /api/orders/:id/join-roulette`, `/spin-roulette` | Works / يعمل |
| Order tracking | Track by phone or order id, journey stepper, invoice view, WhatsApp share, re-order, re-open payment link | [/track](https://alturathkw.shop/track) | [src/pages/OrderPage.tsx](src/pages/OrderPage.tsx), [src/utils/trackStepState.ts](src/utils/trackStepState.ts), [src/utils/invoiceShare.ts](src/utils/invoiceShare.ts); `GET /api/track-orders`, `PUT /api/orders/:id/payment-link`; tests [src/tests/journey-stepper.test.ts](src/tests/journey-stepper.test.ts) | Works / يعمل |
| Diwaniya (squads) | Create/join a squad (code, temporary 4-digit code, QR entry, geofence join with approval), presence, group order, shared memories, leaderboard and tiers | / (squad modal) | [src/components/SquadModalContent.tsx](src/components/SquadModalContent.tsx), [src/components/LeafletKuwaitMap.tsx](src/components/LeafletKuwaitMap.tsx); `/api/squad-*`, `GET /api/squad-gamification` in [server.ts](server.ts) | Works / يعمل |
| Loyalty points | Points are granted only when an order is fully paid; tiers configurable from admin | / | `GET /api/customers`, loyalty settings in [server.ts](server.ts) | Works / يعمل |
| Diwaniya push notifications | Opt-in web push (Firebase Cloud Messaging) for squad events | / | [src/lib/diwaniyaPush.ts](src/lib/diwaniyaPush.ts), [public/firebase-messaging-sw.js](public/firebase-messaging-sw.js); `POST /api/diwaniya-push/register` | Works / يعمل |
| AI smart search | Natural-language menu search via Gemini (server-side key, daily budget) | / (search) | [src/lib/aiGateway.ts](src/lib/aiGateway.ts); `POST /api/smart-search` | Works / يعمل (needs `GEMINI_API_KEY`) |
| AI "order for me" / support / upsell | Cart builder, support answers and upsell over the real catalog (model prices never trusted) | — (API only, no UI calls it) | [src/lib/aiOrderService.ts](src/lib/aiOrderService.ts); `POST /api/ai/order-for-me`, `/api/ai/order-support`, `/api/ai/upsell`; test script [scripts/ai-order-service.test.ts](scripts/ai-order-service.test.ts) | Experimental / تجريبي |
| Weather-aware backdrop | Background effect from live Kuwait weather (Open-Meteo) | / | [src/components/DynamicEnvironment.tsx](src/components/DynamicEnvironment.tsx) | Works / يعمل |
| `/admin` redirect | The old in-app admin page was removed; `/admin/*` now redirects to the admin app | /admin | [src/App.tsx](src/App.tsx) (`AdminRedirect`); `/api/admin/*` in [server.ts](server.ts) (admin ID token required) | Redirect only — admin work is in Admin-New-2026 |
| PWA & offline | Installable app, service worker, offline modal, install-surface guard run before every build | / | [public/manifest.json](public/manifest.json), [public/sw.js](public/sw.js), [src/components/OfflineModal.tsx](src/components/OfflineModal.tsx), [src/hooks/useOnlineStatus.ts](src/hooks/useOnlineStatus.ts), [scripts/verify-pwa.mjs](scripts/verify-pwa.mjs) | Works / يعمل |
| Silent self-update & "we're updating" page | Compares the bundle build id with `GET /api/version` and reloads quietly; a branded «نُحدّث البرنامج» page instead of Google's error page during a deploy | /updating.html | [src/lib/app-update.ts](src/lib/app-update.ts), [src/lib/updatingNotice.ts](src/lib/updatingNotice.ts), [scripts/build-stamp.mjs](scripts/build-stamp.mjs), [public/updating.html](public/updating.html); tests [src/tests/updating-page.test.ts](src/tests/updating-page.test.ts), [src/tests/updating-health.test.ts](src/tests/updating-health.test.ts) | Works / يعمل |
| Visual identity & responsive layouts | Sadu identity layer, motion, iPhone Duo / folded layouts, accessibility pass | / | [src/identity.css](src/identity.css), [src/motion.css](src/motion.css), [src/duo.css](src/duo.css), [src/beauty-pass.css](src/beauty-pass.css), [src/components/dna/](src/components/dna/); audits [docs/QUALITY-SCORECARD.md](docs/QUALITY-SCORECARD.md), [docs/VISUAL-POLISH-AUDIT.md](docs/VISUAL-POLISH-AUDIT.md) | Works / يعمل |
| Privacy policy page | Static page, intentionally not linked from the menu | [/privacy-policy.html](https://alturathkw.shop/privacy-policy.html) | [public/privacy-policy.html](public/privacy-policy.html) | Works / يعمل |
| ORBIT error sensor | Self-hosted script that sends anonymous error notes (no query strings, no user data) | / | [public/orbit-sensor.js](public/orbit-sensor.js) | Works / يعمل |
| Native iOS / iPadOS / Mac shell | Capacitor shell that loads the live site; App Store metadata and release script | — (not yet in the App Store) | [apple/](apple/), [apple/apple-release.sh](apple/apple-release.sh), [apple-release/checklists/release.md](apple-release/checklists/release.md) | In progress / قيد التطوير — signed build and store submission still open |

---

## Architecture

- **Stack:** React 19 + Vite 6 + Tailwind 4 (frontend), Express 4 run with `tsx` (server), Firebase (Firestore, Cloud Messaging, Admin SDK), UPayments, Gemini via `@google/genai`, Leaflet maps, Vitest.
- **Routes (frontend):** `/`, `/track`, `/split/:id`, `/admin/*`, plus a not-found page — see [src/App.tsx](src/App.tsx).
- **Folders:**
  - [server.ts](server.ts) — the whole API (orders, payments, webhook, squads, admin, debug) and the static/Vite host.
  - [src/pages/](src/pages/) — the four screens; [src/components/](src/components/) — shared UI; [src/lib/](src/lib/) — server+client logic (payments verify, AI gateway, store hours, push, self-update); [src/utils/](src/utils/) — pricing, address, invoice share.
  - [src/tests/](src/tests/) — Vitest suites; [scripts/](scripts/) — build stamp, PWA guard and one-off maintenance scripts.
  - [public/](public/) — PWA assets, service workers, static pages; [apple/](apple/) and [apple-release/](apple-release/) — iOS shell and store material.
- **Key endpoints** (all in [server.ts](server.ts)):
  - Health/version: `GET /api/health`, `GET /api/version`
  - Ordering: `GET /api/customer-menu`, `GET /api/settings`, `GET /api/regions`, `POST /api/validate-promo`, `POST /api/orders`
  - Payments: `POST /api/create-payment`, `POST /api/create-split-payment`, `/api/payment-return/*`, `POST /api/payment-webhook/*` (and `/api/webhook/upayments`)
  - Tracking: `GET /api/track-orders`, `GET /api/search-order/:phone`, `GET /api/customers`
  - Squads: `/api/squad-*`, `/api/diwaniya-*`
  - Admin (Firebase ID token with `admin` claim required, rate-limited): `/api/admin/*`, `/api/appdata`, `/api/debug*`
- **Data:** Firestore. [firestore.rules](firestore.rules) keeps the legacy `appData/*` subtree open on purpose (the admin page and split page read it directly); everything else is server-only. The migration plan is in [SECURITY_MIGRATION.md](SECURITY_MIGRATION.md), open items in [SECURITY-TODO.md](SECURITY-TODO.md).
- **Product vision (Arabic):** [VISION.md](VISION.md).

## Run locally

**Prerequisites:** Node.js 22 (the version CI uses).

1. `npm ci`
2. Create `.env.local` with the variables you need (never commit it):
   - `GEMINI_API_KEY` — AI search and AI endpoints.
   - `UPAYMENTS_API_KEY` (and optionally `UPAYMENTS_MODE` / `UPAYMENTS_ENV` for sandbox) — creating and verifying payments.
   - `UPAYMENTS_TOKEN` — when set, the webhook requires `Authorization: Bearer <token>`.
   - `PORT` — optional, defaults to 3000.
3. `npm run dev`

| Script | Command | What it does |
|---|---|---|
| `dev` | `tsx server.ts` | Express + Vite dev server |
| `start` | `tsx server.ts` | Same entry point, used in production (Cloud Run) |
| `build` | `npm run verify:pwa && vite build --emptyOutDir` | PWA guard, then production build to `dist/` (writes `dist/build-id.json`) |
| `preview` | `vite preview` | Serve the built frontend |
| `lint` | `tsc --noEmit` | Typecheck (there is no ESLint step in this script) |
| `test` | `vitest run` | Runs `src/tests/**/*.test.ts` |
| `verify:pwa` | `node scripts/verify-pwa.mjs` | Manifest/icon/service-worker checks |
| `clean` | `rm -rf dist` | Remove build output |

## Tests & quality gates

- [CI](.github/workflows/ci.yml) runs on every push and pull request to `main`: `npm ci` → `npm run lint` → `npx vitest run` → `npm run build`.
- Test suites in [src/tests/](src/tests/), e.g. [payment-verification](src/tests/payment-verification.test.ts), [price-calculation](src/tests/price-calculation.test.ts), [security-hardening](src/tests/security-hardening.test.ts), [review-2026-10-28](src/tests/review-2026-10-28.test.ts) (customer-data leak fixes), [store-availability](src/tests/store-availability.test.ts), [kuwait-address](src/tests/kuwait-address.test.ts), [audit](src/tests/audit.test.ts), [duo-audit](src/tests/duo-audit.test.ts).
- [scripts/ai-order-service.test.ts](scripts/ai-order-service.test.ts) is a separate script (`npx tsx scripts/ai-order-service.test.ts`) and is **not** part of `npm test` or CI.

## Deployment

- **Frontend (Firebase Hosting)** has two routes:
  1. Cloud Build trigger `order-main-deploy` runs [cloudbuild.yaml](cloudbuild.yaml) on push to `main`: `npm ci` → `npm run build` → `firebase deploy --only hosting` → checks the live `build-id.json`.
  2. [Deploy hosting](.github/workflows/deploy.yml) — **manual only** (`workflow_dispatch`, `main` branch): typecheck, test, build, deploy, verify. It needs the `FIREBASE_SERVICE_ACCOUNT` repo secret; without it the deploy step is skipped with a warning.
- **API (Cloud Run service `order`, `europe-west3`)** is built from the [Dockerfile](Dockerfile) by a separate Cloud Build trigger configured in Google Cloud (not in this repo).
- [Deploy watchdog](.github/workflows/deploy-watchdog.yml) runs hourly (and on demand) and fails if the live `build-id.json` is not the latest `main` commit.

## Known gaps

- `appData/*` in Firestore is world-readable/writable until the migration in [SECURITY_MIGRATION.md](SECURITY_MIGRATION.md) is done.

---

آخر تحديث للتوثيق: 2026-11-12
