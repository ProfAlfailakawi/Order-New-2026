export interface ProductAddon {
  id: string;
  name: string;
  price: number;
  cost: number;
  calculationType: 'per_item' | 'per_x_items' | 'fixed';
  xItemsThreshold?: number;
  minQuantity?: number;
  maxQuantity?: number;
  freeQuantity?: number;
  isHiddenPrice: boolean;
  isRequired?: boolean;
  quantityRule?: {
    enabled?: boolean;
    minProductQty?: number;
    maxProductQtyPerAddon?: number;
    mode?: 'manual' | 'auto' | 'required';
  };
}


export interface Product {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  image: string;
  category: string;
  options: string[];
  extras: { name: string; price: number }[];
  addons?: ProductAddon[];
  preparationInstructions?: string;
  isMenuFeatured?: boolean;
  featuredRank?: number;
}

export interface OrderItemAddon {
  addonId: string;
  name: string;
  price: number;
  cost: number;
  isHiddenPrice: boolean;
  quantity?: number; // Calculated quantity
  payableQuantity?: number;
  freeQuantity?: number;
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
  selectedAddonsIds?: string[];
  addonQuantities?: Record<string, number>;
  addons?: OrderItemAddon[];
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
  lat?: number;
  lng?: number;
  location?: { lat: number; lng: number; accuracy?: number; source?: string };
  mapProvider?: string;
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
  status: "جديد" | "بانتظار الدفع" | "قيد تجميع القطية" | "تم الدفع بنجاح" | "ملغي" | "فشل في عملية الدفع";
  createdAt: string;
  discountAmount?: number;
  promoCode?: string;
  splitType?: string;
  rouletteLoser?: string;
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
