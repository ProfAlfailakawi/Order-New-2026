// Shared Business Contract
// تعريفات موحدة بين برنامج العميل وبرنامج الأدمن.
// هذا الملف لا يقرأ ولا يكتب في قاعدة البيانات، ولا يغيّر أي منطق قائم؛ دوره توحيد أسماء الحالات والحقول فقط.

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'unknown';

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'
  | 'unknown';

export interface ProductContract {
  id: string;
  name: string;
  price?: number;
  cost?: number;
  category?: string;
  image?: string;
  images?: string[];
  supplierId?: string;
  isActive?: boolean;
}

export interface OrderContract {
  id: string;
  orderNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items?: Array<{ id?: string; productId?: string; name?: string; quantity?: number; price?: number }>;
  total?: number;
  totalAmount?: number;
  status?: OrderStatus | string;
  paymentStatus?: PaymentStatus | string;
  regionId?: string;
  regionName?: string;
  address?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface InvoiceContract {
  id: string;
  customerName?: string;
  customerPhone?: string;
  total?: number;
  totalAmount?: number;
  paymentStatus?: PaymentStatus | string;
  date?: any;
  items?: any[];
}

export interface CustomerContract {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  area?: string;
  region?: string;
  lastOrderAt?: any;
  totalSpent?: number;
}

export interface SquadContract {
  id: string;
  name: string;
  founder?: string;
  phone?: string;
  points?: number;
  members?: number;
  membersList?: any[];
}

export interface PromoContract {
  id?: string;
  code: string;
  discountType?: 'percentage' | 'fixed' | string;
  discountValue?: number;
  isActive?: boolean;
}

export interface RegionContract {
  id: string;
  name: string;
  deliveryFee?: number;
  isActive?: boolean;
}

export const normalizePaymentStatus = (value: unknown): PaymentStatus => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'unknown';
  if (['paid', 'success', 'confirmed', 'مدفوع', 'تم الدفع'].some(k => text.includes(k))) return 'paid';
  if (['pending', 'waiting', 'بانتظار', 'معلق', 'جديد'].some(k => text.includes(k))) return 'pending';
  if (['failed', 'declined', 'فشل', 'فاشل', 'مرفوض'].some(k => text.includes(k))) return 'failed';
  if (['cancelled', 'canceled', 'ملغي', 'ملغى'].some(k => text.includes(k))) return 'cancelled';
  if (['refund', 'refunded', 'مسترجع'].some(k => text.includes(k))) return 'refunded';
  return 'unknown';
};

export const hasProductImage = (product: Partial<ProductContract> | any): boolean => {
  const images = [product?.image, product?.imageUrl, product?.photo, ...(Array.isArray(product?.images) ? product.images : [])].filter(Boolean);
  return images.length > 0;
};
