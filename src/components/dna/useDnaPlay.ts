import { useEffect, useRef, useState, type RefObject } from 'react';
import { canArm, markJourneyPlayed } from './useJourneyReveal';

/* One-shot draw/count-up machinery for the DNA kit. It reuses the journey reveal's play-once
   session store (hasJourneyPlayed / markJourneyPlayed) and its reduced-motion + IntersectionObserver
   checks, so the final state is what renders whenever the intro cannot or should not play. */

export type DnaPlayPhase = 'pre' | 'play' | 'final';

export const DNA_PLAY_FAILSAFE_MS = 6000;

const fullKey = (playKey?: string) => (playKey ? `dna-play:${playKey}` : undefined);

export interface DnaPlayOptions {
  /** Remember (per tab session) that this key already played. Without a key it plays once per mount. */
  playKey?: string;
  enabled?: boolean;
  threshold?: number;
  /** How long the 'play' phase lasts before settling to 'final' (ms). */
  settleMs?: number;
}

/** pre = collapsed start state, play = transitioning to the value, final = at rest (also SSR/tests/reduced motion). */
export function useDnaPlay<T extends Element = HTMLElement>({
  playKey,
  enabled = true,
  threshold = 0.4,
  settleMs = 1200,
}: DnaPlayOptions = {}): { ref: RefObject<T | null>; phase: DnaPlayPhase } {
  const ref = useRef<T | null>(null);
  const key = fullKey(playKey);
  const [seenKey, setSeenKey] = useState(key);
  const [phase, setPhase] = useState<DnaPlayPhase>(() => (canArm(enabled, key) ? 'pre' : 'final'));
  if (seenKey !== key) {
    setSeenKey(key);
    setPhase(canArm(enabled, key) ? 'pre' : 'final');
  }
  useEffect(() => {
    if (phase !== 'pre') return;
    const el = ref.current;
    const fail = setTimeout(() => setPhase('final'), DNA_PLAY_FAILSAFE_MS);
    const start = () => {
      clearTimeout(fail);
      markJourneyPlayed(key);
      setPhase('play');
    };
    if (!el) {
      setPhase('final');
      return () => clearTimeout(fail);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= Math.min(threshold, 0.4) - 0.01)) {
          io.disconnect();
          start();
        }
      },
      { threshold: Math.min(threshold, 0.4) },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(fail);
    };
  }, [phase, key, threshold]);
  // the settle timer lives in its own effect so 'play' always finishes
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setTimeout(() => setPhase('final'), settleMs);
    return () => clearTimeout(id);
  }, [phase, settleMs]);
  return { ref, phase };
}

const BEZIER = [0.22, 0.78, 0.24, 1] as const;
/** The kit's --dna-ease curve (cubic-bezier(0.22, 0.78, 0.24, 1)) as a JS easing function. */
export function dnaEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const [x1, y1, x2, y2] = BEZIER;
  const bx = (u: number) => 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
  const by = (u: number) => 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (bx(mid) < t) lo = mid;
    else hi = mid;
  }
  return by((lo + hi) / 2);
}

export interface DnaCountUpOptions {
  playKey?: string;
  enabled?: boolean;
  durationMs?: number;
  threshold?: number;
  /** After the first play, tween between later values (e.g. a balance counting down) instead of snapping. */
  tweenChanges?: boolean;
}

/** Number that counts 0 -> value once per playKey when it first enters the viewport; the final value
    is returned whenever motion is unavailable, already played, or after it has played (later changes snap). */
export function useCountUp<T extends Element = HTMLElement>(
  value: number,
  { playKey, enabled = true, durationMs = 700, threshold = 0.4, tweenChanges = false }: DnaCountUpOptions = {},
): { ref: RefObject<T | null>; shown: number; animating: boolean } {
  const { ref, phase } = useDnaPlay<T>({ playKey, enabled, threshold, settleMs: durationMs + 200 });
  const [shown, setShown] = useState<number | null>(null);
  // true once the intro tween has reached its end; until then the 'play' phase must never show the final value
  const [introDone, setIntroDone] = useState(false);
  const target = useRef(value);
  target.current = value;
  const lastValue = useRef(value);
  // a new play key is a new intro: the 'play' phase must not show the final value for its first frame
  useEffect(() => { setIntroDone(false); }, [playKey]);

  useEffect(() => {
    if (phase !== 'play') return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / durationMs);
      setShown(target.current * dnaEase(k));
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        setShown(null);
        setIntroDone(true);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, durationMs]);

  // later value changes: snap, or tween when asked (only a decrease/increase after the intro has settled)
  useEffect(() => {
    const prev = lastValue.current;
    lastValue.current = value;
    if (!tweenChanges || phase !== 'final' || prev === value) return;
    if (typeof window === 'undefined' || !canArm(true, undefined)) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / durationMs);
      setShown(prev + (target.current - prev) * dnaEase(k));
      if (k < 1) raf = requestAnimationFrame(step);
      else setShown(null);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setShown(null);
    };
  }, [value, tweenChanges, phase, durationMs]);

  if (phase === 'pre') return { ref, shown: 0, animating: true };
  // first 'play' render happens before the first animation frame: keep showing the start value, not the final one
  if (phase === 'play' && shown === null && !introDone) return { ref, shown: 0, animating: true };
  if (shown === null) return { ref, shown: value, animating: false };
  return { ref, shown, animating: true };
}

/** Bumps a counter whenever `signal` changes after the first render (never on mount). Use it as
    data-flash={n % 2} on an element carrying the .dna-flash class for a one-shot soft highlight. */
export function useChangeFlash(signal: unknown, ready = true): number | undefined {
  const prev = useRef(signal);
  const [n, setN] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (Object.is(prev.current, signal)) return;
    prev.current = signal;
    if (!ready || typeof window === 'undefined' || !canArm(true, undefined)) return;
    setN((c) => (c ?? 0) + 1);
  }, [signal, ready]);
  return n === undefined ? undefined : n % 2;
}
