import { isNativeApp } from "../lib/nativeShell";

export type RedirectResult = "opened_popup" | "navigating_away" | "popup_blocked";

export const redirectToPayment = (paymentLink: string): RedirectResult => {
  // داخل التطبيق لا توجد نوافذ منبثقة ولا window.opener: ننتقل في نفس النافذة،
  // ثم تعود صفحة الدفع إلى /track بمعرّف الطلب فتكمل الصفحة التأكيد بالاستعلام الدوري.
  if (isNativeApp()) {
    window.location.href = paymentLink;
    return "navigating_away";
  }
  try {
    const isIframe = window !== window.top;
    
    if (isIframe) {
      // Opening in a new tab helps avoid iframe issues with UPayments blocking X-Frame-Options
      const newWindow = window.open(paymentLink, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Fallback if popup blocker is enabled
        console.warn("Popup blocked. User must click the payment link manually.");
        alert('تم حظر النافذة المنبثقة من قبل المتصفح. سيتم توجيهك لصفحة التتبع حيث يمكنك الضغط على رابط الدفع يدوياً.');
        return "popup_blocked";
      }
      return "opened_popup";
    } else {
      // Native navigation for production inside the same tab
      window.location.href = paymentLink;
      return "navigating_away";
    }
  } catch (err) {
    console.error("Redirect error", err);
    window.location.href = paymentLink;
    return "navigating_away";
  }
};
