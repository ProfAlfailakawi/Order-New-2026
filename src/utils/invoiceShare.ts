import { formatKuwaitiDate } from '../utils';
// Keep icons as tokens until after encodeURIComponent. This prevents broken
// environments from converting emojis into replacement characters (�) before
// WhatsApp receives them.
const TOKENS = {
  sparkles: '__ALTURATH_SPARKLES_ICON__',
  check: '__ALTURATH_CHECK_ICON__',
  warning: '__ALTURATH_WARNING_ICON__',
  mail: '__ALTURATH_MAIL_ICON__',
};

const ENCODED_ICONS: Record<string, string> = {
  [TOKENS.sparkles]: '%E2%9C%A8', // ✨
  [TOKENS.check]: '%E2%9C%85', // ✅
  [TOKENS.warning]: '%E2%9A%A0%EF%B8%8F', // ⚠️
  [TOKENS.mail]: '%E2%9C%89%EF%B8%8F', // ✉️
};

const DISPLAY_ICONS = {
  sparkles: '\u2728',
  check: '\u2705',
  warning: '\u26A0\uFE0F',
  mail: '\u2709\uFE0F',
};

const toEnglishDigits = (value: any) => String(value ?? '')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

const clean = (value: any) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const formatKwd = (value: any) => `${toEnglishDigits(Number(value || 0).toFixed(3))} د.ك`;

const getOrderAddress = (order: any) => {
  const address = order?.address || {};
  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed) return '';
    try { return getOrderAddress({ address: JSON.parse(trimmed) }); } catch { return trimmed; }
  }
  if (typeof address === 'object') {
    return [
      clean(address.region || address.area || address.governorate),
      clean(address.block) ? `قطعة ${address.block}` : '',
      clean(address.street) ? `شارع ${address.street}` : '',
      clean(address.jaddah) ? `جادة ${address.jaddah}` : '',
      clean(address.building || address.house) ? `منزل ${clean(address.building || address.house)}` : '',
      clean(address.floor) ? `دور ${address.floor}` : '',
      clean(address.apartment) ? `شقة ${address.apartment}` : '',
    ].filter(Boolean).join(' - ');
  }
  return '';
};

const normalizeOrderAddons = (item: any) => {
  const raw = item?.addons || item?.selectedAddons || item?.addOns || item?.extras || [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === 'object') return Object.values(raw).filter(Boolean);
  return [];
};

const getAddonQty = (addon: any, itemQty: number) => {
  const explicitQty = addon?.quantity ?? addon?.qty ?? addon?.count;
  if (explicitQty !== undefined && explicitQty !== null && explicitQty !== '') return Math.max(0, Number(explicitQty || 0));
  return 1;
};

const getAddonTotal = (addon: any, itemQty: number) => {
  const qty = getAddonQty(addon, itemQty);
  if (qty <= 0 || addon?.selected === false || addon?.isSelected === false || addon?.enabled === false) return 0;
  return Number((addon?.total ?? addon?.amount ?? addon?.totalPrice ?? (Number(addon?.price || 0) * qty)) || 0);
};

const getInvoiceStatus = (order: any) => order?.paymentStatus || order?.status || 'paid';

const getOrderTotal = (order: any, fallback: number) => Number(order?.totalAmount ?? order?.total ?? fallback);

const encodeWhatsAppTextWithIcons = (text: string) => {
  let encoded = encodeURIComponent(text);
  Object.entries(ENCODED_ICONS).forEach(([token, encodedIcon]) => {
    encoded = encoded.split(encodeURIComponent(token)).join(encodedIcon);
  });
  return encoded;
};

