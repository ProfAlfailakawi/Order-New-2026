import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const normalizeDigits = (value: string): string => {
  return value
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
};

export const normalizePhone = (value: string): string => {
  let digits = normalizeDigits(value).replace(/\D/g, "");
  
  if (digits.startsWith("965") && digits.length >= 3) {
      digits = digits.slice(3);
  } else if ((value.startsWith("00965") || value.startsWith("+965")) && digits.startsWith("00965")) {
      digits = digits.slice(5);
  }
  
  // Remove leading zeros again just in case
  digits = digits.replace(/^0+/, "");
  
  // Return up to 8 digits
  return digits.slice(0, 8);
};

export const isValidPhone = (value: string): boolean => {
  return normalizePhone(value).length === 8;
};

export interface SaduAvatarData {
  emoji: string;
  label: string;
  gradient: string;
  hash: number;
}

export const getSaduAvatar = (name: string, phone?: string): SaduAvatarData => {
  const seed = String(name || phone || "").trim();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const kuwaitiEmojis = [
    { emoji: "🐪", label: "ذيب الربع" },
    { emoji: "⛵", label: "البوم" },
    { emoji: "☕", label: "دلة الكرم" },
    { emoji: "📿", label: "المسباح" },
    { emoji: "🛖", label: "بيت الشعر" },
    { emoji: "🌴", label: "النخلة" },
    { emoji: "🦅", label: "الصقر" },
    { emoji: "🏺", label: "الغراف" },
    { emoji: "🍲", label: "المجبوس" },
    { emoji: "👳", label: "المعزب" }
  ];

  const item = kuwaitiEmojis[hash % kuwaitiEmojis.length];

  const saduGradients = [
    "from-amber-600 via-red-700 to-amber-900 border-amber-500/30 text-amber-100",
    "from-slate-800 via-red-950 to-stone-900 border-red-800/20 text-red-100",
    "from-yellow-600 via-amber-700 to-red-800 border-yellow-500/30 text-yellow-100",
    "from-emerald-850 via-teal-900 to-emerald-950 border-teal-600/30 text-teal-100",
    "from-red-600 via-orange-600 to-amber-800 border-red-400/30 text-orange-100",
    "from-violet-900 via-indigo-950 to-stone-950 border-indigo-800/30 text-indigo-100",
  ];

  const gradient = saduGradients[hash % saduGradients.length];

  return {
    emoji: item.emoji,
    label: item.label,
    gradient,
    hash
  };
};

import { calculateItemTotalWithAddons } from "./utils/priceCalculation";

export const calculateItemsTotal = (items: any[]) => {
    return (items || []).reduce((sum: number, i: any) => {
      return sum + calculateItemTotalWithAddons(i);
    }, 0);
};

export const getDisplayTotal = (order: any) => {
    if (order.total !== undefined && order.total !== null) {
       return Number(order.total);
    }
    const itemsTotal = calculateItemsTotal(order.items || []);
    const discount = Number(order.discountAmount || order.discount || 0);
    const deliveryFee = (order.deliveryType === 'free' || order.isFreeDelivery) ? 0 : Number(order.deliveryFee || 0);
    return Math.max(0, itemsTotal - discount + deliveryFee);
};

export {
  formatTime12h,
  ARABIC_DAYS_MAP,
  DAYS_ORDER,
  formatOpeningHoursSummary,
  checkStoreStatus,
  getConfiguredStoreStatus,
} from "./lib/storeAvailability";

export const formatKuwaitiDate = (dateVal: any): { date: string; time: string; full: string } => {
  if (!dateVal) return { date: "", time: "", full: "" };
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return { date: "", time: "", full: "" };

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuwait",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(d);

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const dateStr = `${getPart("day")}/${getPart("month")}/${getPart("year")}`;
  const timeStr = `${getPart("hour")}.${getPart("minute")}${getPart("dayPeriod").toUpperCase()}`;

  return {
    date: dateStr,
    time: timeStr,
    full: `${dateStr} ${timeStr}`
  };
};
