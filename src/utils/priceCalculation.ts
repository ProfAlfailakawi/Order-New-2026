import { OrderItem, OrderItemAddon } from "../types";

export function calculateItemAddons(item: OrderItem): OrderItemAddon[] {
  // If static addons are already captured locally (like in a historic order), prioritize them
  if (item.addons && item.addons.length > 0) return item.addons;

  if (!item.product?.addons || !item.product.addons.length) return [];
  
  return item.product.addons
    .filter(addon => 
      (addon.minQuantity !== undefined && addon.minQuantity > 0) || 
      (item.selectedAddonsIds && item.selectedAddonsIds.includes(addon.id))
    )
    .map((addon) => {
      let quantity = 0;
      let effectivePrice = addon.price;
      
      const customQty = item.addonQuantities && item.addonQuantities[addon.id] !== undefined ? item.addonQuantities[addon.id] : null;

      if (addon.calculationType === 'fixed') {
        quantity = customQty !== null ? customQty : 1; // 1 per order line
      } else if (addon.calculationType === 'per_x_items') {
        const threshold = addon.xItemsThreshold || 1;
        quantity = Math.ceil(item.quantity / threshold) * (customQty !== null ? customQty : 1);
      } else {
        // per_item or undefined
        quantity = item.quantity * (customQty !== null ? customQty : 1);
      }

      if (customQty === null) {
        if (addon.minQuantity !== undefined && addon.minQuantity !== null) quantity = Math.max(addon.minQuantity, quantity);
        if (addon.maxQuantity !== undefined && addon.maxQuantity !== null) quantity = Math.min(addon.maxQuantity, quantity);
      }

      let payableQuantity = quantity;
      if (addon.freeQuantity !== undefined && addon.freeQuantity > 0) {
        payableQuantity = Math.max(0, quantity - addon.freeQuantity);
      }

      return {
        addonId: addon.id,
        name: addon.name,
        price: addon.price, // Keep original price, calculate total based on payableQuantity
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
