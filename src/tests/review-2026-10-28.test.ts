import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { app, startServer } from '../../server';
import { markerTooltipHtml } from '../components/leafletTooltip';

// Regression tests for the 2026-10-28 review. Same offline Firebase mocks as
// audit.test.ts, with a small data set that holds personal data so leaks show.
const DATA = vi.hoisted(() => ({
  products: [{ id: '1', name: 'مجبوس', price: 10 }],
  settings: { deliveryFee: 0 },
  zones: [],
  customers: [{ id: 'C1', name: 'Alice', phone: '99887766' }],
  orders: [
    {
      id: 'ORD-1700000000000-AB12',
      customerName: 'Alice',
      customerPhone: '99887766',
      address: { region: 'السالمية', block: '1', street: '2', building: '3' },
      status: 'تم الدفع بنجاح',
      items: [],
      total: 10,
      createdAt: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'ORD-1700000000001-CD34',
      customerName: 'Bob',
      customerPhone: '55667788',
      address: { region: 'حولي', block: '4', street: '5', building: '6' },
      status: 'بانتظار الدفع',
      items: [],
      total: 12,
      createdAt: '2026-10-02T10:00:00.000Z',
    },
    {
      // Saved without a phone (e.g. an admin-entered order).
      id: 'ORD-1700000000002-EF56',
      customerName: 'Dana',
      address: { region: 'الجابرية', block: '7', street: '8', building: '9' },
      status: 'بانتظار الدفع',
      items: [],
      total: 8,
      createdAt: '2026-10-03T10:00:00.000Z',
    },
  ],
  invoices: [
    {
      id: 'INV-1001',
      invoiceId: 'INV-1001',
      customerName: 'Carol',
      address: { region: 'الرميثية', block: '1' },
      status: 'تم الدفع',
      total: 3,
    },
  ],
}));

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
  const snapshot = () => ({ exists: () => true, data: () => JSON.parse(JSON.stringify(DATA)) });
  return {
    ...(await importOriginal<any>()),
    getDoc: vi.fn().mockImplementation(async () => snapshot()),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    collection: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    runTransaction: vi.fn().mockImplementation(async (_db: any, callback: any) =>
      callback({ get: vi.fn().mockResolvedValue(snapshot()), set: vi.fn(), update: vi.fn() }),
    ),
  };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
  }),
}));

const names = (body: any) => (Array.isArray(body) ? body.map((o: any) => o.customerName || o.name) : body);

describe('Review 2026-10-28 regressions', () => {
  beforeAll(async () => {
    await startServer();
  });

  describe('GET /api/track-orders does not match records on a missing id', () => {
    it.each(['undefined', 'UNDEFINED', 'null', 'ORD-NDEFINED', 'INED'])(
      'order_id=%s returns no orders',
      async (orderId) => {
        const res = await request(app).get('/api/track-orders').query({ order_id: orderId });
        expect(res.status).toBe(200);
        expect(names(res.body)).toEqual([]);
      },
    );

    it('still finds an order by its full id, its last 4 characters and the phone', async () => {
      const byId = await request(app).get('/api/track-orders').query({ order_id: 'ORD-1700000000000-AB12' });
      expect(names(byId.body)).toEqual(['Alice']);

      const byLast4 = await request(app).get('/api/track-orders').query({ order_id: 'cd34' });
      expect(names(byLast4.body)).toEqual(['Bob']);

      const byPhone = await request(app).get('/api/track-orders').query({ phone: '99887766' });
      expect(names(byPhone.body)).toEqual(['Alice']);

      const invoice = await request(app).get('/api/track-orders').query({ order_id: 'INV-1001' });
      expect(names(invoice.body)).toEqual(['Carol']);
    });
  });

  describe('phone lookups need a real 8-digit number', () => {
    it('GET /api/customers?phone=x does not return the person behind a phone-less invoice', async () => {
      const res = await request(app).get('/api/customers').query({ phone: 'x' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('GET /api/customers still returns the profile for a real number', async () => {
      const res = await request(app).get('/api/customers').query({ phone: '+965 9988 7766' });
      expect(names(res.body)).toEqual(['Alice']);
    });

    it('GET /api/search-order/abc does not return orders saved without a phone', async () => {
      const res = await request(app).get('/api/search-order/abc');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('GET /api/search-order still finds orders for a real number', async () => {
      const res = await request(app).get('/api/search-order/55667788');
      expect(names(res.body)).toEqual(['Bob']);
    });
  });

  describe('map tooltip escapes customer-typed text', () => {
    it('renders a diwaniya name with HTML in it as text', () => {
      const html = markerTooltipHtml({ name: 'ديوانية <img src=x onerror=alert(1)>', subtitle: '<b>x</b>' });
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<b>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    });

    it('keeps the normal tooltip markup', () => {
      const html = markerTooltipHtml({ name: 'ديوانية الفزعة', subtitle: 'تبعد 40م', value: 2.5 });
      expect(html).toContain('ديوانية الفزعة');
      expect(html).toContain('تبعد 40م');
      expect(html).toContain('2.500 د.ك');
    });
  });
});
