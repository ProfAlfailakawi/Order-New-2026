/**
 * Unit tests for the price-integrity invariants of the AI order service.
 * Run: npx tsx scripts/ai-order-service.test.ts
 *
 * These cover the security-critical rule: the model's prices/ids are NEVER
 * trusted — prices come from the catalog and unknown ids are dropped.
 */
import assert from "node:assert";
import { toCatalog, assembleSuggestion } from "../src/lib/aiOrderService.ts";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const catalog = toCatalog([
  { id: "P1", name: "مجبوس دجاج", category: "أطباق رئيسية", price: 3.5 },
  { id: "P2", name: "شوربة عدس", category: "شوربات", price: 1.0 },
  { id: "P3", name: "لقيمات", category: "تحلية", price: 1.25 },
]);

console.log("AI order service — price integrity");

test("recomputes prices from catalog, ignoring model-supplied prices", () => {
  const out = assembleSuggestion(
    {
      items: [
        { productId: "P1", quantity: 2, reason: "r" },
        // model claims price via extra fields — must be ignored
        { productId: "P2", quantity: 1 } as any,
      ],
      message: "m",
    },
    catalog,
  );
  assert.strictEqual(out.items.length, 2);
  assert.strictEqual(out.items[0].unitPrice, 3.5);
  assert.strictEqual(out.items[0].lineTotal, 7.0);
  assert.strictEqual(out.subtotal, 8.0);
  assert.strictEqual(out.needsConfirmation, true);
});

test("drops hallucinated / unknown product ids", () => {
  const out = assembleSuggestion(
    { items: [{ productId: "GHOST", quantity: 5 }, { productId: "P3", quantity: 1 }] },
    catalog,
  );
  assert.strictEqual(out.items.length, 1);
  assert.strictEqual(out.items[0].productId, "P3");
});

test("clamps quantities to a sane range", () => {
  const out = assembleSuggestion(
    { items: [{ productId: "P1", quantity: 9999 }, { productId: "P2", quantity: 0 }] },
    catalog,
  );
  assert.strictEqual(out.items[0].quantity, 30); // upper clamp
  assert.strictEqual(out.items[1].quantity, 1); // lower clamp
});

test("withinBudget reflects recomputed subtotal, not model claim", () => {
  const over = assembleSuggestion({ items: [{ productId: "P1", quantity: 3 }] }, catalog, 5);
  assert.strictEqual(over.subtotal, 10.5);
  assert.strictEqual(over.withinBudget, false);

  const under = assembleSuggestion({ items: [{ productId: "P2", quantity: 2 }] }, catalog, 5);
  assert.strictEqual(under.subtotal, 2.0);
  assert.strictEqual(under.withinBudget, true);
});

test("no budget → always withinBudget true", () => {
  const out = assembleSuggestion({ items: [{ productId: "P1", quantity: 10 }] }, catalog);
  assert.strictEqual(out.withinBudget, true);
});

test("toCatalog filters entries without id or name", () => {
  const c = toCatalog([
    { id: "", name: "x", price: 1 },
    { id: "A", name: "", price: 1 },
    { id: "B", name: "ok", price: 2 },
  ]);
  assert.strictEqual(c.length, 1);
  assert.strictEqual(c[0].id, "B");
});

console.log(`\n${passed} tests passed ✅`);
