import { describe, it, expect, vi } from 'vitest';
import { isUPaymentsRateLimited } from '../lib/upaymentsRateLimit';
import { verifyUPaymentsPayment } from '../lib/upaymentsVerify';

describe('UPayments rate limiting', () => {
  it('detects 429 and the Cloudflare challenge page', () => {
    expect(isUPaymentsRateLimited(429)).toBe(true);
    expect(isUPaymentsRateLimited(403, '<!DOCTYPE html><html><head><title>Just a moment...</title>')).toBe(true);
    expect(isUPaymentsRateLimited(401, { error: 'Invalid signature' })).toBe(false);
    expect(isUPaymentsRateLimited(404, {})).toBe(false);
  });

  it('stops trying further ids/hosts as soon as UPayments answers 429', async () => {
    const fetcher = vi.fn(async () => ({ status: 429, data: null }));
    const verdict = await verifyUPaymentsPayment(
      { candidates: ['A', 'B', 'C', 'D'], expectedRefs: ['ORD-1'], apiKey: 'k' },
      fetcher,
    );
    expect(verdict).toBe('unknown');
    expect(fetcher).toHaveBeenCalledTimes(1); // was up to 8 ids x 2 hosts x 2 endpoints
  });
});