export const buildWhatsAppInvoiceText = (order: any, products: any[] = []) => {
  const items = order?.items || [];
  let calculatedTotal = 0;
  items.forEach((it: any) => {
    const p = products.find((x: any) => x.id === it.productId) || it.product || {};
    const qty = Number(it.quantity || it.qty || 1);
    const unit = Number(it.priceAtTime ?? it.price ?? p.price ?? 0);
    calculatedTotal += unit * qty;
    normalizeOrderAddons(it).forEach((a: any) => {
      calculatedTotal += getAddonTotal(a, qty);
    });
  });
  calculatedTotal += Number(order?.deliveryFee || 0);
  calculatedTotal -= Number(order?.discountAmount || order?.discount || 0);

  const invoiceNumber = order?.invoiceId || order?.id || '-';
  const customerName = order?.customerName || order?.name || 'عميلنا العزيز';
  const total = getOrderTotal(order, calculatedTotal);
  const trackingUrl = `https://alturathkw.shop/track?tracked_order=${encodeURIComponent(String(invoiceNumber))}`;

  return [
    `${DISPLAY_ICONS.sparkles} فاتورة طلبكم من مطبخ التراث الكويتي`,
    '',
    `مرحباً ${customerName}،`,
    `تم تجهيز فاتورتكم للطلب رقم: ${invoiceNumber}`,
    '',
    `الإجمالي المستحق: ${formatKwd(total)}`,
    '',
    'لتتبع الطلب:',
    trackingUrl,
    '',
    'شكراً لثقتكم',
    'Alturath.kw',
  ].join('\n');
};

const buildDisplayWhatsAppText = (order: any, products: any[] = []) => buildWhatsAppInvoiceText(order, products);

export const buildWhatsAppPaymentLinkText = (order: any, paymentUrl: string) => {
  const items = order?.items || [];
  let calculatedTotal = 0;
  items.forEach((it: any) => {
    const qty = Number(it.quantity || it.qty || 1);
    const unit = Number(it.priceAtTime ?? it.price ?? 0);
    calculatedTotal += unit * qty;
    normalizeOrderAddons(it).forEach((a: any) => {
      calculatedTotal += getAddonTotal(a, qty);
    });
  });
  calculatedTotal += Number(order?.deliveryFee || 0);
  calculatedTotal -= Number(order?.discountAmount || order?.discount || 0);

  const invoiceNumber = order?.invoiceId || order?.id || '-';
  const customerName = order?.customerName || order?.name || 'عميلنا العزيز';
  const total = getOrderTotal(order, calculatedTotal);
  const trackingUrl = `https://alturathkw.shop/track?tracked_order=${encodeURIComponent(String(invoiceNumber))}`;

  return [
    `${DISPLAY_ICONS.sparkles} فاتورة طلبكم من مطبخ التراث الكويتي`,
    '',
    `مرحباً ${customerName}،`,
    `تم تجهيز فاتورتكم للطلب رقم: ${invoiceNumber}`,
    '',
    `الإجمالي المستحق: ${formatKwd(total)}`,
    '',
    'لتتبع الطلب:',
    trackingUrl,
    '',
    `${DISPLAY_ICONS.check} رابط الدفع:`,
    paymentUrl,
    '',
    'شكراً لثقتكم',
    'Alturath.kw',
  ].join('\n');
};

export const openWhatsAppInvoiceText = (order: any, products: any[] = []) => {
  const phone = order?.customerPhone || order?.phone || '';
  const text = encodeWhatsAppTextWithIcons(buildWhatsAppInvoiceText(order, products));
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 8) digits = `965${digits}`;
  window.open(`https://api.whatsapp.com/send?phone=${digits}&text=${text}`, '_blank');
};

