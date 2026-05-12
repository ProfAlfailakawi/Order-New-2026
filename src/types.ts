export interface Product {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  image: string;
  category: string;
  options: string[];
  extras: { name: string; price: number }[];
  preparationInstructions?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  productName?: string; // Add fallback
  quantity: number;
  price: number;
  selectedOption?: string;
  selectedExtras: { name: string; price: number }[];
  note?: string;
  itemNotes?: string; // Add fallback
  preparationInstructions?: string;
  product?: Product;
}

export interface Address {
  region: string;
  block: string;
  street: string;
  avenue?: string;
  building: string;
  floor?: string;
  apartment?: string;
  deliveryNotes?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  address: Address;
  items: OrderItem[];
  deliveryFee: number;
  isFreeDelivery?: boolean; // Add property
  total: number;
  status: "جديد" | "بانتظار الدفع" | "قيد تجميع القطية" | "تم الدفع وجاري التوصيل" | "ملغي" | "فشل في عملية الدفع";
  createdAt: string;
  date?: string;
  source: string;
  generalNotes?: string;
  invoiceId?: string;
  completedAt?: string;
  paymentLink?: string;
  paymentId?: string; // Standard Upayments track ID for whole order
  splitPayments?: {
    id: string; // Random short ID
    name: string; // Contributor's name
    amount: number; // Their share
    paymentId?: string; // UPayments ID for this specific split
    paymentLink?: string; // UPayments Link for this share
    status: 'pending' | 'paid' | 'failed';
    date: string;
  }[];
}

export interface Region {
  id: string;
  name: string;
  deliveryFee?: number;
  deliveryPrice?: number;
  finalPrice?: number;
  price?: number;
  cost?: number;
}

export interface Analytics {
  totalRevenue: number;
  orderCount: number;
  completedCount: number;
}
