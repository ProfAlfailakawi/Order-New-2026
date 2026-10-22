# Visual polish audit

Scope: visual layer only. No logic, pricing, payment, webhook, order lifecycle, routes or data code touched.
Guards: the repo has no visual-token/design-system/typography guard scripts; the only source-reading test is
`src/tests/dna-polish.test.ts` (SplitPayment spring keyframes), which is unaffected. Every string shortened was
grepped across the repo (src, scripts, tests, workflows): none is referenced elsewhere.

## Inventory

| Area | File | State | Findings | Action |
|---|---|---|---|---|
| App shell, branded loader, 404 | src/App.tsx | rendered | Already calm: logo, skeleton, one CTA | Left alone |
| Welcome sheet (first visit) | src/components/OrderWelcome.tsx | rendered | Already icon chips + single CTA; subtitle short | Left alone |
| Entry screen (home) | src/pages/CustomerSite.tsx | rendered | Clean hero, 2 buttons, icon chips | Left alone |
| Menu, product cards, categories, cart | CustomerSite.tsx, FoodCard.tsx, dna/ProductVisual.tsx | source only | Gradient/shadow styling already tokenised in beauty-pass.css | Left alone |
| Invoice reveal (checkout) | CustomerSite.tsx ~9163 | source | Sentence under heading restated the next step ("without changing any payment step") | Shortened to one line; stats tiles (real data) kept |
| Checkout payment step | CustomerSite.tsx ~9498-9503 | source | Two long helper sentences stacked above method cards; "scroll a bit" instruction | Shortened to short labels |
| Address / region error | CustomerSite.tsx ~8915 | source | Short, actionable | Left alone |
| Diwaniya inbox notes | CustomerSite.tsx ~7083-7108 | source | Short single-purpose notes | Left alone |
| Squad modal: notifications, order coordination, join by code, diwaniya management | src/components/SquadModalContent.tsx 1435, 1512, 1595, 1730, 1789 | source | Sub-headings repeating what the heading and controls already say | Shortened (5 lines). Other helper lines (2593, 2666 etc.) left: they explain distinct entry paths |
| Squad modal remainder, SaduPresenceRug, RouletteSplit, SmartIconGuidance, DynamicEnvironment, MessageWithIcons | src/components/* | source | Large, interaction-heavy; no clear safe wins | Left alone |
| Track lookup | src/pages/OrderPage.tsx | rendered | Calm: two fields, one CTA, sadu strip | Left alone |
| Track details / stepper / invoice tab | OrderPage.tsx, dna/DnaKit.tsx | source | Already step flow + ring; line 990 single sentence | Left alone |
| Split payment (qatya) | src/pages/SplitPayment.tsx | rendered error state only (needs a real order) | Error state clean; hint at 1110 is functional navigation help | Left alone |
| Admin dashboard stat tiles, tiers, peak hours | src/pages/AdminDashboard.tsx | rendered | Already stat tiles/mini-charts | Left alone |
| Admin empty states (orders, search, invoices, zones, coupons) | AdminDashboard.tsx 768, 872, 984, 1798, 2004 | source | Two-sentence empty-state paragraphs | Shortened to one line each |
| Admin settings helper lines | AdminDashboard.tsx 1048-1739 | source | Each explains a distinct setting consequence (shop closed, free delivery, phone format) | Left alone: they carry safety meaning |
| Offline modal, order loader, new-invoice modal, location picker/map, splash | src/components/* | source | Compact; one-line helpers | Left alone |
| Styles | src/index.css, beauty-pass.css, identity.css, dna/*.css, public/fonts/fonts.css | source | Large, layered override sheets; changing shared rules risks regressions elsewhere | Left alone |
| Static | index.html, public/launch, public/screenshots | source | No UI pollution | Left alone |

## Could not verify
Dev server (`server.ts`) needs Google credentials, so Vite alone was used. Screens needing live data
(menu, cart, checkout steps, squad modal, split payment with a real order, track results) were not rendered;
the edited strings there are verified by typecheck/build only, not visually.

---

# Round 2: quiet motion and last-layer polish

Scope: presentation only. No pricing, payment, webhook, order-lifecycle, route, data or server code touched; no dependency, lockfile, workflow or service-worker change. New files: `src/motion.css` (loaded last, after `identity.css`), `src/lib/reveal.ts` (about 90 lines, no dependency). Edits: one import and one call in `src/main.tsx`; two helper paragraphs removed from the squad "join or found" panel.

How the app was rendered: the Vite dev server alone (no Google credentials), with Playwright intercepting `/api/customer-menu`, `/api/settings`, `/api/regions` and `/api/track-orders` and answering them from `shared_products.json` plus three fixture orders (split in progress, paid, awaiting payment). This reached screens round 1 could not: menu, category open, product sheet, dock, cart, address, payment step, track list, order sheet (both tabs), split payment (overview, my share, people), squad entry, admin dashboard and 404. Nothing was submitted; `/api/orders` and `/api/create-payment` fall through to a 404 stub.

## What round 2 found already done (and left alone)
The previous layers already carry most of the motion the brief asks for: stagger on order cards (`OrderPage`, motion index x 50ms, max 8), stagger on product cards, tab cross-fade (`orderTabFade`), dock pop-in, sadu band weave, step/ring/progress fills in `dna.css`, skeleton shimmer, a global reduced-motion safety net. Duplicating any of it would fight it, so round 2 adds only what was missing.

## Per screen

| Screen | Changed | Left alone and why |
|---|---|---|
| Checkout, payment step | Removed the floating "scroll down to see payment methods" pill (it bobbed forever and the cards were already on screen), the divider pill restating the next heading, and the one-line list of the three methods under the section label. The section label is now a quiet saffron line instead of a second card. The three method cards now sit higher: on desktop all three are visible without scrolling. Invoice orbits, ready-card sheen and the wahag ring no longer loop forever. | Amount tiles, method cards, buttons and their handlers; no motion added anywhere on this step. |
| Menu, category tiles | Tiles fade and rise once with a 40ms stagger (max 8) the first time they actually reach the screen; 1px hover lift; | Product cards (already animated by motion + identity.css hover). |
| Squad modal, join-or-found panel | Two small helper paragraphs removed (the phone line restated the list that appears after login; the code line restated the extra fields, which carry their own label). Heading, top sentence, fields and buttons unchanged. | Rest of the modal: interaction-heavy, no clear safe win. |
| Dock actions, dna buttons | Press settle `scale(.98)` at 120ms. | Dock amount and summary: not animated. |
| Track sheet | Tab buttons settle in with the sheet (180ms fade + 6px). | Panels already cross-fade; list cards already staggered; timeline already animates its fill. |
| Empty states (`.dna-void`, admin `.empty-state-art`) | Fade + 8px rise, 260ms, once. | Copy (shortened in round 1). |
| Split payment | Only the decorative wahag ring loop is held still (CSS rule; that stage was not on screen in the fixture, so this one is source-only). | Ring, amounts, people rows, payment tab: money and payment-state screen, no motion added on purpose. |
| Admin, entry screen, 404, offline | Nothing. | Already calm, already animated by earlier layers, or internal. |

## Motion inventory (all in `src/motion.css`, all under `prefers-reduced-motion: no-preference`)

Tokens: `--m-ease: cubic-bezier(.2,.7,.2,1)`, `--m-fast 120ms`, `--m-med 180ms`, `--m-slow 260ms`, `--m-step 40ms`, `--m-rise 8px`.

| What | Trigger | Duration | Properties |
|---|---|---|---|
| Category tile reveal (`[data-m-in]`) | First time the tile is on screen and uncovered, once per element | 260ms, +40ms per item, max 7 steps | opacity, translateY |
| Empty-state block and icon | Mount | 260ms | opacity, translateY / opacity |
| Category tile hover lift | Hover (pointer devices) | existing 220ms transition | translateY(-1px) |
| Press settle on dock actions and dna buttons | `:active` | 120ms | scale(.98) |
| Track sheet tab buttons | Mount | 180ms | opacity, translateY(6px) |

Every keyframe has only a `from` frame, so the end state is the element's own static style. Reduce mode: the hold style is never applied by the script (it returns early), and an explicit reduce block sets `animation: none; transition: none` and `transform: none` on all of the above.

`reveal.ts` safety: the hold style exists only under `html[data-m-js]`, which the script sets itself, so with no JS nothing is hidden; items below the fold wait for scroll; anything on screen but covered (splash, entry screen) is released after 6s regardless; it needs no IntersectionObserver (a scroll listener and a 160ms poll while items are pending).

## Not done, on purpose
Progress rings and bars on split/checkout (amounts); sliding active-tab indicator and focus-ring ease-in (would need `outline-offset` or box-shadow animation, outside the transform/opacity rule); parallax, loops, confetti. The existing confetti and decorative loops elsewhere were not removed except the three listed above.

## Verification
Typecheck (`npm run lint`, tsc --noEmit) clean; `npx vitest run` 8 files / 76 tests pass; `npm run build` (includes verify:pwa) passes. Browser checks at 390 and 1280: no horizontal overflow on menu, track, split, admin and 404, with and without reduced motion; tiles reach opacity 1 and identical rects after the reveal; with reduced motion the script holds nothing and tiles are visible immediately. Not verified: real-device Safari, real Firestore data, the payment redirect and webhook paths (deliberately never exercised), admin with a real login.
