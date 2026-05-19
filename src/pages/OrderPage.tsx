import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Package,
  ChevronLeft,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  LayoutDashboard,
  X,
  MessageCircle,
  Star,
  RefreshCcw,
  Users,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { cn, normalizePhone } from "../utils";
import { redirectToPayment } from "../utils/redirect";

interface TrackedOrder {
  id: string;
  customerName: string;
  total: number;
  deliveryFee?: number;
  status: string;
  createdAt: string;
  items?: any[];
  address?: any;
}

const TypewriterText = ({
  text,
  delay = 0,
  className = "",
}: {
  text: string;
  delay?: number;
  className?: string;
}) => {
  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: 0.05, delayChildren: delay },
        },
      }}
    >
      {text.split("").map((c, idx) => (
        <motion.span
          key={idx}
          variants={{
            hidden: { opacity: 0, display: "none" },
            visible: { opacity: 1, display: "inline" },
          }}
        >
          {c}
        </motion.span>
      ))}
    </motion.span>
  );
};

import { calculateItemTotalWithAddons } from "../utils/priceCalculation";

const formatOrderWords = (count: number) => {
  if (count === 1) return "طلب واحد";
  if (count === 2) return "طلبين";
  if (count >= 3 && count <= 10) return `${count} طلبات`;
  return `${count} طلب`;
};

