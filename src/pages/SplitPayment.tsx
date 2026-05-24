import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { db } from "../lib/firebase";
import { RouletteSplit } from "../components/RouletteSplit";

const getSafeSplitPayments = (order: any): any[] => {
  if (!order) return [];
  const splits = order.splitPayments;
  const participants = order.splitParticipants;
  const source = Array.isArray(splits) && splits.length ? splits : participants;
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (typeof source === "object") return Object.values(source);
  return [];
};

export default function SplitPayment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawUrlName = searchParams.get("name");
  const urlName = rawUrlName ? rawUrlName.split('?')[0].split('&')[0] : "";
  const urlPhone = normalizeDigits(searchParams.get("phone") || "").replace(/[^0-9]/g, "").slice(-8);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);
  const [qatyaTab, setQatyaTab] = useState<"overview" | "payment" | "people">("overview");
  const prevPaidCountRef = useRef(0);

  const [contributorName, setContributorName] = useState(() => localStorage.getItem("split_name") || "");
  const [contributorPhone, setContributorPhone] = useState(() => urlPhone || localStorage.getItem("split_phone") || "");
  const [contributorAmount, setContributorAmount] = useState<string>(() => localStorage.getItem("split_amount") || "");
  const isDev =
    searchParams.get("dev") === "true" || searchParams.get("2dev") === "true";

  // Calculate generic paid amount
  const calculatePaid = () => {
    return getSafeSplitPayments(order)
      .filter((p: any) => String(p.status || "").toLowerCase() === "paid")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  // Dynamically determine payment status to resist buggy Upayments Apple Pay redirection cancel URLs
  const rawPaymentStatus = searchParams.get("payment");
  const mySplitPhone = (urlPhone || contributorPhone).replace(/\D/g, "").slice(-8);
  const mySplitRecord = getSafeSplitPayments(order).find(
     (s: any) => s.phone && String(s.phone).replace(/\D/g, "").slice(-8) === mySplitPhone
  );
  const isKnownDiwaniyaMember = Boolean(mySplitRecord && mySplitPhone.length === 8);
  
  const isFullyPaid =
    localSuccess ||
    (order && order.total && calculatePaid() >= order.total - 0.005) ||
    (order && order.status && (order.status.startsWith("تم الدفع") || order.status.includes("بانتظار التحضير") || order.status.includes("جاري التوصيل"))) ||
    (order && String(order.paymentStatus || "").toLowerCase() === "paid");
    
  const isMySplitPaid = String(mySplitRecord?.status || "").toLowerCase() === "paid" || localSuccess;
  
  // Real override for the payment status
  const paymentStatus = isMySplitPaid || isFullyPaid ? "success" : rawPaymentStatus;

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
    const tab = searchParams.get("tab");
    if (tab === "payment") setQatyaTab("payment");
  }, [searchParams]);

  useEffect(() => {
    if (!mySplitRecord) return;
    const nextName = String(mySplitRecord.name || "").trim();
    const nextPhone = String(mySplitRecord.phone || "").replace(/\D/g, "").slice(-8);
    if (nextName && nextName !== contributorName) setContributorName(nextName);
    if (nextPhone && nextPhone !== contributorPhone) setContributorPhone(nextPhone);
  }, [mySplitRecord, contributorName, contributorPhone]);

  useEffect(() => {
    if (paymentStatus === "success" && isFullyPaid) {
      setLocalSuccess(true);

      // لا ننقل المستخدم من صفحة القطيّة إلى /track تلقائياً.
      // صفحة القطيّة نفسها تستمع لتحديثات Firestore وتعرض النجاح/الفشل/الانتظار بدون لمس منطق الدفع أو التراك.
      if (searchParams.get("payment")) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("payment");
        setSearchParams(nextParams, { replace: true });
      }
    }
  }, [paymentStatus, isFullyPaid, searchParams, setSearchParams]);

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
          const invoices = data.invoices || [];
          
          let searchId = String(id).trim().toUpperCase();
          if (searchId.startsWith("#")) {
            searchId = searchId.substring(1);
          }
          if (searchId.includes("-S-")) {
            searchId = searchId.split("-S-")[0];
          }

          const foundOrder = orders.find((o: any) => String(o.id).trim().toUpperCase() === searchId) || 
                           invoices.find((o: any) => String(o.id).trim().toUpperCase() === searchId);
          if (foundOrder) {
            setOrder(foundOrder);
            setError(null);

            // Count paid contributors
            const paidCount = getSafeSplitPayments(foundOrder).filter(
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
            const totalPaid = getSafeSplitPayments(foundOrder)
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
            setError(null);
            setTimeout(() => fetchOrder(true).finally(() => setLoading(false)), 650);
            return;
          }
        } else {
            setError(null);
            setTimeout(() => fetchOrder(true).finally(() => setLoading(false)), 650);
            return;
        }
        setLoading(false);
      },
      (err) => {
        console.error('SplitPayment snapshot error:', err);
        fetchOrder(true).finally(() => setLoading(false));
      }
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
        } else {
          if (!order && !isSilent) setError("الطلب غير موجود");
        }
      } else {
         if (!order && !isSilent) setError("الطلب غير موجود");
      }
    } catch (e: any) {
      if (e && e.message && (e.message.includes("Failed to fetch") || e.message.includes("Load failed"))) {
        // ignore silently
      } else {
        console.error("SplitPayment: Fetch Exception", e);
        if (!order) setError("تعذر تحميل الطلب");
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = window.location.href;
    const shareText = `عشانا اليوم من مطبخ التراث! الفاتورة ${order?.total.toFixed(3)} د.ك.. ادخل ادفع قطيتك: ${shareUrl}`;
    const shareData: ShareData = {
      title: "قطية مطبخ التراث",
      text: shareText,
      url: shareUrl,
    };

    try {
      // افتح قائمة المشاركة الأصلية في الجوال حتى تظهر AirDrop / Copy / Share وباقي الخيارات.
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      // إلغاء المستخدم لنافذة المشاركة ليس خطأ؛ لا نغيّر حالة الزر حتى لا يظهر أنه تم النسخ.
      if (error?.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        window.prompt("انسخ رابط القطيّة", shareUrl);
      }
    }
  };

  const handlePay = async (
    overrideName?: string | React.MouseEvent,
    overridePhone?: string,
    overrideAmount?: string,
  ) => {
    const isEvent = typeof overrideName === "object" && overrideName !== null;
    const actualName = isEvent ? undefined : (overrideName as string);
    
    const amountVal = String(overrideAmount ?? contributorAmount ?? "").trim();
    const finalName = String(actualName ?? contributorName ?? mySplitRecord?.name ?? "").trim();
    const finalPhone = String(overridePhone ?? contributorPhone ?? mySplitRecord?.phone ?? "").replace(/\D/g, "").slice(-8);

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
          baseUrl: window.location.origin
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6 flex-col text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">عذراً</h1>
        <p className="text-stone-500">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-4 text-center p-6">
        <span className="animate-spin text-4xl">⏳</span>
        <p className="text-stone-500 font-bold">جاري تجهيز صفحة القطيّة...</p>
      </div>
    );
  }

  const paidAmount = calculatePaid();
  const remainingAmount = Math.max(0, Number(order.total || 0) - paidAmount);
  const isQatyaStillOpen =
    String(order.paymentStatus || "").toLowerCase() === "partial" ||
    order.status === "بانتظار اكتمال القطية" ||
    remainingAmount > 0.001;
  let progressPercent = 0;
  if (order.total > 0) {
    progressPercent = Math.min(100, (paidAmount / order.total) * 100);
  }
  if (isNaN(progressPercent)) progressPercent = 0;

  if ((order as any).splitType === "roulette") {
    return <RouletteSplit order={order} handlePay={handlePay} paymentStatus={paymentStatus} urlName={urlName} />;
  }

  return (
    <div
      className="min-h-screen qatya-ultra-shell qatya-wow-shell pb-24 font-sans text-stone-800 selection:bg-brand/20"
      dir="rtl"
    >
      <button
        type="button"
        onClick={() => navigate("/?checkout=payment")}
        className="payment-back-floating qatya-back-to-payment"
        aria-label="الرجوع إلى طريقة الدفع"
      >
        <ArrowRight className="w-6 h-6" />
        <span>طريقة الدفع</span>
      </button>
      {/* Header */}
      <header className="qatya-ultra-header qatya-wow-header qatya-duplicate-top bg-white border-b border-stone-100 p-5 sm:p-6 sticky top-0 z-20 shadow-sm flex flex-col items-center justify-center gap-2 relative">
        <button 
          onClick={() => navigate("/?checkout=payment")}
          className="absolute left-4 top-4 p-2 text-stone-400 hover:text-brand"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <PieChart className="w-8 h-8 text-brand" />
        <h1 className="font-extrabold text-xl tracking-tight text-center">
          قطيّة الربع
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

      <div className="max-w-md lg:max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <AnimatePresence>
          {paymentStatus === "success" && isQatyaStillOpen && (
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
              <div className="text-center relative z-10 w-full">
                <h3 className="text-2xl font-extrabold mb-1">تسلم الأيادي{urlName ? ` يا ${urlName}` : ""}!</h3>
                <p className="text-white/90 font-medium">وصل الدفع وتم تسجيل الدفعة بنجاح</p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-green-100/90 bg-black/10 py-1.5 px-3 rounded-full w-fit mx-auto font-bold">
                  <span className="animate-spin inline-block">⏳</span> جاري تحديث الطلب...
                </div>
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
                <h3 className="text-2xl font-extrabold mb-1">فشلت العملية{urlName ? ` يا ${urlName}` : ""} 💔</h3>
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

        <div className="qatya-tabs" dir="rtl">
          {[
            ["overview", "نظرة عامة"],
            ["payment", "قطيّتك"],
            ["people", "المشاركون"],
          ].map(([id,label]) => (
            <button key={id} type="button" onClick={() => setQatyaTab(id as any)} className={qatyaTab === id ? "active" : ""}>{label}</button>
          ))}
        </div>

        {qatyaTab === "overview" && <div className="qatya-signature-stage qatya-v14-stage">
          <div className="qatya-hero-card qatya-v14-hero bg-white p-5 sm:p-6 rounded-[28px] shadow-sm border border-stone-100">
            <div className="qatya-v14-topline relative z-10">
              <span className="qatya-v14-live-dot">مباشر</span>
              <span>قطيّة الربع</span>
              <span>{getSafeSplitPayments(order).filter((p) => String(p.status || "").toLowerCase() === "paid").length} مساهم</span>
            </div>

            <div className="qatya-council-mini" dir="rtl">
              <div><strong>مجلس القطيّة</strong><span>اللمة واضحة من أول نظرة</span></div>
              <ol>
                <li>شارك الرابط</li>
                <li>الربع يدفعون</li>
                <li>تابع من دفع</li>
              </ol>
            </div>

            <div className="qatya-v14-main relative z-10">
              <div className="min-w-0">
                <span className="text-stone-400 font-black text-[11px] mb-2 uppercase tracking-[0.2em] block">
                  حالة القطيّة
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-stone-950 tracking-tight leading-tight">
                  شدو حيلكم يا الربع ولا تبخلون علينا
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 font-bold mt-2 leading-relaxed max-w-xl">
                  الصفحة تعرض قطيتكم أول بأول، والباقي واضح. ادفع قطيتك أو انسخ الرابط للربع.
                </p>
                <div className="qatya-v14-quick mt-4">
                  <span>الإجمالي {order.total.toFixed(3)} د.ك</span>
                  <span>المندفع {paidAmount.toFixed(3)} د.ك</span>
                </div>
              </div>

              <div className="qatya-v14-orb" style={{ background: `conic-gradient(#0f5130 ${Math.min(progressPercent, 100)}%, rgba(15,81,48,.10) 0)` }}>
                <div className="qatya-v14-orb-inner">
                  <span>الباقي</span>
                  <strong>{remainingAmount.toFixed(3)}</strong>
                  <small>د.ك</small>
                </div>
              </div>
            </div>

            <div className="qatya-ledger-grid qatya-v14-ledger qatya-wow-ledger mt-6">
              <div className="qatya-ledger-tile is-total">
                <span>إجمالي الفاتورة</span>
                <strong>{order.total.toFixed(3)}</strong>
                <small>د.ك</small>
              </div>
              <div className="qatya-ledger-tile">
                <span>المندفع</span>
                <strong>{paidAmount.toFixed(3)}</strong>
                <small>د.ك</small>
              </div>
              <div className="qatya-ledger-tile is-remaining">
                <span>الباقي</span>
                <strong>{remainingAmount.toFixed(3)}</strong>
                <small>د.ك</small>
              </div>
            </div>

            <div className="w-full mt-6 relative z-10">
              <div className="flex justify-between text-xs font-black mb-2">
                <span className="text-brand">اكتمل {Math.min(progressPercent, 100).toFixed(0)}%</span>
                <span className="text-stone-400">يتحدث تلقائيًا</span>
              </div>
              <div className="qatya-progress-track qatya-v14-progress h-4 bg-stone-100 rounded-full overflow-hidden shrink-0 w-full flex relative">
                <motion.div
                  className="qatya-progress-fill h-full bg-gradient-to-l from-[#25D366] to-[#128C7E]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                {progressPercent >= 100 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="absolute inset-0 bg-white/20 animate-pulse" 
                  />
                )}
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              className="qatya-overview-share w-full mt-5 bg-white border-2 border-stone-100 text-stone-700 p-4 rounded-[24px] font-black shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-stone-50"
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Share2 className="w-5 h-5 text-stone-500" />}
              {copied ? "تم النسخ!" : "انسخ الرابط وقطه في قروبكم"}
            </button>
          </div>
        </div>}

        {qatyaTab === "people" && (
          <div className="qatya-pay-card bg-white p-5 sm:p-6 rounded-[24px] shadow-sm border border-stone-100 space-y-3">
            <h3 className="font-black text-brand text-lg">المشاركون</h3>
            {getSafeSplitPayments(order).length ? getSafeSplitPayments(order).map((person:any, idx:number) => (
              <div key={idx} className="flex items-center justify-between rounded-2xl bg-stone-50 border border-stone-100 p-3">
                <span className="font-bold text-stone-700">{person.name || person.phone || `مشارك ${idx+1}`}</span>
                <strong className={String(person.status || '').toLowerCase() === 'paid' ? 'text-emerald-700' : 'text-stone-400'}>{String(person.status || '').toLowerCase() === 'paid' ? 'دفع' : 'بانتظار'}</strong>
              </div>
            )) : <p className="text-sm font-bold text-stone-400">الربع يظهرون هنا تلقائياً إذا كانت القطيّة من الديوانية.</p>}
          </div>
        )}

        {isFullyPaid ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
            className="relative bg-gradient-to-br from-[#25D366] via-emerald-500 to-[#128C7E] text-white p-8 mt-6 rounded-[32px] shadow-2xl overflow-hidden text-center flex flex-col items-center gap-6"
          >
            {/* Animated background elements */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -top-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-32 -right-32 w-64 h-64 bg-black/10 rounded-full blur-3xl"
            />
            
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: [0, 1.2, 1], rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="relative z-10 w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-4 border-white/30 shadow-inner"
            >
              <PartyPopper className="w-12 h-12 text-white drop-shadow-lg" />
            </motion.div>

            <div className="relative z-10 space-y-3">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-black tracking-tight drop-shadow-md"
              >
                كفو يا الربع! 👑
              </motion.h2>
              {paymentStatus === "success" && !isQatyaStillOpen && urlName && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="bg-black/10 text-white/90 text-sm font-bold px-4 py-1.5 rounded-full inline-block mb-2"
                >
                  تم تسجيل دفعة {urlName} 🙌
                </motion.p>
              )}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-emerald-50 text-base font-bold px-2 leading-relaxed"
              >
                القطة اكتملت والطلب الحين بالمطبخ وقاعد يتجهز على نار هادية 🚀🔥
              </motion.p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={() => navigate(`/track?order_id=${id}`)}
              className="relative z-10 mt-2 bg-white text-emerald-600 shadow-xl shadow-black/10 font-black text-lg py-4 px-8 rounded-2xl w-full transition-all border-b-4 border-emerald-100 hover:border-emerald-200"
            >
              👀 تابع طلبك من هني
            </motion.button>
          </motion.div>
        ) : localSuccess ? (
          <div className="bg-green-500 text-white p-8 rounded-[24px] shadow-md shadow-green-500/20 text-center flex flex-col items-center gap-4 mt-4">
             <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
             </div>
             <h2 className="text-xl font-extrabold mb-1">تمت المساهمة بنجاح!</h2>
             <p className="font-medium text-green-100 text-sm mt-2">يعطيك العافية، جاري تحويلك في ثواني...</p>
          </div>
        ) : qatyaTab === "payment" ? (
          <div className="qatya-action-grid qatya-v14-action-grid qatya-wow-action-grid space-y-4">
            <div className="qatya-pay-card qatya-v14-pay-card bg-white p-5 sm:p-6 rounded-[24px] shadow-sm border border-stone-100">
              <div className="qatya-form-heading mb-5">
                <div className="qatya-form-icon"><CreditCard className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black text-brand leading-tight">قطيتك</h3>
                  <p className="text-[11px] text-stone-400 font-bold mt-1">بيانات بسيطة وتحويل مباشر</p>
                </div>
              </div>
              {!paymentStatus && (
                <div className="bg-brand/5 border border-brand/10 p-3 rounded-xl text-brand font-bold text-sm mb-4">
                  {isKnownDiwaniyaMember
                    ? `حياك ${mySplitRecord?.name || contributorName || "يا الغالي"}، اسمك ورقمك جاهزين من الديوانية. حدد قطيتك وادفع مباشرة.`
                    : (urlName ? `ترا ناطرين تحويلك يا ${urlName} 💸😎` : "اذا ما دفعت قطيتك، ادفعها الحين ولا تصير البخيل باللمة! 💸😂")}
                </div>
              )}
              <div className="space-y-4">
                {isKnownDiwaniyaMember ? (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-right">
                    <div className="text-[10px] font-black text-emerald-700 mb-1">تم التعرف عليك من أعضاء الديوانية ✅</div>
                    <div className="font-black text-brand">{mySplitRecord?.name || contributorName}</div>
                    <div className="text-xs font-bold text-stone-500 font-mono mt-1" dir="ltr">{mySplitPhone}</div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-bold text-stone-500 mb-1 block">
                        اسمك الكريم
                      </label>
                      <input
                        type="text"
                        value={contributorName}
                        onChange={(e) => setContributorName(e.target.value)}
                        placeholder="مثال: محمد"
                        className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
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
                          setContributorPhone(normalizeDigits(e.target.value).replace(/[^0-9]/g, "").slice(0, 8))
                        }
                        placeholder="90000000"
                        className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                        dir="ltr"
                      />
                    </div>
                  </>
                )}
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
                    className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 font-bold text-xl text-center focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-stone-100 rounded-xl px-2 py-1 flex flex-col items-center justify-center border border-stone-100/50">
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
                          className="w-6 h-6 rounded bg-brand/10 text-brand text-[10px] font-extrabold hover:bg-brand hover:text-white transition-all border border-brand/20"
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
                    className="bg-stone-100 text-stone-600 font-bold text-[10px] py-2 rounded-xl hover:bg-stone-200 transition-colors flex flex-col items-center justify-center gap-0.5 border border-stone-100/50"
                  >
                    <Zap className="w-3.5 h-3.5 text-accent" />
                    كامل علي تستاهلون
                  </button>
                </div>

                <button
                  onClick={handlePay}
                  disabled={
                    isSubmitting ||
                    (!isKnownDiwaniyaMember && !contributorName.trim()) ||
                    !contributorAmount
                  }
                  className="w-full bg-brand text-white p-4 rounded-2xl font-extrabold disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 qatya-pay-button"
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
              className="qatya-v14-share-button w-full bg-white border-2 border-stone-100 text-stone-600 p-4 rounded-[24px] font-bold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-stone-50"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Share2 className="w-5 h-5 text-stone-400" />
              )}
              {copied ? "تم النسخ!" : "انسخ الرابط وقطه في قروبكم"}
            </button>
          </div>
        ) : (
          <div className="qatya-pay-card bg-white p-5 sm:p-6 rounded-[24px] shadow-sm border border-stone-100 text-center">
            <p className="font-bold text-stone-500 mb-3">اختر تبويب "قطيّتك" للدفع، أو "المشاركون" لمتابعة من دفع.</p>
            <button type="button" onClick={() => setQatyaTab("payment")} className="bg-brand text-white rounded-2xl px-5 py-3 font-black">ادفع قطيتك</button>
          </div>
        )}

        {getSafeSplitPayments(order).filter((p) => String(p.status || "").toLowerCase() === "paid").length >
          0 && (
          <div className="qatya-honor-card qatya-v14-honor qatya-wow-honor bg-white p-5 sm:p-6 rounded-[24px] shadow-sm border border-stone-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-full -mr-12 -mt-12 blur-2xl" />
            <h3 className="font-extrabold text-stone-400 text-sm mb-4 uppercase tracking-widest flex items-center gap-2 relative z-10">
              <Users className="w-4 h-4 text-brand" />
              حائط الشرف
            </h3>
            <div className="space-y-3 relative z-10">
              <AnimatePresence initial={false}>
                {getSafeSplitPayments(order).filter((p) => String(p.status || "").toLowerCase() === "paid")
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
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand/80 flex items-center justify-center text-white font-extrabold text-xs shadow-sm">
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
                          <span className="font-extrabold text-brand block">
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
          </div>)}
      </div>
    </div>
  );
}
