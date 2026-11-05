import { describe, expect, it } from 'vitest';
import {
  calculateItemAddons,
  calculateItemTotalWithAddons,
  getAddonMaximumQuantity,
  getAddonMinimumQuantity,
  getQuantityRuleLimits,
  isAddonRequired,
  isCoverageRangeAddon,
  normalizeAddons,
} from '../utils/priceCalculation';

// Characterization tests: they pin the pricing behaviour as it stands today so
// that a later refactor cannot silently change what a customer is charged.

const item = (over: Record<string, unknown> = {}): any => ({
  id: 'p1',
  name: 'منتج',
  price: 10,
  quantity: 1,
  product: { addons: [] },
  ...over,
});

describe('normalizeAddons', () => {
  it('returns an empty list for empty or unusable input', () => {
    expect(normalizeAddons(undefined)).toEqual([]);
    expect(normalizeAddons(null)).toEqual([]);
    expect(normalizeAddons('not json')).toEqual([]);
    expect(normalizeAddons(42)).toEqual([]);
  });

  it('drops falsy entries from arrays', () => {
    expect(normalizeAddons([{ id: 'a' }, null, undefined, { id: 'b' }])).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('parses JSON strings', () => {
    expect(normalizeAddons('[{"id":"a"}]')).toEqual([{ id: 'a' }]);
  });

  it('unwraps the known container keys', () => {
    expect(normalizeAddons({ addons: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
    expect(normalizeAddons({ items: [{ id: 'b' }] })).toEqual([{ id: 'b' }]);
  });

  it('turns an id-keyed object into a list and uses the key as the id fallback', () => {
    expect(normalizeAddons({ x: { name: 'X' }, y: { id: 'why', name: 'Y' }, z: 5 })).toEqual([
      { id: 'x', name: 'X' },
      { id: 'why', name: 'Y' },
    ]);
  });
});

describe('addon quantity limits', () => {
  it('treats coverage-style addons as coverage ranges', () => {
    expect(isCoverageRangeAddon({ calculationType: 'coverage' })).toBe(true);
    expect(isCoverageRangeAddon({ calculationType: 'per_x_items', perXMode: 'coverage_range' })).toBe(true);
    expect(isCoverageRangeAddon({ calculationType: 'per_x_items' })).toBe(false);
    expect(isCoverageRangeAddon(null)).toBe(false);
  });

  it('without a rule, applies plain min/max (max defaults to 999)', () => {
    expect(getQuantityRuleLimits({}, 3)).toMatchObject({ available: true, min: 0, max: 999 });
    expect(getQuantityRuleLimits({ isRequired: true }, 3)).toMatchObject({ min: 1 });
    expect(getQuantityRuleLimits({ minQuantity: 2, maxQuantity: 5 }, 3)).toMatchObject({ min: 2, max: 5 });
  });

  it('marks the addon unavailable below the rule minimum product quantity', () => {
    const r = getQuantityRuleLimits({ quantityRule: { enabled: true, minProductQty: 3, maxProductQtyPerAddon: 2 } }, 2);
    expect(r).toMatchObject({ available: false, min: 0, max: 0, suggested: 0, minProductQty: 3 });
    expect(r.message).toContain('3');
  });

  it('suggests one addon per N products when the rule is enabled', () => {
    const r = getQuantityRuleLimits({ quantityRule: { enabled: true, mode: 'required', minProductQty: 1, maxProductQtyPerAddon: 4 } }, 9);
    expect(r).toMatchObject({ available: true, suggested: 3, min: 3 });
  });

  it('exposes the helper accessors consistently', () => {
    expect(isAddonRequired(undefined)).toBe(false);
    expect(isAddonRequired({ isRequired: true })).toBe(true);
    expect(isAddonRequired({ minQuantity: 1 })).toBe(true);
    expect(isAddonRequired({ quantityRule: { mode: 'required' } })).toBe(true);
    expect(getAddonMinimumQuantity({ isRequired: true })).toBe(1);
    expect(getAddonMinimumQuantity({ minQuantity: 3 })).toBe(3);
    expect(getAddonMinimumQuantity(null)).toBe(0);
    expect(getAddonMaximumQuantity(null)).toBe(999);
    expect(getAddonMaximumQuantity({ minQuantity: 4, maxQuantity: 2 })).toBe(4);
    expect(getAddonMaximumQuantity({ maxQuantity: 'x' })).toBe(999);
  });
});

describe('calculateItemAddons', () => {
  it('returns nothing when the product has no addons', () => {
    expect(calculateItemAddons(item())).toEqual([]);
  });

  it('ignores optional addons the customer did not select', () => {
    const it = item({ product: { addons: [{ id: 'gift', name: 'هدية', price: 2 }] } });
    expect(calculateItemAddons(it)).toEqual([]);
  });

  it('includes an addon once it is selected, with quantity following the product quantity', () => {
    const it = item({ quantity: 3, selectedAddonsIds: ['gift'], product: { addons: [{ id: 'gift', name: 'هدية', price: 2 }] } });
    const [a] = calculateItemAddons(it);
    expect(a).toMatchObject({ addonId: 'gift', quantity: 3, payableQuantity: 3, price: 2 });
  });

  it('always includes required addons at their minimum', () => {
    const it = item({ product: { addons: [{ id: 'box', name: 'علبة', price: 1, isRequired: true }] } });
    expect(calculateItemAddons(it)[0]).toMatchObject({ addonId: 'box', quantity: 1 });
  });

  it('prefers addons already captured on the item (historic orders) over the product definition', () => {
    const captured = [{ addonId: 'old', name: 'قديم', price: 5, quantity: 2 }];
    const it = item({ addons: captured, product: { addons: [{ id: 'new', name: 'جديد', price: 1, isRequired: true }] } });
    expect(calculateItemAddons(it)).toEqual(captured);
  });

  it('charges only the quantity above the free allowance', () => {
    const it = item({ quantity: 4, selectedAddonsIds: ['g'], product: { addons: [{ id: 'g', name: 'g', price: 3, freeQuantity: 1 }] } });
    expect(calculateItemAddons(it)[0]).toMatchObject({ quantity: 4, payableQuantity: 3 });
  });

  it('does not force a required addon to zero when the customer asks for zero', () => {
    const it = item({ addonQuantities: { box: 0 }, product: { addons: [{ id: 'box', name: 'علبة', price: 1, isRequired: true }] } });
    expect(calculateItemAddons(it)[0].quantity).toBe(1);
  });

  it('lets an optional addon be removed by quantity zero', () => {
    const it = item({ selectedAddonsIds: ['g'], addonQuantities: { g: 0 }, product: { addons: [{ id: 'g', name: 'g', price: 3 }] } });
    expect(calculateItemAddons(it)).toEqual([]);
  });

  it('computes per_x_items with floor by default and ceil on request', () => {
    const base = { id: 'p', name: 'p', price: 1, calculationType: 'per_x_items', xItemsThreshold: 3 };
    const floor = item({ quantity: 7, selectedAddonsIds: ['p'], product: { addons: [base] } });
    const ceil = item({ quantity: 7, selectedAddonsIds: ['p'], product: { addons: [{ ...base, roundingMode: 'ceil' }] } });
    expect(calculateItemAddons(floor)[0].quantity).toBe(2);
    expect(calculateItemAddons(ceil)[0].quantity).toBe(3);
  });
});

describe('calculateItemTotalWithAddons', () => {
  it('is price × quantity when there are no addons or extras', () => {
    expect(calculateItemTotalWithAddons(item({ price: 12.5, quantity: 3 }))).toBe(37.5);
  });

  it('adds payable addon cost and ad-hoc extras multiplied by quantity', () => {
    const it = item({
      price: 10,
      quantity: 2,
      selectedAddonsIds: ['g'],
      selectedExtras: [{ price: 1 }, { price: 0.5 }],
      product: { addons: [{ id: 'g', name: 'g', price: 2, freeQuantity: 1 }] },
    });
    // 10*2 + addon (2 qty, 1 free -> 1 payable * 2) + extras (1.5 * 2)
    expect(calculateItemTotalWithAddons(it)).toBe(20 + 2 + 3);
  });
});
