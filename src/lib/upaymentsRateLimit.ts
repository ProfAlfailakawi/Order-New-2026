// UPayments sits behind Cloudflare. When too many requests come from our server's address it
// answers 429, or a 403 "Just a moment..." HTML challenge page instead of JSON.
export const UPAYMENTS_BUSY_MESSAGE = "بوابة الدفع مشغولة مؤقتاً بسبب كثرة الطلبات. انتظر دقيقة ثم أعد المحاولة.";

/** True for a UPayments response that means "slow down" (429, or a Cloudflare challenge page). */
export function isUPaymentsRateLimited(status: number, body?: unknown): boolean {
  if (status === 429) return true;
  if (typeof body === "string" && /<title>\s*Just a moment/i.test(body)) return true;
  return false;
}
