export const buildWhatsAppInvoiceText = (order: any, products: any[] = []) => {
  const items = order?.items || [];
  const address = order?.address || {};
  const addr = typeof address === 'string' ? address : [address.region, address.block && `ق${address.block}`, address.street && `ش${address.street}`, address.building && `م${address.building}`].filter(Boolean).join(' - ');
  const lines: string[] = [];
  // Use explicit unicode escapes for emojis to avoid encoding issues that
  // sometimes replace high‑codepoint characters with question marks. These
  // escapes correspond to: 🧾👤📍🔢🛒💰🌿.
  lines.push('\u{1F9FE} *فاتورة مطبخ التراث الكويتي*');
  lines.push('');
  lines.push(`\u{1F464} العميل: ${order?.customerName || order?.name || 'عميلنا العزيز'}`);
  lines.push(`\u{1F4CD} العنوان: ${addr || '-'}`);
  lines.push(`\u{1F522} رقم الفاتورة: ${order?.invoiceId || order?.id || '-'}`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━');
  lines.push('\u{1F6D2} *الطلب*');
  lines.push('');
  let productsTotal = 0;
  let addonsTotal = 0;
  items.forEach((it:any, idx:number) => {
    const p = products.find((x:any) => x.id === it.productId) || it.product || {};
    const name = it.productName || p.name || it.name || 'منتج';
    const qty = Number(it.quantity || it.qty || 1);
    const unit = Number(it.priceAtTime ?? it.price ?? p.price ?? 0);
    const row = unit * qty;
    productsTotal += row;
    lines.push(`${idx + 1}) ${name}`);
    lines.push(`   الكمية: ${qty}`);
    lines.push(`   السعر الفردي: ${unit.toFixed(3)} د.ك`);
    lines.push(`   إجمالي المنتج: ${row.toFixed(3)} د.ك`);
    const addons = it.addons || it.selectedAddons || [];
    if (addons.length) {
      lines.push('');
      lines.push('   الإضافات:');
      addons.forEach((a:any) => {
        const aq = Number(a.quantity || a.qty || 1);
        const price = Number(a.price || 0) * aq;
        addonsTotal += price;
        lines.push(`   • ${a.name || 'إضافة'} × ${aq} = ${price.toFixed(3)} د.ك`);
      });
    }
    lines.push('');
  });
  const delivery = Number(order?.deliveryFee || 0);
  const total = Number(order?.total || order?.totalAmount || (productsTotal + addonsTotal + delivery));
  lines.push('━━━━━━━━━━━━━━');
  lines.push('\u{1F4B0} *الملخص*');
  lines.push(`المنتجات: ${productsTotal.toFixed(3)} د.ك`);
  lines.push(`الإضافات: ${addonsTotal.toFixed(3)} د.ك`);
  lines.push(`التوصيل: ${delivery.toFixed(3)} د.ك`);
  lines.push(`الإجمالي: ${total.toFixed(3)} د.ك`);
  lines.push('');
  lines.push('\u{1F33F} شكراً لتعاملكم معنا');
  return lines.join('\n');
};

export const openWhatsAppInvoiceText = (order: any, products: any[] = []) => {
  const phone = order?.customerPhone || order?.phone || '';
  const text = encodeURIComponent(buildWhatsAppInvoiceText(order, products));
  const digits = String(phone || '').replace(/\D/g, '');
  window.open(`https://wa.me/965${digits}?text=${text}`, '_blank');
};

export const openPrintableInvoice = (order: any, products: any[] = []) => {
  const html = `<html dir="rtl"><head><title>فاتورة</title><style>body{font-family:Arial,sans-serif;background:#f7f4ed;padding:24px}.card{max-width:680px;margin:auto;background:white;border-radius:28px;padding:32px;border:1px solid #eadfce}h1{color:#0f5132}.muted{color:#777}.line{height:1px;background:#eee;margin:18px 0}pre{white-space:pre-wrap;font-family:inherit;line-height:1.8}</style></head><body><div class="card"><h1>مطبخ التراث الكويتي</h1><div class="muted">92225308 · 94059238 · @Alturath.kw</div><div class="line"></div><pre>${buildWhatsAppInvoiceText(order, products)}</pre></div><script>window.print()</script></body></html>`;
  const w = window.open('', '_blank');
  w?.document.write(html);
  w?.document.close();
};

export const shareOrPrintInvoice = async (order: any, products: any[] = []) => {
  const text = buildWhatsAppInvoiceText(order, products);
  if (navigator.share) {
    try { await navigator.share({ title: 'فاتورة مطبخ التراث الكويتي', text }); return; } catch {}
  }
  openPrintableInvoice(order, products);
};
