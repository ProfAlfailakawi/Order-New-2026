# SECURITY-TODO — إصلاحات مؤجّلة تحتاج موافقة المالك

> هذه الجولة كانت **تنظيفاً آمناً فقط**. لم يُلمَس أي منطق دفع أو قواعد أو مصادقة أو ويبهوك.
> البنود التالية لم تُطبَّق عمداً لأنها قد تكسر التشغيل الحيّ، وتحتاج قراراً منفصلاً من المالك.

## 1. تنظيف تاريخ git للبيانات الشخصية (PII) — مطلوب بموافقة المالك
حُذفت من شجرة العمل عشرات السكربتات السائبة التي كانت تحوي **بيانات حقيقية**:
أرقام هواتف كويتية (أمثلة وردت داخلها: `***REDACTED***`, `***REDACTED***`, `***REDACTED***`)،
ومعرّفات طلبات وأسماء عملاء (مثل `fix_ahmad.ts` الذي حوى اسم عميل وتعديلاً على حالة الدفع).

- الحذف من الشجرة **لا يكفي**: البيانات ما زالت موجودة في تاريخ git (commits سابقة).
- التنظيف الكامل يتطلّب إعادة كتابة التاريخ (`git filter-repo` / BFG) ثم force-push منسّق،
  وهو إجراء مدمّر يحتاج **موافقة صريحة من المالك** وتنسيق مع كل من لديه نسخة من المستودع.
- لم يُنفَّذ في هذه الجولة (القاعدة: لا إعادة كتابة تاريخ بدون موافقة).

عائلات الملفات المحذوفة (شجرة العمل فقط): `check-*`, `check_*`, `fix_*`, `fix-*`,
`find_*`, `find-*`, `dump_*`, `fetch_*`, `revert_*`, `create-order.ts`, `list-orders-details.ts`,
`replace*.ts`, `ping.js`, بالإضافة إلى ملفات مؤقتة (`temp.txt`, `temp_open`, `temp_close`, `temp_use.txt`).

**ملف يستحق مراجعة لاحقة (لم يُحذف — خارج نطاق هذه الجولة):** `output.json` في الجذر قد يكون
مخرجاً مؤقتاً لبيانات؛ يُراجَع يدوياً وإن حوى PII يُحذف بموافقة المالك. كذلك مجلد `scripts/`
يحوي `check-invoice.ts` و`fixCustomerPoints2.ts` (سكربتات فحص/ترقيع) قد تحوي بيانات — تُركت
لأنها خارج نطاق «الجذر» المحدّد، وتستحق نظرة منفصلة.

## 2. بنود تُركت مفتوحة عمداً بطلب المالك — تحتاج مراجعة أمنية منفصلة
لم يُطبَّق أي إصلاح على ما يلي لأن المالك طلب صراحةً عدم المساس بالتشغيل الحيّ:

- **`firestore.rules` مفتوحة عمداً** (قراءة/كتابة بلا قيود فعلية). تحتاج تصميم قواعد وصول
  لاحقاً، لكن أي تشديد قد يكسر مسار الطلبات/الدفع الحالي، فيلزم اختبار كامل قبل التطبيق.
- **مسار `/api/payment-return`** ومنطق العودة من بوابة الدفع: لم يُلمَس.
- **الويبهوك** (webhook استلام إشعارات الدفع): لم يُلمَس.
- **لوحة `/admin` بلا مصادقة**: الوصول للوحة الإدارة غير محمي بتسجيل دخول. تُركت كما هي
  بطلب المالك؛ تحتاج إضافة طبقة مصادقة/تفويض في مراجعة منفصلة.
- **`server.ts`** (منطق الطلبات والدفع الكامل): لم يُلمَس إطلاقاً.

> توصية: يُعالَج كل بند أعلاه في فرع مستقل مع بيئة اختبار (staging) وبموافقة المالك،
> وليس ضمن جولة تنظيف.

---

## جولة تدقيق أمني (Security Audit) — 2026-09-17

