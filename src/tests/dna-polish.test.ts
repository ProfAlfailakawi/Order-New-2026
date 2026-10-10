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
  it("keep:'last' keeps the most advanced current (tracking: preparing beats payment)", () => {
    expect(dnaSingleCurrent(mk('done', 'current', 'pending', 'current', 'pending'), 'last').map((s) => s.state)).toEqual(['done', 'pending', 'pending', 'current', 'pending']);
    expect(dnaSingleCurrent(mk('done', 'current', 'pending', 'current', 'current'), 'last').map((s) => s.state)).toEqual(['done', 'pending', 'pending', 'pending', 'current']);
    const one = mk('done', 'current', 'pending');
    expect(dnaSingleCurrent(one, 'last')).toBe(one);
  });
  it('returns the same array when there is nothing to fix and never touches other states', () => {
    const ok = mk('done', 'current', 'pending');
    expect(dnaSingleCurrent(ok)).toBe(ok);
    expect(dnaSingleCurrent(mk('returned', 'current', 'blocked')).map((s) => s.state)).toEqual(['returned', 'current', 'blocked']);
  });
  it('split with no people yet and a preparing order render exactly one aria-current', () => {
    // split: share + pay both current; /track: payment + preparing both current
    const cases: Array<[DnaStep[], 'first' | 'last']> = [[mk('current', 'current', 'pending'), 'first'], [mk('done', 'current', 'pending', 'current', 'pending'), 'last']];
    for (const [raw, keep] of cases) {
      act(() => root.render(React.createElement(DnaStepper, { steps: dnaSingleCurrent(raw, keep), ariaLabel: 't' } as any)));
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

import { trackPaymentDone } from '../utils/trackStepState';

describe('tracking stepper: preparing / on-the-way are past payment', () => {
  const base = { isPaid: false, isPreparing: false, isOnTheWay: false, isCancelled: false, isFailed: false };
  // mirrors the steps array in OrderPage (created, payment, paid, [preparing], [on-the-way], delivered)
  const build = (f: Partial<typeof base>) => {
    const x = { ...base, ...f };
    const payDone = trackPaymentDone(x);
    const steps: DnaStep[] = [
      { key: 'created', label: 'c', state: 'done' },
      { key: 'payment', label: 'p', state: payDone ? 'done' : x.isCancelled || x.isFailed ? 'returned' : 'current' },
      { key: 'paid', label: 'pd', state: payDone ? 'done' : 'pending' },
    ];
    if (x.isPreparing) steps.push({ key: 'preparing', label: 'pr', state: 'current' });
    if (x.isOnTheWay) steps.push({ key: 'otw', label: 'o', state: 'current' });
    steps.push({ key: 'delivered', label: 'd', state: 'pending' });
    return dnaSingleCurrent(steps, 'last');
  };
  const st = (s: DnaStep[]) => s.map((x) => x.state);

  it('preparing: done, done, done, current, pending (payment and paid read as done)', () => {
    expect(st(build({ isPreparing: true }))).toEqual(['done', 'done', 'done', 'current', 'pending']);
  });
  it('on the way (already paid): done, done, done, current, pending', () => {
    expect(st(build({ isPaid: true, isOnTheWay: true }))).toEqual(['done', 'done', 'done', 'current', 'pending']);
    expect(st(build({ isOnTheWay: true }))).toEqual(['done', 'done', 'done', 'current', 'pending']);
  });
  it('plain pending order unchanged: payment current', () => {
    expect(st(build({}))).toEqual(['done', 'current', 'pending', 'pending']);
  });
  it('cancelled / failed unchanged (payment returned, never forced to done)', () => {
    expect(trackPaymentDone({ ...base, isCancelled: true, isPreparing: true })).toBe(false);
    expect(trackPaymentDone({ ...base, isFailed: true, isOnTheWay: true })).toBe(false);
    expect(trackPaymentDone({ ...base, isCancelled: true, isPaid: true })).toBe(true);
    expect(st(build({ isCancelled: true }))).toEqual(['done', 'returned', 'pending', 'pending']);
  });
  it('exactly one aria-current in every case', () => {
    for (const f of [{ isPreparing: true }, { isOnTheWay: true }, { isPreparing: true, isOnTheWay: true }, {}]) {
      act(() => root.render(React.createElement(DnaStepper, { steps: build(f), ariaLabel: 't' } as any)));
      expect(host.querySelectorAll('[aria-current="step"]').length).toBe(1);
    }
  });
});
