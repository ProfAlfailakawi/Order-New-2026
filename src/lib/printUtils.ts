import { formatKuwaitiDate } from '../utils';
import { COMMERCIAL_REGISTRATION_NUMBER, LEGAL_TRADE_NAME_AR } from './legalIdentity';
import { AppState, Invoice } from '../types';

const toEnglishDigits = (value: any) => String(value ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const fmt = (value: any) => `${toEnglishDigits(Number(value || 0).toFixed(3))} د.ك`;

const clean = (value: any) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const formatAddress = (address: any, fallback?: string) => {
  if (!address || address === 'غير محدد') return clean(fallback) || 'غير محدد';

  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed) return clean(fallback) || 'غير محدد';
    try {
      const parsed = JSON.parse(trimmed);
      return formatAddress(parsed, fallback);
    } catch {
      return trimmed;
    }
  }

  if (typeof address === 'object') {
    // Supports normal address objects and previously imported objects like { "الأحمدي": { ... } }
    const source = address.region || address.area || address.block || address.street || address.building || address.house
      ? address
      : Object.values(address || {}).find((v: any) => v && typeof v === 'object') || address;

    const parts = [
      clean((source as any).region || (source as any).area || (source as any).governorate),
      clean((source as any).block) ? `قطعة ${(source as any).block}` : '',
      clean((source as any).street) ? `شارع ${(source as any).street}` : '',
      clean((source as any).jaddah) ? `جادة ${(source as any).jaddah}` : '',
      clean((source as any).building || (source as any).house) ? `منزل ${clean((source as any).building || (source as any).house)}` : '',
      clean((source as any).floor) ? `دور ${(source as any).floor}` : '',
      clean((source as any).apartment) ? `شقة ${(source as any).apartment}` : '',
    ].filter(Boolean);
    return parts.join(' - ') || clean(fallback) || 'غير محدد';
  }

  return clean(fallback) || 'غير محدد';
};

const getAddonQty = (addon: any, itemQty: number) => {
  const explicitQty = addon?.quantity ?? addon?.qty ?? addon?.count;
  if (explicitQty !== undefined && explicitQty !== null && explicitQty !== '') {
    return Math.max(0, Number(explicitQty || 0));
  }
  return 1;
};

const getAddonTotal = (addon: any, itemQty: number) => {
  const qty = getAddonQty(addon, itemQty);
  if (qty <= 0 || addon?.selected === false || addon?.isSelected === false || addon?.enabled === false) return 0;
  return Number((addon?.total ?? addon?.amount ?? addon?.totalPrice ?? (Number(addon?.price || 0) * qty)) || 0);
};

