import { useEffect, useRef, useState, type RefObject } from 'react';

/* Journey reveal: a one-shot, scroll-triggered intro for DnaStepper.
   The real step states are always the truth; this hook only decides how many of the
   already-lit stations are shown so far while the intro plays. */

const SESSION_KEY = 'dna-journey-played';
const played = new Set<string>();

function readSession(): string[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function hasJourneyPlayed(playKey?: string): boolean {
  if (!playKey) return false;
  if (played.has(playKey)) return true;
  if (typeof window !== 'undefined' && readSession().includes(playKey)) {
    played.add(playKey);
    return true;
  }
  return false;
}

export function markJourneyPlayed(playKey?: string): void {
  if (!playKey) return;
  played.add(playKey);
  try {
    const list = readSession();
    if (!list.includes(playKey)) {
      // Keep the list short: only recent entities matter.
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify([...list, playKey].slice(-60)));
    }
  } catch {
    /* storage unavailable: the module-level Set still guards this page load */
  }
}

/** Test helper: forget every remembered playKey. */
export function resetJourneyPlayed(): void {
  played.clear();
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** ~0.55-0.75s per station on short rows, capped so the whole intro stays near 4s. */
export function journeyStepMs(count: number): number {
  const n = Math.max(1, count);
  return Math.min(750, Math.max(350, Math.round(4000 / n)));
}

/** Index+1 of the last station that is really lit (done or current). */
export function journeyTarget(states: ReadonlyArray<string>): number {
  let target = 0;
  states.forEach((s, i) => {
    if (s === 'done' || s === 'current') target = i + 1;
  });
  return target;
}

/** The intro can only start once at least one station is really lit. */
export function journeyHasTarget(target: number): boolean {
  return target > 0;
}

/** State shown at index i while the intro has revealed `lit` stations (null = settled). */
export function journeyDisplayState<T extends string>(state: T, i: number, lit: number | null): T | 'pending' {
  if (lit === null) return state;
  if (i < lit) return state;
  // A returned/blocked station shows as soon as the station before it is lit.
  if ((state === 'returned' || state === 'blocked') && i <= lit) return state;
  return 'pending';
}

export interface JourneySnap {
  state: string;
  badge: string;
}

/** Key of the last lit station whose state or badge differs from the previous snapshot (null = no change). */
export function journeyChangedKey(
  prev: ReadonlyMap<string, JourneySnap>,
  next: ReadonlyArray<{ key: string; state: string; badge: string }>,
): string | null {
  let changed: string | null = null;
  for (const s of next) {
    if (s.state !== 'done' && s.state !== 'current') continue;
    const before = prev.get(s.key);
    if (before?.state !== s.state || before?.badge !== s.badge) changed = s.key;
  }
  return changed;
}

/** Threshold that the element can actually reach: a stepper taller than ~the viewport never hits 0.5. */
export function journeyEffectiveThreshold(threshold: number, elementHeight: number, viewportHeight: number): number {
  if (!(elementHeight > 0) || !(viewportHeight > 0)) return threshold;
  return Math.max(0.05, Math.min(threshold, (0.9 * viewportHeight) / elementHeight));
}

/** isIntersecting is true with 1px visible; require the (attainable) ratio before starting. */
export function journeyShouldStart(isIntersecting: boolean, ratio: number, wanted: number): boolean {
  return isIntersecting && ratio >= wanted - 0.01;
}

/** Longest the real state may stay hidden waiting to start (ms): never hide the truth indefinitely. */
export const JOURNEY_FAILSAFE_MS = 8000;
export const JOURNEY_HOLD_FAILSAFE_MS = 15000;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

function canArm(enabled: boolean, playKey?: string): boolean {
  if (!enabled || typeof window === 'undefined') return false;
  if (typeof IntersectionObserver === 'undefined') return false;
  if (prefersReducedMotion()) return false;
  return !hasJourneyPlayed(playKey);
}

export interface JourneyRevealOptions {
  /** Number of steps that are really lit (see journeyTarget). */
  target: number;
  /** Total step count (used for pacing). */
  count: number;
  stepMs?: number;
  threshold?: number;
  enabled?: boolean;
  /** While true the intro waits (stations stay unlit) - e.g. until another animation is done. */
  hold?: boolean;
  /** Remember (per tab session) that this entity already played its intro. */
  playKey?: string;
}

export interface JourneyReveal<T extends HTMLElement> {
  ref: RefObject<T | null>;
  /** Stations revealed so far; null = settled, render the real states. */
  lit: number | null;
  /** Index of the station that just lit during an animated intro (kept after it settles). */
  just: number | null;
}

export function useJourneyReveal<T extends HTMLElement = HTMLOListElement>({
  target,
  count,
  stepMs,
  threshold = 0.5,
  enabled = true,
  hold = false,
  playKey,
}: JourneyRevealOptions): JourneyReveal<T> {
  const ref = useRef<T | null>(null);
  const [armed, setArmed] = useState(() => canArm(enabled, playKey));
  const [lit, setLit] = useState<number | null>(armed ? 0 : null);
  const [just, setJust] = useState<number | null>(null);
  const [seenKey, setSeenKey] = useState(playKey);
  const litRef = useRef(0);
  // A mounted stepper can switch entity: re-derive the intro for the new playKey instead of
  // inheriting the previous entity's armed/lit state (play-once-per-key still applies).
  if (seenKey !== playKey) {
    const nextArmed = canArm(enabled, playKey);
    setSeenKey(playKey);
    setArmed(nextArmed);
    setLit(nextArmed ? 0 : null);
    setJust(null);
    litRef.current = 0;
  }
  const targetRef = useRef(target);
  targetRef.current = target;
  const msRef = useRef(stepMs ?? journeyStepMs(count));
  msRef.current = stepMs ?? journeyStepMs(count);

  // Fail-safe: if the intro never starts (observer never fires, hold never released), show the real state.
  const startedRef = useRef(false);
  const settledRef = useRef(false);
  useEffect(() => {
    startedRef.current = false;
    settledRef.current = false;
  }, [playKey]);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(
      () => {
        if (!startedRef.current) {
          startedRef.current = true;
          settledRef.current = true;
          setLit(null);
        }
      },
      hold ? JOURNEY_HOLD_FAILSAFE_MS : JOURNEY_FAILSAFE_MS,
    );
    return () => clearTimeout(id);
  }, [armed, hold, playKey]);

  const hasTarget = journeyHasTarget(target);
  useEffect(() => {
    // `hold` only delays the START of an intro; one that already began finishes (never freezes half-lit).
    if (!armed || (hold && !startedRef.current)) return;
    // Nothing is really lit yet (e.g. data still loading): wait, and arm when a station becomes lit.
    if (!hasTarget) {
      if (startedRef.current) {
        settledRef.current = true;
        setLit(null);
      }
      return;
    }
    // An intro that already ran for this key never restarts. One that is still running (its timers were
    // cancelled by a dependency change) resumes from where it was, so lit always ends at null.
    if (startedRef.current && settledRef.current) return;
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const tick = (shown: number) => {
      if (cancelled) return;
      const goal = targetRef.current;
      if (shown >= goal) {
        // Let the last station finish its transition, then hand over to the real states.
        timer = setTimeout(() => {
          if (cancelled) return;
          settledRef.current = true;
          setLit(null);
        }, msRef.current);
        return;
      }
      const next = shown + 1;
      litRef.current = next;
      setLit(next);
      setJust(next - 1);
      timer = setTimeout(() => tick(next), msRef.current);
    };

    const start = () => {
      startedRef.current = true;
      markJourneyPlayed(playKey);
      timer = setTimeout(() => tick(litRef.current), 220);
    };

    if (startedRef.current) {
      timer = setTimeout(() => tick(litRef.current), msRef.current);
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    const wanted = journeyEffectiveThreshold(threshold, el.getBoundingClientRect().height, window.innerHeight);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => journeyShouldStart(e.isIntersecting, e.intersectionRatio, wanted))) {
          io.disconnect();
          start();
        }
      },
      { threshold: wanted },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [armed, hold, playKey, threshold, hasTarget]);

  return { ref, lit, just };
}
