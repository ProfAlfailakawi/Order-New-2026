/*
 * /api/health: قراءةٌ بلا مصادقة ولا قاعدة بيانات، تسألها صفحةُ «نُحدّث البرنامج»
 * والشريطُ داخل التطبيق ليعرفا أن خادم الطلبات عاد.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { app, startServer } from '../../server';

vi.mock('firebase-admin', () => ({
  default: {
    auth: () => ({ verifyIdToken: vi.fn() }),
    apps: { length: 1 },
    app: () => ({}),
    firestore: { FieldValue: { serverTimestamp: vi.fn() } },
  },
}));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<any>(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  runTransaction: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
    runTransaction: vi.fn(),
  }),
}));

/* -------------------------------- /api/health ------------------------------- */
describe('GET /api/health', () => {
  beforeAll(async () => {
    await startServer();
  }, 60_000);

  it('answers {ok:true} without auth and is never cached', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['cache-control']).toContain('no-store');
  });
});

