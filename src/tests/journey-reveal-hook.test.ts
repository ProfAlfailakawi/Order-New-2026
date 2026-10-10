// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useJourneyReveal, resetJourneyPlayed, JOURNEY_FAILSAFE_MS } from '../components/dna/useJourneyReveal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Props = { target: number; hold?: boolean; playKey?: string; enabled?: boolean };
let seen: Array<number | null> = [];

function Harness({ target, hold, playKey, enabled }: Props) {
  const { ref, lit } = useJourneyReveal<HTMLOListElement>({ target, count: 4, stepMs: 400, hold, playKey, enabled });
  seen.push(lit);
  return React.createElement('ol', { ref, 'data-lit': String(lit) });
}

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
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

let host: HTMLDivElement;
let root: Root;
const litNow = () => host.querySelector('ol')!.getAttribute('data-lit');
const render = (props: Props, strict = false) => {
  const el = React.createElement(Harness, props);
  act(() => root.render(strict ? React.createElement(React.StrictMode, null, el) : el));
};

function setReducedMotion(on: boolean) {
  (window as any).matchMedia = (q: string) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeIO.all = [];
  seen = [];
  (globalThis as any).IntersectionObserver = FakeIO;
  (window as any).IntersectionObserver = FakeIO;
  setReducedMotion(false);
  resetJourneyPlayed();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('useJourneyReveal hook', () => {
  it('reduced motion: never arms, renders the final state at once', () => {
    setReducedMotion(true);
    render({ target: 3, playKey: 'rm' });
    expect(litNow()).toBe('null');
    expect(seen.every((x) => x === null)).toBe(true);
    expect(FakeIO.all.length).toBe(0);
  });

  it('armed: starts unlit, lights 1..target in order, then settles to null', async () => {
    render({ target: 3, playKey: 'a' });
    expect(litNow()).toBe('0');
    await fire();
    await advance(230);
    expect(litNow()).toBe('1');
    await advance(400);
    expect(litNow()).toBe('2');
    await advance(400);
    expect(litNow()).toBe('3');
    await advance(900);
    expect(litNow()).toBe('null');
    expect(Math.max(...seen.filter((x): x is number => x !== null))).toBe(3); // never past the target
  });

  it('plays once per playKey: a remount of the same entity shows the final state', async () => {
    render({ target: 2, playKey: 'order:1' });
    await fire();
    await advance(2000);
    expect(litNow()).toBe('null');
    act(() => root.unmount());
    root = createRoot(host);
    render({ target: 2, playKey: 'order:1' });
    expect(litNow()).toBe('null');
    expect(FakeIO.all.length).toBe(0);
    // another entity still plays
    act(() => root.unmount());
    root = createRoot(host);
    render({ target: 2, playKey: 'order:2' });
    expect(litNow()).toBe('0');
  });

  it('polled re-renders (same target, new props identity) do not replay or restart', async () => {
    render({ target: 2, playKey: 'p' });
    await fire();
    await advance(2000);
    expect(litNow()).toBe('null');
    for (let i = 0; i < 3; i++) render({ target: 2, playKey: 'p' });
    await advance(1000);
    expect(litNow()).toBe('null');
  });

  it('StrictMode: still starts once, finishes at null and marks the key played', async () => {
    render({ target: 2, playKey: 'strict' }, true);
    expect(litNow()).toBe('0');
    await fire();
    await advance(2500);
    expect(litNow()).toBe('null');
    act(() => root.unmount());
    root = createRoot(host);
    render({ target: 2, playKey: 'strict' }, true);
    expect(litNow()).toBe('null');
  });

  it('hold before start keeps the stations unlit, then plays when released', async () => {
    render({ target: 2, playKey: 'h1', hold: true });
    await fire();
    await advance(3000);
    expect(litNow()).toBe('0');
    render({ target: 2, playKey: 'h1', hold: false });
    await fire();
    await advance(2500);
    expect(litNow()).toBe('null');
  });

  it('hold toggled on mid-intro never freezes a half-lit row', async () => {
    render({ target: 3, playKey: 'h2' });
    await fire();
    await advance(230 + 400);
    expect(litNow()).toBe('2');
    render({ target: 3, playKey: 'h2', hold: true });
    await advance(3000);
    expect(litNow()).toBe('null');
    render({ target: 3, playKey: 'h2', hold: false });
    await advance(1000);
    expect(litNow()).toBe('null');
  });

  it('target growing mid-intro (live data) is still reached and settles', async () => {
    render({ target: 2, playKey: 'g' });
    await fire();
    await advance(230);
    render({ target: 4, playKey: 'g' });
    for (let i = 0; i < 40; i++) await advance(100);
    expect(litNow()).toBe('null');
    expect(Math.max(...seen.filter((x): x is number => x !== null))).toBe(4);
  });

  it('fail-safe: if the observer never fires the real state is shown', async () => {
    render({ target: 2, playKey: 'f' });
    expect(litNow()).toBe('0');
    await advance(JOURNEY_FAILSAFE_MS + 100);
    expect(litNow()).toBe('null');
  });

  it('disabled: no intro at all', () => {
    render({ target: 2, playKey: 'd', enabled: false });
    expect(litNow()).toBe('null');
  });
});
