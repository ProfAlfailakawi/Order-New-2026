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

export const formatTime12h = (timeStr?: string): string => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return timeStr || "";
  const [hStr, mStr] = timeStr.split(":");
  let hour = parseInt(hStr, 10);
  const min = mStr || "00";
  if (isNaN(hour)) return timeStr;
  const period = hour >= 12 ? "م" : "ص";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${min} ${period}`;
};

export const ARABIC_DAYS_MAP: Record<string, string> = {
  sunday: "الأحد",
  monday: "الإثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
  saturday: "السبت"
};

export const DAYS_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function formatOpeningHoursSummary(storeStatus: any): {
  summaryText: string;
  todayText: string;
  weeklyList: Array<{ dayKey: string; dayName: string; enabled: boolean; text: string }>;
} {
  const openingHours = storeStatus?.openingHours || storeStatus?.workingHours || storeStatus?.hours;
  if (!openingHours || typeof openingHours !== "object") {
    return {
      summaryText: "أوقات العمل المعتمدة: يومياً من 12:00 م إلى 11:30 م",
      todayText: "من 12:00 م إلى 11:30 م",
      weeklyList: DAYS_ORDER.map(d => ({
        dayKey: d,
        dayName: ARABIC_DAYS_MAP[d] || d,
        enabled: true,
        text: "12:00 م - 11:30 م"
      }))
    };
  }

  const now = new Date();
  const currentDayKey = DAYS_ORDER[now.getDay()];

  const weeklyList = DAYS_ORDER.map(d => {
    const sched = openingHours[d];
    const dayName = ARABIC_DAYS_MAP[d] || d;
    if (!sched || sched.enabled === false) {
      return { dayKey: d, dayName, enabled: false, text: "عطلة / مغلق" };
    }
    const openFmt = formatTime12h(sched.open || "12:00");
    const closeFmt = formatTime12h(sched.close || "23:30");
    return { dayKey: d, dayName, enabled: true, text: `من ${openFmt} إلى ${closeFmt}` };
  });

  const todaySched = openingHours[currentDayKey];
  const todayText = (!todaySched || todaySched.enabled === false)
    ? "مغلق اليوم"
    : `من ${formatTime12h(todaySched.open || "12:00")} إلى ${formatTime12h(todaySched.close || "23:30")}`;

  const enabledDays = weeklyList.filter(w => w.enabled);
  let summaryText = "";
  if (enabledDays.length === 7) {
    const firstText = enabledDays[0].text;
    const allSame = enabledDays.every(e => e.text === firstText);
    if (allSame) {
      summaryText = `أوقات العمل: يومياً ${firstText}`;
    } else {
      summaryText = `أوقات العمل اليوم (${ARABIC_DAYS_MAP[currentDayKey]}): ${todayText}`;
    }
  } else if (enabledDays.length > 0) {
    summaryText = `أوقات العمل اليوم (${ARABIC_DAYS_MAP[currentDayKey]}): ${todayText}`;
  } else {
    summaryText = "المتجر مغلق حالياً حسب الجدول المحدد.";
  }

  return { summaryText, todayText, weeklyList };
}

export function checkStoreStatus(storeStatus: any) {
  if (!storeStatus) {
    return { isOpen: true, message: "", formattedHours: "", weeklyList: [] };
  }

  const { summaryText, todayText, weeklyList } = formatOpeningHoursSummary(storeStatus);

  if (storeStatus.manualClose) {
    return { 
      isOpen: false, 
      message: storeStatus.closeMessage || "المعذرة، المتجر مسكر الحين بطلب من الإدارة.",
      formattedHours: summaryText,
      todayText,
      weeklyList,
      storeStatus
    };
  }

  const openingHours = storeStatus.openingHours || storeStatus.workingHours || storeStatus.hours;

  if (openingHours && typeof openingHours === "object" && Object.keys(openingHours).length > 0) {
    const now = new Date();
    const currentDayKey = DAYS_ORDER[now.getDay()]; 
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

    const todaySchedule = openingHours[currentDayKey];

    if (todaySchedule && todaySchedule.enabled === false) {
      return { 
        isOpen: false, 
        message: storeStatus.closeMessage || `المعذرة، المطعم مغلق اليوم (${ARABIC_DAYS_MAP[currentDayKey]}) حسب جدول أوقات العمل.`,
        formattedHours: summaryText,
        todayText,
        weeklyList,
        storeStatus
      };
    }

    if (todaySchedule && (todaySchedule.enabled === true || todaySchedule.open)) {
      const [openHour, openMin] = (todaySchedule.open || "12:00").split(':').map(Number);
      const [closeHour, closeMin] = (todaySchedule.close || "23:30").split(':').map(Number);
      
      const openTimeInMinutes = (openHour * 60) + (isNaN(openMin) ? 0 : openMin);
      let closeTimeInMinutes = (closeHour * 60) + (isNaN(closeMin) ? 0 : closeMin);
      
      if (closeTimeInMinutes < openTimeInMinutes) {
        closeTimeInMinutes += (24 * 60); 
      }

      let currentCompareTime = currentTimeInMinutes;
      if (currentCompareTime < openTimeInMinutes && currentCompareTime < (closeTimeInMinutes - (24 * 60))) {
         currentCompareTime += (24 * 60);
      }

      const isOpenNow = currentCompareTime >= openTimeInMinutes && currentCompareTime <= closeTimeInMinutes;

      if (!isOpenNow) {
         const openFmt = formatTime12h(todaySchedule.open || "12:00");
         const closeFmt = formatTime12h(todaySchedule.close || "23:30");
         return { 
           isOpen: false, 
           message: storeStatus.closeMessage || `المطعم مغلق حالياً. أوقات العمل اليوم (${ARABIC_DAYS_MAP[currentDayKey]}): من ${openFmt} إلى ${closeFmt}.`,
           formattedHours: summaryText,
           todayText,
           weeklyList,
           storeStatus
         };
      }
    }
  }

  return { isOpen: true, message: "", formattedHours: summaryText, todayText, weeklyList, storeStatus };
}

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
