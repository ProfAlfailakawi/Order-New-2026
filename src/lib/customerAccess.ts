const CUSTOMER_TOKEN_KEY_PREFIX = "alturath_customer_access_v1:";

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

export function getCustomerAccessHeaders(phone: unknown): HeadersInit {
  const token = getCustomerAccessToken(phone);
  return token ? { "X-Alturath-Customer-Token": token } : {};
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
