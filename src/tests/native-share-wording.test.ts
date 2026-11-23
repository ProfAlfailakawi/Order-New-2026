import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { shareViaNativePlugin } from '../lib/nativeShare';
import { locationWording } from '../lib/appWording';

const DATA = { title: 'ت', text: 'نص', url: 'https://site.invalid/?squadId=1' };
afterEach(() => vi.unstubAllGlobals());

describe('shareViaNativePlugin', () => {
  it('المتصفح: false ولا يستدعي أي إضافة (يبقى navigator.share كما هو)', async () => {
    const share = vi.fn();
    vi.stubGlobal('Capacitor', { isNativePlatform: () => false, Plugins: { Share: { share } } });
    expect(await shareViaNativePlugin(DATA)).toBe(false);
    expect(share).not.toHaveBeenCalled();
    vi.stubGlobal('Capacitor', undefined);
    expect(await shareViaNativePlugin(DATA)).toBe(false);
  });
  it('داخل التطبيق: يستدعي إضافة Share ويعيد true', async () => {
    const share = vi.fn().mockResolvedValue({});
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, Plugins: { Share: { share } } });
    expect(await shareViaNativePlugin(DATA)).toBe(true);
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: DATA.url, text: DATA.text }));
  });
  it('داخل التطبيق: إلغاء المستخدم true بلا ورقة ثانية، وفشل آخر أو غياب الإضافة false للرجوع إلى المسار المعتاد', async () => {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, Plugins: { Share: { share: vi.fn().mockRejectedValue(new Error('Share canceled')) } } });
    expect(await shareViaNativePlugin(DATA)).toBe(true);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, Plugins: { Share: { share: vi.fn().mockRejectedValue(new Error('boom')) } } });
    expect(await shareViaNativePlugin(DATA)).toBe(false);
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, Plugins: {} });
    expect(await shareViaNativePlugin(DATA)).toBe(false);
  });
});

describe('locationWording', () => {
  it('داخل التطبيق: لا كلمة «متصفح» في أي نص', () => {
    const w = locationWording(true);
    for (const v of Object.values(w)) expect(String(v)).not.toMatch(/متصفح|Safari/);
  });
  it('المتصفح: النصوص الأصلية حرفياً', () => {
    const w = locationWording(false);
    expect(w.allowFrom).toBe('من المتصفح');
    expect(w.geoDenied).toBe('الموقع يحتاج سماح. فعّل اللوكيشن من المتصفح أو استخدم الإدخال اليدوي لتثبيت ديوانيتك الحالية.');
    expect(w.geoUnavailable).toBe('المتصفح لم يتمكن من قراءة موقعك حالياً. جرّب مرة ثانية أو استخدم الإدخال اليدوي.');
  });
  it('SquadModalContent لا يحمل نص «من المتصفح» ثابتاً ويستعمل الكاشف المشترك', () => {
    const src = readFileSync('src/components/SquadModalContent.tsx', 'utf8');
    expect(src).not.toContain('من المتصفح');
    expect(src).toContain('shareViaNativePlugin(shareData)');
  });
});
