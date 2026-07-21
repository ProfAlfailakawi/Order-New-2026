export type RedirectResult = "opened_popup" | "navigating_away" | "popup_blocked";

export const redirectToPayment = (paymentLink: string): RedirectResult => {
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
