import { OrderItem, OrderItemAddon } from "../types";

export function calculateItemAddons(item: OrderItem): OrderItemAddon[] {
  if (!item.product?.addons || !item.product.addons.length) return [];
  
  return item.product.addons.map((addon) => {
    let quantity = 0;
    if (addon.calculationType === 'per_item') {
      quantity = item.quantity;
    } else if (addon.calculationType === 'per_x_items') {
      const threshold = addon.xItemsThreshold || 1;
      quantity = Math.ceil(item.quantity / threshold);
    } else if (addon.calculationType === 'fixed') {
      quantity = 1; // 1 per order line
    }
    return {
      addonId: addon.id,
      name: addon.name,
      price: addon.price,
      cost: addon.cost,
      isHiddenPrice: addon.isHiddenPrice,
      quantity,
    };
  }).filter((a) => a.quantity > 0);
}

export function calculateItemTotalWithAddons(item: OrderItem): number {
  const addons = calculateItemAddons(item);
  const addonsPrice = addons.reduce((sum, a) => sum + (a.price * a.quantity), 0);
  return (item.price * item.quantity) + addonsPrice;
}

export function calculateItemBasePriceWithHiddenAddons(item: OrderItem): number {
  const addons = calculateItemAddons(item);
  // Addons where isHiddenPrice is true are dynamically folded into the unit price
  const hiddenAddonsPrice = addons
    .filter(a => a.isHiddenPrice)
    .reduce((sum, a) => sum + (a.price * a.quantity), 0);
    
  // Find per item price: (base price * qty + hidden addon price total) / qty
  if (item.quantity === 0) return item.price;
  return item.price + (hiddenAddonsPrice / item.quantity);
}

// Gives you the total price for an item, but as a formatted piece
export function getVisibleAddons(item: OrderItem): OrderItemAddon[] {
    return calculateItemAddons(item).filter(a => !a.isHiddenPrice);
}
