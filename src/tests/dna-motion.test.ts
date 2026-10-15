// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DnaCountUp, DnaRing, DnaTimeline } from '../components/dna/DnaKit';
import { resetJourneyPlayed } from '../components/dna/useJourneyReveal';
import { dnaEase } from '../components/dna/useDnaPlay';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

class FakeIO {
  static all: FakeIO[] = [];
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    FakeIO.all.push(this);
  }
  observe() {}
  disconnect() {
    FakeIO.all = FakeIO.all.filter((x) => x !== this);
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}
const fire = () =>
  act(() => {
    FakeIO.all.slice().forEach((io) => io.cb([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], io as any));
  });

let host: HTMLDivElement;
let root: Root;
const setMotion = (reduce: boolean) => {
  (window as any).matchMedia = (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  resetJourneyPlayed();
  FakeIO.all = [];
  setMotion(false);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const render = (el: React.ReactElement) => act(() => root.render(el));
const text = () => host.textContent ?? '';

describe('DnaCountUp', () => {
  it('shows the final value immediately when IntersectionObserver is unavailable', () => {
    render(React.createElement(DnaCountUp, { value: 42, playKey: 'a' }));
    expect(text()).toBe('42');
  });
  it('shows the final value under reduced motion', () => {
    vi.stubGlobal('IntersectionObserver', FakeIO);
    setMotion(true);
    render(React.createElement(DnaCountUp, { value: 42, playKey: 'b' }));
    expect(text()).toBe('42');
  });
  it('starts at 0, ends on the formatted final value, exposes the final value to AT, and plays once per key', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIO);
    const el = () => React.createElement(DnaCountUp, { value: 12.5, playKey: 'c', format: (n: number) => n.toFixed(3) });
    render(el());
    expect(host.querySelector('[aria-hidden="true"]')?.textContent).toBe('0.000');
    expect(host.querySelector('.dna-cu-sr')?.textContent).toBe('12.500');
    fire();
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(text()).toBe('12.500');
    // remount with the same key: no replay
    act(() => root.unmount());
    root = createRoot(host);
    render(el());
    expect(text()).toBe('12.500');
    expect(FakeIO.all.length).toBe(0);
  });
  it('snaps later value changes after it has played', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIO);
    render(React.createElement(DnaCountUp, { value: 10, playKey: 'd' }));
    fire();
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    render(React.createElement(DnaCountUp, { value: 25, playKey: 'd' }));
    expect(text()).toBe('25');
  });
});

describe('DnaRing draw', () => {
  const ring = (extra: object = {}) => React.createElement(DnaRing, { value: 50, max: 100, size: 100, stroke: 8, draw: true, playKey: 'ring', ...extra });
  it('renders the final arc without IntersectionObserver', () => {
    render(ring());
    const c = host.querySelector('.dna-ringv')!;
    expect(c.getAttribute('stroke-dasharray')!.startsWith('0 ')).toBe(false);
    expect(host.querySelector('[data-draw]')).toBeNull();
  });
  it('starts collapsed, then draws to the value when it enters the viewport', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIO);
    render(ring({ segments: [20, 30] }));
    host.querySelectorAll('.dna-ringv').forEach((c) => expect(c.getAttribute('stroke-dasharray')!.startsWith('0 ')).toBe(true));
    fire();
    host.querySelectorAll('.dna-ringv').forEach((c) => expect(c.getAttribute('stroke-dasharray')!.startsWith('0 ')).toBe(false));
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(host.querySelector('[data-draw]')).toBeNull();
  });
});

describe('DnaTimeline', () => {
  const items = (keys: string[]) => keys.map((k) => ({ key: k, title: k }));
  it('highlights a row that arrives after first paint, never on first render', async () => {
    render(React.createElement(DnaTimeline, { items: items(['a', 'b']), highlightNew: true, playKey: 't' }));
    expect(host.querySelector('[data-new]')).toBeNull();
    render(React.createElement(DnaTimeline, { items: items(['c', 'a', 'b']), highlightNew: true, playKey: 't' }));
    const fresh = host.querySelectorAll('[data-new="true"]');
    expect(fresh.length).toBe(1);
    expect(fresh[0].textContent).toBe('c');
  });
});

describe('dnaEase', () => {
  it('is 0 at 0, 1 at 1 and monotonic', () => {
    expect(dnaEase(0)).toBe(0);
    expect(dnaEase(1)).toBe(1);
    let prev = 0;
    for (let t = 0.05; t < 1; t += 0.05) {
      const v = dnaEase(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
