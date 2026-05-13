import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Users, Crown, CreditCard, PartyPopper, ArrowRight } from "lucide-react";

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
  const [mySpinName, setMySpinName] = useState(
    () => localStorage.getItem(`roulette_${order.id}`) || "",
  );
  const [mySpinPhone, setMySpinPhone] = useState(
    () => localStorage.getItem(`roulette_phone_${order.id}`) || "",
  );
  const [activeIndex, setActiveIndex] = useState(0);

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
      await fetch(`/api/orders/${order.id}/join-roulette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
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
      await fetch(`/api/orders/${order.id}/spin-roulette`, { method: "POST" });
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
            setIsSpinning(false);
            sessionStorage.setItem(`spun_${order.id}`, "true");
          }
        }, 60);
      }
    }
  }, [spun, participants.length, order.id, isSpinning]);

  const loserIndex = participants.findIndex((p: any) => p.name === loser);
  const displayIndex = isSpinning ? activeIndex : loserIndex;

  const totalPaid = (order.splitPayments || [])
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const isFullyPaid =
    order.total - totalPaid <= 0.005 ||
    order.paymentStatus === "paid" ||
    order.status?.startsWith("تم الدفع");

  if (isFullyPaid) {
    return (
      <div
        className="min-h-screen bg-stone-900 text-white font-sans flex items-center justify-center p-6 text-center"
        dir="rtl"
      >
        <div className="bg-green-500/20 border border-green-500/50 rounded-3xl p-8 max-w-md w-full space-y-4">
          <PartyPopper className="w-16 h-16 mx-auto text-green-400" />
          <h2 className="text-3xl font-black text-green-400">
            {paymentStatus === "success" ? `تسلم يا ${urlName || loser || "بطل"}! 🥳` : "انتهت اللعبة! 🎯"}
          </h2>
          {paymentStatus === "success" ? (
            <p className="font-bold text-green-100">
              دفعك تم بنجاح، وبيضت الوجه! وهاردلك هالمرة.. اليايات أكثر وحظك يعوضك! 😉
            </p>
          ) : (
            <p className="font-bold text-green-100">
              تم دفع الفاتورة بالكامل عن طريق{" "}
              <span className="text-white bg-black/30 px-2 py-1 rounded-md">
                {loser || "صاحب الحظ"}
              </span>
            </p>
          )}
          <p className="text-sm text-green-200 mt-4">
            الطلب قاعد يتجهز وبطريجه لكم 🚀
          </p>
        </div>
      </div>
    );
  }

  const winningPhrases = [
    { title: "عوافي يا الذيب! 🥳", desc: (l: any) => <>حبيبك <span className="text-white">{l}</span> دفع الفاتورة اليوم، اشكره لا تنسى!</> },
    { title: "فزت هالمرة! 👑", desc: (l: any) => <>طاحت براس <span className="text-white">{l}</span>، اليوم الأكل ببلاش!</> },
    { title: "عدت على خير! 😎", desc: (l: any) => <>الصدفة أنقذتك! <span className="text-white">{l}</span> راح يدفع الفاتورة اليوم.</> },
    { title: "صدت الفريسة! 🎯", desc: (l: any) => <>مبروك النجاة، <span className="text-white">{l}</span> اهو اللي بيتوهق بالفاتورة!</> }
  ];

  const losingPhrases = [
    { title: "حظك غاب اليوم! 😂", desc: "الفاتورة كاملة طاحت براسك، ادفع يا وحش!" },
    { title: "راحت عليك! 💸", desc: "أنت الليلة شمعة الجلاس والفاتورة عليك!" },
    { title: "طحت فيها! 🎯", desc: "الروليت اختارك، دبر عمرك وادفع الفاتورة!" },
    { title: "يومك كريم! 👑", desc: "الكرم من طبعك، ادفع وعوافي على ربعك!" }
  ];

  const getPhraseIndex = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += (name.charCodeAt(i) * (i + 1));
    return hash;
  };

  const loserContent = losingPhrases[getPhraseIndex(loser || "A") % losingPhrases.length];
  const winnerContent = winningPhrases[getPhraseIndex(loser || "A") % winningPhrases.length];

  return (
    <div
      className="min-h-screen bg-stone-900 text-white font-sans selection:bg-fuchsia-500/30"
      dir="rtl"
    >
      <div className="max-w-md mx-auto p-6 space-y-8 pb-32 relative">
        <button 
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
          className="absolute left-6 top-6 p-2 text-stone-400 hover:text-white"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <header className="text-center pt-8 space-y-4">
          <div className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(217,70,239,0.3)]">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-violet-400">
              انت وحظك
            </h1>
            <p className="text-stone-400 font-bold mt-2">
              عوافي! واحد فيكم بتطيح براسه الفاتورة {order.total.toFixed(3)} د.ك
            </p>
          </div>
        </header>

        {!spun && !isSpinning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6"
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
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-center font-bold focus:outline-none focus:border-fuchsia-500 mb-2"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                  placeholder="رقم الهاتف (مثال: 90000000)"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-center font-bold focus:outline-none focus:border-fuchsia-500"
                  dir="ltr"
                />
                <button
                  onClick={join}
                  className="w-full bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
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

                <div className="bg-black/40 rounded-xl p-4 min-h-[100px]">
                  <h3 className="text-xs text-stone-500 font-bold mb-4">
                    الشباب باللوبي ({participants.length}):
                  </h3>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {participants.map((p: any, i: number) => (
                      <span
                        key={i}
                        className="bg-white/10 px-3 py-1 rounded-full text-sm font-bold"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                  {participants.length >= 2 && (
                    <p className="text-xs text-fuchsia-300 font-bold mt-4">
                      💡 تأكدوا ان الكل دش، وإذا العدد كمل أي شخص يقدر يوهقكم وكلكم بتشوفونها لايف!
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    const shareText = `دش قطية الروليت، واحد فينا راح يدفع العشا ${order?.total.toFixed(3)} د.ك! ادخل: ${window.location.href}`;
                    if (navigator.share) {
                      navigator.share({
                        title: "قطية الروليت 🎯",
                        text: shareText,
                        url: window.location.href,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareText);
                      alert("تم نسخ الرابط!");
                    }
                  }}
                  className="w-full bg-white/10 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mt-4 hover:bg-white/20 transition-colors"
                >
                  <Sparkles className="w-5 h-5 text-fuchsia-400" />
                  دز الرابط للربع وشوف حظهم ووهقهم
                </button>

                {participants.length >= 2 && (
                  <button
                    onClick={spin}
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black py-4 rounded-xl shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-transform mt-4"
                  >
                    اضغط وخل الحظ يختار 🎰
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
            className="flex flex-col items-center justify-center py-10 space-y-8"
          >
            <div className="relative w-72 h-72 border-[12px] border-white/5 rounded-full flex flex-col items-center justify-center bg-black/60 overflow-hidden shadow-[0_0_100px_rgba(217,70,239,0.15)] ring-4 ring-fuchsia-500/20">
              <div className="absolute inset-0 pointer-events-none border-[16px] border-fuchsia-500/10 rounded-full" />
              <div className="absolute top-1/2 left-0 right-0 h-16 -translate-y-1/2 border-y-2 border-fuchsia-400/30 bg-fuchsia-400/5 z-0 pointer-events-none" />
              
              {!isSpinning && spun ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.6 }}
                  className="z-10 text-4xl font-black text-fuchsia-400 drop-shadow-[0_0_15px_rgba(217,70,239,0.8)]"
                >
                  {participants[loserIndex]?.name}
                </motion.div>
              ) : (
                <div 
                  className="flex flex-col items-center justify-start w-full z-10 absolute top-0"
                  style={{
                    transform: `translateY(calc(112px - ${displayIndex * 64}px))`,
                    transition: isSpinning ? 'transform 0.08s linear' : 'none'
                  }}
                >
                  {/* Duplicate participants to make it look like an endless wheel during fast spin */}
                  {Array(30).fill(participants).flat().map((p: any, i: number) => (
                    <div key={i} className="h-16 flex items-center justify-center w-full shrink-0">
                       <span className={
                         "font-black transition-all " +
                         (isSpinning ? "text-fuchsia-300 text-3xl blur-[1px]" : "text-fuchsia-400 text-4xl")
                       }>
                         {p.name}
                       </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isSpinning && spun && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center space-y-6 w-full"
              >
                {loser === mySpinName ? (
                  <div className="p-6 bg-red-500/20 border border-red-500/50 rounded-3xl text-red-100 space-y-4">
                    {paymentStatus === "failed" && (
                      <div className="bg-red-600 border border-red-400 p-4 rounded-xl text-white font-black animate-bounce shadow-[0_0_15px_rgba(220,38,38,0.5)] flex flex-col gap-2">
                        <span>فشلت العملية يا {urlName || mySpinName} 💔</span>
                        <span className="text-sm font-bold opacity-90">{errorMsg}</span>
                      </div>
                    )}
                    <h2 className="text-2xl font-black">{loserContent.title}</h2>
                    <p className="font-bold">
                      {loserContent.desc}
                    </p>
                    <button
                      onClick={() =>
                        handlePay(
                          mySpinName,
                          mySpinPhone || order.customerPhone || "00000000",
                          String(order.total),
                        )
                      }
                      className="w-full bg-white text-red-600 font-black py-4 rounded-xl mt-4 active:scale-95 transition-transform flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                      <CreditCard className="w-5 h-5" />
                      ادفع {order.total.toFixed(3)} د.ك
                    </button>
                  </div>
                ) : (
                  <div className="p-6 bg-green-500/20 border border-green-500/50 rounded-3xl text-green-100 space-y-4">
                    <PartyPopper className="w-10 h-10 mx-auto text-green-400" />
                    <h2 className="text-2xl font-black">{winnerContent.title}</h2>
                    <p className="font-bold">
                      {winnerContent.desc(loser)}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
