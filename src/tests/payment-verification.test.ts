import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { app, startServer, verifyGatewaySuccess } from '../../server';
import { judgeStatusResponse, verifyUPaymentsPayment } from '../lib/upaymentsVerify';

// Owner-approved fix 2026-10-29: opening /api/payment-return/<order>/success by hand
// used to mark the order paid. A payment now counts only when UPayments confirms it.

const DATA = vi.hoisted(() => ({
  products: [],
  settings: { deliveryFee: 0 },
  zones: [],
  customers: [],
  squads: [],
  invoices: [],
  orders: [
    {
      id: 'ORD-1700000000100-PAY1',
      customerName: 'Payer',
      customerPhone: '99001122',
      status: 'بانتظار الدفع',
      items: [],
      total: 12.5,
      lastPaymentAmount: 12.5,
      paymentId: 'O-abc123',
      createdAt: '2026-10-29T10:00:00.000Z',
    },
    {
      id: 'ORD-1700000000101-FREE',
      customerName: 'Free',
      status: 'بانتظار الدفع',
      items: [],
      total: 0,
      lastPaymentAmount: 0,
      createdAt: '2026-10-29T10:00:00.000Z',
    },
    {
      id: 'ORD-1700000000102-SPLT',
      customerName: 'Group',
      status: 'بانتظار الدفع',
      items: [],
      total: 20,
      splitPayments: [{ id: 'S-xyz789', amount: 5, status: 'pending', phone: '99001133' }],
      createdAt: '2026-10-29T10:00:00.000Z',
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


const captured = (extra: any = {}) => ({ status: true, data: { transaction: { result: 'CAPTURED', ...extra } } });

describe('UPayments verification logic', () => {
  it('accepts a captured payment for this order and amount', () => {
    expect(judgeStatusResponse(captured({ order_id: 'O-abc123', total_price: '12.500' }), ['O-ABC123'], 12.5)).toBe('paid');
  });
  it("rejects someone else's payment (wrong order reference)", () => {
    expect(judgeStatusResponse(captured({ order_id: 'O-other', total_price: '12.500' }), ['O-abc123'], 12.5)).toBe('unknown');
  });
  it('rejects a payment for a smaller amount', () => {
    expect(judgeStatusResponse(captured({ order_id: 'O-abc123', total_price: '0.100' }), ['O-abc123'], 12.5)).toBe('unknown');
  });
  it('reports NOT CAPTURED as failed', () => {
    expect(judgeStatusResponse({ data: { transaction: { result: 'NOT CAPTURED', order_id: 'O-abc123' } } }, ['O-abc123'], 12.5)).toBe('failed');
  });
  it('without any reference, needs a matching amount', () => {
    expect(judgeStatusResponse(captured({}), ['O-abc123'], 12.5)).toBe('unknown');
    expect(judgeStatusResponse(captured({ amount: 12.5 }), ['O-abc123'], 12.5)).toBe('paid');
  });
  it('asks get-payment-status and falls back to /charge on 404', async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.includes('get-payment-status')) return { status: 404, data: null };
      return { status: 200, data: captured({ reference: { id: 'ORD-1' }, total_price: 3 }) };
    };
    const verdict = await verifyUPaymentsPayment({ candidates: ['TRK1'], expectedRefs: ['ORD-1'], expectedAmount: 3, apiKey: 'k' }, fetcher);
    expect(verdict).toBe('paid');
    expect(calls[0]).toContain('/get-payment-status/TRK1');
    expect(calls[1]).toContain('/charge/TRK1');
  });
  it('is unknown with no API key, no ids, or a network error', async () => {
    const boom = async () => { throw new Error('down'); };
    expect(await verifyUPaymentsPayment({ candidates: ['T'], expectedRefs: ['O'], apiKey: '' }, boom)).toBe('unknown');
    expect(await verifyUPaymentsPayment({ candidates: [], expectedRefs: ['O'], apiKey: 'k' }, boom)).toBe('unknown');
    expect(await verifyUPaymentsPayment({ candidates: ['T'], expectedRefs: ['O'], apiKey: 'k' }, boom)).toBe('unknown');
  });
  it('ignores ids that are not plain identifiers', () => {
    expect(judgeStatusResponse(captured({ order_id: '<script>' }), ['<script>'], null)).toBe('unknown');
  });
});

describe('verifyGatewaySuccess (server wiring)', () => {
  beforeAll(async () => {
    delete process.env.UPAYMENTS_API_KEY;
    await startServer();
  });

  it('passes the order ids and server-side amount to the gateway check', async () => {
    const seen: any[] = [];
    const fake = async (input: any) => { seen.push(input); return 'paid' as const; };
    const verdict = await verifyGatewaySuccess('ORD-1700000000100-PAY1', '', { track_id: 'TRK-9' }, fake as any);
    expect(verdict).toBe('paid');
    expect(seen[0].candidates).toContain('TRK-9');
    expect(seen[0].expectedRefs).toEqual(expect.arrayContaining(['ORD-1700000000100-PAY1', 'O-abc123']));
    expect(seen[0].expectedAmount).toBe(12.5);
  });

  it('uses the split entry for split payments', async () => {
    const seen: any[] = [];
    const fake = async (input: any) => { seen.push(input); return 'paid' as const; };
    await verifyGatewaySuccess('ORD-1700000000102-SPLT-S-S-xyz789', '', {}, fake as any);
    expect(seen[0].expectedRefs).toContain('S-xyz789');
    expect(seen[0].expectedAmount).toBe(5);
  });

  it('a free order (server total 0) needs no gateway', async () => {
    const never = async () => { throw new Error('should not be called'); };
    expect(await verifyGatewaySuccess('ORD-1700000000101-FREE', '', {}, never as any)).toBe('paid');
  });

  it('an unknown order is never paid', async () => {
    expect(await verifyGatewaySuccess('ORD-NOPE', '', { track_id: 'x' })).toBe('unknown');
  });

  it('opening the success URL by hand no longer marks the order paid', async () => {
    const res = await request(app).get('/api/payment-return/ORD-1700000000100-PAY1/success');
    expect(res.status).toBe(200);
    expect(res.text).toContain('payment=pending');
    expect(res.text).not.toContain('payment=success');
  });

  it('a forged webhook with status success changes nothing', async () => {
    const res = await request(app)
      .post('/api/payment-webhook/ORD-1700000000100-PAY1')
      .send({ status: 'success', result: 'CAPTURED', track_id: 'FAKE' });
    expect(res.status).toBe(200);
  });
});
