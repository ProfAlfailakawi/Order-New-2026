/**
 * AI order service — product logic for the three in-product AI features:
 *   1. "اطلب لي"  → Function-Calling cart builder over the REAL menu.
 *   2. Order Support → answers grounded ONLY on the customer's real order state.
 *   3. Smart upsell → at most one non-intrusive complement, from the real menu.
 *
 * Design rules enforced here:
 *   - The model proposes productIds + quantities; PRICES ARE ALWAYS RECOMPUTED
 *     server-side from the catalog. The model's numbers are never trusted.
 *   - Every proposed id is validated against the catalog; unknown ids are dropped.
 *   - Nothing here mutates the cart or the order. "اطلب لي" returns a SUGGESTION
 *     that the client must confirm before it touches the basket or payment.
 */

import {
  Type,
  generateStructured,
  runFunctionLoop,
  type ToolDeclaration,
} from "./aiGateway.ts";

export interface CatalogItem {
  id: string;
  name: string;
  nameEn?: string;
  category?: string;
  price: number;
  description?: string;
}

/** Normalise raw processed products into a compact, model-friendly catalog. */
export function toCatalog(products: any[]): CatalogItem[] {
  return (products || [])
    .map((p: any) => ({
      id: String(p.id || p.productId || ""),
      name: String(p.name || p.productName || p.nameAr || ""),
      nameEn: p.nameEn || undefined,
      category: p.category || undefined,
      price: Number(p.price) || 0,
      description: String(p.preparationInstructions || p.description || "").slice(0, 160),
    }))
    .filter((p) => p.id && p.name);
}

const norm = (v: any) =>
  String(v || "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/[ؤئ]/g, "و")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .trim();

// ============================================================================
// 1. "اطلب لي" — Function-Calling cart builder
// ============================================================================

export interface OrderForMeInput {
  clientIp?: string;
  catalog: CatalogItem[];
  query?: string;
  partySize?: number;
  budget?: number; // in KWD; 0/undefined = no budget constraint
  preferences?: string;
}

export interface CartSuggestionLine {
  productId: string;
  name: string;
  category?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  reason?: string;
}

export interface OrderForMeResult {
  items: CartSuggestionLine[];
  subtotal: number;
  currency: "KWD";
  message: string;
  assumptions: string[];
  withinBudget: boolean;
  needsConfirmation: true;
}

const ORDER_FOR_ME_TOOLS: ToolDeclaration[] = [
  {
    name: "search_menu",
    description:
      "ابحث في المنيو الحقيقي بكلمة مفتاحية و/أو تصنيف. يُرجع منتجات مطابقة (id, name, category, price). استخدمه لاكتشاف الخيارات المناسبة قبل بناء السلة.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING, description: "كلمة بحث بالعربي مثل مجبوس، شوربة، تحلية" },
        category: { type: Type.STRING, description: "تصنيف اختياري لتضييق النتائج" },
        maxResults: { type: Type.NUMBER, description: "أقصى عدد نتائج (افتراضي 12)" },
      },
    },
  },
  {
    name: "list_categories",
    description: "يُرجع قائمة التصنيفات المتاحة في المنيو مع عدد المنتجات في كل تصنيف.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

const CART_LINE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          reason: { type: Type.STRING, description: "سبب مختصر لاختيار هذا الصنف" },
        },
        required: ["productId", "quantity"],
      },
    },
    message: { type: Type.STRING, description: "رسالة كويتية دافئة تشرح الاقتراح باختصار" },
    assumptions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "الافتراضات التي بُني عليها الاقتراح (عدد الأشخاص، الميزانية، التفضيلات)",
    },
  },
  required: ["items", "message"],
};

function buildOrderForMeSystemInstruction(input: OrderForMeInput): string {
  return `أنت "مضيف" ذكي في مطبخ التراث الكويتي. مهمتك بناء اقتراح سلة طلب دقيق ومناسب، أسرع من الطلب اليدوي.

مبادئ صارمة:
- استخدم أدوات البحث (search_menu / list_categories) لاكتشاف المنتجات الحقيقية فقط. لا تخترع أصنافاً أو معرفات غير موجودة.
- راعِ عدد الأشخاص: قدّر كميات معقولة تكفي المجموعة دون إسراف (مثلاً طبق رئيسي لكل ١-٢ شخص + مقبلات/شوربة مشتركة + تحلية للمجموعة).
- التزم بالميزانية إن وُجدت: مجموع السلة يجب ألا يتجاوزها. إن تعذّر، اقترب منها قدر الإمكان واذكر ذلك في الافتراضات.
- راعِ التفضيلات والقيود (نباتي، بدون عيش، دايت، حار، إلخ) بدقة.
- اجعل الاقتراح متوازناً وواقعياً كأنه من مضيف كويتي كريم، لا قائمة عشوائية.
- في النهاية أرجع فقط productId + الكمية لكل صنف؛ الأسعار تُحسب عندنا.

سياق الطلب:
- عدد الأشخاص: ${input.partySize || "غير محدد"}
- الميزانية: ${input.budget ? input.budget + " د.ك" : "غير محددة"}
- التفضيلات: ${input.preferences || "لا يوجد"}
- طلب العميل النصّي: ${input.query || "لا يوجد"}`;
}

