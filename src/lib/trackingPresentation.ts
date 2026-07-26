const finiteNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstFiniteNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

export function getCanonicalOrderReference(order: any): string {
  const raw = [
    order?.invoiceId,
    order?.id,
    order?.displayId,
    order?.orderId,
    order?.invoiceNo,
    order?.linkedInvoiceId,
  ]
    .map((value) => String(value || "").trim().toUpperCase())
    .find(Boolean);

  if (!raw) return "";
  const withoutHash = raw.startsWith("#") ? raw.slice(1) : raw;
  return withoutHash.includes("-S-")
    ? withoutHash.split("-S-")[0]
    : withoutHash;
}

export function getCanonicalFinancialSummary(
  order: any,
  calculatedItemsTotal?: number,
): {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  grandTotal: number;
} {
  const isFreeDelivery =
    order?.deliveryType === "free" ||
    order?.isFreeDelivery === true ||
    finiteNumber(order?.deliveryFee) === 0;
  const deliveryFee = isFreeDelivery
    ? 0
    : Math.max(
        0,
        firstFiniteNumber(
          order?.deliveryFee,
          order?.deliveryInfo?.finalPrice,
        ) ?? 0,
      );
  const discountAmount = Math.max(
    0,
    firstFiniteNumber(
      order?.discountAmount,
      order?.discount,
      order?.promoDiscount,
    ) ?? 0,
  );
  const explicitGrandTotal = firstFiniteNumber(
    order?.totalAmount,
    order?.grandTotal,
    order?.finalTotal,
    order?.amountDue,
    order?.payableAmount,
    order?.total,
    order?.amount,
  );
  const explicitSubtotal = firstFiniteNumber(
    order?.subtotal,
    order?.itemsSubtotal,
    order?.subTotal,
  );
  const fallbackItemsTotal = finiteNumber(calculatedItemsTotal);
  const subtotal = Math.max(
    0,
    explicitSubtotal ??
      fallbackItemsTotal ??
      ((explicitGrandTotal ?? 0) + discountAmount - deliveryFee),
  );
  const grandTotal = Math.max(
    0,
    explicitGrandTotal ??
      subtotal + deliveryFee - discountAmount,
  );

  return {
    subtotal,
    discountAmount,
    deliveryFee,
    grandTotal,
  };
}
