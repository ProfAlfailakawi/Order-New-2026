import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// iPhone Duo / every-width audit: guards the rules the layout depends on.
const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('iPhone Duo audit', () => {
  const html = read('index.html');

  it('never blocks page zoom (WCAG 1.4.4)', () => {
    expect(html).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(html).not.toMatch(/maximum-scale/i);
    expect(html).not.toMatch(/gesturestart|gesturechange|gestureend/);
    expect(html).not.toMatch(/addEventListener\(\s*['"]dblclick/);
    expect(html).toMatch(/touch-action:\s*manipulation/);
    expect(html).toMatch(/viewport-fit=cover/);
  });

  it('lays out from width/height, not from Device Posture or Viewport Segments', () => {
    for (const f of ['src/index.css', 'src/duo.css']) {
      const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css, f).not.toMatch(/device-posture|viewport-segments|viewport-segment-/);
    }
  });

  it('uses dynamic viewport units for full-height shells', () => {
    for (const f of ['src/App.tsx', 'src/pages/CustomerSite.tsx', 'src/pages/OrderPage.tsx', 'src/pages/SplitPayment.tsx', 'src/components/RouletteSplit.tsx']) {
      const src = read(f);
      expect(src, f).not.toMatch(/\bmin-h-screen\b/);
      expect(src, f).not.toMatch(/\bh-screen\b/);
      expect(src, f).not.toMatch(/100vh/);
    }
  });

  it('caps sheets and modals with dynamic viewport units (vh hides the bottom under Safari bars)', () => {
    for (const f of ['src/pages/CustomerSite.tsx', 'src/pages/OrderPage.tsx', 'src/components/NewInvoiceModal.tsx', 'src/components/SaduPresenceRug.tsx']) {
      expect(read(f), f).not.toMatch(/max-h-\[\d+vh\]/);
    }
    expect(read('src/index.css')).not.toMatch(/max-height:\s*\d+vh/);
  });

  it('gives the split-payment error screen a way out', () => {
    const src = read('src/pages/SplitPayment.tsx');
    const block = src.slice(src.indexOf('if (error) {'), src.indexOf('if (!order) {'));
    expect(block).toMatch(/navigate\("\/track"\)/);
    expect(block).toMatch(/navigate\("\/"\)/);
  });

  it('keeps the checkout sheet square when it fills the window', () => {
    expect(read('src/duo.css')).toMatch(/@media \(max-width: 680px\)\s*\{\s*html body \.checkout-wow-panel\s*\{\s*border-radius:\s*0/);
  });

  it('keeps the welcome sheet scrollable on short windows', () => {
    const css = read('src/duo.css');
    expect(css).toMatch(/\.ord-bp-theatre\s*\{[^}]*overflow-y:\s*auto/);
  });
  describe('opened Duo as a book (2026-11-14)', () => {
    const css = read('src/duo.css');
    const book = '(min-width: 640px) and (max-width: 720px) and (min-height: 760px) and (max-height: 1000px)';

    it('lays the inner screen out as two pages with a fold, from the window size only', () => {
      expect(css).toContain(book);
      expect(css).toContain('(min-width: 860px) and (max-width: 1000px) and (min-height: 520px) and (max-height: 700px)');
      expect(css).toMatch(/--duo-spine:\s*32px/);
      expect(css).toMatch(/html body::after\s*\{[^}]*pointer-events:\s*none/);
    });

    it('keeps the menu context wrapper invisible to layout outside the book', () => {
      // Unindented = top level, not inside any @media block.
      expect(css).toMatch(/\n\.duo-context-page\s*\{\s*display:\s*contents;\s*\}/);
      const src = read('src/pages/CustomerSite.tsx');
      const start = src.indexOf('<div className="duo-context-page">');
      expect(start).toBeGreaterThan(-1);
      const wrapped = src.slice(start, src.indexOf('<main className="p-4', start));
      expect(wrapped).toContain('aria-label="البحث والعروض"');
      expect(wrapped).toContain('role="search"');
    });

    it('opens centred dialogs on one page instead of across the fold', () => {
      const files: Record<string, number> = {
        'src/pages/CustomerSite.tsx': 7,
        'src/pages/OrderPage.tsx': 3,
        'src/components/OfflineModal.tsx': 1,
        'src/components/OrderWelcome.tsx': 1,
        'src/components/NewInvoiceModal.tsx': 1,
        'src/components/SaduPresenceRug.tsx': 3,
      };
      for (const [f, n] of Object.entries(files)) {
        expect((read(f).match(/duo-page-dialog/g) || []).length, f).toBeGreaterThanOrEqual(n);
      }
      expect(css).toMatch(/\.duo-page-dialog\s*\{[^}]*padding-inline:[^}]*50%/);
    });

    it('scopes the short-window product rules to the sheet header, not the add-on cards', () => {
      const idx = read('src/index.css');
      expect(idx).not.toMatch(/\.product-detail-layer \.flex\.flex-col\.sm\\:flex-row > div:first-child > div\.flex/);
      expect(idx).toMatch(/\.product-detail-layer > \.flex\.flex-col\.sm\\:flex-row > div:first-child > div\.flex/);
    });
  });
});
