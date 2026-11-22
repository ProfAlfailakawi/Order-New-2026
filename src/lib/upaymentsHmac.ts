// UPayments HMAC authentication (https://developers.upayments.com/reference/hmac-authentication).
// Server-side only: the API secret must never reach the browser.
//
// Outbound: X-Timestamp (UTC seconds) + X-Signature = base64(HMAC_SHA256(secret,
//   timestamp + METHOD + path-after-/api/v1/ + exact body)). GET -> empty body.
// Inbound webhook: same, but the path part is the FULL notification URL.
//
// Rollout-safe: with no UPAYMENTS_API_SECRET configured, outbound calls are sent exactly as
// before (no headers added), so deploying this code cannot break payments before the secret is set.
import crypto from "node:crypto";

export const UPAYMENTS_HMAC_TOLERANCE_SECONDS = 300;

export function getUPaymentsApiSecret(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.UPAYMENTS_API_SECRET || env.UPAYMENTS_SECRET_KEY || "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

/** "https://apiv2api.upayments.com/api/v1/charge/123?x=1" -> "charge/123". No domain, no /api/v1/. */
export function upaymentsSignedPath(urlOrPath: string): string {
  let p = String(urlOrPath || "");
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    /* keep as is */
  }
  p = p.split("?")[0];
  const marker = "/api/v1/";
  const i = p.indexOf(marker);
  if (i >= 0) p = p.slice(i + marker.length);
  return p.replace(/^\/+/, "");
}

export function computeUPaymentsSignature(
  secret: string,
  timestamp: string | number,
  method: string,
  pathOrUrl: string,
  body: string,
): string {
  const payload = `${timestamp}${method.toUpperCase()}${pathOrUrl}${body}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

/**
 * Extra headers for an outbound UPayments request. `body` must be the exact string that is sent
 * ("" for GET). Returns {} when no secret is configured.
 */
export function upaymentsHmacHeaders(
  method: string,
  url: string,
  body: string = "",
  opts: { secret?: string; nowMs?: number } = {},
): Record<string, string> {
  const secret = opts.secret ?? getUPaymentsApiSecret();
  if (!secret) return {};
  const timestamp = String(Math.floor((opts.nowMs ?? Date.now()) / 1000));
  return {
    "X-Timestamp": timestamp,
    "X-Signature": computeUPaymentsSignature(secret, timestamp, method, upaymentsSignedPath(url), body),
  };
}

export type WebhookSignatureResult = "valid" | "invalid" | "missing" | "disabled";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Verify an incoming UPayments webhook. `candidateUrls` are the possible absolute URLs UPayments
 * was given (behind a proxy the scheme/host we see may differ); any match is accepted.
 */
export function verifyUPaymentsWebhookSignature(input: {
  headers: Record<string, any>;
  method: string;
  candidateUrls: string[];
  rawBody: string;
  secret?: string;
  nowMs?: number;
}): WebhookSignatureResult {
  const secret = input.secret ?? getUPaymentsApiSecret();
  if (!secret) return "disabled";
  const h = (name: string) => {
    const v = input.headers?.[name];
    return String(Array.isArray(v) ? v[0] : v || "").trim();
  };
  const signature = h("x-signature");
  const timestamp = h("x-timestamp");
  if (!signature || !timestamp) return "missing";
  const ts = Number(timestamp);
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > UPAYMENTS_HMAC_TOLERANCE_SECONDS) return "invalid";
  for (const url of input.candidateUrls) {
    if (safeEqual(computeUPaymentsSignature(secret, timestamp, input.method, url, input.rawBody), signature)) {
      return "valid";
    }
  }
  return "invalid";
}

/** Candidate absolute URLs for the request we received (original + https-forced variants). */
export function webhookCandidateUrls(req: {
  headers: Record<string, any>;
  originalUrl?: string;
  url?: string;
  protocol?: string;
}): string[] {
  const path = req.originalUrl || req.url || "";
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(",")[0].trim();
  if (!host) return [];
  const protos = new Set<string>(
    [String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim(), req.protocol || "", "https"].filter(Boolean),
  );
  return [...protos].map((p) => `${p}://${host}${path}`);
}

/**
 * Express-style gate. Policy: nothing is rejected unless UPAYMENTS_HMAC_ENFORCE=true.
 * Without enforcement a missing OR non-matching signature is only logged and the webhook goes
 * through to the existing handler (which confirms the payment with UPayments server-side anyway).
 * Rejecting "invalid" before enforcement dropped a real paid webhook on 2026-11-22 (INV-5145):
 * flip ENFORCE only after "[UPAYMENTS_HMAC] webhook signature valid" shows up in production logs.
 */
export function upaymentsWebhookGate(opts: { enforce?: boolean } = {}) {
  return (req: any, res: any, next: any) => {
    const raw = req.rawBody;
    const rawBody = Buffer.isBuffer(raw) ? raw.toString("utf8") : typeof raw === "string" ? raw : JSON.stringify(req.body ?? {});
    const result = verifyUPaymentsWebhookSignature({
      headers: req.headers,
      method: req.method,
      candidateUrls: webhookCandidateUrls(req),
      rawBody,
    });
    const enforce = opts.enforce ?? String(process.env.UPAYMENTS_HMAC_ENFORCE || "").toLowerCase() === "true";
    const path = String(req.originalUrl || "").split("?")[0];
    if (enforce && (result === "invalid" || result === "missing")) {
      console.warn(`[UPAYMENTS_HMAC] webhook rejected (${result}) path=${path}`);
      return res.status(401).json({ error: "invalid webhook signature" });
    }
    if (result === "valid") console.log(`[UPAYMENTS_HMAC] webhook signature valid path=${path}`);
    if (result === "missing") console.warn("[UPAYMENTS_HMAC] webhook arrived without signature headers (not enforced)");
    if (result === "invalid") {
      // Diagnostics only (no secret, no signature value): enough to learn how UPayments signs.
      const ts = Number(String(req.headers?.["x-timestamp"] || "").trim());
      const skew = Number.isFinite(ts) ? Math.floor(Date.now() / 1000) - ts : null;
      console.warn(
        `[UPAYMENTS_HMAC] webhook signature did not match (not enforced, allowed) path=${path} ` +
          JSON.stringify({
            skewSeconds: skew,
            signatureLength: String(req.headers?.["x-signature"] || "").length,
            hasRawBody: Buffer.isBuffer(raw) || typeof raw === "string",
            bodyLength: rawBody.length,
            contentType: String(req.headers?.["content-type"] || ""),
            candidateUrls: webhookCandidateUrls(req),
          }),
      );
    }
    next();
  };
}
