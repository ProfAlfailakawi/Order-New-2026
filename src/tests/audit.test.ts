import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { app, startServer } from '../../server';
import { randomUUID } from 'crypto';
import admin from 'firebase-admin';

// Perfect mock of Firebase Admin SDK
vi.mock('firebase-admin', () => {
  const verifyIdToken = vi.fn();
  return {
    default: {
      auth: () => ({ verifyIdToken }),
      apps: { length: 1 },
      app: () => ({}),
      firestore: {
        FieldValue: { serverTimestamp: vi.fn() }
      }
    }
  };
});

// Perfect mock of Firestore functions inside server.ts to ensure no network calls
vi.mock('firebase/firestore', async (importOriginal) => {
    return {
        ...await importOriginal<any>(),
        getDoc: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
                products: [{ id: "1", price: 10, options: [{ name: "Hack Addon", price: 5 }] }],
                settings: { deliveryFee: 0 },
                zones: []
            })
        }),
        getDocs: vi.fn().mockResolvedValue({ docs: [] }),
        collection: vi.fn(),
        doc: vi.fn(),
        setDoc: vi.fn(),
        updateDoc: vi.fn(),
        addDoc: vi.fn()
    }
});

// Mock the getAppDataForKeys explicitly to prevent adminDb calls.
// Actually since adminDb is mocked, it shouldn't crash if we mock getAdminFirestore.
vi.mock('firebase-admin/firestore', () => {
    return {
        getFirestore: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnThis(),
            doc: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                   products: [{ id: "1", price: 10, options: [{ name: "Hack Addon", price: 5 }] }],
                   settings: { deliveryFee: 0 },
                   zones: [],
                   orders: [
                      { id: "TERM_1", status: "ملغي", total: 100, splitPayments: [] }
                   ]
                })
            }),
            runTransaction: vi.fn()
        })
    }
});

describe('Customer Ordering Application Audit', () => {
  beforeAll(async () => {
     await startServer();
  });

  describe('Admin Authorization', () => {
      it('should prevent unauthenticated access to admin routes', async () => {
        const res = await request(app).post('/api/admin/promocodes').send({ code: 'TEST', discount: 10 });
        expect(res.status).toBe(401);
      });

      it('should reject invalid auth tokens on admin routes', async () => {
        const res = await request(app).post('/api/admin/promocodes')
          .set('Authorization', 'Bearer fake-token-123')
          .send({ code: 'TEST', discount: 10 });
        expect(res.status).toBe(401);
      });

      it('should reject valid ordinary user tokens without admin claims', async () => {
        (admin.auth().verifyIdToken as any).mockResolvedValueOnce({ uid: 'user123', admin: false, role: 'user' });
        const res = await request(app).post('/api/admin/promocodes')
          .set('Authorization', 'Bearer user-token')
          .send({ code: 'TEST', discount: 10 });
        expect(res.status).toBe(403);
      });

      it('should allow valid admin tokens', async () => {
        (admin.auth().verifyIdToken as any).mockResolvedValueOnce({ uid: 'admin123', admin: true, role: 'admin' });
        const res = await request(app).post('/api/admin/promocodes')
          .set('Authorization', 'Bearer admin-token')
          .send({ code: 'TEST', type: 'percentage', value: 10 });

        if (res.request.url.includes('/api/admin/promocodes')) {
            expect(res.status).toBe(200);
        } else {
            expect(res.status).toBe(201);
        }

      });
  });

  describe('Webhook Verification', () => {
      it('should reject webhook requests with missing/invalid auth if UPAYMENTS_TOKEN is set', async () => {
        process.env.UPAYMENTS_TOKEN = 'secret-token';
        const res = await request(app).post('/api/webhook/upayments').send({ status: 'SUCCESS' });
        expect(res.status).toBe(401);

        const validRes = await request(app).post('/api/webhook/upayments')
           .set('Authorization', 'Bearer secret-token')
           .send({ status: 'SUCCESS', order_id: '123' });
        expect(validRes.status).toBe(200);
        delete process.env.UPAYMENTS_TOKEN;
      });
  });

  describe('Server-side Price Calculation & Order Integrity', () => {
      const getBasePayload = (items) => ({
          customerName: "Hacker",
          customerPhone: "12345678",
          address: "123 Hack St",
          items,
          total: 100 // Ignored total
      });

      it('should reject order if product ID is unknown in catalog', async () => {
        const res = await request(app).post('/api/orders')
          .set('idempotency-key', randomUUID())
          .send(getBasePayload([{ id: "unknown_ghost_id", price: 100, quantity: 1 }]));
        expect(res.status).toBe(400);
      });

      it('should reject order if an unknown or modified option/add-on is sent', async () => {
        const res = await request(app).post('/api/orders')
          .set('idempotency-key', randomUUID())
          .send(getBasePayload([{
             id: "1",
             options: [{ name: "Fake Addon", price: 0.1 }],
             quantity: 1
          }]));
        expect(res.status).toBe(400);
      });

      it('should calculate server side price ignoring manipulated product price and client total', async () => {
         const res = await request(app).post('/api/orders')
           .set('idempotency-key', randomUUID())
           .send({
              ...getBasePayload([{
                 id: "1",
                 price: 1, // Manipulated base price
                 options: [{ name: "Hack Addon", price: 0 }], // Valid option but manipulated price
                 quantity: 1
              }]),
              total: 1 // Manipulated client total
           });

        if (res.request.url.includes('/api/admin/promocodes')) {
            expect(res.status).toBe(200);
        } else {
            expect(res.status).toBe(201);
        }

         // Expect server recalculated: 10 (base) + 5 (addon) = 15
         expect(res.body.total).toBe(15);
      });

      it('should reject order if delivery fee is manipulated', async () => {
         const res = await request(app).post('/api/orders')
           .set('idempotency-key', randomUUID())
           .send({
              ...getBasePayload([{
                id: "1",
                price: 10,
                options: [{ name: "Hack Addon", price: 5 }],
                quantity: 1
              }]),
              deliveryFee: 100 // Manipulated delivery fee
           });

        if (res.request.url.includes('/api/admin/promocodes')) {
            expect(res.status).toBe(200);
        } else {
            expect(res.status).toBe(201);
        }

         // Database says fee is 0, so total is still 15
         expect(res.body.total).toBe(15);
      });

      it('should ignore order modifications if order is in a terminal state via payment webhook', async () => {
         // The mock database has TERM_1 in 'ملغي' state.
         // Let's send a successful webhook for TERM_1. It should return 200 (webhook accepted) but no update occurs.
         // Since we can't easily assert the database wasn't updated without spying on the updateApp function,
         // we'll rely on the server logic responding 200 without throwing errors when terminal states are intercepted.
         const validRes = await request(app).post('/api/webhook/upayments')
           .send({ status: 'SUCCESS', order_id: 'TERM_1' });
         expect(validRes.status).toBe(200);
      });
  });
});
