import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const CUSTOMER_TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/i;

const PUBLIC_SETTINGS_KEYS = [
  "companyName",
  "companyLogo",
  "logo",
  "storeStatus",
  "isFreeDelivery",
  "freeDeliveryThreshold",
  "freeDeliveryLimit",
  "productCategories",
  "menuCategories",
  "loyaltyTiers",
  "loyaltyLevels",
  "loyaltySettings",
  "squadTiers",
  "squadLevels",
  "diwaniyaTiers",
  "diwaniyaLevels",
  "squadSettings",
  "squadGeofenceDistance",
  "diwaniyaGeofenceDistance",
  "geofenceDistance",
  "radarDistance",
  "radarGeofenceDistance",
] as const;

export type CustomerOrderAccess = "private" | "split" | "none";

export function normalizeCustomerPhone(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.startsWith("965") && digits.length > 8) return digits.slice(-8);
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

export function issueCustomerAccessToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashCustomerAccessToken(token) };
}

export function hashCustomerAccessToken(token: unknown): string {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function tokenMatchesHash(
  token: unknown,
  expectedHash: unknown,
): boolean {
  const cleanToken = String(token || "").trim();
  const cleanExpected = String(expectedHash || "").trim().toLowerCase();
  if (!cleanToken || !CUSTOMER_TOKEN_HASH_PATTERN.test(cleanExpected)) {
    return false;
  }

  const actual = Buffer.from(hashCustomerAccessToken(cleanToken), "hex");
  const expected = Buffer.from(cleanExpected, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getCustomerTokenFromHeaders(
  headers: Record<string, unknown> | undefined,
): string {
  const value =
    headers?.["x-alturath-customer-token"] ??
    headers?.["X-Alturath-Customer-Token"];
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

export function getTrackingTokenFromHeaders(
  headers: Record<string, unknown> | undefined,
): string {
  const value =
    headers?.["x-alturath-tracking-token"] ??
    headers?.["X-Alturath-Tracking-Token"];
  return Array.isArray(value)
    ? String(value[0] || "").trim()
    : String(value || "").trim();
}

function recordOwnerPhone(record: any): string {
  return normalizeCustomerPhone(
    record?.customerPhone ||
      record?.phone ||
      record?.address?.phone ||
      record?.deliveryInfo?.phone,
  );
}

function recordReferences(record: any): string[] {
  return [
    record?.id,
    record?.orderId,
    record?.invoiceId,
    record?.invoiceNo,
    record?.linkedInvoiceId,
  ]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);
}

function normalizeRequestedOrderId(value: unknown): string {
  let normalized = String(value || "").trim().toUpperCase();
  if (normalized.startsWith("#")) normalized = normalized.slice(1);
  if (normalized.includes("-S-")) normalized = normalized.split("-S-")[0];
  return normalized;
}

function toCustomerFacingOrderReference(reference: unknown): string {
  const normalized = normalizeRequestedOrderId(reference);
  const prefixMatch = normalized.match(/^(ORD|INV)[-\s#]*/i);
  if (!prefixMatch) return normalized;

  const compactSource = normalized
    .replace(/^(ORD|INV)[-\s#]*/i, "")
    .replace(/[^A-Z0-9]/g, "");
  const suffix = compactSource.slice(-4);
  return suffix
    ? `${prefixMatch[1].toUpperCase()}-${suffix}`
    : normalized;
}

export function isExactOrderReference(
  record: any,
  requestedOrderId: unknown,
): boolean {
  const requested = normalizeRequestedOrderId(requestedOrderId);
  if (!requested) return false;

  const references = recordReferences(record);
  if (references.includes(requested)) return true;

  // The customer-facing reference is intentionally short (for example
  // ORD-1WW5), while the stored database reference remains complete.
  // Only accept the canonical prefixed four-character form; arbitrary
  // partial fragments such as "1WW5" remain invalid.
  if (!/^(ORD|INV)-[A-Z0-9]{4}$/.test(requested)) return false;
  return references.some(
    (reference) => toCustomerFacingOrderReference(reference) === requested,
  );
}

function splitPeople(record: any): any[] {
  const values = [
    ...(Array.isArray(record?.splitPayments) ? record.splitPayments : []),
    ...(Array.isArray(record?.splitParticipants) ? record.splitParticipants : []),
  ];
  return values.filter(Boolean);
}

function isSplitOrder(record: any): boolean {
  const splitType = String(record?.splitType || "").trim().toLowerCase();
  return (
    Boolean(splitType && splitType !== "none") ||
    splitPeople(record).length > 0 ||
    String(record?.status || "").includes("قطية")
  );
}

function phoneIsSplitParticipant(record: any, phone: string): boolean {
  return Boolean(phone) && splitPeople(record).some(
    (person: any) => normalizeCustomerPhone(person?.phone) === phone,
  );
}

export function tokenAuthorizesCustomerPhone(
  records: any[],
  phone: unknown,
  token: unknown,
): boolean {
  const cleanPhone = normalizeCustomerPhone(phone);
  if (cleanPhone.length !== 8 || !String(token || "").trim()) return false;

  return (Array.isArray(records) ? records : []).some((record: any) => {
    return (
      recordOwnerPhone(record) === cleanPhone &&
      tokenMatchesHash(token, record?.customerAccessTokenHash)
    );
  });
}

export function getCustomerOrderAccess(
  record: any,
  input: {
    phone?: unknown;
    orderId?: unknown;
    token?: unknown;
    trackingToken?: unknown;
    tokenAuthorizesPhone?: boolean;
  },
): CustomerOrderAccess {
  const phone = normalizeCustomerPhone(input.phone);
  const hasExactOrderId = Boolean(String(input.orderId || "").trim());
  const isExact = hasExactOrderId && isExactOrderReference(record, input.orderId);
  const ownerMatches = phone.length === 8 && recordOwnerPhone(record) === phone;
  const participantMatches = phoneIsSplitParticipant(record, phone);
  const recordTokenMatches = ownerMatches && tokenMatchesHash(
    input.token,
    record?.customerAccessTokenHash,
  );
  const trackingTokenMatches = tokenMatchesHash(
    input.trackingToken,
    record?.trackingAccessTokenHash,
  );
  const phoneTokenMatches =
    ownerMatches && input.tokenAuthorizesPhone === true;

  if (!hasExactOrderId) {
    // Phone-only tracking must work across the customer's devices.
    // The token remains useful for protected direct links, but is not tied
    // to the browser that originally placed the order.
    if (ownerMatches) return "private";
    if (participantMatches) return "split";
    return "none";
  }

  if (!isExact) return "none";
  if (
    ownerMatches ||
    trackingTokenMatches ||
    recordTokenMatches ||
    phoneTokenMatches
  ) {
    // Phone-only tracking is already allowed across devices. Supplying the
    // matching full or customer-facing order reference must not make that
    // same customer lose access merely because this is a different browser.
    return "private";
  }


  // Shared split links remain usable, but never expose the owner's private fields.
  if (isSplitOrder(record) && (!phone || participantMatches)) return "split";
  return "none";
}

function sanitizeSplitPeople(values: unknown, requesterPhone: string): any[] {
  if (!Array.isArray(values)) return [];
  return values.map((person: any) => {
    const personPhone = normalizeCustomerPhone(person?.phone);
    const isRequester = Boolean(
      requesterPhone && personPhone === requesterPhone,
    );
    return {
      ...person,
      phone: isRequester ? personPhone : "",
      isCurrentCustomer: isRequester,
    };
  });
}

function redactNestedPhoneFields(
  value: any,
  requesterPhone: string,
): any {
  if (Array.isArray(value)) {
    return value.map((item) =>
      redactNestedPhoneFields(item, requesterPhone),
    );
  }
  if (!value || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      const normalizedKey = key.replace(/[^a-z]/gi, "").toLowerCase();
      const isPhoneField = [
        "phone",
        "phones",
        "mobile",
        "mobilenumber",
        "telephone",
        "tel",
        "whatsapp",
        "whatsappnumber",
        "contactphone",
        "contactnumber",
        "customerphone",
        "ownerphone",
      ].includes(normalizedKey);

      if (isPhoneField) {
        const nestedPhone = normalizeCustomerPhone(nestedValue);
        return [
          key,
          requesterPhone && nestedPhone === requesterPhone
            ? nestedPhone
            : "",
        ];
      }
      return [
        key,
        redactNestedPhoneFields(nestedValue, requesterPhone),
      ];
    }),
  );
}

export function sanitizeTrackedOrder(
  record: any,
  access: Exclude<CustomerOrderAccess, "none">,
  requesterPhone?: unknown,
): any {
  const phone = normalizeCustomerPhone(requesterPhone);
  const sanitized = { ...(record || {}) };

  delete sanitized.customerAccessTokenHash;
  delete sanitized.trackingAccessTokenHash;
  delete sanitized.customerId;
  delete sanitized.paymentId;
  delete sanitized.transactionId;
  delete sanitized.trackId;
  delete sanitized.gatewayResponse;
  delete sanitized.webhookPayload;

  // بيانات المورد والتكلفة داخلية، وتبقى محفوظة في نسخة الطلب
  // التي يقرأها برنامج الإدارة فقط. لا تُعاد إلى واجهة العميل.
  if (Array.isArray(sanitized.items)) {
    sanitized.items = sanitized.items.map((rawItem: any) => {
      const item = { ...(rawItem || {}) };
      delete item.supplierId;
      delete item.supplierID;
      delete item.supplierName;
      delete item.supplierProductId;
      delete item.supplierCost;
      delete item.purchaseCost;
      delete item.costAtTime;
      delete item.cost;
      delete item.supplier;
      return item;
    });
  }

  if (Array.isArray(sanitized.splitPayments)) {
    sanitized.splitPayments = sanitizeSplitPeople(
      sanitized.splitPayments,
      phone,
    );
  }
  if (Array.isArray(sanitized.splitParticipants)) {
    sanitized.splitParticipants = sanitizeSplitPeople(
      sanitized.splitParticipants,
      phone,
    );
  }

  if (
    access === "private" &&
    (!phone || recordOwnerPhone(record) !== phone)
  ) {
    sanitized.customerPhone = "";
    sanitized.phone = "";
    if (
      sanitized.address &&
      typeof sanitized.address === "object"
    ) {
      delete sanitized.address.phone;
      delete sanitized.address.customerPhone;
      delete sanitized.address.mobile;
    }
    if (
      sanitized.deliveryInfo &&
      typeof sanitized.deliveryInfo === "object"
    ) {
      delete sanitized.deliveryInfo.phone;
      delete sanitized.deliveryInfo.customerPhone;
      delete sanitized.deliveryInfo.mobile;
    }
  }

  if (access === "split") {
    delete sanitized.customerName;
    delete sanitized.customerPhone;
    delete sanitized.phone;
    delete sanitized.address;
    delete sanitized.deliveryInfo;
    delete sanitized.generalNotes;
    delete sanitized.notes;
    delete sanitized.paymentLink;
    sanitized.customerName = "";
    sanitized.customerPhone = "";
  }

  return redactNestedPhoneFields(sanitized, phone);
}

function keepOnlyRequesterPhone(value: unknown, requesterPhone: string): string {
  const phone = normalizeCustomerPhone(value);
  return requesterPhone && phone === requesterPhone ? phone : "";
}

export function sanitizeSquadForCustomer(
  squad: any,
  requesterPhone?: unknown,
): any {
  if (!squad || typeof squad !== "object") return squad;
  const phone = normalizeCustomerPhone(requesterPhone);
  const visit = (value: any, key = ""): any => {
    if (/(phone|mobile|whatsapp|telephone|tel)/i.test(key)) {
      return keepOnlyRequesterPhone(value, phone);
    }
    if (Array.isArray(value)) return value.map((item) => visit(item));
    if (!value || typeof value !== "object") return value;

    const result: any = {};
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      result[nestedKey] = visit(nestedValue, nestedKey);
    }
    return result;
  };

  return visit(squad);
}

function sanitizePublicSettings(settings: any): any {
  const source = settings && typeof settings === "object" ? settings : {};
  const result: any = {};
  for (const key of PUBLIC_SETTINGS_KEYS) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

export function buildPublicAppData(data: any): any {
  const source = data && typeof data === "object" ? data : {};
  return {
    settings: sanitizePublicSettings(source.settings),
    zones: Array.isArray(source.zones) ? source.zones : [],
    loyaltyTiers: Array.isArray(source.loyaltyTiers) ? source.loyaltyTiers : [],
    squadTiers: Array.isArray(source.squadTiers) ? source.squadTiers : [],
    productCategories: Array.isArray(source.productCategories)
      ? source.productCategories
      : [],
    menuCategories: Array.isArray(source.menuCategories)
      ? source.menuCategories
      : [],
  };
}

export function isAllowedPaymentLink(value: unknown): boolean {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (hostname === "upayments.com" || hostname.endsWith(".upayments.com"))
    );
  } catch {
    return false;
  }
}
