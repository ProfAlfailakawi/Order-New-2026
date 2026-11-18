import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  computeUPaymentsSignature,
  upaymentsHmacHeaders,
  upaymentsSignedPath,
  verifyUPaymentsWebhookSignature,
  upaymentsWebhookGate,
} from '../lib/upaymentsHmac';

const SECRET = 'sk_test_unit_secret';
const NOW = 1718365200_000;

describe('UPayments HMAC', () => {
  it('matches the documented payload format (timestamp+METHOD+path+body)', () => {
    const body = '{"amount":100,"currency":"USD","order_id":"ORD123"}';
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update('1718365200POSTcharge' + body)
      .digest('base64');
    expect(computeUPaymentsSignature(SECRET, 1718365200, 'post', 'charge', body)).toBe(expected);
  });

  it('signs only the path after /api/v1/ (no domain, no query)', () => {
    expect(upaymentsSignedPath('https://apiv2api.upayments.com/api/v1/charge')).toBe('charge');
    expect(upaymentsSignedPath('https://sandboxapi.upayments.com/api/v1/get-payment-status/abc%20d?x=1')).toBe('get-payment-status/abc%20d');
  });

  it('builds headers, uses empty body for GET, and is a no-op without a secret', () => {
    const h = upaymentsHmacHeaders('GET', 'https://x.upayments.com/api/v1/get-payment-status/9', '', { secret: SECRET, nowMs: NOW });
    expect(h['X-Timestamp']).toBe('1718365200');
    expect(h['X-Signature']).toBe(computeUPaymentsSignature(SECRET, '1718365200', 'GET', 'get-payment-status/9', ''));
    expect(upaymentsHmacHeaders('GET', 'https://x/api/v1/charge', '', { secret: '' })).toEqual({});
  });

  const body = '{"track_id":"1","result":"CAPTURED"}';
  const url = 'https://shop.example/api/webhook/upayments';
  const signed = (extra: Record<string, string> = {}) => ({
    'x-timestamp': '1718365200',
    'x-signature': computeUPaymentsSignature(SECRET, '1718365200', 'POST', url, body),
    ...extra,
  });

  it('verifies webhooks against the FULL url', () => {
    const base = { method: 'POST', candidateUrls: [url], rawBody: body, secret: SECRET, nowMs: NOW };
    expect(verifyUPaymentsWebhookSignature({ ...base, headers: signed() })).toBe('valid');
    expect(verifyUPaymentsWebhookSignature({ ...base, headers: signed(), rawBody: body + ' ' })).toBe('invalid');
    expect(verifyUPaymentsWebhookSignature({ ...base, headers: {} })).toBe('missing');
    expect(verifyUPaymentsWebhookSignature({ ...base, headers: signed(), nowMs: NOW + 3600_000 })).toBe('invalid');
    expect(verifyUPaymentsWebhookSignature({ ...base, headers: signed(), secret: '' })).toBe('disabled');
  });

  it('gate: bad signature -> 401, missing -> pass unless enforced', () => {
    process.env.UPAYMENTS_API_SECRET = SECRET;
    const mk = (headers: any) => ({ headers: { host: 'shop.example', 'x-forwarded-proto': 'https', ...headers }, method: 'POST', originalUrl: '/api/webhook/upayments', rawBody: Buffer.from(body), body: {} });
    const run = (gate: any, req: any) => {
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      gate(req, res, next);
      return { res, next };
    };
    try {
      expect(run(upaymentsWebhookGate(), mk({ 'x-timestamp': String(Math.floor(Date.now() / 1000)), 'x-signature': 'bad' })).res.status).toHaveBeenCalledWith(401);
      expect(run(upaymentsWebhookGate(), mk({})).next).toHaveBeenCalled();
      expect(run(upaymentsWebhookGate({ enforce: true }), mk({})).res.status).toHaveBeenCalledWith(401);
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = computeUPaymentsSignature(SECRET, ts, 'POST', url, body);
      expect(run(upaymentsWebhookGate({ enforce: true }), mk({ 'x-timestamp': ts, 'x-signature': sig })).next).toHaveBeenCalled();
    } finally {
      delete process.env.UPAYMENTS_API_SECRET;
    }
  });
});
