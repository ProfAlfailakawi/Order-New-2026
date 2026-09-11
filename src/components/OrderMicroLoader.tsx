import React, { useEffect, useState } from "react";

/**
 * OrderMicroLoader — branded micro loading indicator.
 * Small product blocks slide once into an order/cart container, the cart
 * outline settles, then a very calm idle pulse loops. No success check is
 * ever shown while loading — a check appears ONLY when `success` is true
 * (i.e. after real confirmation from the server).
 *
 * CSS-driven (transform/opacity only), respects prefers-reduced-motion,
 * optional delayed appearance so sub-250ms operations show nothing.
 */
export const OrderMicroLoader: React.FC<{
  size?: number; // px, 16–64
  label?: string; // sr-only label
  tone?: "brand" | "onDark" | "amber";
  success?: boolean; // ONLY pass true after real confirmation
  delay?: number; // ms before becoming visible (default 250; 0 = immediate)
  className?: string;
}> = ({
  size = 32,
  label = "جاري التحميل",
  tone = "brand",
  success = false,
  delay = 250,
  className = "",
}) => {
  const [visible, setVisible] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={`oml oml-${tone} ${success ? "oml-success" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="oml-item oml-i1" aria-hidden="true" />
      <span className="oml-item oml-i2" aria-hidden="true" />
      <span className="oml-item oml-i3" aria-hidden="true" />
      <span className="oml-cart" aria-hidden="true" />
      {success && <span className="oml-check" aria-hidden="true" />}
      <span className="sr-only">{success ? "تم بنجاح" : label}</span>
    </span>
  );
};

export default OrderMicroLoader;
