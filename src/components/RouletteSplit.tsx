import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Users, Crown, CreditCard, PartyPopper, ArrowRight, AlertCircle, Check, Trophy, ShieldCheck } from "lucide-react";
import { normalizeDigits } from "../utils";

const normalizeArabicName = (name: string) => {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "");
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
    if (phone.length !== 8) return alert("يرجى إدخال رقم هاتف صحيح مكون من 8 أرقام");
    try {
      const res = await fetch(`/api/orders/${order.id}/join-roulette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) throw new Error('تعذر تسجيل الاسم في الروليت');
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
          "فشل الاتصال بالخادم. يبدو أن الخادم قيد إعادة التشغيل لتطبيق التحديثات. يرجى الانتظار والمحاولة مرة أخرى.",
        );
      } else {
        alert("فشل الانضمام: " + (e?.message || "حدث خطأ غير متوقع"));
      }
    }
  };

  const spin = async () => {
    if (participants.length < 2) return alert("نحتاج شخصين عالأقل للقطية!");
    try {
      const res = await fetch(`/api/orders/${order.id}/spin-roulette`, { method: "POST" });
      if (!res.ok) throw new Error('تعذر تشغيل الروليت');
    } catch (e: any) {
      if (
        e &&
        e.message &&
        (e.message.includes("Load failed") ||
          e.message.includes("Failed to fetch"))
      ) {
        alert(
          "فشل الاتصال بالخادم. يبدو أن الخادم قيد إعادة التشغيل لتطبيق التحديثات. يرجى الانتظار والمحاولة مرة أخرى.",
        );
      } else {
        alert("فشل السحب: " + (e?.message || "حدث خطأ غير متوقع"));
      }
    }
  };

  useEffect(() => {
    if (spun && !isSpinning && participants.length > 0) {
      if (!sessionStorage.getItem(`spun_${order.id}`)) {
        setIsSpinning(true);
        let count = 0;
        const interval = setInterval(() => {
          setActiveIndex((prev) => prev + 1);
          count++;
          if (count > 40) {
            clearInterval(interval);
            setIsSettling(true);
            setTimeout(() => {
              setIsSpinning(false);
              setIsSettling(false);
              sessionStorage.setItem(`spun_${order.id}`, "true");
            }, 900);
          }
        }, 60);
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
  const pulseIndex = participants.length ? ((displayIndex % participants.length) + participants.length) % participants.length : 0;

  const totalPaid = (order.splitPayments || [])
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
                <span className="animate-spin inline-block">⏳</span> جاري التحويل للطلب...
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
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
          className="absolute left-4 top-5 p-2 text-white/60 hover:text-white rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <header className="roulette-ultra-hero roulette-v14-hero wahag-wow-hero text-center pt-10 space-y-4">
          <div className="roulette-v14-marquee">
            <span>مطبخ التراث الكويتي</span>
            <span>وهق ربعك</span>
            <span>{participants.length} مشارك</span>
          </div>
          <div className="roulette-ultra-orb roulette-v14-orb w-20 h-20 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(217,70,239,0.3)]">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="roulette-title-card">
            <span className="roulette-kicker">تحدي الربع</span>
            <h1 className="text-3xl sm:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-white to-violet-300">
              وهق ربعك
            </h1>
            <p className="text-stone-300 font-bold mt-2 leading-relaxed max-w-xl mx-auto">
              نبضة واحدة، أسماء الربع، ولحظة صمت تكشف الكريم. الفاتورة {order.total.toFixed(3)} د.ك
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
                  placeholder="رقم الهاتف (مثال: 90000000)"
                  className="w-full bg-white text-slate-950 border border-white/20 rounded-2xl px-4 py-3.5 text-center font-bold focus:outline-none focus:ring-4 focus:ring-fuchsia-500/25 focus:border-fuchsia-400"
                  dir="ltr"
                />
                <button
                  onClick={join}
                  className="w-full bg-white text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_18px_45px_rgba(255,255,255,0.12)]"
                >
                  <Users className="w-5 h-5" />
                  دش جرب حظك
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
                      >
                        <b>{p.name?.charAt(0) || "؟"}</b>
                        {p.name}
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
                    const shareText = `دش وهق ربعك، نبضة وحدة وواحد فينا راح يدفع العشا ${order?.total.toFixed(3)} د.ك! ادخل: ${window.location.href}`;
                    if (navigator.share) {
                      navigator.share({
                        title: "وهق ربعك — نبضة الوهقة",
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
                  دز الرابط للربع وشوف حظهم ووهقهم
                </button>

                {participants.length >= 2 && (
                  <button
                    onClick={spin}
                    className="roulette-spin-button w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black py-4 rounded-2xl shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-transform mt-4"
                  >
                    ابدأ النبضة
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
            <div className="wahag-pulse-stage relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center overflow-visible">
              <div className="wahag-pulse-aura" />
              <div className="wahag-pulse-grid" />
              <div className="wahag-pulse-orbit wahag-pulse-orbit-one" />
              <div className="wahag-pulse-orbit wahag-pulse-orbit-two" />
              <div className="wahag-pulse-orbit wahag-pulse-orbit-three" />

              {participants.map((p: any, i: number) => {
                const angle = participants.length ? (360 / participants.length) * i - 90 : 0;
                const isActive = isSpinning && i === pulseIndex;
                const isWinner = !isSpinning && spun && i === loserIndex;
                return (
                  <motion.div
                    key={`${p.name}-${i}`}
                    className={`wahag-pulse-node ${isActive ? "is-active" : ""} ${isWinner ? "is-winner" : ""}`}
                    style={{
                      "--angle": `${angle}deg`,
                      "--delay": `${i * 0.08}s`,
                    } as React.CSSProperties}
                    animate={isActive ? { scale: [1, 1.18, 1], opacity: [0.76, 1, 0.86] } : { scale: isWinner ? 1.16 : 1, opacity: isWinner ? 1 : 0.72 }}
                    transition={{ duration: isActive ? 0.28 : 0.45, repeat: isActive ? Infinity : 0 }}
                  >
                    <span className="wahag-pulse-dot" />
                    <b>{p.name}</b>
                  </motion.div>
                );
              })}

              <div className={`wahag-pulse-core ${isSpinning ? "is-scanning" : ""} ${!isSpinning && spun ? "has-result" : ""}`}>
                <div className="wahag-pulse-core-ring" />
                {!isSpinning && spun ? (
                  <motion.div
                    initial={{ scale: 0.72, opacity: 0, filter: "blur(10px)" }}
                    animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                    transition={{ type: "spring", bounce: 0.42, duration: 0.75 }}
                    className="wahag-pulse-result-name"
                  >
                    <small>الوهقة وصلت</small>
                    <strong>{participants[loserIndex]?.name || loser}</strong>
                  </motion.div>
                ) : (
                  <div className="wahag-pulse-live-copy">
                    <small>نبضة الوهقة</small>
                    <strong>{participants[pulseIndex]?.name || "جاهزين"}</strong>
                    <span>نقيس نبض الربع</span>
                  </div>
                )}
              </div>
            </div>

            {isSettling && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="wahag-silence-card"
              >
                <span>الاختيار قرب...</span>
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
                          {paymentStatus === "failed" ? "جرب مرة ثانية 🔄" : `تأكيد ودفع القطية`}
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
