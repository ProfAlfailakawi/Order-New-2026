/**
 * AI Gateway — single server-side entry point for every Gemini call.
 *
 * Root cause this fixes: model ids were hardcoded inline (e.g. the invalid
 * "gemini-3.5-flash"), calls had no cost ceiling, no timeout, no shared retry,
 * and each endpoint re-implemented JSON/tool plumbing. Centralising here gives:
 *   - one place for valid model ids (no more phantom models),
 *   - per-IP + global daily budgets (requests + tokens) to cap spend,
 *   - uniform timeout, retry, and error normalisation,
 *   - helpers for Structured Output and Function-Calling loops.
 *
 * The Gemini API key stays server-side only; nothing here is exposed to the client.
 */

import { GoogleGenAI, Type } from "@google/genai";

export { Type };

// ---- Valid model ids (single source of truth) ------------------------------
// Only real, currently-served Gemini models. Do NOT inline model strings elsewhere.
export const AI_MODELS = {
  fast: "gemini-2.5-flash",
  reasoning: "gemini-2.5-pro",
} as const;

export type AiModelKey = keyof typeof AI_MODELS;

function resolveModel(model: AiModelKey | string): string {
  if (model in AI_MODELS) return AI_MODELS[model as AiModelKey];
  // Guard against re-introducing invalid ids; fall back to fast.
  if (typeof model === "string" && /^gemini-/.test(model) && !/gemini-3/.test(model)) {
    return model;
  }
  return AI_MODELS.fast;
}

// ---- Cost / rate limiting --------------------------------------------------
const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const LIMITS = {
  perIpRequestsPerMin: num(process.env.AI_PER_IP_RPM, 12),
  globalRequestsPerDay: num(process.env.AI_GLOBAL_RPD, 5000),
  globalTokensPerDay: num(process.env.AI_GLOBAL_TPD, 4_000_000),
  requestTimeoutMs: num(process.env.AI_TIMEOUT_MS, 20000),
  maxRetries: num(process.env.AI_MAX_RETRIES, 2),
  maxToolTurns: num(process.env.AI_MAX_TOOL_TURNS, 5),
};

type Bucket = { count: number; resetAt: number };
const ipBuckets = new Map<string, Bucket>();
let globalDay = { day: "", requests: 0, tokens: 0 };

function currentDayKey(now: number): string {
  // UTC day bucket. Date.now() is passed in so this stays pure/testable.
  return new Date(now).toISOString().slice(0, 10);
}

function ensureGlobalDay(now: number) {
  const day = currentDayKey(now);
  if (globalDay.day !== day) globalDay = { day, requests: 0, tokens: 0 };
}

export class AiBudgetError extends Error {
  code = "AI_BUDGET_EXCEEDED";
  constructor(message: string) {
    super(message);
    this.name = "AiBudgetError";
  }
}

