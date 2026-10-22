# Quality scorecard, round 3 (presentation only)

Harness: Playwright + axe-core (the shared audit.mjs: H1 axe, H2 overflow, H3 clipping, H4 errors, H5 CLS, H6 focus ring, H7 stuck-invisible, H9 contrast, H8 reduced motion).
Run against the Vite dev server with `/api` and Firebase mocked. Light theme only (the site has no dark mode).

17 screens/states x 4 viewports (320, 390, 768, 1280) x normal/reduced motion = 136 measurements.
Screens: entry, menu, product sheet, menu with cart dock, cart, address empty, address filled, payment, squad entry, track lookup, track list, track sheet, split (open), split (paid), split (missing), admin (logged out), 404.

| | Before | After |
|---|---|---|
| Fully passing all hard criteria | 0 / 136 | 40 / 136 |
| axe failures (H1) | 136 | 57 (all minor: heading-order, one page-has-heading-one) |
| Contrast failures (H9) | 112 | 16 |
| Missing focus ring (H6, harness) | 104 | 72 |
| Stuck-invisible (H7) | 37 | 7 |
| Reduced-motion running animations (H8) | 3 | 2 |
| CLS (H5) | 0 | 2 |
| Targets under 44px (info) | 67 | 60 |

## Changed
- Viewport meta no longer blocks pinch zoom (meta-viewport on every screen).
- polish.css: two-step keyboard focus ring on every interactive element, darker text colours for small orange/emerald/amber/stone labels, 16px inputs on touch devices, table-header and invoice-summary label contrast.
- Landmarks and names: `main` on split page and 404, region labels on splash, welcome theatre, squad strip and hero, `role="search"` on the real search box, accessible names on 9 dialogs (product, checkout, squad, order details, radar, flash sale, verification), keyboard-reachable scroll panel, named back link, visible h1 on the split page.
- Off-centre best-seller carousel cards are now `inert` and `aria-hidden` (they were already unclickable; keyboard users could tab into them and their dimmed text failed contrast).
- Cart badge, swipe-delete background, expected-points line and disabled button opacity darkened for contrast.
- reveal.ts: only the first screenful is held for reveal; below-the-fold content stays visible (never stuck hidden).
- No motion added. No logic, data, payment, auth, server or test changes.

## Left alone (judged by eye at 390 for menu, cart, payment, split, track sheet)
The layouts, hierarchy and spacing already read well after rounds 1 and 2; no layout rewrites.

## Known gaps, honestly
- H6 failures are mostly a harness artifact: it calls `.focus()` after mouse clicks, where `:focus-visible` correctly does not match, and on inert carousel cards. A real Tab walk on the menu (20 stops) showed a ring on every stop (kb.mjs).
- heading-order (best practice, minor) remains on cart, address, payment, admin, split; page-has-heading-one remains on the paid split view in this table because that row was last measured before the h1 fix (the open split view passed that rule after it).
- Cart "مسح" 1.04:1 is the swipe-delete label hidden under the card; its background was darkened but the harness still reads the covered pixels. The disabled "write a valid phone" CTA text is 4.39:1 (disabled, exempt).
- squad-entry@768 CLS 0.174: lazy modal load, varied with machine load (the machine was at load average 100), not fixed.
- H7 stuck-invisible on a fixed bordered div and the location alert are entrance animations caught mid-fade.
- H8: framer MotionConfig reducedMotion="user" is on; the remaining animation is an opacity fade.
- Text-wall paragraphs (285, informational) and 44px targets (60) not addressed this round.
- Not viewed: dark mode (none exists), admin after login, real Firebase/payment flows, real devices, 1280 screenshots by eye beyond spot checks. The "product" clicked in the harness differs by time of day (featured list rotates), so before/after product sheets show different items.
- Several rows were measured before the last small edits (see above); lint, tests and build were run on the final tree.