function makeMenuHandler(catalog: CatalogItem[]) {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return async (name: string, args: any) => {
    if (name === "list_categories") {
      const counts = new Map<string, number>();
      catalog.forEach((c) => {
        const k = c.category || "غير مصنّف";
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
    }
    if (name === "search_menu") {
      const kw = norm(args?.keyword);
      const cat = norm(args?.category);
      const max = Math.min(Number(args?.maxResults) || 12, 25);
      const matches = catalog.filter((c) => {
        const hay = `${norm(c.name)} ${norm(c.nameEn)} ${norm(c.category)} ${norm(c.description)}`;
        const kwOk = !kw || hay.includes(kw);
        const catOk = !cat || norm(c.category).includes(cat);
        return kwOk && catOk;
      });
      return matches.slice(0, max).map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        price: c.price,
      }));
    }
    return { error: `unknown tool ${name}` };
  };
}

/** Recompute prices server-side, validate ids, enforce budget-awareness flag. */
export function assembleSuggestion(
  raw: { items?: Array<{ productId: string; quantity: number; reason?: string }>; message?: string; assumptions?: string[] },
  catalog: CatalogItem[],
  budget?: number,
): OrderForMeResult {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const lines: CartSuggestionLine[] = [];
  for (const it of raw.items || []) {
    const p = byId.get(String(it.productId));
    if (!p) continue; // drop hallucinated / stale ids
    const quantity = Math.max(1, Math.min(Number(it.quantity) || 1, 30));
    const unitPrice = p.price;
    lines.push({
      productId: p.id,
      name: p.name,
      category: p.category,
      quantity,
      unitPrice,
      lineTotal: Number((unitPrice * quantity).toFixed(3)),
      reason: it.reason ? String(it.reason).slice(0, 140) : undefined,
    });
  }
  const subtotal = Number(lines.reduce((s, l) => s + l.lineTotal, 0).toFixed(3));
  return {
    items: lines,
    subtotal,
    currency: "KWD",
    message: String(raw.message || "جهّزت لك اقتراح مناسب، شوفه وعدّله زي ما تحب.").slice(0, 600),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.slice(0, 6).map((s) => String(s)) : [],
    withinBudget: !budget || subtotal <= budget + 1e-6,
    needsConfirmation: true,
  };
}

export async function suggestOrderForMe(input: OrderForMeInput): Promise<OrderForMeResult> {
  const userMessage =
    `ابنِ اقتراح سلة مناسب. عدد الأشخاص: ${input.partySize || "غير محدد"}. ` +
    `الميزانية: ${input.budget ? input.budget + " د.ك" : "غير محددة"}. ` +
    `التفضيلات: ${input.preferences || "لا يوجد"}. الطلب: ${input.query || "اقترح لي وجبة متكاملة"}.`;

  const { result } = await runFunctionLoop<{
    items?: Array<{ productId: string; quantity: number; reason?: string }>;
    message?: string;
    assumptions?: string[];
  }>({
    clientIp: input.clientIp,
    systemInstruction: buildOrderForMeSystemInstruction(input),
    userMessage,
    tools: ORDER_FOR_ME_TOOLS,
    handler: makeMenuHandler(input.catalog),
    finalSchema: CART_LINE_SCHEMA,
    maxOutputTokens: 1536,
  });

  return assembleSuggestion(result, input.catalog, input.budget);
}

// ============================================================================
// 2. Order Support — grounded on the real order state
// ============================================================================

export interface OrderSupportInput {
  clientIp?: string;
  question: string;
  orders: any[]; // the customer's real orders (already fetched & filtered)
}

export interface OrderSupportResult {
  answer: string;
  grounded: boolean;
  referencedOrderId?: string;
}

/** Compact an order down to only the fields the model may reference. */
function summariseOrder(o: any) {
  return {
    id: o?.id,
    orderNumber: o?.orderNumber || o?.invoiceNo || o?.id,
    status: o?.status || "غير معروف",
    paymentStatus: o?.paymentStatus,
    total: Number(o?.total || o?.totalAmount || 0),
    createdAt: o?.createdAt || o?.date,
    deliveryType: o?.deliveryType,
    items: Array.isArray(o?.items)
      ? o.items.map((i: any) => ({ name: i?.name || i?.productName, quantity: i?.quantity }))
      : [],
  };
}

const ORDER_SUPPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    grounded: {
      type: Type.BOOLEAN,
      description: "true إذا كانت الإجابة مبنية على بيانات الطلب المتاحة فقط",
    },
    referencedOrderId: { type: Type.STRING },
  },
  required: ["answer", "grounded"],
};

