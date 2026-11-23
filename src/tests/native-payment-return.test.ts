import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { isNativeApp } from '../lib/nativeShell';
import { redirectToPayment } from '../utils/redirect';

// داخل التطبيق (Capacitor/WKWebView): الدفع في نفس النافذة بلا window.open ولا window.opener.
// في المتصفح السلوك كما كان. لا اتصال حقيقي بالدفع: الرابط وهمي ولا يُفتح شيء.

const LINK = 'https://pay.invalid/checkout/test-only';

function stubWindow({ native, iframe }: { native: boolean; iframe: boolean }) {
  const win: any = { location: { href: 'https://site.invalid/' }, open: vi.fn(() => null) };
  win.top = iframe ? {} : win;
  vi.stubGlobal('window', win);
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('Capacitor', native ? { isNativePlatform: () => true } : undefined);
  return win;
}

afterEach(() => vi.unstubAllGlobals());

describe('isNativeApp', () => {
  it('false بلا Capacitor ومع isNativePlatform=false، true داخل الغلاف', () => {
    vi.stubGlobal('Capacitor', undefined);
    expect(isNativeApp()).toBe(false);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => false });
    expect(isNativeApp()).toBe(false);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
    expect(isNativeApp()).toBe(true);
  });
});

describe('redirectToPayment', () => {
  it('داخل التطبيق: نفس النافذة حتى لو كانت الصفحة في إطار، وبلا window.open', () => {
    for (const iframe of [false, true]) {
      const win = stubWindow({ native: true, iframe });
      expect(redirectToPayment(LINK)).toBe('navigating_away');
      expect(win.location.href).toBe(LINK);
      expect(win.open).not.toHaveBeenCalled();
    }
  });

  it('المتصفح خارج الإطار: انتقال في نفس النافذة كما كان', () => {
    const win = stubWindow({ native: false, iframe: false });
    expect(redirectToPayment(LINK)).toBe('navigating_away');
    expect(win.location.href).toBe(LINK);
    expect(win.open).not.toHaveBeenCalled();
  });

  it('المتصفح داخل إطار: window.open كما كان، وحظر النافذة يعيد popup_blocked', () => {
    const win = stubWindow({ native: false, iframe: true });
    expect(redirectToPayment(LINK)).toBe('popup_blocked');
    expect(win.open).toHaveBeenCalledWith(LINK, '_blank');
    expect(win.location.href).toBe('https://site.invalid/');
    win.open.mockReturnValue({ closed: false });
    expect(redirectToPayment(LINK)).toBe('opened_popup');
  });
});

describe('OrderPage payment_return', () => {
  const src = readFileSync('src/pages/OrderPage.tsx', 'utf8');
  it('إرسال postMessage إلى window.opener محروس بـ isNativeApp، ومستمع الرسائل والاستعلام الدوري باقيان للمتصفح', () => {
    expect(src).toMatch(/!isNativeApp\(\)\s*&&\s*window\.opener\s*&&\s*window\.opener\s*!==\s*window/);
    expect(src).toContain('window.addEventListener("message", handleGlobalMessage)');
    expect(src).toContain('const refreshMs = ["success", "paid"].includes(paymentState) ? 500 : 3000');
  });
});