export default function OrderPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPhone = searchParams.get("phone") || "";
  const [urlPayment, setUrlPayment] = useState(searchParams.get("payment"));
  const [urlOrderId, setUrlOrderId] = useState(
    searchParams.get("order_id") || searchParams.get("tracked_order"),
  );

  useEffect(() => {
    const p = searchParams.get("payment");
    if (p) setUrlPayment(p);

    const oid =
      searchParams.get("order_id") || searchParams.get("tracked_order");
    if (oid) setUrlOrderId(oid);
  }, [searchParams]);

  // If this window is a popup (e.g. from AI Studio), notify parent and close
  useEffect(() => {
    if (window.opener && window.opener !== window && urlPayment && urlOrderId) {
      try {
        window.opener.postMessage(
          JSON.stringify({
            type: "payment_return",
            orderId: urlOrderId,
            payment: urlPayment,
          }),
          "*",
        );
        window.close();
      } catch (e) {
        console.error(e);
      }
    }
  }, [urlPayment, urlOrderId]);

  useEffect(() => {
    // 1. Handle order handoff via URL param for automatic open, or localStorage prefill
    const urlOrderSearch =
      searchParams.get("order_id") || searchParams.get("tracked_order");
    let lsPhone = searchParams.get("phone") || window.name || "";
    let lsTargetOrderId = urlOrderSearch;

    try {
      const storedPhone = localStorage.getItem("customer_phone_track");
      if (storedPhone && storedPhone.length >= 8) lsPhone = storedPhone;

      const trackingId = localStorage.getItem("track_order_id");
      const trackingStatus = localStorage.getItem("track_status");

      if (trackingId) {
        lsTargetOrderId = trackingId;
        localStorage.removeItem("track_order_id"); // Clear IMMEDIATELY
      }

      if (trackingStatus) {
        setUrlPayment(trackingStatus);
        localStorage.removeItem("track_status"); // Clear IMMEDIATELY
      }

      if (!lsTargetOrderId) {
        lsTargetOrderId = localStorage.getItem("post_payment_open_order_id");
        if (lsTargetOrderId)
          localStorage.removeItem("post_payment_open_order_id"); // Clear IMMEDIATELY
      }
      if (!lsTargetOrderId) {
        lsTargetOrderId = sessionStorage.getItem("post_payment_open_order_id");
        if (lsTargetOrderId)
          sessionStorage.removeItem("post_payment_open_order_id"); // Clear IMMEDIATELY
      }
    } catch (e) {}

    if (lsPhone && lsPhone.length >= 8) {
      setPhone(lsPhone);
    }

    if (lsTargetOrderId) {
      setSearchOrderIdInput(lsTargetOrderId);
      if (urlOrderSearch) {
        try {
          sessionStorage.setItem("post_payment_open_order_id", urlOrderSearch);
        } catch (e) {}
      }
      // Provide the target order id and start fetch
      handleSearch(undefined, lsPhone || undefined, lsTargetOrderId);

      // Clear the target order id from URL so it doesn't auto-open on every refresh or interval
      if (urlOrderSearch) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("order_id");
        newParams.delete("tracked_order");
        // Keep phone for better UX
        setSearchParams(newParams, { replace: true });
      }
    } else if (lsPhone && lsPhone.length >= 8) {
      handleSearch(undefined, lsPhone);
    }
  }, []);

  const paymentStatusQuery = urlPayment;

  const [phone, setPhone] = useState(initialPhone);
  const [searchOrderIdInput, setSearchOrderIdInput] = useState("");
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const autoOpenedTargetRef = useRef<string | null>(null);
  const [squadInfo, setSquadInfo] = useState<any>(null);
  const [sessionSuccessOrders, setSessionSuccessOrders] = useState<string[]>([]);

  useEffect(() => {
    // Initialize success orders from local storage to handle refreshes better
    try {
      const storedSuccesses = localStorage.getItem("temp_success_orders");
      if (storedSuccesses) {
        setSessionSuccessOrders(JSON.parse(storedSuccesses));
      }
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (urlPayment === "success" && urlOrderId) {
      const oId = String(urlOrderId).toUpperCase();
      setSessionSuccessOrders(prev => {
        if (prev.includes(oId)) return prev;
        const newState = [...prev, oId];
        try {
          localStorage.setItem("temp_success_orders", JSON.stringify(newState));
        } catch(e) {}
        return newState;
      });
    }
  }, [urlPayment, urlOrderId]);

  useEffect(() => {
     if (phone && phone.length >= 8) {
        fetch(`/api/squad-gamification?phone=${encodeURIComponent(phone)}`)
          .then(res => res.json())
          .then(data => {
             if (data.mySquad) {
                setSquadInfo({
                   ...data.mySquad,
                   rank: data.myRank,
                   memberData: data.myMemberData
                });
             }
          })
          .catch(() => {});
     }
  }, [phone]);

  // Clear the payment alert after some time
  useEffect(() => {
    if (urlPayment) {
      const timer = setTimeout(() => {
        setUrlPayment(null);

        // Also clean up searchParams if any
        const newParams = new URLSearchParams(searchParams);
        if (newParams.has("payment")) {
          newParams.delete("payment");
          setSearchParams(newParams, { replace: true });
        }
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [urlPayment, searchParams, setSearchParams]);

  // Listen for payment popup messages if it was left open from CustomerSite
  useEffect(() => {
    const handleGlobalMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === "payment_return" && data.orderId) {
          // Keep the phone number if available
          let phoneToKeep = "";
          try {
            phoneToKeep = localStorage.getItem("customer_phone_track") || "";
          } catch (err) {}
          phoneToKeep =
            phoneToKeep ||
            window.name ||
            new URLSearchParams(window.location.search).get("phone") ||
            phone ||
            "";
          setSearchParams(
            {
              order_id: data.orderId,
              payment: data.payment,
              phone: phoneToKeep,
            },
            { replace: true },
          );

          try {
            sessionStorage.setItem("post_payment_open_order_id", data.orderId);
          } catch (e) {}

          // Directly trigger search instead of hard reload
          handleSearch(undefined, phoneToKeep, data.orderId);
        }
      } catch (e) {}
    };
    window.addEventListener("message", handleGlobalMessage);
    return () => window.removeEventListener("message", handleGlobalMessage);
  }, [phone]);

  const handleSearch = async (
    e?: React.FormEvent,
    directPhone?: string,
    overrideTargetOrderId?: string | null,
  ) => {
    if (e) e.preventDefault();
    autoOpenedTargetRef.current = null; // Reset so explicit searches will popup
    const searchPhone = directPhone || phone;
    let targetOrderId =
      overrideTargetOrderId || searchOrderIdInput || urlOrderId;
    try {
      if (!targetOrderId)
        targetOrderId = localStorage.getItem("track_order_id");
      if (!targetOrderId)
        targetOrderId = localStorage.getItem("post_payment_open_order_id");
      if (!targetOrderId)
        targetOrderId = sessionStorage.getItem("post_payment_open_order_id");
    } catch (err) {}

    if (!targetOrderId && searchPhone.length < 8) return;

    setLoading(true);
    await fetchOrders(searchPhone, targetOrderId);
    setSearched(true);
    setLoading(false);
  };

  const fetchOrders = async (
    searchPhone?: string,
    overrideTargetOrderId?: string | null,
    isPolling = false,
  ) => {
    const currentPhone = searchPhone || phone;
    let handoffOrderId = overrideTargetOrderId || urlOrderId;
    try {
      if (!handoffOrderId)
        handoffOrderId = localStorage.getItem("track_order_id");
      if (!handoffOrderId)
        handoffOrderId = localStorage.getItem("post_payment_open_order_id");
      if (!handoffOrderId)
        handoffOrderId = sessionStorage.getItem("post_payment_open_order_id");
    } catch (e) {}

    // We need either a valid phone or a target order id
    if (!currentPhone && !handoffOrderId) return;

    try {
      const urlParams = new URLSearchParams();
      if (currentPhone) urlParams.append("phone", currentPhone);
      if (handoffOrderId) urlParams.append("order_id", handoffOrderId);

      const res = await fetch(`/api/track-orders?${urlParams.toString()}`);
      const resText = await res.text();
      let data;
      try {
        data = JSON.parse(resText);
      } catch (err) {
        console.error("Not a valid JSON:", resText);
        return;
      }
      if (Array.isArray(data)) {
        setOrders(data);
        setSelectedOrder((prev) => {
          if (!prev) return prev;
          const updated = data.find(
            (o: any) => o.id === prev.id || o.invoiceId === prev.id,
          );
          return updated || prev;
        });

        if (handoffOrderId) {
          let hId = String(handoffOrderId).trim().toUpperCase();
          if (hId.startsWith("#")) hId = hId.substring(1);
          if (hId.includes("-S-")) hId = hId.split("-S-")[0];

          const target = data.find(
            (o: any) =>
              String(o.id).toUpperCase() === hId ||
              (o.linkedInvoiceId &&
                String(o.linkedInvoiceId).toUpperCase() === hId) ||
              (o.invoiceId && String(o.invoiceId).toUpperCase() === hId),
          );
          if (target) {
            // Only force-open if NOT polling. If polling, line 223 handles updates to already-open modals.
            if (!isPolling) {
              setSelectedOrder(target);
            }
          }
          try {
            sessionStorage.removeItem("post_payment_open_order_id");
            localStorage.removeItem("post_payment_open_order_id"); // Fix auto-open issue by clearing local storage
            localStorage.removeItem("track_order_id");
            localStorage.removeItem("track_status");
            // We keep searchOrderIdInput so the user sees what they searched for
            if (target && urlOrderId === handoffOrderId) {
              setUrlOrderId(null);
            }
          } catch (e) {}
        }
      } else {
        console.error("API returned non-array:", data);
        setOrders([]);
      }
    } catch (err: any) {
      if (
        err &&
        err.message &&
        (err.message.includes("Load failed") ||
          err.message.includes("Failed to fetch"))
      ) {
        // Silently ignore normal dev-server restart fetch failures
      } else {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (
      searched &&
      ((phone && phone.length >= 8) || searchOrderIdInput || urlOrderId)
    ) {
      interval = setInterval(
        () => fetchOrders(phone, searchOrderIdInput || urlOrderId, true),
        3000,
      );
    }
    return () => clearInterval(interval);
  }, [searched, phone, searchOrderIdInput, urlOrderId, selectedOrder]);

  const getStatusDisplay = (order: any) => {
    let rawStatus = order?.status;
    const oId = String(order?.id || order?.invoiceId || "").toUpperCase();

    // If we just successfully paid this order in this session, force display as paid
    // to prevent flickering before the backend update propagates.
    if (sessionSuccessOrders.includes(oId)) {
      return {
        text: "تم الدفع وجاري التوصيل",
        color: "text-green-600 bg-green-50",
        icon: <Truck className="w-4 h-4" />,
      };
    }

    if ((order?.paymentStatus === "split" || order?.paymentStatus === "partial") && (!rawStatus || rawStatus === "جديد" || rawStatus === "بانتظار الدفع" || rawStatus === "بانتظار اكتمال القطية")) {
      rawStatus = "قيد تجميع القطية";
    }
    
    if (!rawStatus) {
      if (order?.paymentStatus === "paid") rawStatus = "تم الدفع وجاري التوصيل";
      else if (order?.paymentStatus === "failed")
        rawStatus = "فشل في عملية الدفع";
      else rawStatus = "جديد";
    }

    const s = rawStatus.toLowerCase();

    // Explicit exact matches first
    if (s === "قيد تجميع القطية" || s === "بانتظار اكتمال القطية" || s === "split" || s === "partial")
      return {
        text: "قيد تجميع القطية",
        color: "text-purple-600 bg-purple-50",
        icon: <Users className="w-4 h-4" />,
      };
    if (s === "جديد" || s === "بانتظار الدفع" || s === "pending")
      return {
        text: "بانتظار الدفع",
        color: "text-amber-600 bg-amber-50",
        icon: <Clock className="w-4 h-4" />,
      };
    if (s === "فشل في عملية الدفع" || s === "failed")
      return {
        text: "فشل في عملية الدفع",
        color: "text-red-600 bg-red-50",
        icon: <X className="w-4 h-4" />,
      };
    if (
      s === "تم الدفع" ||
      s === "تم الدفع وجاري التوصيل" ||
      s === "paid" ||
      s === "مدفوعة" ||
      s === "مدفوع"
    )
      return {
        text: "تم الدفع وجاري التوصيل",
        color: "text-green-600 bg-green-50",
        icon: <Truck className="w-4 h-4" />,
      };

    // Fallbacks
    if (s.includes("انتهى وقت القطية") || (rawStatus && rawStatus.includes("انتهى وقت القطية")))
      return {
        text: "ملغي - انتهى وقت القطية",
        color: "text-red-600 bg-red-50",
        icon: <X className="w-4 h-4" />,
      };
    if (s.includes("cancel") || s.includes("ملغي"))
      return {
        text: "ملغي",
        color: "text-red-600 bg-red-50",
        icon: <X className="w-4 h-4" />,
      };
    if (s.includes("complete") || s.includes("مكتمل"))
      return {
        text: "تم التوصيل",
        color: "text-green-600 bg-green-50",
        icon: <CheckCircle2 className="w-4 h-4" />,
      };
    if (s.includes("paid") || s.includes("processed") || s.includes("مدفوع"))
      return {
        text: "تم الدفع وجاري التوصيل",
        color: "text-green-600 bg-green-50",
        icon: <Truck className="w-4 h-4" />,
      };

    return {
      text: rawStatus,
      color: "text-stone-600 bg-stone-50",
      icon: <Truck className="w-4 h-4" />,
    };
  };

  const calculateItemsTotal = (items: any[]) => {
    return (items || []).reduce((sum: number, i: any) => {
      return sum + calculateItemTotalWithAddons(i);
    }, 0);
  };

  const getDisplayTotal = (order: any) => {
    if (order.deliveryType === "free") {
      return calculateItemsTotal(order.items);
    }
    return order.total || 0;
  };

  const [processingPayment, setProcessingPayment] = useState(false);
  const [newPaymentLink, setNewPaymentLink] = useState("");

  const handleRepay = async (order: TrackedOrder) => {
    if (
      (order as any).paymentStatus === "paid" ||
      (order.status || "").startsWith("تم الدفع")
    ) {
      alert("هذا الطلب مدفوع بالفعل.");
      return;
    }

    try {
      setProcessingPayment(true);
      setNewPaymentLink("");
      let orderTotal =
        order.deliveryFee === 0 ||
        (order as any).isFreeDelivery ||
        (order as any).deliveryType === "free"
          ? calculateItemsTotal(order.items || [])
          : order.total || 0;

      const totalPaid = ((order as any).splitPayments || [])
        .filter((sp: any) => sp.status === "paid")
        .reduce((sum: number, sp: any) => sum + (Number(sp.amount) || 0), 0);

      orderTotal = orderTotal - totalPaid;

      if (orderTotal < 0.001) {
        alert("اكتمل الدفع بالفعل!");
        setProcessingPayment(false);
        return;
      }

      const isSplitRepayment = totalPaid > 0 || ((order as any).splitType && (order as any).splitType !== "none");
      
      const payEndpoint = isSplitRepayment ? "/api/create-split-payment" : "/api/create-payment";
      const payBody = isSplitRepayment 
        ? {
            amount: Math.max(0.001, orderTotal),
            name: "باقي الفاتورة",
            customerMobile: (order as any).customerPhone || phone || "00000000",
            orderId: order.id,
            baseUrl: window.location.origin
          }
        : {
            amount: orderTotal,
            customerName: order.customerName,
            customerMobile: (order as any).customerPhone || phone,
            orderId: order.id,
            isPopup: window !== window.top,
            description: `دفع للطلب رقم #${order.id}`,
            baseUrl: window.location.origin
          };

      const payRes = await fetch(payEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payBody),
      });

      let payData: any = {};
      const payResText = await payRes.text();
      try {
        payData = JSON.parse(payResText);
      } catch (e) {
        console.error("Payment API returned non-JSON:", payResText);
        payData = {
          error: `خطأ في الخادم: ${payRes.status} ${payResText.substring(0, 50)}`,
        };
      }
      let paymentLink = "";
      if (payData.paymentLink) {
        paymentLink = payData.paymentLink;
      } else if (payData.data?.link) {
        paymentLink = payData.data.link;
      }

      if (paymentLink) {
        // Update link in DB so Admin has it updated (optional but good idea)
        fetch(`/api/orders/${order.id}/payment-link`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentLink }),
        }).catch((err: any) => {
          if (
            err &&
            err.message &&
            (err.message.includes("Load failed") ||
              err.message.includes("Failed to fetch"))
          )
            return;
          console.error(err);
        });

        // Allow the user to explicitly click the linked button to avoid popup blocking
        setNewPaymentLink(paymentLink);
        setProcessingPayment(false);
        const redirectStatus = redirectToPayment(paymentLink);
        if (redirectStatus === "navigating_away") {
          // The browser will transition.
          // We don't need to do anything.
        }
      } else {
        console.error("Failed to generate payment link:", payData);
        alert("حدث خطأ في إنشاء رابط الدفع الجديد.");
        setProcessingPayment(false);
      }
    } catch (e: any) {
      if (
        e &&
        e.message &&
        (e.message.includes("Load failed") ||
          e.message.includes("Failed to fetch"))
      ) {
        // Silently ignore or just alert without console.error
        alert(
          "لا يمكن الاتصال. الخادم يعيد التشغيل حالياً، يرجى الانتظار قليلاً ثم المحاولة.",
        );
      } else {
        console.error(e);
        alert("حدث خطأ في الاتصال بالخادم.");
      }
      setProcessingPayment(false);
    }
  };

  const clearPaymentStatus = () => {
    setUrlPayment(null);
    const newParams = new URLSearchParams(searchParams);
    if (newParams.has("payment")) {
      newParams.delete("payment");
      setSearchParams(newParams, { replace: true });
    }
  };

  return (
    <div
      className="min-h-screen bg-[#FDFCFB] text-[#2D2926] font-sans selection:bg-accent/20 overflow-x-hidden"
      dir="rtl"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-stone-100 px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="p-3 bg-stone-50 rounded-2xl hover:bg-stone-100 transition-all border border-stone-100"
        >
          <ChevronLeft className="w-5 h-5 text-stone-400 rotate-180" />
        </Link>
        <h1 className="text-xl font-extrabold text-brand tracking-tight">
          تتبع الطلبات
        </h1>
        <div className="w-11" /> {/* Spacer */}
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Payment Status Alerts */}
        <AnimatePresence>
          {paymentStatusQuery === "success" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/80 backdrop-blur-md pointer-events-auto"
              onClick={clearPaymentStatus}
            >
              <div className="relative flex flex-col items-center justify-center">
                {/* Cylinder falling */}
                <motion.div
                  initial={{ y: -500, scale: 2, rotateX: 45 }}
                  animate={{ y: 0, scale: 1, rotateX: 0 }}
                  transition={{
                    type: "spring",
                    damping: 8,
                    stiffness: 100,
                    duration: 0.8,
                  }}
                  className="w-32 h-32 md:w-48 md:h-48 relative z-20 flex items-center justify-center rounded-full"
                >
                  {/* The stamp face */}
                  <div className="absolute inset-0 bg-red-700 rounded-full border-[6px] border-red-900 shadow-[inset_0_10px_20px_rgba(0,0,0,0.5),0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center">
                    <div className="w-[85%] h-[85%] rounded-full border-[4px] border-dashed border-red-900/50 flex flex-col items-center justify-center text-red-900">
                      <CheckCircle2 className="w-10 h-10 md:w-14 md:h-14 opacity-80 mb-1" />
                      <span className="font-extrabold text-lg md:text-2xl drop-shadow-md">
                        خالص
                      </span>
                      <span className="font-extrabold text-sm md:text-lg drop-shadow-md">
                        مدفوع
                      </span>
                    </div>
                  </div>

                  {/* Sparks explosion */}
                  {[...Array(24)].map((_, i) => (
                    <motion.div
                      key={`spark-${i}`}
                      initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
                      animate={{
                        opacity: [1, 1, 0],
                        x:
                          Math.cos((i * (360 / 24) * Math.PI) / 180) *
                          (300 + Math.random() * 100),
                        y:
                          Math.sin((i * (360 / 24) * Math.PI) / 180) *
                          (300 + Math.random() * 100),
                        scale: [0, Math.random() > 0.5 ? 2 : 1, 0],
                      }}
                      transition={{
                        duration: 1 + Math.random(),
                        delay: 0.4,
                        ease: "easeOut",
                      }}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: i % 2 === 0 ? "#ffb703" : "#fb8500",
                        boxShadow: "0 0 10px #ffb703",
                      }}
                    />
                  ))}
                </motion.div>
                {/* Background impact wave */}
                <motion.div
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: [0, 4, 6], opacity: [1, 0.5, 0] }}
                  transition={{ duration: 1.5, delay: 0.3 }}
                  className="absolute inset-0 bg-red-600 rounded-full blur-xl z-10"
                />
                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="text-white/60 font-medium text-sm mt-12 text-center"
                >
                  سيتم تجهيز طلبك بأسرع وقت (اضغط للإغلاق)
                </motion.p>
              </div>
            </motion.div>
          )}

          {paymentStatusQuery === "failed" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/80 backdrop-blur-md pointer-events-auto"
              onClick={clearPaymentStatus}
            >
              <div className="relative flex flex-col items-center justify-center max-w-sm w-full mx-auto p-6">
                {/* The burning paper */}
                <motion.div
                  initial={{
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                    rotate: -2,
                    y: 0,
                  }}
                  animate={{
                    clipPath: [
                      "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                      "polygon(0 10%, 100% 15%, 85% 100%, 15% 100%)",
                      "polygon(20% 30%, 80% 35%, 60% 80%, 40% 70%)",
                      "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)",
                    ],
                    rotate: [-2, 5, -15, 30],
                    y: [0, -20, 50, 100],
                  }}
                  transition={{ duration: 2.5, ease: "easeInOut", delay: 0.5 }}
                  className="w-full bg-[#f4eeb8] rounded-lg p-8 shadow-xl relative border border-[#d4ca8e] text-center filter sepia-[0.3]"
                >
                  {/* The fire/ash overlay */}
                  <motion.div
                    animate={{ opacity: [0, 0.8, 1, 0] }}
                    transition={{ duration: 2.5, delay: 0.5 }}
                    className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#3f0b0b_60%,_#000_100%)] mix-blend-multiply rounded-lg pointer-events-none"
                  />
                  <X className="w-12 h-12 text-red-800 mx-auto mb-4" />
                  <h3 className="text-2xl font-extrabold text-red-900 mb-2">
                    فشل الدفع!
                  </h3>
                  <p className="text-red-900/70 font-medium">
                    خطأ في العملية، يرجى المحاولة.
                  </p>

                  {/* Embers flying up */}
                  {[...Array(15)].map((_, i) => (
                    <motion.div
                      key={`ember-${i}`}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        x: (Math.random() - 0.5) * 200,
                        y: -100 - Math.random() * 200,
                        scale: Math.random() * 1.5,
                      }}
                      transition={{
                        duration: 1.5 + Math.random(),
                        delay: 0.5 + Math.random(),
                        ease: "easeOut",
                      }}
                      className="absolute top-1/2 left-1/2 w-2 h-2 bg-orange-500 rounded-full blur-[1px] pointer-events-none"
                    />
                  ))}
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.5 }}
                  className="text-white/60 font-medium text-sm mt-8 text-center"
                ></motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Section */}
        <section className="bg-white rounded-[40px] p-8 border border-stone-100 shadow-xl shadow-stone-200/50 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-brand">وين طلبي؟</h2>
            <p className="text-stone-400 text-sm font-medium">
              حط رقم تليفونك أو رقم الطلب علشان تتابع حالة طلباتك
            </p>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative group">
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-accent transition-colors">
                <Phone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="رقم الهاتف (مثل: 9999 9999)"
                value={phone}
                onChange={(e) => setPhone(normalizePhone(e.target.value))}
                dir="ltr"
                pattern="[0-9]*"
                className="w-full py-6 pr-16 pl-6 bg-stone-50 border-2 border-transparent focus:border-accent rounded-[28px] outline-none transition-all text-xl font-extrabold text-brand placeholder:text-stone-300 text-center tracking-[0.2em]"
              />
            </div>

            <div className="relative group">
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-accent transition-colors">
                <Package className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="رقم الطلب (اختياري)"
                value={searchOrderIdInput}
                onChange={(e) => setSearchOrderIdInput(e.target.value)}
                className="w-full py-6 pr-16 pl-6 bg-stone-50 border-2 border-transparent focus:border-accent rounded-[28px] outline-none transition-all text-xl font-extrabold text-brand placeholder:text-stone-300 text-center tracking-[0.2em] uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={
                loading || (phone.length < 8 && searchOrderIdInput.length < 3)
              }
              className="mt-4 w-full py-5 bg-brand text-white rounded-[24px] font-extrabold shadow-xl shadow-brand/20 hover:scale-[0.98] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  بحث عن الطلبات
                </>
              )}
            </button>
          </form>
        </section>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {searched && orders.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-20 space-y-4"
            >
              <div className="inline-flex p-6 bg-stone-50 rounded-[32px] text-stone-200">
                <Package className="w-12 h-12" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-brand">لا توجد طلبات</h3>
                <p className="text-stone-400 font-medium">
                  لم نجد أي طلبات مرتبطة بهذا الرقم حالياً
                </p>
              </div>
            </motion.div>
          )}

          {orders.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 pb-20"
            >
              <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-stone-400 font-extrabold uppercase mb-1 tracking-widest">
                    معلومات العميل
                  </p>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-brand text-lg">
                      {orders[0].customerName}
                    </h3>
                    <span className="text-stone-300">•</span>
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100 shadow-sm">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-extrabold text-xs">
                        {(orders[0] as any).customerPoints || 0} نقطة
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 mt-6">
                <h3 className="font-extrabold text-brand uppercase tracking-widest text-xs flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-accent" /> سجل
                  الطلبات الأخيرة
                </h3>
                <span className="px-3 py-1 bg-brand/5 text-brand text-[10px] font-extrabold rounded-full">
                  {formatOrderWords(orders.length)}
                </span>
              </div>

              {orders.map((order, index) => {
                const statusInfo = getStatusDisplay(order);
                const isOngoing = statusInfo.text.includes("توصيل");
                return (
                  <motion.div
                    layoutId={`order-${order.id}`}
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setSelectedOrder(order)}
                    className={cn(
                      "bg-white rounded-[32px] p-6 border shadow-sm hover:shadow-md transition-all group cursor-pointer active:scale-95",
                      isOngoing
                        ? "border-accent/40 shadow-accent/10"
                        : "border-stone-100",
                    )}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">
                            رقم الطلب
                          </span>
                          <span className="text-xs font-extrabold text-brand bg-stone-50 px-2 py-0.5 rounded-lg border border-stone-100">
                            #{(order.id || "").toUpperCase()}
                          </span>
                          {(order.paymentStatus === "paid" ||
                            (order.status || "").startsWith("تم الدفع") ||
                            statusInfo.text.includes("توصيل") ||
                            statusInfo.text.includes("مكتمل")) &&
                            !statusInfo.text.includes("فشل") &&
                            !statusInfo.text.includes("بانتظار") &&
                            !statusInfo.text.includes("قيد تجميع") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/?reorder=${order.invoiceId || order.id}`,
                                  );
                                }}
                                className="w-6 h-6 flex items-center justify-center bg-brand/5 hover:bg-brand text-brand hover:text-white rounded-lg transition-colors group-hover:scale-105"
                                title="إعادة الطلب"
                              >
                                <RefreshCcw className="w-3 h-3" />
                              </button>
                            )}
                        </div>
                        <p className="text-[10px] text-stone-300 font-medium">
                          {order.createdAt || order.date
                            ? new Date(
                                order.createdAt || order.date,
                              ).toLocaleString("en-US")
                            : "تاريخ غير معروف"}
                        </p>
                      </div>
                      <div
                        className={`px-4 py-2 rounded-2xl flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest ${statusInfo.color}`}
                      >
                        {statusInfo.icon}
                        {statusInfo.text}
                      </div>
                    </div>

                    <div className="space-y-4 border-t border-stone-50 pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              isOngoing
                                ? "bg-accent/10 text-accent animate-pulse"
                                : "bg-brand/5 text-brand",
                            )}
                          >
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-extrabold text-stone-400 uppercase">
                              المبلغ الإجمالي
                            </p>
                            <p className="text-lg font-extrabold text-brand italic">
                              {Number(getDisplayTotal(order) || 0).toFixed(3)}{" "}
                              <span className="text-[10px] text-accent font-normal italic">
                                د.ك
                              </span>
                            </p>
                          </div>
                        </div>
                        <button className="p-3 bg-stone-50 text-stone-400 rounded-xl hover:bg-brand hover:text-white transition-all group-hover:scale-110">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>

                      {order.address && (
                        <div className="flex items-center gap-2 text-[10px] text-stone-400 bg-stone-50/50 p-3 rounded-xl border border-stone-50 overflow-hidden">
                          <MapPin className="w-3 h-3 text-accent shrink-0" />
                          <span className="truncate">
                            {typeof order.address === "object"
                              ? `${order.address.region}، ق ${order.address.block}${order.address.street ? `، ش ${order.address.street}` : ""}${order.address.building ? `، م ${order.address.building}` : ""}`
                              : order.address}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-brand/40 backdrop-blur-md"
            />
            <motion.div
              layoutId={`order-${selectedOrder.id}`}
              className="relative w-full max-w-lg bg-white rounded-t-[48px] sm:rounded-[48px] shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-stone-50 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-2xl font-extrabold text-brand flex items-center gap-2">
                        تفاصيل الطلب
                        {(selectedOrder.paymentStatus === "paid" ||
                          (selectedOrder.status || "").startsWith("تم الدفع") ||
                          getStatusDisplay(selectedOrder).text.includes(
                            "توصيل",
                          ) ||
                          getStatusDisplay(selectedOrder).text.includes(
                            "مكتمل",
                          )) &&
                          !getStatusDisplay(selectedOrder).text.includes(
                            "فشل",
                          ) &&
                          !getStatusDisplay(selectedOrder).text.includes(
                            "بانتظار",
                          ) &&
                          !getStatusDisplay(selectedOrder).text.includes(
                            "قيد تجميع",
                          ) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/?reorder=${selectedOrder.invoiceId || selectedOrder.id}`,
                                );
                              }}
                              className="bg-brand text-white w-8 h-8 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm group"
                              title="إعادة الطلب بنفس الأصناف"
                            >
                              <RefreshCcw className="w-4 h-4 group-hover:-rotate-45 transition-transform" />
                            </button>
                          )}
                      </h3>
                      <p className="text-stone-400 text-xs font-medium uppercase tracking-widest mt-1">
                        Order #{(selectedOrder.id || "").toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-3 bg-stone-50 text-stone-400 rounded-2xl hover:bg-stone-100 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0 sm:p-4 space-y-0 sm:space-y-8 no-scrollbar bg-stone-50/50">
                {/* Story Card & Magical Compass */}
                <div className="relative sm:rounded-[32px] overflow-hidden min-h-[450px] bg-stone-900 flex flex-col items-center justify-center p-8 shadow-xl">
                  {/* Story Gradient Background */}
                  <motion.div
                    animate={{
                      background: getStatusDisplay(selectedOrder).text.includes("ملغي")
                        ? [
                            "radial-gradient(circle at 50% 50%, #450a0a 0%, #1c1917 100%)",
                            "radial-gradient(circle at 50% 50%, #7f1d1d 0%, #1c1917 100%)",
                          ]
                        : getStatusDisplay(selectedOrder).text.includes(
                        "توصيل",
                      )
                        ? [
                            "radial-gradient(circle at 50% 50%, #0d9488 0%, #1c1917 100%)",
                            "radial-gradient(circle at 50% 50%, #115e59 0%, #1c1917 100%)",
                          ]
                        : getStatusDisplay(selectedOrder).text.includes("فشل")
                          ? [
                              "radial-gradient(circle at 50% 50%, #991b1b 0%, #1c1917 100%)",
                              "radial-gradient(circle at 50% 50%, #7f1d1d 0%, #1c1917 100%)",
                            ]
                          : [
                              "radial-gradient(circle at 50% 50%, #d97706 0%, #1c1917 100%)",
                              "radial-gradient(circle at 50% 50%, #b45309 0%, #1c1917 100%)",
                            ],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                    className="absolute inset-0 z-0 opacity-80"
                  />

                  {/* Progress indicators like Instagram stories (top layer) */}
                  <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
                    {["جديد", "تجهيز", "توصيل"].map((step, i) => {
                      const currentStep = getStatusDisplay(selectedOrder).text;
                      const isFailed = currentStep.includes("فشل");
                      let progress = 0;

                      if (
                        currentStep.includes("توصيل") ||
                        currentStep.includes("مكتمل")
                      ) {
                        progress = 100;
                      } else if (
                        currentStep.includes("تجهيز") ||
                        (currentStep.includes("دفع") &&
                          !currentStep.includes("بانتظار") &&
                          !isFailed)
                      ) {
                        if (step === "جديد") progress = 100;
                        if (step === "تجهيز") progress = 50;
                      } else {
                        if (step === "جديد") progress = 50;
                      }
                      if (isFailed) progress = 100; // red

                      return (
                        <div
                          key={i}
                          className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden"
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${progress}%`,
                              backgroundColor: currentStep.includes("فشل")
                                ? "#ef4444"
                                : "#fff",
                            }}
                            className="h-full"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* The Magical Compass */}
                  <div className="relative z-10 w-48 h-48 sm:w-56 sm:h-56">
                    {/* Ghost car effect for delivery */}
                    {getStatusDisplay(selectedOrder).text.includes("توصيل") && (
                      <motion.div
                        animate={{ x: ["150%", "-150%"] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="absolute top-1/2 -translate-y-1/2 left-0 w-24 h-12 z-0 opacity-20 blur-[2px]"
                      >
                        <Truck className="w-full h-full text-teal-300 transform scale-x-[-1]" />
                      </motion.div>
                    )}

                    {/* Split effect for gathering */}
                    {getStatusDisplay(selectedOrder).text.includes("قطية") &&
                      [...Array(3)].map((_, i) => (
                        <motion.div
                          key={`splitring-${i}`}
                          animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                          transition={{
                            duration: 2,
                            delay: i * 0.6,
                            repeat: Infinity,
                            ease: "easeOut",
                          }}
                          className="absolute inset-4 rounded-full border-2 border-purple-400/50"
                        />
                      ))}

                    {/* Steam effect for preparing */}
                    {(getStatusDisplay(selectedOrder).text.includes("تجهيز") ||
                      (getStatusDisplay(selectedOrder).text.includes("دفع") &&
                        !getStatusDisplay(selectedOrder).text.includes(
                          "بانتظار",
                        ) &&
                        !getStatusDisplay(selectedOrder).text.includes(
                          "فشل",
                        ))) &&
                      [...Array(6)].map((_, i) => (
                        <motion.div
                          key={`steam-${i}`}
                          initial={{
                            opacity: 0,
                            y: 20,
                            scale: 0.5,
                            x: (Math.random() - 0.5) * 40,
                          }}
                          animate={{
                            opacity: [0, 0.6, 0],
                            y: -100,
                            scale: 2,
                            x: (Math.random() - 0.5) * 60,
                          }}
                          transition={{
                            duration: 2.5 + Math.random(),
                            delay: i * 0.4,
                            repeat: Infinity,
                            ease: "easeOut",
                          }}
                          className="absolute bottom-4 left-1/2 w-4 h-4 bg-orange-300 rounded-full blur-md"
                        />
                      ))}

                    {/* Ash/Spark effect for cancelled */}
                    {getStatusDisplay(selectedOrder).text.includes("ملغي") &&
                      [...Array(12)].map((_, i) => (
                        <motion.div
                          key={`ash-${i}`}
                          initial={{
                            opacity: 1,
                            y: 0,
                            scale: Math.random() * 1.5 + 0.5,
                            x: 0,
                          }}
                          animate={{
                            opacity: [1, 0.8, 0],
                            y: 80 + Math.random() * 50,
                            scale: 0,
                            x: (Math.random() - 0.5) * 80,
                            rotate: Math.random() * 360
                          }}
                          transition={{
                            duration: 2 + Math.random(),
                            delay: i * 0.15,
                            repeat: Infinity,
                            ease: "easeIn",
                          }}
                          className="absolute top-[40%] left-1/2 w-2 h-2 bg-red-500 rounded-sm blur-[1px]"
                        />
                      ))}

                    {/* Glassmorphism Ring */}
                    <div
                      className={`absolute inset-0 rounded-full border border-white/20 backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.05)] flex items-center justify-center transition-colors duration-1000 ${
                        getStatusDisplay(selectedOrder).text.includes("ملغي") ? "bg-red-900/20 shadow-[0_0_50px_rgba(220,38,38,0.3)] border-red-500/20" : getStatusDisplay(selectedOrder).text.includes("تجهيز") || (getStatusDisplay(selectedOrder).text.includes("دفع") && !getStatusDisplay(selectedOrder).text.includes("بانتظار") && !getStatusDisplay(selectedOrder).text.includes("فشل")) ? "bg-orange-500/10 shadow-[0_0_50px_rgba(249,115,22,0.3)]" : "bg-white/5"
                      }`}
                    >
                      <div className={`w-[85%] h-[85%] rounded-full border-[2px] border-dashed border-white/20 ${getStatusDisplay(selectedOrder).text.includes("ملغي") ? "animate-pulse border-red-500/30" : "animate-[spin_60s_linear_infinite]"}`} />
                      <div className="absolute w-[60%] h-[60%] rounded-full border border-white/10 flex items-center justify-center bg-black/20 backdrop-blur-md">
                        {/* Box closing animation for preparing */}
                        {getStatusDisplay(selectedOrder).text.includes(
                          "ملغي",
                        ) ? (
                          <motion.div
                            animate={{ scale: [1, 0.9, 1], opacity: [1, 0.6, 1] }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                            className="text-red-400"
                          >
                            <X className="w-8 h-8" />
                          </motion.div>
                        ) : getStatusDisplay(selectedOrder).text.includes(
                          "تجهيز",
                        ) ||
                        (getStatusDisplay(selectedOrder).text.includes("دفع") &&
                          !getStatusDisplay(selectedOrder).text.includes(
                            "بانتظار",
                          ) &&
                          !getStatusDisplay(selectedOrder).text.includes(
                            "فشل",
                          )) ? (
                          <motion.div
                            animate={{ rotateX: [0, -180, 0] }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              repeatDelay: 1,
                            }}
                            className="text-orange-400"
                          >
                            {getStatusDisplay(selectedOrder).icon}
                          </motion.div>
                        ) : (
                          getStatusDisplay(selectedOrder).icon
                        )}
                      </div>
                    </div>

                    {/* Magical Needle */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      initial={{ rotate: -90 }}
                      animate={{
                        rotate: getStatusDisplay(selectedOrder).text.includes("ملغي")
                          ? 180
                          : getStatusDisplay(selectedOrder).text.includes(
                          "توصيل",
                        )
                          ? 45
                          : getStatusDisplay(selectedOrder).text.includes(
                                "تجهيز",
                              ) ||
                              (getStatusDisplay(selectedOrder).text.includes(
                                "دفع",
                              ) &&
                                !getStatusDisplay(selectedOrder).text.includes(
                                  "بانتظار",
                                ) &&
                                !getStatusDisplay(selectedOrder).text.includes(
                                  "فشل",
                                ))
                            ? 0
                            : [-60, -30, -60], // Gentle swing for new
                      }}
                      transition={{
                        type:
                          getStatusDisplay(selectedOrder).text.includes("ملغي") ||
                          getStatusDisplay(selectedOrder).text.includes(
                            "توصيل",
                          ) ||
                          getStatusDisplay(selectedOrder).text.includes(
                            "تجهيز",
                          ) ||
                          (getStatusDisplay(selectedOrder).text.includes(
                            "دفع",
                          ) &&
                            !getStatusDisplay(selectedOrder).text.includes(
                              "بانتظار",
                            ) &&
                            !getStatusDisplay(selectedOrder).text.includes(
                              "فشل",
                            ))
                            ? "spring"
                            : "tween",
                        damping: 12,
                        stiffness: 60,
                        duration:
                          getStatusDisplay(selectedOrder).text.includes(
                            "توصيل",
                          ) ||
                          getStatusDisplay(selectedOrder).text.includes(
                            "تجهيز",
                          ) ||
                          (getStatusDisplay(selectedOrder).text.includes(
                            "دفع",
                          ) &&
                            !getStatusDisplay(selectedOrder).text.includes(
                              "بانتظار",
                            ) &&
                            !getStatusDisplay(selectedOrder).text.includes(
                              "فشل",
                            ))
                            ? undefined
                            : 2.5,
                        repeat:
                          getStatusDisplay(selectedOrder).text.includes(
                            "توصيل",
                          ) ||
                          getStatusDisplay(selectedOrder).text.includes(
                            "تجهيز",
                          ) ||
                          (getStatusDisplay(selectedOrder).text.includes(
                            "دفع",
                          ) &&
                            !getStatusDisplay(selectedOrder).text.includes(
                              "بانتظار",
                            ) &&
                            !getStatusDisplay(selectedOrder).text.includes(
                              "فشل",
                            ))
                            ? 0
                            : Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-1.5 h-[40%] bg-gradient-to-b from-white to-transparent rounded-full shadow-[0_0_10px_#fff]" />
                    </motion.div>

                    {/* Speed lines for delivery */}
                    {getStatusDisplay(selectedOrder).text.includes("توصيل") &&
                      [...Array(8)].map((_, i) => (
                        <motion.div
                          key={`speedline-${i}`}
                          animate={{ y: [-100, 100], opacity: [0, 1, 0] }}
                          transition={{
                            duration: 1,
                            delay: i * 0.2,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="absolute left-1/2 -ml-0.5 w-1 h-10 bg-white/20 rounded-full"
                          style={{
                            transform: `rotate(${i * 45}deg) translateY(-80px)`,
                          }}
                        />
                      ))}
                  </div>

                  {/* Story Text Content */}
                  <div className="relative z-10 mt-8 text-center space-y-2">
                    <motion.h4
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-white text-2xl font-extrabold drop-shadow-md"
                    >
                      {getStatusDisplay(selectedOrder).text.includes("ملغي")
                        ? "تم إلغاء الطلب"
                        : getStatusDisplay(selectedOrder).text.includes("فشل")
                        ? "فشل الدفع"
                        : getStatusDisplay(selectedOrder).text.includes("توصيل")
                          ? "في الطريق إليك!"
                          : getStatusDisplay(selectedOrder).text.includes(
                                "تجهيز",
                              ) ||
                              (getStatusDisplay(selectedOrder).text.includes(
                                "دفع",
                              ) &&
                                !getStatusDisplay(selectedOrder).text.includes(
                                  "بانتظار",
                                ) &&
                                !getStatusDisplay(selectedOrder).text.includes(
                                  "فشل",
                                ))
                            ? "حب وتقدير... طلبك قاعدين نجهزه"
                            : "ننتظر تأكيد الدفع..."}
                    </motion.h4>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-white/70 text-sm font-medium px-4 leading-relaxed max-w-sm mx-auto"
                    >
                      {getStatusDisplay(selectedOrder).text.includes("ملغي")
                        ? "نعتذر، الفاتورة ملغية أو انتهى وقت القطية وما اكتمل المبلغ. للإستفسار تواصل معانا."
                        : getStatusDisplay(selectedOrder).text.includes("فشل")
                        ? "نعتذر، محاولة الدفع فشلت. يرجى المحاولة مرة أخرى."
                        : getStatusDisplay(selectedOrder).text.includes("توصيل")
                          ? "تبي المندوب ينتبه لشي معين بالطريج أو الموقع؟ تواصل ويانا بالواتساب وبلغنا."
                          : getStatusDisplay(selectedOrder).text.includes(
                                "تجهيز",
                              ) ||
                              (getStatusDisplay(selectedOrder).text.includes(
                                "دفع",
                              ) &&
                                !getStatusDisplay(selectedOrder).text.includes(
                                  "بانتظار",
                                ) &&
                                !getStatusDisplay(selectedOrder).text.includes(
                                  "فشل",
                                ))
                            ? "دقائق ويكون في الطريق إليك."
                            : getStatusDisplay(selectedOrder).text.includes("قطية")
                            ? "القطيّة شغالة والربع قاعدين يدفعون، الفاتورة ما تتأكد لين يكمل المبلغ!"
                            : "استلمنا طلبك، بانتظار الدفع عشان نبلش التجهيز."}
                    </motion.p>
                  </div>
                </div>

                <div className="px-4 sm:px-0">
                  {/* Split Bill UI */}
                  {["traditional", "roulette"].includes((selectedOrder as any).splitType) && (
                    <div className="space-y-4 mb-4">
                      {(getStatusDisplay(selectedOrder).text === "قيد تجميع القطية" || getStatusDisplay(selectedOrder).text === "بانتظار اكتمال القطية" || selectedOrder.paymentStatus === "partial") && (
                        <div className="flex flex-col gap-3">
                          <Link
                            to={`/split/${selectedOrder.id}`}
                            className="w-full bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 p-4 rounded-2xl flex items-center justify-between text-sm font-bold transition-all shadow-sm outline-none"
                          >
                            <span>ادخل صفحة القطية</span>
                            <Users className="w-5 h-5" />
                          </Link>

                          <button
                            onClick={() => handleRepay(selectedOrder as any)}
                            disabled={processingPayment}
                            className="block w-full text-center p-4 rounded-2xl bg-stone-100 text-stone-600 font-bold text-[13px] hover:bg-stone-200 transition-all outline-none disabled:opacity-50"
                          >
                              {processingPayment
                                ? "جاري التجهيز..."
                                : ((selectedOrder as any).splitPayments || [])
                                    .filter((p: any) => p.status === "paid" || p.status === "SUCCESS")
                                    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) > 0
                                ? `دفع المبلغ المتبقي (${Math.max(0, (selectedOrder.total || 0) - ((selectedOrder as any).splitPayments || []).filter((p: any) => p.status === "paid" || p.status === "SUCCESS").reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)).toFixed(3)} د.ك)`
                                : "غيرت رأيي - دفع الفاتورة بالكامل"}
                          </button>
                        </div>
                      )}

                      {(((selectedOrder as any).splitPayments || []).filter(
                        (p: any) => p.status === "paid" || p.status === "pending"
                      ).length > 0 || ((selectedOrder as any).splitParticipants || []).length > 0) && (
                        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                          <h4 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Users className="w-3 h-3" /> {(selectedOrder as any).splitType === 'roulette' ? 'المشاركون في وهق غيرك' : 'المساهمين في القطية'}
                          </h4>
                          {(selectedOrder as any).splitType === 'roulette' && (selectedOrder as any).rouletteLoser && (
                            <div className="mb-4 bg-fuchsia-50 border border-fuchsia-100 p-3 rounded-xl flex items-center justify-between">
                              <span className="text-fuchsia-600 font-bold text-xs flex items-center gap-2">
                                🎯 بطل الليلة (صاحب الحظ اللي دفعها)
                              </span>
                              <span className="font-extrabold text-fuchsia-700 text-sm">{(selectedOrder as any).rouletteLoser}</span>
                            </div>
                          )}
                          <div className="space-y-2">
                            {(selectedOrder as any).splitType === 'roulette' ? (
                              ((selectedOrder as any).splitParticipants || []).map((p: any, i: number) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-stone-100"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-stone-700">
                                        {p.name}
                                      </span>
                                      {p.phone && (
                                        <span className="text-[9px] text-stone-400 font-mono">
                                          {p.phone}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-[8px] bg-fuchsia-100 text-fuchsia-700 px-1.5 py-0.5 rounded-full font-bold">مشارك</span>
                                </div>
                              ))
                            ) : (
                              Object.values(
                                ((selectedOrder as any).splitPayments as any[])
                                  .filter((p: any) => p.status === "paid" || p.status === "pending")
                                  .reduce((acc: any, p: any) => {
                                    const key = `${p.name}-${p.phone}`;
                                    if (!acc[key] || p.status === "paid" || acc[key].status === "failed") {
                                      acc[key] = p;
                                    }
                                    return acc;
                                  }, {})
                              ).map((p: any, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-stone-100"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-stone-700">
                                          {p.name}
                                        </span>
                                        {p.phone && (
                                          <span className="text-[9px] text-stone-400 font-mono">
                                            {p.phone}
                                          </span>
                                        )}
                                      </div>
                                      {p.status === "paid" ? (
                                        <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">مدفوع</span>
                                      ) : (
                                        <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">بانتظار الدفع</span>
                                      )}
                                    </div>
                                    <span className="font-extrabold text-brand tracking-tight">
                                      {Number(p.amount).toFixed(3)} د.ك
                                    </span>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                    {/* Split Payment Summary */}
                    {((selectedOrder as any).splitPayments || []).length > 0 && (selectedOrder as any).splitType !== 'roulette' && (
                       <div className="bg-brand/5 p-4 rounded-2xl border border-brand/10 mb-4 flex justify-between items-center text-sm">
                          <div className="flex flex-col text-center">
                             <span className="text-[10px] text-stone-500 font-bold mb-0.5">الإجمالي</span>
                             <span className="font-extrabold text-stone-700">{Number((selectedOrder as any).total).toFixed(3)} د.ك</span>
                          </div>
                          <div className="flex flex-col text-center">
                             <span className="text-[10px] text-green-600 font-bold mb-0.5">المدفوع</span>
                             <span className="font-extrabold text-green-700">
                                {((selectedOrder as any).splitPayments || []).filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0).toFixed(3)} د.ك
                             </span>
                          </div>
                          <div className="flex flex-col text-center">
                             <span className="text-[10px] text-amber-600 font-bold mb-0.5">المتبقي</span>
                             <span className="font-extrabold text-amber-700">
                                {Math.max(0, Number((selectedOrder as any).total) - ((selectedOrder as any).splitPayments || []).filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)).toFixed(3)} د.ك
                             </span>
                          </div>
                       </div>
                    )}

                  {/* Payment Re-send */}
                  {(getStatusDisplay(selectedOrder).text === "بانتظار الدفع" ||
                    getStatusDisplay(selectedOrder).text ===
                      "فشل في عملية الدفع") &&
                    (newPaymentLink ? (
                      <button
                        onClick={() => {
                          redirectToPayment(newPaymentLink);
                          setTimeout(() => setNewPaymentLink(""), 1000);
                        }}
                        className="flex items-center justify-center gap-3 w-full p-4 rounded-2xl bg-accent text-white font-extrabold text-sm hover:bg-orange-600 transition-all shadow-md outline-none mb-4"
                      >
                        اضغط هنا لاستكمال الدفع
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRepay(selectedOrder as any)}
                        disabled={processingPayment}
                        className="block w-full text-center p-4 rounded-2xl bg-brand text-white font-extrabold text-sm hover:opacity-90 transition-all shadow-md outline-none disabled:opacity-50 mb-4"
                      >
                        {processingPayment ? "جاري التجهيز..." : "ادفع الآن"}
                      </button>
                    ))}

                  {/* WhatsApp Share for Paid Orders */}
                  {getStatusDisplay(selectedOrder).text.startsWith(
                    "تم الدفع",
                  ) && (
                    <button
                      onClick={() => {
                        const customerName =
                          selectedOrder.customerName ||
                          (selectedOrder as any).name ||
                          "العميل";
                        const invId = selectedOrder.invoiceId
                          ? `${selectedOrder.invoiceId}`
                          : selectedOrder.id || "";

                        const itemsText = (selectedOrder.items || [])
                          .map((item: any) => {
                            let text = `${item.productName || item.name} (${item.quantity} × ${Number(item.price || 0).toFixed(3)})`;
                            const extrasTotal = (
                              item.selectedExtras ||
                              item.extras ||
                              []
                            ).reduce(
                              (eSum: number, e: any) =>
                                eSum + (Number(e.price) || 0),
                              0,
                            );
                            if (extrasTotal > 0) {
                              text += `\n  إضافات: ${Number(extrasTotal).toFixed(3)}`;
                            }
                            return text;
                          })
                          .join("\n");

                        const itemsTotal = calculateItemsTotal(
                          selectedOrder.items,
                        );
                        const deliveryFee = Number(
                          selectedOrder.deliveryFee || 0,
                        );
                        const discount = Number(
                          (selectedOrder as any).discountAmount ||
                            (selectedOrder as any).discount ||
                            0,
                        );
                        const promoCode = (selectedOrder as any).promoCode;
                        const isFree =
                          selectedOrder.deliveryFee === 0 ||
                          (selectedOrder as any).isFreeDelivery ||
                          (selectedOrder as any).deliveryType === "free";
                        const actualDeliveryFee = isFree ? 0 : deliveryFee;
                        const finalTotal =
                          itemsTotal + actualDeliveryFee - discount;

                        let message = `*طلب مدفوع من الموقع*\n\n`;
                        message += `*رقم الفاتورة/الطلب:* ${invId}\n`;
                        message += `*العميل:* ${customerName}\n`;
                        message += `*الهاتف:* ${selectedOrder.customerPhone || selectedOrder.phone || ""}\n`;
                        message += `*المنطقة/العنوان:* ${(typeof selectedOrder.address === "object" ? selectedOrder.address?.region : selectedOrder.address) || "غير محدد"}\n\n`;
                        message += `الطلب:\n${itemsText}\n\n`;
                        message += `المجموع: ${itemsTotal.toFixed(3)} د.ك\n`;
                        if (actualDeliveryFee > 0)
                          message += `رسوم التوصيل: ${actualDeliveryFee.toFixed(3)} د.ك\n`;
                        if (discount > 0)
                          message += `الخصم ${promoCode ? `(${promoCode})` : ""}: -${discount.toFixed(3)} د.ك\n`;
                        message += `إجمالي الفاتورة: ${finalTotal.toFixed(3)} د.ك\n\n`;
                        message += `*رابط التتبع:* https://alturathkw.shop/track?phone=${selectedOrder.customerPhone || selectedOrder.phone}`;

                        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                        window.open(whatsappUrl, "_blank");
                      }}
                      className="flex items-center justify-center gap-3 w-full p-4 rounded-2xl bg-[#25D366] text-white font-extrabold text-sm hover:bg-[#128C7E] transition-all shadow-md outline-none mb-6"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.46-1.761-1.633-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                      </svg>
                      حفظ كـ رسالة في واتس آب
                    </button>
                  )}
                </div>

                {/* Unrolling Receipt Effect Container for Order Details */}
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{
                    height: "auto",
                    opacity: 1,
                    y: getStatusDisplay(selectedOrder).text.includes("توصيل")
                      ? [-10, 10, -10]
                      : 0,
                    rotate: getStatusDisplay(selectedOrder).text.includes(
                      "توصيل",
                    )
                      ? [-1, 1, -1]
                      : 0,
                  }}
                  transition={{
                    height: { duration: 0.8, ease: "easeOut", delay: 0.2 },
                    opacity: { duration: 0.8, ease: "easeOut", delay: 0.2 },
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                    rotate: {
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                  className="relative bg-white sm:rounded-[32px] mx-0 sm:mx-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 overflow-hidden mt-6"
                >
                  {/* Receipt zig-zag top edge */}
                  <div
                    className="absolute top-0 left-0 right-0 h-3"
                    style={{
                      background:
                        "linear-gradient(-45deg, transparent 33.33%, #fff 33.33%, #fff 66.66%, transparent 66.66%), linear-gradient(45deg, transparent 33.33%, #fff 33.33%, #fff 66.66%, transparent 66.66%)",
                      backgroundSize: "12px 24px",
                    }}
                  />

                  {/* Status update timestamp pretending to be a printed line */}
                  <div className="pt-8 px-4 sm:px-8 pb-8 space-y-8">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={getStatusDisplay(selectedOrder).text}
                      className="font-mono text-xs text-stone-400 border-b border-dashed border-stone-100 pb-2 flex justify-between"
                    >
                      <TypewriterText
                        text={`> UPDATE: ${getStatusDisplay(selectedOrder).text}`}
                        delay={0.3}
                      />
                      <TypewriterText
                        text={new Date().toLocaleTimeString("en-US", {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        delay={0.6}
                      />
                    </motion.div>

                    {/* Items List */}
                    <div className="space-y-4">
                      
                      <h4 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-2 font-mono border-b border-dashed border-stone-100 pb-2">
                        الأصناف المطلوبة
                      </h4>
                      <div className="space-y-3 font-mono">
                        {selectedOrder.items?.map((item, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 + i * 0.15 }}
                            className="flex items-center justify-between p-2 sm:p-4 bg-stone-50/50 border-b border-dashed border-stone-100 last:border-b-0"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-extrabold text-stone-400 shrink-0">
                                {item.quantity}x
                              </span>
                              <div className="flex flex-col">
                                <TypewriterText
                                  className="font-bold text-stone-700 text-sm max-w-[150px] sm:max-w-xs"
                                  text={item.productName || item.name}
                                  delay={0.8 + i * 0.15}
                                />
                                {(item.itemNotes || item.note) && (
                                  <span className="text-[10px] text-stone-400 italic flex items-center gap-1 mt-1">
                                    <MessageCircle className="w-3 h-3" />
                                    <TypewriterText
                                      text={item.itemNotes || item.note}
                                      delay={1.2 + i * 0.15}
                                    />
                                  </span>
                                )}
                              </div>
                            </div>
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 1 + i * 0.15 }}
                              className="text-sm font-bold text-stone-600 shrink-0"
                            >
                              {Number(item.price * item.quantity || 0).toFixed(
                                3,
                              )}{" "}
                              <span className="text-[10px] text-stone-400">
                                د.ك
                              </span>
                            </motion.span>
                          </motion.div>
                        ))}
                      </div>
                      
                      {/* Squad Bragging Rights */}
                      {((selectedOrder as any).squadName || (squadInfo && squadInfo.name)) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 1 }}
                          className="mt-6 bg-[#FFFBEB] rounded-2xl p-4 border border-[#FDE68A] flex flex-col items-center justify-center gap-2 text-center"
                        >
                           <Crown className="w-7 h-7 text-[#F59E0B]" strokeWidth={2} />
                           <p className="text-sm font-bold text-[#92400E]">
                             عضو في "{(selectedOrder as any).squadName || squadInfo?.name}"
                           </p>
                           <p className="text-[#D97706] text-xs font-bold leading-tight">
                             {squadInfo?.rank ? `المركز ${squadInfo.rank === 1 ? "الأول" : squadInfo.rank === 2 ? "الثاني" : squadInfo.rank === 3 ? "الثالث" : squadInfo.rank} ${squadInfo.rank === 1 ? '🥇' : squadInfo.rank === 2 ? '🥈' : squadInfo.rank === 3 ? '🥉' : ''}` : `تصنيف: ${((selectedOrder as any).squadTier || squadInfo?.tier || "غير محدد")}`}
                           </p>
                        </motion.div>
                      )}
                    </div>

                    {/* Notes Section */}
                    {(selectedOrder as any).notes ||
                    (selectedOrder as any).generalNotes ? (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-2">
                          ملاحظات عامة
                        </h4>
                        <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-2xl text-orange-800 text-sm flex gap-3">
                          <MessageCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p>
                            {(selectedOrder as any).notes ||
                              (selectedOrder as any).generalNotes}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {/* Address Details */}
                    {selectedOrder.address && (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest px-2">
                          معلومات العميل والتوصيل
                        </h4>
                        <div className="bg-white border border-stone-100 p-6 rounded-[32px] space-y-4 font-medium text-brand text-sm shadow-sm">
                          <div className="flex items-center justify-between font-bold border-b border-stone-100 pb-4">
                            <span className="truncate pr-2">
                              {selectedOrder.customerName}
                            </span>
                            <span
                              dir="ltr"
                              className="text-stone-500 font-mono text-xs"
                            >
                              {selectedOrder.customerPhone ||
                                (selectedOrder as any).phone}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 pt-2">
                            <MapPin className="w-5 h-5 text-accent shrink-0" />
                            <span>
                              {typeof selectedOrder.address === "object"
                                ? `${selectedOrder.address.region}، قطعة ${selectedOrder.address.block}`
                                : selectedOrder.address}
                            </span>
                          </div>
                          {typeof selectedOrder.address === "object" && (
                            <div className="grid grid-cols-2 gap-4 text-stone-500 text-xs mr-8 leading-relaxed">
                              <div>شارع: {selectedOrder.address.street}</div>
                              <div>منزل: {selectedOrder.address.building}</div>
                              {selectedOrder.address.avenue && (
                                <div>جادة: {selectedOrder.address.avenue}</div>
                              )}
                              {selectedOrder.address.floor && (
                                <div>دور: {selectedOrder.address.floor}</div>
                              )}
                              {selectedOrder.address.apartment && (
                                <div>
                                  شقة: {selectedOrder.address.apartment}
                                </div>
                              )}
                              {selectedOrder.address.extraDetails && (
                                <div className="col-span-2">
                                  إضافات: {selectedOrder.address.extraDetails}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-8 bg-stone-50/50 border-t border-stone-100 flex flex-col gap-4">
                    {selectedOrder.deliveryFee !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-stone-400 font-bold uppercase tracking-widest">
                          رسوم التوصيل
                        </span>
                        <span className="font-extrabold text-brand italic">
                          {(selectedOrder as any).deliveryType === "free" ||
                          selectedOrder.deliveryFee === 0 ||
                          selectedOrder.isFreeDelivery ? (
                            <div className="flex items-center gap-2">
                              <span className="text-green-500 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> توصيل مجاني
                              </span>
                            </div>
                          ) : (
                            `${Number(selectedOrder.deliveryFee || 0).toFixed(3)} د.ك`
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-stone-100/50">
                      <span className="text-stone-400 font-extrabold text-xs uppercase tracking-widest">
                        إجمالي المبلغ
                      </span>
                      <span className="text-3xl font-extrabold text-brand italic">
                        {Number(getDisplayTotal(selectedOrder) || 0).toFixed(3)}{" "}
                        <span className="text-xs text-accent font-normal not-italic">
                          د.ك
                        </span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white to-transparent pointer-events-none z-0">
        <div className="max-w-2xl mx-auto flex flex-col items-center opacity-10">
          <div className="w-32 h-1 bg-brand rounded-full mb-2" />
        </div>
      </footer>
    </div>
  );
}
