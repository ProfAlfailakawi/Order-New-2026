// Server-side confirmation of a UPayments payment before an order is marked paid.
//
// The return URL (/api/payment-return/<order>/success) and the webhook used to be
// trusted as-is: opening the success URL by hand marked any order paid. A payment
// now counts only when UPayments itself reports it captured, for this order (or
// split) and, when both sides state an amount, for the expected amount.
//
// Same endpoints and status vocabulary as Admin-New-2026's working check
// (fetchUPaymentsStatusByCandidate / classifyGatewayPaymentState).

export type PaymentVerdict = "paid" | "failed" | "unknown";

export interface VerifyInput {
  /** Gateway ids to look up: track_id / payment_id from the redirect or webhook, plus ids the server stored. */
  candidates: unknown[];
  /** Ids this payment must belong to: order id, stored gateway order id, split id. */
  expectedRefs: unknown[];
  /** Amount the server expects for this payment, when known. */
  expectedAmount?: number | null;
  apiKey: string;
  sandbox?: boolean;
}

export type StatusFetcher = (url: string, apiKey: string) => Promise<{ status: number; data: any }>;

const FAILED_TOKENS = [
  "NOT CAPTURED", "NOTCAPTURED", "FAILED", "FAILURE", "CANCELLED", "CANCELED", "DECLINED",
  "REJECTED", "VOIDED", "EXPIRED", "ERROR", "UNSUCCESSFUL",
];
const PAID_TOKENS = [
  "CAPTURED", "SUCCESS", "SUCCESSFUL", "SUCCEEDED", "PAID", "AUTHORIZED", "AUTHORISED",
  "APPROVED", "COMPLETED", "CHARGED",
];

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;

export function cleanGatewayId(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = String(value).split(/[?#]/)[0].trim();
  return ID_PATTERN.test(text) ? text : "";
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

export function transactionOf(payload: any): any {
  if (!payload || typeof payload !== "object") return {};
  return payload?.data?.transaction || payload?.transaction || payload?.data?.data?.transaction || payload?.data || payload;
}

export function classifyTransaction(tx: any): PaymentVerdict {
  const values = [tx?.result, tx?.status, tx?.payment_status, tx?.paymentStatus, tx?.transaction_status, tx?.state]
    .filter((v) => typeof v === "string" || typeof v === "number")
    .map(normalizeStatus)
    .filter(Boolean);
  if (values.some((v) => FAILED_TOKENS.some((t) => v === t || v.includes(t)))) return "failed";
  if (values.some((v) => PAID_TOKENS.some((t) => v === t || v.includes(t)))) return "paid";
  return "unknown";
}

function transactionRefs(tx: any): string[] {
  const refs = [
    tx?.order_id, tx?.orderId, tx?.requested_order_id, tx?.requestedOrderId,
    tx?.merchant_order_id, tx?.reference?.id, typeof tx?.reference === "string" ? tx.reference : undefined,
    tx?.ref, tx?.trn_udf,
  ];
  return refs.map(cleanGatewayId).filter(Boolean).map((r) => r.toUpperCase());
}

function transactionAmount(tx: any): number | null {
  for (const v of [tx?.total_price, tx?.amount, tx?.total, tx?.price, tx?.paid_amount]) {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Decide what one status response says about this payment. */
export function judgeStatusResponse(data: any, expectedRefs: string[], expectedAmount?: number | null): PaymentVerdict {
  const tx = transactionOf(data);
  const state = classifyTransaction(tx);
  if (state === "unknown") return "unknown";

  // The transaction must belong to this order: a track_id from someone else's
  // (cheaper) payment must not settle this one.
  const refs = transactionRefs(tx);
  const wanted = expectedRefs.map((r) => r.toUpperCase());
  const amount = transactionAmount(tx);
  const expected = typeof expectedAmount === "number" && Number.isFinite(expectedAmount) ? expectedAmount : null;

  if (refs.length > 0) {
    if (!refs.some((r) => wanted.includes(r))) return "unknown";
  } else if (amount === null || expected === null) {
    // Nothing ties this transaction to the order.
    return "unknown";
  }
  if (state === "paid" && amount !== null && expected !== null && Math.abs(amount - expected) > 0.0015) {
    return "unknown";
  }
  return state;
}

export const defaultStatusFetcher: StatusFetcher = async (url, apiKey) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await response.json() : null;
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
};

/** Ask UPayments about each candidate id until one gives a clear, matching answer. */
export async function verifyUPaymentsPayment(
  input: VerifyInput,
  fetcher: StatusFetcher = defaultStatusFetcher,
): Promise<PaymentVerdict> {
  if (!input.apiKey) return "unknown";
  const candidates = [...new Set(input.candidates.map(cleanGatewayId).filter(Boolean))].slice(0, 8);
  const expectedRefs = [...new Set(input.expectedRefs.map(cleanGatewayId).filter(Boolean))];
  if (candidates.length === 0 || expectedRefs.length === 0) return "unknown";

  const bases = input.sandbox
    ? ["https://sandboxapi.upayments.com/api/v1"]
    : ["https://apiv2api.upayments.com/api/v1", "https://uapi.upayments.com/api/v1"];

  for (const id of candidates) {
    for (const base of bases) {
      let verdict: PaymentVerdict = "unknown";
      try {
        let res = await fetcher(`${base}/get-payment-status/${encodeURIComponent(id)}`, input.apiKey);
        if (res.status === 404 || res.status === 400) {
          res = await fetcher(`${base}/charge/${encodeURIComponent(id)}`, input.apiKey);
        }
        if (res.status >= 200 && res.status < 300 && res.data && typeof res.data === "object") {
          verdict = judgeStatusResponse(res.data, expectedRefs, input.expectedAmount);
        }
      } catch {
        verdict = "unknown";
      }
      if (verdict !== "unknown") return verdict;
    }
  }
  return "unknown";
}
