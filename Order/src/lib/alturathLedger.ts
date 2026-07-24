// Alturath Ledger
// سجل أحداث واجهة آمن وخفيف. لا يلمس الدفع ولا يغير حالة الطلبات أو قاعدة البيانات.
// الهدف: وجود صيغة موحدة للأحداث عند الحاجة للتتبع، مع ترك التفعيل الفعلي للأماكن الحساسة لموافقة مستقلة.

export type AlturathLedgerEventType =
  | 'ORDER_CREATED'
  | 'PAYMENT_LINK_CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'PRODUCT_PRICE_CHANGED'
  | 'CUSTOMER_JOINED_SQUAD'
  | 'SPLIT_PAYMENT_PAID'
  | 'UI_ACTION';

export interface AlturathLedgerEvent {
  type: AlturathLedgerEventType;
  entityId?: string;
  entityType?: 'order' | 'invoice' | 'product' | 'customer' | 'squad' | 'payment' | 'ui';
  actorRole?: string;
  meta?: Record<string, any>;
  createdAt: string;
}

const MEMORY_KEY = 'alturath_ui_event_ledger';

export const createLedgerEvent = (
  type: AlturathLedgerEventType,
  details: Omit<Partial<AlturathLedgerEvent>, 'type' | 'createdAt'> = {}
): AlturathLedgerEvent => ({
  type,
  ...details,
  createdAt: new Date().toISOString(),
});

export const appendLocalLedgerEvent = (event: AlturathLedgerEvent, limit = 80) => {
  if (typeof window === 'undefined') return;
  try {
    const current = JSON.parse(window.localStorage.getItem(MEMORY_KEY) || '[]');
    const next = [event, ...(Array.isArray(current) ? current : [])].slice(0, limit);
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
  } catch {}
};

export const readLocalLedgerEvents = (): AlturathLedgerEvent[] => {
  if (typeof window === 'undefined') return [];
  try {
    const current = JSON.parse(window.localStorage.getItem(MEMORY_KEY) || '[]');
    return Array.isArray(current) ? current : [];
  } catch {
    return [];
  }
};
