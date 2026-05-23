import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, CreditCard, PartyPopper, Send, Sparkles, Users } from "lucide-react";
import { normalizeDigits } from "../utils";
import { DallahPhysicalGame } from "./DallahPhysicalGame";

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

const cleanPhone = (value: string) => normalizeDigits(value).replace(/[^0-9]/g, "").slice(0, 8);

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
  const [localParticipants, setLocalParticipants] = useState<any[]>(() => order.splitParticipants || []);
  const [localRouletteLoser, setLocalRouletteLoser] = useState<string | null>(() => order.rouletteLoser || null);
  const participants = localParticipants;
  const spun = !!localRouletteLoser;
  const loser = localRouletteLoser;
  const [isSpinning, setIsSpinning] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);
  const [mySpinName, setMySpinName] = useState(() => localStorage.getItem(`roulette_${order.id}`) || "");
  const [mySpinPhone, setMySpinPhone] = useState(() => localStorage.getItem(`roulette_phone_${order.id}`) || "");
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    setLocalParticipants(order.splitParticipants || []);
    if (order.rouletteLoser) setLocalRouletteLoser(order.rouletteLoser);
  }, [order.id, order.splitParticipants, order.rouletteLoser]);

  useEffect(() => {
    if (paymentStatus === "success") setLocalSuccess(true);
  }, [paymentStatus]);

  const errorMsg = useMemo(() => {
    const errorMsgs = [
      "ما انخصم شيء من حسابك. جرّب مرة ثانية بعد لحظات.",
      "تعذر إتمام عملية الدفع. تأكد من البطاقة أو الشبكة وحاول مرة ثانية.",
      "البنك رفض العملية مؤقتًا. حاول مرة أخرى.",
      "يبدو أن الاتصال تأخر. أعد المحاولة وسيتم التحقق من الدفع بأمان.",
    ];
    return errorMsgs[Math.floor(Math.random() * errorMsgs.length)];
  }, []);

  const join = async () => {
    const cleanName = name.trim();
    const clean = cleanPhone(phone);
    setJoinError("");

    if (!cleanName) {
      setJoinError("اكتب اسمك أولًا حتى تدخل اختيار الدلة.");
      return;
    }
    if (clean.length !== 8) {
      setJoinError("رقم الهاتف لازم يكون 8 أرقام بالإنجليزي.");
      return;
    }

    try {
      const res = await fetch(`/api/orders/${order.id}/join-roulette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, phone: clean }),
      });
      if (!res.ok) throw new Error("تعذر تسجيل الاسم في اختيار الدلة");
      setMySpinName(cleanName);
      setMySpinPhone(clean);
      setLocalParticipants((prev) => {
        const exists = prev.some((p: any) => p.name === cleanName || (clean && p.phone === clean));
        return exists ? prev : [...prev, { name: cleanName, phone: clean, joinedAt: new Date().toISOString() }];
      });
      localStorage.setItem(`roulette_${order.id}`, cleanName);
      localStorage.setItem(`roulette_phone_${order.id}`, clean);
    } catch (e: any) {
      if (e?.message?.includes("Load failed") || e?.message?.includes("Failed to fetch")) {
        setJoinError("فشل الاتصال بالخادم. انتظر لحظات ثم حاول مرة أخرى.");
      } else {
        setJoinError(e?.message || "حدث خطأ غير متوقع أثناء الانضمام.");
      }
    }
  };

  const spin = async () => {
    if (participants.length < 2) {
      throw new Error("نحتاج شخصين على الأقل حتى تبدأ الدلة.");
    }
    const res = await fetch(`/api/orders/${order.id}/spin-roulette`, { method: "POST" });
    if (!res.ok) throw new Error("تعذر تشغيل الاختيار");
    const data = await res.json().catch(() => null);
    if (data?.loser) setLocalRouletteLoser(data.loser);
    return data;
  };

  const loserIndex = useMemo(() => {
    if (!loser || participants.length === 0) return 0;
    const normalizedLoser = normalizeArabicName(loser);
    const idx = participants.findIndex((p: any) => normalizeArabicName(p.name) === normalizedLoser);
    return idx === -1 ? 0 : idx;
  }, [loser, participants]);

  const totalPaid = getSafeSplitPayments(order)
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const isFullyPaid =
    localSuccess ||
    order.total - totalPaid <= 0.005 ||
    order.paymentStatus === "paid" ||
    order.status?.startsWith("تم الدفع");

  const payPhrases = [
    { title: "الدلة اختارتك يا {name} 👑", desc: "اليوم أنت كريم الربع. أكمل الدفع وخلي العزيمة على سنع." },
    { title: "كفو يا {name}، الدلة وقفت عندك ☕", desc: "اختيار الدلة لك اليوم. ادفع الطلب والباقي دعوات الربع لك." },
    { title: "يا مرحبا بالكريم {name} ✨", desc: "الاختيار طلع باسمك. كمل الدفع وخل الديوانية تستانس." },
    { title: "الدلة قالتها: {name} اليوم معزب", desc: "الطلب عليك اليوم بروح حلوة، والربع ما ينسون الكرم." },
  ];

  const savedPhrases = [
    { title: "الدلة عدّت عليك يا {name} 😄", desc: "الاختيار وقف عند {loser}. استمتع بالطلب وخل الدعاء للكريم." },
    { title: "مرّت بسلام يا {name} ✨", desc: "اليوم الكرم على {loser}. بالعافية عليكم جميعًا." },
    { title: "الدلة اختارت غيرك يا {name}", desc: "الاختيار وقف عند {loser}. تابعوا الطلب واستمتعوا بالجمعة." },
    { title: "حظك طيب يا {name} ☕", desc: "الكريم اليوم هو {loser}. الله يزيده من فضله." },
  ];

  const getPhraseContent = (myName: string, isPaying: boolean, loserName: string) => {
    const list = isPaying ? payPhrases : savedPhrases;
    let hash = 0;
    const key = loserName || "الكريم";
    for (let i = 0; i < key.length; i++) hash += key.charCodeAt(i) * (i + 1);
    const phrase = list[hash % list.length];
    return {
      title: phrase.title.replace(/{name}/g, myName),
      desc: phrase.desc.replace(/{name}/g, myName).replace(/{loser}/g, key),
    };
  };

  const shareGame = () => {
    const shareText = `الدلة تختار الكريم للطلب ${Number(order?.total || 0).toFixed(3)} د.ك. ادخل وشارك: ${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: "الدلة تختار الكريم", text: shareText, url: window.location.href }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(shareText);
      alert("تم نسخ الرابط");
    }
  };

  if (isFullyPaid) {
    return (
      <div className="min-h-screen bg-stone-950 text-white font-sans flex items-center justify-center p-6 text-center" dir="rtl">
        {paymentStatus === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white p-8 rounded-[32px] flex flex-col gap-4 shadow-xl shadow-[#25D366]/20 border border-white/20 max-w-md w-full"
          >
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Check className="w-8 h-8 text-[#25D366]" strokeWidth={3} />
            </div>
            <h3 className="text-2xl font-extrabold">كفو يا {urlName || loser || "الكريم"}</h3>
            <p className="text-white/90 font-medium leading-relaxed">
              تم الدفع بنجاح، والطلب قاعد يتجهز لكم.
            </p>
          </motion.div>
        ) : (
          <div className="bg-green-500/20 border border-green-500/50 rounded-3xl p-8 max-w-md w-full space-y-4">
            <PartyPopper className="w-16 h-16 mx-auto text-green-400" />
            <h2 className="text-3xl font-black text-green-400">تم الدفع بالكامل</h2>
            <p className="font-bold text-green-100">
              تم دفع الفاتورة بواسطة <span className="text-white bg-black/30 px-2 py-1 rounded-md">{loser || "الكريم"}</span>
            </p>
            <button
              onClick={() => navigate(`/track?order_id=${order.id}`)}
              className="mt-6 bg-white text-green-700 font-black py-4 px-6 rounded-xl w-full active:scale-95 transition-transform"
            >
              متابعة الطلب
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen wahag-dallah-page text-white font-sans selection:bg-amber-300/25" dir="rtl">
      <div className="max-w-md lg:max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-32 relative">
        <button
          onClick={() => navigate("/?checkout=payment")}
          className="payment-back-floating wahag-back-to-payment"
          aria-label="الرجوع إلى طريقة الدفع"
        >
          <ArrowRight className="w-6 h-6" />
          <span>طريقة الدفع</span>
        </button>

        <header className="text-center pt-10 space-y-4">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-4 py-2 text-xs font-black text-amber-100">
            <Sparkles className="w-4 h-4" />
            وهق ربعك بنسخة الدلة
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600">
              الدلة تختار الكريم
            </h1>
            <p className="text-stone-300 font-bold leading-relaxed max-w-xl mx-auto">
              تجربة ديوانية أنيقة لاختيار من يتكفل بطلب اليوم. الإجمالي {Number(order.total || 0).toFixed(3)} د.ك
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/10 bg-white/5 p-2 text-xs font-black text-stone-300">
            <span className="rounded-2xl bg-black/25 py-2">{participants.length} مشارك</span>
            <span className="rounded-2xl bg-black/25 py-2">{spun ? "تم الاختيار" : "بانتظار الربع"}</span>
            <span className="rounded-2xl bg-black/25 py-2">{Number(order.total || 0).toFixed(3)} د.ك</span>
          </div>
        </header>

        {!mySpinName && !spun ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[34px] border border-amber-200/15 bg-white/[0.06] p-5 sm:p-6 space-y-5 shadow-2xl shadow-black/30"
          >
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-200/10 border border-amber-200/20">
                <Users className="w-7 h-7 text-amber-200" />
              </div>
              <h2 className="text-xl font-black text-white">ادخل اختيار الدلة</h2>
              <p className="text-sm font-bold text-stone-400 leading-relaxed">
                اكتب اسمك ورقمك حتى تشارك مع الربع في الاختيار.
              </p>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم"
              className="w-full bg-white text-slate-950 border border-white/20 rounded-2xl px-4 py-3.5 text-center font-bold focus:outline-none focus:ring-4 focus:ring-amber-400/20"
            />
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={phone}
              onChange={(e) => setPhone(cleanPhone(e.target.value))}
              placeholder="رقم الهاتف 8 أرقام"
              className="w-full bg-white text-slate-950 border border-white/20 rounded-2xl px-4 py-3.5 text-center font-bold focus:outline-none focus:ring-4 focus:ring-amber-400/20"
              dir="ltr"
              maxLength={8}
            />

            {joinError && (
              <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                {joinError}
              </div>
            )}

            <button
              onClick={join}
              className="w-full bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 text-stone-950 font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-[0_18px_45px_rgba(217,119,6,0.18)]"
            >
              <CreditCard className="w-5 h-5" />
              دخول الاختيار
            </button>
          </motion.div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.055] p-4 flex items-center justify-between gap-3">
              <div className="text-right">
                <p className="text-xs font-bold text-stone-400">أنت داخل باسم</p>
                <p className="text-lg font-black text-amber-100">{mySpinName || urlName || "ضيف"}</p>
              </div>
              <button
                type="button"
                onClick={shareGame}
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white flex items-center gap-2 active:scale-95 transition-transform border border-white/10"
              >
                <Send className="w-4 h-4 text-amber-200" />
                دز الرابط
              </button>
            </div>

            <DallahPhysicalGame
              order={order}
              participants={participants}
              loser={loser}
              loserIndex={loserIndex}
              spun={spun}
              isSpinning={isSpinning}
              setIsSpinning={setIsSpinning}
              spin={spin}
              paymentStatus={paymentStatus}
              urlName={urlName}
              mySpinName={mySpinName}
              mySpinPhone={mySpinPhone}
              handlePay={handlePay}
              errorMsg={errorMsg}
              getPhraseContent={getPhraseContent}
              normalizeArabicName={normalizeArabicName}
            />
          </div>
        )}
      </div>
    </div>
  );
}
