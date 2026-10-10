// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DnaStepper, type DnaStep } from '../components/dna/DnaKit';
import { resetJourneyPlayed } from '../components/dna/useJourneyReveal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mk = (...states: DnaStep['state'][]): DnaStep[] => states.map((state, i) => ({ key: `s${i}`, label: `S${i}`, state }));
let host: HTMLDivElement;
let root: Root;
const render = (steps: DnaStep[], extra: Record<string, unknown> = {}) =>
  act(() => root.render(React.createElement(DnaStepper, { steps, reveal: true, intro: false, ariaLabel: 't', ...extra } as any)));
const items = () => Array.from(host.querySelectorAll('li'));
const justKeys = () => items().map((li, i) => (li.hasAttribute('data-just') ? i : -1)).filter((i) => i >= 0);

beforeEach(() => {
  vi.useFakeTimers();
  resetJourneyPlayed();
  (window as any).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('DnaStepper journey mode (halo and state truth)', () => {
  it('a plain mount shows real states and no one-shot halo marker', () => {
    render(mk('done', 'current', 'pending'));
    expect(items().map((li) => li.getAttribute('data-state'))).toEqual(['done', 'current', 'pending']);
    expect(justKeys()).toEqual([]);
    expect(host.querySelector('ol')!.getAttribute('data-reveal')).toBe('done');
  });

  it('a forward change marks only the step that changed', () => {
    render(mk('done', 'current', 'pending'));
    render(mk('done', 'done', 'current'));
    expect(justKeys()).toEqual([2]);
  });

  it('polled re-renders with identical steps add no marker', () => {
    render(mk('done', 'current', 'pending'));
    render(mk('done', 'current', 'pending'));
    render(mk('done', 'current', 'pending'));
    expect(justKeys()).toEqual([]);
  });

  it('going back snaps: no marker and no halo on the step that became current again', () => {
    render(mk('done', 'done', 'current'));
    render(mk('done', 'done', 'current'));
    render(mk('done', 'current', 'pending'));
    expect(justKeys()).toEqual([]);
    expect(host.querySelector('ol')!.getAttribute('data-snap')).toBeNull();
    expect(items().map((li) => li.getAttribute('data-state'))).toEqual(['done', 'current', 'pending']);
  });

  it('aria-current and sr text come from the real state', () => {
    render(mk('done', 'current', 'pending'));
    expect(items().map((li) => li.getAttribute('aria-current'))).toEqual([null, 'step', null]);
  });

  it('non-reveal steppers are untouched (no journey attributes)', () => {
    act(() => root.render(React.createElement(DnaStepper, { steps: mk('done', 'current'), ariaLabel: 't' } as any)));
    const ol = host.querySelector('ol')!;
    expect(ol.hasAttribute('data-journey')).toBe(false);
    expect(items().every((li) => !li.hasAttribute('data-just') && !li.hasAttribute('data-lit'))).toBe(true);
  });
});
