import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "../utils";

interface DallahPhysicalGameProps {
  order: any;
  participants: any[];
  loser: string | null;
  loserIndex: number;
  spun: boolean;
  isSpinning: boolean;
  setIsSpinning: (spinning: boolean) => void;
  spin: () => Promise<void>;
  paymentStatus?: string | null;
  urlName?: string | null;
  mySpinName: string;
  mySpinPhone: string;
  handlePay: (name: string, phone: string, amount: string) => void;
  errorMsg: string;
  getPhraseContent: (myName: string, isPaying: boolean, loserName: string) => { title: string; desc: string };
  normalizeArabicName: (name: string) => string;
}

type Phase = "idle" | "passing" | "settling" | "revealed";

const DALLAH_IMAGE = "/dallah-gulf-gold.png";

function arabicSafeName(value: any, fallback = "ضيف") {
  const name = String(value?.name || value || "").trim();
  return name || fallback;
}

function softTick(enabled: boolean, intensity = 0.16) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.07);
    gain.gain.setValueAtTime(intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
    setTimeout(() => ctx.close().catch(() => undefined), 150);
  } catch {
    // Browser can block audio; the visual experience remains complete.
  }
}

export function DallahPhysicalGame({
  order,
  participants,
  loser,
  loserIndex,
  spun,
  isSpinning,
  setIsSpinning,
  spin,
  paymentStatus,
  urlName,
  mySpinName,
  mySpinPhone,
  handlePay,
  errorMsg,
  getPhraseContent,
  normalizeArabicName,
}: DallahPhysicalGameProps) {
  const timerRef = useRef<number | null>(null);
  const targetIndexRef = useRef(-1);
  const spunRef = useRef(spun);
  const [phase, setPhase] = useState<Phase>(spun ? "revealed" : "idle");
  const [visualIndex, setVisualIndex] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [spinError, setSpinError] = useState("");

  const validParticipants = useMemo(
    () => participants.filter((p: any) => arabicSafeName(p?.name, "").length > 0),
    [participants],
  );

  const count = Math.max(validParticipants.length, 1);
  const targetIndex = useMemo(() => {
    if (!spun || validParticipants.length === 0) return -1;
    if (typeof loserIndex === "number" && loserIndex >= 0 && loserIndex < validParticipants.length) return loserIndex;
    const normalizedLoser = normalizeArabicName(loser || "");
    return validParticipants.findIndex((p: any) => normalizeArabicName(p.name) === normalizedLoser);
  }, [spun, validParticipants, loserIndex, loser, normalizeArabicName]);

  const selectedIndex = phase === "revealed" && targetIndex >= 0 ? targetIndex : visualIndex % count;
  const selectedName = targetIndex >= 0 ? arabicSafeName(validParticipants[targetIndex], loser || "الكريم") : loser || "الكريم";

  useEffect(() => {
    targetIndexRef.current = targetIndex;
    spunRef.current = spun;
    if (spun && targetIndex >= 0) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      setVisualIndex(targetIndex);
      setPhase("revealed");
      setIsSpinning(false);
    }
  }, [spun, targetIndex, setIsSpinning]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const beginDallahPass = async () => {
    if (validParticipants.length < 2) {
      setSpinError("نحتاج شخصين على الأقل حتى تبدأ الدلة بالاختيار.");
      return;
    }
    if (phase === "passing" || phase === "settling") return;

    setSpinError("");
    setPhase("passing");
    setIsSpinning(true);
    let ticks = 0;
    let delay = 74;
    let localIndex = visualIndex;

    const step = () => {
      ticks += 1;
      localIndex += 1;
      setVisualIndex(localIndex % count);
      if (ticks % 2 === 0) softTick(audioEnabled, Math.max(0.04, 0.16 - ticks * 0.002));

      if (ticks === 30) setPhase("settling");

      const liveTarget = targetIndexRef.current;
      const hasBackendTarget = spunRef.current && liveTarget >= 0;
      const enoughDrama = ticks > 44;
      if (enoughDrama && hasBackendTarget) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        landOnTarget(liveTarget, localIndex);
        return;
      }

      if (ticks > 88) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        setPhase("idle");
        setIsSpinning(false);
        setSpinError("تأخر الاختيار من الخادم. جرّب مرة ثانية بعد لحظات.");
        return;
      }

      delay = Math.min(210, delay + (ticks > 28 ? 7 : 1));
      timerRef.current = window.setTimeout(step, delay);
    };

    timerRef.current = window.setTimeout(step, delay);

    try {
      await spin();
    } catch (e: any) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setPhase("idle");
      setIsSpinning(false);
      setSpinError(e?.message || "تعذر تشغيل الاختيار.");
    }
  };

  const landOnTarget = (target: number, current: number) => {
    setPhase("settling");
    const extraRounds = count * 2;
    const normalizedCurrent = current % count;
    const distance = (target - normalizedCurrent + count) % count;
    const steps = extraRounds + distance;
    let done = 0;

    const settle = () => {
      done += 1;
      setVisualIndex((prev) => (prev + 1) % count);
      softTick(audioEnabled, Math.max(0.035, 0.1 - done * 0.004));

      if (done >= steps) {
        setVisualIndex(target);
        setPhase("revealed");
        setIsSpinning(false);
        return;
      }

      timerRef.current = window.setTimeout(settle, 130 + done * 24);
    };

    timerRef.current = window.setTimeout(settle, 130);
  };

  const normalizedLoser = normalizeArabicName(loser || "");
  const normalizedMine = normalizeArabicName(mySpinName || "");
  const normalizedUrl = normalizeArabicName(urlName || "");
  const isMyTurnToPay =
    normalizedLoser !== "" && (normalizedLoser === normalizedMine || normalizedLoser === normalizedUrl);
  const myDisplayName = mySpinName || urlName || (isMyTurnToPay ? selectedName : "ضيفنا");
  const resultContent = getPhraseContent(myDisplayName, isMyTurnToPay, selectedName || "الكريم");

  const canStart = validParticipants.length >= 2 && !spun && !isSpinning && phase === "idle";
  const isActiveAnimation = phase === "passing" || phase === "settling" || isSpinning;

  return (
    <section
      className="wahag-dallah-stage relative overflow-hidden rounded-[36px] border border-amber-300/20 bg-[#080604] text-white shadow-2xl shadow-black/50"
      dir="rtl"
      aria-label="الدلة تختار الكريم"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(214,173,75,0.2),transparent_36%),linear-gradient(180deg,rgba(255,221,147,0.08),transparent_24%,rgba(19,97,58,0.05))]" />
      <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:22px_22px]" />

      <div className="relative z-10 px-5 py-6 sm:px-7 sm:py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-100 shadow-inner shadow-amber-900/40">
            <Sparkles className="w-4 h-4 text-amber-300" />
            ميزة ديوانية
          </div>
          <button
            type="button"
            onClick={() => setAudioEnabled((value) => !value)}
            className="w-11 h-11 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-amber-100 active:scale-95 transition-transform"
            aria-label={audioEnabled ? "إيقاف الصوت" : "تشغيل الصوت"}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        <header className="text-center space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-200 to-amber-500">
            الدلة تختار الكريم
          </h2>
          <p className="text-sm font-bold text-stone-300 leading-relaxed">
            اختيار أنيق وعشوائي بين الربع — بلا إحراج وبمزاج ديوانية.
          </p>
        </header>

        <div className="relative mx-auto h-[430px] max-w-[430px] select-none">
          <div className="absolute inset-x-8 top-12 bottom-14 rounded-full border border-dashed border-amber-200/20" />
          <div className="wahag-dallah-orbit-line absolute inset-x-10 top-14 bottom-16 rounded-full" />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={cn("wahag-dallah-pulse", isActiveAnimation && "wahag-dallah-pulse-live")} />
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              animate={
                isActiveAnimation
                  ? { scale: [1, 1.035, 1], rotate: [0, 1.4, -1.4, 0] }
                  : { scale: phase === "revealed" ? [1, 1.02, 1] : 1 }
              }
              transition={{ duration: isActiveAnimation ? 1.1 : 2.4, repeat: isActiveAnimation || phase === "revealed" ? Infinity : 0 }}
              className="relative mt-8"
            >
              <div className="absolute -inset-12 rounded-full bg-amber-400/15 blur-3xl" />
              <img
                src={DALLAH_IMAGE}
                alt="دلة قهوة خليجية ذهبية"
                className="relative z-10 w-[235px] sm:w-[265px] drop-shadow-[0_34px_42px_rgba(0,0,0,0.72)]"
                draggable={false}
              />
              <div className="absolute left-1/2 top-[78%] z-0 h-12 w-64 -translate-x-1/2 rounded-full bg-amber-300/25 blur-2xl" />
            </motion.div>
          </div>

          {validParticipants.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-3xl border border-white/10 bg-black/40 px-5 py-4 text-sm font-bold text-stone-300">
                بانتظار دخول الربع
              </div>
            </div>
          ) : (
            validParticipants.slice(0, 8).map((participant: any, index: number) => {
              const orbitTotal = Math.min(validParticipants.length, 8);
              const angle = -90 + (360 / orbitTotal) * index;
              const radiusX = 168;
              const radiusY = 178;
              const x = Math.cos((angle * Math.PI) / 180) * radiusX;
              const y = Math.sin((angle * Math.PI) / 180) * radiusY;
              const isSelected = selectedIndex === index;
              const isFinal = phase === "revealed" && targetIndex === index;

              return (
                <motion.div
                  key={`${participant.phone || participant.name || index}-${index}`}
                  className="absolute left-1/2 top-1/2"
                  style={{ x: `calc(-50% + ${x}px)`, y: `calc(-50% + ${y}px)` }}
                  animate={{ scale: isSelected ? 1.09 : 1, y: isSelected ? -4 : 0 }}
                  transition={{ type: "spring", stiffness: 360, damping: 24 }}
                >
                  <div
                    className={cn(
                      "relative w-[82px] min-h-[78px] rounded-[24px] border bg-black/50 backdrop-blur-xl px-2 py-3 flex flex-col items-center justify-center gap-1 shadow-xl transition-all duration-300",
                      isSelected ? "border-amber-200/90 shadow-amber-400/25 bg-amber-200/10" : "border-white/10",
                      isFinal && "border-emerald-300 bg-emerald-400/12 shadow-emerald-400/25",
                    )}
                  >
                    {isSelected && <span className="absolute -inset-1 rounded-[27px] border border-amber-200/35 animate-pulse" />}
                    <UserRound className={cn("w-5 h-5", isFinal ? "text-emerald-200" : "text-amber-200")} />
                    <span className="relative z-10 max-w-full truncate text-sm font-black text-amber-50">
                      {arabicSafeName(participant)}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]" />
                  </div>
                </motion.div>
              );
            })
          )}

          <div className="absolute inset-x-0 bottom-0 text-center space-y-3">
            <div className="inline-flex items-center gap-3 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-5 py-2.5 text-sm font-black text-emerald-200 shadow-lg shadow-emerald-900/20">
              <span className="wahag-heartbeat-line" />
              {phase === "passing" && "الدلة تمر بين الربع..."}
              {phase === "settling" && "الدلة تهدّي وتقرّب..."}
              {phase === "idle" && (validParticipants.length >= 2 ? "جاهزة للاختيار" : "بانتظار اكتمال الربع")}
              {phase === "revealed" && `الدلة وقفت عند: ${selectedName}`}
              <span className="wahag-heartbeat-line" />
            </div>
          </div>
        </div>

        {validParticipants.length > 8 && (
          <p className="text-center text-xs font-bold text-stone-400">
            +{validParticipants.length - 8} مشاركين آخرين داخل الاختيار.
          </p>
        )}

        <AnimatePresence mode="wait">
          {spinError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {spinError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <button
            type="button"
            onClick={beginDallahPass}
            disabled={!canStart}
            className={cn(
              "rounded-[26px] py-4 px-5 text-lg font-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-2xl",
              canStart
                ? "bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 text-stone-950 shadow-amber-600/25"
                : "bg-white/8 text-stone-500 border border-white/10 cursor-not-allowed",
            )}
          >
            <Sparkles className="w-5 h-5" />
            {isActiveAnimation ? "جاري الاختيار" : spun ? "تم الاختيار" : "ابدأ الاختيار"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (isActiveAnimation || spun) return;
              setVisualIndex((prev) => (prev + 1) % count);
            }}
            disabled={isActiveAnimation || spun}
            className="rounded-[24px] border border-amber-200/20 bg-white/5 px-4 text-sm font-black text-amber-100 active:scale-95 disabled:opacity-40"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <p className="text-center text-xs font-bold text-stone-500">
          تجربة مرحة وخفيفة للطلب الجماعي — الاختيار يتم عشوائيًا بين المشاركين فقط.
        </p>

        {phase === "revealed" && spun && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn(
              "rounded-[30px] border p-5 text-center space-y-4",
              isMyTurnToPay
                ? "border-amber-300/35 bg-amber-200/10 text-amber-50"
                : "border-emerald-300/30 bg-emerald-400/10 text-emerald-50",
            )}
          >
            {paymentStatus === "failed" && isMyTurnToPay && (
              <div className="rounded-2xl border border-red-400/25 bg-red-500/15 p-4 text-right text-sm font-bold text-red-100 flex gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black mb-1">تعذر إتمام الدفع</div>
                  <div className="leading-relaxed">{errorMsg}</div>
                </div>
              </div>
            )}

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10">
              {isMyTurnToPay ? <Trophy className="h-7 w-7 text-amber-200" /> : <ShieldCheck className="h-7 w-7 text-emerald-200" />}
            </div>

            <div>
              <h3 className="text-xl font-black leading-snug">{resultContent.title}</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-white/70">{resultContent.desc}</p>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <span className="text-xs font-bold text-white/55">إجمالي الطلب</span>
              <strong className="text-lg font-black text-white">{Number(order.total || 0).toFixed(3)} د.ك</strong>
            </div>

            {isMyTurnToPay ? (
              <button
                type="button"
                onClick={() =>
                  handlePay(
                    urlName || mySpinName || selectedName || "عضو",
                    mySpinPhone || order.customerPhone || "00000000",
                    String(order.total),
                  )
                }
                className="w-full rounded-2xl bg-white py-4 font-black text-stone-950 shadow-xl shadow-white/10 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5 text-amber-600" />
                {paymentStatus === "failed" ? "حاول الدفع مرة ثانية" : "تأكيد ودفع الطلب"}
              </button>
            ) : (
              <div className="rounded-2xl border border-emerald-300/20 bg-black/25 px-4 py-3 text-sm font-bold text-emerald-100 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                بانتظار إتمام الدفع بواسطة {selectedName}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
