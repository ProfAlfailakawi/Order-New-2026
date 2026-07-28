import "dotenv/config";
import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import LZString from "lz-string";
import { initializeApp } from "firebase/app";
import admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { GoogleGenAI, Type } from "@google/genai";
import { checkStoreStatus, getConfiguredStoreStatus } from "./src/lib/storeAvailability";
import { packCustomerMenuProducts } from "./src/lib/customerMenuTransport.ts";
import {
  brotliCompress,
  constants as zlibConstants,
  gzip,
} from "node:zlib";
import { promisify } from "node:util";

// Initialize Gemini SDK with User-Agent telemetry
const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

import {
  initializeFirestore,
  setLogLevel,
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback in-memory DB
let localFallbackDB: any = {
  products: [],
  supplierCopies: [],
  orders: [],
  invoices: [],
  customers: [],
  zones: [],
  settings: {},
  promocodes: []
};

// Attempt to load entire fallback from file first
try {
  if (fs.existsSync(path.join(__dirname, "app_data_fallback.json"))) {
    console.log("Loading app_data_fallback.json");
    const fileData = JSON.parse(fs.readFileSync(path.join(__dirname, "app_data_fallback.json"), "utf8"));
    localFallbackDB = { ...localFallbackDB, ...fileData };
  } else {
    // legacy migrations
    if (fs.existsSync(path.join(__dirname, "shared_products.json"))) {
      console.log("Loading shared_products.json - length=", JSON.parse(fs.readFileSync(path.join(__dirname, "shared_products.json"), "utf8"))?.length);
      localFallbackDB.products = JSON.parse(fs.readFileSync(path.join(__dirname, "shared_products.json"), "utf8"));
    }
    if (fs.existsSync(path.join(__dirname, "suppliers.json"))) {
      console.log("Loading suppliers.json");
      localFallbackDB.supplierCopies = JSON.parse(fs.readFileSync(path.join(__dirname, "suppliers.json"), "utf8")).flatMap((s:any) => s.products || []);
    }
  }
} catch(e) {
  console.log("Could not load local data files", e);
}
console.log("INITIAL FALLBACK DB products size: ", localFallbackDB.products.length);


// Read firebase config safely for Node ESM
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"),
);

const appClient = initializeApp(firebaseConfig);
setLogLevel("silent");
const db = initializeFirestore(
  appClient,
  { experimentalAutoDetectLongPolling: true },
  firebaseConfig.firestoreDatabaseId || "(default)",
);

let adminMessaging: ReturnType<typeof getMessaging> | null = null;
let adminDb: ReturnType<typeof getAdminFirestore> | null = null;
try {
  const adminApp = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ projectId: firebaseConfig.projectId });
  adminMessaging = getMessaging(adminApp);
  adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId || "(default)");
} catch (error: any) {
  console.warn("[DIWANIYA_PUSH] Firebase Admin messaging disabled:", error?.message || String(error));
}

function handleAdminDbError(error: any, contextMsg: string) {
  const errMsg = String(error?.message || error || "");
  const isPermissionDenied = errMsg.includes("PERMISSION_DENIED") || errMsg.includes("insufficient permissions") || String(error?.code) === "7";
  if (isPermissionDenied) {
    console.info(`[ADMIN_DB_INFO] Admin SDK lacks role permissions (${contextMsg}). Disabling Admin Firestore and using Client SDK for subsequent actions.`);
    adminDb = null;
  } else {
    console.warn(`[ADMIN_DB_WARN] Admin database exception (${contextMsg}):`, error);
  }
}

let _appDataCache: any = null;
let _appDataCacheTime = 0;
const _appDataKeyedCache = new Map<string, { time: number; data: any }>();
const CACHE_TTL = 250; // Keep app reads quick without hiding fresh payment/order writes

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

// Compression is deliberately scoped to the read-only customer menu response.
// Payment, order creation, callbacks and notification endpoints keep their current
// transport path untouched.
async function sendCompressedCustomerMenuJson(
  req: express.Request,
  res: express.Response,
  payload: any,
) {
  const json = JSON.stringify(payload);
  const input = Buffer.from(json, "utf8");
  const acceptedEncodings = String(req.headers["accept-encoding"] || "");

  res.type("application/json; charset=utf-8");
  res.setHeader("Vary", "Accept-Encoding");
  try {
    if (acceptedEncodings.includes("br")) {
      const body = await brotliCompressAsync(input, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
          [zlibConstants.BROTLI_PARAM_SIZE_HINT]: input.length,
        },
      });
      res.setHeader("Content-Encoding", "br");
      return res.send(body);
    }
    if (acceptedEncodings.includes("gzip")) {
      const body = await gzipAsync(input, { level: 6 });
      res.setHeader("Content-Encoding", "gzip");
      return res.send(body);
    }
  } catch (compressionError) {
    console.warn("[CUSTOMER_MENU] Compression skipped:", compressionError);
  }
  return res.send(input);
}

const SHARDED_APPDATA_KEYS = [
  "orders",
  "invoices",
  "customers",
  "expenses",
  "testimonials",
  "products",
  "supplierCopies",
  "pulseAnalysisHistory",
  "pulseReviews",
  "campaigns",
  "squads",
  "promocodes",
  "aiLearningMemory",
  "pulseArchiveAnalysis",
  "deepArchiveAnalysis",
  "nameMatchMemory",
] as const;

type ShardedAppDataKey = (typeof SHARDED_APPDATA_KEYS)[number];

function readArrayFromShardData(key: ShardedAppDataKey, shardData: any) {
  if (!shardData) return [];
  if (shardData?.isCompressed && shardData?.compressedData) {
    const raw = String(shardData.compressedData || "");
    const decompressed =
      LZString.decompressFromBase64(raw) ||
      LZString.decompressFromUTF16(raw) ||
      "";
    if (!decompressed) return [];
    try {
      const parsed = JSON.parse(decompressed);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.[key])) return parsed[key];
    } catch (error) {
      console.warn(`[APPDATA] Failed to parse compressed shard ${key}:`, error);
    }
    return [];
  }
  if (Array.isArray(shardData?.[key])) return shardData[key];
  if (Array.isArray(shardData?.items)) return shardData.items;
  return [];
}

function buildShardPayload(key: ShardedAppDataKey, value: any[]) {
  const safeValue = Array.isArray(value) ? value : [];
  const serialized = JSON.stringify(safeValue);
  if (serialized.length > 500000) {
    return {
      compressedData: LZString.compressToBase64(serialized),
      isCompressed: true,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    [key]: JSON.parse(JSON.stringify(safeValue)),
    isCompressed: false,
    updatedAt: new Date().toISOString(),
  };
}

function rootPayloadWithShardPlaceholders(data: any) {
  const rootPayload = { ...(data || {}) };
  for (const key of SHARDED_APPDATA_KEYS) {
    if (Array.isArray(rootPayload[key])) {
      // The admin app stores large arrays in appData/shared_company_data/shards/*.
      // Keep the root document small and always read the shard back in getAppData().
      rootPayload[key] = [];
    }
  }
  return rootPayload;
}

async function loadSharedShard(key: ShardedAppDataKey) {
  if (adminDb) {
    try {
      const shardSnap = await adminDb.collection("appData").doc("shared_company_data").collection("shards").doc(key).get();
      if (shardSnap.exists) return readArrayFromShardData(key, shardSnap.data() || {});
    } catch (error) {
      handleAdminDbError(error, `loadSharedShard:${key}`);
    }
  }

  try {
    const shardSnap = await getDoc(doc(db, "appData", "shared_company_data", "shards", key));
    if (shardSnap.exists()) return readArrayFromShardData(key, shardSnap.data() || {});
  } catch (error) {
    console.warn(`[CLIENT_DB] Shard read failed for ${key}:`, error);
  }
  return [];
}

async function mergeSharedShards(rootData: any) {
  const merged = { ...(rootData || {}) };
  const shardEntries = await Promise.all(
    SHARDED_APPDATA_KEYS.map(async (key) => [key, await loadSharedShard(key)] as const),
  );
  for (const [key, value] of shardEntries) {
    if (Array.isArray(value) && value.length > 0) {
      merged[key] = value;
    }
  }
  return merged;
}


async function getAppDataForKeys(keysToLoad: readonly ShardedAppDataKey[] = []) {
  const uniqueKeys = Array.from(new Set(keysToLoad)).filter((key): key is ShardedAppDataKey =>
    (SHARDED_APPDATA_KEYS as readonly string[]).includes(key)
  ).sort();
  const cacheKey = uniqueKeys.join("|") || "root";
  const cached = _appDataKeyedCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;

  let rootData: any = null;
  if (adminDb) {
    try {
      const d = await adminDb.collection("appData").doc("shared_company_data").get();
      if (d.exists) rootData = d.data() || {};
    } catch (error) {
      handleAdminDbError(error, `getAppDataForKeys:${cacheKey}`);
    }
  }

  if (!rootData) {
    try {
      const d = await getDoc(doc(db, "appData", "shared_company_data"));
      if (d.exists()) rootData = d.data() || {};
    } catch (error) {
      console.warn(`[CLIENT_DB] Light read failed for ${cacheKey}`, error);
    }
  }

  if (!rootData) rootData = localFallbackDB;
  const data = { ...(rootData || {}) };
  await Promise.all(uniqueKeys.map(async (key) => {
    const value = await loadSharedShard(key);
    if (Array.isArray(value) && value.length > 0) data[key] = value;
  }));
  _appDataKeyedCache.set(cacheKey, { time: Date.now(), data });
  return data;
}

async function rejectCheckoutWhenStoreClosed(res: express.Response) {
  try {
    const data = await getAppDataForKeys([]);
    const availability = checkStoreStatus(getConfiguredStoreStatus(data));
    if (availability.isOpen) return false;

    res.status(409).json({
      code: "STORE_CLOSED",
      error: availability.message,
      formattedHours: availability.formattedHours,
      todayText: availability.todayText,
      weeklyList: availability.weeklyList,
    });
    return true;
  } catch (error: any) {
    // Availability checks must never interfere with a healthy checkout when the status source is unavailable.
    console.warn("[STORE_STATUS] Availability check skipped:", error?.message || String(error));
    return false;
  }
}

async function getAppData() {
  if (_appDataCache && Date.now() - _appDataCacheTime < CACHE_TTL) {
    return _appDataCache;
  }

  if (adminDb) {
    try {
      const d = await adminDb.collection("appData").doc("shared_company_data").get();
      if (d.exists) {
        const rootData = d.data() || {};
        _appDataCache = await mergeSharedShards(rootData);
        _appDataCacheTime = Date.now();
        return _appDataCache;
      }
    } catch (error) {
      handleAdminDbError(error, "getAppData");
    }
  }

  try {
    const d = await getDoc(doc(db, "appData", "shared_company_data"));
    if (d.exists()) {
      const rootData = d.data();
      _appDataCache = await mergeSharedShards(rootData);
      _appDataCacheTime = Date.now();
      return _appDataCache;
    }
  } catch (error) {
    console.warn("[CLIENT_DB] Read failed or restricted", error);
  }

  return localFallbackDB;
}



const calculateSplitPaymentSummary = (order: any) => {
  const splitPayments = Array.isArray(order?.splitPayments) ? order.splitPayments : [];
  const total = Number(order?.total || order?.totalAmount || 0);

  const paidAmount = splitPayments.reduce((sum: number, split: any) => {
    const status = String(split?.status || "").toLowerCase();
    const isPaid = status === "paid" || status === "captured" || status === "success" || status === "successful";
    return isPaid ? sum + Number(split?.amount || 0) : sum;
  }, 0);

  const remainingAmount = Math.max(0, total - paidAmount);
  const isFullyPaid = total > 0 && paidAmount + 0.001 >= total;

  return { total, paidAmount, remainingAmount, isFullyPaid };
};


const removeUndefinedDeep = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep);
  }

  if (value && typeof value === "object") {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      cleaned[key] = removeUndefinedDeep(val);
    }
    return cleaned;
  }

  return value;
};

async function updateAppData(data: any) {
  const cleanedData = removeUndefinedDeep(data);
  if (adminDb) {
    try {
      const docRef = adminDb.collection("appData").doc("shared_company_data");
      await adminDb.runTransaction(async (transaction) => {
        transaction.set(docRef, rootPayloadWithShardPlaceholders(cleanedData), { merge: true });
        for (const key of SHARDED_APPDATA_KEYS) {
          if (Array.isArray(cleanedData[key])) {
            transaction.set(docRef.collection("shards").doc(key), buildShardPayload(key, cleanedData[key]), { merge: false });
          }
        }
      });
      _appDataCache = null;
      _appDataCacheTime = 0;
      _appDataKeyedCache.clear();
      return;
    } catch (error) {
      handleAdminDbError(error, "updateAppData");
    }
  }

  try {
    const docRef = doc(db, "appData", "shared_company_data");
    await setDoc(docRef, rootPayloadWithShardPlaceholders(cleanedData), { merge: true });
    await Promise.all(SHARDED_APPDATA_KEYS.map(async (key) => {
      if (Array.isArray(cleanedData[key])) {
        await setDoc(doc(db, "appData", "shared_company_data", "shards", key), buildShardPayload(key, cleanedData[key]), { merge: false });
      }
    }));
    _appDataCache = null;
    _appDataCacheTime = 0;
    _appDataKeyedCache.clear();
  } catch (error) {
    console.warn("[CLIENT_DB] Write failed, updating local in-memory fallback", error);
    localFallbackDB = { ...localFallbackDB, ...data };
    try {
      fs.writeFileSync(path.join(__dirname, "app_data_fallback.json"), JSON.stringify(localFallbackDB, null, 2));
    } catch (err) {
      console.warn("Could not save to disk:", err);
    }
  }
}

/**
 * Transaction-safe update helper.
 * Use this for any update that involves arrays (orders, invoices, customers)
 * to prevent race conditions.
 */
async function updateAppDataAtomically(
  updater: (currentData: any) => any,
  keysToLoad: readonly ShardedAppDataKey[] = SHARDED_APPDATA_KEYS,
) {
  if (adminDb) {
    try {
      const docRef = adminDb.collection("appData").doc("shared_company_data");
      await adminDb.runTransaction(async (transaction) => {
        const sDoc = await transaction.get(docRef);

        let currentData: any = {};
        let isNew = false;
        if (!sDoc.exists) {
          isNew = true;
          currentData = localFallbackDB;
        } else {
          currentData = sDoc.data() || {};
          for (const key of keysToLoad) {
            const shardSnap = await transaction.get(docRef.collection("shards").doc(key));
            if (shardSnap.exists) {
              const shardValue = readArrayFromShardData(key, shardSnap.data() || {});
              if (Array.isArray(shardValue) && shardValue.length > 0) currentData[key] = shardValue;
            }
          }
        }

        const updates = removeUndefinedDeep(updater(currentData));

        if (updates) {
          const rootUpdates = rootPayloadWithShardPlaceholders(updates);
          if (isNew) {
            transaction.set(docRef, { ...rootPayloadWithShardPlaceholders(currentData), ...rootUpdates }, { merge: true });
          } else {
            transaction.update(docRef, rootUpdates);
          }
          for (const key of SHARDED_APPDATA_KEYS) {
            if (Array.isArray(updates[key])) {
              transaction.set(docRef.collection("shards").doc(key), buildShardPayload(key, updates[key]), { merge: false });
            }
          }
        } else if (isNew) {
          transaction.set(docRef, currentData);
        }
      });
      _appDataCache = null;
      _appDataCacheTime = 0;
      _appDataKeyedCache.clear();
      return true;
    } catch (error) {
      handleAdminDbError(error, "updateAppDataAtomically");
    }
  }

  try {
    const docRef = doc(db, "appData", "shared_company_data");
    await runTransaction(db, async (transaction) => {
      const sDoc = await transaction.get(docRef);

      let currentData: any = {};
      let isNew = false;
      if (!sDoc.exists()) {
        isNew = true;
        currentData = localFallbackDB;
      } else {
        currentData = sDoc.data();
        for (const key of keysToLoad) {
          const shardSnap = await transaction.get(doc(db, "appData", "shared_company_data", "shards", key));
          if (shardSnap.exists()) {
            const shardValue = readArrayFromShardData(key, shardSnap.data() || {});
            if (Array.isArray(shardValue) && shardValue.length > 0) currentData[key] = shardValue;
          }
        }
      }

      const updates = removeUndefinedDeep(updater(currentData));

      if (updates) {
        const rootUpdates = rootPayloadWithShardPlaceholders(updates);
        if (isNew) {
          transaction.set(docRef, { ...rootPayloadWithShardPlaceholders(currentData), ...rootUpdates }, { merge: true });
        } else {
          transaction.update(docRef, rootUpdates);
        }
        for (const key of SHARDED_APPDATA_KEYS) {
          if (Array.isArray(updates[key])) {
            transaction.set(doc(db, "appData", "shared_company_data", "shards", key), buildShardPayload(key, updates[key]), { merge: false });
          }
        }
      } else if (isNew) {
        transaction.set(docRef, currentData);
      }
    });
    _appDataCache = null;
    _appDataCacheTime = 0;
    _appDataKeyedCache.clear();
    return true;
  } catch (err) {
    console.error("[CLIENT_DB] Atomic update failed", err);
    return false;
  }
}

