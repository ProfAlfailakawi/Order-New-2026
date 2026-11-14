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
    const portraitInner = 'screen and (min-width: 640px) and (max-width: 720px) and (min-height: 520px) and (max-height: 960px) and (orientation: portrait)';
    const book = 'screen and (min-width: 721px) and (max-width: 1000px) and (min-height: 520px) and (max-height: 960px) and (orientation: landscape)';

    it('lays the inner screen out as two pages with a fold, only in landscape, from the window size only', () => {
      expect(css).toContain(book);
      expect(css).toMatch(/--duo-spine:\s*32px/);
      expect(css).toMatch(/html body::after\s*\{[^}]*pointer-events:\s*none/);
      // Portrait is a normal single column: the old portrait branch (640-720 wide, 760+ tall) is gone.
      expect(css).not.toMatch(/min-height:\s*760px\) and \(max-height:\s*1000px/);
      for (const m of css.matchAll(/^@media ([^{]+)\{/gm)) {
        for (const q of m[1].split(',')) {
          if (/orientation:\s*portrait/.test(q)) expect(q, q).toContain(portraitInner);
        }
      }
    });

    it('reserves the system widget corner (116px) on the Duo inner screen (tab and installed app)', () => {
      expect(css).toMatch(/:root\s*\{\s*--duo-cutout-w:\s*0px;\s*--duo-cutout-h:\s*0px;\s*\}/);
      const at = css.indexOf('--duo-cutout-w: 116px');
      expect(at).toBeGreaterThan(-1);
      const head = css.slice(css.lastIndexOf('@media', at), at);
      expect(head).toContain('screen and (min-width: 721px) and (max-width: 1000px) and (min-height: 520px) and (max-height: 960px) and (orientation: landscape)');
      expect(head).toContain('screen and (min-width: 640px) and (max-width: 720px) and (min-height: 520px) and (max-height: 960px) and (orientation: portrait)');
      expect(css).toMatch(/padding-right:\s*calc\(var\(--duo-cutout-w\)/);
      expect(css).toMatch(/\.dna-inbox \{ max-block-size: min\(460px, calc\(100dvh - var\(--duo-cutout-h\)/);
      expect(read('src/pages/CustomerSite.tsx')).toContain('duo-keepout-head');
    });

    it('evaluates the keep-out media queries at real sizes (no display-mode anywhere in them)', () => {
      const at = css.indexOf('--duo-cutout-w: 116px');
      const head = css.slice(css.lastIndexOf('@media', at), at);
      expect(head).not.toMatch(/display-mode/);
      const queries = head.replace(/^@media/, '').replace(/\{[^]*$/, '').split(',').map((q) => q.trim());
      expect(queries).toHaveLength(2);
      const matches = (q: string, w: number, h: number) => {
        const orient = w > h ? 'landscape' : 'portrait';
        return [...q.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)|\(orientation:\s*(\w+)\)/g)].every((m) => {
          if (m[4]) return m[4] === orient;
          const v = m[2] === 'width' ? w : h;
          return m[1] === 'min' ? v >= Number(m[3]) : v <= Number(m[3]);
        });
      };
      const hit = (w: number, h: number) => queries.some((q) => matches(q, w, h));
      for (const [w, h] of [[951, 669], [951, 585], [669, 867], [720, 900], [640, 900], [1000, 520]]) expect(hit(w, h), `${w}x${h}`).toBe(true);
      const off: [number, number][] = [[390, 844], [844, 390], [932, 430], [744, 1024], [820, 1180], [1024, 768], [1180, 820], [1280, 800], [1440, 900], [367, 740], [951, 350], [768, 1024]];
      for (const [w, h] of off) expect(hit(w, h), `${w}x${h}`).toBe(false);
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

    it('keeps every Duo posture query off iPads: screen only, width-capped (Duo is not an iPad)', () => {
      // iPad portrait is 744px wide or more, iPad landscape 1024px or more; the Duo inner screen is
      // ~669x867 portrait and ~951x585 landscape. Width plus orientation are the only safe signals.
      const from = css.indexOf('@media screen and (min-width: 721px)');
      expect(from).toBeGreaterThan(-1);
      const queries = [...css.slice(from).matchAll(/^@media ([^{]+)\{/gm)].flatMap((m) =>
        m[1].split(',').map((q) => q.trim()),
      );
      expect(queries.length).toBeGreaterThanOrEqual(6);
      const px = (q: string, prop: string) => {
        const m = q.match(new RegExp('\\(' + prop + ':\\s*(\\d+)px\\)'));
        return m ? Number(m[1]) : null;
      };
      for (const q of queries) {
        if (/prefers-reduced-motion/.test(q)) continue;
        expect(q, q).toMatch(/^screen and /);
        const minW = px(q, 'min-width');
        const maxW = px(q, 'max-width');
        const maxH = px(q, 'max-height');
        if (maxW !== null) expect(maxW, q).toBeLessThanOrEqual(/orientation:\s*portrait/.test(q) ? 720 : 1000);
        // Anything from the iPad portrait width up must be capped below iPad landscape and be landscape-only.
        if (minW !== null && minW >= 744) expect(maxW, q).not.toBeNull();
        if (minW !== null && minW >= 721 && maxW !== null && maxW > 767) expect(q, q).toMatch(/orientation:\s*landscape/);
        if (maxW === null) expect(maxH ?? Infinity, q).toBeLessThanOrEqual(520);
      }
    });

    it('scopes the short-window product rules to the sheet header, not the add-on cards', () => {
      const idx = read('src/index.css');
      expect(idx).not.toMatch(/\.product-detail-layer \.flex\.flex-col\.sm\\:flex-row > div:first-child > div\.flex/);
      expect(idx).toMatch(/\.product-detail-layer > \.flex\.flex-col\.sm\\:flex-row > div:first-child > div\.flex/);
    });
  });
  describe('folded outer screen 320-382px (2026-11-14)', () => {
    it('hides the floating alerts bell while the product sheet or checkout is open', () => {
      const src = read('src/pages/CustomerSite.tsx');
      expect(src).toMatch(/if \(isCheckout \|\| selectedProduct\) return null;/);
    });

    it('gives the invoice region tile its own row below 360px instead of breaking the word', () => {
      const css = read('src/index.css');
      expect(css).toMatch(/@media \(max-width: 359px\)\s*\{[^}]*\.invoice-reveal-stats \{ grid-template-columns: repeat\(2/);
    });

    it('keeps add-on pills and radar rows wrapping instead of squeezing', () => {
      expect(read('src/pages/OrderPage.tsx')).toMatch(/flex flex-wrap items-center gap-x-2 gap-y-0\.5[^"]*w-fit max-w-full/);
      expect(read('src/components/SquadModalContent.tsx')).toMatch(/max-\[359px\]:grid-cols-\[minmax\(0,1fr\)\]/);
    });
  });
});
