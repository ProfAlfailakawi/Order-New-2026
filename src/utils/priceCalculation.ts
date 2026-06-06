import { OrderItem, OrderItemAddon } from "../types";

export function normalizeAddons(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    try {
      return normalizeAddons(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (typeof raw === "object") {
    const candidate = raw.addons ?? raw.addOns ?? raw.items ?? raw.list ?? raw.options ?? raw.values;
    if (candidate && candidate !== raw) return normalizeAddons(candidate);
    return Object.entries(raw)
      .map(([key, value]: any) => {
        if (!value || typeof value !== "object") return null;
        return { id: value.id ?? key, ...value };
      })
      .filter(Boolean);
  }
  return [];
}

const getAddonKey = (addon: any) =>
  String(addon?.id || addon?.addonId || addon?.name || "");

export const isCoverageRangeAddon = (addon: any): boolean => addon?.calculationType === 'coverage' || (addon?.calculationType === 'per_x_items' && addon?.perXMode === 'coverage_range');

const getCoverageUnits = (addon: any, productQty: number): number => {
  const rule = addon?.quantityRule || {};
  const minProductQty = Math.max(1, Number(rule.minProductQty || addon?.minProductQty || 1));
  const coverToQty = Math.max(minProductQty, Number(rule.maxProductQtyPerAddon || addon?.maxProductQtyPerAddon || addon?.xItemsThreshold || minProductQty));
  const qty = Math.max(0, Number(productQty || 0));
  if (qty < minProductQty) return 0;
  const span = Math.max(1, coverToQty - minProductQty + 1);
  return Math.max(1, Math.ceil((qty - minProductQty + 1) / span));
};

export function getQuantityRuleLimits(addon: any, productQty: number) {
  const rule = addon?.quantityRule || {};
  const baseMin = addon?.isRequired ? Math.max(1, Number(addon?.minQuantity || 1)) : Number(addon?.minQuantity || 0);
  const baseMax = addon?.maxQuantity !== undefined && addon?.maxQuantity !== null && addon?.maxQuantity !== '' ? Number(addon.maxQuantity) : 999;

  if (!rule?.enabled) {
    return { available: true, min: baseMin, max: Math.max(baseMin, baseMax), suggested: Math.max(baseMin, addon?.calculationType === 'fixed' ? 1 : baseMin), minProductQty: 1, message: '' };
  }

  const minProductQty = Math.max(1, Number(rule.minProductQty || 1));
  const perAddon = Math.max(1, Number(rule.maxProductQtyPerAddon || 1));

  if (Number(productQty || 0) < minProductQty) {
    return { available: false, min: 0, max: 0, suggested: 0, minProductQty, message: `متاحة عند طلب ${minProductQty} أو أكثر` };
  }

  const isCoverage = isCoverageRangeAddon(addon);
  const suggestedRaw = isCoverage
    ? getCoverageUnits(addon, Number(productQty || 0))
    : Math.max(1, Math.ceil(Number(productQty || 0) / perAddon));
  const min = isCoverage
    ? suggestedRaw
    : (rule.mode === 'required' ? Math.max(baseMin, suggestedRaw) : baseMin);
  const max = isCoverage ? Math.max(suggestedRaw, baseMax) : Math.max(min, baseMax);
  const suggested = Math.min(max, Math.max(min, suggestedRaw));

  return { available: true, min, max, suggested, minProductQty, message: isCoverage ? `الحد الأدنى ${suggestedRaw}، ويمكن زيادة الكمية اختيارياً` : `كل إضافة تغطي حتى ${perAddon}` };
}

export function calculateItemAddons(item: OrderItem): OrderItemAddon[] {
  // If static addons are already captured locally (like in a historic order), prioritize them
  const capturedAddons = normalizeAddons((item as any).addons);
  if (capturedAddons.length > 0) return capturedAddons as OrderItemAddon[];

  const productAddons = normalizeAddons((item.product as any)?.addons);
  if (!productAddons.length) return [];
  
  return productAddons
    .filter((addon: any) => {
      const limits = getQuantityRuleLimits(addon, item.quantity || 1);
      if (!limits.available) return false;
      return (
        (addon.minQuantity !== undefined && Number(addon.minQuantity) > 0) ||
        addon.isRequired ||
        addon.quantityRule?.mode === 'auto' ||
        addon.quantityRule?.mode === 'required' ||
        (item.selectedAddonsIds && item.selectedAddonsIds.includes(getAddonKey(addon)))
      );
    })
    .map((addon: any) => {
      const limits = getQuantityRuleLimits(addon, item.quantity || 1);
      let quantity = 0;
      const addonKey = getAddonKey(addon);
      const customQty = item.addonQuantities && item.addonQuantities[addonKey] !== undefined ? Number(item.addonQuantities[addonKey]) : null;

      const forcedAddon = addon.isRequired || addon.quantityRule?.mode === 'auto' || addon.quantityRule?.mode === 'required';
      if (customQty !== null) {
        if (customQty <= 0 && !forcedAddon) {
          quantity = 0;
        } else {
          quantity = customQty;
        }
      } else if (addon.quantityRule?.mode === 'auto' || addon.quantityRule?.mode === 'required') {
        quantity = limits.suggested;
      } else if (addon.calculationType === 'fixed') {
        quantity = 1;
      } else if (isCoverageRangeAddon(addon)) {
        quantity = limits.suggested;
      } else if (addon.calculationType === 'per_x_items') {
        const threshold = addon.xItemsThreshold || 1;
        const rounder = addon.roundingMode === 'ceil' ? Math.ceil : Math.floor;
        quantity = rounder((item.quantity || 1) / threshold);
      } else {
        quantity = item.quantity;
      }

      if (quantity <= 0 && !forcedAddon) {
        quantity = 0;
      } else {
        quantity = Math.max(limits.min, Math.min(limits.max, quantity));
      }

      let payableQuantity = quantity;
      if (addon.freeQuantity !== undefined && addon.freeQuantity > 0) {
        payableQuantity = Math.max(0, quantity - addon.freeQuantity);
      }

      return {
        addonId: addonKey,
        name: addon.name,
        price: addon.price,
        cost: addon.cost,
        isHiddenPrice: addon.isHiddenPrice,
        quantity,
        payableQuantity,
        freeQuantity: addon.freeQuantity,
      };
    }).filter((a) => a.quantity > 0);
}

export function calculateItemTotalWithAddons(item: OrderItem): number {
  const addons = calculateItemAddons(item);
  const addonsPrice = addons.reduce((sum, a) => sum + (a.price * (a.payableQuantity !== undefined ? a.payableQuantity : (a.quantity || 0))), 0);
  
  // Also add selectedExtras which are ad-hoc extras outside of the formal addon system
  const extrasPrice = (item.selectedExtras || []).reduce((sum, e) => sum + (e.price || 0), 0) * item.quantity;

  return (item.price * item.quantity) + addonsPrice + extrasPrice;
}

export function calculateItemBasePriceWithHiddenAddons(item: OrderItem): number {
  return item.price;
}

// Gives you the total price for an item, but as a formatted piece
export function getVisibleAddons(item: OrderItem): OrderItemAddon[] {
    return calculateItemAddons(item);
}

// Compatibility helper used by product/addon UI components.
// Required addons are selected automatically and cannot be fully removed.
export function isAddonRequired(addon: any): boolean {
  if (!addon) return false;
  return Boolean(addon.isRequired || Number(addon.minQuantity || 0) > 0 || addon?.quantityRule?.mode === 'required');
}

export function getAddonMinimumQuantity(addon: any): number {
  if (!addon) return 0;
  return isAddonRequired(addon) ? Math.max(1, Number(addon.minQuantity || 1)) : Math.max(0, Number(addon.minQuantity || 0));
}

export function getAddonMaximumQuantity(addon: any): number {
  if (!addon) return 999;
  const min = getAddonMinimumQuantity(addon);
  const max = addon.maxQuantity !== undefined && addon.maxQuantity !== null && addon.maxQuantity !== '' ? Number(addon.maxQuantity) : 999;
  return Math.max(min, Number.isFinite(max) ? max : 999);
}
