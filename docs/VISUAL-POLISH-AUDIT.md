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
