import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { DEFAULT_GLOBAL_LOGO } from "../constants";

/**
 * OrderWelcome — a light, single-screen welcome sheet for the customer home.
 *
 * Design constraints (owner): this is an ordering + PAYMENT app, so onboarding
 * must be FAST, LIGHTWEIGHT and must NEVER block or delay the checkout / payment
 * path. This is intentionally NOT a heavy multi-slide blocking carousel:
 *   - one compact, instantly-dismissible sheet
 *   - shown ONCE only (localStorage flag), near-zero latency
 *   - never shown on the payment return/callback route (?payment=... present)
 *   - a small "؟" affordance lets the user replay it on demand
 *
 * Visual bar: deep heritage green ink (#183326) on warm cream (#fff7e8), a gold
 * hairline eyebrow, refined leaded Arabic type, elegant value chips, real
 * shadows (no harsh borders), spring rise+fade, full RTL + safe-area insets.
 */

const ONBOARDED_KEY = "alturath_onboarded_v1";

const readOnboarded = (): boolean => {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
};

const writeOnboarded = () => {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    /* ignore (private mode / storage disabled) */
  }
};

const isPaymentReturn = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).has("payment");
  } catch {
    return false;
  }
};

const CHIPS: { icon: string; label: string }[] = [
  { icon: "🍽️", label: "رتّب طلبك" },
  { icon: "👥", label: "اعزم ربعك" },
  { icon: "🧾", label: "قسّم وادفع" },
];

interface OrderWelcomeProps {
  logo?: string;
  /** Fired when the user taps the primary "ابدأ الطلب" button. */
  onStart?: () => void;
}

const OrderWelcome: React.FC<OrderWelcomeProps> = ({ logo, onStart }) => {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  // Decide on mount only. Never gate the UI while data loads: default hidden.
  useEffect(() => {
    if (isPaymentReturn()) return; // never interrupt a payment return
    if (!readOnboarded()) setOpen(true);
  }, []);

  const dismiss = (fromStart?: boolean) => {
    writeOnboarded();
    setOpen(false);
    if (fromStart) onStart?.();
  };

  const replay = () => {
    if (isPaymentReturn()) return;
    setOpen(true);
  };

  const logoSrc = logo || DEFAULT_GLOBAL_LOGO;

  const sheetInitial = reduce
    ? { opacity: 0 }
    : { y: 44, opacity: 0, scale: 0.97 };
  const sheetAnimate = reduce
    ? { opacity: 1 }
    : { y: 0, opacity: 1, scale: 1 };
  const sheetExit = reduce ? { opacity: 0 } : { y: 32, opacity: 0, scale: 0.98 };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            dir="rtl"
            className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center"
            style={{
              padding:
                "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div
              className="absolute inset-0 bg-[#0d1f17]/50 backdrop-blur-[3px]"
              onClick={() => dismiss(false)}
              aria-hidden
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="حياكم في مطبخ التراث"
              className="relative w-full max-w-[380px] overflow-hidden rounded-[32px] border border-white/70 bg-[#fff7e8] px-6 pt-8 pb-6 text-center shadow-[0_30px_90px_rgba(24,51,38,0.34)]"
              initial={sheetInitial}
              animate={sheetAnimate}
              exit={sheetExit}
              transition={
                reduce
                  ? { duration: 0.2 }
                  : { type: "spring", stiffness: 320, damping: 30 }
              }
            >
              {/* Warm radial glow + gold top hairline for depth */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 50% 0%, rgba(214,154,35,0.16), transparent 42%)",
                }}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-10 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(to right, transparent, rgba(214,154,35,0.65), transparent)",
                }}
                aria-hidden
              />

              <div className="relative">
                <div className="mx-auto mb-5 flex h-[86px] w-[86px] items-center justify-center overflow-hidden rounded-[26px] bg-white shadow-[0_14px_36px_rgba(24,51,38,0.16)] ring-1 ring-[#eadcbb]">
                  <img
                    src={logoSrc}
                    alt="شركة مطبخ التراث الكويتي"
                    className="h-full w-full object-contain p-2"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                    }}
                  />
                </div>

                <span className="mb-3 inline-block text-[11px] font-black uppercase tracking-[0.22em] text-[#a9822f]">
                  مطبخ التراث الكويتي
                </span>

                <h2
                  className="mx-auto mb-3 max-w-[15ch] text-[1.6rem] font-black leading-[1.35] text-[#183326]"
                  style={{ textWrap: "balance" } as React.CSSProperties}
                >
                  حياكم… طلبكم الطيب يبدأ هنا
                </h2>

                <p className="mx-auto mb-6 max-w-[26ch] text-[13px] font-bold leading-[1.9] text-[#7a684d]">
                  اختار، اعزم ربعك، وقسّم الفاتورة وادفع — تجربة كويتية دافئة
                  بمكان واحد.
                </p>

                <div className="mb-7 flex items-center justify-center gap-2">
                  {CHIPS.map((c) => (
                    <div
                      key={c.label}
                      className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-[#efe1c2] bg-white/70 px-2 py-3 shadow-[0_8px_22px_rgba(24,51,38,0.05)]"
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        {c.icon}
                      </span>
                      <span className="text-[11px] font-black text-[#4a5a4f]">
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(true)}
                  className="w-full rounded-2xl py-4 text-[15px] font-black text-white shadow-[0_16px_36px_rgba(24,51,38,0.28)] transition active:scale-[0.99]"
                  style={{
                    background:
                      "linear-gradient(135deg, #1f4230 0%, #183326 60%, #10241a 100%)",
                  }}
                >
                  ابدأ الطلب
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(false)}
                  className="mt-3.5 text-xs font-bold text-[#9a8460] underline underline-offset-4 transition hover:text-[#7a684d]"
                >
                  تخطّي
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Small, unobtrusive replay affordance — never gates the UI. */}
      {!open && (
        <button
          type="button"
          onClick={replay}
          aria-label="إعادة عرض الترحيب"
          title="كيف يشتغل التطبيق؟"
          className="fixed left-4 z-[60] flex h-9 w-9 items-center justify-center rounded-full border border-[#e8d6ad] bg-white/90 font-black text-[#183326] shadow-md backdrop-blur transition active:scale-95"
          style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
        >
          ؟
        </button>
      )}
    </>
  );
};

export default OrderWelcome;
