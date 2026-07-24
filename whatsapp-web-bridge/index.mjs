import 'dotenv/config';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';

const { Client, LocalAuth } = pkg;

const VERSION = '1.0.0';
const baseUrl = String(process.env.ALTURATH_BRIDGE_BASE_URL || '').trim().replace(/\/$/, '');
const secret = String(process.env.WHATSAPP_BRIDGE_SECRET || '').trim();
const deviceId = String(process.env.WHATSAPP_BRIDGE_DEVICE_ID || 'alturath-mac-main').trim();
const sessionPath = path.resolve(process.cwd(), String(process.env.WHATSAPP_SESSION_PATH || '.session'));
const lockPath = path.join(sessionPath, 'alturath-bridge.lock');
const sentJournalPath = path.join(sessionPath, 'alturath-sent-outbox.json');
const phoneAliasPath = path.join(sessionPath, 'alturath-lid-phone-aliases.json');
const pollIntervalMs = clampNumber(process.env.WHATSAPP_POLL_INTERVAL_MS, 500, 10000, 1200);
const startupHistoryGraceMs = clampNumber(process.env.WHATSAPP_STARTUP_HISTORY_GRACE_SECONDS, 0, 1800, 120) * 1000;
const maxAutoOutboxAgeMs = clampNumber(process.env.WHATSAPP_MAX_AUTO_OUTBOX_AGE_MINUTES, 1, 1440, 15) * 60 * 1000;
const markRead = parseBoolean(process.env.WHATSAPP_MARK_READ, true);
const ignoreGroups = parseBoolean(process.env.WHATSAPP_IGNORE_GROUPS, true);
const ignoreStatus = parseBoolean(process.env.WHATSAPP_IGNORE_STATUS, true);
const pollRecentChats = parseBoolean(process.env.WHATSAPP_POLL_RECENT_CHATS, false);
const warmLidAliases = parseBoolean(process.env.WHATSAPP_WARM_LID_ALIASES, true);
const ignoredInboundTypes = new Set([
  'e2e_notification',
  'notification_template',
  'gp2',
  'protocol',
  'revoked',
  'ciphertext',
]);

if (!baseUrl.startsWith('https://') || !secret || secret.length < 64) {
  console.error('❌ ملف .env غير مكتمل. يلزم رابط HTTPS وسر بطول 64 حرفاً على الأقل.');
  process.exit(1);
}

let ready = false;
let shuttingDown = false;
// Health the heartbeat reports, so the dashboard can tell "process alive" apart from
// "actually working". A bridge that authenticated but never finished starting, or that
// cannot reach the reply queue, used to look perfectly green while sending nothing.
let needsAuthScan = false;   // WhatsApp is asking for a QR scan
let pollFailures = 0;        // consecutive reply-queue read failures
let lastPollOkAt = 0;        // last time the reply queue was read successfully
let pendingQr = '';          // latest pairing code, forwarded for the console to draw
let pendingQrAt = 0;         // when it arrived — codes expire fast
let pendingQrArt = '';       // block-character rendering the console draws as-is
let startingSince = 0;       // when this process began waiting to become ready
let pollTimer = null;
let heartbeatTimer = null;
let inboundPollTimer = null;
let watchdogTimer = null;
let accountDigits = '';
let startedAt = Date.now();
let polling = false;
let inboundPolling = false;
const recentInboundIds = new Map();
const sentOutboxJournal = loadSentJournal();
const phoneAliasMap = loadPhoneAliasMap();

