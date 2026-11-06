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
    for (const f of ['src/App.tsx', 'src/pages/CustomerSite.tsx', 'src/pages/OrderPage.tsx', 'src/pages/SplitPayment.tsx', 'src/pages/AdminDashboard.tsx', 'src/components/RouletteSplit.tsx']) {
      const src = read(f);
      expect(src, f).not.toMatch(/\bmin-h-screen\b/);
      expect(src, f).not.toMatch(/\bh-screen\b/);
      expect(src, f).not.toMatch(/100vh/);
    }
  });

  it('keeps the welcome sheet scrollable on short windows', () => {
    const css = read('src/duo.css');
    expect(css).toMatch(/\.ord-bp-theatre\s*\{[^}]*overflow-y:\s*auto/);
  });
});
