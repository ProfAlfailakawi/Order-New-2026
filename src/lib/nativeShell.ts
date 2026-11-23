// الكاشف الوحيد المشترك لغلاف التطبيق الأصلي (Capacitor داخل WKWebView).
// الصفحة نفسها تعمل في المتصفح وداخل التطبيق، وهذه الدالة هي المرجع الوحيد للتفريق بينهما.
export const isNativeApp = (): boolean => {
  try {
    return Boolean((globalThis as any).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};
