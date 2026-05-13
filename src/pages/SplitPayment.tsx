import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Copy,
  Check,
  ArrowRight,
  Users,
  Share2,
  Sparkles,
  AlertCircle,
  CreditCard,
  PieChart,
  Coins,
  PartyPopper,
  Zap,
  MessageSquare,
} from "lucide-react";
import { Order } from "../types";
import { normalizePhone, normalizeDigits } from "../utils";
import confetti from "canvas-confetti";
import { doc, onSnapshot } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { RouletteSplit } from "../components/RouletteSplit";

// Initialize Firebase for real-time listener
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default function SplitPayment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentStatus = searchParams.get("payment");
  const rawUrlName = searchParams.get("name");
  const urlName = rawUrlName ? rawUrlName.split('?')[0].split('&')[0] : "";

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevPaidCountRef = useRef(0);

  const [contributorName, setContributorName] = useState(() => localStorage.getItem("split_name") || "");
  const [contributorPhone, setContributorPhone] = useState(() => localStorage.getItem("split_phone") || "");
  const [contributorAmount, setContributorAmount] = useState<string>(() => localStorage.getItem("split_amount") || "");
  const isDev =
    searchParams.get("dev") === "true" || searchParams.get("2dev") === "true";

  const errorMsg = useMemo(() => {
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

  const celebrationTriggered = useRef(false);

  useEffect(() => {
    console.log("SplitPayment mounted with ID:", id);
    if (!id) return;

    // Real-time listener via Firestore
    const unsub = onSnapshot(
      doc(db, "appData", "shared_company_data"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const orders = data.orders || [];
          const foundOrder = orders.find((o: any) => o.id === id);
          if (foundOrder) {
            setOrder(foundOrder);
            setError(null);

            // Count paid contributors
            const paidCount = (foundOrder.splitPayments || []).filter(
              (p: any) => p.status === "paid",
            ).length;

            // Trigger effect if a new person paid
            if (
              paidCount > prevPaidCountRef.current &&
              prevPaidCountRef.current !== 0
            ) {
              triggerFeedback();
            }
            prevPaidCountRef.current = paidCount;

            // Check if fully paid
            const totalPaid = (foundOrder.splitPayments || [])
              .filter((p: any) => p.status === "paid")
              .reduce(
                (sum: number, p: any) => sum + (Number(p.amount) || 0),
                0,
              );

            const isFinished = foundOrder.total - totalPaid <= 0.005;
            if (isFinished && !celebrationTriggered.current) {
              celebrationTriggered.current = true;
              triggerConfetti();
            }
          } else {
            setError("الطلب غير موجود");
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error("SplitPayment Firestore Error:", err);
        // Fallback to fetch if snapshot fails
        fetchOrder();
      },
    );

    return () => unsub();
  }, [id]);

  const triggerFeedback = () => {
    // Haptic feedback
    if ("vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

    // Water drop sound "بْلِب 💧" via Web Audio API
    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          800,
          audioCtx.currentTime + 0.1,
        );

        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioCtx.currentTime + 0.1,
        );

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      }
    } catch (err) {
      console.log("Audio feedback not supported or blocked");
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FFD700", "#FFA500", "#FF4500", "#008000", "#0000FF"],
    });

    // Repeat for grand effect
    setTimeout(() => {
      confetti({
        particleCount: 100,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 100,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    }, 500);
  };

  const fetchOrder = async (isSilent = false) => {
    if (!id) return;
    try {
      const res = await fetch(
        `/api/track-orders?order_id=${encodeURIComponent(id)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setOrder(data[0]);
          setError(null);
        }
      }
    } catch (e) {
      console.error("SplitPayment: Fetch Exception", e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const shareText = `عشانا اليوم من مطبخ التراث! الفاتورة ${order?.total.toFixed(3)} د.ك.. ادخل ادفع قطيتك: ${window.location.href}`;

    if (navigator.share) {
      navigator
        .share({
          title: "قطية مطبخ التراث",
          text: shareText,
          url: window.location.href,
        })
        .catch(() => {
          navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const calculatePaid = () => {
    if (!order || !order.splitPayments) return 0;
    return order.splitPayments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  const handlePay = async (
    overrideName?: string | React.MouseEvent,
    overridePhone?: string,
    overrideAmount?: string,
  ) => {
    const isEvent = typeof overrideName === "object" && overrideName !== null;
    const actualName = isEvent ? undefined : (overrideName as string);
    
    const amountVal = String(overrideAmount ?? contributorAmount ?? "").trim();
    const finalName = String(actualName ?? contributorName ?? "").trim();
    const finalPhone = String(overridePhone ?? contributorPhone ?? "").trim();

    if (!finalName) {
      alert("يرجى إدخال الاسم");
      return;
    }
    if (!finalPhone) {
      alert("يرجى إدخال رقم الهاتف");
      return;
    }
    if (finalPhone.length < 8) {
      alert("رقم الهاتف غير صالح");
      return;
    }
    if (!amountVal || isNaN(Number(amountVal)) || Number(amountVal) <= 0) {
      alert("المبلغ غير صالح للقطيّة");
      return;
    }
    if (!order) return;

    const paid = calculatePaid();
    const remaining = order.total - paid;
    const amountNum = Number(amountVal);

    if (amountNum > Number(remaining.toFixed(3)) + 0.005) {
      alert(`المبلغ المدخل يتجاوز المتبقي (${remaining.toFixed(3)} د.ك)`);
      return;
    }

    localStorage.setItem("split_name", finalName);
    localStorage.setItem("split_phone", finalPhone);
    localStorage.setItem("split_amount", amountVal);

    setIsSubmitting(true);
    console.log("[DEBUG] Submitting payment. Order object:", order);
    try {
      const res = await fetch("/api/create-split-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          name: finalName,
          amount: amountNum,
          customerMobile: String(finalPhone || order.customerPhone || ""),
        }),
      });
      console.log("[DEBUG] Fetch response status:", res.status);
      console.log(
        "[DEBUG] Fetch response content-type:",
        res.headers.get("content-type"),
      );

      const contentType = res.headers.get("content-type");
      let data;

      const resText = await res.text();
      console.log("[DEBUG] Raw response text:", resText);

      if (contentType && contentType.includes("application/json")) {
        data = JSON.parse(resText);
      } else {
        console.error("SplitPayment: Non-JSON response", resText);
        throw new Error(
          `تعذر معالجة استجابة الخادم (${res.status}) - ${resText.substring(0, 50)}`,
        );
      }

      if (res.ok && data.paymentLink) {
        window.location.href = data.paymentLink;
      } else {
        alert(data.error || "فشل في إنشاء رابط الدفع - يرجى المحاولة مرة أخرى");
        setIsSubmitting(false);
      }
    } catch (e: any) {
      console.error("SplitPayment handlePay error:", e);
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
        alert("فشل في الاتصال بالخادم: " + (e.message || "حدث خطأ غير متوقع"));
      }
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-4">
        <span className="animate-spin text-4xl">⏳</span>
        <p className="text-stone-500 font-bold">جاري تحميل صفحة القطية...</p>
        <p className="text-stone-400 text-xs">رقم الطلب: {id || "غير متوفر"}</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6 flex-col text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">عذراً</h1>
        <p className="text-stone-500">{error || "تعذر تحميل الطلب"}</p>
      </div>
    );
  }

  const paidAmount = calculatePaid();
  const remainingAmount = Math.max(0, order.total - paidAmount);
  let progressPercent = 0;
  if (order.total > 0) {
    progressPercent = Math.min(100, (paidAmount / order.total) * 100);
  }
  if (isNaN(progressPercent)) progressPercent = 0;

  const isFullyPaid =
    remainingAmount <= 0.001 ||
    (order.status &&
      (order.status.startsWith("تم الدفع") ||
        order.status.includes("بانتظار التحضير"))) ||
    order.paymentStatus === "paid";

  if ((order as any).splitType === "roulette") {
    return <RouletteSplit order={order} handlePay={handlePay} paymentStatus={paymentStatus} urlName={urlName} />;
  }

  return (
    <div
      className="min-h-screen bg-stone-50 pb-24 font-sans text-stone-800 selection:bg-brand/20"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-white border-b border-stone-100 p-6 sticky top-0 z-20 shadow-sm flex flex-col items-center justify-center gap-2 relative">
        <button 
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
          className="absolute left-4 top-4 p-2 text-stone-400 hover:text-brand"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <PieChart className="w-8 h-8 text-brand" />
        <h1 className="font-black text-xl tracking-tight text-center">
          قطيّة الربع 🤝
        </h1>
        <p className="text-xs text-stone-400 font-medium tracking-wide">
          طلب من {order.customerName}
        </p>

        {typeof order.address === "object" && order.address !== null && (
          <div className="text-[10px] text-stone-500 bg-stone-100 px-3 py-1 mt-2 rounded-full font-bold">
            📍 {order.address.region}, ق {order.address.block}, ش{" "}
            {order.address.street}, م {order.address.building}
          </div>
        )}
        {typeof order.address === "string" && (
          <div className="text-[10px] text-stone-500 bg-stone-100 px-3 py-1 mt-2 rounded-full font-bold">
            📍 {order.address}
          </div>
        )}
      </header>

      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6">
        <AnimatePresence>
          {paymentStatus === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white p-8 justify-center items-center rounded-[32px] flex flex-col gap-4 shadow-xl shadow-[#25D366]/20 border border-white/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-12 -mb-12" />
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner relative z-10">
                <Check className="w-8 h-8 text-[#25D366]" strokeWidth={3} />
              </div>
              <div className="text-center relative z-10">
                <h3 className="text-2xl font-black mb-1">تسلم الأيادي{urlName ? ` يا ${urlName}` : ""}!</h3>
                <p className="text-white/90 font-medium">وصل الدفع وتم تسجيل قطيتك بنجاح</p>
              </div>
            </motion.div>
          )}

          {paymentStatus === "failed" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-red-500 to-rose-600 text-white p-8 justify-center items-center rounded-[32px] flex flex-col gap-4 shadow-xl shadow-red-500/20 border border-white/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner relative z-10">
                <AlertCircle className="w-8 h-8 text-red-500" strokeWidth={3} />
              </div>
              <div className="text-center relative z-10 w-full">
                <h3 className="text-2xl font-black mb-1">فشلت العملية{urlName ? ` يا ${urlName}` : ""} 💔</h3>
                <p className="text-white/90 font-medium mb-4">{errorMsg}</p>
                <button 
                  onClick={() => {
                    handlePay();
                  }}
                  disabled={isSubmitting}
                  className="bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white w-full py-3 rounded-xl font-bold transition-colors border border-white/30"
                >
                  {isSubmitting ? "جاري التحويل..." : "جرب مرة ثانية 🔄"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white p-6 rounded-[24px] shadow-sm border border-stone-100 flex flex-col items-center">
          <span className="text-stone-400 font-bold text-sm mb-2 uppercase tracking-widest">
            إجمالي الفاتورة
          </span>
          <span className="text-4xl font-black text-brand italic tracking-tight">
            {order.total.toFixed(3)}{" "}
            <span className="text-base text-accent">د.ك</span>
          </span>
          <div className="w-full mt-8">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-brand">
                المندفع: {paidAmount.toFixed(3)} د.ك
              </span>
              <span className="text-stone-400">
                الباقي: {remainingAmount.toFixed(3)} د.ك
              </span>
            </div>
            <div className="h-4 bg-stone-100 rounded-full overflow-hidden shrink-0 w-full flex">
              <motion.div
                className="h-full bg-brand"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {isFullyPaid ? (
          <div className="bg-green-500 text-white p-8 rounded-[24px] shadow-lg shadow-green-500/20 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black mb-1">
                كفو يا الربع! اكتملت القطة..
              </h2>
              <p className="font-medium text-green-100 text-sm mt-2">
                الطلب الحين بالمطبخ وقاعد يتجهز 🚀
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-stone-100">
              <h3 className="font-black text-brand mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-accent" />
                قطيتك
              </h3>
              {!paymentStatus && (
                <div className="bg-brand/5 border border-brand/10 p-3 rounded-xl text-brand font-bold text-sm mb-4">
                  {urlName ? `ترا ناطرين تحويلك يا ${urlName} 💸😎` : "اذا ما دفعت قطيتك، ادفعها الحين ولا تصير البخيل باللمة! 💸😂"}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-500 mb-1 block">
                    اسمك الكريم
                  </label>
                  <input
                    type="text"
                    value={contributorName}
                    onChange={(e) => setContributorName(e.target.value)}
                    placeholder="مثال: محمد"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-500 mb-1 block">
                    رقم تلفونك *
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={contributorPhone}
                    onChange={(e) =>
                      setContributorPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))
                    }
                    placeholder="90000000"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-500 mb-1 block">
                    قطيتك (د.ك) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={contributorAmount}
                    onChange={(e) => {
                      const val = normalizeDigits(e.target.value).replace(
                        /[^0-9.]/g,
                        "",
                      );
                      setContributorAmount(val === "" ? "" : val);
                    }}
                    placeholder="مثال: 5.000"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 font-bold text-xl text-center focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-stone-100 rounded-xl px-2 py-1 flex flex-col items-center justify-center border border-stone-200/50">
                    <span className="text-[9px] font-bold text-stone-400 mb-0.5">
                      قسمة على كم؟
                    </span>
                    <div className="flex gap-1">
                      {[2, 3, 4].map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            const val = (remainingAmount / n).toFixed(3);
                            setContributorAmount(val);
                          }}
                          className="w-6 h-6 rounded bg-brand/10 text-brand text-[10px] font-black hover:bg-brand hover:text-white transition-all border border-brand/20"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setContributorAmount(remainingAmount.toFixed(3))
                    }
                    className="bg-stone-100 text-stone-600 font-bold text-[10px] py-2 rounded-xl hover:bg-stone-200 transition-colors flex flex-col items-center justify-center gap-0.5 border border-stone-200/50"
                  >
                    <Zap className="w-3.5 h-3.5 text-accent" />
                    كامل علي تستاهلون
                  </button>
                </div>

                <button
                  onClick={handlePay}
                  disabled={
                    isSubmitting ||
                    !contributorName.trim() ||
                    !contributorAmount
                  }
                  className="w-full bg-brand text-white p-4 rounded-xl font-black disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">جاري التحويل...</span>
                  ) : (
                    <>
                      ادفع قطيتك <Sparkles className="w-4 h-4 text-accent" />
                    </>
                  )}
                </button>

                {isDev && (
                  <button
                    onClick={() => {
                      alert("Simulating payment (this would call the webhook)");
                      // In a real simulation, we'd need a way to hit the webhook endpoint
                    }}
                    className="w-full bg-purple-600 text-white p-3 rounded-xl font-bold mt-2 hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                  >
                    Simulate Payment (Dev Mode)
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              className="w-full bg-white border-2 border-stone-100 text-stone-600 p-4 rounded-[24px] font-bold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-stone-50"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Share2 className="w-5 h-5 text-stone-400" />
              )}
              {copied ? "تم النسخ!" : "انسخ الرابط وقطه في قروبكم"}
            </button>
          </div>
        )}

        {(order.splitPayments || []).filter((p) => p.status === "paid").length >
          0 && (
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-stone-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-full -mr-12 -mt-12 blur-2xl" />
            <h3 className="font-black text-stone-400 text-sm mb-4 uppercase tracking-widest flex items-center gap-2 relative z-10">
              <Users className="w-4 h-4 text-brand" />
              حائط الشرف (Live 🔥)
            </h3>
            <div className="space-y-3 relative z-10">
              <AnimatePresence initial={false}>
                {order
                  .splitPayments!.filter((p) => p.status === "paid")
                  .reverse()
                  .map((p, i) => {
                    // Dynamic gamification text
                    const phrases = [
                      "كفو! 🔥",
                      "سدّاد! 💸",
                      "بطل! 👑",
                      "زقرت! 🎯",
                    ];
                    const phrase =
                      p.amount >= Math.max(order.total / 2, 10)
                        ? "راعيها! 🤩"
                        : phrases[(p.name.length + i) % phrases.length];

                    return (
                      <motion.div
                        key={p.id || i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        layout
                        className="flex items-center justify-between p-3 rounded-xl bg-stone-50/80 border border-stone-100 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand/80 flex items-center justify-center text-white font-black text-xs shadow-sm">
                            {p.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-stone-800">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded font-bold">
                                {phrase}
                              </span>
                            </div>
                            {p.phone && (
                              <span className="text-[10px] text-stone-400 font-mono">
                                {p.phone.slice(0, 3)}****{p.phone.slice(-3)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-brand block">
                            {p.amount.toFixed(3)}{" "}
                            <span className="text-[10px] text-stone-400">
                              د.ك
                            </span>
                          </span>
                          <span className="text-[8px] text-stone-400 font-bold uppercase">
                            {p.date
                              ? new Date(p.date).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "الآن"}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
