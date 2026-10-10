import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasJourneyPlayed,
  markJourneyPlayed,
  resetJourneyPlayed,
  journeyStepMs,
  journeyTarget,
  journeyDisplayState,
} from '../components/dna/useJourneyReveal';

describe('journey reveal helpers', () => {
  beforeEach(() => resetJourneyPlayed());

  it('paces stations between 350ms and 750ms and caps the intro near 4s', () => {
    expect(journeyStepMs(2)).toBe(750);
    expect(journeyStepMs(6)).toBe(667);
    expect(journeyStepMs(40)).toBe(350);
    expect(journeyStepMs(0)).toBe(750);
  });

  it('target is the last really-lit station (done or current)', () => {
    expect(journeyTarget(['done', 'done', 'pending', 'pending'])).toBe(2);
    expect(journeyTarget(['done', 'current', 'pending'])).toBe(2);
    expect(journeyTarget(['done', 'returned'])).toBe(1);
    expect(journeyTarget(['pending'])).toBe(0);
  });

  it('never lights a station past the real state and settles to the real states', () => {
    const real = ['done', 'done', 'pending', 'pending'] as const;
    expect(real.map((s, i) => journeyDisplayState(s, i, 0))).toEqual(['pending', 'pending', 'pending', 'pending']);
    expect(real.map((s, i) => journeyDisplayState(s, i, 1))).toEqual(['done', 'pending', 'pending', 'pending']);
    expect(real.map((s, i) => journeyDisplayState(s, i, 2))).toEqual(['done', 'done', 'pending', 'pending']);
    expect(real.map((s, i) => journeyDisplayState(s, i, null))).toEqual([...real]);
  });

  it('shows a returned station as soon as the station before it is lit', () => {
    expect(journeyDisplayState('returned', 1, 0)).toBe('pending');
    expect(journeyDisplayState('returned', 1, 1)).toBe('returned');
  });

  it('plays once per playKey', () => {
    expect(hasJourneyPlayed('order:1')).toBe(false);
    markJourneyPlayed('order:1');
    expect(hasJourneyPlayed('order:1')).toBe(true);
    expect(hasJourneyPlayed('order:2')).toBe(false);
    expect(hasJourneyPlayed(undefined)).toBe(false);
  });
});

describe('journey change detection and entity switching', () => {
  beforeEach(() => resetJourneyPlayed());

  it('a badge-only change on a current step counts as a change (partial payment)', async () => {
    const { journeyChangedKey } = await import('../components/dna/useJourneyReveal');
    const prev = new Map([
      ['share', { state: 'done', badge: '' }],
      ['pay', { state: 'current', badge: '1/5' }],
      ['track', { state: 'pending', badge: '' }],
    ]);
    const same = [
      { key: 'share', state: 'done', badge: '' },
      { key: 'pay', state: 'current', badge: '1/5' },
      { key: 'track', state: 'pending', badge: '' },
    ];
    expect(journeyChangedKey(prev, same)).toBeNull();
    const paid = same.map((s) => (s.key === 'pay' ? { ...s, badge: '2/5' } : s));
    expect(journeyChangedKey(prev, paid)).toBe('pay');
  });

  it('only lit stations count and only the changed one is reported', async () => {
    const { journeyChangedKey } = await import('../components/dna/useJourneyReveal');
    const prev = new Map([
      ['a', { state: 'done', badge: '' }],
      ['b', { state: 'current', badge: '' }],
    ]);
    expect(journeyChangedKey(prev, [{ key: 'a', state: 'done', badge: '' }, { key: 'b', state: 'done', badge: '' }])).toBe('b');
    expect(journeyChangedKey(prev, [{ key: 'a', state: 'done', badge: '' }, { key: 'b', state: 'pending', badge: '' }])).toBeNull();
  });

  it('play-once memory is per key, so switching entity can still play the new one', () => {
    markJourneyPlayed('order:A');
    expect(hasJourneyPlayed('order:A')).toBe(true);
    expect(hasJourneyPlayed('order:B')).toBe(false);
  });
});

describe('journey reveal never hides the real state forever', () => {
  it('uses an attainable threshold for tall elements, with a floor', async () => {
    const { journeyEffectiveThreshold, JOURNEY_FAILSAFE_MS, JOURNEY_HOLD_FAILSAFE_MS } = await import('../components/dna/useJourneyReveal');
    expect(journeyEffectiveThreshold(0.5, 100, 800)).toBe(0.5);
    expect(journeyEffectiveThreshold(0.5, 1600, 800)).toBeCloseTo(0.45);
    expect(journeyEffectiveThreshold(0.5, 4000, 500)).toBeCloseTo(0.1125);
    expect(journeyEffectiveThreshold(0.5, 100000, 500)).toBe(0.05);
    expect(journeyEffectiveThreshold(0.5, 0, 800)).toBe(0.5);
    expect(JOURNEY_FAILSAFE_MS).toBeGreaterThan(0);
    expect(JOURNEY_HOLD_FAILSAFE_MS).toBeGreaterThanOrEqual(JOURNEY_FAILSAFE_MS);
  });
});

describe('journey arming on async data', () => {
  it('waits while nothing is lit and arms when a station becomes lit', async () => {
    const { journeyHasTarget, journeyTarget } = await import('../components/dna/useJourneyReveal');
    expect(journeyHasTarget(journeyTarget(['pending', 'pending']))).toBe(false);
    expect(journeyHasTarget(journeyTarget(['done', 'pending']))).toBe(true);
  });
});

describe('journey observer start rule', () => {
  it('does not start on a 1px intersection below the wanted ratio', async () => {
    const { journeyShouldStart } = await import('../components/dna/useJourneyReveal');
    expect(journeyShouldStart(true, 0.01, 0.5)).toBe(false);
    expect(journeyShouldStart(false, 1, 0.5)).toBe(false);
    expect(journeyShouldStart(true, 0.5, 0.5)).toBe(true);
    expect(journeyShouldStart(true, 0.12, 0.1125)).toBe(true);
  });
});