const buildInvoiceHTML = (order: any, products: any[] = []) => {
  const invoiceDate = order?.date || order?.createdAt || order?.completedAt || new Date().toISOString();
  const status = getInvoiceStatus(order);
  const normalizedStatus = String(status || '').toLowerCase();
  const statusClass = normalizedStatus.includes('pending') || String(status).includes('انتظار') ? 'pending-status' : normalizedStatus.includes('paid') || String(status).includes('مدفوع') || String(status).includes('مدفوعة') || String(status).includes('تم الدفع') ? 'paid-status' : 'other-status';
  const customerName = clean(order?.customerName || order?.name) || 'عميل';
  const customerPhone = clean(order?.customerPhone || order?.phone);
  const address = getOrderAddress(order) || 'غير محدد';

  let productsSubtotal = 0;
  let addonsSubtotal = 0;

  const itemsHtml = ((order as any).items || []).map((item: any, index: number) => {
    const product = products.find(p => p.id === item.productId) || item.product || {};
    const name = clean(item.name || item.productName || product.name) || 'منتج غير معروف';
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.priceAtTime ?? item.price ?? product.price ?? 0);
    const productTotal = unitPrice * qty;
    productsSubtotal += productTotal;

    const addons = normalizeOrderAddons(item);
    const addonsHtml = addons.map((addon: any) => {
      const addonName = clean(addon?.name || addon?.title || addon?.label);
      const addonQty = getAddonQty(addon, qty);
      const addonTotal = getAddonTotal(addon, qty);
      if (!addonName || addonQty <= 0) return '';
      addonsSubtotal += addonTotal;
      return `
        <div class="addon-line">
          <span><b>•</b> ${addonName}${addonQty > 1 ? ` × ${addonQty}` : ''}</span>
          <span class="addon-price">${formatKwd(addonTotal)}</span>
        </div>`;
    }).filter(Boolean).join('');

    return `
      <tr class="item-row">
        <td class="product-cell">
          <div class="product-name"><span class="item-number">${index + 1}.</span> ${name}</div>
          ${addonsHtml ? `<div class="addons-wrap">${addonsHtml}</div>` : ''}
          ${item.itemNotes || item.note ? `<div class="item-note">${item.itemNotes || item.note}</div>` : ''}
        </td>
        <td class="center">${toEnglishDigits(qty)}</td>
        <td class="money">${formatKwd(unitPrice)}</td>
        <td class="money strong">${formatKwd(productTotal)}</td>
      </tr>`;
  }).join('');

  const deliveryFee = Number((order as any).deliveryFee || 0);
  const discount = Number((order as any).discountAmount || (order as any).discount || 0);
  const grandTotal = Math.max(0, getOrderTotal(order, productsSubtotal + addonsSubtotal + deliveryFee - discount));

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>فاتورة ${(order as any).invoiceId || (order as any).id || ''}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page{size:A4;margin:10mm}
    :root{--green:#0f4f2d;--green2:#0b3f25;--red:#d7192f;--gold:#d7a94f;--soft:#fbfaf6;--line:#eadfcd;--text:#172033;--muted:#6b7280;}
    *{box-sizing:border-box} body{margin:0;padding:28px;background:#f3f4f6;font-family:'Cairo',Arial,sans-serif;color:var(--text);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .page{max-width:900px;margin:auto;background:#fff;border:1px solid #eee1cc;border-radius:22px;padding:34px 38px 28px;box-shadow:0 18px 50px rgba(15,79,45,.10);position:relative;overflow:hidden;}
    .page:before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:linear-gradient(90deg,var(--red),var(--green),var(--gold));opacity:.8}
    .header{display:grid;grid-template-columns:130px 1fr 190px;align-items:center;gap:22px;padding-bottom:22px;border-bottom:1px solid var(--line);}
    .logo{width:116px;height:116px;object-fit:contain;justify-self:center;}
    .brand{text-align:center}.brand h1{margin:0;color:var(--green);font-size:38px;line-height:1.1;font-weight:900;letter-spacing:-1px}.tagline{margin-top:8px;color:#b88a31;font-weight:700;font-size:15px}.contacts{margin-top:16px;display:flex;justify-content:center;gap:18px;direction:ltr;color:#263143;font-weight:700}.contacts span{display:flex;align-items:center;gap:6px}.badge{background:linear-gradient(145deg,var(--green),var(--green2));color:#fff;border:2px solid var(--gold);border-radius:18px;padding:18px 14px;text-align:center;box-shadow:0 8px 22px rgba(15,79,45,.18)}.badge .title{font-size:30px;font-weight:900}.badge .sub{font-size:13px;color:#f4d986;font-weight:800;margin-top:5px}
    .pattern{height:18px;margin:14px -38px 24px;background:repeating-linear-gradient(45deg,rgba(215,169,79,.26) 0 8px,transparent 8px 17px),linear-gradient(90deg,rgba(215,25,47,.05),rgba(15,79,45,.05));border-block:1px solid rgba(215,169,79,.25)}
    .cards{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:22px}.card{border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(15,79,45,.05);padding:22px}.card h2{margin:0 0 16px;color:var(--green);font-size:22px;font-weight:900;display:flex;align-items:center;gap:9px}.card h2 .icon{color:var(--red);font-size:22px}.row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #eee7dc}.row:last-child{border-bottom:0}.label{color:#555;font-weight:700}.value{font-weight:800;text-align:left;direction:rtl}.status{font-weight:900}.paid-status{color:var(--green)}.pending-status{color:#b45309;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:2px 10px}.other-status{color:#475569}
    .table-wrap{border:1px solid var(--line);border-radius:18px;overflow:hidden;margin-top:8px;background:#fff}table{width:100%;border-collapse:collapse}.head th{background:linear-gradient(180deg,var(--green),#0b4327);color:#f7d880;font-size:15px;padding:15px 12px;text-align:center;font-weight:900}.head th:first-child{text-align:right}.item-row td{padding:20px 14px;border-bottom:1px dashed #dccfbc;vertical-align:top}.item-row:last-child td{border-bottom:0}.product-cell{width:45%}.product-name{font-size:22px;font-weight:900;color:#111827}.item-number{color:var(--red);margin-left:6px}.addons-wrap{margin-top:10px;display:grid;gap:5px}.addon-line{display:flex;justify-content:space-between;gap:12px;color:#343b48;font-weight:700;font-size:14px}.addon-line b{color:var(--red);font-size:18px;line-height:0}.addon-price{color:#a17622;white-space:nowrap}.center{text-align:center;font-size:20px;font-weight:800}.money{text-align:center;font-weight:800;direction:ltr;white-space:nowrap}.strong{color:var(--green);font-size:18px}.item-note{margin-top:8px;color:#b45309;font-size:13px;font-weight:700}
    .summary{margin-top:22px;border:1px solid #e4d2b4;border-radius:18px;background:linear-gradient(135deg,#fffdf8,#fbf4e7);padding:22px;display:grid;grid-template-columns:1fr 1.1fr;gap:22px;align-items:center}.sum-lines{display:grid;gap:10px}.sum-row{display:flex;justify-content:space-between;border-bottom:1px dashed #ddcfba;padding-bottom:9px;font-weight:800}.sum-row span:first-child{color:#374151}.sum-row span:last-child{direction:ltr}.total-box{background:linear-gradient(145deg,var(--green),#093a22);border:2px solid var(--gold);border-radius:16px;padding:18px 24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px;box-shadow:0 10px 26px rgba(15,79,45,.16)}.total-title{font-size:26px;font-weight:900}.total-amount{font-size:31px;font-weight:900;color:#ffd96a;direction:ltr}.ornament{height:92px;background:url('/logo.png') center/contain no-repeat;opacity:.18;filter:saturate(.8)}
    .footer{margin-top:22px;background:linear-gradient(145deg,#0d4b2c,#08371f);color:#fff;border:2px solid var(--gold);border-radius:18px;padding:18px;text-align:center;font-weight:800}.footer small{display:block;color:#e8d5a1;margin-top:4px;font-size:12px}.no-print{margin-top:18px;text-align:center}.print-btn{border:0;border-radius:999px;background:var(--green);color:#fff;font-weight:900;padding:12px 28px;cursor:pointer;font-family:inherit}
    @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0;border:0;max-width:none;min-height:100vh}.no-print{display:none}.header{grid-template-columns:115px 1fr 170px}.brand h1{font-size:34px}}
    @media (max-width:760px){body{padding:10px}.page{padding:20px}.header{grid-template-columns:1fr;text-align:center}.badge{max-width:220px;margin:auto}.cards{grid-template-columns:1fr}.pattern{margin-inline:-20px}.contacts{flex-wrap:wrap}.summary{grid-template-columns:1fr}.product-name{font-size:18px}.head th,.item-row td{font-size:13px;padding:12px 8px}.total-box{flex-direction:column}.brand h1{font-size:30px}}
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <img class="logo" src="/logo.png" alt="مطبخ التراث الكويتي" />
      <div class="brand">
        <h1>مطبخ التراث الكويتي</h1>
        <div class="tagline">أصالة الطعم.. من تراثنا الكويتي</div>
        <div class="contacts"><span>☎ 92225308</span><span>☎ 94059238</span><span>◎ @Alturath.kw</span></div>
      </div>
      <div class="badge"><div class="title">فاتورة</div><div class="sub">شكراً لتسوقكم معنا</div></div>
    </section>
    <div class="pattern"></div>

    <section class="cards">
      <div class="card">
        <h2><span class="icon">☰</span> تفاصيل الفاتورة</h2>
        <div class="row"><span class="label">رقم الفاتورة</span><span class="value">${toEnglishDigits((order as any).invoiceId || (order as any).id || '-')}</span></div>
        <div class="row"><span class="label">التاريخ والوقت</span><span class="value">${toEnglishDigits(formatKuwaitiDate(invoiceDate).full)}</span></div>
        <div class="row"><span class="label">الحالة</span><span class="value status ${statusClass}">${toEnglishDigits(status)}</span></div>
      </div>
      <div class="card">
        <h2><span class="icon">♡</span> معلومات العميل</h2>
        <div class="row"><span class="label">اسم العميل</span><span class="value">${customerName}</span></div>
        <div class="row"><span class="label">رقم التلفون</span><span class="value">${customerPhone || '-'}</span></div>
        <div class="row"><span class="label">العنوان</span><span class="value">${address}</span></div>
      </div>
    </section>

    <section class="table-wrap">
      <table>
        <thead class="head"><tr><th>المنتج / الإضافات</th><th>الكمية</th><th>السعر الفردي</th><th>إجمالي المنتج</th></tr></thead>
        <tbody>${itemsHtml || `<tr class="item-row"><td colspan="4" class="center">ماكو منتجات</td></tr>`}</tbody>
      </table>
    </section>

    <section class="summary">
      <div class="ornament"></div>
      <div class="sum-lines">
        <div class="sum-row"><span>إجمالي المنتجات</span><span>${formatKwd(productsSubtotal)}</span></div>
        <div class="sum-row"><span>إجمالي الإضافات</span><span>${formatKwd(addonsSubtotal)}</span></div>
        ${discount > 0 ? `<div class="sum-row"><span>الخصم</span><span>${formatKwd(discount)}</span></div>` : ''}
        <div class="sum-row"><span>التوصيل</span><span>${formatKwd(deliveryFee)}</span></div>
      </div>
      <div class="total-box" style="grid-column:1 / -1"><span class="total-title">الإجمالي النهائي</span><span class="total-amount">${formatKwd(grandTotal)}</span></div>
    </section>

    <footer class="footer">🌿 شكراً لتعاملكم معنا<small>Alturath.kw | 92225308 | 94059238</small></footer>
    <div class="no-print"><button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button></div>
  </main>
  <script>
    const printWhenReady = () => {
      const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
      const imagesReady = Promise.all(Array.from(document.images).map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })));
      Promise.all([fontsReady, imagesReady]).finally(() => setTimeout(() => window.print(), 350));
    };
    if (document.readyState === 'complete') printWhenReady();
    else window.addEventListener('load', printWhenReady, { once: true });
  </script>
</body>
</html>`;
};

export const openPrintableInvoice = (order: any, products: any[] = []) => {
  const html = buildInvoiceHTML(order, products);
  const w = window.open('', '_blank');
  w?.document.write(html);
  w?.document.close();
};

export const shareOrPrintInvoice = async (order: any, products: any[] = []) => {
  const text = buildDisplayWhatsAppText(order, products);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'فاتورة مطبخ التراث الكويتي', text });
      return;
    } catch {}
  }
  openPrintableInvoice(order, products);
};
