import { describe, it, expect, beforeAll, vi } from 'vitest';
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
        settings: { deliveryFee: 0 },
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
            settings: { deliveryFee: 0 },
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
          settings: { deliveryFee: 0 },
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
              settings: { deliveryFee: 0 },
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

describe('Security Architecture Hardening — dead/debug surfaces require admin auth', () => {
  beforeAll(async () => {
    await startServer();
  });

  // ---------------------------------------------------------------------------
  // SECURITY BOUNDARY: anonymous callers can no longer reach the legacy
  // full-datastore write, full-datastore read, or debug/PII endpoints.
  // These endpoints have no active client caller in src/ (the fakestore shim
  // is imported nowhere; the admin dashboard reads/writes Firestore directly).
  // ---------------------------------------------------------------------------
  describe('Anonymous access is rejected (was previously open)', () => {
    it('PATCH /api/appdata (arbitrary full-datastore write) -> 401 without token', async () => {
      const res = await request(app)
        .patch('/api/appdata')
        .send({ products: [], orders: [] });
      expect(res.status).toBe(401);
    });

    it('GET /api/appdata (full-datastore read) -> 401 without token', async () => {
      const res = await request(app).get('/api/appdata');
      expect(res.status).toBe(401);
    });

    it.each([
      '/api/debug',
      '/api/debug-docs',
      '/api/debug-collections',
      '/api/debug-search',
      '/api/debug-squads',
      '/api/debug-loyalty',
      '/api/debug/order/ORD-123',
    ])('GET %s -> 401 without token', async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    });

    it('rejects a non-admin (ordinary user) token on a gated endpoint -> 403', async () => {
      (admin.auth().verifyIdToken as any).mockResolvedValueOnce({ uid: 'user1', admin: false, role: 'user' });
      const res = await request(app)
        .patch('/api/appdata')
        .set('Authorization', 'Bearer user-token')
        .send({ products: [] });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // PRESERVATION: an authenticated admin retains full access to these endpoints
  // (they are gated, not removed) — no admin capability is lost.
  // ---------------------------------------------------------------------------
  describe('Admin access is preserved (endpoints gated, not removed)', () => {
    it('GET /api/debug with a valid admin token still works (not 401/403)', async () => {
      (admin.auth().verifyIdToken as any).mockResolvedValueOnce({ uid: 'admin1', admin: true, role: 'admin' });
      const res = await request(app)
        .get('/api/debug')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(200);
    });

    it('PATCH /api/appdata with a valid admin token still works (not 401/403)', async () => {
      (admin.auth().verifyIdToken as any).mockResolvedValueOnce({ uid: 'admin1', admin: true, role: 'admin' });
      const res = await request(app)
        .patch('/api/appdata')
        .set('Authorization', 'Bearer admin-token')
        .send({ settings: { deliveryFee: 0 } });
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // PRESERVATION: customer-facing narrow APIs remain unauthenticated and
  // functional exactly as before. The order flow does NOT go through the
  // gated endpoints.
  // ---------------------------------------------------------------------------
  describe('Customer-facing flows remain open and unchanged', () => {
    it('POST /api/orders still accepts an anonymous customer order (201)', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('idempotency-key', randomUUID())
        .send({
          customerName: 'Customer',
          customerPhone: '12345678',
          address: '123 St',
          items: [{ id: '1', price: 10, options: [{ name: 'Hack Addon', price: 5 }], quantity: 1 }],
          total: 15,
        });
      expect(res.status).toBe(201);
      // Server-authoritative pricing unchanged: 10 base + 5 addon = 15
      expect(res.body.total).toBe(15);
    });

    it('GET /api/products remains publicly accessible (not gated)', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('GET /api/track-orders remains publicly accessible (not gated)', async () => {
      const res = await request(app).get('/api/track-orders').query({ phone: '12345678' });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
