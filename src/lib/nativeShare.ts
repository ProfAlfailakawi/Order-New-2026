import { isNativeApp } from "./nativeShell";

type SharePlugin = {
  share: (o: { title?: string; text?: string; url?: string; dialogTitle?: string }) => Promise<unknown>;
};

/**
 * داخل التطبيق فقط: يفتح ورقة المشاركة عبر إضافة @capacitor/share المسجّلة في الغلاف.
 * يعيد true إذا تم التعامل مع المشاركة (نجحت أو ألغاها المستخدم)، وfalse ليكمل المستدعي بالمسار المعتاد
 * (navigator.share ثم النسخ). خارج التطبيق يعيد false دون أي أثر، فسلوك المتصفح لا يتغيّر.
 */
export async function shareViaNativePlugin(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  if (!isNativeApp()) return false;
  const plugin = (globalThis as any).Capacitor?.Plugins?.Share as SharePlugin | undefined;
  if (!plugin?.share) return false;
  try {
    await plugin.share({ title: data.title, text: data.text, url: data.url, dialogTitle: data.title });
    return true;
  } catch (error: any) {
    // إلغاء المستخدم ليس فشلاً: لا نفتح ورقة ثانية.
    if (/cancel/i.test(String(error?.message || error?.name || ""))) return true;
    return false;
  }
}