### إصلاحات مُطبَّقة (Fixed — safe, surgical, backwards-compatible)

1. **Missing security headers** — `server.ts:1504` — *Severity: Medium*
   أضيف middleware عام يضبط رؤوس أمان أساسية على كل الاستجابات:
   `X-Content-Type-Options: nosniff` (منع MIME sniffing)،
   `X-Frame-Options: SAMEORIGIN` (منع clickjacking مع إبقاء تأطير نفس المصدر)،
   `Referrer-Policy: strict-origin-when-cross-origin`،
   `X-Permitted-Cross-Domain-Policies: none`.
   لم تُضَف CSP تجنباً لكسر السكربتات المضمّنة ومسار تحويل بوابة الدفع.

2. **Missing rate limiting on OTP-style secret (squad temp-code brute force)** —
   `server.ts:1523` (تعريف `tempCodeLimiter`) + `server.ts:2926` (تطبيقه على
   `POST /api/squad-join-temp-code`) — *Severity: Medium*
   كود انضمام الديوانية من 4 أرقام (1000–9999) كان قابلاً للتخمين بالقوة الغاشمة
   بلا أي حد. أضيف حدّ لكل IP (30 محاولة / 10 دقائق) اعتماداً على `express-rate-limit`
   الموجود مسبقاً — إضافة فقط، لا تكسر الاستخدام الشرعي.

3. **Information disclosure via global error handler** — `server.ts:5919` —
   *Severity: Low*
   معالج الأخطاء العام كان يُرجع `details: err.message` للعميل دائماً (قد يكشف
   تفاصيل داخلية). أصبح يُرجع `details` فقط خارج بيئة الإنتاج
   (`NODE_ENV !== 'production'`)؛ في الإنتاج يعود فقط `{ error: "Internal Server Error" }`.

> التحقق: `npm run lint` (tsc --noEmit) = 0 أخطاء، و`npm test` = 25/25 ناجحة.

### تم التحقق منها ووُجدت سليمة (لا تغيير)
- **حماية `/api/admin/*`**: `app.use("/api/admin", adminRateLimit, adminAuthOnly)` مُسجَّل
  (server.ts ~1531) **قبل** كل مسارات `/api/admin/*` (2018+، 5501+) → محمية فعلاً. لا bypass.
- نقاط `/api/appdata`, `/api/debug*`, `/api/debug/order/:id`, `/api/create-test-split-order`
  تضيف `adminAuthOnly` صراحةً → محمية.
- لا وجود لـ `dangerouslySetInnerHTML`/`innerHTML` مع بيانات مستخدم في `src/`.
- `/split/:id` يُنقّى فيه `id` قبل الإدراج في HTML، و`total` رقمي → لا XSS.
- لا CORS wildcard+credentials (لا يوجد إعداد CORS أصلاً).
- استدعاءات axios/fetch الخارجية كلها ثابتة الوجهة (دفع/إشعارات) → لا SSRF.
- قراءات الملفات بمسارات ثابتة → لا path traversal.

### بنود تُركت عمداً (تحتاج قرار المالك)
- **منطق الدفع** (webhooks، توقيع، `/api/create-payment`, `/api/create-split-payment`,
  `/api/validate-promo`، KNET/UPayments) — لم يُلمَس (تعليمات المالك).
- **الإشعارات/Push** (`/api/diwaniya-push/*`، FCM، service worker) — لم يُلمَس.
- **قواعد Firestore لـ orders/invoices/pushTokens** و`appData/*` المفتوحة — لم تُلمَس.
- **IDOR على lookup بالهاتف** (`/api/customers`, `/api/search-order/:phone`): مصمّمة
  على أساس الهاتف كمُعرِّف لتطبيق طلب بلا تسجيل دخول. تخفيفها يتطلب طبقة مصادقة/OTP
  للعميل — قرار منفصل مع اختبار كامل.
- **رؤوس أقوى (CSP، HSTS)**: تحتاج اختباراً مع مسار الدفع وملفات vite قبل التطبيق.
