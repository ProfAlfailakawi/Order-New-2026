import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, MapPin, Package, Wallet } from "lucide-react";

/**
 * OrderFormation — "تكوين الطلب"
 * A one-time cinematic transition shown right after a successful payment and
 * before the tracking screen. The real order elements (product images,
 * quantities, the paid amount and the delivery address) drift fluidly toward
 * the center, fuse into a single order card carrying the real order number,
 * then that card unfolds downward into the tracking interface beneath it.
 *
 * Purely visual: no payment/order/tracking logic lives here.
 * Animates transform + opacity only. ~2.4s total.
 */

interface OrderFormationProps {
  order: any;
  orderReference: string;
  onDone: () => void;
}

const formatAddressLine = (address: any): string => {
  if (!address) return "";
  if (typeof address === "string") return address.trim();
  const parts = [
    address.region,
    address.block ? `ق${address.block}` : "",
    address.street ? `ش${address.street}` : "",
  ]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return parts.join(" · ");
};

// Deterministic scatter positions (vw/vh-safe px offsets, tuned for ~400px wide screens).
// `sweep` bends each satellite's approach sideways so it arcs into the fusion
// point instead of flying in on a straight chord.
const SCATTER: { x: number; y: number; sweep: number }[] = [
  { x: -118, y: -168, sweep: 46 },
  { x: 124, y: -138, sweep: -42 },
  { x: -136, y: 26, sweep: 38 },
  { x: 132, y: 62, sweep: -36 },
  { x: -74, y: 172, sweep: 44 },
  { x: 86, y: 186, sweep: -40 },
];

const CONVERGE_EASE = [0.32, 0.72, 0, 1] as const;