async function sendAdminPushDirectOnce(input: {
  eventId: string;
  title: string;
  body: string;
  alertType: string;
  orderId?: string;
  invoiceId?: string;
  url?: string;
}) {
  if (!adminMessaging || !adminDb || !input?.eventId) {
    return { success: false, skipped: true, reason: "admin-push-not-ready" };
  }

  const eventRef = adminDb.collection("pushEvents").doc(String(input.eventId));
  try {
    await eventRef.create({
      eventId: String(input.eventId),
      source: "order-server-direct-push",
      status: "claimed",
      alertType: input.alertType,
      orderId: input.orderId || null,
      invoiceId: input.invoiceId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    const msg = String(error?.code || error?.message || "");
    if (msg.includes("already-exists") || msg.includes("ALREADY_EXISTS") || msg.includes("6")) {
      return { success: true, skipped: true, reason: "already-sent-or-claimed" };
    }
    throw error;
  }

  const snap = await adminDb.collection("pushTokens").where("active", "==", true).get();
  const tokens = snap.docs
    .map((doc: any) => String((doc.data() || {}).token || ""))
    .filter((token: string) => token.length > 50 && /^[\x20-\x7E]+$/.test(token));

  if (tokens.length === 0) {
    await eventRef.set({
      status: "no_tokens",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Delivery-only safety: allow the admin alert worker to send later when tokens exist.
    await eventRef.delete().catch(() => undefined);
    return { success: false, tokensCount: 0, reason: "no-active-tokens" };
  }

  const url = input.url || (
    input.invoiceId
      ? `https://admin.alturathkw.shop/?invoice=${encodeURIComponent(input.invoiceId)}`
      : `https://admin.alturathkw.shop/?order=${encodeURIComponent(input.orderId || "")}`
  );

  const isPaymentAlert = String(input.alertType || "").toLowerCase().includes("payment") || String(input.alertType || "").toLowerCase().includes("invoice") || String(input.alertType || "").toLowerCase().includes("paid");
  const alertTypeText = String(input.alertType || "").toLowerCase();
  const shouldRenotifyFinalState =
    alertTypeText.includes("paid") ||
    alertTypeText.includes("captured") ||
    alertTypeText.includes("success") ||
    alertTypeText.includes("failed") ||
    alertTypeText.includes("completed");
  const baseMessage = {
    notification: {
      title: input.title,
      body: input.body,
    },
    data: {
      type: "smart_alert",
      alertType: String(input.alertType || "smart_alert"),
      eventId: String(input.eventId || `order-push-${Date.now()}`),
      notificationTag: String(input.eventId || `order-push-${Date.now()}`),
      url: String(url || "/"),
      click_action: String(url || "/"),
      title: String(input.title || "تنبيه"),
      body: String(input.body || ""),
      orderId: String(input.orderId || ""),
      invoiceId: String(input.invoiceId || ""),
    },
    webpush: {
      headers: {
        Urgency: "high",
        TTL: isPaymentAlert ? "300" : "900",
      },
      fcmOptions: {
        link: url,
      },
      notification: {
        title: input.title,
        body: input.body,
        icon: "/ios-icon-192-v6.png",
        badge: "/ios-icon-192-v6.png",
        tag: input.eventId,
        renotify: shouldRenotifyFinalState,
        requireInteraction: true,
        data: {
          url,
          eventId: input.eventId,
          notificationTag: input.eventId,
          alertType: input.alertType,
        },
      },
    },
  };

  const tokenBatches: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) tokenBatches.push(tokens.slice(i, i + 500));

  let batchResponses: any[] = [];
  let response: any;
  try {
    batchResponses = await Promise.all(
      tokenBatches.map(async (batchTokens) => ({
        tokens: batchTokens,
        response: await adminMessaging.sendEachForMulticast({ ...baseMessage, tokens: batchTokens }),
      }))
    );
    response = {
      successCount: batchResponses.reduce((sum, item) => sum + item.response.successCount, 0),
      failureCount: batchResponses.reduce((sum, item) => sum + item.response.failureCount, 0),
      responses: batchResponses.flatMap((item) => item.response.responses),
    };
  } catch (sendError: any) {
    await eventRef.set({
      status: "send_error",
      error: sendError?.message || String(sendError),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Delivery-only safety: do not leave a claimed event blocking the admin alert worker retry.
    await eventRef.delete().catch(() => undefined);
    throw sendError;
  }

  if (response.failureCount > 0) {
    const batch = adminDb.batch();
    let changed = 0;
    batchResponses.forEach(({ tokens: batchTokens, response: batchResponse }) => {
      batchResponse.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            batch.update(adminDb!.collection("pushTokens").doc(batchTokens[idx]), {
              active: false,
              disabledAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            changed += 1;
          }
        }
      });
    });
    if (changed > 0) {
      void batch.commit().catch((cleanupError: any) => console.warn("[ORDER PUSH CLEANUP]", cleanupError?.message || cleanupError));
    }
  }

  const result = {
    success: true,
    tokensCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
  };

  await eventRef.set({
    status: response.successCount > 0 ? "sent" : "send_failed",
    result,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  if (response.successCount <= 0) {
    // Delivery-only safety: if FCM accepted nothing, do not block the fallback alert worker.
    await eventRef.delete().catch(() => undefined);
  }

  return result;
}


function normalizePaymentLookupId(value: any): string {
  if (value === undefined || value === null) return "";
  let text = String(value).trim();
  if (!text) return "";
  try { text = decodeURIComponent(text); } catch {}
  if (text.includes("?")) text = text.split("?")[0];
  return text.trim().toUpperCase();
}

function paymentRecordMatches(record: any, targetId: any): boolean {
  const target = normalizePaymentLookupId(targetId);
  if (!record || !target) return false;
  const fields = [
    record.id,
    record.orderId,
    record.order_id,
    record.orderNumber,
    record.invoiceId,
    record.invoice_id,
    record.invoiceNo,
    record.invoiceNumber,
    record.paymentId,
    record.payment_id,
    record.referenceId,
    record.trackId,
    record.TrackID,
  ];
  const candidates = fields.map(normalizePaymentLookupId).filter(Boolean);
  return candidates.some((candidate) =>
    candidate === target ||
    candidate.replace(/[^A-Z0-9]/g, "") === target.replace(/[^A-Z0-9]/g, "")
  );
}

async function syncRootPaymentDocsFast(orderId: string, isSuccess: boolean, providerData: any) {
  if (!adminDb || !orderId) return;
  const cleanId = normalizePaymentLookupId(orderId);
  if (!cleanId) return;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const patch: any = isSuccess
    ? {
        status: "تم الدفع بنجاح",
        paymentStatus: "paid",
        payment_status: "paid",
        paid: true,
        failed: false,
        canPay: false,
        paidAt: now,
        paymentUpdatedAt: now,
        updatedAt: now,
      }
    : {
        status: "فشل في عملية الدفع",
        paymentStatus: "failed",
        payment_status: "failed",
        failed: true,
        paid: false,
        canPay: true,
        failedAt: now,
        paymentUpdatedAt: now,
        updatedAt: now,
      };

  const transactionId = providerData?.reference?.id || providerData?.TrackID || providerData?.order_id || providerData?.track_id || "";
  if (transactionId) {
    patch.transactionId = transactionId;
    patch.paymentId = transactionId;
    patch.payment_id = transactionId;
  }

  const updateIfExists = async (ref: any) => {
    const snap = await ref.get();
    if (!snap.exists) return;
    const current = snap.data() || {};
    if (!isSuccess && (current.paymentStatus === "paid" || String(current.status || "").includes("تم الدفع"))) return;
    await ref.set(patch, { merge: true });
  };

  try {
    await Promise.all([
      updateIfExists(adminDb.collection("orders").doc(cleanId)),
      updateIfExists(adminDb.collection("invoices").doc(cleanId)),
      adminDb.collection("orders").where("linkedInvoiceId", "==", cleanId).limit(20).get().then((snap: any) =>
        Promise.all(snap.docs.map((docSnap: any) => updateIfExists(docSnap.ref)))
      ),
      adminDb.collection("invoices").where("linkedOrderId", "==", cleanId).limit(20).get().then((snap: any) =>
        Promise.all(snap.docs.map((docSnap: any) => updateIfExists(docSnap.ref)))
      ),
    ]);
  } catch (error: any) {
    console.warn("[PAYMENT_UPDATE] Fast root payment sync skipped:", error?.message || String(error));
  }
}

async function handlePaymentUpdate(orderId: string, splitId: string, isSuccess: boolean, providerData: any) {
  console.log(`[PAYMENT_UPDATE] Processing Order:${orderId} Split:${splitId} Success:${isSuccess}`);
  const directPushes: any[] = [];
  const fastOrderId = String(orderId || "").includes("-S-")
    ? String(orderId || "").split("-S-")[0]
    : String(orderId || "");
  if (!splitId && !String(orderId || "").includes("-S-")) {
    void syncRootPaymentDocsFast(fastOrderId, isSuccess, providerData);
  }
  
  const ok = await updateAppDataAtomically((appData) => {
      let orders = [...(appData.orders || [])];
      let invoices = [...(appData.invoices || [])];
      let customers = [...(appData.customers || [])];
      
      let baseId = String(orderId).toUpperCase();
      let sId = splitId;
      let isSplit = !!sId;
      
      if (baseId.includes("-S-")) {
        isSplit = true;
        const parts = baseId.split("-S-");
        baseId = parts[0];
        if (!sId) sId = parts[1];
      }

      let updated = false;

      // Handle Orders
      const oIdx = orders.findIndex((o: any) => paymentRecordMatches(o, baseId));
      if (oIdx !== -1) {
        if (isSplit) {
          if (!orders[oIdx].splitPayments) orders[oIdx].splitPayments = [];
          const sIdx = orders[oIdx].splitPayments.findIndex((s: any) => {
            const sid = String(s.id).toUpperCase();
            const target = String(sId).toUpperCase();
            return sid === target || sid === `S-${target}` || target.includes(sid);
          });
          
          if (sIdx !== -1) {
            const currentStatus = String(orders[oIdx].splitPayments[sIdx].status || "").toLowerCase();
            if (isSuccess && currentStatus !== "paid") {
              orders[oIdx].splitPayments[sIdx].status = "paid";
              orders[oIdx].splitPayments[sIdx].paymentId = providerData?.reference?.id || providerData?.TrackID || "upayments_auth";
              orders[oIdx].splitPayments[sIdx].datePaid = new Date().toISOString();
              
              // Update customer totalSpent
              const cPhone = cleanPhone(orders[oIdx].splitPayments[sIdx].phone);
              if (cPhone) {
                const custIdx = customers.findIndex((c: any) => cleanPhone(c.phone) === cPhone);
                if (custIdx !== -1) {
                  customers[custIdx].totalSpent = (Number(customers[custIdx].totalSpent) || 0) + (Number(orders[oIdx].splitPayments[sIdx].amount) || 0);
                  customers[custIdx].lastUpdated = new Date().toISOString();
                } else {
                  customers.push({
                    id: "CUST-" + Date.now().toString(36),
                    name: orders[oIdx].splitPayments[sIdx].name || "صديق عميل",
                    phone: orders[oIdx].splitPayments[sIdx].phone,
                    createdAt: new Date().toISOString(),
                    totalSpent: Number(orders[oIdx].splitPayments[sIdx].amount) || 0,
                    loyaltyPoints: 0,
                  });
                }
              }
              
              // Check if order fully paid
              const splitSummary = calculateSplitPaymentSummary(orders[oIdx]);
              orders[oIdx].paidAmount = splitSummary.paidAmount;
              orders[oIdx].remainingAmount = splitSummary.remainingAmount;

              if (splitSummary.isFullyPaid) {
                orders[oIdx].status = "تم الدفع بنجاح";
                orders[oIdx].paymentStatus = "paid";
                orders[oIdx].paidAt = new Date().toISOString();
                directPushes.push({
                  eventId: `safe-worker-qatia-completed-${orders[oIdx].id}`,
                  title: "✅ اكتملت القطية",
                  body: `اكتملت القطية للطلب ${orders[oIdx].id} — تم الدفع بنجاح${Number(orders[oIdx].total) ? ` — القيمة ${Number(orders[oIdx].total).toFixed(3)} د.ك` : ""}`,
                  alertType: "qatia_completed",
                  orderId: orders[oIdx].id,
                });
                
                // Distribute points ONLY when fully paid
                orders[oIdx].splitPayments.filter((s: any) => s.status === "paid").forEach((p: any) => {
                  const cp = cleanPhone(p.phone);
                  const eIdx = customers.findIndex(c => cleanPhone(c.phone) === cp);
                  if (eIdx !== -1) {
                    customers[eIdx].loyaltyPoints = (Number(customers[eIdx].loyaltyPoints) || 0) + (Number(p.amount) || 0);
                  }
                });
              } else {
                orders[oIdx].status = "بانتظار اكتمال القطية";
                orders[oIdx].paymentStatus = "partial";
              }
              updated = true;
            } else if (!isSuccess && currentStatus !== "paid") {
              orders[oIdx].splitPayments[sIdx].status = "failed";
              updated = true;
            }
          }
        } else {
          // Regular Order
          const currentStatus = orders[oIdx].status;
          if (isSuccess) {
            if (orders[oIdx].paymentStatus !== "paid") {
              orders[oIdx].status = "تم الدفع بنجاح";
              orders[oIdx].paymentStatus = "paid";
              orders[oIdx].paidAt = new Date().toISOString();
              orders[oIdx].transactionId = providerData?.reference?.id || providerData?.TrackID || "upayments_auth";
              directPushes.push({
                eventId: `safe-worker-payment-paid-${orders[oIdx].id}`,
                title: "✅ تم دفع طلب",
                body: `تم دفع الطلب ${orders[oIdx].id}${Number(orders[oIdx].total) ? ` — القيمة ${Number(orders[oIdx].total).toFixed(3)} د.ك` : ""}`,
                alertType: "payment_paid",
                orderId: orders[oIdx].id,
              });
              
              // Loyalty points
              const cPhone = cleanPhone(orders[oIdx].customerPhone);
              if (cPhone) {
                const custIdx = customers.findIndex(c => cleanPhone(c.phone) === cPhone);
                if (custIdx !== -1) {
                   const amount = Number(orders[oIdx].total) || 0;
                   customers[custIdx].totalSpent = (Number(customers[custIdx].totalSpent) || 0) + amount;
                   customers[custIdx].loyaltyPoints = (Number(customers[custIdx].loyaltyPoints) || 0) + amount;
                   customers[custIdx].lastUpdated = new Date().toISOString();
                }
              }
              updated = true;
            }
          } else if (currentStatus === "جديد" || currentStatus === "بانتظار الدفع") {
             orders[oIdx].status = "فشل في عملية الدفع";
             orders[oIdx].paymentStatus = "failed";
             directPushes.push({
               eventId: `safe-worker-payment-failed-${orders[oIdx].id}`,
               title: "❌ فشل دفع طلب",
               body: `فشل دفع الطلب ${orders[oIdx].id}${Number(orders[oIdx].total) ? ` — القيمة ${Number(orders[oIdx].total).toFixed(3)} د.ك` : ""}`,
               alertType: "payment_failed",
               orderId: orders[oIdx].id,
             });
             updated = true;
          }
        }
      }

      // Handle Invoices
      invoices.forEach((inv: any) => {
        if (paymentRecordMatches(inv, baseId)) {
          if (isSuccess && inv.paymentStatus !== "paid") {
            inv.status = "تم الدفع بنجاح";
            inv.paymentStatus = "paid";
            inv.paidAt = new Date().toISOString();
            inv.paymentUpdatedAt = new Date().toISOString();
            inv.transactionId = providerData?.reference?.id || providerData?.TrackID || providerData?.order_id || "upayments_auth";
            directPushes.push({
              eventId: `safe-worker-invoice-paid-${inv.id}`,
              title: "✅ تم دفع فاتورة",
              body: `تم دفع الفاتورة ${inv.id}${Number(inv.totalAmount ?? inv.total ?? inv.amount) ? ` — القيمة ${Number(inv.totalAmount ?? inv.total ?? inv.amount).toFixed(3)} د.ك` : ""}`,
              alertType: "invoice_paid",
              invoiceId: inv.id,
            });
            updated = true;
          } else if (!isSuccess && (inv.status === "جديد" || inv.status === "بانتظار الدفع")) {
            inv.status = "فشل في عملية الدفع";
            inv.paymentStatus = "failed";
            inv.paymentUpdatedAt = new Date().toISOString();
            inv.transactionId = providerData?.reference?.id || providerData?.TrackID || providerData?.order_id || "upayments_auth";
            directPushes.push({
              eventId: `safe-worker-invoice-failed-${inv.id}`,
              title: "❌ فشلت عملية الدفع",
              body: `فشلت عملية الدفع للفاتورة ${inv.id}${Number(inv.totalAmount ?? inv.total ?? inv.amount) ? ` — القيمة ${Number(inv.totalAmount ?? inv.total ?? inv.amount).toFixed(3)} د.ك` : ""}`,
              alertType: "invoice_payment_failed",
              invoiceId: inv.id,
            });
            updated = true;
          }
        }
      });

      if (updated) {
        return { orders, invoices, customers };
      }
      return null;
  }, ["orders", "invoices", "customers"]);

  if (ok) {
    _appDataCache = null;
    _appDataCacheTime = 0;
    _appDataKeyedCache.clear();
    if (directPushes.length > 0) {
      void Promise.allSettled(
        directPushes.map(async (push) => {
          try {
            const result = await sendAdminPushDirectOnce(push);
            console.log(`[PAYMENT_UPDATE] Direct admin push ${push.eventId}:`, JSON.stringify(result));
          } catch (pushError: any) {
            console.warn(`[PAYMENT_UPDATE] Direct admin push failed ${push.eventId}:`, pushError?.message || String(pushError));
          }
        }),
      );
    }
    console.log(`[PAYMENT_UPDATE] Successfully processed Order:${orderId}`);
  } else {
    console.error(`[PAYMENT_UPDATE] Concurrency error or logical failure for Order:${orderId}`);
  }
}


export async function getAppDataRef() {
  const data = await getAppData();
  return {
    exists: () => true,
    data: () => data
  };
}

// Helper to clean phone numbers
function cleanPhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");

  // If it starts with 965 and is longer than 8 digits, it's a full country code
  if (cleaned.startsWith("965") && cleaned.length > 8) {
    cleaned = cleaned.slice(3);
  }

  // Kuwait numbers are 8 digits. Take the last 8 digits available to be safe.
  if (cleaned.length >= 8) {
    return cleaned.slice(-8);
  }
  return cleaned;
}

function makeDiwaniyaNotification(input: any) {
  const now = new Date().toISOString();
  return {
    id: "DN-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
    type: input.type || "diwaniya",
    squadId: input.squadId ? String(input.squadId) : "",
    squadName: input.squadName || "",
    toPhone: cleanPhone(input.toPhone || ""),
    fromPhone: cleanPhone(input.fromPhone || ""),
    fromName: input.fromName || "",
    title: input.title || "تنبيه من الديوانية",
    message: input.message || "",
    meta: input.meta || {},
    createdAt: now,
    readAt: null
  };
}

function pushDiwaniyaNotification(list: any[], input: any) {
  const n = makeDiwaniyaNotification(input);
  if (!n.toPhone) return list;
  return [n, ...(Array.isArray(list) ? list : [])].slice(0, 300);
}

function pushDiwaniyaNotifications(list: any[], inputs: any[]) {
  return (inputs || []).reduce((acc, item) => pushDiwaniyaNotification(acc, item), Array.isArray(list) ? list : []);
}

const IMPORTANT_DIWANIYA_PUSH_TYPES = new Set([
  "join_request",
  "presence_in",
  "qatya_request",
  "wobble_alert",
  "roulette_result",
]);

function normalizePushUrl(url: any) {
  const value = String(url || "").trim();
  if (!value) return "/";
  if (value.startsWith("http")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

async function sendDiwaniyaExternalPush(input: {
  toPhones: any[];
  title: string;
  body: string;
  type: string;
  url?: string;
  orderId?: string;
  squadId?: string;
}) {
  if (!adminMessaging || !IMPORTANT_DIWANIYA_PUSH_TYPES.has(String(input.type || ""))) {
    return { success: false, skipped: true, reason: "messaging-disabled-or-type-muted" };
  }

  const phones = new Set((input.toPhones || []).map(cleanPhone).filter(Boolean));
  if (!phones.size) return { success: false, skipped: true, reason: "no-recipients" };

  try {
    const appData = await getAppData();
    const tokens = (Array.isArray(appData.diwaniyaPushTokens) ? appData.diwaniyaPushTokens : [])
      .filter((item: any) => phones.has(cleanPhone(item?.phone)))
      .filter((item: any) => item?.active !== false && item?.token)
      .filter((item: any) => {
        const prefs = item?.prefs || {};
        if (input.type === "join_request") return true;
        if (input.type === "presence_in") return prefs.presence !== false;
        if (input.type === "qatya_request") return prefs.qatya !== false;
        if (input.type === "roulette_result") return prefs.roulette !== false;
        return false;
      });

    const uniqueTokens = [...new Set(tokens.map((item: any) => String(item.token)).filter(Boolean))] as string[];
    if (!uniqueTokens.length) return { success: false, skipped: true, reason: "no-active-tokens" };

    const pushUrl = normalizePushUrl(input.url);
    const pushEventId = `diwaniya-${input.type}-${input.orderId || input.squadId || Date.now()}`;
    const baseMessage = {
      notification: {
        title: input.title,
        body: input.body,
      },
      data: {
        type: String(input.type || "diwaniya"),
        url: pushUrl,
        click_action: pushUrl,
        orderId: String(input.orderId || ""),
        squadId: String(input.squadId || ""),
        eventId: pushEventId,
        notificationTag: pushEventId,
        title: String(input.title || ""),
        body: String(input.body || ""),
      },
      webpush: {
        headers: {
          Urgency: input.type === "presence_in" ? "normal" : "high",
          TTL: input.type === "presence_in" ? "120" : "600",
        },
        fcmOptions: {
          link: pushUrl,
        },
        notification: {
          icon: "/icon-192.png",
          badge: "/icon-180.png",
          tag: pushEventId,
          renotify: input.type !== "presence_in",
          requireInteraction: input.type === "qatya_request",
          silent: input.type === "presence_in",
        },
      },
    };

    const tokenBatches: string[][] = [];
    for (let i = 0; i < uniqueTokens.length; i += 500) tokenBatches.push(uniqueTokens.slice(i, i + 500));
    const batchResponses = await Promise.all(
      tokenBatches.map(async (batchTokens) => ({
        tokens: batchTokens,
        response: await adminMessaging.sendEachForMulticast({ ...baseMessage, tokens: batchTokens }),
      }))
    );
    const response = {
      successCount: batchResponses.reduce((sum, item) => sum + item.response.successCount, 0),
      failureCount: batchResponses.reduce((sum, item) => sum + item.response.failureCount, 0),
      responses: batchResponses.flatMap((item) => item.response.responses),
    };

    const invalidTokens = batchResponses.flatMap(({ tokens: batchTokens, response: batchResponse }) =>
      batchResponse.responses
        .map((r, idx) => {
          if (r.success) return "";
          const code = (r.error as any)?.code || "";
          return (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) ? batchTokens[idx] : "";
        })
        .filter(Boolean)
    );
    if (invalidTokens.length > 0) {
      await updateAppDataAtomically((current) => {
        const bad = new Set(invalidTokens);
        const currentTokens = Array.isArray(current.diwaniyaPushTokens) ? current.diwaniyaPushTokens : [];
        return {
          diwaniyaPushTokens: currentTokens.map((item: any) =>
            bad.has(String(item.token)) ? { ...item, active: false, disabledAt: new Date().toISOString() } : item
          )
        };
      });
    }

    return { success: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (error: any) {
    console.warn("[DIWANIYA_PUSH] send skipped:", error?.message || String(error));
    return { success: false, error: error?.message || String(error) };
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  console.log(`[STARTUP] Using PORT: ${PORT}`);
  console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[STARTUP] DEFAULT_APP_PORT: ${process.env.DEFAULT_APP_PORT}`);

  app.use(express.json());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  });

  app.post("/api/diwaniya-push/register", async (req, res) => {
    try {
      const { phone, token, squadId, prefs, userAgent, platform, standalone, notificationPermission, currentUrl } = req.body || {};
      const clean = cleanPhone(phone);
      const cleanToken = String(token || "").trim();
      if (!clean || !cleanToken) return res.status(400).json({ error: "Missing phone or token" });

      const ok = await updateAppDataAtomically((current) => {
        const tokens = Array.isArray(current.diwaniyaPushTokens) ? [...current.diwaniyaPushTokens] : [];
        const now = new Date().toISOString();
        const nextPrefs = {
          qatya: prefs?.qatya !== false,
          roulette: prefs?.roulette !== false,
        };
        const idx = tokens.findIndex((item: any) => String(item.token) === cleanToken);
        const entry = {
          phone: clean,
          token: cleanToken,
          squadId: squadId ? String(squadId) : "",
          prefs: nextPrefs,
          active: true,
          userAgent: String(userAgent || "").slice(0, 300),
          platform: String(platform || "").slice(0, 40),
          standalone: Boolean(standalone),
          notificationPermission: String(notificationPermission || "").slice(0, 40),
          currentUrl: String(currentUrl || "").slice(0, 300),
          updatedAt: now,
          createdAt: idx >= 0 ? tokens[idx].createdAt || now : now,
        };
        if (idx >= 0) tokens[idx] = { ...tokens[idx], ...entry };
        else tokens.unshift(entry);
        return { diwaniyaPushTokens: tokens.slice(0, 1200) };
      });

      if (!ok) return res.status(500).json({ error: "Failed to save push token" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/diwaniya-push/unregister", async (req, res) => {
    try {
      const { phone, token } = req.body || {};
      const clean = cleanPhone(phone);
      const cleanToken = String(token || "").trim();
      const ok = await updateAppDataAtomically((current) => {
        const tokens = Array.isArray(current.diwaniyaPushTokens) ? [...current.diwaniyaPushTokens] : [];
        return {
          diwaniyaPushTokens: tokens.map((item: any) => {
            const matchesToken = cleanToken && String(item.token) === cleanToken;
            const matchesPhone = !cleanToken && clean && cleanPhone(item.phone) === clean;
            return matchesToken || matchesPhone ? { ...item, active: false, disabledAt: new Date().toISOString() } : item;
          })
        };
      });
      if (!ok) return res.status(500).json({ error: "Failed to disable push token" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error) });
    }
  });
  app.use(express.urlencoded({ extended: true }));

  // API Routes

  // 1. Track Orders
  app.get("/api/appdata", async (req, res) => {
  try {
    const d = await getAppDataRef();
    res.json(d.exists() ? d.data() : {});
  } catch(e) {
    res.status(500).json({});
  }
});

app.patch("/api/appdata", async (req, res) => {
  try {
    await updateAppData(req.body);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({});
  }
});

app.get("/api/debug/order/:id", async (req, res) => {
    try {
      const dbData = await getAppDataRef();
      const data = dbData.exists() ? dbData.data() : {};
      const order = (data.orders || []).find((o: any) => o.id === req.params.id) 
                 || (data.invoices || []).find((i: any) => i.id === req.params.id);
      res.json(order || { error: "not found" });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/track-orders", async (req, res) => {
    const { phone, order_id } = req.query;
    if (!phone && !order_id) {
      return res
        .status(400)
        .json({ error: "Phone number or Order ID required" });
    }

    try {
      const cleanQueryPhone = phone ? cleanPhone(phone) : null;

      const appData = await getAppDataForKeys(["orders", "invoices", "customers", "products", "supplierCopies"]);

      const allOrdersOriginal = appData.orders || [];
      const now = Date.now();
      const TIMEOUT = 90 * 60 * 1000;
      let expiredIds: string[] = [];

      allOrdersOriginal.forEach((o: any) => {
        if (o.status === "قيد تجميع القطية" && o.createdAt) {
          const created = new Date(o.createdAt).getTime();
          if (now - created > TIMEOUT) {
            expiredIds.push(o.id);
          }
        }
      });

      if (expiredIds.length > 0) {
        console.log(`[SPLIT] Timing out expired split payments: ${expiredIds.join(", ")}`);
        await updateAppDataAtomically((current) => {
          const updatedOrders = (current.orders || []).map((o: any) => {
            if (expiredIds.includes(o.id) && o.status === "قيد تجميع القطية") {
               return { ...o, status: "ملغي - انتهى وقت القطية" };
            }
            return o;
          });
          return { orders: updatedOrders };
        });
      }

      const allInvoices = (appData.invoices || []).map((inv: any) => ({
        ...inv,
        isInvoice: true,
      }));

      console.log(
        `DEBUG: Tracking orders for ${cleanQueryPhone} or order_id ${order_id}. Total shared orders: ${allOrdersOriginal.length}, invoices: ${allInvoices.length}`,
      );

      const customers = appData.customers || [];
      const matchingCustomerIds = customers
        .filter(
          (c: any) =>
            cleanQueryPhone && cleanPhone(c.phone) === cleanQueryPhone,
        )
        .map((c: any) => c.id);

      // Filter function
      const filterFn = (item: any) => {
        let match = false;
        if (cleanQueryPhone) {
          const itemPhone = cleanPhone(
            item.customerPhone ||
              item.phone ||
              (item.address && item.address.phone),
          );
          match =
            itemPhone === cleanQueryPhone ||
            (item.customerId && matchingCustomerIds.includes(item.customerId));

          // Allow participants in split payments to see it
          if (!match && item.splitPayments && Array.isArray(item.splitPayments)) {
            match = item.splitPayments.some((p: any) => cleanPhone(p.phone) === cleanQueryPhone);
          }

          // Allow participants in roulette to see it
          if (!match && item.splitParticipants && Array.isArray(item.splitParticipants)) {
            match = item.splitParticipants.some((p: any) => cleanPhone(p.phone) === cleanQueryPhone);
          }
        }
        if (!match && order_id) {
          let qid = String(order_id).trim().toUpperCase();
          
          let last4Match = "";
          if (qid.startsWith("ORD-") && qid.length >= 7) {
            last4Match = qid.replace("ORD-", "");
          } else if (qid.length === 4) {
            last4Match = qid;
          }

          match =
            String(item.id).toUpperCase() === qid ||
            String(item.linkedInvoiceId).toUpperCase() === qid ||
            String(item.invoiceId).toUpperCase() === qid ||
            (!!last4Match && String(item.id).toUpperCase().endsWith(last4Match)) ||
            (!!last4Match && item.invoiceId && String(item.invoiceId).toUpperCase().endsWith(last4Match)) ||
            (!!last4Match && item.linkedInvoiceId && String(item.linkedInvoiceId).toUpperCase().endsWith(last4Match));

          if (!match && qid.includes("-S-")) {
            const base = qid.split("-S-")[0];
            match = String(item.id).toUpperCase() === base;
          }
        }
        return match;
      };

      const matchedOrders = allOrdersOriginal.filter(filterFn);
      const matchedInvoices = allInvoices.filter(filterFn);
      const allMatched = [...matchedOrders, ...matchedInvoices];
      console.log(
        `DEBUG: Found matched orders: ${matchedOrders.length}, invoices: ${matchedInvoices.length}`,
      );

      const finalOrders = allMatched;

      // Calculate loyalty points from paid active invoices only, matching the Admin customer source.
      let points = 0;
      if (cleanQueryPhone) {
        const isPaid = (status?: string, paymentStatus?: string) => {
          const s = String(status || "").toLowerCase();
          const ps = String(paymentStatus || "").toLowerCase();
          return ps === 'paid' || s === 'paid' || s.includes('تم الدفع') || s.includes('تم التوصيل') || s === 'delivered' || s === 'completed' || s.includes('جاهز للتوصيل');
        };

        const activeInvoicesForPoints = allInvoices.filter((inv: any) => {
          const ph = cleanPhone(inv.customerPhone || inv.phone || "");
          return ph === cleanQueryPhone && isPaid(inv.status, inv.paymentStatus) && inv.deleted !== true && inv.isDeleted !== true;
        });
        const invoicesTotal = activeInvoicesForPoints.reduce((sum: number, inv: any) => sum + (Number(inv.total || inv.totalAmount || inv.amount || 0)), 0);

        points = Math.round(invoicesTotal);
      }

      // Sort by date descending
      finalOrders.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.date || 0).getTime();
        return dateB - dateA;
      });

      const isGlobalFreeDelivery = appData.settings?.isFreeDelivery === true;
      const freeDeliveryThreshold = Number(
        appData.settings?.freeDeliveryThreshold ||
          appData.settings?.freeDeliveryLimit ||
          0,
      );

      console.log(
        `DEBUG TrackOrders: Phone=${cleanQueryPhone}, GlobalFree=${isGlobalFreeDelivery}, Threshold=${freeDeliveryThreshold}`,
      );

      let needsPersistence = false;
      const populatedOrders = finalOrders.map((o: any) => {
        // Healing Logic: If paymentStatus is paid but status is stuck in split/roulette mode, auto-fix it
        if ((o.paymentStatus === 'paid' || o.status === 'paid' || (o.splitPayments && o.splitPayments.filter((sp:any) => sp.status === 'paid').reduce((sum:number, sp:any) => sum + (Number(sp.amount) || 0), 0) >= (Number(o.total) || 0) - 0.005)) && 
            (o.status === "قيد تجميع القطية" || o.status === "بانتظار الدفع" || o.status === "جديد")) {
          o.status = "تم الدفع بنجاح";
          o.paymentStatus = "paid";
          needsPersistence = true;
          
          if (!o.paidAt) {
             o.paidAt = new Date().toISOString();
          }

          // Add points to customer if healing for the first time
          const cPhone = cleanPhone(o.customerPhone);
          const cIdx = customers.findIndex((c: any) => cleanPhone(c.phone) === cPhone);
          if (cIdx !== -1) {
             const prevPoints = Number(customers[cIdx].loyaltyPoints) || 0;
             customers[cIdx].loyaltyPoints = prevPoints + (Number(o.total) || 0);
             if (cPhone === cleanQueryPhone) {
                 points = customers[cIdx].loyaltyPoints;
             }
          }

          console.log(`[HEALING] Order ${o.id} auto-corrected to paid status during tracking`);
        }
        
        const oDeliveryFeeOriginal = Number(
          o.deliveryFee ?? o.deliveryInfo?.finalPrice ?? 0,
        );
        const oTotalOriginal = Number(o.total ?? o.totalAmount ?? 0);
        const itemsTotalValue = Math.max(
          0,
          oTotalOriginal - oDeliveryFeeOriginal,
        );

        let shouldBeFree =
          o.isFreeDelivery || isGlobalFreeDelivery || o.deliveryType === "free";

        // Apply threshold dynamically even for old orders if tracked now
        if (
          !shouldBeFree &&
          freeDeliveryThreshold > 0 &&
          itemsTotalValue >= freeDeliveryThreshold
        ) {
          shouldBeFree = true;
        }

        const finalDeliveryFee = shouldBeFree ? 0 : oDeliveryFeeOriginal;
        const finalTotal = shouldBeFree ? itemsTotalValue : oTotalOriginal;

        let custName = o.customerName;
        let custPhone = o.customerPhone || o.phone;
        let custAddress = o.address;

        if (!custAddress || custAddress === "غير محدد" || custAddress === "") {
          if (o.deliveryInfo && o.deliveryInfo.zoneName) {
            custAddress = o.deliveryInfo.zoneName;
          }
        }

        const products = [
          ...(appData.products || []),
          ...(appData.supplierCopies || []),
        ];
        const populatedItems = (o.items || []).map((item: any) => {
          const prod = products.find(
            (p: any) => p.id === item.productId || p.id === item.id,
          );
          return {
            ...item,
            productName:
              item.productName ||
              item.name ||
              (prod ? prod.name : "منتج غير معروف"),
            name:
              item.name ||
              item.productName ||
              (prod ? prod.name : "منتج غير معروف"),
            price:
              item.price !== undefined
                ? item.price
                : item.priceAtTime !== undefined
                  ? item.priceAtTime
                  : prod
                    ? prod.price
                    : 0,
            image: item.image || (prod ? prod.image : null),
          };
        });

        if (
          o.customerId &&
          (!custName ||
            !custPhone ||
            !custAddress ||
            custAddress === "غير محدد" ||
            custAddress === "")
        ) {
          const c = customers.find((cust: any) => cust.id === o.customerId);
          if (c) {
            custName = custName || c.name || c.customerName;
            custPhone = custPhone || c.phone || c.customerPhone;
            if (
              !custAddress ||
              custAddress === "غير محدد" ||
              custAddress === ""
            ) {
              custAddress =
                typeof c.address === "object"
                  ? c.address?.region || "غير محدد"
                  : c.address || "غير محدد";
            }
          }
        }

        // Keep the full address object so the split page can display it
        const resolvedAddress =
          typeof custAddress === "object" && custAddress !== null
            ? custAddress
            : custAddress || "غير محدد";

        return {
          ...o,
          items: populatedItems,
          customerName: custName,
          customerPhone: custPhone,
          address: resolvedAddress,
          customerPoints: points,
          isFreeDelivery: shouldBeFree,
          deliveryType: shouldBeFree ? "free" : o.deliveryType,
          deliveryFee: finalDeliveryFee,
          total: finalTotal,
        };
      });

      if (needsPersistence) {
        // Find updated orders and merge into allOrders (which includes orders not being tracked)
        const mergedOrders = (appData.orders || []).map(o => {
          const match = populatedOrders.find(po => po.id === o.id);
          if (match && match.paymentStatus === 'paid') {
             return { ...o, status: match.status, paymentStatus: match.paymentStatus, paidAt: match.paidAt };
          }
          return o;
        });
        await updateAppData({ orders: mergedOrders, customers: customers });
      }

      res.json(populatedOrders);
    } catch (error) {
      console.error("Error tracking orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // 2. Regions
  app.get("/api/regions", async (req, res) => {
    try {
      const data = await getAppDataForKeys([]);
      res.json(data.zones || []);
    } catch (error) {
      console.error("Error fetching regions:", error);
      res.status(500).json({ error: "Failed to fetch regions" });
    }
  });

  // Admin Zones Management
  app.post("/api/admin/zones", async (req, res) => {
    try {
      const { name, finalPrice } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      const zones = appData.zones || [];

      const newZone = {
        id: "ZONE-" + Date.now().toString(36),
        name,
        finalPrice: Number(finalPrice) || 0,
        cost: Number(finalPrice) || 0,
        deliveryFee: Number(finalPrice) || 0,
        price: Number(finalPrice) || 0,
        deliveryPrice: Number(finalPrice) || 0,
      };

      zones.push(newZone);
      await updateAppData({ zones });
      res.status(201).json(newZone);
    } catch (e) {
      console.error("Error creating zone:", e);
      res.status(500).json({ error: "Failed to create zone" });
    }
  });

  app.patch("/api/admin/zones/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, finalPrice } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      const zones = appData.zones || [];

      const index = zones.findIndex((z: any) => z.id === id);
      if (index === -1)
        return res.status(404).json({ error: "Zone not found" });

      zones[index] = {
        ...zones[index],
        ...(name && { name }),
        ...(finalPrice !== undefined && {
          finalPrice: Number(finalPrice),
          cost: Number(finalPrice),
          deliveryFee: Number(finalPrice),
          price: Number(finalPrice),
          deliveryPrice: Number(finalPrice),
        }),
      };

      await updateAppData({ zones });
      res.json(zones[index]);
    } catch (e) {
      console.error("Error updating zone:", e);
      res.status(500).json({ error: "Failed to update zone" });
    }
  });

  app.delete("/api/admin/zones/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      const zones = appData.zones || [];

      const newZones = zones.filter((z: any) => z.id !== id);
      await updateAppData({ zones: newZones });
      res.json({ success: true });
    } catch (e) {
      console.error("Error deleting zone:", e);
      res.status(500).json({ error: "Failed to delete zone" });
    }
  });

  // Admin: Update Store Status
  app.patch("/api/admin/settings/storeStatus", async (req, res) => {
    try {
      const payload = req.body || {};
      const opening = payload.openingHours || payload.workingHours || payload.hours;
      await updateAppData({
        "settings.storeStatus": payload,
        "storeStatus": payload,
        ...(opening ? { "workingHours": opening, "openingHours": opening } : {})
      });
      res.json({ success: true });
    } catch (e) {
      console.error("Error updating store status:", e);
      res.status(500).json({ error: "Failed to update store status" });
    }
  });

  // Validate Promo Code
  app.post("/api/validate-promo", async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code is required" });

    try {
      const d = await getAppDataRef();
      if (!d.exists()) return res.status(404).json({ error: "No data found" });

      const data = d.data();
      const promo = (data.promocodes || []).find(
        (p: any) =>
          p.code.toUpperCase() === code.trim().toUpperCase() && p.isActive,
      );

      if (promo) {
        res.json({
          success: true,
          promo: {
            code: promo.code,
            type: promo.type, // 'percentage' or 'flat'
            value: promo.value || promo.discountValue,
            discountValue: promo.discountValue || promo.value,
          },
        });
      } else {
        res.json({ success: false, error: "كوبون غير صالح أو انتهت صلاحيته" });
      }
    } catch (e) {
      console.error("Error validating promo:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 3. Settings (fallback to shared_company_data)
  app.get("/api/settings", async (req, res) => {
    try {
      let settings: any = {};
      const data = await getAppDataForKeys([]);
      if (data) {
        settings = data.settings || {};
        const rootGeofenceDistance =
          data.squadGeofenceDistance ??
          data.diwaniyaGeofenceDistance ??
          data.geofenceDistance ??
          data.radarDistance ??
          data.radarGeofenceDistance;
        if (rootGeofenceDistance !== undefined && settings.squadGeofenceDistance === undefined) {
          settings.squadGeofenceDistance = rootGeofenceDistance;
        }
        if (settings.squadGeofenceDistance !== undefined) {
          settings.diwaniyaGeofenceDistance = settings.diwaniyaGeofenceDistance ?? settings.squadGeofenceDistance;
          settings.geofenceDistance = settings.geofenceDistance ?? settings.squadGeofenceDistance;
          settings.radarDistance = settings.radarDistance ?? settings.squadGeofenceDistance;
          settings.radarGeofenceDistance = settings.radarGeofenceDistance ?? settings.squadGeofenceDistance;
        }
        settings.loyaltyTiers = data.loyaltyTiers || [];
        settings.squadTiers = data.squadTiers || [];
        settings.diwaniyaTiers = data.diwaniyaTiers || data.squadTiers || [];
        settings.loyaltySettings = data.loyaltySettings || {};
        settings.productCategories = data.productCategories || settings.productCategories || [];
        settings.menuCategories = data.menuCategories || settings.menuCategories || [];

        // Ensure storeStatus and workingHours are attached
        const mergedStoreStatus = data.settings?.storeStatus || data.storeStatus || settings.storeStatus || {};
        const mergedOpeningHours = data.openingHours || data.workingHours || mergedStoreStatus?.openingHours || mergedStoreStatus?.workingHours;
        if (mergedOpeningHours && typeof mergedOpeningHours === "object") {
          mergedStoreStatus.openingHours = mergedOpeningHours;
          mergedStoreStatus.workingHours = mergedOpeningHours;
        }
        settings.storeStatus = mergedStoreStatus;

        // Include company info from root if it exists
        if (data.info) {
          settings = { ...settings, ...data.info };
        }

        // Fallback for phone numbers: check multiple possible sources
        if (!settings.companyPhone) {
          const fallback =
            settings.whatsapp ||
            settings.phone ||
            (settings.restaurantNumbers && settings.restaurantNumbers[0]);
          if (fallback) {
            settings.companyPhone = fallback;
          }
        }
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/admin/settings/loyaltyTiers", async (req, res) => {
    try {
      const { tiers } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      await setDoc(docRef, { loyaltyTiers: tiers }, { merge: true });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/settings/squadTiers", async (req, res) => {
    try {
      const { tiers } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      await setDoc(docRef, { squadTiers: tiers }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/settings/squadGeofenceDistance", async (req, res) => {
    try {
      const { distance } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      const normalizedDistance = Math.max(10, Math.min(100, Math.round(Number(distance) || 100)));
      await setDoc(docRef, { 
        squadGeofenceDistance: normalizedDistance,
        settings: { 
          squadGeofenceDistance: normalizedDistance 
        } 
      }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/settings/loyaltySettings", async (req, res) => {
    try {
      const { settings } = req.body;
      const docRef = doc(db, "appData", "shared_company_data");
      await setDoc(docRef, { loyaltySettings: settings }, { merge: true });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4. Customers
  app.get("/api/squad-gamification", async (req, res) => {
    let { phone, squadId } = req.query;
    try {
      const data = await getAppDataForKeys(["squads", "customers", "orders"]);
      const squads = data.squads || [];
      
      const customers = data.customers || [];
      const customerByPhone = new Map<string, any>();
      customers.forEach((customer: any) => {
        const phoneKey = cleanPhone(customer?.phone || "");
        if (phoneKey) customerByPhone.set(phoneKey, customer);
      });
      const squadTiersForPublic = Array.isArray(data.squadTiers) ? data.squadTiers : [];
      const getTierForPoints = (points: number) => {
        return [...squadTiersForPublic]
          .sort((a: any, b: any) => Number(a.minPoints ?? a.points ?? a.requiredPoints ?? 0) - Number(b.minPoints ?? b.points ?? b.requiredPoints ?? 0))
          .reverse()
          .find((tier: any) => points >= Number(tier.minPoints ?? tier.points ?? tier.requiredPoints ?? 0));
      };
      
      const enrichedSquads = squads.map((sq: any) => {
         let teamPoints = 0;
         const mappedMembers = (sq.membersList || []).map((m: any) => {
             const cust = customerByPhone.get(cleanPhone(m.phone));
             const realPoints = cust ? (cust.loyaltyPoints !== undefined ? cust.loyaltyPoints : (cust.points || 0)) : (m.points || 0);
             teamPoints += realPoints;
             return { ...m, orderCount: realPoints, points: realPoints };
         }).sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
         
         const computedTier = getTierForPoints(teamPoints);
         return {
            ...sq,
            points: teamPoints,
            totalPoints: teamPoints,
            teamPoints,
            totalOrders: teamPoints,
            tier: sq.tier || computedTier?.name || "",
            tierData: computedTier || null,
            membersList: mappedMembers
         };
      });

      const topSquads = [...enrichedSquads].sort((a,b) => b.totalOrders - a.totalOrders).slice(0, 5);

      const cleanQPhone = phone ? cleanPhone(phone as string) : null;
      let joinedSquadId = squadId ? String(squadId) : null;
      let userSquads: any[] = [];

      if (cleanQPhone) {
         // Gather any customer records or settings that link this user
         const myCustomerProfile = customerByPhone.get(cleanQPhone);
         const customerSquadIds = new Set([
           ...(myCustomerProfile?.squadIds || []).map(String),
           myCustomerProfile?.squadId ? String(myCustomerProfile.squadId) : ""
         ].filter(Boolean));

         // Find all squads the user is linked to (as member, owner, or via customer profile)
         userSquads = enrichedSquads.filter((sq: any) => {
            const isMemberInList = (sq.membersList || []).some((m: any) => cleanPhone(m.phone) === cleanQPhone);
            const isOwner = cleanPhone(sq.phone || "") === cleanQPhone || 
                            cleanPhone(sq.ownerPhone || "") === cleanQPhone || 
                            cleanPhone(sq.ownerPhoneLocal || "") === cleanQPhone;
            const isCustomerMember = customerSquadIds.has(String(sq.id));
            return isMemberInList || isOwner || isCustomerMember;
         });
         
         // If a squadId was requested, check if it's valid
         if (joinedSquadId) {
             const isMemberOfRequested = userSquads.some((sq: any) => String(sq.id) === joinedSquadId);
             // If not a member of requested, but is a member of others, maybe keep the requested one so they can view/join it.
         } else if (userSquads.length > 0) {
             // Auto-select the first one if no squadId requested
             joinedSquadId = String(userSquads[0].id);
         }
      }

      let mySquad = joinedSquadId ? enrichedSquads.find((sq: any) => String(sq.id) === String(joinedSquadId)) : null;

      let myRank = null;
      let myMemberData = null;

      if (mySquad && cleanQPhone) {
         const memberIndex = mySquad.membersList.findIndex((mem: any) => cleanPhone(mem.phone) === cleanQPhone);
         if (memberIndex !== -1) {
            myMemberData = { ...mySquad.membersList[memberIndex], isMember: true };
            myRank = memberIndex + 1;
         } else {
             // Check if they are the owner!
             const isOwnerOfSquad = cleanPhone(mySquad.phone || "") === cleanQPhone || 
                                    cleanPhone(mySquad.ownerPhone || "") === cleanQPhone || 
                                    cleanPhone(mySquad.ownerPhoneLocal || "") === cleanQPhone;
             if (isOwnerOfSquad) {
                myMemberData = { phone: cleanQPhone, name: mySquad.king || "أنت", orderCount: 0, points: 0, isMember: true };
                myRank = 1;
             } else {
                // زائر من رابط دعوة: نعرض الديوانية مع نموذج انضمام واضح بدل اعتبارها عضوية مكتملة.
                myMemberData = { phone: cleanQPhone, name: "أنت", orderCount: 0, points: 0, isMember: false };
                myRank = mySquad.membersList.length + 1;
             }
         }
      }

      // Geofencing data lookup
      const allGeofenceRequests = data.geofenceJoinRequests || [];
      const activeSquadsWithCoords = enrichedSquads
        .map((s: any) => {
          const rawLat = s.lat ?? s.latitude ?? s.location?.lat ?? s.location?.latitude;
          const rawLng = s.lng ?? s.longitude ?? s.location?.lng ?? s.location?.longitude;
          const latNum = Number(rawLat);
          const lngNum = Number(rawLng);
          if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
            return null;
          }
          return {
            ...s,
            lat: latNum,
            lng: lngNum,
            location: { ...(s.location || {}), lat: latNum, lng: lngNum },
          };
        })
        .filter(Boolean);
      
      let pendingGeofenceRequests: any[] = [];
      if (cleanQPhone) {
         // Show owner join requests for every diwaniya owned by this phone, even if another diwaniya is currently active.
         const ownedSquads = enrichedSquads.filter((sq: any) => cleanPhone(sq.phone || "") === cleanQPhone);
         const ownedSquadIds = new Set(ownedSquads.map((sq: any) => String(sq.id)));
         pendingGeofenceRequests = allGeofenceRequests
           .filter((r: any) => ownedSquadIds.has(String(r.squadId)) && r.status === "pending")
           .map((r: any) => {
             const reqSquad = ownedSquads.find((sq: any) => String(sq.id) === String(r.squadId));
             return { ...r, squadName: reqSquad?.name || r.squadName || "" };
           });
      }

      // Check user's own requests
      const myGeofenceRequests = cleanQPhone ? allGeofenceRequests.filter((r: any) => cleanPhone(r.phone) === cleanQPhone) : [];

      const allPresence = Array.isArray(data.squadPresence) ? data.squadPresence : [];
      const squadPresence = mySquad ? allPresence.filter((p: any) => String(p.squadId) === String(mySquad.id)) : [];
      const allGroupOrders = Array.isArray(data.squadGroupOrders) ? data.squadGroupOrders : [];
      const activeGroupOrder = mySquad ? allGroupOrders.find((g: any) => String(g.squadId) === String(mySquad.id) && g.status === "open") || null : null;
      const tempCodes = mySquad ? (Array.isArray(data.squadTempCodes) ? data.squadTempCodes : []).filter((c: any) => String(c.squadId) === String(mySquad.id) && new Date(c.expiresAt || 0).getTime() > Date.now()) : [];
      const allSquadOrders = mySquad ? (Array.isArray(data.orders) ? data.orders : [])
        .filter((o: any) => String(o.squadId || o.squadID || "") === String(mySquad.id))
        .filter((o: any) => Array.isArray(o.items || o.cart) && (o.items || o.cart).length > 0) : [];
      const activeQatyaOrders = cleanQPhone && mySquad ? allSquadOrders
        .filter((o: any) => {
          const splitTypeValue = String(o.splitType || "").toLowerCase();
          const qatiaTypeValue = String(o.qatiaType || o.qatyaType || "").toLowerCase();
          const splitOriginValue = String(o.splitOrigin || o.qatiaOrigin || "").toLowerCase();
          const payStatus = String(o.paymentStatus || "").toLowerCase();
          const orderStatus = String(o.status || "");
          const hasDiwaniyaParticipant = [
            ...(Array.isArray(o.splitPayments) ? o.splitPayments : []),
            ...(Array.isArray(o.splitParticipants) ? o.splitParticipants : []),
          ].some((m: any) => String(m?.source || "").toLowerCase().includes("diwaniya"));
          const isDiwaniyaQatya =
            qatiaTypeValue === "diwaniya" ||
            splitOriginValue.startsWith("diwaniya") ||
            hasDiwaniyaParticipant;
          if (!isDiwaniyaQatya) return false;
          const isSplit = Boolean(splitTypeValue && splitTypeValue !== "none") || payStatus === "split" || orderStatus.includes("قطية");
          const isClosed = payStatus === "paid" || orderStatus.startsWith("تم الدفع") || orderStatus.includes("ملغي") || orderStatus.includes("انتهى");
          const participants = [
            ...(Array.isArray(o.splitPayments) ? o.splitPayments : []),
            ...(Array.isArray(o.splitParticipants) ? o.splitParticipants : []),
          ];
          const belongsToMember = participants.some((m: any) => cleanPhone(m.phone || "") === cleanQPhone)
            || (mySquad.membersList || []).some((m: any) => cleanPhone(m.phone || "") === cleanQPhone);
          return isSplit && !isClosed && belongsToMember;
        })
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 3)
        .map((o: any) => {
          const paidAmount = (Array.isArray(o.splitPayments) ? o.splitPayments : [])
            .filter((p: any) => String(p.status || "").toLowerCase() === "paid")
            .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
          return {
            id: o.id,
            total: Number(o.total || 0),
            paidAmount,
            remainingAmount: Math.max(0, Number(o.total || 0) - paidAmount),
            createdAt: o.createdAt || "",
            squadId: o.squadId || o.squadID || "",
            squadName: o.squadName || mySquad.name || "",
            status: o.status || "",
          };
        }) : [];
      const squadOrders = allSquadOrders.slice(-10).reverse();
      const productCounter: Record<string, number> = {};
      squadOrders.forEach((o: any) => (o.items || o.cart || []).forEach((it: any) => { const n = it.name || it.title; if (n) productCounter[n] = (productCounter[n] || 0) + Number(it.quantity || 1); }));
      const favoriteItemName = Object.entries(productCounter).sort((a:any,b:any)=>b[1]-a[1])[0]?.[0] || "";
      const usualOrder = squadOrders[0] ? { items: squadOrders[0].items || squadOrders[0].cart || [], total: squadOrders[0].total || squadOrders[0].totalAmount || 0, orderId: squadOrders[0].id || squadOrders[0].orderId } : null;
      const squadBeautifulLog = mySquad ? { recentOrders: squadOrders.slice(0, 5), favoriteItemName, ordersCount: squadOrders.length, presentCount: squadPresence.length, savings: Number(mySquad.savings || mySquad.totalSavings || 0) } : null;
      const diwaniyaNotifications = cleanQPhone
        ? (Array.isArray(data.diwaniyaNotifications) ? data.diwaniyaNotifications : [])
            .filter((n: any) => cleanPhone(n.toPhone || "") === cleanQPhone)
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 30)
        : [];
      const unreadDiwaniyaNotifications = diwaniyaNotifications.filter((n: any) => !n.readAt).length;

      res.json({
         topSquads,
         mySquad,
         myRank,
         myMemberData,
         userSquads,
         activeSquads: activeSquadsWithCoords,
         pendingGeofenceRequests,
         myGeofenceRequests,
         squadPresence,
         activeGroupOrder,
         tempCodes,
         usualOrder,
         squadBeautifulLog,
         activeQatyaOrders,
         diwaniyaNotifications,
         unreadDiwaniyaNotifications
      });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/diwaniya-notifications/read", async (req, res) => {
    const { phone, notificationId, all } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Missing phone" });
    const cleanTarget = cleanPhone(phone);
    const now = new Date().toISOString();
    const ok = await updateAppDataAtomically((current: any) => {
      const notifications = Array.isArray(current.diwaniyaNotifications) ? [...current.diwaniyaNotifications] : [];
      const updated = notifications.filter((n: any) => {
        const belongs = cleanPhone(n.toPhone || "") === cleanTarget;
        const matchesId = notificationId ? String(n.id) === String(notificationId) : true;
        return !(belongs && (all || matchesId));
      });
      return { diwaniyaNotifications: updated };
    });
    if (!ok) return res.status(500).json({ error: "Failed to mark notifications" });
    res.json({ success: true });
  });

  app.post("/api/squad-set-location", async (req, res) => {
    const { squadId, phone, lat, lng, geofenceDistance } = req.body;
    if (!squadId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing squadId, lat, or lng" });
    }
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
      return res.status(400).json({ error: "Invalid location coordinates" });
    }
    try {
      let savedDistance = Number.isFinite(Number(geofenceDistance)) ? Number(geofenceDistance) : 100;
      const ok = await updateAppDataAtomically((current: any) => {
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const idx = squads.findIndex((s: any) => String(s.id) === String(squadId));
        if (idx > -1) {
          const settings = current.settings || current.appSettings || current.config || {};
          const maxDistanceCandidates = [
            settings?.maxSquadGeofenceDistance,
            settings?.maxDiwaniyaGeofenceDistance,
            settings?.squadGeofenceDistance,
            settings?.diwaniyaGeofenceDistance,
            settings?.geofenceDistance,
            settings?.radarDistance,
            settings?.radarGeofenceDistance,
            settings?.squadSettings?.maxGeofenceDistance,
            settings?.squadSettings?.geofenceDistance,
            settings?.settings?.maxSquadGeofenceDistance,
            settings?.settings?.maxDiwaniyaGeofenceDistance,
            settings?.settings?.squadGeofenceDistance,
            settings?.settings?.diwaniyaGeofenceDistance,
            settings?.settings?.geofenceDistance,
            settings?.settings?.radarDistance,
            settings?.settings?.radarGeofenceDistance,
          ];
          const numericMaxDistances = maxDistanceCandidates.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0);
          const maxAllowedDistance = Math.max(10, Math.round(numericMaxDistances.length ? Math.max(...numericMaxDistances) : 100));
          const fallbackDistance = Number(squads[idx]?.geofenceDistance ?? squads[idx]?.location?.geofenceDistance ?? 100);
          const requestedDistance = Number(geofenceDistance ?? fallbackDistance);
          const normalizedDistance = Math.max(10, Math.min(maxAllowedDistance, Math.round(Number.isFinite(requestedDistance) && requestedDistance > 0 ? requestedDistance : fallbackDistance || 100)));
          savedDistance = normalizedDistance;
          squads[idx] = {
            ...squads[idx],
            lat: parsedLat,
            lng: parsedLng,
            geofenceDistance: normalizedDistance,
            location: {
              ...(squads[idx]?.location || {}),
              lat: parsedLat,
              lng: parsedLng,
              geofenceDistance: normalizedDistance,
            },
          };
        }
        return { squads };
      }, ["squads"]);
      if (!ok) throw new Error("Failed to set squad location in database");
      res.json({ success: true, lat: parsedLat, lng: parsedLng, geofenceDistance: savedDistance });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-geofence-join-request", async (req, res) => {
    const { name, phone, squadId, distance } = req.body;
    if (!phone || !squadId) {
      return res.status(400).json({ error: "Missing phone or squadId" });
    }
    const cleanQPhone = cleanPhone(phone);
    if (cleanQPhone.length !== 8) return res.status(400).json({ error: "Invalid phone" });
    const cleanName = String(name || "").trim();
    const safeDistance = Number.isFinite(Number(distance)) ? Number(distance) : 0;
    try {
      let isAutoApproved = false;
      let squadOwnerPhone = "";
      
      const ok = await updateAppDataAtomically((current: any) => {
        const reqs = Array.isArray(current.geofenceJoinRequests) ? [...current.geofenceJoinRequests] : [];
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const squadIdx = squads.findIndex((s: any) => String(s.id) === String(squadId));
        if (squadIdx === -1) return null;
        
        const squad = { ...squads[squadIdx] };
        squad.membersList = Array.isArray(squad.membersList) ? [...squad.membersList] : [];
        const ownerPhone = cleanPhone(squad.phone || "");
        squadOwnerPhone = ownerPhone;
        const isOwner = ownerPhone === cleanQPhone;
        const isMember = squad.membersList.some((m: any) => cleanPhone(m.phone) === cleanQPhone);
        
        // Remove existing pending/rejected from same user for same squad to overwrite nicely
        const filtered = reqs.filter((r: any) => !(cleanPhone(r.phone) === cleanQPhone && String(r.squadId) === String(squadId)));
        
        if (isOwner || isMember) {
          isAutoApproved = true;
          // Add as member if owner and not yet in membersList
          if (isOwner && !isMember) {
            squad.membersList.push({
              phone: cleanQPhone,
              name: cleanName || "المعزب",
              points: 0,
              joinedAt: new Date().toISOString()
            });
            squad.members = squad.membersList.length;
            squads[squadIdx] = squad;
          }
          
          filtered.push({
            phone: cleanQPhone,
            name: cleanName || (isOwner ? "المعزب" : "عضو قريب"),
            squadId: String(squadId),
            distance: safeDistance,
            timestamp: new Date().toISOString(),
            status: "approved"
          });
          
          const diwaniyaNotifications = pushDiwaniyaNotification(current.diwaniyaNotifications || [], {
            type: "join_approved",
            squadId,
            squadName: squad?.name || "",
            toPhone: cleanQPhone,
            fromPhone: ownerPhone,
            fromName: "الديوانية",
            title: "تم تفريش السجادة 🎉",
            message: isOwner ? "تم تفعيل موقعك الافتراضي ونزولك على سجادة ديوانيتك يا معزب!" : "أهلاً بك مجدداً في ديوانيتك! تم رصد وجودك ودخولك تلقائياً.",
            meta: { distance: safeDistance }
          });
          
          return { geofenceJoinRequests: filtered, squads, diwaniyaNotifications };
        } else {
          filtered.push({
            phone: cleanQPhone,
            name: cleanName || "عضو قريب",
            squadId: String(squadId),
            distance: safeDistance,
            timestamp: new Date().toISOString(),
            status: "pending"
          });
          
          const diwaniyaNotifications = pushDiwaniyaNotification(current.diwaniyaNotifications || [], {
            type: "join_request",
            squadId,
            squadName: squad?.name || "",
            toPhone: ownerPhone,
            fromPhone: cleanQPhone,
            fromName: cleanName || "عضو قريب",
            title: "واحد قريب من ديوانيتكم",
            message: `${cleanName || "أحد الربع"} ناطر موافقة المعزب.`,
            meta: { distance: safeDistance }
          });
          
          return { geofenceJoinRequests: filtered, diwaniyaNotifications };
        }
      }, ["squads"]);
      if (!ok) throw new Error("Failed to save geofence request");
      
      if (!isAutoApproved && squadOwnerPhone) {
        void sendDiwaniyaExternalPush({
          toPhones: [squadOwnerPhone],
          type: "join_request",
          title: "طلب دخول قريب",
          body: `${cleanName || "أحد الربع"} عند الديوانية وناطر موافقتك.`,
          squadId: String(squadId),
          url: "/?showSquads=true"
        });
      }
      res.json({ success: true, autoApproved: isAutoApproved });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-geofence-approve-request", async (req, res) => {
    const { phone, squadId, approved } = req.body;
    if (!phone || !squadId) return res.status(400).json({ error: "Missing phone or squadId" });
    try {
      const cleanTargetPhone = cleanPhone(phone);
      if (cleanTargetPhone.length !== 8) return res.status(400).json({ error: "Invalid phone" });
      let joinedSquad: any = null;
      const ok = await updateAppDataAtomically((current: any) => {
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const customers = Array.isArray(current.customers) ? [...current.customers] : [];
        const reqs = Array.isArray(current.geofenceJoinRequests) ? [...current.geofenceJoinRequests] : [];

        // Find and update status
        const rIdx = reqs.findIndex((r: any) => cleanPhone(r.phone) === cleanTargetPhone && String(r.squadId) === String(squadId));
        const requestObj = rIdx > -1 ? reqs[rIdx] : null;
        if (rIdx > -1) {
          reqs[rIdx] = { ...reqs[rIdx], status: approved ? "approved" : "rejected" };
        }

        if (approved) {
          let fIndex = squads.findIndex((s: any) => String(s.id) === String(squadId));
          if (fIndex > -1) {
            const squad = { ...squads[fIndex] };
            squad.membersList = Array.isArray(squad.membersList) ? [...squad.membersList] : [];
            const mIndex = squad.membersList.findIndex((m: any) => cleanPhone(m.phone) === cleanTargetPhone);
            if (mIndex === -1) {
              squad.membersList.push({
                phone: cleanTargetPhone,
                name: (requestObj ? requestObj.name : "") || "عضو قريب",
                points: 0,
                joinedAt: new Date().toISOString()
              });
            }
            squad.members = squad.membersList.length;
            squads[fIndex] = squad;
            joinedSquad = squad;

            // Update customer membership info
            const membership = { id: squad.id, squadId: squad.id, name: squad.name, joinedAt: new Date().toISOString() };
            const cidx = customers.findIndex((c: any) => cleanPhone(c.phone) === cleanTargetPhone);
            if (cidx > -1) {
              const ids = new Set([...(customers[cidx].squadIds || []), customers[cidx].squadId].filter(Boolean).map(String));
              ids.add(String(squad.id));
              customers[cidx] = {
                ...customers[cidx],
                name: (requestObj ? requestObj.name : "") || customers[cidx].name,
                squadId: squad.id,
                squadIds: [...ids],
                diwaniyaName: squad.name,
                diwaniyaMemberships: [...(customers[cidx].diwaniyaMemberships || []).filter((m: any) => String(m.squadId || m.id) !== String(squad.id)), membership]
              };
            } else {
              customers.push({
                id: "CUST-" + Date.now().toString(36),
                name: (requestObj ? requestObj.name : "") || "",
                phone: cleanTargetPhone,
                address: "",
                lastOrderDate: new Date().toISOString(),
                squadId: squad.id,
                squadIds: [String(squad.id)],
                diwaniyaName: squad.name,
                diwaniyaMemberships: [membership],
                loyaltyPoints: 0,
                points: 0
              });
            }
          }
        }

        const notifyTitle = approved ? "المعزب قبلك" : "طلبك ما تم";
        const notifyMessage = approved
          ? `دش ديوانية ${joinedSquad?.name || "ربعك"}، حياك.`
          : `المعزب ما قبل طلب دخول ديوانية ${requestObj?.squadName || "الربع"} الحين.`;
        const diwaniyaNotifications = pushDiwaniyaNotification(current.diwaniyaNotifications || [], {
          type: approved ? "join_approved" : "join_rejected",
          squadId,
          squadName: joinedSquad?.name || requestObj?.squadName || "",
          toPhone: cleanTargetPhone,
          fromPhone: joinedSquad?.phone || "",
          fromName: "المعزب",
          title: notifyTitle,
          message: notifyMessage
        });

        return { geofenceJoinRequests: reqs, squads, customers, diwaniyaNotifications };
      }, ["squads", "customers"]);
      if (!ok) throw new Error("Failed atomic transaction");
      res.json({ success: true, squad: joinedSquad });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });



  app.post("/api/squad-presence", async (req, res) => {
    const { squadId, phone, name, action, message } = req.body || {};
    if (!squadId || !phone || !action) return res.status(400).json({ error: "Missing squadId, phone, or action" });
    const normalizedAction = String(action || "").toLowerCase();
    if (!["in", "out", "wobble"].includes(normalizedAction)) return res.status(400).json({ error: "Invalid presence action" });
    const cleanTarget = cleanPhone(phone);
    if (cleanTarget.length !== 8) return res.status(400).json({ error: "Invalid phone" });
    const now = new Date().toISOString();
    let presence: any[] = [];
    const ok = await updateAppDataAtomically((current: any) => {
      const all = Array.isArray(current.squadPresence) ? [...current.squadPresence] : [];
      const squads = Array.isArray(current.squads) ? current.squads : [];
      const squad = squads.find((s: any) => String(s.id) === String(squadId));
      const filtered = all.filter((p: any) => !(String(p.squadId) === String(squadId) && cleanPhone(p.phone) === cleanTarget));
      if (normalizedAction === "in") {
        filtered.push({ squadId: String(squadId), phone: cleanTarget, name: name || "عضو", checkedInAt: now, lastSeenAt: now, isAuto: !!req.body.isAuto });
      } else if (normalizedAction === "wobble") {
        const existing = all.find((p: any) => String(p.squadId) === String(squadId) && cleanPhone(p.phone) === cleanTarget);
        if (existing) {
          filtered.push({
            ...existing,
            lastSeenAt: now,
            wobbleAt: now,
            wobbleMsg: message || "يا هلا بالربع! ☕"
          });
        } else {
          filtered.push({
            squadId: String(squadId),
            phone: cleanTarget,
            name: name || "عضو",
            checkedInAt: now,
            lastSeenAt: now,
            wobbleAt: now,
            wobbleMsg: message || "يا هلا بالربع! ☕"
          });
        }
      }
      presence = filtered.filter((p: any) => String(p.squadId) === String(squadId));
      const recipients = Array.from(new Set([
        squad?.phone,
        ...(squad?.membersList || []).map((m: any) => m.phone)
      ].map(cleanPhone).filter((ph: any) => ph && ph !== cleanTarget))) as string[];
      let diwaniyaNotifications = current.diwaniyaNotifications || [];
      if (normalizedAction === "in") {
        diwaniyaNotifications = pushDiwaniyaNotifications(diwaniyaNotifications, recipients.map((toPhone: string) => ({
            type: "presence_in",
            squadId,
            squadName: squad?.name || "",
            toPhone,
            fromPhone: phone,
            fromName: name || "عضو",
            title: "واحد من الربع وصل",
            message: `${name || "أحد الربع"} موجود بديوانية ${squad?.name || "الربع"}.`
        })));
      } else if (normalizedAction === "wobble") {
        diwaniyaNotifications = pushDiwaniyaNotifications(diwaniyaNotifications, recipients.map((toPhone: string) => ({
            type: "wobble_alert",
            squadId,
            squadName: squad?.name || "",
            toPhone,
            fromPhone: phone,
            fromName: name || "عضو",
            title: `تنبيه ديوانية ${squad?.name || "الربع"}`,
            message: message || `${name || "أحد الربع"} ينادي الربع.`
        })));
      }
      return { squadPresence: filtered, diwaniyaNotifications };
    }, ["squads"]);
    if (!ok) return res.status(500).json({ error: "Failed to update presence" });
    if (normalizedAction === "in" || normalizedAction === "wobble") {
      try {
        const current = await getAppDataForKeys(["squads"]);
        const squad = (Array.isArray(current.squads) ? current.squads : []).find((s: any) => String(s.id) === String(squadId));
        const recipients = Array.from(new Set([
          squad?.phone,
          ...(squad?.membersList || []).map((m: any) => m.phone)
        ].map(cleanPhone).filter((ph: any) => ph && ph !== cleanTarget)));
        if (recipients.length) {
          if (normalizedAction === "in") {
            void sendDiwaniyaExternalPush({
              toPhones: recipients,
              type: "presence_in",
              title: "واحد من الربع وصل",
              body: `${name || "أحد الربع"} دش ديوانية ${squad?.name || "الربع"}.`,
              squadId: String(squadId),
              url: "/?showSquads=true"
            });
          } else if (normalizedAction === "wobble") {
            void sendDiwaniyaExternalPush({
              toPhones: recipients,
              type: "wobble_alert",
              title: `نداء من ديوانية ${squad?.name || "الربع"}`,
              body: message || `${name || "أحد الربع"} ينادي الربع.`,
              squadId: String(squadId),
              url: "/?showSquads=true"
            });
          }
        }
      } catch {}
    }
    res.json({ success: true, presence });
  });

  app.post("/api/squad-temp-code", async (req, res) => {
    const { squadId, phone } = req.body || {};
    if (!squadId || !phone) return res.status(400).json({ error: "Missing squadId or phone" });
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    let entry: any = null;
    const ok = await updateAppDataAtomically((current: any) => {
      const squads = Array.isArray(current.squads) ? current.squads : [];
      const squad = squads.find((s: any) => String(s.id) === String(squadId));
      if (!squad || cleanPhone(squad.phone || "") !== cleanPhone(phone)) return null;
      const codes = Array.isArray(current.squadTempCodes) ? [...current.squadTempCodes] : [];
      const fresh = codes.filter((c: any) => !(String(c.squadId) === String(squadId) && cleanPhone(c.ownerPhone || "") === cleanPhone(phone)) && new Date(c.expiresAt || 0).getTime() > Date.now());
      entry = { squadId: String(squadId), code, ownerPhone: cleanPhone(phone), createdAt: new Date().toISOString(), expiresAt, usedBy: [] };
      fresh.push(entry);
      const diwaniyaNotifications = pushDiwaniyaNotification(current.diwaniyaNotifications || [], {
        type: "temp_code",
        squadId,
        squadName: squad?.name || "",
        toPhone: phone,
        fromPhone: phone,
        fromName: "المعزب",
        title: "كود الدخول جاهز",
        message: `كود ديوانية ${squad?.name || "ربعك"}: ${code}`,
        meta: { code, expiresAt }
      });
      return { squadTempCodes: fresh, diwaniyaNotifications };
    });
    if (!ok || !entry) return res.status(403).json({ error: "Only squad owner can create code" });
    res.json({ success: true, code, expiresAt });
  });

  app.post("/api/squad-join-temp-code", async (req, res) => {
    const { code, phone, name } = req.body || {};
    if (!code || !phone) return res.status(400).json({ error: "Missing code or phone" });
    const cleanTarget = cleanPhone(phone);
    let joinedSquad: any = null;
    const ok = await updateAppDataAtomically((current: any) => {
      const codes = Array.isArray(current.squadTempCodes) ? [...current.squadTempCodes] : [];
      const cIdx = codes.findIndex((c: any) => String(c.code) === String(code) && new Date(c.expiresAt || 0).getTime() > Date.now());
      if (cIdx < 0) return null;
      const squadId = codes[cIdx].squadId;
      const squads = Array.isArray(current.squads) ? [...current.squads] : [];
      const sIdx = squads.findIndex((s: any) => String(s.id) === String(squadId));
      if (sIdx < 0) return null;
      const squad = { ...squads[sIdx], membersList: Array.isArray(squads[sIdx].membersList) ? [...squads[sIdx].membersList] : [] };
      if (cleanPhone(squad.phone || codes[cIdx]?.ownerPhone || "") === cleanTarget) {
        return null;
      }
      if (!squad.membersList.some((m: any) => cleanPhone(m.phone) === cleanTarget)) {
        squad.membersList.push({ phone: cleanTarget, name: name || "عضو", points: 0, joinedAt: new Date().toISOString(), joinedByTempCode: String(code) });
      }
      squad.members = squad.membersList.length;
      squads[sIdx] = squad;
      joinedSquad = squad;
      codes[cIdx] = { ...codes[cIdx], usedBy: [...(codes[cIdx].usedBy || []), cleanTarget] };
      const customers = Array.isArray(current.customers) ? [...current.customers] : [];
      const cstIdx = customers.findIndex((c: any) => cleanPhone(c.phone) === cleanTarget);
      const membership = { id: squad.id, squadId: squad.id, name: squad.name, joinedAt: new Date().toISOString(), via: "tempCode" };
      if (cstIdx >= 0) {
        const ids = new Set([...(customers[cstIdx].squadIds || []), customers[cstIdx].squadId].filter(Boolean).map(String));
        ids.add(String(squad.id));
        customers[cstIdx] = { ...customers[cstIdx], name: name || customers[cstIdx].name, squadId: squad.id, squadIds: [...ids], diwaniyaName: squad.name, diwaniyaMemberships: [...(customers[cstIdx].diwaniyaMemberships || []).filter((m:any)=>String(m.squadId||m.id)!==String(squad.id)), membership] };
      } else {
        customers.push({ id: "CUST-" + Date.now().toString(36), name: name || "", phone: cleanTarget, address: "", lastOrderDate: new Date().toISOString(), squadId: squad.id, squadIds: [String(squad.id)], diwaniyaName: squad.name, diwaniyaMemberships: [membership], loyaltyPoints: 0, points: 0 });
      }
      const diwaniyaNotifications = pushDiwaniyaNotifications(current.diwaniyaNotifications || [], [
        {
          type: "temp_code_joined",
          squadId: squad.id,
          squadName: squad.name,
          toPhone: squad.phone || codes[cIdx]?.ownerPhone || "",
          fromPhone: phone,
          fromName: name || "عضو",
          title: "عضو دش بالكود",
          message: `${name || "أحد الربع"} دش ديوانية ${squad.name}.`
        },
        {
          type: "temp_code_join_success",
          squadId: squad.id,
          squadName: squad.name,
          toPhone: phone,
          fromPhone: squad.phone || "",
          fromName: "المعزب",
          title: "دشيت الديوانية",
          message: `ارتبطت بديوانية ${squad.name}.`
        }
      ]);
      return { squadTempCodes: codes, squads, customers, diwaniyaNotifications };
    });
    if (!ok || !joinedSquad) return res.status(404).json({ error: "الكود غير صحيح أو انتهت صلاحيته، أو لا يمكن للمعزب استخدام كود ديوانيته." });
    res.json({ success: true, squad: joinedSquad });
  });

  app.post("/api/squad-group-order", async (req, res) => {
    const { squadId, phone, name, action, item, participants, title } = req.body || {};
    if (!squadId || !phone) return res.status(400).json({ error: "Missing squadId or phone" });
    let groupOrder: any = null;
    const ok = await updateAppDataAtomically((current: any) => {
      const groupOrders = Array.isArray(current.squadGroupOrders) ? [...current.squadGroupOrders] : [];
      const squads = Array.isArray(current.squads) ? current.squads : [];
      const squad = squads.find((s: any) => String(s.id) === String(squadId));
      let idx = groupOrders.findIndex((g: any) => String(g.squadId) === String(squadId) && g.status === "open");
      if (action === "close") {
        if (idx >= 0) groupOrders[idx] = { ...groupOrders[idx], status: "closed", closedAt: new Date().toISOString() };
        groupOrder = idx >= 0 ? groupOrders[idx] : null;
        const recipients = (squad?.membersList || []).map((m: any) => m.phone).filter((ph: any) => ph && cleanPhone(ph) !== cleanPhone(phone));
        const diwaniyaNotifications = pushDiwaniyaNotifications(current.diwaniyaNotifications || [], recipients.map((toPhone: string) => ({
          type: "group_order_closed",
          squadId,
          squadName: squad?.name || "",
          toPhone,
          fromPhone: phone,
          fromName: name || "عضو",
          title: "طلب الربع تسكر",
          message: `طلب ديوانية ${squad?.name || "الربع"} تسكر.`
        })));
        return { squadGroupOrders: groupOrders, diwaniyaNotifications };
      }
      if (idx < 0) {
        groupOrders.push({ id: "SGO-" + Date.now().toString(36), squadId: String(squadId), title: title || "طلب الربع", status: "open", createdAt: new Date().toISOString(), ownerPhone: cleanPhone(phone), ownerName: name || "المعزب", items: [], participants: [] });
        idx = groupOrders.length - 1;
      }
      const go = { ...groupOrders[idx], items: Array.isArray(groupOrders[idx].items) ? [...groupOrders[idx].items] : [], participants: Array.isArray(groupOrders[idx].participants) ? [...groupOrders[idx].participants] : [] };
      if (item) go.items.push({ ...item, addedByPhone: cleanPhone(phone), addedByName: name || "عضو", addedAt: new Date().toISOString() });
      if (Array.isArray(participants)) {
        const map = new Map(go.participants.map((p: any) => [cleanPhone(p.phone), p]));
        participants.forEach((p: any) => { if (p?.phone) map.set(cleanPhone(p.phone), { phone: cleanPhone(p.phone), name: p.name || "عضو" }); });
        go.participants = Array.from(map.values());
      }
      groupOrders[idx] = go;
      groupOrder = go;
      const isNewOpen = action === "open" && (!Array.isArray(current.squadGroupOrders) || !current.squadGroupOrders.some((g: any) => String(g.squadId) === String(squadId) && g.status === "open"));
      const recipients = isNewOpen ? (squad?.membersList || []).map((m: any) => m.phone).filter((ph: any) => ph && cleanPhone(ph) !== cleanPhone(phone)) : [];
      const diwaniyaNotifications = pushDiwaniyaNotifications(current.diwaniyaNotifications || [], recipients.map((toPhone: string) => ({
        type: "group_order_open",
        squadId,
        squadName: squad?.name || "",
        toPhone,
        fromPhone: phone,
        fromName: name || "عضو",
        title: "طلب الربع مفتوح",
        message: `${name || "أحد الربع"} فتح طلب ديوانية ${squad?.name || "الربع"}. قطيتكم جاهزة.`
      })));
      return { squadGroupOrders: groupOrders, diwaniyaNotifications };
    });
    if (!ok) return res.status(500).json({ error: "Failed to update group order" });
    res.json({ success: true, groupOrder });
  });

  app.post("/api/squad-add-memory", async (req, res) => {
    const { squadId, memory } = req.body;
    if (!squadId || !memory) return res.status(400).json({ error: "Missing squadId or memory" });
    try {
      const ok = await updateAppDataAtomically((current: any) => {
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const idx = squads.findIndex((s: any) => String(s.id) === String(squadId));
        if (idx > -1) {
          const s = { ...squads[idx] };
          s.memories = Array.isArray(s.memories) ? [...s.memories] : [];
          s.memories.push(memory);
          squads[idx] = s;
        }
        return { squads };
      });
      if (!ok) throw new Error("Failed to save memory");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-delete-memory", async (req, res) => {
    const { squadId, memoryId } = req.body;
    if (!squadId || !memoryId) return res.status(400).json({ error: "Missing squadId or memoryId" });
    try {
      const ok = await updateAppDataAtomically((current: any) => {
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const idx = squads.findIndex((s: any) => String(s.id) === String(squadId));
        if (idx > -1) {
          const s = { ...squads[idx] };
          const memories = Array.isArray(s.memories) ? [...s.memories] : [];
          s.memories = memories.filter((m: any) => String(m.id) !== String(memoryId));
          squads[idx] = s;
        }
        return { squads };
      });
      if (!ok) throw new Error("Failed to delete memory");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-create", async (req, res) => {
    const { name, phone, customerName } = req.body;
    if (!name) return res.status(400).json({ error: "Missing squad name" });
    try {
      let createdSquad: any = null;
      const ok = await updateAppDataAtomically((current: any) => {
        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        const customers = Array.isArray(current.customers) ? [...current.customers] : [];
        const newSquadId = squads.length > 0 ? Math.max(...squads.map((s:any)=>Number(s.id) || 0)) + 1 : 1;
        const cleanQPhone = cleanPhone(phone);
        createdSquad = {
           id: newSquadId,
           name: name,
           tier: "برونزية",
           points: 0,
           totalPoints: 0,
           teamPoints: 0,
           kingOrders: 0,
           members: phone ? 1 : 0,
           king: customerName || "عميل",
           phone: phone,
           membersList: phone ? [{ name: customerName || "عميل", phone: phone, points: 0, joinedAt: new Date().toISOString() }] : [],
           createdAt: new Date().toISOString()
        };
        squads.push(createdSquad);
        if (phone) {
           const cidx = customers.findIndex((c: any) => cleanPhone(c.phone) === cleanQPhone);
           const membership = { id: newSquadId, squadId: newSquadId, name, joinedAt: new Date().toISOString() };
           if (cidx > -1) {
              const ids = new Set([...(customers[cidx].squadIds || []), customers[cidx].squadId].filter(Boolean).map(String));
              ids.add(String(newSquadId));
              customers[cidx] = { ...customers[cidx], name: customerName || customers[cidx].name, squadId: newSquadId, squadIds: [...ids], diwaniyaName: name, diwaniyaMemberships: [...(customers[cidx].diwaniyaMemberships || []).filter((m:any)=>String(m.squadId||m.id)!==String(newSquadId)), membership] };
           } else {
              customers.push({ id: "CUST-" + Date.now().toString(36), name: customerName || "", phone, address: "", lastOrderDate: new Date().toISOString(), squadId: newSquadId, squadIds: [String(newSquadId)], diwaniyaName: name, diwaniyaMemberships: [membership], loyaltyPoints: 0, points: 0 });
           }
        }
        return { squads, customers };
      });
      if (!ok) throw new Error("Failed to save squad");
      res.json({ success: true, squad: createdSquad });
    } catch(e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/squad-join", async (req, res) => {
   const { phone, squadId, name } = req.body;
   if (!phone || !squadId) return res.status(400).json({ error: "Missing phone or squadId" });
   try {
     const cleanQPhone = cleanPhone(phone);
     if (cleanQPhone.length !== 8) return res.status(400).json({ error: "Invalid phone" });
     let joinedSquad: any = null;
     const ok = await updateAppDataAtomically((current: any) => {
       const squads = Array.isArray(current.squads) ? [...current.squads] : [];
       let finalSquadIndex = squads.findIndex((s:any) => String(s.id) === String(squadId));
       if (finalSquadIndex === -1) {
         return null;
       }
       const squad = { ...squads[finalSquadIndex] };
       squad.membersList = Array.isArray(squad.membersList) ? [...squad.membersList] : [];
       const ownerPhone = cleanPhone(squad.phone || "");
       const existingMemberIndex = squad.membersList.findIndex((m:any) => cleanPhone(m.phone) === cleanQPhone);
       if (ownerPhone && ownerPhone === cleanQPhone) {
         joinedSquad = squad;
         return { squads };
       }
       if (existingMemberIndex > -1) {
         joinedSquad = squad;
         return { squads };
       }


       const reqs = Array.isArray(current.geofenceJoinRequests) ? [...current.geofenceJoinRequests] : [];
       const filteredReqs = reqs.filter((r: any) => !(cleanPhone(r.phone) === cleanQPhone && String(r.squadId) === String(squadId) && String(r.status || "pending") === "pending"));
       filteredReqs.push({
         phone: cleanQPhone,
         name: name || "عميل",
         squadId: String(squadId),
         distance: null,
         timestamp: new Date().toISOString(),
         status: "pending",
         source: "manual_join"
       });
       const diwaniyaNotifications = pushDiwaniyaNotification(current.diwaniyaNotifications || [], {
         type: "join_request",
         squadId: squad.id,
         squadName: squad.name,
         toPhone: squad.phone || "",
         fromPhone: cleanQPhone,
         fromName: name || "عميل",
         title: "طلب دخول جديد",
         message: `${name || "أحد الربع"} ناطر موافقة المعزب لديوانية ${squad.name}.`,
         meta: { source: "manual_join" }
       });
       joinedSquad = { ...squad, joinRequestPending: true };
       return { squads, geofenceJoinRequests: filteredReqs, diwaniyaNotifications };
     });
     if (!ok) throw new Error("Failed to request squad join");
     const ownerPhone = cleanPhone(joinedSquad?.phone || "");
     if (joinedSquad?.joinRequestPending && ownerPhone) {
       void sendDiwaniyaExternalPush({
         toPhones: [ownerPhone],
         type: "join_request",
         title: "طلب دخول جديد",
         body: `${name || "أحد الربع"} ناطر موافقة المعزب.`,
         squadId: String(squadId),
         url: "/?showSquads=true"
       });
     }
     res.json({ success: true, pendingApproval: Boolean(joinedSquad?.joinRequestPending), squad: joinedSquad });
   } catch(e) {
     res.status(500).json({ error: String(e) });
   }
  });

  app.get("/api/customers", async (req, res) => {
    let { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: "Phone number required" });
    }
    try {
      const cleanQueryPhone = cleanPhone(phone);

      const d = await getAppDataRef();
      const data = d.data() || {};
      const customers = data.customers || [];
      const invoices = data.invoices || [];
      const orders = data.orders || [];

      const isPaid = (status?: string, paymentStatus?: string) => {
        const s = String(status || "").toLowerCase();
        const ps = String(paymentStatus || "").toLowerCase();
        return ps === 'paid' || s === 'paid' || s.includes('تم الدفع') || s.includes('تم التوصيل') || s === 'delivered' || s === 'completed' || s.includes('جاهز للتوصيل');
      };

      // Calculate loyalty points from paid active invoices only, matching the Admin customer source.
      const activeInvoices = invoices.filter((inv: any) => {
        const ph = cleanPhone(inv.customerPhone || inv.phone || "");
        return ph === cleanQueryPhone && isPaid(inv.status, inv.paymentStatus) && inv.deleted !== true && inv.isDeleted !== true;
      });
      const invoicesTotal = activeInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.total || inv.totalAmount || inv.amount || 0)), 0);

      const computedPoints = Math.round(invoicesTotal);

      let matchedCustomers: any[] = [];
      customers.forEach((customer: any) => {
        const phoneField = customer.phone;
        if (phoneField && cleanPhone(phoneField) === cleanQueryPhone) {
          const stored = customer.loyaltyPoints !== undefined ? customer.loyaltyPoints : (customer.points || 0);
          matchedCustomers.push({
            ...customer,
            loyaltyPoints: computedPoints,
          });
        }
      });

      // If no customer profile found, try to synthesize one from their latest invoice
      if (matchedCustomers.length === 0) {
        // Reverse array to find the most recent one easily (since new ones are pushed to the end)
        const recentInvoice = [...invoices].reverse().find((inv: any) => {
          return cleanPhone(inv.customerPhone || inv.phone || "") === cleanQueryPhone;
        });
        
        if (recentInvoice) {
          matchedCustomers.push({
            name: recentInvoice.customerName || recentInvoice.name || "",
            phone: phone,
            address: recentInvoice.address || null,
            loyaltyPoints: computedPoints,
          });
        }
      }

      // If still nothing, try from orders
      if (matchedCustomers.length === 0) {
        const recentOrder = [...orders].reverse().find((o: any) => {
          return cleanPhone(o.customerPhone || o.phone || "") === cleanQueryPhone;
        });

        if (recentOrder) {
          matchedCustomers.push({
            name: recentOrder.customerName || recentOrder.name || "",
            phone: phone,
            address: recentOrder.address || null,
            loyaltyPoints: computedPoints,
          });
        }
      }

      return res.json(matchedCustomers);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Helper function to process products uniformly
  const processProducts = (rawProducts: any[]) => {
    let products = (rawProducts || []).filter(
      (p: any) =>
        p.isActive !== false &&
        p.isHidden !== true &&
        p.hidden !== true &&
        p.visible !== false &&
        p.isVisible !== false,
    );

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    products = products.map((p: any) => {
      let isNew = p.isNewProduct === true || p.isNew === true;
      if (!isNew && (p.createdAt || p.dateAdded || p.date)) {
        let timestamp = 0;
        if (p.createdAt && typeof p.createdAt === 'object' && p.createdAt.seconds) timestamp = p.createdAt.seconds * 1000;
        else if (p.createdAt) timestamp = new Date(p.createdAt).getTime();
        else if (p.dateAdded) timestamp = new Date(p.dateAdded).getTime();
        else if (p.date) timestamp = new Date(p.date).getTime();
        
        if (timestamp > thirtyDaysAgo) {
          isNew = true;
        }
      }
      return { ...p, isNewProduct: isNew };
    });

    return products;
  };


  const normalizeCustomerProductText = (value: any) =>
    String(value || "")
      .toLowerCase()
      .replace(/[إأآا]/g, "ا")
      .replace(/[ة]/g, "ه")
      .replace(/[ى]/g, "ي")
      .replace(/[ؤ]/g, "و")
      .replace(/[ئ]/g, "ي")
      .replace(/[ًٌٍَُِّْـ]/g, "")
      .trim();

  const getCustomerProductKey = (product: any) => {
    const name = normalizeCustomerProductText(product?.name || product?.productName || product?.nameAr || "");
    const category = normalizeCustomerProductText(product?.category || "");
    return `${category}::${name}`;
  };

  const isCustomerMenuFeatured = (product: any) =>
    product?.isMenuFeatured === true || product?.featuredInMenu === true;

  const getCustomerFeaturedRank = (product: any) => {
    const rank = Number(product?.featuredRank ?? product?.featuredOrder ?? product?.featuredPriority ?? 99);
    return Number.isFinite(rank) && rank > 0 ? rank : 99;
  };

  const mergeCustomerFeaturedState = (base: any, extra: any) => {
    if (!base || !extra) return base || extra;
    const baseFeatured = isCustomerMenuFeatured(base);
    const extraFeatured = isCustomerMenuFeatured(extra);
    if (!baseFeatured && !extraFeatured) return base;
    const bestRank = Math.min(getCustomerFeaturedRank(base), getCustomerFeaturedRank(extra));
    return {
      ...base,
      isMenuFeatured: baseFeatured || extraFeatured,
      featuredInMenu: base?.featuredInMenu === true || extra?.featuredInMenu === true,
      isFeatured: base?.isFeatured === true || extra?.isFeatured === true,
      featured: base?.featured === true || extra?.featured === true,
      featuredRank: Number.isFinite(bestRank) ? bestRank : 99,
    };
  };

  const preferCustomerDisplayProduct = (current: any, candidate: any) => {
    if (!current) return candidate;
    const currentHasImage = Boolean(current?.imageUrl || current?.image);
    const candidateHasImage = Boolean(candidate?.imageUrl || candidate?.image);
    let preferred = current;
    if (!currentHasImage && candidateHasImage) preferred = candidate;
    const currentActive = current?.isActive !== false && !current?.isOutOfStock;
    const candidateActive = candidate?.isActive !== false && !candidate?.isOutOfStock;
    if (!currentActive && candidateActive) preferred = candidate;
    return mergeCustomerFeaturedState(preferred, preferred === current ? candidate : current);
  };

  const getCustomerVisibleProducts = (products: any[] = []) => {
    const grouped = new Map<string, any>();
    (Array.isArray(products) ? products : []).forEach((product: any) => {
      const key = getCustomerProductKey(product);
      if (!key || key === "::") return;
      grouped.set(key, preferCustomerDisplayProduct(grouped.get(key), product));
    });
    return Array.from(grouped.values());
  };

  const buildCustomerTopProducts = (
    products: any[] = [],
    allInvoices: any[] = [],
  ) => {
    const productStats: Record<
      string,
      { count: number; revenue: number }
    > = {};
    allInvoices.forEach((order: any) => {
      if (!Array.isArray(order?.items)) return;
      order.items.forEach((item: any) => {
        if (!item?.productId) return;
        if (!productStats[item.productId]) {
          productStats[item.productId] = { count: 0, revenue: 0 };
        }
        const quantity = Number(item.quantity) || 1;
        const price = Number(item.priceAtTime || item.price || 0);
        productStats[item.productId].count += quantity;
        productStats[item.productId].revenue += price * quantity;
      });
    });

    const byQuantity = [...products]
      .filter((product) => (productStats[product.id]?.count || 0) > 0)
      .sort(
        (a, b) =>
          (productStats[b.id]?.count || 0) -
          (productStats[a.id]?.count || 0),
      )
      .slice(0, 15);
    const byRevenue = [...products]
      .filter((product) => (productStats[product.id]?.revenue || 0) > 0)
      .sort(
        (a, b) =>
          (productStats[b.id]?.revenue || 0) -
          (productStats[a.id]?.revenue || 0),
      )
      .slice(0, 15);

    const mixedMap = new Map<string, any>();
    byQuantity.forEach((product) => mixedMap.set(product.id, product));
    byRevenue.forEach((product) => mixedMap.set(product.id, product));
    const allTopProducts = Array.from(mixedMap.values());
    if (allTopProducts.length < 6) {
      const fallbacks = [...products]
        .filter((product) => !product.isHidden && !product.isOutOfStock)
        .slice(0, 20);
      fallbacks.forEach((product) => {
        if (!mixedMap.has(product.id)) {
          allTopProducts.push(product);
          mixedMap.set(product.id, product);
        }
      });
    }

    return allTopProducts.sort(() => 0.5 - Math.random()).slice(0, 6);
  };

  // One read-only request replaces the two large, overlapping product requests.
  // Top products are represented by IDs because their full objects already exist
  // in the menu array. Inline images are de-duplicated only for network transport.
  app.get("/api/customer-menu", async (req, res) => {
    try {
      const data = await getAppDataForKeys([
        "products",
        "supplierCopies",
        "invoices",
      ]);
      const allProducts = [
        ...(data.products || []),
        ...(data.supplierCopies || []),
      ];
      const products = getCustomerVisibleProducts(
        processProducts(allProducts),
      ).sort((a: any, b: any) =>
        (a.name || "").localeCompare(b.name || "", "ar"),
      );
      const topProducts = buildCustomerTopProducts(
        products,
        data.invoices || [],
      );
      const packedMenu = packCustomerMenuProducts(products);

      return await sendCompressedCustomerMenuJson(req, res, {
        success: true,
        formatVersion: 1,
        products: packedMenu.products,
        topProductIds: topProducts
          .map((product: any) => String(product?.id || ""))
          .filter(Boolean),
        assetPack: packedMenu.assetPack,
        transportStats: packedMenu.stats,
      });
    } catch (error) {
      console.error("[CUSTOMER_MENU] Failed:", error);
      return res.status(500).json({ error: "Failed to fetch customer menu" });
    }
  });

  // 5. Top Products
  app.get("/api/top-products", async (req, res) => {
    try {
      const data = await getAppDataForKeys(["products", "supplierCopies", "invoices"]);
      const allProducts = [...(data.products || []), ...(data.supplierCopies || [])];
      const products = getCustomerVisibleProducts(processProducts(allProducts));
      res.json(buildCustomerTopProducts(products, data.invoices || []));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top products" });
    }
  });

  // 6. Products
  app.get("/api/recent-fomo", async (req, res) => {
    try {
      // First, get all active products from the shared database
      const fomoData = await getAppDataForKeys(["products", "orders", "invoices"]);
      const activeProducts =
        fomoData.products?.filter((p: any) => !p.isHidden) ||
        [];
      const activeProductNames = new Set(
        activeProducts.map((p: any) => p.name),
      );

      // Get the most recent 150 orders to find valid recent purchases
      const allOrders = fomoData.orders || [];
      const allInvoices = fomoData.invoices || [];
      const combinedOrders = [...allOrders, ...allInvoices].sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.date || 0).getTime();
        return dateB - dateA;
      }).slice(0, 150);

      const recentOrders: any[] = [];
      const seenNames = new Set<string>();

      combinedOrders.forEach((data: any) => {
        if (
          data.customerName &&
          data.address &&
          typeof data.address === "object" &&
          data.address.region &&
          data.address.region !== "غير محدد"
        ) {
          // Only include realistic ones
          if (
            (data.status === "paid" ||
              data.status === "تم الدفع" ||
              data.status === "pending" ||
              data.status === "قيد الانتظار" ||
              data.status === "تم الدفع بنجاح") &&
            recentOrders.length < 50
          ) {
            const items = data.items || [];
            // STRICT: Only use items that EXACTLY match real products in the shared database
            const validItems = items.filter(
              (i: any) => i && i.name && activeProductNames.has(i.name),
            );
            const randomItem =
              validItems.length > 0
                ? validItems[Math.floor(Math.random() * validItems.length)]
                : null;

            if (randomItem) {
              let fNameParts = String(data.customerName).trim().split(" ");
              let fName = fNameParts[0] || "عميل";
              if (
                (fName === "ام" ||
                  fName === "أم" ||
                  fName === "ابو" ||
                  fName === "أبو" ||
                  fName === "بو") &&
                fNameParts.length > 1
              ) {
                fName = fName + " " + fNameParts[1];
              }

              if (!seenNames.has(fName)) {
                seenNames.add(fName);
                // STRICT: Use real area and real time from the order itself
                const area = data.address.region;

                let timestamp = data.createdAt;
                if (timestamp?.toDate) timestamp = timestamp.toDate();
                else if (typeof timestamp === "number")
                  timestamp = new Date(timestamp);
                else if (typeof timestamp === "string")
                  timestamp = new Date(timestamp);
                else timestamp = new Date(); // fallback if missing

                recentOrders.push({
                  name: fName,
                  area: area,
                  time: timestamp.toISOString(),
                  productName: randomItem.name,
                });
              }
            }
          }
        }
      });

      // We do NOT pad with fake orders anymore. Only real data from the database.

      // Shuffle the final list to keep it feeling fresh without altering real data
      const shuffled = recentOrders.sort(() => 0.5 - Math.random());
      res.json(shuffled);
    } catch (e) {
      console.error("Failed to get recent FOMO:", e);
      res.status(500).json([]);
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const data = await getAppDataForKeys(["products", "supplierCopies"]);
      const allProducts = [...(data.products || []), ...(data.supplierCopies || [])];
      let products = getCustomerVisibleProducts(processProducts(allProducts));

      // Sort alphabetically
      products.sort((a: any, b: any) =>
        (a.name || "").localeCompare(b.name || "", "ar"),
      );

      res.json(products);
    } catch (error) {
      console.error("DEBUG: Failed to fetch products in /api/products:", error);
      res.status(500).json({
        error: "Failed to fetch products",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/smart-search", async (req, res) => {
    try {
      const { query: searchQuery } = req.body;
      if (!searchQuery || !String(searchQuery).trim()) {
        return res.json({ matchingIds: [], message: "" });
      }

      // Fetch active menu products
      const data = await getAppDataForKeys(["products", "supplierCopies"]);
      const allProducts = [...(data.products || []), ...(data.supplierCopies || [])];
      const products = getCustomerVisibleProducts(processProducts(allProducts));

      // Simplify product catalog for Gemini to keep token counts small and focused
      const catalog = products.map((p: any) => ({
        id: p.id || p.productId,
        name: p.name,
        nameEn: p.nameEn,
        category: p.category,
        price: p.price,
        description: p.preparationInstructions || ""
      }));

      const systemInstruction = `أنت المساعد الذكي جداً والمستشار الغذائي الخبير في مطبخ التراث الكويتي.
مهمتك هي تحليل استعلام البحث الذي يكتبه المستخدم باللغة العربية بلهجات متعددة (خاصة اللهجة الكويتية والخليجية العامية والفصحى) بدقة فائقة وفهمه واختيار وتلمس الوجبات والمنتجات المناسبة له من قائمة طعامنا، وكتابة تلميح أو تعليق كويتي دافئ وحبّي وحنون جداً يخاطب العميل بشكل شخصي ومباشر بقمة العاطفة والذكاء الكويتي الأصيل.

تعليمات هامة:
1. العميل قد يبحث عن:
- حميات أو قيود صحية: مثلاً (بدون عيش، كيتو، دايت، خفيف، بدون بصل، نباتي، بروتين عالي).
- حالات مزاجية أو صحية: مثلاً (مريض، منشول، مصخن، تعبان، يوعان يوع مو طبيعي، مشتهر، ولهان على طبخ أمي).
- مناسبات وتجمعات: مثلاً (ديوانية، يمعه ربع، عشاء عائلي، زوارة، صواني كبار).
- أوقات خاصة: مثلاً (سهران، جوع آخر الليل، ريوق خفيف، تحلية بعد الغدا).
- رغبة في نوع طعام محدد جداً حتى بمرادفاته الشعبية: مثلاً (عقيل، مجبوس، لحم ذبيحة، حلو، مرق، مرقة، شوربة، هيل، دارسين).

2. طريقة فهم الوجبات وصحّتها:
- إذا العميل طلب "بدون عيش": يجب استبعاد أي مجبوس أو برياني يحتوي عيش بشكل تلقائي أو اختيار الوجبات التي تتوفر كلحوم أو إيدامات أو يمكن تعديلها، أو شوربات وسلطات، أو صواني مشاوي.
- إذا العميل قال "مريض" أو "مصخن": الأولوية المطلقة للشوربات الدافئة (مثال شوربة لسان عصفور، شوربة خضار، شوربة عدس) والمرقات الخفيفة، والمشروبات الدافئة إن وجدت. واكتب له دعاء بالشفاء بلهجة كويتية رحيمة ("أجر وعافية يالغالي وما تشوف شر...").
- إذا العميل قال "سفر" أو "راجع من السفر": دلّه على الصواني السريعة والمشبعة الفورية التي تسد جوعه وجوع عائلته فوراً بعد وعثاء السفر.
- إذا العميل قال "حلو" أو "تحلية" أو "أبي شي بارد": رتّب له الحلويات المتوفرة لدينا مثل (قرص عقيلي، لقيمات، كيكة، حلوى، إلخ).

3. الرد الكويتي (message):
- يجب أن يكون رداً دافئاً جداً جالب للحنين، يفيض ترحيباً ("يا بعد قلبي"، "يا أخوي الغالي"، "يا أختي الغالية"، "من عيوني"، "يا بعد طوايف أهلي")، ومفصّلاً تماماً بناءً على الكلمات المفتاحية والحالة التي كتبها المستخدم.
- اشرح له بذكاء شديد لماذا اخترت له هذه الوجبات بالذات (مثال: "بما أنك مسوي دايت وتبيه بدون عيش، اخترت لك هالمشاوي اللذيذة والشوربة الخفيفة اللي تترس بطنك بدون ما تخرب رجيمك...").

4. أرجع النتيجة في صيغة JSON مطابقة تماماً للمواصفات التالية:
{
  "matchingIds": ["id1", "id2", ...], // مصفوفة تحتوي على معرفات المنتجات المطابقة مرتبة حسب الأولوية القصوى للمطابقة (الأكثر شبهاً وملاءمةً بالأعلى).
  "message": "نص الرسالة الكويتية الدافئة والذكية جداً هنا"
}`;

      const userContent = `استعلام البحث للعميل: "${searchQuery}"\n\nكتالوج المنتجات المتاح لدينا:\n${JSON.stringify(catalog, null, 2)}`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userContent,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchingIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of matching product IDs sorted by relevance"
              },
              message: {
                type: Type.STRING,
                description: "A friendly, warm, highly personalized Kuwaiti explanation matching the user's query"
              }
            },
            required: ["matchingIds", "message"]
          }
        }
      });

      const resultText = response.text || "{}";
      const parsed = JSON.parse(resultText);

      res.json({
        matchingIds: Array.isArray(parsed?.matchingIds) ? parsed.matchingIds : [],
        message: parsed?.message || "أبشر! جرب هالوجبات الطيبة لطلبك."
      });
    } catch (error) {
      console.error("[SMART_SEARCH_ERROR]:", error);
      res.status(500).json({ matchingIds: [], message: "حصل التباس بسيط بالسرش الذكي الذكاء الاصطناعي موجه!" });
    }
  });


  // Function to generate a unified, completely unique ID
  function generateUnifiedId(prefix = "ORD") {
    const timestamp = Date.now();
    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    return `${prefix}-${timestamp}-${randomSuffix}`;
  }

  const ADMIN_PUSH_ORDER_CREATED_URL =
    process.env.ADMIN_PUSH_ORDER_CREATED_URL ||
    process.env.ADMIN_PUSH_ENDPOINT ||
    "https://alturath-admin-0200723670.web.app/api/push/order-created-alert";

  async function nudgeAdminOrderCreatedPush(order: any) {
    if (!order?.id) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(ADMIN_PUSH_ORDER_CREATED_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber || order.invoiceNo || order.id,
          total: Number(order.total || order.totalAmount || 0),
          source: "order_server_create",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`[PUSH_NUDGE] Admin push endpoint returned ${response.status}`);
      }
    } catch (error: any) {
      console.warn("[PUSH_NUDGE] Admin push nudge skipped:", error?.message || String(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  function scheduleAdminOrderCreatedPush(order: any) {
    void nudgeAdminOrderCreatedPush(order);

    const pendingRetryMs = Math.max(
      30000,
      Math.min(10 * 60 * 1000, Number(process.env.ADMIN_PENDING_PUSH_RETRY_MS || 125000))
    );

    setTimeout(() => {
      void nudgeAdminOrderCreatedPush(order);
    }, pendingRetryMs);
  }

  // 7. Orders Submission
  app.post("/api/orders", async (req, res) => {
    if (await rejectCheckoutWhenStoreClosed(res)) return;

    const {
      customerName,
      customerPhone,
      address,
      items,
      deliveryFee,
      total,
      regionId,
      generalNotes,
      isFreeDelivery,
      deliveryType,
      status,
      paymentStatus,
      splitType,
      splitParticipants,
      splitPayments,
      squadId,
      squadName,
      squadTier,
      qatiaType,
      splitOrigin,
    } = req.body;

    console.log(
      `[ORDER] New order request from ${customerPhone} (${customerName}) total: ${total}`,
    );

    // Basic validation
    if (
      !customerName ||
      !customerPhone ||
      !address ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0 ||
      typeof total !== "number"
    ) {
      console.warn("[ORDER] Invalid order data received:", req.body);
      return res.status(400).json({ error: "بيانات الطلب غير مكتملة" });
    }

    const orderCustomId = generateUnifiedId("ORD");

    const newOrder: any = {
      id: orderCustomId,
      linkedInvoiceId: orderCustomId,
      customerName: String(customerName).substring(0, 100),
      customerPhone: String(customerPhone).substring(0, 20),
      address: typeof address === "string" ? { full: address } : { ...address },
      items,
      deliveryFee: deliveryFee || 0,
      isFreeDelivery: isFreeDelivery || false,
      deliveryType: deliveryType || (isFreeDelivery ? "free" : null),
      total,
      regionId: regionId || null,
      status: status || (total < 0.001 ? "تم الدفع بنجاح" : "جديد"),
      paymentStatus: paymentStatus || (total < 0.001 ? "paid" : "pending"),
      createdAt: new Date().toISOString(),
      source: "customer_website",
      generalNotes: generalNotes || "",
    };

    const normalizedQatiaType = String(qatiaType || "").toLowerCase();
    const normalizedSplitOrigin = String(splitOrigin || "").toLowerCase();
    const isDiwaniyaQatya =
      Boolean(splitType) &&
      (
        normalizedQatiaType === "diwaniya" ||
        normalizedSplitOrigin.startsWith("diwaniya")
      );

    if (splitType) {
      newOrder.qatiaType = isDiwaniyaQatya ? "diwaniya" : "traditional";
      newOrder.splitOrigin = isDiwaniyaQatya ? (splitOrigin || "diwaniya_checkout") : (splitOrigin || "customer_traditional");
    }

    if (isDiwaniyaQatya) {
      newOrder.squadId = squadId || null;
      newOrder.squadName = squadName || null;
      newOrder.squadTier = squadTier || null;
    }

    const cleanSplitPhone = (value: any) => String(value || "").replace(/\D/g, "").slice(-8);
    const normalizeSplitMembers = (source: any) => {
      if (!Array.isArray(source)) return [];
      const map = new Map<string, any>();
      source.forEach((member: any) => {
        const phone = cleanSplitPhone(
          member?.phone ||
          member?.mobile ||
          member?.customerPhone ||
          member?.phoneNumber ||
          member?.tel ||
          member?.msisdn ||
          member?.whatsapp ||
          member?.contactPhone ||
          member?.number
        );
        if (!phone || phone.length < 8) return;
        const current = map.get(phone) || {};
        map.set(phone, {
          id: current.id || member?.id || `P-${phone}`,
          name: String(member?.name || member?.customerName || member?.displayName || member?.fullName || current.name || "عضو").trim() || "عضو",
          phone,
          amount: Number(member?.amount || current.amount || 0),
          status: String(member?.status || current.status || "pending"),
          source: member?.source || current.source || "diwaniya_qatya",
        });
      });
      return Array.from(map.values());
    };

    const collectSquadSplitMembers = (appData: any, targetSquadId: any) => {
      if (!targetSquadId) return [];
      const sid = String(targetSquadId);
      const squads = Array.isArray(appData.squads) ? appData.squads : [];
      const squad = squads.find((sq: any) => String(sq.id) === sid);
      const sources: any[] = [];

      if (squad) {
        [squad.membersList, squad.membersData, squad.membersDetails, squad.members, squad.participants].forEach((list: any) => {
          if (Array.isArray(list)) sources.push(...list);
        });
      }

      (Array.isArray(appData.customers) ? appData.customers : []).forEach((c: any) => {
        const squadIds = [c.squadId, c.squadID, c.diwaniyaId, ...(Array.isArray(c.squadIds) ? c.squadIds : [])].filter(Boolean).map(String);
        const memberships = Array.isArray(c.diwaniyaMemberships) ? c.diwaniyaMemberships : [];
        const hasMembership = memberships.some((m: any) => String(m?.squadId || m?.id || m?.diwaniyaId || "") === sid);
        if (squadIds.includes(sid) || hasMembership) sources.push(c);
      });

      (Array.isArray(appData.geofenceJoinRequests) ? appData.geofenceJoinRequests : []).forEach((r: any) => {
        if (String(r.squadId) === sid && String(r.status || "").toLowerCase() === "approved") sources.push(r);
      });

      return normalizeSplitMembers(sources);
    };

    if (splitType) {
      newOrder.splitType = splitType;
      const requestSplitMembers = normalizeSplitMembers(
        Array.isArray(splitPayments) && splitPayments.length ? splitPayments : splitParticipants
      );
      if (requestSplitMembers.length > 0) {
        newOrder.splitParticipants = requestSplitMembers;
        newOrder.splitPayments = requestSplitMembers;
      }
    }

    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();

      if (!d.exists()) {
        console.error("[ORDER] shared_company_data document NOT FOUND");
        return res.status(500).json({ error: "فشل الوصول إلى قاعدة البيانات" });
      }

      const appData = d.data() || {};
      const orders = appData.orders || [];
      const customers = appData.customers || [];
      const squadsForSplit = appData.squads || [];
      const splitNotificationRecipients: any[] = [];
      let qatyaExternalPushPhones: string[] = [];
      if (isDiwaniyaQatya && squadId) {
        const squadMembers = normalizeSplitMembers([
          ...collectSquadSplitMembers(appData, squadId),
          ...(Array.isArray(newOrder.splitPayments) ? newOrder.splitPayments : []),
          ...(Array.isArray(newOrder.splitParticipants) ? newOrder.splitParticipants : []),
        ]);
        const customerClean = cleanSplitPhone(customerPhone);
        if (customerClean) {
          const hasCustomer = squadMembers.some((m: any) => cleanSplitPhone(m.phone) === customerClean);
          if (!hasCustomer) squadMembers.push({ id: `P-${customerClean}`, name: customerName || "أنت", phone: customerClean, amount: 0, status: "pending", source: "diwaniya_qatya" });
        }
        if (squadMembers.length > 0) {
          const equalAmount = Number((Number(total || 0) / squadMembers.length).toFixed(3));
          const preparedSquadMembers = squadMembers.map((m: any) => ({
            ...m,
            amount: Number(m.amount || 0) > 0 ? Number(m.amount) : equalAmount,
            status: String(m.status || "pending").toLowerCase() === "paid" ? "paid" : "pending",
            splitMode: "equal",
            source: m.source || "diwaniya_qatya",
          }));
          newOrder.splitParticipants = preparedSquadMembers;
          newOrder.splitPayments = preparedSquadMembers;
          newOrder.splitCount = preparedSquadMembers.length;
          newOrder.equalSplitAmount = equalAmount;
          splitNotificationRecipients.push(...preparedSquadMembers.filter((m: any) => cleanSplitPhone(m.phone)));
        }
      }
      const products = [
        ...(appData.products || []),
        ...(appData.supplierCopies || []),
      ];

      // Validate all items are currently active
      for (const item of items) {
        const product = products.find(
          (p: any) => p.id === item.productId || p.id === item.id,
        );
        if (product && product.isActive === false) {
          return res
            .status(400)
            .json({ error: `المنتج ${product.name} غير متوفر حالياً` });
        }
      }

      await updateAppDataAtomically((current) => {
        const orders = [...(current.orders || [])];
        const customers = [...(current.customers || [])];
        const squads = [...(current.squads || [])];
        
        orders.push(newOrder);

        let diwaniyaNotifications = Array.isArray(current.diwaniyaNotifications) ? current.diwaniyaNotifications : [];
        if (isDiwaniyaQatya && splitNotificationRecipients.length > 0) {
          const makerPhone = cleanPhone(customerPhone);
          qatyaExternalPushPhones = splitNotificationRecipients
            .map((m: any) => cleanPhone(m.phone))
            .filter((phone: string) => phone && phone !== makerPhone);
          diwaniyaNotifications = pushDiwaniyaNotifications(
            diwaniyaNotifications,
            splitNotificationRecipients
              .filter((m: any) => cleanPhone(m.phone) && cleanPhone(m.phone) !== makerPhone)
              .map((m: any) => ({
                type: "qatya_request",
                squadId: squadId || "",
                squadName: squadName || newOrder.squadName || "",
                toPhone: m.phone,
                fromPhone: customerPhone,
                fromName: customerName || "المعزب",
                title: `قطية ${squadName || newOrder.squadName || "الديوانية"} جاهزة`,
                message: "دش وحدد قطيتك.",
                meta: { orderId: newOrder.id, url: `/split/${newOrder.id}?phone=${cleanPhone(m.phone)}&tab=payment` }
              }))
          );
        }

        const cleanPhoneQuery = cleanPhone(customerPhone);
        let existingIndex = customers.findIndex((c: any) => cleanPhone(c.phone) === cleanPhoneQuery);

        if (existingIndex >= 0) {
          customers[existingIndex] = {
            ...customers[existingIndex],
            name: newOrder.customerName,
            address: newOrder.address,
            lastOrderDate: newOrder.createdAt,
          };
        } else {
          customers.push({
            id: "CUST-" + Date.now().toString(36),
            name: newOrder.customerName,
            phone: newOrder.customerPhone,
            address: newOrder.address,
            lastOrderDate: newOrder.createdAt,
            loyaltyPoints: 0,
            points: 0,
          });
        }

        let attributedSquad = isDiwaniyaQatya ? squadId : null;
        if (!attributedSquad && customerPhone) {
            const custSquad = squads.find((sq: any) => 
                 (sq.membersList || []).some((m: any) => cleanPhone(m.phone) === cleanPhoneQuery)
            );
            if (custSquad) attributedSquad = String(custSquad.id);
        }

        if (attributedSquad) {
           const sqIndex = squads.findIndex((s:any) => String(s.id) === String(attributedSquad));
           if (sqIndex > -1) {
               if (customerPhone) {
                   if (!squads[sqIndex].membersList) squads[sqIndex].membersList = [];
                   let mIndex = squads[sqIndex].membersList.findIndex((m:any) => cleanPhone(m.phone) === cleanPhoneQuery);
                   if (mIndex > -1) {
                       if (customerName && (!squads[sqIndex].membersList[mIndex].name || squads[sqIndex].membersList[mIndex].name === "عميل")) {
                           squads[sqIndex].membersList[mIndex].name = customerName;
                       }
                   } else {
                       squads[sqIndex].membersList.push({
                           phone: customerPhone,
                           name: customerName || "عميل",
                           points: 0
                       });
                       squads[sqIndex].members = squads[sqIndex].membersList.length;
                   }
               }
           }
        }
        return { orders, customers, squads, diwaniyaNotifications };
      });

      console.log(`[ORDER] Order ${newOrder.id} saved successfully`);
      scheduleAdminOrderCreatedPush(newOrder);
      if (newOrder.paymentStatus === "paid" || String(newOrder.status || "").startsWith("تم الدفع")) {
        void sendAdminPushDirectOnce({
          eventId: `safe-worker-payment-paid-${newOrder.id}`,
          title: "✅ تم دفع طلب",
          body: `تم دفع الطلب ${newOrder.id}${Number(newOrder.total) ? ` — القيمة ${Number(newOrder.total).toFixed(3)} د.ك` : ""}`,
          alertType: "payment_paid",
          orderId: newOrder.id,
        });
      }
      if (isDiwaniyaQatya && qatyaExternalPushPhones.length > 0) {
        void sendDiwaniyaExternalPush({
          toPhones: qatyaExternalPushPhones,
          type: "qatya_request",
          title: `قطية ${squadName || newOrder.squadName || "الديوانية"} جاهزة`,
          body: "دش وحدد قطيتك.",
          orderId: newOrder.id,
          squadId: squadId || "",
          url: `/split/${newOrder.id}`
        });
      }
      res.status(201).json(newOrder);
    } catch (e) {
      console.error("[ORDER] Critical error creating order:", e);
      res.status(500).json({ error: "حدث خطأ غير متوقع في الخادم" });
    }
  });

  app.get("/api/create-test-split-order", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const orders = data.orders || [];
      const newOrder = {
        id: `ORD-TEST-${Date.now()}`,
        status: "قيد تجميع القطية",
        total: 100,
        customerPhone: "99999999",
        createdAt: new Date().toISOString(),
      };
      orders.push(newOrder);
      await updateAppData({ orders });
      res.json({ orderId: newOrder.id, message: "Order created successfully" });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Split Payment Endpoint
  app.post("/api/create-split-payment", async (req, res) => {
    try {
      const { orderId, name, amount, customerMobile, customerEmail, baseUrl } = req.body;

      if (!orderId || !amount || isNaN(parseFloat(amount))) {
        console.error("[SPLIT] Invalid request params:", { orderId, amount });
        return res.status(400).json({ error: "بيانات الطلب غير مكتملة" });
      }

      console.log(
        `[SPLIT] Creating partial payment for Order ${orderId}: ${amount} KWD by ${name}`,
      );

      const d = await getAppDataRef();
      const data = d.data() || {};
      const orders = data.orders || [];
      const invoices = data.invoices || [];

      let index = orders.findIndex(
        (o: any) =>
          String(o.id).trim().toUpperCase() ===
          String(orderId).trim().toUpperCase(),
      );
      let isInvoice = false;

      if (index === -1) {
        index = invoices.findIndex(
          (o: any) =>
            String(o.id).trim().toUpperCase() ===
            String(orderId).trim().toUpperCase(),
        );
        if (index !== -1) {
          isInvoice = true;
        }
      }

      if (index === -1) {
        console.error(`[SPLIT] Order/Invoice ${orderId} not found`);
        return res.status(400).json({ error: "الطلب غير موجود" });
      }

      const existingOrder = isInvoice ? invoices[index] : orders[index];

      const splitPayments = existingOrder.splitPayments || [];
      const orderTotal = Number(existingOrder.total) || 0;
      const totalPaid = splitPayments
        .filter((sp: any) => sp.status === "paid")
        .reduce((sum: number, sp: any) => sum + (Number(sp.amount) || 0), 0);

      if (orderTotal > 0 && totalPaid >= orderTotal - 0.005) {
         return res.status(400).json({ error: "تم إكتمال دفع الفاتورة مسبقاً" });
      }

      const numericAmount = parseFloat(parseFloat(amount).toFixed(3));
      if (orderTotal > 0 && totalPaid + numericAmount > orderTotal + 0.005) {
         return res.status(400).json({ error: "المبلغ يتجاوز المتبقي من الفاتورة" });
      }

      const sanitizePhone = (p: string) => (p || "").replace(/\D/g, "").slice(-8);
      const reqPhone = sanitizePhone(customerMobile);

      // Allow multiple payments from same phone if it's a split and balance remains. 
      // The hasPaid check was blocking "Pay remaining" if same person tries again.
      const hasPaid = splitPayments.some((sp: any) => sanitizePhone(sp.phone) === reqPhone && sp.status === "paid");
      if (hasPaid && existingOrder.splitType !== "traditional" && existingOrder.splitType !== "roulette") {
         // If it's a general split or repay, we might want to allow it.
         // Actually, even in traditional, if they want to cover someone else, why not?
         // Let's just warn but allow, or allow for "Pay Remaining" specifically.
      }
      
      // Better: Just remove this check or make it more flexible. 
      // Most users won't accidentally pay twice, and if they want to pay more, we should let them.
      /*
      if (hasPaid) {
         return res.status(400).json({ error: "هذا الرقم قام بالدفع مسبقاً" });
      }
      */

      const rawApiKey = process.env.UPAYMENTS_API_KEY;
      if (!rawApiKey) {
        console.error("[SPLIT] UPAYMENTS_API_KEY is missing");
        return res.status(500).json({ error: "UPAYMENTS_API_KEY is missing." });
      }

      let cleanApiKey = rawApiKey.replace(/[^\x20-\x7E]/g, "").trim();
      if (cleanApiKey.toLowerCase().startsWith("bearer "))
        cleanApiKey = cleanApiKey.substring(7).trim();
      else if (cleanApiKey.toLowerCase().startsWith("token "))
        cleanApiKey = cleanApiKey.substring(6).trim();

      const uniqueSuffix =
        Date.now().toString(36).slice(-6) +
        Math.random().toString(36).substring(2, 6);
      const splitId = `S-${uniqueSuffix}`;

      const isSandbox =
        String(process.env.UPAYMENTS_MODE || "").toLowerCase() === "sandbox" ||
        String(process.env.UPAYMENTS_ENV || "").toLowerCase() === "sandbox" ||
        cleanApiKey.toLowerCase().includes("sandbox") ||
        cleanApiKey.startsWith("test_");
      const upaymentsApiUrl = isSandbox
        ? "https://sandboxapi.upayments.com/api/v1/charge"
        : "https://uapi.upayments.com/api/v1/charge";

      let protocol = req.headers["x-forwarded-proto"] || req.protocol;
      let host = req.headers["x-forwarded-host"] || req.get("host");
      let reqOrigin = baseUrl || req.get("origin");
      let devOrProdUrl = (reqOrigin && reqOrigin !== "null" && reqOrigin !== "undefined") ? reqOrigin : protocol + "://" + host;

      if (!devOrProdUrl || devOrProdUrl.includes("undefined") || devOrProdUrl === "null") {
        // Fallback to current domain if possible, otherwise use a safe default
        devOrProdUrl = protocol + "://" + host;
      }

      // If localhost, we might need a public proxy but for webhooks to hit this server 
      // the domain must be publicly accessible.
      
      // Ensure no trailing slash
      devOrProdUrl = devOrProdUrl.replace(/\/$/, "");

      const finalAmount = parseFloat(amount).toFixed(3);

      let generatedReturnUrl = `${devOrProdUrl}/api/payment-return/${orderId}-S-${splitId}/success`;
      let generatedCancelUrl = `${devOrProdUrl}/api/payment-return/${orderId}-S-${splitId}/failed`;
      // FIX: Use devOrProdUrl instead of hardcoded domain to ensure webhooks reach the correct environment!
      const generatedNotifyUrl = `${devOrProdUrl}/api/payment-webhook/${orderId}/${splitId}`;

      console.log(`[SPLIT] Generated Notify URL: ${generatedNotifyUrl}`);

      // Update with pending split info
      const newSplitEntry = {
        id: splitId,
        name: name || "Customer",
        phone: customerMobile || "",
        amount: numericAmount,
        status: "pending",
        date: new Date().toISOString(),
      };

      try {
        await updateAppDataAtomically((current) => {
           let orders = [...(current.orders || [])];
           let invoices = [...(current.invoices || [])];
           
           const upsertSplitEntry = (target: any) => {
              const reqCleanPhone = sanitizePhone(customerMobile);
              if (!target.splitPayments) target.splitPayments = [];
              const existingIdx = target.splitPayments.findIndex((sp: any) => sanitizePhone(sp.phone) === reqCleanPhone && String(sp.status || "").toLowerCase() !== "paid");
              if (existingIdx >= 0) {
                 target.splitPayments[existingIdx] = {
                    ...target.splitPayments[existingIdx],
                    id: target.splitPayments[existingIdx].id || splitId,
                    name: name || target.splitPayments[existingIdx].name || "Customer",
                    phone: customerMobile || target.splitPayments[existingIdx].phone || "",
                    amount: numericAmount,
                    status: "pending",
                    date: new Date().toISOString(),
                 };
              } else {
                 target.splitPayments.push(newSplitEntry);
              }
              if (!target.splitParticipants) target.splitParticipants = [];
              const participantIdx = target.splitParticipants.findIndex((sp: any) => sanitizePhone(sp.phone) === reqCleanPhone);
              if (participantIdx >= 0) {
                 target.splitParticipants[participantIdx] = { ...target.splitParticipants[participantIdx], amount: numericAmount, status: "pending" };
              }
           };

           let idx = orders.findIndex((o: any) => String(o.id).trim().toUpperCase() === String(orderId).trim().toUpperCase());
           if (idx !== -1) {
              upsertSplitEntry(orders[idx]);
              return { orders };
           } else {
              idx = invoices.findIndex((o: any) => String(o.id).trim().toUpperCase() === String(orderId).trim().toUpperCase());
              if (idx !== -1) {
                 upsertSplitEntry(invoices[idx]);
                 return { invoices };
              }
           }
           return null;
        });
      } catch (dbErr: any) {
        console.error("[SPLIT] Firestore Update Error:", dbErr);
        return res.status(500).json({
          error: "فشل تحديث بيانات الطلب في قاعدة البيانات",
          details: dbErr.message,
        });
      }

      const upaymentsPayload = {
        returnUrl: generatedReturnUrl,
        cancelUrl: generatedCancelUrl,
        notificationUrl: generatedNotifyUrl,
        language: "ar",
        paymentGateway: { src: "knet" },
        order: {
          id: splitId,
          currency: "KWD",
          amount: numericAmount,
        },
        reference: { id: splitId },
        customer: {
          uniqueId: customerMobile
            ? `cid_${customerMobile}`
            : `cid_${uniqueSuffix}`,
          name: name || "Customer",
          email: customerEmail || "Dr.Ahmad.Alfailakawi@gmail.com",
          mobile: customerMobile || "00000000",
        },
      };

      // Call UPAYMENTS via AXIOS for better timeout and error handling
      let paymentResponse: any;
      try {
        console.log(`[SPLIT] Calling UPayments API: ${upaymentsApiUrl}`);
        const response = await axios.post(upaymentsApiUrl, upaymentsPayload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${cleanApiKey}`,
          },
          timeout: 15000, // 15s timeout
        });
        paymentResponse = response.data;
      } catch (error: any) {
        const status = error.response?.status || 500;
        const errorData = error.response?.data || {};
        console.error("[SPLIT] External API Error:", status, errorData);

        let errMsg =
          errorData.error || errorData.message || "فشل الاتصال بمزود الدفع";
        if (status === 401) errMsg = "مفتاح الربط الخاص بالدفع غير صالح";

        const safeStatus = status === 404 ? 400 : status;
        return res.status(safeStatus).json({
          error: errMsg,
          details: errorData,
        });
      }

      if (
        paymentResponse.status &&
        paymentResponse.data &&
        paymentResponse.data.link
      ) {
        console.log(
          `[SPLIT] Payment link created: ${paymentResponse.data.link}`,
        );
        res.json({ paymentLink: paymentResponse.data.link });
      } else {
        console.error("[SPLIT] Invalid response structure:", paymentResponse);
        res.status(500).json({
          error:
            "فشل في إنشاء الرابط: " +
            (paymentResponse.message || "استجابة غير صالحة من البوابة"),
          details: paymentResponse,
        });
      }
    } catch (e: any) {
      console.error("[SPLIT] Exception:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Payment Endpoint
  app.post("/api/create-payment", async (req, res) => {
    try {
      if (await rejectCheckoutWhenStoreClosed(res)) return;

      const {
        amount,
        customerName,
        customerEmail,
        customerMobile,
        orderId,
        description,
        returnUrl,
        cancelUrl,
        notificationUrl,
        isPopup,
        baseUrl,
      } = req.body;

      if (orderId) {
        const d = await getAppDataRef();
        const data = d.data() || {};
        const orders = data.orders || [];
        const invoices = data.invoices || [];
        const existingOrder = [...orders, ...invoices].find((o: any) => paymentRecordMatches(o, orderId));
        if (
          existingOrder &&
          (existingOrder.paymentStatus === "paid" ||
            (existingOrder.status || "").startsWith("تم الدفع"))
        ) {
          return res.status(400).json({ error: "هذا الطلب/الفاتورة مدفوع بالفعل" });
        }
      }

      // Get API token from environment variable
      const rawApiKey = process.env.UPAYMENTS_API_KEY;

      if (!rawApiKey) {
        console.error(
          "[PAYMENT ERROR] UPAYMENTS_API_KEY is missing from environment variables.",
        );
        return res.status(500).json({
          error:
            "الرجاء إضافة مفتاح المبيعات الحقيقي (Live API Key) من UPayments في إعدادات التطبيق (Environment Variables) تحت اسم UPAYMENTS_API_KEY ليتم تفعيل الدفع بنجاح.",
        });
      }

      // Clean key and handle cases where 'Bearer ' might already be included
      let cleanApiKey = rawApiKey.replace(/[^\x20-\x7E]/g, "").trim();
      if (cleanApiKey.toLowerCase().startsWith("bearer ")) {
        cleanApiKey = cleanApiKey.substring(7).trim();
      } else if (cleanApiKey.toLowerCase().startsWith("token ")) {
        cleanApiKey = cleanApiKey.substring(6).trim();
      }

      if (cleanApiKey.length === 0) {
        console.error(
          "[PAYMENT] INVALID KEY DETECTED - User might have pasted dots/bullets instead of actual key.",
        );
        return res.status(400).json({
          error:
            "مفتاح الربط الخاص بالدفع غير صالح. يبدو أنك قمت بنسخ نقاط (••••) بدلاً من المفتاح الحقيقي. يرجى التأكد من نسخ المفتاح الفعلي من لوحة تحكم UPayments ولصقه في إعدادات التطبيق.",
        });
      }

      // Ensure absolutely unique track ID for KNET by using timestamp and random string (max length 20 chars total)
      const uniqueSuffix =
        Date.now().toString(36).slice(-6) +
        Math.random().toString(36).substring(2, 6);
      const knetTrackId = `O-${uniqueSuffix}`;

      // Define base url depending on if it contains sandbox markers
      const isSandbox =
        String(process.env.UPAYMENTS_MODE || "").toLowerCase() === "sandbox" ||
        String(process.env.UPAYMENTS_ENV || "").toLowerCase() === "sandbox" ||
        cleanApiKey.toLowerCase().includes("sandbox") ||
        cleanApiKey.startsWith("test_");

      // Prefer standard production endpoint
      const upaymentsApiUrl = isSandbox
        ? "https://sandboxapi.upayments.com/api/v1/charge"
        : "https://uapi.upayments.com/api/v1/charge";

      // Log token details (truncated for security) to help debug 401 errors
      console.log(
        `[PAYMENT] UPAYMENTS_API_KEY exists: ${!!process.env.UPAYMENTS_API_KEY}, length: ${rawApiKey.length}`,
      );
      const tokenPrefix = cleanApiKey.substring(0, 5) + "...";
      console.log(
        `[PAYMENT] Creating payment with isSandbox=${isSandbox}, token starts with ${tokenPrefix}, Url: ${upaymentsApiUrl}`,
      );

      let protocol = req.headers["x-forwarded-proto"] || req.protocol;
      let host = req.headers["x-forwarded-host"] || req.get("host");
      let reqOrigin = baseUrl || req.get("origin");
      let devOrProdUrl = (reqOrigin && reqOrigin !== "null" && reqOrigin !== "undefined") ? reqOrigin : protocol + "://" + host;

      if (!devOrProdUrl || devOrProdUrl.includes("undefined") || devOrProdUrl === "null") {
        devOrProdUrl = "https://alturathkw.shop"; // fallback only
      }
      
      // If localhost, fallback to public url for Upayments to accept it
      if (devOrProdUrl.includes("localhost")) {
        devOrProdUrl = "https://alturathkw.shop";
      }
      
      // Ensure no trailing slash
      devOrProdUrl = devOrProdUrl.replace(/\/$/, "");

      // Return browser to whichever environment initiated the payment
      const generatedReturnUrl = `${devOrProdUrl}/api/payment-return/${orderId}/success`;
      const generatedCancelUrl = `${devOrProdUrl}/api/payment-return/${orderId}/failed`;
      // Webhooks MUST go to production to bypass sandbox blocking!
      // Use devOrProdUrl instead of hardcoded domain
      const generatedNotifyUrl = `${devOrProdUrl}/api/payment-webhook/${orderId}`;

      const finalReturnUrl = generatedReturnUrl;
      const finalCancelUrl = generatedCancelUrl;
      const finalNotificationUrl = generatedNotifyUrl;

      console.log(
        `[PAYMENT] URLs generated - Return: ${finalReturnUrl}, Notify: ${finalNotificationUrl}`,
      );

      const rawFinalAmount = parseFloat(amount).toFixed(3);
      const finalAmount = parseFloat(rawFinalAmount);

      // Save payment ID with a narrow shard update so payment-link creation does not wait for full app data.
      await updateAppDataAtomically((current) => {
        const orders = [...(current.orders || [])];
        const invoices = [...(current.invoices || [])];
        const index = orders.findIndex((o: any) => paymentRecordMatches(o, orderId));
        const invoiceIndex = invoices.findIndex((o: any) => paymentRecordMatches(o, orderId));
        if (index !== -1) {
          orders[index] = { ...orders[index], paymentId: knetTrackId, lastPaymentAmount: finalAmount };
          return { orders };
        }
        if (invoiceIndex !== -1) {
          invoices[invoiceIndex] = { ...invoices[invoiceIndex], paymentId: knetTrackId, lastPaymentAmount: finalAmount };
          return { invoices };
        }
        return null;
      }, ["orders", "invoices"]);

      // Check if amount is valid for UPayments (min 0.001 KWD)
      if (finalAmount < 0.001) {
        console.log(
          `[PAYMENT] Skipping UPayments for 0 or small amount: ${finalAmount}`,
        );
        // If it's 0, we treat it as a pre-paid/free successful transaction
        return res.json({
          success: true,
          paymentLink: `${devOrProdUrl}/api/payment-return/${orderId}/success${isPopup ? "?isPopup=true" : ""}`,
        });
      }

      // Define the Upayments mapped payload
      const upaymentsPayload = {
        returnUrl: finalReturnUrl,
        cancelUrl: finalCancelUrl,
        notificationUrl: finalNotificationUrl,
        language: "ar",
        paymentGateway: { src: "knet" },
        order: {
          id: knetTrackId,
          currency: "KWD",
          amount: finalAmount,
        },
        reference: { id: orderId },
        customer: {
          uniqueId: customerMobile
            ? `cid_${customerMobile}`
            : `cid_${uniqueSuffix}`,
          name: customerName || "Customer",
          email: customerEmail || "Dr.Ahmad.Alfailakawi@gmail.com",
          mobile: customerMobile || "00000000",
        },
      };

      let paymentResponse: any;
      try {
        const apiRes = await axios.post(upaymentsApiUrl, upaymentsPayload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${cleanApiKey}`,
          },
          timeout: 15000,
        });
        paymentResponse = apiRes.data;
      } catch (error: any) {
        const status = error.response?.status || 500;
        const errorData = error.response?.data || {};
        console.error("[PAYMENT] UPayments API Error:", status, errorData);

        if (status === 401) {
          return res.status(500).json({
            error:
              "مفتاح الربط الخاص بالدفع غير صالح، يرجى التأكد من الـ API Key الخاص بـ UPayments.",
          });
        }

        const errMsg =
          errorData.error || errorData.message || `UPayments Error: ${status}`;
        return res.status(status).json({ error: errMsg, details: errorData });
      }

      if (
        paymentResponse.status &&
        paymentResponse.data &&
        paymentResponse.data.link
      ) {
        res.json({ paymentLink: paymentResponse.data.link });
      } else {
        console.error("[PAYMENT] Failed to generate link:", paymentResponse);
        res.status(500).json({
          error: paymentResponse.data?.error || "Failed to create payment link",
        });
      }
    } catch (err: any) {
      console.error("Error creating payment:", err);
      res
        .status(500)
        .json({ error: "Failed to create payment", details: err.message });
    }
  });

  // Update Payment Link
  app.put("/api/orders/:id/payment-link", async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentLink } = req.body;
      if (!paymentLink) return res.status(400).json({ error: "No link" });

      await updateAppDataAtomically((current) => {
        let orders = [...(current.orders || [])];
        const index = orders.findIndex((o: any) => o.id === id);
        if (index !== -1) {
          orders[index].paymentLink = paymentLink;
          return { orders };
        }
        return null;
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save link" });
    }
  });

  // Join Roulette
  app.post("/api/orders/:id/join-roulette", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone } = req.body;
      const cleanName = String(name || "").trim();
      const cleanQPhone = cleanPhone(phone);
      if (!cleanName) return res.status(400).json({ error: "Missing name" });
      if (cleanQPhone.length !== 8) return res.status(400).json({ error: "Invalid phone" });

      await updateAppDataAtomically((current) => {
        let orders = [...(current.orders || [])];
        const index = orders.findIndex((o: any) => o.id === id);
        if (index !== -1) {
          if (!orders[index].splitParticipants) {
            orders[index].splitParticipants = [];
          }
          const normalizedJoinName = cleanName.toLowerCase();
          if (
            !orders[index].splitParticipants.some((p: any) => String(p.name || "").trim().toLowerCase() === normalizedJoinName || cleanPhone(p.phone) === cleanQPhone)
          ) {
            orders[index].splitParticipants.push({
              name: cleanName,
              phone: cleanQPhone,
              joinedAt: new Date().toISOString(),
            });
            return { orders };
          }
        }
        return null;
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to join roulette" });
    }
  });

  // Spin Roulette
  app.post("/api/orders/:id/spin-roulette", async (req, res) => {
    try {
      const { id } = req.params;
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};
      let orders = appData.orders || [];
      const index = orders.findIndex((o: any) => o.id === id);
      if (index === -1)
        return res.status(400).json({ error: "Order not found" });
      const existingOrder = orders[index];
      const existingParticipants = Array.isArray(existingOrder?.splitParticipants) ? existingOrder.splitParticipants : [];
      if (!existingOrder?.rouletteLoser && existingParticipants.length < 2) {
        return res.status(400).json({ error: "Need at least two participants" });
      }

      let loserName = "";
      let roulettePushPhones: string[] = [];
      let rouletteSquadId = "";
      let rouletteSquadName = "";
      await updateAppDataAtomically((current) => {
        let orders = [...(current.orders || [])];
        const index = orders.findIndex((o: any) => o.id === id);
        if (index === -1) return null;

        const order = orders[index];
        if (order.rouletteLoser) {
          loserName = order.rouletteLoser;
          return null;
        }
        if (!order.splitParticipants || order.splitParticipants.length < 2) return null;

        const loserIndex = Math.floor(Math.random() * order.splitParticipants.length);
        const loser = order.splitParticipants[loserIndex];

        orders[index].rouletteLoser = loser.name;
        orders[index].rouletteSpunAt = new Date().toISOString();
        loserName = loser.name;
        rouletteSquadId = String(order.squadId || "");
        rouletteSquadName = String(order.squadName || "");
        roulettePushPhones = (order.splitParticipants || [])
          .map((p: any) => cleanPhone(p.phone))
          .filter(Boolean);

        const squads = Array.isArray(current.squads) ? [...current.squads] : [];
        if (rouletteSquadId) {
          const sIdx = squads.findIndex((s: any) => String(s.id) === String(rouletteSquadId));
          if (sIdx > -1) {
            const sq = { ...squads[sIdx] };
            sq.membersList = Array.isArray(sq.membersList) ? [...sq.membersList] : [];
            const lPhone = cleanPhone(loser.phone || "");
            const mIdx = sq.membersList.findIndex((m: any) => (lPhone && cleanPhone(m.phone) === lPhone) || m.name === loser.name);
            if (mIdx > -1) {
              const m = { ...sq.membersList[mIdx] };
              m.lossesCount = (m.lossesCount || 0) + 1;
              sq.membersList[mIdx] = m;
            } else {
              sq.membersList.push({
                phone: lPhone,
                name: loser.name,
                lossesCount: 1,
                orderCount: 0,
                score: 100,
                checkedInAt: new Date().toISOString()
              });
            }
            squads[sIdx] = sq;
          }
        }

        return { orders, squads };
      });

      if (!loserName) {
        return res.status(400).json({ error: "Need at least two participants" });
      }

      if (loserName && roulettePushPhones.length > 0) {
        void sendDiwaniyaExternalPush({
          toPhones: roulettePushPhones,
          type: "roulette_result",
          title: "طلعت نتيجة وهق غيرك 🎰",
          body: `طاحت الفاتورة براس ${loserName}${rouletteSquadName ? ` بديوانية ${rouletteSquadName}` : ""}! 💸`,
          orderId: id,
          squadId: rouletteSquadId,
          url: `/track/${id}`,
        });
      }

      res.json({ success: true, loser: loserName });
    } catch (e) {
      res.status(500).json({ error: "Failed to spin roulette" });
    }
  });

  // Payment Webhook
  app.post(
    ["/api/payment-webhook/:pathOrderId/:pathSplitId", "/api/payment-webhook/:pathOrderId", "/api/payment-webhook", "/api/webhook/upayments"],
    async (req, res) => {
      try {
        console.log(
          `[PAYMENT] Webhook received at ${new Date().toISOString()}:`,
          JSON.stringify(req.body),
        );

        const pathOrder = req.params?.pathOrderId as string;
        const pathSplit = req.params?.pathSplitId as string;
        const queryId =
          (req.query.order_id as string) || (req.query.TrackID as string);
        let orderId = pathOrder || queryId;
        let splitId = pathSplit || "";

        if (!orderId && req.body?.reference?.id) {
          orderId = req.body.reference.id;
        }

        if (!orderId && req.body?.order_id) {
          orderId = req.body.order_id;
        }

        if (orderId && typeof orderId === "string" && orderId.includes("?")) {
          const parts = orderId.split("?");
          orderId = parts[0];
        }

        console.log(`[PAYMENT] Processing webhook for orderId: ${orderId}`);

        let statusStr = String(
          req.body?.status ||
            req.body?.result ||
            req.body?.Result ||
            req.query?.status ||
            req.query?.result ||
            req.query?.Result ||
            "",
        )
          .toUpperCase()
          .trim();
        if (statusStr.includes("?")) statusStr = statusStr.split("?")[0];
        const status =
          ["SUCCESS", "CAPTURED", "PAID", "APPROVED", "SUCCESSFUL", "TRUE", "AUTHORIZED", "HOSTED_SUCCESS", "1"].includes(
            statusStr,
          ) ||
          req.body?.status === true ||
          req.body?.status === 1 ||
          String(req.body?.status).toUpperCase() === "SUCCESS" ||
          String(req.body?.result).toUpperCase() === "SUCCESS" ||
          String(req.body?.Result).toUpperCase() === "SUCCESS" ||
          String(req.body?.Status).toUpperCase() === "SUCCESS";

        if (orderId) {
          await handlePaymentUpdate(orderId, splitId, status, req.body);
        }
        res.json({ success: true });
      } catch (e) {
        console.error("[PAYMENT] Webhook processing error:", e);
        res.status(500).json({ error: "Webhook Error" });
      }
    },
  );

  // Payment Success Handler
  app.all(
    [
      "/api/payment-return",
      "/api/payment-return/:orderId",
      "/api/payment-return/:orderId/:pathStatus",
    ],
    async (req, res) => {
      try {
        const bodyOrder = req.body?.order_id || req.body?.reference?.id;
        const queryOrder = req.query?.order_id as string;

        let orderId = req.params.orderId || queryOrder || bodyOrder || "";
        let splitId = (req.query.splitId as string) || (req.query.SplitID as string) || "";

        // Fallback if orderId has '?'
        if (typeof orderId === "string" && orderId.includes("?")) {
          orderId = orderId.split("?")[0];
        }

        let isSplit = !!splitId;
        let originalOrderId = String(orderId);
        let baseOrderId = originalOrderId.toUpperCase();
        
        // Radical Fix: Ensure baseOrderId is correctly stripped of split suffixes even with complex IDs
        if (baseOrderId.includes("-S-")) {
           isSplit = true;
           const parts = originalOrderId.split("-S-");
           if (parts.length > 2) {
              // Format was ORDER_ID-S-S-UNIQUE
              baseOrderId = parts[0].toUpperCase();
              if (!splitId) splitId = "S-" + parts[2];
           } else if (parts.length === 2) {
              // Format might be ORDER_ID-S-UNIQUE
              baseOrderId = parts[0].toUpperCase();
              if (!splitId) splitId = parts[1];
           }
        }

        // Gather all possible status indicators
        const searchParams = new URL(
          req.protocol + "://" + req.get("host") + req.originalUrl,
        ).searchParams;

        let statusFields = [
          req.params?.pathStatus,
          searchParams.get("payment"),
          searchParams.get("result"),
          searchParams.get("Result"),
          searchParams.get("status"),
          req.body?.payment,
          req.body?.result,
          req.body?.Result,
          req.body?.status,
        ];

        const pathStatus = (req.params?.pathStatus || "").toLowerCase();

        let isExplicitFailure = statusFields.some((x) => {
          if (!x) return false;
          let s = String(x).toUpperCase().trim();
          if (s.includes("?")) s = s.split("?")[0];

          // لا نعتبر Apple Pay / OTP / redirect intermediate فشل إلا إذا كان الفشل صريحًا.
          return [
            "FAILED",
            "FAILURE",
            "CANCELED",
            "CANCELLED",
            "ERROR",
            "DECLINED",
            "REJECTED",
            "EXPIRED",
            "NOT CAPTURED",
            "NOT_CAPTURED",
          ].includes(s);
        });
        let isExplicitSuccess = statusFields.some((x) => {
          if (!x) return false;
          let s = String(x).toUpperCase().trim();
          if (s.includes("?")) s = s.split("?")[0];
          return (
            ["SUCCESS", "CAPTURED", "PAID", "APPROVED", "SUCCESSFUL", "AUTHORIZED", "TRUE", "HOSTED_SUCCESS", "1"].includes(
              s,
            ) || s === "TRUE" || s === "SUCCESS" || s === "SUCCESSFUL" || s === "1"
          );
        });

        if (pathStatus === "success") {
          isExplicitSuccess = true;
          isExplicitFailure = false;
        } else if (pathStatus === "failed" || pathStatus === "cancel") {
          isExplicitFailure = true;
          isExplicitSuccess = false;
        }

        let phone = "";
        if (orderId) {
          const callbackPayload = { ...req.body, ...req.query };
          if (!isSplit && (isExplicitSuccess || isExplicitFailure)) {
            await syncRootPaymentDocsFast(baseOrderId, isExplicitSuccess, callbackPayload);
            void handlePaymentUpdate(orderId, splitId, isExplicitSuccess, callbackPayload);
          } else {
            await handlePaymentUpdate(orderId, splitId, isExplicitSuccess, callbackPayload);
          }
        }
        
        if (false) {
          const docRef = doc(db, "appData", "shared_company_data");
          const d = await getAppDataRef();
          const appData = d.data() || {};
          let orders = appData.orders || [];
          let invoices = appData.invoices || [];
          const orderIndex = orders.findIndex((o: any) => String(o.id).toUpperCase() === baseOrderId);
          const invoiceIndex = invoices.findIndex((o: any) => String(o.id).toUpperCase() === baseOrderId);

          let updated = false;

          if (orderIndex !== -1) {
            phone =
              orders[orderIndex].customerPhone ||
              orders[orderIndex].phone ||
              "";
            const currentStatus = orders[orderIndex].status;

            if (isSplit) {
              if (!orders[orderIndex].splitPayments) orders[orderIndex].splitPayments = [];
              const splitIdx = orders[orderIndex].splitPayments.findIndex((s: any) => {
                const sid = String(s.id).toUpperCase();
                const target = String(splitId).toUpperCase();
                return sid === target || sid === `S-${target}` || target === `S-${sid}` || (sid.length > 5 && target.includes(sid));
              });
              
              if (splitIdx !== -1) {
                 if (isExplicitSuccess && orders[orderIndex].splitPayments[splitIdx].status !== "paid") {
                    orders[orderIndex].splitPayments[splitIdx].status = "paid";
                    orders[orderIndex].splitPayments[splitIdx].datePaid = new Date().toISOString();
                    
                    // Update totalSpent immediately, but DO NOT add loyalty points yet
                    const payer = orders[orderIndex].splitPayments[splitIdx];
                    const cPhone = cleanPhone(payer.phone);
                    if (cPhone) {
                       const customers = appData.customers || [];
                       const existingCustIdx = customers.findIndex((c: any) => cleanPhone(c.phone) === cPhone);
                       if (existingCustIdx === -1) {
                         customers.push({
                           id: "CUST-" + Date.now().toString(36) + Math.random().toString(36).slice(-4),
                           name: payer.name || "صديق عميل",
                           phone: payer.phone,
                           acquired_via_split: true,
                           createdAt: new Date().toISOString(),
                           totalSpent: Number(payer.amount) || 0,
                           loyaltyPoints: 0, // Wait until fully paid to add points
                         });
                       } else {
                         customers[existingCustIdx].totalSpent = (Number(customers[existingCustIdx].totalSpent) || 0) + (Number(payer.amount) || 0);
                         customers[existingCustIdx].lastUpdated = new Date().toISOString();
                       }
                       appData.customers = customers; // Ensure reference updates
                    }
                    
                    const totalPaid = orders[orderIndex].splitPayments
                      .filter((s: any) => s.status === "paid")
                      .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
                    
                    const totalPaidFils = Math.round(totalPaid * 1000);
                    const orderTotalFils = Math.round((Number(orders[orderIndex].total) || 0) * 1000);

                    if (totalPaidFils >= orderTotalFils - 5) {
                      orders[orderIndex].status = "تم الدفع بنجاح";
                      orders[orderIndex].paymentStatus = "paid";
                      orders[orderIndex].paidAt = new Date().toISOString();
                      
                      // Now that the ENTIRE order is fully paid, distribute loyalty points to all contributors!
                      orders[orderIndex].splitPayments.filter((s: any) => s.status === "paid").forEach((p: any) => {
                          const cleanP = cleanPhone(p.phone);
                          if (cleanP && appData.customers) {
                              const eIdx = appData.customers.findIndex((c: any) => cleanPhone(c.phone) === cleanP);
                              if (eIdx !== -1) {
                                  appData.customers[eIdx].loyaltyPoints = (Number(appData.customers[eIdx].loyaltyPoints) || 0) + (Number(p.amount) || 0);
                              }
                          }
                      });
                    }
                    updated = true;
                    console.log(`[PAYMENT] Split ${splitId} for Order ${baseOrderId} marked paid via return URL`);
                  } else if (isExplicitFailure) {
                    if (orders[orderIndex].splitPayments[splitIdx].status !== "paid") {
                      orders[orderIndex].splitPayments[splitIdx].status = "failed";
                      updated = true;
                    }
                 }
              }
            } else if (
              currentStatus === "فشل في عملية الدفع" ||
              currentStatus === "جديد" ||
              currentStatus === "بانتظار الدفع" ||
              currentStatus === "قيد تجميع القطية" ||
              (currentStatus || "").includes("ملغي")
            ) {
	              if (isExplicitFailure) {
	                orders[orderIndex].status = "فشل في عملية الدفع";
	                orders[orderIndex].paymentStatus = "failed";
	                orders[orderIndex].failedAt = new Date().toISOString();
	                orders[orderIndex].paymentUpdatedAt = new Date().toISOString();
	                updated = true;
	                console.log(
	                  `[PAYMENT] Order ${orderId} marked as failed via explicitly cancelled return URL`,
                );
              } else if (isExplicitSuccess) {
                if (orders[orderIndex].paymentStatus !== "paid" && !orders[orderIndex].status.startsWith("تم الدفع")) {
	                  orders[orderIndex].status = "تم الدفع بنجاح";
	                  orders[orderIndex].paymentStatus = "paid";
	                  orders[orderIndex].paidAt = new Date().toISOString();
	                  orders[orderIndex].paymentUpdatedAt = new Date().toISOString();
	                  orders[orderIndex].transactionId =
                    req.body?.reference?.id ||
                    req.body?.TrackID ||
                    req.query?.TrackID ||
                    req.body?.order_id ||
                    req.query?.order_id ||
                    "upayments_auth";
                  updated = true;
                  console.log(
                    `[PAYMENT] Order ${orderId} marked as PAID via synchronous return URL (Webhook may have failed due to 403)`,
                  );
                  
                  // Auto-fill splitPayments so the UI sees it as fully paid
                  if (!orders[orderIndex].splitPayments) orders[orderIndex].splitPayments = [];
                  const localTotalPaid = orders[orderIndex].splitPayments
                    .filter((s: any) => String(s.status).toLowerCase() === "paid")
                    .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
                    const remainder = Number(orders[orderIndex].total) - localTotalPaid;
                    if (remainder >= 0.005) {
                      orders[orderIndex].splitPayments.push({
                        id: "S-" + Date.now().toString(36),
                        name: "مكمل الفاتورة",
                        phone: orders[orderIndex].customerPhone || "00000000",
                        amount: remainder,
                        status: "paid",
                        date: new Date().toISOString(),
                        paymentId: orders[orderIndex].transactionId
                      });
                    }
                  }

                  // Update customer points
                  const cPhone = cleanPhone(orders[orderIndex].customerPhone);
                  const custIdx = appData.customers?.findIndex(
                    (c: any) => cleanPhone(c.phone) === cPhone,
                  );
                  if (custIdx !== -1) {
                    const amountPaid = orders[orderIndex].lastPaymentAmount !== undefined ? Number(orders[orderIndex].lastPaymentAmount) : Number(orders[orderIndex].total) || 0;
                    appData.customers[custIdx].totalSpent =
                      (Number(appData.customers[custIdx].totalSpent) || 0) +
                      amountPaid;
                    appData.customers[custIdx].loyaltyPoints =
                      (Number(appData.customers[custIdx].loyaltyPoints) || 0) +
                      amountPaid;
                    appData.customers[custIdx].lastUpdated = new Date().toISOString();
                  }
                }
              } else {
                console.log(`[PAYMENT] Order ${orderId} unverified return status`);
              }
            }

          if (invoiceIndex !== -1) {
            if (!phone) phone = invoices[invoiceIndex].customerPhone || invoices[invoiceIndex].phone || "";
            const currentStatus = invoices[invoiceIndex].status;
            const normalizedInvoiceId = String(orderId).toUpperCase();
            const invoiceIndexes = invoices.map((inv: any, idx: number) => String(inv.id).toUpperCase() === normalizedInvoiceId ? idx : -1).filter((idx: number) => idx !== -1);

            if (currentStatus === "جديد" || currentStatus === "بانتظار الدفع" || currentStatus === "تم الدفع بنجاح") {
              const transactionId = req.body?.reference?.id || req.body?.TrackID || req.query?.TrackID || "upayments_auth";
	              if (isExplicitFailure) {
	                invoiceIndexes.forEach((idx: number) => {
	                  invoices[idx].status = "فشل في عملية الدفع";
	                  invoices[idx].paymentStatus = "failed";
	                  invoices[idx].failedAt = new Date().toISOString();
	                  invoices[idx].paymentUpdatedAt = new Date().toISOString();
	                  invoices[idx].transactionId = transactionId;
	                });
	                updated = true;
	              } else if (isExplicitSuccess) {
	                invoiceIndexes.forEach((idx: number) => {
	                  invoices[idx].status = "تم الدفع بنجاح";
	                  invoices[idx].paymentStatus = "paid";
	                  invoices[idx].paidAt = new Date().toISOString();
	                  invoices[idx].paymentUpdatedAt = new Date().toISOString();
	                  invoices[idx].transactionId = transactionId;
	                });
                updated = true;
              }
            }
          }

          if (updated) {
            await updateAppData({ orders, invoices, customers: appData.customers || [] });
          }
        }

        // Target Base URL
        let rProtocol = req.headers["x-forwarded-proto"] || req.protocol;
        let rHost = req.headers["x-forwarded-host"] || req.get("host");
        let baseUrl = req.get("origin") || rProtocol + "://" + rHost;
        if (!baseUrl || baseUrl.includes("undefined"))
          baseUrl = "https://alturathkw.shop";

        // Append success or fail for frontend alert
        let paymentParam = isExplicitFailure
          ? "failed"
          : isExplicitSuccess
            ? "success"
            : "pending";

        // Double check only for unclear gateway statuses; explicit success/failure was already written above.
        if (orderId && !isExplicitSuccess && !isExplicitFailure) {
           try {
              const d = await getAppDataRef();
              const reqData = d.data() || {};
              const dbOrders = reqData.orders || [];
              const oIdx = dbOrders.findIndex((o: any) => String(o.id).toUpperCase() === baseOrderId);
              if (oIdx !== -1) {
                 if (isSplit && dbOrders[oIdx].splitPayments) {
                    const splitIdx = dbOrders[oIdx].splitPayments.findIndex((s: any) => String(s.id).toUpperCase() === String(splitId).toUpperCase() || String(s.id).toUpperCase() === `S-${String(splitId).toUpperCase()}` || String(splitId).toUpperCase().includes(String(s.id).toUpperCase()));
                    if (splitIdx !== -1 && dbOrders[oIdx].splitPayments[splitIdx].status === "paid") {
                       paymentParam = "success";
                       isExplicitFailure = false;
                       isExplicitSuccess = true;
                    }
                 } else {
                    if (dbOrders[oIdx].paymentStatus === "paid" || (dbOrders[oIdx].status || "").startsWith("تم الدفع")) {
                       paymentParam = "success";
                       isExplicitFailure = false;
                       isExplicitSuccess = true;
                    }
                 }
              }
           } catch(e) {}
        }
        
        let trackUrl = `${baseUrl}/track?order_id=${baseOrderId}&payment=${paymentParam}`;
        if (isSplit) {
           trackUrl = `${baseUrl}/split/${baseOrderId}?payment=${paymentParam}`;
        }

        // We removed the immediate redirect so the beautiful HTML screen always appears.

        console.log(
          `[PAYMENT] Showing return page for order ${orderId} (Failure detected: ${isExplicitFailure}, status: ${paymentParam})`,
        );

        return res.type("html").send(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>حالة الدفع</title>
                <style>
                    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafaf9; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
                    .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 90%; width: 400px; }
                    .icon { font-size: 4rem; margin-bottom: 1rem; }
                    .success { color: #16a34a; }
                    .error { color: #dc2626; }
                    h1 { margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #1c1917; }
                    p { color: #78716c; margin-bottom: 1.5rem; }
                    .btn { display: inline-block; background: #e0ac69; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 500; transition: background 0.2s; border: none; cursor: pointer; width: 100%; box-sizing: border-box; }
                    .btn:hover { background: #c89552; }
                    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #e0ac69; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="card">
                    <div id="loading">
                        <div class="spinner"></div>
                        <p style="margin-top: 1rem;">جاري تحديث حالة الدفع...</p>
                    </div>
                    <div id="content" style="display: none;">
                        <div class="icon ${isExplicitFailure ? "error" : "success"}">
                            ${isExplicitFailure ? "✖" : "✔"}
                        </div>
                        <h1>${isExplicitFailure ? "فشلت عملية الدفع" : "تم الدفع بنجاح"}</h1>
                        <p>${isExplicitFailure ? "نعتذر، لم نتمكن من إتمام عملية الدفع." : "شكراً لك، تم تأكيد طلبك بنجاح."}</p>
                        <a href="${trackUrl}" class="btn" onclick="closePopupAndRedirect(event)">العودة إلى الموقع</a>
                    </div>
                </div>
                <script>
                    try {
                        localStorage.setItem("track_order_id", "${baseOrderId}");
                        localStorage.setItem("track_status", "${paymentParam}");
                        if ("${paymentParam}" === "success" || "${paymentParam}" === "paid") {
                            localStorage.setItem("post_payment_open_order_id", "${baseOrderId}");
                        }
                    } catch(e) {}

                    function closePopupAndRedirect(e) {
                        if (e) e.preventDefault();
                        const targetUrl = e ? e.currentTarget.href : "${trackUrl}";
                        
                        try {
                            if (window.opener && !window.opener.closed) {
                                window.opener.postMessage(JSON.stringify({ type: 'payment_return', orderId: '${baseOrderId}', payment: '${paymentParam}' }), '*');
                                window.opener.postMessage({ type: 'PAYMENT_COMPLETE', url: targetUrl, orderId: '${baseOrderId}', payment: '${paymentParam}' }, '*');
                                setTimeout(() => window.close(), 100);
                            } else {
                                window.location.href = targetUrl;
                            }
                        } catch (err) {
                            window.location.href = targetUrl;
                        }
                    }

                    // Auto-trigger completion immediately to avoid duplicate screens
                    closePopupAndRedirect();
                </script>
            </body>
            </html>
          `);
      } catch (e) {
        console.error("Error in return handler", e);

        let rProtocol = req.headers["x-forwarded-proto"] || req.protocol;
        let rHost = req.headers["x-forwarded-host"] || req.get("host");
        let fallbackBaseUrl = req.get("origin") || rProtocol + "://" + rHost;
        if (!fallbackBaseUrl || fallbackBaseUrl.includes("undefined"))
          fallbackBaseUrl = "https://alturathkw.shop";
        let trackFallback = `${fallbackBaseUrl}/track`;
        const possibleOrderId =
          req.params.orderId ||
          req.query.order_id ||
          req.body?.order_id ||
          req.body?.reference?.id;
        if (possibleOrderId) {
          const cleanId =
            typeof possibleOrderId === "string"
              ? possibleOrderId.split("?")[0]
              : possibleOrderId;
          trackFallback += `?order_id=${cleanId}`;
          res.type("html")
            .send(`<html><head><title>Redirecting...</title></head><body><script>
                  try {
                      localStorage.setItem("track_order_id", "${cleanId}");
                      localStorage.setItem("track_status", "failed");
                  } catch(e) {}
                  window.location.href="${trackFallback}";
              </script></body></html>`);
        } else {
          res
            .type("html")
            .send(
              `<html><head><title>Redirecting...</title></head><body><script>window.location.href="${trackFallback}";</script></body></html>`,
            );
        }
      }
    },
  );

  // Search Orders by Phone
  app.get("/api/search-order/:phone", async (req, res) => {
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    try {
      const cleanQueryPhone = cleanPhone(phone);
      const d = await getAppDataRef();
      const appData = d.data() || {};

      const allOrders = appData.orders || [];

      // Filter by phone
      const matchedOrders = allOrders.filter(
        (order: any) =>
          cleanPhone(order.customerPhone || order.phone) === cleanQueryPhone,
      );

      // Sort by date descending
      matchedOrders.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.date || 0).getTime();
        return dateB - dateA;
      });

      res.json(matchedOrders.slice(0, 10));
    } catch (error) {
      console.error("Error searching orders:", error);
      res.status(500).json({ error: "Failed to search orders" });
    }
  });

  // Legacy endpoints for UI compatibility
  app.get("/api/admin/orders", async (req, res) => {
    const d = await getAppDataRef();
    const data = d.data() || {};
    res.json(data.orders || []);
  });

  app.get("/api/admin/invoices", async (req, res) => {
    const d = await getAppDataRef();
    const data = d.data() || {};
    res.json(data.invoices || []);
  });

  app.patch("/api/admin/orders/:id/pay", async (req, res) => {
    const { id } = req.params;
    try {
      let resultData = null;
      await updateAppDataAtomically((current) => {
        const orders = [...(current.orders || [])];
        const invoices = [...(current.invoices || [])];

        const orderIdx = orders.findIndex((o: any) => o.id === id);
        if (orderIdx === -1) return null;

        const orderData = orders[orderIdx];
        const invoiceData = {
          ...orderData,
          id: orderData.id,
          invoiceId: orderData.id,
          paymentStatus: "paid",
          status: "تم الدفع بنجاح",
          completedAt: new Date().toISOString(),
        };

        const existingInvoiceIdx = invoices.findIndex((inv: any) => String(inv.id).toUpperCase() === String(invoiceData.id).toUpperCase());
        if (existingInvoiceIdx !== -1) {
          invoices[existingInvoiceIdx] = { ...invoices[existingInvoiceIdx], ...invoiceData };
        } else {
          invoices.push(invoiceData);
        }
        orders.splice(orderIdx, 1);
        resultData = invoiceData;
        return { orders, invoices };
      });

      if (!resultData) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({
        message: "Order moved to invoices successfully",
        invoiceData: resultData,
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to mark as paid" });
    }
  });

  app.patch("/api/admin/orders/:id/cancel", async (req, res) => {
    const { id } = req.params;
    try {
      const ok = await updateAppDataAtomically((current: any) => {
        const orders = Array.isArray(current.orders) ? [...current.orders] : [];
        const idx = orders.findIndex((o: any) => String(o.id) === String(id));
        if (idx !== -1) {
          orders[idx] = { ...orders[idx], status: "ملغي", paymentStatus: "failed" };
        }
        return { orders };
      });
      if (ok) {
        res.json({ message: "Order cancelled successfully" });
      } else {
        res.status(404).json({ error: "Order not found" });
      }
    } catch (e) {
      res.status(500).json({ error: "Failed to cancel order" });
    }
  });

  // Fix free delivery logic to actually update the database in both lists!
  app.patch("/api/admin/orders/:id/free-delivery", async (req, res) => {
    const { id } = req.params;
    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      const appData = d.data() || {};

      let orders = appData.orders || [];
      let invoices = appData.invoices || [];

      let found = false;

      const updateToFree = (item: any) => {
        // ALWAYS force recalculation for free delivery to fix bad state total
        const itemsTotal = (item.items || []).reduce((sum: number, i: any) => {
          const extrasTotal = (i.selectedExtras || i.extras || []).reduce(
            (eSum: number, e: any) => eSum + (Number(e.price) || 0),
            0,
          );
          return (
            sum +
            (Number(i.price) || 0) * (Number(i.quantity) || 1) +
            extrasTotal
          );
        }, 0);

        return {
          ...item,
          deliveryFee: 0,
          isFreeDelivery: true,
          deliveryType: "free",
          total: itemsTotal,
        };
      };

      const oIdx = orders.findIndex((o: any) => o.id === id);
      if (oIdx !== -1) {
        orders[oIdx] = updateToFree(orders[oIdx]);
        found = true;
      }

      const iIdx = invoices.findIndex((i: any) => i.id === id);
      if (iIdx !== -1) {
        invoices[iIdx] = updateToFree(invoices[iIdx]);
        found = true;
      }

      if (!found) {
        return res.status(404).json({ error: "Order/Invoice not found" });
      }

      await updateAppData({ orders, invoices });

      res.json({ message: "Delivery fee removed successfully" });
    } catch (e) {
      console.error("Error in free-delivery PATCH:", e);
      res.status(500).json({ error: "Failed to update delivery fee" });
    }
  });

  // Admin: Promo Codes
  app.get("/api/admin/promocodes", async (req, res) => {
    try {
      const d = await getAppDataRef();
      if (!d.exists()) return res.json([]);
      res.json(d.data().promocodes || []);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch promocodes" });
    }
  });

  app.post("/api/admin/promocodes", async (req, res) => {
    const { code, type, value, isActive } = req.body;
    if (!code || !type || value === undefined)
      return res.status(400).json({ error: "Missing fields" });

    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      let promocodes = d.exists() ? d.data().promocodes || [] : [];

      const newPromo = {
        code: code.toUpperCase().trim(),
        type,
        value: Number(value),
        discountValue: Number(value),
        isActive: isActive !== undefined ? isActive : true,
      };

      // Check if exists
      const existingIdx = promocodes.findIndex(
        (p: any) => p.code === newPromo.code,
      );
      if (existingIdx > -1) {
        promocodes[existingIdx] = newPromo;
      } else {
        promocodes.push(newPromo);
      }

      await updateAppData({ promocodes });
      res.json({ success: true, promo: newPromo });
    } catch (e) {
      res.status(500).json({ error: "Failed to save promocode" });
    }
  });

  app.delete("/api/admin/promocodes/:code", async (req, res) => {
    const { code } = req.params;
    try {
      const docRef = doc(db, "appData", "shared_company_data");
      const d = await getAppDataRef();
      if (!d.exists()) return res.status(404).json({ error: "Not found" });

      let promocodes = d.data().promocodes || [];
      promocodes = promocodes.filter(
        (p: any) => p.code !== code.toUpperCase().trim(),
      );

      await updateAppData({ promocodes });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete promocode" });
    }
  });

  app.get("/api/debug-collections", async (req, res) => {
    try {
      const q = await getDocs(collection(db, "appData"));
      const docs = q.docs.map(d => ({ id: d.id, data: d.data() }));
      res.json(docs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug-docs", async (req, res) => {
    try {
      const data = await getAppData();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug-search", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const results = [];
      const searchObj = (obj, path) => {
        if (!obj) return;
        
        // Search keys
        if (typeof obj === "object" && !Array.isArray(obj)) {
          for (const key in obj) {
            if (key.toLowerCase().includes("tier") || key.toLowerCase().includes("level")) {
               results.push({ path: path + "." + key, type: "key", value: obj[key] });
            }
          }
        }

        if (typeof obj === "object") {
          for (const key in obj) {
            searchObj(obj[key], path ? `${path}.${key}` : key);
          }
        }
      };
      searchObj(data, "");
      res.json(results);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug-squads", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      const sqs = (data.squads || []).map(s => ({
        id: s.id,
        name: s.name,
        tier: s.tier,
      }));
      res.json(sqs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug-loyalty", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      res.json(data.loyaltySettings || { message: "No loyalty settings" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug", async (req, res) => {
    try {
      const d = await getAppDataRef();
      const data = d.data() || {};
      res.json({
        databaseSource: "Firebase Firestore",
        documentPath: "appData/shared_company_data",
        customersCount: (data.customers || []).length,
        productsCount: (data.products || []).length,
        zonesCount: (data.zones || []).length,
        ordersCount: (data.orders || []).length,
        invoicesCount: (data.invoices || []).length,
        settings: data.settings || {},
        allKeys: Object.keys(data),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch debug data" });
    }
  });

  // Viral Split Payment Meta Tags (WhatsApp/iMessage)
  app.get("/split/:id", async (req, res, next) => {
    // Detect if it's a social crawler or bot
    const ua = req.headers["user-agent"] || "";
    const isBot =
      /WhatsApp|facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Pinterest|Slackbot|TelegramBot/i.test(
        ua,
      );

    if (isBot) {
      try {
        const { id } = req.params;
        const d = await getAppDataRef();
        const data = d.data() || {};
        const orders = data.orders || [];
        const order = orders.find((o: any) => o.id === id);

        if (order) {
          const title = "قطية عشا بمطبخ التراث! 🍽️";
          const desc = `عشانا بـ ${order.total.toFixed(3)} د.ك.. قط قطيتك بالرابط والحق على الأكل! 🥘`;
          // Thumbnail image - ideally a generic "Order" or "Food" image
          const image =
            "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1287&auto=format&fit=crop";

          return res.send(`
              <!DOCTYPE html>
              <html dir="rtl" lang="ar">
              <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <meta name="description" content="${desc}">
                <meta property="og:title" content="${title}">
                <meta property="og:description" content="${desc}">
                <meta property="og:image" content="${image}">
                <meta property="og:type" content="website">
                <meta name="twitter:card" content="summary_large_image">
              </head>
              <body>
                <h1>جاري تحويلك...</h1>
                <script>window.location.href = "/split/${id}";</script>
              </body>
              </html>
            `);
        }
      } catch (e) {
        console.error("[META ERROR]", e);
      }
    }
    next(); // Pass to Vite/React if not a bot or order not found
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler to guarantee JSON response
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Express Error:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);

    // Background task to timeout expired split payments automatically
    setInterval(async () => {
      try {
        const d = await getAppDataRef();
        const appData = d.data() || {};
        const allOrders = appData.orders || [];
        const now = Date.now();
        const TIMEOUT = 120 * 60 * 1000;
        let expiredIds: string[] = [];

        allOrders.forEach((o: any) => {
          if (o.status === "قيد تجميع القطية" && o.createdAt) {
            const created = new Date(o.createdAt).getTime();
            if (now - created > TIMEOUT) {
              expiredIds.push(o.id);
            }
          }
        });

        if (expiredIds.length > 0) {
          console.log(`[SPLIT_BG] Expired: ${expiredIds.join(", ")}`);
          await updateAppDataAtomically((current) => {
            const updatedOrders = (current.orders || []).map((o: any) => {
              if (expiredIds.includes(o.id) && o.status === "قيد تجميع القطية") {
                 return { ...o, status: "ملغي - انتهى وقت القطية" };
              }
              return o;
            });
            return { orders: updatedOrders };
          });
        }
      } catch (err) {
        console.error("[SPLIT] Background task error:", err);
      }
    }, 60 * 1000); // Check every 1 minute
  });
}

startServer();
