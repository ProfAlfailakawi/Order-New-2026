const INLINE_PRODUCT_IMAGE_FIELDS = ["imageUrl", "image", "photo"] as const;

type InlineProductImageField = (typeof INLINE_PRODUCT_IMAGE_FIELDS)[number];

type CustomerMenuImageReference = {
  productIndex: number;
  field: InlineProductImageField;
  assetIndex: number;
};

type CustomerMenuAssetPack = {
  formatVersion: 1;
  assets: string[];
  references: CustomerMenuImageReference[];
};

// Product images are currently stored inline and several menu products reuse the
// exact same image. This representation removes only the network duplication.
// The original product objects are never mutated.
export function packCustomerMenuProducts(sourceProducts: any[]) {
  const assets: string[] = [];
  const references: CustomerMenuImageReference[] = [];
  const assetIndexes = new Map<string, number>();
  let originalInlineChars = 0;

  const products = (Array.isArray(sourceProducts) ? sourceProducts : []).map(
    (sourceProduct: any, productIndex: number) => {
      if (!sourceProduct || typeof sourceProduct !== "object") {
        return sourceProduct;
      }
      const product = { ...sourceProduct };
      for (const field of INLINE_PRODUCT_IMAGE_FIELDS) {
        const value = product[field];
        if (
          typeof value !== "string" ||
          !value.startsWith("data:") ||
          value.length < 256
        ) {
          continue;
        }

        originalInlineChars += value.length;
        let assetIndex = assetIndexes.get(value);
        if (assetIndex === undefined) {
          assetIndex = assets.length;
          assets.push(value);
          assetIndexes.set(value, assetIndex);
        }
        product[field] = "";
        references.push({ productIndex, field, assetIndex });
      }
      return product;
    },
  );

  const uniqueInlineChars = assets.reduce(
    (total, value) => total + value.length,
    0,
  );
  return {
    products,
    assetPack:
      references.length > 0
        ? ({
            formatVersion: 1,
            assets,
            references,
          } satisfies CustomerMenuAssetPack)
        : null,
    stats: {
      uniqueAssets: assets.length,
      references: references.length,
      savedInlineChars: Math.max(0, originalInlineChars - uniqueInlineChars),
    },
  };
}

const ALLOWED_IMAGE_FIELDS = new Set<string>(INLINE_PRODUCT_IMAGE_FIELDS);

// Fail closed: an incomplete asset pack is rejected before any product reaches
// React state or the customer cache.
export function restoreCustomerMenuProducts(payload: any): any[] {
  const products = payload?.products;
  const pack = payload?.assetPack;
  if (!Array.isArray(products)) {
    throw new Error("INVALID_CUSTOMER_MENU_PRODUCTS");
  }
  if (!pack) return products;
  if (
    pack.formatVersion !== 1 ||
    !Array.isArray(pack.assets) ||
    !Array.isArray(pack.references)
  ) {
    throw new Error("INVALID_CUSTOMER_MENU_ASSET_PACK");
  }

  const operations: Array<{
    product: Record<string, any>;
    field: string;
    value: string;
  }> = [];
  for (const reference of pack.references) {
    const productIndex = Number(reference?.productIndex);
    const assetIndex = Number(reference?.assetIndex);
    const field = String(reference?.field || "");
    const product = products[productIndex];
    const value = pack.assets[assetIndex];
    if (
      !Number.isInteger(productIndex) ||
      productIndex < 0 ||
      !Number.isInteger(assetIndex) ||
      assetIndex < 0 ||
      !ALLOWED_IMAGE_FIELDS.has(field) ||
      !product ||
      typeof product !== "object" ||
      Array.isArray(product) ||
      typeof value !== "string" ||
      !value.startsWith("data:")
    ) {
      throw new Error("INVALID_CUSTOMER_MENU_ASSET_REFERENCE");
    }
    operations.push({ product, field, value });
  }

  operations.forEach(({ product, field, value }) => {
    product[field] = value;
  });
  return products;
}
