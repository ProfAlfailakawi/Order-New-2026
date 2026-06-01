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

export function checkStoreStatus(storeStatus: any) {
  if (!storeStatus) return { isOpen: true, message: "" };

  if (storeStatus.manualClose) {
    return { 
      isOpen: false, 
      message: storeStatus.closeMessage || "المعذرة، المتجر مسكر الحين." 
    };
  }

  if (storeStatus.openingHours) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const currentDay = days[now.getDay()]; 
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

    const todaySchedule = storeStatus.openingHours[currentDay];

    if (todaySchedule && todaySchedule.enabled === false) {
      return { 
        isOpen: false, 
        message: storeStatus.closeMessage || "المعذرة، المتجر مسكر اليوم حسب الجدول." 
      };
    }

    if (todaySchedule && todaySchedule.enabled) {
      const [openHour, openMin] = todaySchedule.open.split(':').map(Number);
      const [closeHour, closeMin] = todaySchedule.close.split(':').map(Number);
      
      const openTimeInMinutes = (openHour * 60) + openMin;
      let closeTimeInMinutes = (closeHour * 60) + closeMin;
      
      if (closeTimeInMinutes < openTimeInMinutes) {
        closeTimeInMinutes += (24 * 60); 
      }

      let currentCompareTime = currentTimeInMinutes;
      if (currentCompareTime < openTimeInMinutes && currentCompareTime < (closeTimeInMinutes - (24 * 60))) {
         currentCompareTime += (24 * 60);
      }

      const isOpenNow = currentCompareTime >= openTimeInMinutes && currentCompareTime <= closeTimeInMinutes;

      if (!isOpenNow) {
         return { 
           isOpen: false, 
           message: storeStatus.closeMessage || `المعذرة، المتجر يفتح يومياً من ${todaySchedule.open} إلى ${todaySchedule.close}.`
         };
      }
    }
  }

  return { isOpen: true, message: "" };
}

export const formatKuwaitiDate = (dateVal: any): { date: string; time: string; full: string } => {
  if (!dateVal) return { date: "", time: "", full: "" };
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return { date: "", time: "", full: "" };

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? "0" + minutes : minutes;

  const dateStr = `${day}/${month}/${year}`;
  const timeStr = `${hours}.${minutesStr} ${ampm}`;

  return {
    date: dateStr,
    time: timeStr,
    full: `${dateStr} ${timeStr}`
  };
};
