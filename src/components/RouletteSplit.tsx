import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Users, Crown, CreditCard, PartyPopper, ArrowRight, AlertCircle, Check, Trophy, ShieldCheck } from "lucide-react";
import { normalizeDigits } from "../utils";
import { SaduAvatar } from "./SaduAvatar";

const normalizeArabicName = (name: string) => {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "");
};

const getSafeSplitPayments = (order: any): any[] => {
  if (!order) return [];
  const splits = order.splitPayments;
  if (!splits) return [];
  if (Array.isArray(splits)) return splits;
  if (typeof splits === "object") return Object.values(splits);
  return [];
};

export function RouletteSplit({
  order,
  handlePay,
  paymentStatus,
  urlName,
}: {
  order: any;
  handlePay: (name: string, phone: string, amount: string) => void;
  paymentStatus?: string | null;
  urlName?: string | null;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const participants = order.splitParticipants || [];
  const spun = !!order.rouletteLoser;
  const loser = order.rouletteLoser;
  const [isSpinning, setIsSpinning] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);
  const [mySpinName, setMySpinName] = useState(
    () => localStorage.getItem(`roulette_${order.id}`) || "",
  );
  const [mySpinPhone, setMySpinPhone] = useState(
    () => localStorage.getItem(`roulette_phone_${order.id}`) || "",
  );
  const [activeIndex, setActiveIndex] = useState(0);

  // Luxury mechanical watch haptics and gold shimmer states
  const [hapticVibrate, setHapticVibrate] = useState(false);
  const [shimmerGold, setShimmerGold] = useState(false);

  // Web Audio clockwork micro-ticks
  const playMechanicalTick = () => {
    try {
      if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(3200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.04);
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1800;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {}
  };

  // Luxury gold resonant chime chord
  const playGoldSuccessBell = () => {
    try {
      if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        
        const playTone = (freq: number, delay: number, dur: number, vol: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + dur);
        };
        
        playTone(523.25, 0, 1.8, 0.08); // C5
        playTone(659.25, 0.05, 1.8, 0.06); // E5
        playTone(783.99, 0.1, 1.8, 0.05); // G5
        playTone(1046.50, 0.15, 2.5, 0.04); // C6
      }
    } catch (e) {}
  };
  useEffect(() => {
    if (paymentStatus === "success") {
      setLocalSuccess(true);
    }
  }, [paymentStatus]);

  const errorMsg = React.useMemo(() => {
    const errorMsgs = [
      "ما انخصم شيء من حسابك، شكلها عين! جرب تدفع مرة ثانية 😂",
      "الرصيد زعلان ولا شسالفة؟ جرب مرة ثانية 💳",
      "البنك يقول لا.. بس إحنا نقول ماكو فكة، حاول مرة ثانية! 🏦",
      "شكلها الشبكة فصلت عليك، جرب مرة ثانية 📡",
      "فلوسك عزيزة عليك؟ ادفع مرة ثانية وخلصنا! 💸😆",
      "عمليتك ما مشت، لا تحاتي ما راح شيء.. طق مرة ثانية 🔄"
    ];
    return errorMsgs[Math.floor(Math.random() * errorMsgs.length)];
  }, []);

  const join = async () => {
    if (!name.trim()) return;
    if (phone.length !== 8) return alert("دخل رقم تلفون صحيح 8 أرقام");
    try {
      const res = await fetch(`/api/orders/${order.id}/join-roulette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) throw new Error('ما قدرنا ندخلك وهق غيرك');
      setMySpinName(name);
      setMySpinPhone(phone);
      localStorage.setItem(`roulette_${order.id}`, name);
      localStorage.setItem(`roulette_phone_${order.id}`, phone);
    } catch (e: any) {
      if (
        e &&
        e.message &&
        (e.message.includes("Load failed") ||
          e.message.includes("Failed to fetch"))
      ) {
        alert(
          "السيرفر قاعد يتحدث، نطر شوي وجرب مرة ثانية.",
        );
      } else {
        alert("ما قدرنا ندخلك: " + (e?.message || "صار خلل غير متوقع"));
      }
    }
  };

  const spin = async () => {
    if (participants.length < 2) return alert("نحتاج شخصين عالأقل عشان نخليه يغرم!");
    try {
      const res = await fetch(`/api/orders/${order.id}/spin-roulette`, { method: "POST" });
      if (!res.ok) throw new Error('ما قدرنا نشغل وهق غيرك');
    } catch (e: any) {
      if (
        e &&
        e.message &&
        (e.message.includes("Load failed") ||
          e.message.includes("Failed to fetch"))
      ) {
        alert(
          "السيرفر قاعد يتحدث، نطر شوي وجرب مرة ثانية.",
        );
      } else {
        alert("ما ضبط السحب: " + (e?.message || "صار خلل غير متوقع"));
      }
    }
  };

  useEffect(() => {
    if (spun && !isSpinning && participants.length > 0) {
      if (!sessionStorage.getItem(`spun_${order.id}`)) {
        setIsSpinning(true);
        setIsSettling(false);
        setShimmerGold(false);

        // Find the index of the loser
        const normalizedLoser = normalizeArabicName(loser);
        const lIndex = participants.findIndex(
          (p: any) => normalizeArabicName(p.name) === normalizedLoser
        );
        const targetLoserIndex = lIndex === -1 ? 0 : lIndex;

        // Calculate steps so the final pointer lands EXACTLY on targetLoserIndex
        const currentPos = activeIndex % participants.length;
        const circles = 4; // at least 4 full circles for dramatic impact
        const stepsToTake = (participants.length * circles) + ((targetLoserIndex - currentPos + participants.length) % participants.length);

        let currentStep = 0;
        
        const runTick = () => {
          setActiveIndex((prev) => prev + 1);
          currentStep++;

          // Visual ocular micro-shake trigger
          setHapticVibrate(true);
          setTimeout(() => setHapticVibrate(false), 22);

          // Play luxury mechanical click sound
          playMechanicalTick();

          if (currentStep < stepsToTake) {
            // Deceleration curve
            const progress = currentStep / stepsToTake;
            let delay = 35 + Math.pow(progress, 3.5) * 440;
            
            // Add slight watch-spring organic variance
            delay += Math.sin(currentStep) * (progress * 15);
            
            setTimeout(runTick, delay);
          } else {
            // Clockwork pointer settles beautifully
            setIsSettling(true);
            setTimeout(() => {
              setIsSpinning(false);
              setIsSettling(false);
              setShimmerGold(true);
              
              // Play gold chime
              playGoldSuccessBell();
              
              sessionStorage.setItem(`spun_${order.id}`, "true");
            }, 1000);
          }
        };

        // Start luxury physical spin
        setTimeout(runTick, 40);
      }
    }
  }, [spun, participants.length, order.id, isSpinning]);

  const loserIndex = React.useMemo(() => {
    if (!loser || participants.length === 0) return 0;
    const normalizedLoser = normalizeArabicName(loser);
    const idx = participants.findIndex((p: any) => 
      normalizeArabicName(p.name) === normalizedLoser
    );
    return idx === -1 ? 0 : idx;
  }, [loser, participants]);

  const displayIndex = isSpinning ? activeIndex : loserIndex;
  const pulseParticipants = participants.length > 0 ? participants : [{ name: loser || "؟" }];
  const pulseIndex = pulseParticipants.length > 0 ? ((displayIndex % pulseParticipants.length) + pulseParticipants.length) % pulseParticipants.length : 0;

  const totalPaid = getSafeSplitPayments(order)
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const isFullyPaid =
    localSuccess ||
    order.total - totalPaid <= 0.005 ||
    order.paymentStatus === "paid" ||
    order.status?.startsWith("تم الدفع");

  if (isFullyPaid) {
    return (
      <div
        className="min-h-screen bg-stone-900 text-white font-sans flex items-center justify-center p-6 text-center"
        dir="rtl"
      >
        {paymentStatus === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white p-8 justify-center items-center rounded-[32px] flex flex-col gap-4 shadow-xl shadow-[#25D366]/20 border border-white/20 relative overflow-hidden max-w-md w-full"
          >
            <div className="absolute top-0 right-0 w-32 h-32 wahag-participant-chip bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-12 -mb-12" />
            <div className="w-16 h-16 wahag-result-card bg-white rounded-full flex items-center justify-center shadow-inner relative z-10">
              <Check className="w-8 h-8 text-[#25D366]" strokeWidth={3} />
            </div>
            <div className="text-center relative z-10 w-full">
              <h3 className="text-2xl font-extrabold mb-2">كفو يا {urlName || loser || "بطل"}! 🥳</h3>
              <p className="text-white/90 font-medium leading-relaxed">
                دفعك تم بنجاح، مبروك فوزك بلقب الكريم اليوم!<br/>استمتعوا بالعشاء الهني وبالعافية عليكم! ✨
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-green-100/80 bg-black/10 py-2 px-4 rounded-full w-fit mx-auto">
                <span className="animate-spin inline-block">⏳</span> نحوّلك للطلب...
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="bg-green-500/20 border border-green-500/50 rounded-3xl p-8 max-w-md w-full space-y-4">
            <PartyPopper className="w-16 h-16 mx-auto text-green-400" />
            <h2 className="text-3xl font-black text-green-400">انتهت اللعبة! 🎯</h2>
            <p className="font-bold text-green-100">
              تم دفع الفاتورة بالكامل عن طريق{" "}
              <span className="text-white bg-black/30 px-2 py-1 rounded-md">
                {loser || "صاحب الحظ"}
              </span>
            </p>
            <p className="text-sm text-green-200 mt-4">الطلب قاعد يتجهز وبطريجه لكم 🚀</p>
            <button
              onClick={() => navigate(`/track?order_id=${order.id}`)}
              className="mt-6 bg-white text-green-600 font-black py-4 px-6 rounded-xl w-full active:scale-95 transition-transform"
            >
              متابعة الطلب
            </button>
          </div>
        )}
      </div>
    );
  }

  const payPhrases = [
    { title: "مبروك طاحت براسك يا {name}! 💸", desc: "وهق غيرك اختارتك، جهز الكي نت ولا تبخل على ربعك!" },
    { title: "كفو يا {name}! أنت الكريم 👑", desc: "اليوم عشاهم على حسابك، ادفع وأنت تضحك!" },
    { title: "منور يا {name}! الشرف لك اليوم 🌟", desc: "الفاتورة من نصيبك، بيّض الوجه وادفع!" },
    { title: "صادوه يا {name}! 🎣", desc: "لعبة وهق غيرك ما ترحم، افتح البوك وسدد اللي عليك يا بطل!" },
    { title: "لبستها يا {name}! 👕", desc: "يا حظك بطيبتك، الفاتورة عليك اليوم!" },
    { title: "يعطيك العافية مقدماً يا {name}! 👏", desc: "ربعك مستانسين وجيبك قاعد يبكي، توكل على الله وادفع!" },
    { title: "كشخة يا {name}، العشا عليك! 🍽️", desc: "لعبة وهق غيرك حبتك، طلع المخبى وراونا كرمك!" },
    { title: "جابها الحظ لك يا {name}! 🎲", desc: "تستاهل تكون المعزب اليوم، الكي نت ينطرك!" },
    { title: "يا زينك وأنت تدفع يا {name}! 😍", desc: "مو خسارة بربعك، الحساب عندك اليوم!" },
    { title: "فديت قلبك يا {name}، الفاتورة باسمك! 💌", desc: "ادفع وابتسم، لأن باجي الشباب مستانسين!" }
  ];

  const savedPhrases = [
    { title: "طلعت منها براءة يا {name}! 😅", desc: "كفووو! العشا بلاش، أكل واشرب على حساب {loser}!" },
    { title: "مبروك يا {name}! عشاك ببلاش 🎉", desc: "عليك بالعافية، {loser} بيدفع دم قلبه اليوم!" },
    { title: "يا حظك يا {name}! 🕊️", desc: "ارتاح، الفاتورة طاحت براس {loser}، خله يغرم!" },
    { title: "{name}، نام مرتاح اليوم 😴", desc: "ماكو دفع اليوم! {loser} أكل المقلب وراح يحاسب!" },
    { title: "النحشة صح يا {name}! 🏃‍♂️💨", desc: "وهق غيرك طافت عليك، {loser} بيلبس الفاتورة كاملة!" },
    { title: "سلمت منها يا {name}! 😁", desc: "وفر فلوسك، باجي الربع دبسوها بـ {loser}!" },
    { title: "عدت على خير يا {name}! 🛡️", desc: "الرصيد في أمان اليوم، العشا خالص من {loser}!" },
    { title: "سلكت معاك يا {name}! 🎢", desc: "الحمدلله ما يت فيك، جهز بطنك لأكل {loser}!" },
    { title: "طافت عليك يا {name}! 🎯", desc: "فلوسك الحين بجيبك، والفاتورة بحضن {loser}!" },
    { title: "أنت محظوظ يا {name}! 🍀", desc: "لعبة وهق غيرك عدتك، خل {loser} يعيش اللحظة ويدفع!" }
  ];

  const getPhraseContent = (myName: string, isPaying: boolean, loserName: string) => {
    const list = isPaying ? payPhrases : savedPhrases;
    let hash = 0;
    const key = loserName || "الفائز";
    for (let i = 0; i < key.length; i++) hash += (key.charCodeAt(i) * (i + 1));
    const phrase = list[hash % list.length];
    return {
      title: phrase.title.replace(/{name}/g, myName),
      desc: phrase.desc.replace(/{name}/g, myName).replace(/{loser}/g, key)
    };
  };

  return (
    <div
      className="min-h-screen roulette-ultra-shell wahag-wow-shell text-white font-sans selection:bg-fuchsia-500/30"
      dir="rtl"
    >
      <div className="max-w-md lg:max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-32 relative">
        <button 
          onClick={() => navigate("/?checkout=payment")}
          className="payment-back-floating wahag-back-to-payment"
          aria-label="الرجوع إلى طريقة الدفع"
        >
          <ArrowRight className="w-6 h-6" />
          <span>طريقة الدفع</span>
        </button>
        <header className="roulette-ultra-hero roulette-v14-hero wahag-wow-hero text-center pt-10 space-y-4">
          <div className="roulette-v14-marquee">
            <span>مطبخ التراث الكويتي</span>
            <span>وهق غيرك</span>
            <span>{participants.length} مشارك</span>
          </div>
          <div className="roulette-ultra-orb roulette-v14-orb w-20 h-20 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(217,70,239,0.3)]">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="roulette-title-card">
            <span className="roulette-kicker">تحدي الربع</span>
            <h1 className="text-3xl sm:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-white to-violet-300">
              خله يغرم 🎰
            </h1>
            <p className="text-stone-300 font-bold mt-2 leading-relaxed max-w-xl mx-auto">
              أسماء الربع تدخل، والنبضة تختار واحد يشيل العشا. الفاتورة {order.total.toFixed(3)} د.ك
            </p>
          </div>
          <div className="roulette-status-strip roulette-v14-status-strip">
            <span>{participants.length} مشارك</span>
            <span>{spun ? "تم السحب" : "بانتظار الربع"}</span>
            <span>{order.total.toFixed(3)} د.ك</span>
          </div>
        </header>

        {!spun && !isSpinning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="roulette-ultra-card roulette-v14-card wahag-wow-card bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5"
          >
            {!mySpinName ? (
              <div className="space-y-4">
                <h2 className="font-bold text-center">
                  اسم المتورط
                </h2>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="الاسم (مثال: محمد)"
                  className="w-full bg-white text-slate-950 border border-white/20 rounded-2xl px-4 py-3.5 text-center font-bold focus:outline-none focus:ring-4 focus:ring-fuchsia-500/25 focus:border-fuchsia-400 mb-2"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phone}
                  onChange={(e) => setPhone(normalizeDigits(e.target.value).replace(/[^0-9]/g, "").slice(0, 8))}
                  placeholder="رقم التلفون (مثال: 90000000)"
                  className="w-full bg-white text-slate-950 border border-white/20 rounded-2xl px-4 py-3.5 text-center font-bold focus:outline-none focus:ring-4 focus:ring-fuchsia-500/25 focus:border-fuchsia-400"
                  dir="ltr"
                />
                <button
                  onClick={join}
                  className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_18px_45px_rgba(255,255,255,0.12)]"
                >
                  <Users className="w-5 h-5" />
                  دش نبضة الربع
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-stone-400 font-bold">
                  انت في اللوبي باسم:{" "}
                  <span className="text-fuchsia-400">{mySpinName}</span>
                </div>

                <div className="roulette-lobby-panel roulette-v14-lobby bg-black/40 rounded-2xl p-4 min-h-[100px]">
                  <div className="roulette-v14-lobby-head">
                    <h3 className="text-xs text-stone-300 font-bold">
                      الشباب باللوبي ({participants.length})
                    </h3>
                    <span>{participants.length >= 2 ? "جاهزين للسحب" : "نحتاج شخصين"}</span>
                  </div>
                  <div className="roulette-v14-participants">
                    {participants.map((p: any, i: number) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/5"
                      >
                        <SaduAvatar name={p.name} phone={p.phone} size="sm" />
                        <span className="truncate">{p.name}</span>
                      </motion.span>
                    ))}
                  </div>
                  {participants.length >= 2 && (
                    <p className="roulette-v14-hint">
                      تأكدوا أن الكل دش، وإذا العدد كمل أي شخص يقدر يوهقكم وتشوفون النتيجة مباشرة.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    const shareText = `دش لعبة وهق غيرك، واحد فينا بيدفع العشا ${order?.total.toFixed(3)} د.ك! دش: ${window.location.href}`;
                    if (navigator.share) {
                      navigator.share({
                        title: "لعبة وهق غيرك 🎯",
                        text: shareText,
                        url: window.location.href,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareText);
                      alert("تم نسخ الرابط!");
                    }
                  }}
                  className="w-full wahag-participant-chip bg-white/10 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 mt-4 hover:bg-white/20 transition-colors border border-white/10"
                >
                  <Sparkles className="w-5 h-5 text-fuchsia-400" />
                  دز الرابط للربع وخله يغرم
                </button>

                {participants.length >= 2 && (
                  <button
                    onClick={spin}
                    className="roulette-spin-button w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black py-4 rounded-2xl shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-transform mt-4"
                  >
                    خله يغرم
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {(isSpinning ||
          (spun && sessionStorage.getItem(`spun_${order.id}`))) && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="roulette-stage flex flex-col items-center justify-center py-8 sm:py-10 space-y-8"
          >
            {/* Embedded styles for full browser compatibility of local luxury watch & haptics */}
            <style>{`
              @keyframes shimmerGold {
                0%, 100% {
                  box-shadow: 0 0 15px #d6ad4b, 0 0 35px #d6ad4b, inset 0 0 15px rgba(214,173,75,0.7);
                  border-color: #f5d0fe;
                  transform: scale(1.12);
                }
                50% {
                  box-shadow: 0 0 35px #fff7d6, 0 0 65px #f59e0b, inset 0 0 25px rgba(255,255,255,1);
                  border-color: #ffffff;
                  transform: scale(1.18);
                }
              }
              @keyframes hapticShudder {
                0%, 100% { transform: translate(0, 0); }
                20% { transform: translate(-1.5px, 0.8px) rotate(-0.3deg); }
                40% { transform: translate(1.2px, -1.2px) rotate(0.4deg); }
                60% { transform: translate(-0.8px, 1.4px) rotate(-0.2deg); }
                80% { transform: translate(1.4px, -0.6px) rotate(0.1deg); }
              }
              .haptic-shake {
                animation: hapticShudder 0.08s infinite !important;
              }
              .luxury-shimmer-gold {
                animation: shimmerGold 1.2s ease-in-out infinite !important;
                z-index: 50 !important;
              }
              .watch-tick-mark {
                position: absolute;
                width: 2px;
                height: 8px;
                background: linear-gradient(180deg, #d6ad4b, transparent);
                opacity: 0.6;
              }
            `}</style>

            <div 
              className={`wahag-pulse-core relative overflow-hidden ${isSpinning ? "is-scanning" : "is-revealed"} ${hapticVibrate ? "haptic-shake" : ""}`}
              style={{
                border: "4px solid #d6ad4b33",
                boxShadow: "0 0 0 6px #1e1b18, 0 20px 50px rgba(0,0,0,0.6)"
              }}
            >
              {/* Luxury watch tick lines representing minutes / gears */}
              {[...Array(12)].map((_, tickIdx) => (
                <div
                  key={`tick-${tickIdx}`}
                  className="watch-tick-mark"
                  style={{
                    transform: `rotate(${tickIdx * 30}deg) translateY(-145px)`,
                    left: "calc(50% - 1px)",
                    top: "10px"
                  }}
                />
              ))}

              <div className="wahag-pulse-grid" />
              <div className="wahag-pulse-aura" />
              <div className="wahag-pulse-ring ring-one" />
              <div className="wahag-pulse-ring ring-two" />
              <div className="wahag-pulse-ring ring-three" />

              {pulseParticipants.map((p: any, i: number) => {
                const angle = (360 / pulseParticipants.length) * i - 90;
                const isActive = i === pulseIndex;
                const isFinal = !isSpinning && spun && i === loserIndex;

                return (
                  <motion.div
                    key={`${p.name || "participant"}-${i}`}
                    className={
                      "wahag-pulse-orbit-card " +
                      (isActive ? "is-active " : "") +
                      (isFinal ? "is-final " : "") +
                      (isFinal && shimmerGold ? "luxury-shimmer-gold " : "")
                    }
                    style={{
                      ['--pulse-angle' as any]: `${angle}deg`,
                      ['--pulse-radius' as any]: `${pulseParticipants.length <= 4 ? 94 : 116}px`,
                    }}
                    animate={{
                      scale: isActive ? 1.08 : 0.92,
                      opacity: isActive ? 1 : 0.62,
                    }}
                    transition={{ duration: isSpinning ? 0.12 : 0.35, ease: "easeOut" }}
                  >
                    <SaduAvatar name={p.name} phone={p.phone} size="sm" />
                    <strong className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{p.name || "ضيف"}</strong>
                  </motion.div>
                );
              })}

              <div className="wahag-pulse-center">
                <motion.div
                  key={isSpinning ? pulseIndex : `winner-${loser}`}
                  initial={{ scale: 0.88, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: isSpinning ? 0.1 : 0.45, ease: "easeOut" }}
                  className="wahag-pulse-name"
                >
                  <span>{isSpinning ? "نبض الربع" : "الوهقة وصلت"}</span>
                  <strong className={(!isSpinning && spun) && shimmerGold ? "text-amber-400 font-extrabold animate-pulse" : ""}>
                    {isSpinning
                      ? pulseParticipants[pulseIndex]?.name || "..."
                      : participants[loserIndex]?.name || loser}
                  </strong>
                </motion.div>
                <div className="wahag-pulse-line" />
              </div>
            </div>

            {isSettling && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="wahag-silence-card"
              >
                <span>الدور قرب...</span>
                <strong>لحظة صمت قبل النتيجة</strong>
              </motion.div>
            )}

            {!isSpinning && spun && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center space-y-6 w-full"
              >
                {(() => {
                  const parsedLoser = normalizeArabicName(loser);
                  const parsedMySpinName = normalizeArabicName(mySpinName);
                  const parsedUrlName = normalizeArabicName(urlName);
                  
                  const isLoser = parsedLoser !== "" && (parsedLoser === parsedMySpinName || parsedLoser === parsedUrlName);
                  const isGuest = parsedMySpinName === "" && parsedUrlName === "";
                  
                  const myDisplayName = mySpinName || urlName || (isLoser ? loser : "ضيفنا");
                  const resultContent = getPhraseContent(myDisplayName, isLoser, loser);

                  if (isLoser) {
                    return (
                      <div className="roulette-result-card roulette-v14-result wahag-wow-result is-loser p-6 bg-violet-500/20 border border-violet-500/50 rounded-3xl text-violet-100 space-y-4">
                        {paymentStatus === "failed" && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="bg-gradient-to-br from-red-500 to-rose-600 text-white p-6 justify-center items-center rounded-3xl flex flex-col gap-3 shadow-xl shadow-red-500/20 border border-white/20 relative overflow-hidden mb-4"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 wahag-participant-chip bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
                            <div className="w-14 h-14 wahag-result-card bg-white rounded-full flex items-center justify-center shadow-inner relative z-10 shrink-0">
                              <AlertCircle className="w-7 h-7 text-red-500" strokeWidth={3} />
                            </div>
                            <div className="text-center relative z-10 w-full">
                              <h3 className="text-xl font-extrabold mb-1">فشلت العملية يا {urlName || mySpinName || loser} 💔</h3>
                              <p className="text-white/90 font-medium text-sm leading-relaxed">{errorMsg}</p>
                            </div>
                          </motion.div>
                        )}
                        <div className="roulette-v14-result-icon"><Trophy className="w-7 h-7" /></div>
                        <h2 className="text-3xl font-black text-white">{resultContent.title}</h2>
                        <p className="font-bold text-violet-200">
                          {resultContent.desc}
                        </p>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-sm">
                           <p className="mb-2 opacity-80">الفاتورة الإجمالية:</p>
                           <p className="text-2xl font-black text-white">{order.total.toFixed(3)} د.ك</p>
                        </div>
                        <button
                          onClick={() =>
                            handlePay(
                              urlName || mySpinName || loser,
                              mySpinPhone || order.customerPhone || "00000000",
                              String(order.total),
                            )
                          }
                          className="w-full bg-white text-violet-600 font-black py-4 rounded-xl mt-4 active:scale-95 transition-transform flex justify-center items-center gap-2 shadow-[0_0_25px_rgba(139,92,246,0.3)]"
                        >
                          <CreditCard className="w-5 h-5" />
                          {paymentStatus === "failed" ? "جرب مرة ثانية 🔄" : `ادفع الغرامة`}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="roulette-result-card roulette-v14-result wahag-wow-result is-safe p-6 bg-fuchsia-500/20 border border-fuchsia-500/50 rounded-3xl text-fuchsia-100 space-y-4">
                      <div className="roulette-v14-result-icon is-safe"><ShieldCheck className="w-7 h-7" /></div>
                      <h2 className="text-3xl font-black text-white">{resultContent.title}</h2>
                      <p className="font-bold text-fuchsia-200">
                        {resultContent.desc}
                      </p>
                      <div className="pt-4 border-t border-fuchsia-500/30">
                        <p className="text-sm opacity-80">تم تصفية القطية لهذا الطلب بنجاح بانتظار الدفع من {loser}</p>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
