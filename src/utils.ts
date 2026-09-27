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

  // Letter avatar: first letter of the name (no invented nicknames or emoji).
  const letter = Array.from(String(name || "").trim())[0] || (phone ? String(phone).replace(/\D/g, "").slice(-1) : "") || "•";

  return {
    emoji: letter,
    label: "",
    gradient: "from-[#e4efe8] to-[#e4efe8] border-[#0d3a22]/10 text-[#0d3a22] font-extrabold",
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