export function generateInvoiceHTML(invoice: Invoice, data: AppState): string {
  const customers = (data?.customers || []) as any[];
  const products = (data?.products || []) as any[];
  const customer = customers.find(c => c.id === (invoice as any).customerId);
  const invoiceDate = (invoice as any).date || (invoice as any).createdAt || new Date().toISOString();
  const status = (invoice as any).paymentStatus || (invoice as any).status || 'مدفوعة';
  const normalizedStatus = String(status || '').toLowerCase();
  const statusClass = normalizedStatus.includes('pending') || normalizedStatus.includes('انتظار') ? 'pending-status' : normalizedStatus.includes('paid') || String(status).includes('مدفوع') || String(status).includes('مدفوعة') ? 'paid-status' : 'other-status';
  const customerName = clean(customer?.name || (invoice as any).customerName) || 'عميل';
  const customerPhone = clean(customer?.phone || (invoice as any).customerPhone || (invoice as any).phone);
  const address = formatAddress((invoice as any).address || customer?.address, (invoice as any).deliveryInfo?.zoneName);

  let productsSubtotal = 0;
  let addonsSubtotal = 0;

  const itemsHtml = ((invoice as any).items || []).map((item: any, index: number) => {
    const product = products.find(p => p.id === item.productId) || {};
    const name = clean(item.name || item.productName || product.name) || 'منتج غير معروف';
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.priceAtTime ?? item.price ?? product.price ?? 0);
    const productTotal = unitPrice * qty;
    productsSubtotal += productTotal;

    const addons = Array.isArray(item.addons) ? item.addons
      : Array.isArray(item.selectedAddons) ? item.selectedAddons
      : Array.isArray(item.addOns) ? item.addOns
      : Array.isArray(item.extras) ? item.extras
      : [];

    const addonsHtml = addons.map((addon: any) => {
      const addonName = clean(addon?.name || addon?.title || addon?.label);
      const addonQty = getAddonQty(addon, qty);
      const addonTotal = getAddonTotal(addon, qty);
      if (!addonName || addonQty <= 0) return '';
      addonsSubtotal += addonTotal;
      const userQty = addon.quantity !== undefined ? Number(addon.quantity) : (addon.qty !== undefined ? Number(addon.qty) : addonQty);
      return `
        <div class="addon-line">
          <span><b>•</b> ${addonName}${userQty > 1 ? ` × ${userQty}` : ''}</span>
          <span class="addon-price">${fmt(addonTotal)}</span>
        </div>`;
    }).filter(Boolean).join('');

    return `
      <tr class="item-row">
        <td class="product-cell">
          <div class="product-name"><span class="item-number">${index + 1}.</span> ${name}</div>
          ${addonsHtml ? `<div class="addons-wrap">${addonsHtml}</div>` : ''}
          ${item.itemNotes ? `<div class="item-note">${item.itemNotes}</div>` : ''}
        </td>
        <td class="center">${qty}</td>
        <td class="money">${fmt(unitPrice)}</td>
        <td class="money strong">${fmt(productTotal)}</td>
      </tr>`;
  }).join('');

  const deliveryFee = Number((invoice as any).deliveryFee || 0);
  const discount = Number((invoice as any).discount || 0);
  const grandTotal = Math.max(0, Number((invoice as any).totalAmount ?? (productsSubtotal + addonsSubtotal + deliveryFee - discount)));

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>فاتورة ${(invoice as any).id || ''}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root{--green:#0f4f2d;--green2:#0b3f25;--red:#d7192f;--gold:#d7a94f;--soft:#fbfaf6;--line:#eadfcd;--text:#172033;--muted:#6b7280;}
    @page{size:A4 portrait;margin:10mm;}
    *{box-sizing:border-box} body{margin:0;padding:0;background:#f3f4f6;font-family:'Cairo',Arial,sans-serif;color:var(--text);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .print-shell{padding:16px;}
    @media screen{.page{width:210mm;max-width:calc(100vw - 32px);min-height:297mm;}}
    .page{margin:auto;background:#fff;border:1px solid #eee1cc;border-radius:22px;padding:14mm 13mm 11mm;box-shadow:0 18px 50px rgba(15,79,45,.10);position:relative;overflow:hidden;}
    .page:before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:linear-gradient(90deg,var(--red),var(--green),var(--gold));opacity:.8}
    .header{display:grid;grid-template-columns:130px 1fr 190px;align-items:center;gap:22px;padding-bottom:22px;border-bottom:1px solid var(--line);}
    .logo{width:116px;height:116px;object-fit:contain;justify-self:center;}
    .brand{text-align:center}.brand h1{margin:0;color:var(--green);font-size:38px;line-height:1.1;font-weight:900;letter-spacing:-1px}.tagline{margin-top:8px;color:#b88a31;font-weight:700;font-size:15px}.legal-identity{margin-top:9px;display:flex;justify-content:center;gap:8px 14px;flex-wrap:wrap;color:#4b5563;font-size:11px;font-weight:800;line-height:1.7}.legal-identity span{white-space:nowrap}.contacts{margin-top:11px;display:flex;justify-content:center;gap:18px;direction:ltr;color:#263143;font-weight:700}.contacts span{display:flex;align-items:center;gap:6px}.badge{background:linear-gradient(145deg,var(--green),var(--green2));color:#fff;border:2px solid var(--gold);border-radius:18px;padding:18px 14px;text-align:center;box-shadow:0 8px 22px rgba(15,79,45,.18)}.badge .title{font-size:30px;font-weight:900}.badge .sub{font-size:13px;color:#f4d986;font-weight:800;margin-top:5px}
    .pattern{height:18px;margin:14px -38px 24px;background:repeating-linear-gradient(45deg,rgba(215,169,79,.26) 0 8px,transparent 8px 17px),linear-gradient(90deg,rgba(215,25,47,.05),rgba(15,79,45,.05));border-block:1px solid rgba(215,169,79,.25)}
    .cards{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:22px}.card{border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(15,79,45,.05);padding:22px}.card h2{margin:0 0 16px;color:var(--green);font-size:22px;font-weight:900;display:flex;align-items:center;gap:9px}.card h2 .icon{color:var(--red);font-size:22px}.row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #eee7dc}.row:last-child{border-bottom:0}.label{color:#555;font-weight:700}.value{font-weight:800;text-align:left;direction:rtl}.status{font-weight:900}.paid-status{color:var(--green)}.pending-status{color:#b45309;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:2px 10px}.other-status{color:#475569}
    .table-wrap{border:1px solid var(--line);border-radius:18px;overflow:hidden;margin-top:8px;background:#fff}table{width:100%;border-collapse:collapse}.head th{background:linear-gradient(180deg,var(--green),#0b4327);color:#f7d880;font-size:15px;padding:15px 12px;text-align:center;font-weight:900}.head th:first-child{text-align:right}.item-row td{padding:20px 14px;border-bottom:1px dashed #dccfbc;vertical-align:top}.item-row:last-child td{border-bottom:0}.product-cell{width:45%}.product-name{font-size:22px;font-weight:900;color:#111827}.item-number{color:var(--red);margin-left:6px}.addons-wrap{margin-top:10px;display:grid;gap:5px}.addon-line{display:flex;justify-content:space-between;gap:12px;color:#343b48;font-weight:700;font-size:14px}.addon-line b{color:var(--red);font-size:18px;line-height:0}.addon-price{color:#a17622;white-space:nowrap}.center{text-align:center;font-size:20px;font-weight:800}.money{text-align:center;font-weight:800;direction:ltr;white-space:nowrap}.strong{color:var(--green);font-size:18px}.item-note{margin-top:8px;color:#b45309;font-size:13px;font-weight:700}
    .summary{margin-top:22px;border:1px solid #e4d2b4;border-radius:18px;background:linear-gradient(135deg,#fffdf8,#fbf4e7);padding:22px;display:grid;grid-template-columns:1fr 1.1fr;gap:22px;align-items:center}.sum-lines{display:grid;gap:10px}.sum-row{display:flex;justify-content:space-between;border-bottom:1px dashed #ddcfba;padding-bottom:9px;font-weight:800}.sum-row span:first-child{color:#374151}.sum-row span:last-child{direction:ltr}.total-box{background:linear-gradient(145deg,var(--green),#093a22);border:2px solid var(--gold);border-radius:16px;padding:18px 24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px;box-shadow:0 10px 26px rgba(15,79,45,.16)}.total-title{font-size:26px;font-weight:900}.total-amount{font-size:31px;font-weight:900;color:#ffd96a;direction:ltr}.ornament{height:92px;background:url('/logo.png') center/contain no-repeat;opacity:.18;filter:saturate(.8)}
    .footer{margin-top:22px;background:linear-gradient(145deg,#0d4b2c,#08371f);color:#fff;border:2px solid var(--gold);border-radius:18px;padding:18px;text-align:center;font-weight:800}.footer small{display:block;color:#e8d5a1;margin-top:4px;font-size:12px}.no-print{margin-top:18px;text-align:center}.print-btn{border:0;border-radius:999px;background:var(--green);color:#fff;font-weight:900;padding:12px 28px;cursor:pointer;font-family:inherit}
    @media print{html,body{width:210mm;min-height:297mm;background:#fff;padding:0;margin:0}.print-shell{padding:0}.page{width:190mm;min-height:277mm;box-shadow:none;border-radius:0;border:0;max-width:none;margin:0 auto;padding:10mm}.no-print{display:none!important}.header{grid-template-columns:105px 1fr 160px}.brand h1{font-size:30px}.logo{width:96px;height:96px}.badge .title{font-size:24px}.card{padding:14px}.item-row td{padding:12px 10px}.product-name{font-size:18px}.summary{padding:14px;margin-top:14px}.footer{margin-top:14px;padding:12px}}
    @media (max-width:760px){body{padding:10px}.page{padding:20px}.header{grid-template-columns:1fr;text-align:center}.badge{max-width:220px;margin:auto}.cards{grid-template-columns:1fr}.pattern{margin-inline:-20px}.contacts{flex-wrap:wrap}.summary{grid-template-columns:1fr}.product-name{font-size:18px}.head th,.item-row td{font-size:13px;padding:12px 8px}.total-box{flex-direction:column}.brand h1{font-size:30px}}
  </style>
</head>
<body>
  <div class="print-shell">
  <main class="page">
    <section class="header">
      <img class="logo" src="/logo.png" alt="مطبخ التراث الكويتي" />
      <div class="brand">
        <h1>مطبخ التراث الكويتي</h1>
        <div class="tagline">أصالة الطعم.. من تراثنا الكويتي</div>
        <div class="legal-identity"><span>الاسم التجاري: ${LEGAL_TRADE_NAME_AR}</span><span>رقم السجل التجاري: ${COMMERCIAL_REGISTRATION_NUMBER}</span></div>
        <div class="contacts"><span>☎ 92225308</span><span>☎ 94059238</span><span>◎ @Alturath.kw</span></div>
      </div>
      <div class="badge"><div class="title">فاتورة</div><div class="sub">شكراً لتسوقكم معنا</div></div>
    </section>
    <div class="pattern"></div>

    <section class="cards">
      <div class="card">
        <h2><span class="icon">☰</span> تفاصيل الفاتورة</h2>
        <div class="row"><span class="label">رقم الفاتورة</span><span class="value">${toEnglishDigits((invoice as any).id || '-')}</span></div>
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
        <div class="sum-row"><span>إجمالي المنتجات</span><span>${fmt(productsSubtotal)}</span></div>
        <div class="sum-row"><span>إجمالي الإضافات</span><span>${fmt(addonsSubtotal)}</span></div>
        ${discount > 0 ? `<div class="sum-row"><span>الخصم</span><span>${fmt(discount)}</span></div>` : ''}
        <div class="sum-row"><span>التوصيل</span><span>${fmt(deliveryFee)}</span></div>
      </div>
      <div class="total-box" style="grid-column:1 / -1"><span class="total-title">الإجمالي النهائي</span><span class="total-amount">${fmt(grandTotal)}</span></div>
    </section>

    <footer class="footer">🌿 شكراً لتعاملكم معنا<small>الاسم التجاري: ${LEGAL_TRADE_NAME_AR} | رقم السجل التجاري: ${COMMERCIAL_REGISTRATION_NUMBER}</small><small>Alturath.kw | 92225308 | 94059238</small></footer>
    <div class="no-print"><button class="print-btn" onclick="safePrintInvoice()">طباعة / حفظ PDF</button></div>
  </main>
  </div>
  <script>
    async function waitForInvoiceAssets(){
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e) {}
      const imgs = Array.from(document.images || []);
      await Promise.all(imgs.map(function(img){
        if (img.complete) return Promise.resolve();
        return new Promise(function(resolve){ img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 1200); });
      }));
      await new Promise(function(resolve){ requestAnimationFrame(function(){ requestAnimationFrame(resolve); }); });
    }
    async function safePrintInvoice(){
      await waitForInvoiceAssets();
      window.print();
    }
    window.addEventListener('load', function(){ waitForInvoiceAssets(); });
  </script>
</body>
</html>`;
}
