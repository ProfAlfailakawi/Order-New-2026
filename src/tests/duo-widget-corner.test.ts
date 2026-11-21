import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ركن ودجت iPhone Duo على Duo وحده. استعلامات الركن في src/duo.css بحجم النافذة وحده، فتطابق نافذة الحاسوب الضيقة
// (640–720 طولاً، مثل 700×900) وiPhone SE في Safari ونوافذ الأجهزة اللوحية الضيقة. خارج Duo يجب ألا يُحجز شيء.
const css = fs.readFileSync(path.join(process.cwd(), 'src/duo.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

describe('iPhone Duo widget corner reaches the Duo only', () => {
  it('resets the corner to 0 off the Duo (html:not([data-device="duo"]) beats :root)', () => {
    const reset = rules.filter((r) => r.sel === "html:not([data-device='duo'])");
    expect(reset, 'the reset is missing: the 116px corner would return on narrow desktop windows and iPhone SE').toHaveLength(1);
    expect(reset[0].body).toMatch(/--duo-cutout-w:\s*0px;/);
    expect(reset[0].body).toMatch(/--duo-cutout-h:\s*0px;/);
  });

  it('scopes every keep-out rule of the corner block to html[data-device="duo"] with no added specificity', () => {
    const at = css.indexOf('--duo-cutout-w: 116px');
    const block = css.slice(at, css.indexOf("html:not([data-device='duo'])", at));
    const sels = [...block.matchAll(/(?:^|[;{}])\s*([^;{}@]+?)\s*\{/g)].map((m) => m[1].trim()).filter(Boolean);
    expect(sels.length).toBeGreaterThanOrEqual(10);
    for (const sel of sels) for (const part of sel.split(/,(?![^(]*\))/)) expect(part.trim(), part).toMatch(/^html:where\(\[data-device='duo'\]\) body /);
  });

  it('keeps a non-zero corner only on :root (inside the size query) or under [data-device="duo"], never !important', () => {
    for (const r of rules) {
      for (const d of r.body.matchAll(/--duo-cutout-[wh]\s*:\s*([^;]+)/g)) {
        expect(d[1]).not.toMatch(/!important/);
        if (d[1].trim() === '0px') continue;
        expect(r.sel === ':root' || (/\[data-device=['"]duo['"]\]/.test(r.sel) && !/:not\(/.test(r.sel)), `${d[0]} via ${r.sel}`).toBe(true);
      }
    }
  });

  it('marks the Duo before the first render (main.tsx)', () => {
    const main = fs.readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf8');
    expect(main).toMatch(/dataset\.device = duo \? 'duo' : 'other'/);
    expect(main).toMatch(/iPhone\|iPod/);
    expect(main).toMatch(/shortScreen <= 720/);
  });
});
