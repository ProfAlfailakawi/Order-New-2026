import { describe, expect, it } from 'vitest';
import {
  checkStoreStatus,
  formatOpeningHoursSummary,
  formatTime12h,
  getConfiguredStoreStatus,
} from '../lib/storeAvailability';

// Kuwait is UTC+3 all year (no DST). 2026-11-05 is a Thursday.
const kuwait = (iso: string) => new Date(`${iso}+03:00`);

const week = (open: string, close: string, over: Record<string, unknown> = {}) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return Object.fromEntries(days.map((d) => [d, over[d] ?? { enabled: true, open, close }]));
};

describe('formatTime12h', () => {
  it('formats morning, noon, midnight and evening in Arabic', () => {
    expect(formatTime12h('09:05')).toBe('9:05 ص');
    expect(formatTime12h('12:00')).toBe('12:00 م');
    expect(formatTime12h('00:30')).toBe('12:30 ص');
    expect(formatTime12h('23:30')).toBe('11:30 م');
  });

  it('returns unusable input unchanged', () => {
    expect(formatTime12h(undefined)).toBe('');
    expect(formatTime12h('soon')).toBe('soon');
    expect(formatTime12h('xx:30')).toBe('xx:30');
  });
});

describe('checkStoreStatus', () => {
  it('treats a missing status as open', () => {
    expect(checkStoreStatus(null, kuwait('2026-11-05T12:00:00')).isOpen).toBe(true);
  });

  it('honours a manual close and its custom message', () => {
    const r = checkStoreStatus({ manualClose: true, closeMessage: 'إجازة' }, kuwait('2026-11-05T12:00:00'));
    expect(r.isOpen).toBe(false);
    expect(r.message).toBe('إجازة');
  });

  it('is open with no schedule configured', () => {
    expect(checkStoreStatus({}, kuwait('2026-11-05T03:00:00')).isOpen).toBe(true);
  });

  it('opens at the opening minute and closes at the closing minute', () => {
    const status = { openingHours: week('12:00', '23:00') };
    expect(checkStoreStatus(status, kuwait('2026-11-05T11:59:00')).isOpen).toBe(false);
    expect(checkStoreStatus(status, kuwait('2026-11-05T12:00:00')).isOpen).toBe(true);
    expect(checkStoreStatus(status, kuwait('2026-11-05T22:59:00')).isOpen).toBe(true);
    expect(checkStoreStatus(status, kuwait('2026-11-05T23:00:00')).isOpen).toBe(false);
  });

  it('keeps an overnight shift open past midnight, using the previous day', () => {
    const status = { openingHours: week('18:00', '02:00') };
    expect(checkStoreStatus(status, kuwait('2026-11-05T20:00:00')).isOpen).toBe(true);
    expect(checkStoreStatus(status, kuwait('2026-11-06T01:00:00')).isOpen).toBe(true);
    expect(checkStoreStatus(status, kuwait('2026-11-06T03:00:00')).isOpen).toBe(false);
  });

  it('does not carry an overnight shift over from a disabled previous day', () => {
    const status = {
      openingHours: week('18:00', '02:00', { thursday: { enabled: false, open: '18:00', close: '02:00' } }),
    };
    // Friday 01:00 — Thursday is disabled, so nothing carries over.
    expect(checkStoreStatus(status, kuwait('2026-11-06T01:00:00')).isOpen).toBe(false);
  });

  it('treats equal open and close times as open all day', () => {
    expect(checkStoreStatus({ openingHours: week('00:00', '00:00') }, kuwait('2026-11-05T04:00:00')).isOpen).toBe(true);
  });

  it('reports a disabled day as closed today with the weekday name', () => {
    const status = { openingHours: week('12:00', '23:00', { thursday: { enabled: false } }) };
    const r = checkStoreStatus(status, kuwait('2026-11-05T15:00:00'));
    expect(r.isOpen).toBe(false);
    expect(r.message).toContain('الخميس');
    expect(r.todayText).toBe('مغلق اليوم');
  });

  it('uses a custom close message outside working hours', () => {
    const r = checkStoreStatus({ openingHours: week('12:00', '23:00'), closeMessage: 'نعود غداً' }, kuwait('2026-11-05T05:00:00'));
    expect(r).toMatchObject({ isOpen: false, message: 'نعود غداً' });
  });

  it('also reads the legacy workingHours and hours keys', () => {
    expect(checkStoreStatus({ workingHours: week('12:00', '23:00') }, kuwait('2026-11-05T05:00:00')).isOpen).toBe(false);
    expect(checkStoreStatus({ hours: week('12:00', '23:00') }, kuwait('2026-11-05T15:00:00')).isOpen).toBe(true);
  });

  it('reads the clock in Kuwait time, not UTC', () => {
    // 21:30 UTC on Nov 4 is already 00:30 on Thursday Nov 5 in Kuwait.
    const r = checkStoreStatus({ openingHours: week('12:00', '23:00') }, new Date('2026-11-04T21:30:00Z'));
    expect(r.currentDayKey).toBe('thursday');
    expect(r.isOpen).toBe(false);
  });
});

describe('formatOpeningHoursSummary', () => {
  it('falls back to the default daily hours without a schedule', () => {
    const r = formatOpeningHoursSummary({}, kuwait('2026-11-05T12:00:00'));
    expect(r.summaryText).toContain('يومياً');
    expect(r.weeklyList).toHaveLength(7);
    expect(r.weeklyList.find((d) => d.isToday)?.dayKey).toBe('thursday');
  });

  it('summarises identical days as daily and lists a disabled day as closed', () => {
    const daily = formatOpeningHoursSummary({ openingHours: week('12:00', '23:00') }, kuwait('2026-11-05T12:00:00'));
    expect(daily.summaryText).toBe('أوقات العمل: يومياً من 12:00 م إلى 11:00 م');
    const mixed = formatOpeningHoursSummary(
      { openingHours: week('12:00', '23:00', { friday: { enabled: false } }) },
      kuwait('2026-11-05T12:00:00'),
    );
    expect(mixed.weeklyList.find((d) => d.dayKey === 'friday')?.text).toBe('مغلق');
    expect(mixed.summaryText).toContain('الخميس');
  });

  it('says the restaurant is closed when every day is disabled', () => {
    const off = Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map((d) => [d, { enabled: false }]));
    expect(formatOpeningHoursSummary({ openingHours: off }, kuwait('2026-11-05T12:00:00')).summaryText).toBe('المطعم مغلق حسب جدول أوقات العمل.');
  });
});

describe('getConfiguredStoreStatus', () => {
  it('returns the stored status when no opening hours exist', () => {
    expect(getConfiguredStoreStatus({ settings: { storeStatus: { manualClose: true } } })).toEqual({ manualClose: true });
    expect(getConfiguredStoreStatus(undefined)).toEqual({});
  });

  it('merges top-level opening hours into both keys', () => {
    const hours = week('10:00', '22:00');
    const r = getConfiguredStoreStatus({ openingHours: hours, storeStatus: { manualClose: false } });
    expect(r).toEqual({ manualClose: false, openingHours: hours, workingHours: hours });
  });
});
