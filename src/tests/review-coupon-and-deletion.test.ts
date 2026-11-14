import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app, startServer } from '../../server';
import { randomUUID } from 'crypto';
import admin from 'firebase-admin';

// Mirror the Firebase Admin + Firestore mocks used by audit.test.ts so the
// server runs fully offline (no network) during this suite.
vi.mock('firebase-admin', () => {
  const verifyIdToken = vi.fn();
  return {
    default: {
      auth: () => ({ verifyIdToken }),
      apps: { length: 1 },
      app: () => ({}),
      firestore: { FieldValue: { serverTimestamp: vi.fn() } },
    },
  };
});

vi.mock('firebase/firestore', async (importOriginal) => {
  return {
    ...await importOriginal<any>(),
    getDoc: vi.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({
        products: [{ id: '1', price: 10, options: [{ name: 'Hack Addon', price: 5 }] }],
        settings: { deliveryFee: 1.5 },
        zones: [],
        orders: [],
      }),
    }),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    collection: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    runTransaction: vi.fn().mockImplementation(async (_db, callback) => {
      const transaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            products: [{ id: '1', price: 10, options: [{ name: 'Hack Addon', price: 5 }] }],
            settings: { deliveryFee: 1.5 },
            zones: [],
            orders: [],
          }),
        }),
        set: vi.fn(),
        update: vi.fn(),
      };
      return callback(transaction);
    }),
  };
});

vi.mock('firebase-admin/firestore', () => {
  return {
    getFirestore: vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnThis(),
      doc: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          products: [{ id: '1', price: 10, options: [{ name: 'Hack Addon', price: 5 }] }],
          settings: { deliveryFee: 1.5 },
          zones: [],
          orders: [],
        }),
      }),
      runTransaction: vi.fn().mockImplementation(async (callback) => {
        const transaction = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              products: [{ id: '1', price: 10, options: [{ name: 'Hack Addon', price: 5 }] }],
              settings: { deliveryFee: 1.5 },
              zones: [],
              orders: [],
            }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        return callback(transaction);
      }),
    }),
  };
});

const item = { id: '1', productId: '1', price: 10, options: [{ name: 'Hack Addon', price: 5 }], quantity: 1 };
const payload = (extra: any = {}) => ({
  customerName: 'Reviewer',
  customerPhone: '12345678',
  address: '123 St',
  items: [item],
  total: 16.5,
  ...extra,
});

describe('App Store review coupon (REVIEW_COUPON_CODE)', () => {
  beforeAll(async () => {
    await startServer();
  });
  afterEach(() => {
    delete process.env.REVIEW_COUPON_CODE;
  });

  it('is OFF when the env var is unset: code is rejected and the order is charged in full', async () => {
    const v = await request(app).post('/api/validate-promo').send({ code: 'APPLE-REVIEW-1' });
    expect(v.body.success).toBe(false);
    const res = await request(app).post('/api/orders').set('idempotency-key', randomUUID())
      .send(payload({ promoCode: 'APPLE-REVIEW-1' }));
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(16.5);
    expect(res.body.isReviewOrder).toBeUndefined();
  });

  it('is OFF when the configured code is too short or has unsafe characters', async () => {
    for (const bad of ['SHORT', 'has space code']) {
      process.env.REVIEW_COUPON_CODE = bad;
      const v = await request(app).post('/api/validate-promo').send({ code: bad });
      expect(v.body.success).toBe(false);
    }
  });

  it('validates the configured code (case-insensitive) as a free promo', async () => {
    process.env.REVIEW_COUPON_CODE = 'Apple-Review-1';
    const v = await request(app).post('/api/validate-promo').send({ code: ' apple-review-1 ' });
    expect(v.body.success).toBe(true);
    expect(v.body.promo.type).toBe('free');
  });

  it('makes the order free (items + delivery), paid, flagged and labelled', async () => {
    process.env.REVIEW_COUPON_CODE = 'APPLE-REVIEW-1';
    const res = await request(app).post('/api/orders').set('idempotency-key', randomUUID())
      .send(payload({ promoCode: 'apple-review-1', total: 0 }));
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(0);
    expect(res.body.paymentStatus).toBe('paid');
    expect(res.body.isReviewOrder).toBe(true);
    expect(res.body.isTestOrder).toBe(true);
    expect(res.body.customerName.startsWith('[تجربة مراجعة آبل]')).toBe(true);
  });

  it('does not affect other customers: wrong code or no code still pays in full', async () => {
    process.env.REVIEW_COUPON_CODE = 'APPLE-REVIEW-1';
    const wrong = await request(app).post('/api/orders').set('idempotency-key', randomUUID())
      .send(payload({ promoCode: 'APPLE-REVIEW-2', total: 0 }));
    expect(wrong.body.total).toBe(16.5);
    expect(wrong.body.isReviewOrder).toBeUndefined();
    const none = await request(app).post('/api/orders').set('idempotency-key', randomUUID()).send(payload());
    expect(none.body.total).toBe(16.5);
  });
});

describe('Account deletion request', () => {
  beforeAll(async () => {
    await startServer();
  });

  it('rejects an invalid phone', async () => {
    const res = await request(app).post('/api/account/deletion-request').send({ phone: '123' });
    expect(res.status).toBe(400);
  });

  it('records a request and answers with the 30-day wording', async () => {
    const res = await request(app).post('/api/account/deletion-request').send({ phone: '55512345' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('30 يومًا');
  });

  it('the owner list requires admin auth', async () => {
    const res = await request(app).get('/api/admin/account-deletion-requests');
    expect(res.status).toBe(401);
  });
});