export default function OrderFormation({ order, orderReference, onDone }: OrderFormationProps) {
  // Snapshot the order once so live polling refreshes never restart the scene.
  const orderRef = useRef(order);
  const snapshot = orderRef.current;

  const [phase, setPhase] = useState<"gather" | "card" | "merge">("gather");
  const doneRef = useRef(false);

  const satellites = useMemo(() => {
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const sats: {
      key: string;
      node: React.ReactNode;
    }[] = [];

    const withImages = items.filter((i: any) => i?.image);
    const visible = (withImages.length ? withImages : items).slice(0, 3);

    visible.forEach((item: any, idx: number) => {
      const qty = Math.max(1, Number(item?.quantity || item?.qty || 1));
      sats.push({
        key: `item-${idx}`,
        node: (
          <div className="relative">
            {item?.image ? (
              <img
                src={item.image}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover border border-white/60 shadow-lg shadow-stone-900/10 bg-white"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white border border-stone-100 shadow-lg shadow-stone-900/10 flex items-center justify-center">
                <Package className="w-7 h-7 text-stone-300" />
              </div>
            )}
            {qty > 1 && (
              <span className="absolute -top-2 -left-2 min-w-6 h-6 px-1.5 rounded-full bg-brand text-white text-[11px] font-extrabold flex items-center justify-center shadow-md">
                ×{qty}
              </span>
            )}
          </div>
        ),
      });
    });

    const extraCount = items.length - visible.length;
    if (extraCount > 0) {
      sats.push({
        key: "more",
        node: (
          <div className="w-12 h-12 rounded-2xl bg-white border border-stone-100 shadow-lg shadow-stone-900/10 flex items-center justify-center text-stone-500 text-sm font-extrabold">
            +{extraCount}
          </div>
        ),
      });
    }

    const total = Number(snapshot?.total || 0);
    if (total > 0) {
      sats.push({
        key: "payment",
        node: (
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-stone-100 shadow-lg shadow-stone-900/10 px-4 py-2.5">
            <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-extrabold text-stone-700 whitespace-nowrap">
              {total.toFixed(2)} د.ك
            </span>
          </div>
        ),
      });
    }

    const addressLine = formatAddressLine(snapshot?.address);
    if (addressLine) {
      sats.push({
        key: "address",
        node: (
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-stone-100 shadow-lg shadow-stone-900/10 px-4 py-2.5 max-w-[220px]">
            <MapPin className="w-4 h-4 text-brand shrink-0" />
            <span className="text-sm font-bold text-stone-600 truncate">{addressLine}</span>
          </div>
        ),
      });
    }

    return sats.slice(0, SCATTER.length);
  }, [snapshot]);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("card"), 1250);
    const t2 = window.setTimeout(() => setPhase("merge"), 2050);
    const t3 = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, 2450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // Intentionally run once — the scene is a fixed 2.4s timeline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thumbs = (Array.isArray(snapshot?.items) ? snapshot.items : [])
    .filter((i: any) => i?.image)
    .slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "merge" ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: phase === "merge" ? 0.42 : 0.28, ease: "easeOut" }}
      className="fixed inset-0 z-[210] flex items-center justify-center bg-brand/80 backdrop-blur-md px-5 overflow-hidden"
      dir="rtl"
      aria-live="polite"
    >
      {/* Staged backdrop: a deep warm veil with a soft stage-light falling on
          the fusion point. The gradient layers are static paint; only their
          container's opacity/transform ever animates. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% 110%, rgba(30,12,4,0.55), transparent 60%), radial-gradient(ellipse 110% 80% at 50% -15%, rgba(35,16,6,0.45), transparent 55%)",
        }}
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: phase === "merge" ? 0 : 1, scale: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="absolute inset-0 pointer-events-none will-change-transform"
        style={{
          background:
            "radial-gradient(circle 300px at 50% 50%, rgba(255,236,214,0.20), rgba(255,224,190,0.07) 45%, transparent 70%)",
        }}
      />

      {/* Drifting satellites: the order's real pieces arc gracefully toward the center */}
      {phase === "gather" &&
        satellites.map((sat, i) => {
          const from = SCATTER[i % SCATTER.length];
          // Perpendicular sweep bends the path into a gentle arc.
          const midX = from.x * 0.62 + from.sweep * (from.y >= 0 ? -0.9 : 0.9) * 0.35;
          const midY = from.y * 0.62 + from.sweep * 0.5;
          const lean = from.x > 0 ? -7 : 7;
          return (
            <motion.div
              key={sat.key}
              initial={{ x: from.x, y: from.y, scale: 0.72, opacity: 0, rotate: lean }}
              animate={{
                x: [from.x, midX, 0],
                y: [from.y, midY, 0],
                scale: [0.72, 1, 0.3],
                rotate: [lean, lean * 0.4, 0],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 1.3,
                delay: i * 0.07,
                times: [0, 0.48, 1],
                opacity: { duration: 1.3, delay: i * 0.07, times: [0, 0.28, 0.82, 1] },
                ease: CONVERGE_EASE,
              }}
              className="absolute will-change-transform"
            >
              {sat.node}
            </motion.div>
          );
        })}

      {/* Soft gathering point pulse (transform+opacity only, no glow) */}
      {phase === "gather" && (
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1, 1.35], opacity: [0, 0.35, 0] }}
          transition={{ duration: 1.35, ease: "easeInOut", times: [0, 0.55, 1] }}
          className="absolute w-28 h-28 rounded-full border-2 border-white/50"
        />
      )}

      {/* The fused order card — a calm breath as it is born, then it unfolds
          downward into the tracking timeline beneath (transform+opacity only:
          it stretches open from its top edge rather than dissolving in place). */}
      {phase !== "gather" && (
        <motion.div
          initial={{ scale: 0.62, opacity: 0, y: 6 }}
          animate={
            phase === "merge"
              ? { scaleX: 1.05, scaleY: 1.45, y: 34, opacity: 0 }
              : {
                  // Birth: swell slightly past rest, then a calm settling breath.
                  scale: [0.62, 1.035, 0.992, 1],
                  opacity: 1,
                  y: [6, 0, 0, 0],
                }
          }
          transition={
            phase === "merge"
              ? { duration: 0.42, ease: [0.45, 0, 0.55, 1] }
              : {
                  duration: 0.72,
                  times: [0, 0.42, 0.74, 1],
                  ease: ["easeOut", "easeInOut", "easeInOut"],
                  opacity: { duration: 0.3, ease: "easeOut" },
                }
          }
          style={{ transformOrigin: "50% 0%" }}
          className="relative w-full max-w-sm bg-white rounded-[32px] p-8 text-center shadow-2xl shadow-stone-900/25 will-change-transform"
        >
          <motion.div
            animate={{ opacity: phase === "merge" ? 0 : 1 }}
            transition={{ duration: phase === "merge" ? 0.18 : 0.2, ease: "easeOut" }}
          >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.08 }}
            className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4"
          >
            <CheckCircle2 className="w-9 h-9" />
          </motion.div>

          <p className="text-xs font-bold text-stone-400 mb-1">تم اعتماد الدفع · تكوّن طلبك</p>
          <h2 className="text-2xl font-extrabold text-brand tracking-tight mb-3">
            {orderReference}
          </h2>

          {thumbs.length > 0 && (
            <div className="flex items-center justify-center mb-3" style={{ direction: "ltr" }}>
              {thumbs.map((item: any, idx: number) => (
                <motion.img
                  key={idx}
                  src={item.image}
                  alt=""
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.14 + idx * 0.05, type: "spring", stiffness: 240, damping: 20 }}
                  className="w-9 h-9 rounded-full object-cover border-2 border-white bg-stone-50 shadow-sm -ml-2 first:ml-0"
                />
              ))}
            </div>
          )}

          {Number(snapshot?.total || 0) > 0 && (
            <p className="text-sm font-extrabold text-stone-600">
              {Number(snapshot.total).toFixed(2)} د.ك
            </p>
          )}
          <p className="text-[11px] font-medium text-stone-400 mt-2">
            نفتح لك شاشة المتابعة…
          </p>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