/** Throws AiBudgetError when a caller is over budget. Call once per user request. */
function checkBudget(clientIp: string, now: number) {
  ensureGlobalDay(now);
  if (globalDay.requests >= LIMITS.globalRequestsPerDay) {
    throw new AiBudgetError("Daily AI request limit reached");
  }
  if (globalDay.tokens >= LIMITS.globalTokensPerDay) {
    throw new AiBudgetError("Daily AI token limit reached");
  }
  const bucket = ipBuckets.get(clientIp);
  if (!bucket || now >= bucket.resetAt) {
    ipBuckets.set(clientIp, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (bucket.count >= LIMITS.perIpRequestsPerMin) {
    throw new AiBudgetError("Too many AI requests, slow down a moment");
  }
  bucket.count += 1;
}

function recordUsage(now: number, usage: any) {
  ensureGlobalDay(now);
  const total =
    Number(usage?.totalTokenCount ?? usage?.totalTokens ?? 0) || 0;
  globalDay.requests += 1;
  globalDay.tokens += total;
}

export function getAiUsageSnapshot() {
  return { ...globalDay, limits: LIMITS };
}

// ---- Core client -----------------------------------------------------------
const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("AI_TIMEOUT")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callWithRetry(params: any, nowFn: () => number): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= LIMITS.maxRetries; attempt++) {
    try {
      const res = await withTimeout(
        aiClient.models.generateContent(params),
        LIMITS.requestTimeoutMs,
      );
      recordUsage(nowFn(), res?.usageMetadata);
      return res;
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      const retryable =
        msg.includes("AI_TIMEOUT") ||
        msg.includes("503") ||
        msg.includes("500") ||
        msg.includes("429") ||
        msg.toLowerCase().includes("overloaded");
      if (!retryable || attempt === LIMITS.maxRetries) break;
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr;
}

export interface StructuredOptions {
  clientIp?: string;
  model?: AiModelKey | string;
  systemInstruction?: string;
  contents: any;
  schema: any;
  maxOutputTokens?: number;
  temperature?: number;
  nowFn?: () => number;
}

/** Structured Output helper: forces JSON matching `schema`, returns parsed object. */
export async function generateStructured<T = any>(
  opts: StructuredOptions,
): Promise<T> {
  const nowFn = opts.nowFn ?? (() => Date.now());
  checkBudget(opts.clientIp || "anon", nowFn());
  const res = await callWithRetry(
    {
      model: resolveModel(opts.model ?? "fast"),
      contents: opts.contents,
      config: {
        systemInstruction: opts.systemInstruction,
        temperature: opts.temperature ?? 0.6,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
        responseMimeType: "application/json",
        responseSchema: opts.schema,
      },
    },
    nowFn,
  );
  const text = res?.text || "{}";
  return JSON.parse(text) as T;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: any;
}

export interface FunctionLoopOptions {
  clientIp?: string;
  model?: AiModelKey | string;
  systemInstruction?: string;
  userMessage: string;
  tools: ToolDeclaration[];
  /** Executes a tool call and returns a JSON-serialisable result. */
  handler: (name: string, args: any) => Promise<any> | any;
  /** Final answer shape enforced via Structured Output on the last turn. */
  finalSchema: any;
  maxOutputTokens?: number;
  nowFn?: () => number;
}

/**
 * Runs a Function-Calling loop: the model calls tools (bounded by maxToolTurns),
 * we execute them server-side against the real menu/order data, then force a
 * final structured answer. The model never touches the DB directly.
 */
export async function runFunctionLoop<T = any>(
  opts: FunctionLoopOptions,
): Promise<{ result: T; toolCalls: Array<{ name: string; args: any }> }> {
  const nowFn = opts.nowFn ?? (() => Date.now());
  checkBudget(opts.clientIp || "anon", nowFn());

  const model = resolveModel(opts.model ?? "fast");
  const tools = [{ functionDeclarations: opts.tools }];
  const contents: any[] = [
    { role: "user", parts: [{ text: opts.userMessage }] },
  ];
  const toolCalls: Array<{ name: string; args: any }> = [];

  for (let turn = 0; turn < LIMITS.maxToolTurns; turn++) {
    const res = await callWithRetry(
      {
        model,
        contents,
        config: {
          systemInstruction: opts.systemInstruction,
          temperature: 0.4,
          tools,
        },
      },
      nowFn,
    );

    const calls = res?.functionCalls || [];
    if (!calls.length) break; // model is ready to answer

    contents.push({ role: "model", parts: res.candidates?.[0]?.content?.parts || [] });

    const responseParts: any[] = [];
    for (const call of calls) {
      toolCalls.push({ name: call.name, args: call.args });
      let out: any;
      try {
        out = await opts.handler(call.name, call.args || {});
      } catch (e: any) {
        out = { error: String(e?.message || e) };
      }
      responseParts.push({
        functionResponse: { name: call.name, response: { result: out } },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  // Force the final structured answer (no tools this turn).
  const finalRes = await callWithRetry(
    {
      model,
      contents: [
        ...contents,
        {
          role: "user",
          parts: [
            {
              text: "الآن قدّم الإجابة النهائية بصيغة JSON فقط حسب المخطط المطلوب.",
            },
          ],
        },
      ],
      config: {
        systemInstruction: opts.systemInstruction,
        temperature: 0.5,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
        responseMimeType: "application/json",
        responseSchema: opts.finalSchema,
      },
    },
    nowFn,
  );

  const result = JSON.parse(finalRes?.text || "{}") as T;
  return { result, toolCalls };
}

/** Best-effort client IP for budget bucketing. */
export function clientIpOf(req: any): string {
  const fwd = String(req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req?.ip || req?.socket?.remoteAddress || "anon";
}
