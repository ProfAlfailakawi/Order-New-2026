const CUSTOMER_TOKEN_KEY_PREFIX = "alturath_customer_access_v1:";
const TRACKING_TOKEN_KEY_PREFIX = "alturath_tracking_access_v1:";
const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

const normalizeOrderReference = (value: unknown): string => {
  let reference = String(value || "").trim().toUpperCase();
  if (reference.startsWith("#")) reference = reference.slice(1);
  if (reference.includes("-S-")) reference = reference.split("-S-")[0];
  return reference;
};

export function normalizeCustomerAccessPhone(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

export function storeCustomerAccessToken(
  phone: unknown,
  token: unknown,
): void {
  const cleanPhone = normalizeCustomerAccessPhone(phone);
  const cleanToken = String(token || "").trim();
  if (cleanPhone.length !== 8 || !cleanToken) return;
  try {
    localStorage.setItem(
      `${CUSTOMER_TOKEN_KEY_PREFIX}${cleanPhone}`,
      cleanToken,
    );
  } catch {}
}

export function getCustomerAccessToken(phone: unknown): string {
  const cleanPhone = normalizeCustomerAccessPhone(phone);
  if (cleanPhone.length !== 8) return "";
  try {
    return (
      localStorage.getItem(`${CUSTOMER_TOKEN_KEY_PREFIX}${cleanPhone}`) || ""
    );
  } catch {
    return "";
  }
}

export function storeTrackingAccessToken(
  orderId: unknown,
  token: unknown,
): void {
  const reference = normalizeOrderReference(orderId);
  const cleanToken = String(token || "").trim();
  if (!reference || !TRACKING_TOKEN_PATTERN.test(cleanToken)) return;
  try {
    sessionStorage.setItem(
      `${TRACKING_TOKEN_KEY_PREFIX}${reference}`,
      cleanToken,
    );
  } catch {}
}

export function getTrackingAccessToken(orderId: unknown): string {
  const reference = normalizeOrderReference(orderId);
  if (!reference) return "";
  try {
    const token =
      sessionStorage.getItem(
        `${TRACKING_TOKEN_KEY_PREFIX}${reference}`,
      ) || "";
    return TRACKING_TOKEN_PATTERN.test(token) ? token : "";
  } catch {
    return "";
  }
}

export function getCustomerAccessHeaders(
  phone: unknown,
  orderId?: unknown,
): HeadersInit {
  const customerToken = getCustomerAccessToken(phone);
  const trackingToken = getTrackingAccessToken(orderId);
  const headers: Record<string, string> = {};
  if (customerToken) {
    headers["X-Alturath-Customer-Token"] = customerToken;
  }
  if (trackingToken) {
    headers["X-Alturath-Tracking-Token"] = trackingToken;
  }
  return headers;
}

export function getStoredCustomerOrderId(): string {
  try {
    return (
      localStorage.getItem("post_payment_open_order_id") ||
      localStorage.getItem("track_order_id") ||
      sessionStorage.getItem("post_payment_open_order_id") ||
      ""
    );
  } catch {
    return "";
  }
}
