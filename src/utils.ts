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
