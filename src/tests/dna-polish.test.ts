// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { DnaRing, DnaStepper, dnaSingleCurrent, type DnaStep } from '../components/dna/DnaKit';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (window as any).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mk = (...states: DnaStep['state'][]): DnaStep[] => states.map((state, i) => ({ key: `s${i}`, label: `S${i}`, state }));

describe('dnaSingleCurrent (one active station per journey)', () => {
  it('keeps the first current and shows later ones as pending', () => {
    expect(dnaSingleCurrent(mk('current', 'current', 'pending')).map((s) => s.state)).toEqual(['current', 'pending', 'pending']);
    expect(dnaSingleCurrent(mk('done', 'current', 'pending', 'current', 'pending')).map((s) => s.state)).toEqual(['done', 'current', 'pending', 'pending', 'pending']);
  });
  it('returns the same array when there is nothing to fix and never touches other states', () => {
    const ok = mk('done', 'current', 'pending');
    expect(dnaSingleCurrent(ok)).toBe(ok);
    expect(dnaSingleCurrent(mk('returned', 'current', 'blocked')).map((s) => s.state)).toEqual(['returned', 'current', 'blocked']);
  });
  it('split with no people yet and a preparing order render exactly one aria-current', () => {
    // split: share + pay both current; /track: payment + preparing both current
    for (const raw of [mk('current', 'current', 'pending'), mk('done', 'current', 'pending', 'current', 'pending')]) {
      act(() => root.render(React.createElement(DnaStepper, { steps: dnaSingleCurrent(raw), ariaLabel: 't' } as any)));
      expect(host.querySelectorAll('[aria-current="step"]').length).toBe(1);
      expect(host.querySelectorAll('li[data-state="current"]').length).toBe(1);
    }
  });
});

describe('DnaRing decrease', () => {
  const ring = (value: number) => act(() => root.render(React.createElement(DnaRing, { value, max: 100, ariaLabel: 'r' } as any)));
  const snap = () => host.querySelector('.dna-ring')!.getAttribute('data-snap');
  it('snaps (no stroke animation) when the value goes down, animates again on the next increase', () => {
    ring(40);
    expect(snap()).toBeNull();
    ring(70);
    expect(snap()).toBeNull();
    ring(30);
    expect(snap()).toBe('true');
    ring(60);
    expect(snap()).toBeNull();
  });
});

describe('spring keyframes (motion allows only two keyframes with a spring)', () => {
  it('SplitPayment has no spring transition on an animate prop with a keyframe array', () => {
    const src = readFileSync(process.cwd() + '/src/pages/SplitPayment.tsx', 'utf8');
    const re = /animate=\{\{([^}]*)\}\}\s*transition=\{\{([^}]*)\}\}/g;
    let m: RegExpExecArray | null;
    const bad: string[] = [];
    while ((m = re.exec(src))) if (/\[/.test(m[1]) && /type:\s*["']spring["']/.test(m[2])) bad.push(m[0]);
    expect(bad).toEqual([]);
  });
});
