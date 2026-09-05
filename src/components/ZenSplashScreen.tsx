import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DEFAULT_GLOBAL_LOGO } from "../constants";

const SPLASH_LINES = [
  "حياكم… نجهز لكم الطلب الطيب",
  "ريحة التراث وصلت… والمنيو بعد لحظات",
  "اختار اللي بخاطرك… والباقي علينا",
  "من مطبخنا إلى بابكم… بالهنا والعافية",
  "الربع، القطيّة، ووهق غيرك… كلهم حاضرین",
  "طعم كويتي دافئ… وتجربة طلب أسهل",
  "افتح النفس… الطلب يبدأ الحين",
  "مطبخ التراث… طلب مرتب على أصوله",
];

interface ZenSplashScreenProps {
  logo?: string;
}

export const ZenSplashScreen: React.FC<ZenSplashScreenProps> = ({ logo }) => {
  const reduce = useReducedMotion();
  const [line, setLine] = useState(SPLASH_LINES[0]);

  useEffect(() => {
    setLine(SPLASH_LINES[Math.floor(Math.random() * SPLASH_LINES.length)]);
  }, []);

  const steam = useMemo(() => [0, 1, 2], []);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#fff7e8] px-5"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.015, transition: { duration: 0.42, ease: "easeInOut" } }}
      dir="rtl"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,219,150,0.72),transparent_31%),radial-gradient(circle_at_10%_86%,rgba(19,92,58,0.18),transparent_34%),radial-gradient(circle_at_90%_78%,rgba(190,66,43,0.14),transparent_31%)]" />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(135deg, #153b2a 10%, transparent 10%, transparent 50%, #153b2a 50%, #153b2a 60%, transparent 60%, transparent)", backgroundSize: "72px 72px" }} />
      <motion.div
        className="absolute -top-20 h-64 w-64 rounded-full bg-[#ffd36d]/35 blur-3xl"
        animate={reduce ? { opacity: 0.7 } : { x: [0, 18, 0], y: [0, 12, 0], opacity: [0.55, 0.85, 0.55] }}
        transition={reduce ? { duration: 0 } : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative w-[min(90vw,440px)] overflow-hidden rounded-[2.4rem] border border-white/75 bg-white/72 p-4 shadow-[0_30px_110px_rgba(70,42,12,0.16)] backdrop-blur-2xl"
        initial={{ y: 20, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#d7a642]/70 to-transparent" />
        <div className="rounded-[2rem] bg-gradient-to-b from-[#fffaf1] to-[#fff2dc] px-6 py-8 text-center ring-1 ring-[#153b2a]/8">
          <div className="relative mx-auto mb-5 h-36 w-36 sm:h-40 sm:w-40">
            {steam.map((item) => (
              <motion.span
                key={item}
                className="absolute left-1/2 top-0 h-12 w-3 rounded-full bg-[#d7a642]/25 blur-sm"
                style={{ marginLeft: `${(item - 1) * 18}px` }}
                initial={{ opacity: 0, y: 14, scaleY: 0.6 }}
                animate={reduce ? { opacity: 0 } : { opacity: [0, 0.75, 0], y: [-2, -24, -42], scaleY: [0.65, 1.2, 0.7] }}
                transition={reduce ? { duration: 0 } : { duration: 2.4, repeat: Infinity, delay: item * 0.28, ease: "easeOut" }}
              />
            ))}
            <motion.div
              className="absolute inset-0 rounded-[2.4rem] bg-gradient-to-br from-[#0f3d2e] via-[#17543d] to-[#d69a23] p-[3px] shadow-[0_24px_70px_rgba(15,61,46,0.22)]"
              initial={reduce ? false : { scale: 0.9, opacity: 0 }}
              animate={reduce ? { scale: 1, opacity: 1 } : { rotate: [0, 0.4, 0], scale: [1, 1.025, 1], opacity: 1 }}
              transition={reduce ? { duration: 0 } : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex h-full w-full items-center justify-center rounded-[2.25rem] bg-[#fff8ea] p-3">
                <img
                  referrerPolicy="no-referrer"
                  src={logo || DEFAULT_GLOBAL_LOGO}
                  alt="شركة مطبخ التراث الكويتي"
                  className="h-full w-full rounded-[1.85rem] object-contain"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                  }}
                />
              </div>
            </motion.div>
          </div>

          <motion.div
            className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#d7a642]/30 bg-white/70 px-4 py-2 text-xs font-black text-[#765622] shadow-sm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.35 }}
          >
            <span className="h-2 w-2 rounded-full bg-[#0f7a4b] shadow-[0_0_0_5px_rgba(15,122,75,0.12)]" />
            تجربة الطلب الدافئة
          </motion.div>

          <motion.h1
            className="text-2xl font-black leading-relaxed text-[#14291f] sm:text-[1.7rem]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
          >
            {line}
          </motion.h1>

          <motion.div
            className="mx-auto mt-5 h-1.5 overflow-hidden rounded-full bg-[#ead8b5]"
            initial={{ width: 110 }}
            animate={{ width: 150 }}
            transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }}
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-l from-[#0f3d2e] via-[#d7a642] to-[#ba3f31]"
              initial={reduce ? { x: "0%" } : { x: "110%" }}
              animate={reduce ? { x: "0%" } : { x: "-110%" }}
              transition={reduce ? { duration: 0 } : { duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          <p className="mt-5 text-sm font-extrabold text-[#7a684d]">
            شركة مطبخ التراث الكويتي
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