export async function answerOrderSupport(input: OrderSupportInput): Promise<OrderSupportResult> {
  const orders = (input.orders || []).slice(0, 5).map(summariseOrder);

  if (!orders.length) {
    return {
      answer:
        "ما لقيت أي طلب مرتبط بهالرقم. تأكد من رقم الهاتف أو رقم الطلب وحاول مرة ثانية، وإذا احتجت مساعدة تواصل معنا.",
      grounded: true,
    };
  }

  const systemInstruction = `أنت مساعد دعم طلبات في مطبخ التراث الكويتي. أجب بلهجة كويتية ودودة ومختصرة.

قواعد صارمة:
- استند فقط إلى بيانات الطلبات المرفقة أدناه. لا تخترع حالة أو وقت توصيل أو تفاصيل غير موجودة.
- إذا كان السؤال يحتاج معلومة غير موجودة في البيانات، قل بصراحة إنها غير متوفرة واطلب التواصل مع خدمة العملاء، واجعل grounded=false.
- ترجم حالة الطلب للعميل بوضوح (مثلاً: "جديد" = استلمنا طلبك، "قيد التوصيل"، "تم الدفع بنجاح"...).
- لا تعد بمواعيد قاطعة غير موجودة في البيانات.

بيانات طلبات العميل (JSON):
${JSON.stringify(orders, null, 2)}`;

  const result = await generateStructured<OrderSupportResult>({
    clientIp: input.clientIp,
    systemInstruction,
    contents: `سؤال العميل: "${input.question}"`,
    schema: ORDER_SUPPORT_SCHEMA,
    maxOutputTokens: 512,
    temperature: 0.3,
  });

  return {
    answer: String(result?.answer || "").slice(0, 700) || "تعذّر توليد الرد، حاول مرة ثانية.",
    grounded: result?.grounded !== false,
    referencedOrderId: result?.referencedOrderId,
  };
}

// ============================================================================
// 3. Smart upsell — at most one non-intrusive complement
// ============================================================================

export interface UpsellInput {
  clientIp?: string;
  catalog: CatalogItem[];
  cartProductIds: string[];
  cartCategories: string[];
  subtotal: number;
}

export interface UpsellResult {
  suggestion:
    | { productId: string; name: string; price: number; reason: string }
    | null;
}

const UPSELL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    productId: { type: Type.STRING, description: "معرف المنتج المقترح، أو فارغ إذا لا يوجد اقتراح مناسب" },
    reason: { type: Type.STRING, description: "سبب قصير جداً وغير ملحّ" },
  },
};

/**
 * Rule prefilter → AI rank. Only complements NOT already in the cart are
 * considered, so the suggestion is always additive and relevant.
 */
export async function suggestUpsell(input: UpsellInput): Promise<UpsellResult> {
  const inCart = new Set(input.cartProductIds.map(String));
  const cartCats = new Set(input.cartCategories.map((c) => norm(c)));

  // Prefer complementary categories (dessert/drink/appetizer) not yet in cart.
  const complementHints = ["تحلي", "حلو", "مشروب", "عصير", "شور", "مقبل", "سلط"];
  const candidates = input.catalog.filter((c) => {
    if (inCart.has(c.id)) return false;
    const cat = norm(c.category);
    const looksComplement = complementHints.some((h) => cat.includes(h) || norm(c.name).includes(h));
    const sameCat = cartCats.has(cat);
    return looksComplement || !sameCat;
  });

  if (!candidates.length) return { suggestion: null };

  // Cap what we send to the model to keep it cheap.
  const shortlist = candidates.slice(0, 30).map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    price: c.price,
  }));

  const systemInstruction = `أنت مساعد اقتراح لطيف وغير ملحّ في مطبخ كويتي. اقترح صنفاً واحداً فقط يكمّل سلة العميل (مثل تحلية أو مشروب أو شوربة) إذا كان مناسباً فعلاً. إذا ما فيه اقتراح مناسب، أرجع productId فارغ. لا تكرر أصناف موجودة بالسلة. اجعل السبب قصيراً ودّياً بلهجة كويتية.`;

  const contents = `أصناف السلة الحالية (تصنيفات): ${input.cartCategories.join(", ") || "لا يوجد"}.
مجموع السلة: ${input.subtotal} د.ك.
أصناف مقترحة متاحة (JSON): ${JSON.stringify(shortlist)}`;

  const raw = await generateStructured<{ productId?: string; reason?: string }>({
    clientIp: input.clientIp,
    systemInstruction,
    contents,
    schema: UPSELL_SCHEMA,
    maxOutputTokens: 200,
    temperature: 0.5,
  });

  const picked = input.catalog.find((c) => c.id === String(raw?.productId || ""));
  if (!picked || inCart.has(picked.id)) return { suggestion: null };

  return {
    suggestion: {
      productId: picked.id,
      name: picked.name,
      price: picked.price,
      reason: String(raw?.reason || "يكمّل طلبك زين").slice(0, 120),
    },
  };
}