function acquireSingleInstanceLock() {
  fs.mkdirSync(sessionPath, { recursive: true });
  try {
    const fd = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    fs.closeSync(fd);
    return;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    let existing = {};
    try {
      existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    } catch {
      fs.rmSync(lockPath, { force: true });
      return acquireSingleInstanceLock();
    }
    const pid = Number(existing?.pid || 0);
    if (pid > 0) {
      try {
        process.kill(pid, 0);
        console.error('❌ توجد نسخة أخرى من جسر واتساب تعمل حالياً. أوقفها قبل تشغيل نسخة جديدة.');
        process.exit(1);
      } catch {
        fs.rmSync(lockPath, { force: true });
        return acquireSingleInstanceLock();
      }
    }
    fs.rmSync(lockPath, { force: true });
    return acquireSingleInstanceLock();
  }
}

function releaseSingleInstanceLock() {
  try {
    const existing = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (Number(existing?.pid || 0) === process.pid) fs.rmSync(lockPath, { force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

function openQrInSafari(qrText) {
  try {
    fs.mkdirSync(sessionPath, { recursive: true });
    const htmlPath = path.join(sessionPath, 'latest-qr.html');
    const escaped = String(qrText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    fs.writeFileSync(htmlPath, `<!doctype html>
<html lang="ar" dir="rtl">
<meta charset="utf-8">
<title>ربط واتساب التراث</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main { text-align: center; }
  pre { direction: ltr; display: inline-block; margin: 16px auto; padding: 24px; background: #fff; color: #000; font-family: Menlo, Monaco, monospace; font-size: 14px; line-height: 0.9; letter-spacing: 0; border: 1px solid #ddd; }
  p { margin: 8px 0; font-size: 16px; }
</style>
<main>
  <p>امسح الرمز من واتساب بزنس: الإعدادات > الأجهزة المرتبطة > ربط جهاز</p>
  <pre>${escaped}</pre>
  <p>إذا انتهت صلاحية الرمز، ستُحدَّث هذه الصفحة عند ظهور رمز جديد.</p>
</main>
</html>
`, { mode: 0o600 });
    execFile('/usr/bin/open', ['-a', 'Safari', htmlPath], () => {});
  } catch (error) {
    console.warn('⚠️ تعذر فتح QR في Safari:', error?.message || error);
  }
}

function loadSentJournal() {
  try {
    const parsed = JSON.parse(fs.readFileSync(sentJournalPath, 'utf8'));
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return new Map(entries.filter((entry) => entry?.id).map((entry) => [String(entry.id), entry]));
  } catch {
    return new Map();
  }
}

function saveSentJournal() {
  try {
    fs.mkdirSync(sessionPath, { recursive: true });
    const entries = Array.from(sentOutboxJournal.values())
      .sort((a, b) => Number(b.sentAt || 0) - Number(a.sentAt || 0))
      .slice(0, 3000);
    fs.writeFileSync(sentJournalPath, JSON.stringify({ version: 1, entries }, null, 2), { mode: 0o600 });
    sentOutboxJournal.clear();
    for (const entry of entries) sentOutboxJournal.set(String(entry.id), entry);
  } catch (error) {
    console.warn('⚠️ تعذر حفظ سجل منع تكرار الإرسال:', error?.message || error);
  }
}

function rememberSentOutbox(id, waMessageId = '') {
  sentOutboxJournal.set(String(id), { id: String(id), waMessageId: String(waMessageId || ''), sentAt: Date.now() });
  saveSentJournal();
}

function loadPhoneAliasMap() {
  try {
    const parsed = JSON.parse(fs.readFileSync(phoneAliasPath, 'utf8'));
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const map = new Map();
    for (const entry of entries) {
      const alias = digits(entry?.alias);
      const phone = normalizeWhatsAppPhone(entry?.phone);
      if (alias && phone && alias !== phone) map.set(alias, { alias, phone, updatedAt: Number(entry?.updatedAt || Date.now()) });
    }
    return map;
  } catch {
    return new Map();
  }
}

function savePhoneAliasMap() {
  try {
    fs.mkdirSync(sessionPath, { recursive: true });
    const entries = Array.from(phoneAliasMap.values())
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .slice(0, 5000);
    fs.writeFileSync(phoneAliasPath, JSON.stringify({ version: 1, entries }, null, 2), { mode: 0o600 });
    phoneAliasMap.clear();
    for (const entry of entries) phoneAliasMap.set(String(entry.alias), entry);
  } catch (error) {
    console.warn('⚠️ تعذر حفظ ربط معرفات واتساب بالأرقام:', error?.message || error);
  }
}

function rememberPhoneAlias(aliasValue, phoneValue) {
  const alias = digits(aliasValue);
  const phone = normalizeWhatsAppPhone(phoneValue);
  if (!alias || !phone || alias === phone || alias.length < 6) return;
  const existing = phoneAliasMap.get(alias);
  if (existing?.phone === phone) {
    existing.updatedAt = Date.now();
    return;
  }
  phoneAliasMap.set(alias, { alias, phone, updatedAt: Date.now() });
  savePhoneAliasMap();
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function parseBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsAppPhone(value) {
  const clean = digits(value);
  if (clean.length === 8 && /^[569]\d{7}$/.test(clean)) return `965${clean}`;
  return clean;
}

function outboundPhoneCandidates(value) {
  const clean = digits(value);
  const candidates = [];
  const add = (candidate) => {
    const normalized = digits(candidate);
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
  };

  add(clean);
  const last8 = clean.slice(-8);
  if (/^[569]\d{7}$/.test(last8)) {
    add(`965${last8}`);
    add(last8);
  }

  return candidates;
}

function outboundAliasKeys(value) {
  const clean = digits(value);
  const keys = [];
  const add = (candidate) => {
    const normalized = digits(candidate);
    if (normalized && !keys.includes(normalized)) keys.push(normalized);
  };

  add(clean);
  add(normalizeWhatsAppPhone(value));
  const last8 = clean.slice(-8);
  if (/^[569]\d{7}$/.test(last8)) {
    add(last8);
    add(`965${last8}`);
  }
  return keys;
}

async function resolveOutboundPhone(value) {
  for (const key of outboundAliasKeys(value)) {
    const match = phoneAliasMap.get(key);
    if (match?.phone) return match.phone;
  }
  const clean = digits(value);
  const normalized = normalizeWhatsAppPhone(value);
  const looksLikeKuwaitPhone = normalized.length === 11 && normalized.startsWith('965');
  if (clean && !looksLikeKuwaitPhone) {
    const phoneFromLid = await phoneFromLidChatId(`${clean}@lid`);
    if (phoneFromLid) {
      rememberPhoneAlias(clean, phoneFromLid);
      return phoneFromLid;
    }
  }
  return normalized;
}

function maskPhone(value) {
  const clean = normalizeWhatsAppPhone(value);
  if (!clean) return '';
  if (clean.length <= 4) return '***';
  return `${clean.slice(0, 3)}***${clean.slice(-2)}`;
}

function phoneFromChatId(chatId) {
  const raw = String(chatId || '');
  if (!raw.endsWith('@c.us')) return '';
  return normalizeWhatsAppPhone(raw.split('@')[0]);
}

async function phoneFromLidChatId(chatId) {
  const raw = String(chatId || '');
  if (!raw.endsWith('@lid')) return '';
  return client.pupPage.evaluate(async (userId) => {
    const result = await window.WWebJS.enforceLidAndPnRetrieval(userId);
    const phone = result?.phone;
    if (!phone) return '';
    return phone._serialized || (phone.user ? `${phone.user}@c.us` : '');
  }, raw).then(phoneFromChatId).catch(() => '');
}

function safeChatIdKind(chatId) {
  const raw = String(chatId || '');
  const suffix = raw.includes('@') ? raw.split('@').pop() : 'unknown';
  return suffix || 'unknown';
}

function rememberInbound(id) {
  if (!id) return false;
  if (recentInboundIds.has(id)) return true;
  recentInboundIds.set(id, Date.now());
  if (recentInboundIds.size > 3000) {
    const threshold = Date.now() - 6 * 60 * 60 * 1000;
    for (const [key, seenAt] of recentInboundIds) {
      if (seenAt < threshold || recentInboundIds.size > 2500) recentInboundIds.delete(key);
    }
  }
  return false;
}

async function bridgeFetch(route, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        'x-whatsapp-bridge-secret': secret,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendHeartbeat(state = 'online') {
  try {
    const response = await bridgeFetch('/api/whatsapp/bridge/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        // Report what the bridge is really doing, not just that the process exists.
        state: shuttingDown ? 'offline' : needsAuthScan ? 'needs_auth' : ready ? 'online' : 'starting',
        ready,
        needsAuthScan,
        pollFailures,
        lastPollOkAt: lastPollOkAt ? new Date(lastPollOkAt).toISOString() : '',
        // Only while a scan is actually pending, and only while the code is still
        // young — a stale pairing code is worse than none.
        qr: needsAuthScan && pendingQr && Date.now() - pendingQrAt < 90_000 ? pendingQr : '',
        qrArt: needsAuthScan && pendingQrArt && Date.now() - pendingQrAt < 90_000 ? pendingQrArt : '',
        qrAt: pendingQr && needsAuthScan ? new Date(pendingQrAt).toISOString() : '',
        account: accountDigits,
        clientVersion: VERSION,
      }),
      timeoutMs: 12000,
    });
    // The dashboard's restart button rides back on the heartbeat reply. Exit cleanly
    // and let systemd/service-runner start a fresh process.
    const payload = await response.json().catch(() => ({}));
    // A re-link wipes the saved session, so the next start has nothing to resume from
    // and WhatsApp issues a fresh pairing code.
    if (payload?.relinkRequested && !shuttingDown) {
      console.warn('🔑 وصل طلب إعادة ربط من لوحة التحكم — مسح الجلسة وطلب رمز جديد.');
      try {
        const authDir = path.join(sessionPath, `session-${deviceId}`);
        fs.rmSync(authDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('⚠️ تعذر مسح مجلد الجلسة:', error?.message || error);
      }
      setTimeout(() => process.exit(0), 500);
      return;
    }
    if (payload?.restartRequested && !shuttingDown) {
      console.log('🔄 وصل طلب إعادة تشغيل من لوحة التحكم — إعادة تشغيل الجسر الآن.');
      setTimeout(() => process.exit(0), 500);
    }
  } catch (error) {
    if (!shuttingDown) console.warn('⚠️ تعذر إرسال نبضة الاتصال:', error?.message || error);
  }
}

async function postInbound(message) {
  const response = await bridgeFetch('/api/whatsapp/bridge/inbound', {
    method: 'POST',
    body: JSON.stringify(message),
    timeoutMs: 30000,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Inbound ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload;
}

async function getNextOutbound() {
  const response = await bridgeFetch('/api/whatsapp/bridge/outbox/next', {
    method: 'GET',
    timeoutMs: 15000,
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Outbox ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload.message || null;
}

async function ackOutbound(id, result) {
  const response = await bridgeFetch(`/api/whatsapp/bridge/outbox/${encodeURIComponent(id)}/ack`, {
    method: 'POST',
    body: JSON.stringify(result),
    timeoutMs: 15000,
  });
  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(`Ack ${response.status}: ${payload.slice(0, 500)}`);
  }
}

function outboxCreatedTimeMs(item) {
  const raw = item?.createdAt || item?.queuedAt || item?.updatedAt;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isAutoOutboxItem(item) {
  const sentBy = String(item?.sentBy || '').toLowerCase();
  const source = String(item?.source || '').toLowerCase();
  if (sentBy && !['bot', 'auto', 'whatsapp'].includes(sentBy)) return false;
  return !source || source === 'auto_reply' || source === 'whatsapp' || source === 'bot';
}

async function deliverOutbound(item) {
  const to = await resolveOutboundPhone(item?.to);
  const body = String(item?.body || '').trim();
  if (!item?.id || !to || !body) {
    if (item?.id) await ackOutbound(item.id, { ok: false, error: 'invalid_outbox_payload' });
    return;
  }

  const createdMs = outboxCreatedTimeMs(item);
  if (createdMs && isAutoOutboxItem(item) && Date.now() - createdMs > maxAutoOutboxAgeMs) {
    await ackOutbound(item.id, { ok: false, retry: false, error: 'stale_auto_outbox_dropped' });
    console.warn(`⚠️ تم إسقاط رد تلقائي قديم من الطابور إلى ${maskPhone(to)} بدون إرساله.`);
    return;
  }

  const journalEntry = sentOutboxJournal.get(String(item.id));
  if (journalEntry) {
    await ackOutbound(item.id, { ok: true, waMessageId: journalEntry.waMessageId || '' });
    console.log(`✅ تم تثبيت رسالة ${item.id} المرسلة سابقاً من دون تكرارها.`);
    return;
  }

  const candidates = outboundPhoneCandidates(to);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      let chatId = '';
      for (const candidate of candidates) {
        const wid = await client.getNumberId(candidate).catch(() => null);
        const serialized = String(wid?._serialized || (wid?.user ? `${wid.user}@c.us` : '')).trim();
        if (serialized) {
          chatId = serialized;
          break;
        }
      }
      if (!chatId) throw new Error(`الرقم ${maskPhone(to)} غير مسجل في واتساب`);
      const sent = await client.sendMessage(chatId, body, { linkPreview: true });
      const waMessageId = sent?.id?._serialized || sent?.id?.id || '';
      rememberSentOutbox(item.id, waMessageId);
      // Also mark our own sent id as seen, so its fromMe echo is not mistaken for a
      // manual reply that pauses the bot. The text-match backstop on the server races
      // when customers send fast; deduping by message id is reliable.
      if (waMessageId) rememberInbound(waMessageId);
      await ackOutbound(item.id, {
        ok: true,
        waMessageId,
      });
      console.log(`✅ تم إرسال الرد إلى ${maskPhone(to)}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ فشل الإرسال إلى ${maskPhone(to)} — المحاولة ${attempt}/3:`, error?.message || error);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  await ackOutbound(item.id, {
    ok: false,
    retry: Number(item?.attempts || 0) < 4,
    error: String(lastError?.message || lastError || 'send_failed').slice(0, 900),
  });
}

async function pollOutbox() {
  if (!ready || polling || shuttingDown) return;
  polling = true;
  try {
    for (let i = 0; i < 10 && ready && !shuttingDown; i += 1) {
      const item = await getNextOutbound();
      pollFailures = 0;
      lastPollOkAt = Date.now();
      if (!item) break;
      await deliverOutbound(item);
    }
  } catch (error) {
    // Counted, not just logged: repeated failures here mean replies are piling up
    // unsent, which the dashboard must be able to see.
    pollFailures += 1;
    console.warn('⚠️ تعذر قراءة طابور الردود:', error?.message || error);
  } finally {
    polling = false;
  }
}

async function resolveMessageSenderPhone(message) {
  const direct = phoneFromChatId(message?.from);
  const contact = await message.getContact().catch(() => null);
  const contactName = String(contact?.pushname || contact?.name || contact?.shortName || '').trim();
  const contactPhone = normalizeWhatsAppPhone(contact?.number || '');
  let phoneFromLid = '';
  const rawFrom = String(message?.from || '');
  const aliasCandidates = [
    rawFrom,
    message?.id?.remote,
    contact?.id?._serialized,
    contact?.id?.user,
    contact?.number,
  ];
  if (!direct && rawFrom.endsWith('@lid')) {
    phoneFromLid = await phoneFromLidChatId(rawFrom);
  }
  const resolvedPhone = direct || phoneFromLid || contactPhone;
  if (resolvedPhone) {
    for (const candidate of aliasCandidates) rememberPhoneAlias(candidate, resolvedPhone);
  }
  return {
    from: resolvedPhone,
    contactName,
    rawKind: safeChatIdKind(message?.from),
  };
}

async function warmPhoneAliasesFromRecentChats() {
  if (!warmLidAliases) return;
  try {
    const chats = await client.getChats();
    const recentChats = chats
      .filter((chat) => {
        const chatId = String(chat?.id?._serialized || '');
        if (ignoreGroups && chatId.endsWith('@g.us')) return false;
        if (ignoreStatus && chatId === 'status@broadcast') return false;
        return Boolean(chatId);
      })
      .sort((a, b) => Number(b?.lastMessage?.timestamp || 0) - Number(a?.lastMessage?.timestamp || 0))
      .slice(0, 50);

    let warmed = 0;
    for (const chat of recentChats) {
      const chatId = String(chat?.id?._serialized || '');
      const chatPhone = phoneFromChatId(chatId) || await phoneFromLidChatId(chatId);
      if (chatPhone) {
        rememberPhoneAlias(chatId, chatPhone);
        warmed += 1;
      }
      if (chat?.lastMessage) {
        const before = phoneAliasMap.size;
        await resolveMessageSenderPhone(chat.lastMessage).catch(() => null);
        if (phoneAliasMap.size > before) warmed += 1;
      }
    }
    if (warmed) console.log(`✅ تم تحديث ربط معرفات واتساب المحلية لعدد ${warmed} محادثة.`);
  } catch (error) {
    console.warn('⚠️ تعذر تحديث ربط معرفات واتساب المحلية:', error?.message || error);
  }
}

async function handleInboundMessage(message, ingestSource = 'event') {
  if (!ready || shuttingDown) return;

  // A reply typed on this phone (fromMe) used to be dropped here, so the server never
  // knew the owner had answered and the bot kept replying alongside them. Forward it
  // flagged as fromMe; the server records it and pauses the bot. The server also
  // ignores echoes of the bot's own sends by comparing against its last outbound text.
  if (message?.fromMe) {
    // The chat id may be a plain number (@c.us) or WhatsApp's internal @lid alias —
    // the owner's own chats often use @lid, and the first version of this branch
    // silently dropped those, so manual replies never reached the server.
    const rawTo = String(message.to || '');
    let peer = phoneFromChatId(rawTo);
    if (!peer && rawTo.endsWith('@lid')) peer = await phoneFromLidChatId(rawTo).catch(() => '');
    if (!peer || peer === accountDigits) return;
    const echoId = String(message?.id?._serialized || message?.id?.id || '').trim();
    if (rememberInbound(echoId)) return;
    const echoTimeMs = Number(message.timestamp || 0) * 1000;
    if (echoTimeMs && echoTimeMs < startedAt - startupHistoryGraceMs) return;
    const echoText = String(message.body || '').trim();
    if (!echoText) return;
    console.log(`📤 رد يدوي من جهاز المطعم إلى ${maskPhone(peer)} — تسجيل وإيقاف البوت مؤقتًا.`);
    await postInbound({
      from: peer,
      text: echoText,
      type: String(message.type || 'chat'),
      fromMe: true,
      messageId: echoId,
      raw: { timestamp: message.timestamp, type: message.type, ingestSource: `${ingestSource}:fromMe` },
    });
    return;
  }
  if (ignoreStatus && (message.isStatus || message.from === 'status@broadcast')) return;
  if (ignoreGroups && String(message.from || '').endsWith('@g.us')) return;
  if (ignoredInboundTypes.has(String(message.type || '').toLowerCase())) return;

  const { from, contactName, rawKind } = await resolveMessageSenderPhone(message);
  if (!from) {
    console.warn(`⚠️ تم تجاهل رسالة واردة لأن رقم المرسل غير متاح من واتساب Web. source=${ingestSource} idKind=${rawKind}`);
    return;
  }
  if (from === accountDigits) return;

  const messageId = String(message?.id?._serialized || message?.id?.id || '').trim();
  if (rememberInbound(messageId)) return;

  const messageTimeMs = Number(message.timestamp || 0) * 1000;
  if (messageTimeMs && messageTimeMs < startedAt - startupHistoryGraceMs) return;

  const text = String(message.body || '').trim();

  console.log(`📩 رسالة من ${maskPhone(from)} source=${ingestSource} idKind=${rawKind} type=${message.type || 'unknown'} textLength=${text.length}`);
  if (markRead) await message.getChat().then((chat) => chat.sendSeen()).catch(() => {});

  await postInbound({
    from,
    text,
    type: String(message.type || 'unknown'),
    contactName,
    messageId,
    raw: {
      from: message.from,
      timestamp: message.timestamp,
      type: message.type,
      hasMedia: Boolean(message.hasMedia),
      ingestSource,
    },
  });
}

async function pollRecentInboundChats() {
  if (!ready || inboundPolling || shuttingDown) return;
  inboundPolling = true;
  try {
    const chats = await client.getChats();
    const recentChats = chats
      .filter((chat) => {
        const chatId = String(chat?.id?._serialized || '');
        if (!chatId.endsWith('@c.us')) return false;
        if (ignoreGroups && chatId.endsWith('@g.us')) return false;
        return Boolean(chat?.lastMessage);
      })
      .sort((a, b) => Number(b?.lastMessage?.timestamp || 0) - Number(a?.lastMessage?.timestamp || 0))
      .slice(0, 25);

    for (const chat of recentChats) {
      await handleInboundMessage(chat.lastMessage, 'chat_poll');
    }
  } catch (error) {
    console.warn('⚠️ تعذر فحص آخر رسائل واتساب:', error?.message || error);
  } finally {
    inboundPolling = false;
  }
}

// Restarts a process that is alive but not working. On 2026-07-19 the bridge sat
// authenticated-but-never-ready for 25 hours: the process existed, systemd saw nothing
// wrong, and every reply queued unsent. A stuck process should recover on its own
// instead of waiting to be noticed.
const SELF_HEAL_START_TIMEOUT_MS = 5 * 60 * 1000;  // never reached "ready"
const SELF_HEAL_POLL_FAILURES = 20;                // ~queue unreachable for minutes

function watchdogTick() {
  if (shuttingDown) return;
  // A pending QR scan is a human problem; restarting would only rotate the code.
  if (needsAuthScan) return;

  if (!ready && startingSince && Date.now() - startingSince > SELF_HEAL_START_TIMEOUT_MS) {
    console.warn('🔁 لم يكتمل التشغيل خلال 5 دقائق — إعادة تشغيل ذاتية.');
    setTimeout(() => process.exit(0), 500);   // service-runner/systemd starts a fresh one
    return;
  }
  if (pollFailures >= SELF_HEAL_POLL_FAILURES) {
    console.warn(`🔁 تعذّر قراءة الطابور ${pollFailures} مرة — إعادة تشغيل ذاتية.`);
    setTimeout(() => process.exit(0), 500);
  }
}

function startWorkers() {
  clearInterval(pollTimer);
  clearInterval(heartbeatTimer);
  clearInterval(inboundPollTimer);
  clearInterval(watchdogTimer);
  pollTimer = setInterval(() => void pollOutbox(), pollIntervalMs);
  heartbeatTimer = setInterval(() => void sendHeartbeat('online'), 30000);
  watchdogTimer = setInterval(watchdogTick, 30000);
  if (pollRecentChats) inboundPollTimer = setInterval(() => void pollRecentInboundChats(), 5000);
  void pollOutbox();
  if (pollRecentChats) void pollRecentInboundChats();
  void sendHeartbeat('online');
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: deviceId,
    dataPath: sessionPath,
  }),
  takeoverOnConflict: false,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
});

client.on('qr', (qr) => {
  // Surfaces in the dashboard as "needs a QR scan" — the one failure a restart
  // cannot fix, and which previously left the owner guessing.
  needsAuthScan = true;
  // The raw pairing string rides along on the next heartbeat so the console can draw
  // the code. Without it the owner had to reach the cloud VM's log to re-link.
  pendingQr = String(qr || '');
  pendingQrAt = Date.now();
  // Also keep a block-character rendering. The console draws this directly, so the
  // pairing code never has to reach an external QR image service — it stays inside
  // our own infrastructure, which for a WhatsApp session key is the whole point.
  qrcode.generate(pendingQr, { small: true }, (art) => { pendingQrArt = String(art || ''); });
  console.log('\nامسح رمز QR من واتساب > الإعدادات > الأجهزة المرتبطة > ربط جهاز\n');
  qrcode.generate(qr, { small: true }, (qrText) => {
    console.log(qrText);
    openQrInSafari(qrText);
  });
});

client.on('authenticated', () => {
  console.log('🔐 تم توثيق جلسة واتساب وحفظها محلياً.');
});

client.on('auth_failure', (message) => {
  console.error('❌ فشل توثيق واتساب:', message);
});

client.on('ready', async () => {
  ready = true;
  needsAuthScan = false;
  pollFailures = 0;
  lastPollOkAt = Date.now();
  startedAt = Date.now();
  startingSince = 0;   // reached ready: the watchdog's start timer is done
  pendingQr = '';      // linked — the pairing code must not linger anywhere
  pendingQrArt = '';
  pendingQrAt = 0;
  accountDigits = digits(client?.info?.wid?._serialized || client?.info?.wid?.user || '');
  console.log(`\n✅ بوت التراث جاهز. الرقم المرتبط: ${maskPhone(accountDigits) || 'تم الربط'}\n`);
  await warmPhoneAliasesFromRecentChats();
  startWorkers();
});

client.on('message', (message) => {
  void handleInboundMessage(message, 'message').catch((error) => {
    console.error('❌ تعذر تمرير الرسالة إلى برنامج التراث:', error?.message || error);
  });
});

client.on('message_create', (message) => {
  void handleInboundMessage(message, 'message_create').catch((error) => {
    console.error('❌ تعذر تمرير الرسالة إلى برنامج التراث:', error?.message || error);
  });
});

client.on('disconnected', async (reason) => {
  ready = false;
  clearInterval(pollTimer);
  clearInterval(heartbeatTimer);
  clearInterval(inboundPollTimer);
  console.error('⚠️ انقطع اتصال واتساب:', reason);
  await sendHeartbeat('disconnected');
  if (!shuttingDown) {
    console.error('سيُعاد تشغيل الجسر تلقائياً خلال 5 ثوانٍ.');
    setTimeout(() => process.exit(75), 5000);
  }
});

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  clearInterval(pollTimer);
  clearInterval(heartbeatTimer);
  clearInterval(inboundPollTimer);
  console.log(`\nإيقاف آمن (${signal})...`);
  await sendHeartbeat('offline');
  await client.destroy().catch(() => {});
  releaseSingleInstanceLock();
  process.exit(exitCode);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('exit', () => releaseSingleInstanceLock());
process.on('uncaughtException', (error) => {
  console.error('خطأ غير متوقع:', error);
  void shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (error) => {
  console.error('Promise غير معالج:', error);
  void shutdown('unhandledRejection', 1);
});

console.log('تشغيل جسر واتساب التراث المعزول...');
console.log(`السيرفر: ${baseUrl}`);
console.log(`مجلد الجلسة: ${sessionPath}`);
acquireSingleInstanceLock();
startingSince = Date.now();   // watchdog starts counting toward "never became ready"
await client.initialize();
