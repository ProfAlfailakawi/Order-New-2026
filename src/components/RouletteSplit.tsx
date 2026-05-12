import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Users, Crown, CreditCard, PartyPopper } from "lucide-react";

export function RouletteSplit({
  order,
  handlePay,
}: {
  order: any;
  handlePay: (name: string, phone: string, amount: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const participants = order.splitParticipants || [];
  const spun = !!order.rouletteLoser;
  const loser = order.rouletteLoser;
  const [isSpinning, setIsSpinning] = useState(false);
  const [mySpinName, setMySpinName] = useState(
    () => localStorage.getItem(`roulette_${order.id}`) || "",
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const join = async () => {
    if (!name.trim()) return;
    if (phone.length < 8) return alert("رقم الهاتف يجب أن يتكون من 8 أرقام على الأقل");
    try {
      await fetch(`/api/orders/${order.id}/join-roulette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      setMySpinName(name);
      localStorage.setItem(`roulette_${order.id}`, name);
    } catch (e) {}
  };

  const spin = async () => {
    if (participants.length < 2) return alert("نحتاج شخصين عالأقل للقطية!");
    try {
      await fetch(`/api/orders/${order.id}/spin-roulette`, { method: "POST" });
    } catch (e) {}
  };

  useEffect(() => {
    if (spun && !isSpinning && participants.length > 0) {
      if (!sessionStorage.getItem(`spun_${order.id}`)) {
        setIsSpinning(true);
        let count = 0;
        const interval = setInterval(() => {
          setActiveIndex((prev) => (prev + 1) % participants.length);
          count++;
          if (count > 30) {
            clearInterval(interval);
            setIsSpinning(false);
            sessionStorage.setItem(`spun_${order.id}`, "true");
          }
        }, 100);
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
            انتهت اللعبة! 🎯
          </h2>
          <p className="font-bold text-green-100">
            تم دفع الفاتورة بالكامل عن طريق{" "}
            <span className="text-white bg-black/30 px-2 py-1 rounded-md">
              {loser || "صاحب الحظ"}
            </span>
          </p>
          <p className="text-sm text-green-200 mt-4">
            الطلب قاعد يتجهز وبطريجه لكم 🚀
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-stone-900 text-white font-sans selection:bg-fuchsia-500/30"
      dir="rtl"
    >
      <div className="max-w-md mx-auto p-6 space-y-8 pb-32">
        <header className="text-center pt-8 space-y-4">
          <div className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(217,70,239,0.3)]">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-violet-400">
              عجلة الحظ
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
                  أضف اسمك عشان تدش السحب
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="رقم الهاتف (مثال: 99xxxxxx)"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-center font-bold focus:outline-none focus:border-fuchsia-500"
                  dir="ltr"
                />
                <button
                  onClick={join}
                  className="w-full bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Users className="w-5 h-5" />
                  دش اللوبي
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
                      💡 تأكدوا ان الكل دش، وإذا العدد كمل أي شخص يقدر يقرّع وكلكم بتشوفونها لايف!
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
                  انسخ رابط الدعوة ودزه للربع
                </button>

                {participants.length >= 2 && (
                  <button
                    onClick={spin}
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black py-4 rounded-xl shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-transform mt-4"
                  >
                    قرّعهم يا وحش 🎰
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
            <div className="relative w-64 h-64 border-8 border-white/10 rounded-full flex items-center justify-center bg-black/50 overflow-hidden shadow-[0_0_100px_rgba(217,70,239,0.2)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayIndex}
                  initial={{ opacity: 0, y: 50, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -50, scale: 0.5 }}
                  className="absolute text-3xl font-black text-fuchsia-400"
                >
                  {participants[displayIndex]?.name}
                </motion.div>
              </AnimatePresence>
            </div>

            {!isSpinning && spun && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center space-y-6 w-full"
              >
                {loser === mySpinName ? (
                  <div className="p-6 bg-red-500/20 border border-red-500/50 rounded-3xl text-red-100 space-y-4">
                    <h2 className="text-2xl font-black">حظك غاب اليوم! 😂</h2>
                    <p className="font-bold">
                      الفاتورة كاملة طاحت براسك، ادفع يا وحش!
                    </p>
                    <button
                      onClick={() =>
                        handlePay(
                          mySpinName,
                          order.customerPhone || "00000000",
                          String(order.total),
                        )
                      }
                      className="w-full bg-white text-red-600 font-black py-4 rounded-xl mt-4 active:scale-95 transition-transform flex justify-center items-center gap-2"
                    >
                      <CreditCard className="w-5 h-5" />
                      ادفع {order.total.toFixed(3)} د.ك
                    </button>
                  </div>
                ) : (
                  <div className="p-6 bg-green-500/20 border border-green-500/50 rounded-3xl text-green-100 space-y-4">
                    <PartyPopper className="w-10 h-10 mx-auto text-green-400" />
                    <h2 className="text-2xl font-black">عوافي يا الذيب! 🥳</h2>
                    <p className="font-bold">
                      حبيبك <span className="text-white">{loser}</span> دفع
                      الفاتورة اليوم، اشكره لا تنسى!
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
