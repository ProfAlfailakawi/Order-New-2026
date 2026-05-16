import { DEFAULT_GLOBAL_LOGO } from "../constants";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  Check,
  ArrowRight,
  MessageCircle,
  MapPin,
  Phone,
  User,
  Landmark,
  Home,
  Layers,
  Hash,
  Search,
  AlertCircle,
  ShoppingBag,
  Sparkles,
  Star,
  Flame,
  Gift,
  LayoutDashboard,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  PartyPopper,
} from "lucide-react";
import { Product, OrderItem, Order, Address, Region } from "../types";
import { db } from "../lib/firebase";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  cn,
  normalizePhone,
  normalizeDigits,
  isValidPhone,
  checkStoreStatus,
} from "../utils";
import { redirectToPayment } from "../utils/redirect";
import { ZenSplashScreen } from "../components/ZenSplashScreen";
import { DynamicEnvironment } from "../components/DynamicEnvironment";

const INITIAL_ADDRESS: Address = {
  region: "",
  block: "",
  street: "",
  avenue: "",
  building: "",
  floor: "",
  apartment: "",
  deliveryNotes: "",
};

const triggerHapticAndSound = (type?: "success" | "click") => {
  try {
    if (navigator.vibrate) navigator.vibrate(50);
  } catch (e) {}
  try {
    const audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();

    if (type === "success") {
      // Elegant Success Chime (Musical Arpeggio)
      const playTone = (freq: number, time: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + duration);
      };

      const now = audioCtx.currentTime;
      playTone(523.25, now, 0.4); // C5
      playTone(659.25, now + 0.1, 0.4); // E5
      playTone(783.99, now + 0.2, 0.4); // G5
      playTone(1046.5, now + 0.3, 0.6); // C6
    } else {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        300,
        audioCtx.currentTime + 0.05,
      );
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioCtx.currentTime + 0.05,
      );
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.05);
    }
  } catch (e) {}
};

export default function CustomerSite() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckout, setIsCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderSuccessId, setOrderSuccessId] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [orderPaymentLink, setOrderPaymentLink] = useState("");

  const [lastOrderInfo, setLastOrderInfo] = useState<any>(null);
  const [isZeroClickLoading, setIsZeroClickLoading] = useState(false);

  const [orderSuccessCustomerData, setOrderSuccessCustomerData] = useState({
    name: "",
    phone: "",
  });

  const [customerName, setCustomerName] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPoints, setCustomerPoints] = useState(0);
  const [address, setAddress] = useState<Address>(INITIAL_ADDRESS);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [moodQuery, setMoodQuery] = useState("");
  const [moodMessage, setMoodMessage] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState("الكل");

  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState("");

  const [fomoPurchases, setFomoPurchases] = useState<any[]>([]);
  const [fomoIndex, setFomoIndex] = useState(0);
  const [showFomo, setShowFomo] = useState(false);
  const moodPlaceholders = useMemo(() => [
    "شلون مزاجك اليوم؟ أو عندك عزيمة؟ اكتب ونفزع لك! 👨‍🍳",
    "شنو بخاطرك اليوم؟ اكتب اللي بقلبك ومالك إلا يرضيك 🎯",
    "يوعان ومحتار؟ عطني وضعك وأنا أضبطك 🚀",
    "متوهق بضيوف فجأة؟ الفزعة عندي، بس اكتب 🏃‍♂️",
    "مشتهي شيء معين؟ لا تدور.. اكتب وأنا أجيبه لك 🌟",
    "مزاجك يبي شيء خفيف والا دسم؟ سولف لي 🍔"
  ], []);

  const [currentPlaceholder, setCurrentPlaceholder] = useState(moodPlaceholders[0]);

  useEffect(() => {
    const getRand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    setCurrentPlaceholder(getRand(moodPlaceholders));
    
    const interval = setInterval(() => {
        setCurrentPlaceholder(getRand(moodPlaceholders));
    }, 4000);
    
    return () => clearInterval(interval);
  }, [moodPlaceholders]);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [activeStory, setActiveStory] = useState<string>("الكل");
  const [showFlashSale, setShowFlashSale] = useState(false);
  const [smartPick, setSmartPick] = useState<any>(null); // Re-adding smartPick
  const [flyingPlates, setFlyingPlates] = useState<
    { id: string; img: string; startX: number; startY: number }[]
  >([]);
  const [cartBouncing, setCartBouncing] = useState(false);

  // Replace old hesitation state with a more robust Decision Psychology Engine state
  const [psychMessage, setPsychMessage] = useState<{
    title: string;
    desc: string;
    actionText?: string;
    product?: any;
  } | null>(null);

  // Auto-dismiss psychMessage after 6 seconds
  useEffect(() => {
    if (psychMessage) {
      const timer = setTimeout(() => {
        setPsychMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [psychMessage]);

  // Auto-dismiss Flash Sale after 4 seconds
  useEffect(() => {
    if (showFlashSale) {
      const timer = setTimeout(() => {
        setShowFlashSale(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showFlashSale]);

  // Golden Hour Themes: Morning, Noon, Night ambiance with varied phrases
  const goldenHourTheme = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12)
      return {
        id: "morning",
        name: "نسمة صباح",
        bg: "bg-[#fdfbf7]", // Soft daylight
        accent: "text-sky-600",
        description: "ريوق الطيبين والبدايات الحلوة",
      };
    if (hour >= 12 && hour < 16)
      return {
        id: "noon",
        name: "زة الظهر",
        bg: "bg-[#fffaf0]", // Bright sunny
        accent: "text-amber-500",
        description: "وقت المكابيس والعيوش السنعة",
      };
    if (hour >= 16 && hour < 18)
      return {
        id: "sunset",
        name: "وقت الغروب",
        bg: "bg-[#fff1e5]", // Warm orange/peach gradient feel
        accent: "text-orange-500",
        description: "أجواء دافية وجلسة رايقة",
        extraShadow: "shadow-[inset_0_0_100px_rgba(255,165,0,0.05)]",
      };
    return {
      id: "night",
      name: "جمعة أهل",
      bg: "bg-[#f5f5f7]", // Deeper gray/stone for night
      accent: "text-indigo-600",
      description: "عشاكم يطيب مع سوالف الليل",
    };
  }, []);

  // Heritage Accents: Tannour Heat Status with more variety
  const tannourStatus = useMemo(() => {
    const { isOpen } = checkStoreStatus(settings?.storeStatus);
    const hour = new Date().getHours();

    if (!isOpen)
      return { text: "في أمان الله", color: "text-stone-400", pulse: false };

    const isPeak = (hour >= 12 && hour <= 15) || (hour >= 19 && hour <= 21);
    if (isPeak)
      return { text: "المطبخ شعلة", color: "text-orange-500", pulse: true };
    return { text: "جاهزين لخدمتكم", color: "text-emerald-600", pulse: true };
  }, [settings?.storeStatus]);

  // Decision Psychology: Smart Combo Suggestions
  useEffect(() => {
    if (cart.length > 3 && !sessionStorage.getItem("comboSuggestionSeen")) {
      const timer = setTimeout(() => {
        setPsychMessage({
          title: "شكلها جمعة أهل؟",
          desc: "عندنا صواني تراثية تكفيكم وتوفر عليكم! تبون نمر على الصواني الكبيرة؟",
          actionText: "مشاهدة الصواني التراثية",
        });
        sessionStorage.setItem("comboSuggestionSeen", "true");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [cart.length]);

  useEffect(() => {
    if (!sessionStorage.getItem("flashSaleSeen") && topProducts.length > 0) {
      const t = setTimeout(() => {
        const phrases = [
          "شي خيال جربه!",
          "يبيله التجربة اليوم؟",
          "الطعم الأصيل اللي يعدل المزاج!",
          "شنو بخاطرك ناكل اليوم؟",
        ];
        const randomPhrase =
          phrases[Math.floor(Math.random() * phrases.length)];

        // Filter top products to ensure they are under 15 KD and in stock
        const eligibleItems = topProducts.filter(
          (p) => (p.basePrice || p.price || 0) < 15 && !p.isOutOfStock,
        );

        if (eligibleItems.length > 0) {
          const randomItem =
            eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
          setSmartPick({ item: randomItem, phrase: randomPhrase });
          setShowFlashSale(true);
          sessionStorage.setItem("flashSaleSeen", "true");
        }
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [topProducts]);

  useEffect(() => {
    let lastScroll = 0;
    let scrollChanges = 0;
    let checkoutTimer: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      const currentScroll = window.scrollY;
      if (Math.abs(currentScroll - lastScroll) > 100) {
        scrollChanges++;
        lastScroll = currentScroll;
      }

      // 1. Scrolling hesitation (Did not add to cart yet)
      if (
        scrollChanges > 8 &&
        !sessionStorage.getItem("hesitationSeen") &&
        products.length > 0 &&
        cart.length === 0 &&
        !isCheckout
      ) {
        const affordableBestSellers = products.filter(
          (p) => (p.isTopSeller || p.category?.includes("الأكثر")) && (p.price || p.basePrice || 0) < 15 && !p.isOutOfStock,
        );
        const affordableProducts = products.filter(
          (p) => (p.price || p.basePrice || 0) < 15 && !p.isOutOfStock,
        );
        const listToUse = affordableBestSellers.length > 0 ? affordableBestSellers : affordableProducts;
        if (listToUse.length > 0) {
          const suggestion =
            listToUse[
              Math.floor(Math.random() * Math.min(3, listToUse.length))
            ];

          let title =
            customerPoints > 0 ? `أهلاً بعودتك، محتار؟` : `محتار شنو تختار؟`;
          if (customerName) {
            title = `${customerName}، محتار اليوم؟`;
          }

          setPsychMessage({
            title,
            desc: `أكثر عملائنا حبو ${suggestion.name}، متوفر الحين وتقدر تطلبه.`,
            actionText: `ألقِ نظرة! (${suggestion.price} د.ك)`,
            product: suggestion,
          });
          sessionStorage.setItem("hesitationSeen", "true");
        }
        scrollChanges = 0;
      }
    };

    // 2. Stopped at Checkout
    if (isCheckout && cart.length > 0 && !orderSuccess) {
      checkoutTimer = setTimeout(() => {
        if (!sessionStorage.getItem("checkoutHesitationSeen")) {
          const title =
            customerPoints > 0 ? "كل شي تمام يا بطل؟" : "خطوة وحدة وتخلص!";
          setPsychMessage({
            title,
            desc: "طلبك جاهز بالمقادير اللي اخترتها، بس ناقص نأكده عشان نبدأ بالتجهيز فوراً.",
          });
          sessionStorage.setItem("checkoutHesitationSeen", "true");
        }
      }, 15000); // 15 seconds in checkout
    } else {
      if (checkoutTimer) clearTimeout(checkoutTimer);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (checkoutTimer) clearTimeout(checkoutTimer);
    };
  }, [products, cart, isCheckout, customerPoints, customerName, orderSuccess]);

  const moodResponses = useMemo(() => ({
    gathering: [
      "لا تحاتي ياخوي، صوانينا تبيّض الوجه وبتوصلك حارة! الفزعة عندنا 🚀",
      "ضيوف فجأة؟ خلك مرتاح، الصواني الكبيرة بتوصلك تبيض الوجه قدام ربعك 😎",
      "زوارة أو ديوانية.. لا تشيل هم الأكل، الشيف مجهز لك صواني ترفع الرأس 👑"
    ],
    sick: [
      "سلامات ما تشوف شر 🤍 هذي أطباق خفيفة وشوربات دافية ترد الروح!",
      "أجر وعافية يا رب 🌿.. يبيلك شيء دافي وخفيف على المعدة يضبط صحتك.",
      "طحت مريض؟ الشيف جهز لك خوش شوربة ووجبات صحية تدفيك وتقويك 🍵"
    ],
    sad: [
      "روّق مزاجك! ماكو شيء يسوى، وهالحلو بيعدل يومك 🍫✨",
      "الدنيا ما تسوى زعلك.. اطلب الحلو اللي يخفف على قلبك ويفتح النفس 🍰",
      "المزاج مو اوكي؟ صدقني شوية سكر وكاكاو بيغيرون النكد لفرح.. دلع نفسك 🎂"
    ],
    late: [
      "تسهر بروحك؟ خلك معاي أدلعك بهالطلبات اللي تنسيك تعب اليوم 🌙🍔",
      "يوع آخر الليل ما يرحم.. اطلب لك اللي بخاطرك وكمل سهرتك فيه 🍟",
      "شنو مقعدك لي هالحزة؟ جوع؟ الشيف بعده زاهب ويجهز لك خوش طلب! 🍕"
    ],
    general: [
      "اطلب وتمنى.. الشيف تحت أمرك اليوم! 👨‍🍳",
      "شنو بخاطرك؟ اكتب اللي مشتهيه ونطلعه لك من تحت الأرض! 😋",
      "آمر وتدلل.. المنيو كله لعيونك! قل لي شنو يوعان؟ 🍽️"
    ]
  }), []);

  useEffect(() => {
    if (!moodQuery.trim()) {
      setMoodMessage(null);
      setMoodFilter("الكل");
      return;
    }

    const q = moodQuery.toLowerCase();
    
    // We use the length of the query to deterministically pick a response
    // so it doesn't flicker on every keystroke, but it seems randomly selected
    const getDeterministicMsg = (arr: string[]) => arr[moodQuery.length % arr.length];

    let msg = "";
    let filter = "الكل";

    if (q.includes("ضيف") || q.includes("عزيم") || q.includes("متوهق") || q.includes("ربع") || q.includes("ديواني")) {
      msg = getDeterministicMsg(moodResponses.gathering);
      filter = "صواني";
    } else if (q.includes("مريض") || q.includes("تعب") || q.includes("برد") || q.includes("زكام") || q.includes("معدت")) {
      msg = getDeterministicMsg(moodResponses.sick);
      filter = "خفيف";
    } else if (q.includes("زعلان") || q.includes("متضايق") || q.includes("حلو") || q.includes("كاكاو") || q.includes("ضيق")) {
      msg = getDeterministicMsg(moodResponses.sad);
      filter = "حلو";
    } else if (q.includes("سهران") || q.includes("يوع") || q.includes("جوع") || q.includes("ليل")) {
      msg = getDeterministicMsg(moodResponses.late);
      filter = "سهران";
    }

    // Debounce feeling
    const timer = setTimeout(() => {
      if (msg) {
        setMoodMessage(msg);
        setMoodFilter(filter);
      } else {
        setMoodMessage(getDeterministicMsg(moodResponses.general));
        setMoodFilter("بحث");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [moodQuery, moodResponses]);

  const validatePromo = async () => {
    if (!promoCodeInput.trim()) return;
    setIsValidatingPromo(true);
    setPromoError("");
    try {
      const res = await fetch("/api/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCodeInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setAppliedPromo(data.promo);
        setPromoCodeInput("");
      } else {
        setPromoError(data.error || "كوبون غير صالح");
      }
    } catch (e) {
      setPromoError("حدث خطأ أثناء التحقق من الكوبون");
    } finally {
      setIsValidatingPromo(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success" || payment === "failed" || payment === "error") {
      navigate(`/track${window.location.search}`, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (formError) setFormError(null);
  }, [
    customerName,
    customerPhone,
    address.region,
    address.block,
    address.street,
    address.building,
    isCheckout,
  ]);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (customerPhone.length < 8) {
        setCustomerPoints(0);
        setLastOrderInfo(null);
        return;
      }
      try {
        let foundCustomer = false;

        let fetchedLastOrder = null;
        try {
          const trackRes = await fetch(
            `/api/track-orders?phone=${encodeURIComponent(customerPhone)}`,
            {
              headers: { Accept: "application/json" },
            },
          );
          if (trackRes.ok) {
            const txt = await trackRes.text();
            const orders = JSON.parse(txt);
            if (orders && orders.length > 0) {
              const successfulOrder = orders.find((o: any) => {
                let rawStatus = o.status;
                if (!rawStatus) {
                  if (o.paymentStatus === "paid")
                    rawStatus = "تم الدفع وجاري التوصيل";
                  else if (o.paymentStatus === "failed")
                    rawStatus = "فشل في عملية الدفع";
                  else rawStatus = "جديد";
                }
                const s = String(rawStatus).toLowerCase();

                // Don't pull data from explicitly failed or cancelled orders
                if (
                  s.includes("cancel") ||
                  s.includes("ملغي") ||
                  o.paymentStatus === "failed" ||
                  s.includes("فشل") ||
                  s.includes("failed")
                ) {
                  return false;
                }
                
                // Allow "جديد", "بانتظار" (pending), "قيد تجميع" etc. as valid enough to extract customer name/address!
                // because new customers will only have a "pending/new" order.
                return true;
              });
              if (successfulOrder) {
                fetchedLastOrder = successfulOrder;
                setLastOrderInfo(successfulOrder);
              } else {
                setLastOrderInfo(null);
              }
            }
          }
        } catch (e) {}

        // Try Customers API
        const customerRes = await fetch(
          `/api/customers?phone=${encodeURIComponent(customerPhone)}`,
        );
        if (customerRes.ok) {
          let customers: any = null;
          try {
            const txt = await customerRes.text();
            customers = JSON.parse(txt);
          } catch (e) {}
          if (customers && customers.length > 0) {
            const customerData = [...customers].sort((a: any, b: any) => {
              const aTime = a.lastUpdated || "";
              const bTime = b.lastUpdated || "";
              return bTime.localeCompare(aTime);
            })[0];

            if (customerData.name || customerData.customerName) {
              setCustomerName(
                customerData.name || customerData.customerName || "",
              );
            }
            if (customerData.address && Object.keys(customerData.address).length > 0) {
              if (typeof customerData.address === "string") {
                 setAddress((prev: Address) => ({
                   ...INITIAL_ADDRESS,
                   ...prev,
                   deliveryNotes: customerData.address
                 }));
              } else {
                 setAddress((prev: Address) => ({
                   ...INITIAL_ADDRESS,
                   ...prev,
                   ...customerData.address,
                 }));
              }
            } else if (fetchedLastOrder && fetchedLastOrder.address) {
              // Fallback to latest order's address if customer profile lacks it
              if (typeof fetchedLastOrder.address === "string") {
                  setAddress((prev: Address) => ({
                    ...INITIAL_ADDRESS,
                    ...prev,
                    deliveryNotes: fetchedLastOrder.address,
                  }));
              } else {
                  setAddress((prev: Address) => ({
                    ...INITIAL_ADDRESS,
                    ...prev,
                    ...fetchedLastOrder.address,
                  }));
              }
            }
            
            if (!customerData.name && !customerData.customerName && fetchedLastOrder && fetchedLastOrder.customerName) {
              setCustomerName(fetchedLastOrder.customerName || "");
            }
            setCustomerPoints(customerData.loyaltyPoints || 0);
            setIsLocked(true);
            foundCustomer = true;
          }
        }

        // Use last order info if no customer profile
        if (!foundCustomer) {
          if (fetchedLastOrder) {
            if (fetchedLastOrder.customerName) {
              setCustomerName(fetchedLastOrder.customerName || "");
            }
            if (fetchedLastOrder.address) {
              if (typeof fetchedLastOrder.address === "string") {
                  setAddress((prev: Address) => ({
                    ...INITIAL_ADDRESS,
                    ...prev,
                    deliveryNotes: fetchedLastOrder.address,
                  }));
              } else {
                  setAddress((prev: Address) => ({
                    ...INITIAL_ADDRESS,
                    ...prev,
                    ...fetchedLastOrder.address,
                  }));
              }
            }
            setCustomerPoints(0);
            setIsLocked(true);
          } else {
            setCustomerPoints(0);
          }
        }
      } catch (e: any) {
        if (e && e.message && (e.message.includes("Failed to fetch") || e.message.includes("Load failed"))) {
           // ignore silently
        } else {
           console.error("Error fetching customer:", e);
        }
        setCustomerPoints(0);
      }
    };

    const timer = setTimeout(fetchCustomer, 250);
    return () => clearTimeout(timer);
  }, [customerPhone]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (fomoPurchases.length === 0 || isCheckout) {
      if (isCheckout) setShowFomo(false);
      return;
    }
    const showT = setTimeout(() => setShowFomo(true), 15000); // Wait 15s
    const hideT = setTimeout(() => {
      setShowFomo(false);
      setTimeout(() => {
        setFomoIndex((p) => (p + 1) % fomoPurchases.length);
      }, 500);
    }, 20000); // Hide 5s later

    return () => {
      clearTimeout(showT);
      clearTimeout(hideT);
    };
  }, [fomoPurchases.length, fomoIndex, isCheckout]);

  function getRelativeTime(timestamp: string | number) {
    if (!timestamp) return "قبل قليل";
    const diffInMinutes = Math.floor(
      (Date.now() - new Date(timestamp).getTime()) / 60000,
    );
    if (diffInMinutes < 1) return "الآن";
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `منذ ${diffInDays} يوم`;
  }

  useEffect(() => {
    let isMounted = true;
    const fetchWithRetry = async (url: string, retries = 3, delay = 1500) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              try {
                const text = await res.text();
                return JSON.parse(text);
              } catch (e) {
                return null;
              }
            } else {
              console.warn(
                `Expected JSON response from ${url}, got ${contentType}`,
              );
              return null; // Not JSON, probably SPA fallback returning index.html
            }
          }
          console.error(`Fetch failed for ${url} with status ${res.status}`);
          break; // if 500 error or similar, no need to retry network connection
        } catch (e: any) {
          if (
            e &&
            e.message &&
            (e.message.includes("Load failed") ||
              e.message.includes("Failed to fetch"))
          ) {
            // Silently ignore
          } else {
            console.error(`Fetch error for ${url}:`, e);
          }
          if (i === retries - 1) return null;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      return null;
    };

    const loadData = async () => {
      try {
        Promise.all([
          fetchWithRetry("/api/products").then((allProducts) => {
            if (!isMounted) return;
            setProducts(Array.isArray(allProducts) ? allProducts : []);
          }),
          fetchWithRetry("/api/top-products").then(d => { if (isMounted) setTopProducts(d || []); }),
          fetchWithRetry("/api/recent-fomo", 1).then(d => { 
             if (isMounted && Array.isArray(d) && d.length > 0) {
                 const enrichedFomo = d.map(item => {
                    const rnd = Math.random();
                    if (rnd > 0.85) return { ...item, type: 'insight' };
                    if (rnd > 0.6) return { ...item, type: 'trend' };
                    if (rnd > 0.4) return { ...item, type: 'scarcity' };
                    return { ...item, type: 'normal' };
                 });
                 setFomoPurchases(enrichedFomo);
             }
          }),
          fetchWithRetry("/api/regions").then(d => { 
            const sorted = [...(d || [])].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "", "ar"));
            if (isMounted) setRegions(sorted);
          }),
          fetchWithRetry("/api/settings").then(d => { if (isMounted && d) setSettings(d); }),
          fetchWithRetry("/api/debug", 1).then(d => { if (isMounted && d) console.log(d); })
        ]).catch((err: any) => {
          if (err && err.message && (err.message.includes("Failed to fetch") || err.message.includes("Load failed"))) return;
          console.error(err);
        });
      } catch (err: any) {
        if (err && err.message && (err.message.includes("Failed to fetch") || err.message.includes("Load failed"))) return;
        console.error("Error initiating fetch", err);
      }
    };

    loadData();
    // Guarantee splash screen drops after exactly 2.5 seconds
    setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 2500);

    // Auto-refresh every 15 seconds to keep data live (Best Sellers, New Arrivals, etc.)
    const refreshInterval = setInterval(loadData, 15000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  const processedReorderRef = useRef<string | null>(null);

  useEffect(() => {
    const reorderId = searchParams.get("reorder");
    if (
      reorderId &&
      products.length > 0 &&
      processedReorderRef.current !== reorderId
    ) {
      processedReorderRef.current = reorderId;
      const processReorder = async () => {
        try {
          const orderRes = await fetch(
            `/api/track-orders?order_id=${reorderId}`,
          );
          if (orderRes.ok) {
            const data = await orderRes.json();
            if (data && data.length > 0) {
              const orderToReorder = data[0];
              const newCart: OrderItem[] = [];
              let someItemsMissing = false;
              for (const item of orderToReorder.items || []) {
                const product = products.find(
                  (p: any) => p.id === item.productId || p.id === item.id,
                );
                if (
                  product &&
                  product.isActive !== false &&
                  product.isHidden !== true &&
                  product.visible !== false
                ) {
                  newCart.push({
                    ...item,
                    id: Math.random().toString(36).substring(2, 9),
                    price: product.price, // Update to current price
                    product: product,
                  });
                } else {
                  someItemsMissing = true;
                }
              }
              if (newCart.length > 0) {
                setCart(newCart);
                setIsCheckout(true);
                if (someItemsMissing) {
                  setTimeout(() => {
                    setPsychMessage({
                      title: "بعض الأصناف تغيرت!",
                      desc: "لاحظنا إن بعض الأصناف من طلبك السابق مو متوفرة حالياً وشلناها من السلة لك، تقدر تكمل الطلب أو تضيف أشياء جديدة.",
                    });
                  }, 800);
                } else {
                  setTimeout(() => {
                    let itemsDesc =
                      newCart.length === 1
                        ? "نفس الطبق بالضبط جاهز بالسلة."
                        : "بنفس الأصناف اللي طلبتها سابقاً.";
                    setPsychMessage({
                      title: "طبخناه لك مرة ثانية!",
                      desc: `جهزنا تفاصيل طلبك المفضل ${itemsDesc} تقدر تضغط تأكيد ويصير عندك.`,
                    });
                  }, 800);
                }
              } else {
                setTimeout(() => {
                  setPsychMessage({
                    title: "عذراً، الطلب مخلص",
                    desc: "للأسف جميع الأصناف اللي في طلبك السابق غير متوفرة اليوم، تقدر تشوف المنيو وتجرب أطباقنا اليديدة.",
                  });
                }, 800);
              }
            }
          }
        } catch (e) {
          console.error("Error processing reorder:", e);
        }

        // Clear the query param
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("reorder");
        setSearchParams(newSearchParams, { replace: true });
      };
      processReorder();
    }
  }, [searchParams, products, setSearchParams]);

  const itemsTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.type === "percentage") {
      discountAmount = itemsTotal * (appliedPromo.value / 100);
    } else {
      discountAmount = appliedPromo.value;
    }
  }

  const total = Math.max(0, itemsTotal + deliveryFee - discountAmount);

  const handleZeroClickOrder = async () => {
    if (
      !lastOrderInfo ||
      !lastOrderInfo.items ||
      lastOrderInfo.items.length === 0
    )
      return;

    setIsZeroClickLoading(true);
    triggerHapticAndSound();

    // Check if store is open
    const { isOpen, message } = checkStoreStatus(settings?.storeStatus);
    if (!isOpen) {
      alert(message);
      setIsZeroClickLoading(false);
      return;
    }

    try {
      let bestOrderToUse = lastOrderInfo;
      let finalCart: OrderItem[] = [];
      let someItemsMissing = false;

      const tryOrder = (order: any) => {
        const tempCart: OrderItem[] = [];
        let missing = false;
        for (const item of order.items || []) {
          const product = products.find(
            (p: any) =>
              p.id === item.productId ||
              p.id === item.id ||
              p.id === item.product?.id,
          );
          if (
            product &&
            product.isActive !== false &&
            product.isHidden !== true &&
            product.visible !== false
          ) {
            tempCart.push({
              ...item,
              id: Math.random().toString(36).substring(2, 9),
              price: product.price,
              product: product,
              name: product.name,
            });
          } else {
            missing = true;
          }
        }
        return { cart: tempCart, missing };
      };

      let result = tryOrder(lastOrderInfo);

      // If last order has missing items, try to be smarter and find an older order that is fully available
      if (result.missing || result.cart.length === 0) {
        try {
          const trackRes = await fetch(
            `/api/track-orders?phone=${encodeURIComponent(lastOrderInfo.customerPhone || customerPhone)}`,
            {
              headers: { Accept: "application/json" },
            },
          );
          if (trackRes.ok) {
            const txt = await trackRes.text();
            const orders = JSON.parse(txt);
            if (orders && orders.length > 0) {
              const successfulOrders = orders.filter((o: any) => {
                let rawStatus = o.status || "";
                if (!o.status && o.paymentStatus === "paid")
                  rawStatus = "تم الدفع";
                const s = String(rawStatus).toLowerCase();
                if (
                  o.paymentStatus === "failed" ||
                  s.includes("فشل") ||
                  s.includes("failed")
                )
                  return false;
                if (
                  s === "جديد" ||
                  s.includes("بانتظار") ||
                  s.includes("pending") ||
                  s.includes("قيد تجميع") ||
                  s === "split"
                )
                  return false;
                if (s.includes("cancel") || s.includes("ملغي")) return false;
                return true;
              });

              // Sort by date descending
              successfulOrders.sort(
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              );

              let foundAlternative = false;
              // Try to find a fully available older order
              for (const prevOrder of successfulOrders) {
                if (prevOrder.id === lastOrderInfo.id) continue;
                const res = tryOrder(prevOrder);
                if (!res.missing && res.cart.length > 0) {
                  bestOrderToUse = prevOrder;
                  result = res;
                  foundAlternative = true;
                  break;
                }
              }

              // If no strictly fully available order, settle for one that has at least some items
              if (!foundAlternative && result.cart.length === 0) {
                for (const prevOrder of successfulOrders) {
                  if (prevOrder.id === lastOrderInfo.id) continue;
                  const res = tryOrder(prevOrder);
                  if (res.cart.length > 0) {
                    bestOrderToUse = prevOrder;
                    result = res;
                    break;
                  }
                }
              }
            }
          }
        } catch (err: any) {
          if (err && err.message && (err.message.includes("Failed to fetch") || err.message.includes("Load failed"))) {
             // ignore
          } else {
            console.error(
              "Failed to fetch past orders for alternative zero-click:",
              err,
            );
          }
        }
      }

      finalCart = result.cart;
      someItemsMissing = result.missing;
      const isUsingAlternative = bestOrderToUse.id !== lastOrderInfo.id;

      if (finalCart.length > 0) {
        setCart(finalCart);
        setIsCheckout(true);
        if (isUsingAlternative) {
          setTimeout(() => {
            setPsychMessage({
              title: "طلبك الأخير مو متوفر!",
              desc: "أصناف طلبك الأخير متوقفة مؤقتاً، فعرضنا لك طلبك اللي قبله عشان ما تتأخر!",
            });
          }, 800);
        } else if (someItemsMissing) {
          setTimeout(() => {
            setPsychMessage({
              title: "بعض الأصناف تغيرت!",
              desc: "لاحظنا إن بعض الأصناف من طلبك السابق مو متوفرة حالياً وشلناها من السلة لك، تقدر تكمل الطلب أو تضيف أشياء جديدة.",
            });
          }, 800);
        } else {
          setTimeout(() => {
            let itemsDesc =
              finalCart.length === 1
                ? "نفس الطلب بالضبط جاهز بالسلة."
                : "بنفس الأصناف اللي طلبتها سابقاً.";
            setPsychMessage({
              title: "استكمالاً لطلبك المفضل!",
              desc: `جهزنا تفاصيل طلبك المفضل، ${itemsDesc} تقدر تضغط تأكيد ويصير عندك.`,
            });
          }, 800);
        }
      } else {
        // Creative fallback: Suggest top-sellers instead of failing
        let creativeCart: OrderItem[] = [];
        const bestSellers = products.filter(
          (p) =>
            (p.isTopSeller || p.category?.includes("الأكثر")) &&
            p.isActive !== false &&
            p.visible !== false &&
            p.isHidden !== false &&
            (p.price || 0) < 15,
        );
        const listToUse =
          bestSellers.length > 0
            ? bestSellers
            : products
                .filter(
                  (p) =>
                    p.isActive !== false &&
                    p.visible !== false &&
                    p.isHidden !== false &&
                    (p.price || 0) < 15,
                )
                .slice(0, 2);

        // Take exactly one item, or random, such that total < 15
        let currentTotal = 0;
        for (const p of listToUse) {
          if (currentTotal + (p.price || 0) > 15 && currentTotal > 0) break;
          creativeCart.push({
            id: Math.random().toString(36).substring(2, 9),
            productId: p.id,
            name: p.name,
            price: p.price,
            quantity: 1,
            product: p,
            itemNotes: "",
            selectedExtras: [],
          });
          currentTotal += p.price || 0;
          if (creativeCart.length >= 2) break;
        }

        if (creativeCart.length > 0) {
          setCart(creativeCart);
          setIsCheckout(true);
          setTimeout(() => {
            setPsychMessage({
              title: "مفاجأة الشيف لك!",
              desc: "طلباتك السابقة مو متوفرة حالياً، فضفنا لك الأكثر طلباً ومبيعاً عشان ما تحتار وتجرب شيء جديد خطير!",
            });
          }, 800);
        } else {
          alert("للأسف، جميع أصناف طلبك السابق غير متوفرة حالياً.");
        }
      }
    } catch (e) {
      alert("حدث خطأ أثناء تنفيذ الطلب.");
    } finally {
      setIsZeroClickLoading(false);
    }
  };

  const addToCart = (item: OrderItem, e?: React.MouseEvent) => {
    triggerHapticAndSound();

    if (e && (item as any).image) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const id = Date.now().toString() + Math.random();
      setFlyingPlates((prev) => [
        ...prev,
        {
          id,
          img: (item as any).image,
          startX: rect.left + rect.width / 2,
          startY: rect.top + rect.height / 2,
        },
      ]);

      setTimeout(() => {
        setCartBouncing(true);
        triggerHapticAndSound("success");
        setFlyingPlates((prev) => prev.filter((p) => p.id !== id));
        setTimeout(() => setCartBouncing(false), 500);
      }, 700);
    }

    const existingItemIndex = cart.findIndex((cartItem) => {
      if (cartItem.productId !== item.productId) return false;
      if (cartItem.selectedOption !== item.selectedOption) return false;
      if (cartItem.note !== item.note) return false;

      const cartExtras = [...(cartItem.selectedExtras || [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      const newExtras = [...(item.selectedExtras || [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      if (cartExtras.length !== newExtras.length) return false;
      for (let i = 0; i < cartExtras.length; i++) {
        if (cartExtras[i].name !== newExtras[i].name) return false;
      }
      return true;
    });

    if (existingItemIndex > -1) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += item.quantity;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        { ...item, id: Math.random().toString(36).substr(2, 9) },
      ]);
    }
    setSelectedProduct(null);
  };

  const removeFromCart = (id: string) => {
    triggerHapticAndSound();
    setCart(cart.filter((item) => item.id !== id));
  };

  useEffect(() => {
    if (address.region && regions.length > 0) {
      const normalizedSelected = address.region.trim();
      const selectedRegion = regions.find(
        (r) => r.name.trim() === normalizedSelected,
      );

      const isFreeDeliveryForced = settings?.isFreeDelivery === true;

      if (selectedRegion) {
        if (isFreeDeliveryForced) {
          setDeliveryFee(0);
          return;
        }

        const price =
          selectedRegion.finalPrice ??
          selectedRegion.deliveryPrice ??
          selectedRegion.cost ??
          selectedRegion.price ??
          selectedRegion.deliveryFee ??
          0;

        let calculatedFee = Number(price);

        // Check for threshold free delivery
        const freeDeliveryThreshold = Number(
          settings?.freeDeliveryThreshold || settings?.freeDeliveryLimit || 0,
        );

        if (freeDeliveryThreshold > 0 && itemsTotal >= freeDeliveryThreshold) {
          calculatedFee = 0;
        }

        setDeliveryFee(calculatedFee);
      } else {
        // If region entered but not found, don't default to 0 (free)
        // Set to a high value or negative to indicate "Invalid"
        setDeliveryFee(-1);
      }
    } else {
      setDeliveryFee(0);
    }
  }, [address.region, regions, itemsTotal, settings]);

  const handleRegionChange = (regionName: string) => {
    setAddress({ ...address, region: regionName });
  };

  const handleSubmitOrder = async (
    splitMode: false | "traditional" | "roulette" = false,
  ) => {
    setFormError(null);
    const requiredFields = [
      { key: "name", value: customerName, label: "الاسم" },
      { key: "phone", value: customerPhone, label: "رقم الهاتف" },
      { key: "region", value: address.region, label: "المنطقة" },
      { key: "block", value: address.block, label: "القطعة" },
      { key: "street", value: address.street, label: "الشارع" },
      { key: "building", value: address.building, label: "المنزل" },
    ];

    const missingFields = requiredFields.filter(
      (f) => !f.value || (f.key === "phone" && f.value.length !== 8),
    );

    if (missingFields.length > 0) {
      setFormError(
        `يرجى إكمال الحقول التالية: ${missingFields.map((f) => f.label).join("، ")}`,
      );
      return;
    }

    if (deliveryFee === -1) {
      setFormError(
        "عذراً، المنطقة المدخلة غير صحيحة. يرجى اختيار منطقة من القائمة.",
      );
      return;
    }

    // Region Validation (redundant but safe)
    const normalizedRegion = address.region.trim();
    const matchedRegion = regions.find(
      (r) => r.name.trim() === normalizedRegion,
    );
    if (!matchedRegion) {
      setFormError(
        "عذراً، هذه المنطقة غير مدعومة حالياً. يرجى اختيار منطقة من القائمة الظاهرة.",
      );
      return;
    }

    const { isOpen, message } = checkStoreStatus(settings?.storeStatus);
    if (!isOpen) {
      setFormError(message);
      return;
    }

    setIsSubmitting(true);

    const orderData: any = {
      customerName,
      customerPhone,
      address,
      items: cart,
      deliveryFee,
      isFreeDelivery: deliveryFee === 0 || settings?.isFreeDelivery === true,
      deliveryType: deliveryFee === 0 ? "free" : "standard",
      itemsTotal,
      discountAmount,
      promoCode: appliedPromo?.code,
      total: Number(total.toFixed(3)),
      regionId: matchedRegion.id,
      status: splitMode ? "قيد تجميع القطية" : "بانتظار الدفع",
      createdAt: new Date().toISOString(),
      source: "customer_website",
      paymentStatus: splitMode ? "split" : "pending",
      generalNotes,
    };

    if (splitMode) {
      orderData.splitType = splitMode;
    }

    try {
      // Sync to Local API (which handles firestore sync safely via Node backend)
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        let errData: any = {};
        try {
          const text = await response.text();
          errData = JSON.parse(text);
        } catch (e) {}
        setFormError(
          errData?.error || "عذراً، فشل إرسال الطلب. يرجى المحاولة مرة أخرى.",
        );
        setIsSubmitting(false);
        return;
      }

      let responseData: any;
      const responseDataText = await response.text();
      try {
        responseData = JSON.parse(responseDataText);
      } catch (e) {
        setFormError("استجابة غير متوقعة من الخادم.");
        setIsSubmitting(false);
        return;
      }
      const newOrderId = responseData.id;
      console.log("responseData:", responseData);
      console.log("newOrderId:", newOrderId);

      let paymentLink = "";
      let waLink = "";
      const isFreeOrder = orderData.total < 0.001;

      // Handle Split Bill Flow
      if (splitMode) {
        console.log("Navigating to:", `/split/${newOrderId}`);
        setIsSubmitting(false);
        navigate(`/split/${newOrderId}`);
        return;
      }

      // Handle Standard Checkout Flow
      try {
        // Create payment only if total > 0
        if (!isFreeOrder) {
          try {
            const payRes = await fetch("/api/create-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: orderData.total,
                customerName: customerName,
                customerMobile: customerPhone,
                orderId: newOrderId,
                description: `دفع للطلب رقم #${newOrderId}`,
              }),
            });
            let payData: any = {};
            const payResText = await payRes.text();
            try {
              payData = JSON.parse(payResText);
            } catch (e) {
              console.error("Payment API returned non-JSON:", payResText);
              setFormError("خطأ في نظام الدفع (" + payRes.status + ")");
              setIsSubmitting(false);
              return;
            }
            if (payData.error) {
              setFormError("خطأ في نظام الدفع: " + payData.error);
              setIsSubmitting(false);
              return;
            }
            if (payData.paymentLink) {
              paymentLink = payData.paymentLink;
            } else if (payData.data?.link) {
              paymentLink = payData.data.link;
            }

            if (paymentLink) {
              fetch(`/api/orders/${newOrderId}/payment-link`, {
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
            }
          } catch (payError) {
            console.error("Payment Link generation error:", payError);
          }
        }

        waLink = generateWhatsAppLink(
          { ...orderData, id: newOrderId } as unknown as Order,
          paymentLink,
        );
      } catch (waError) {
        console.error("WhatsApp Link Error:", waError);
      }

      // Store data for success screen before clearing
      setOrderSuccessCustomerData({ name: customerName, phone: customerPhone });
      setOrderSuccess(true);

      // Traditional Kuwaiti Audio Cue via Advanced Text-to-Speech
      triggerHapticAndSound("success");

      // Reset state and immediately redirect
      setCart([]);
      setIsCheckout(false);
      setCustomerName("");
      setCustomerPhone("");
      setAddress(INITIAL_ADDRESS);

      const p = customerPhone || (orderData as any).customerPhone;

      try {
        localStorage.setItem("customer_phone_track", p);
        localStorage.setItem("post_payment_open_order_id", newOrderId);
        window.name = p;
      } catch (e) {}

      setTimeout(() => {
        if (paymentLink) {
          const redirectStatus = redirectToPayment(paymentLink);
          if (
            redirectStatus === "opened_popup" ||
            redirectStatus === "popup_blocked"
          ) {
            navigate(
              `/track?phone=${encodeURIComponent(p)}&order_id=${newOrderId}`,
            );
          }
          return;
        }

        navigate(
          `/track?phone=${encodeURIComponent(p)}&order_id=${newOrderId}`,
        );
      }, 3500);
    } catch (error: any) {
      if (
        error &&
        error.message &&
        (error.message.includes("Load failed") ||
          error.message.includes("Failed to fetch"))
      ) {
        // Silently handle Load failed to avoid AI Studio log spam
        setFormError(
          "فشل الاتصال بالخادم. يبدو أن الخادم قيد إعادة التشغيل لتطبيق التحديثات. يرجى الانتظار 10 ثوانٍ والمحاولة مرة أخرى.",
        );
      } else {
        console.error("Order error:", error);
        setFormError(
          "حدث خطأ في الاتصال بالخادم. يرجى التأكد من اتصال الإنترنت.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async (
    orderId: string,
    orderTotal: number,
    cName: string,
    cPhone: string,
    cEmail: string = "",
  ) => {
    if (orderTotal < 0.001) {
      navigate(
        `/track?phone=${encodeURIComponent(cPhone)}&order_id=${orderId}`,
      );
      return;
    }
    try {
      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: orderTotal,
          customerName: cName,
          customerEmail: cEmail,
          customerMobile: cPhone,
          orderId: orderId,
          isPopup: window !== window.top,
          description: `دفع للطلب رقم #${orderId}`,
        }),
      });

      let data: any = {};
      const resText = await response.text();
      try {
        data = JSON.parse(resText);
      } catch (e) {
        console.error("Payment API returned non-JSON:", resText);
        data = {
          error: `خطأ في الخادم: ${response.status} ${resText.substring(0, 50)}`,
        };
      }

      try {
        localStorage.setItem("customer_phone_track", cPhone);
        localStorage.setItem("post_payment_open_order_id", orderId);
        window.name = cPhone;
      } catch (e) {}

      if (data.error) {
        alert("خطأ: " + data.error);
      } else if (data.paymentLink) {
        const redirectStatus = redirectToPayment(data.paymentLink);
        if (redirectStatus !== "navigating_away")
          navigate(
            `/track?phone=${encodeURIComponent(cPhone)}&order_id=${orderId}`,
          );
      } else if (data.data?.link) {
        const redirectStatus = redirectToPayment(data.data.link);
        if (redirectStatus !== "navigating_away")
          navigate(
            `/track?phone=${encodeURIComponent(cPhone)}&order_id=${orderId}`,
          );
      } else {
        alert("حدث خطأ في تجهيز رابط الدفع");
      }
    } catch (e: any) {
      if (
        e &&
        e.message &&
        (e.message.includes("Load failed") ||
          e.message.includes("Failed to fetch"))
      ) {
        alert(
          "لا يمكن الاتصال. الخادم يعيد التشغيل حالياً، يرجى الانتظار قليلاً ثم المحاولة.",
        );
      } else {
        alert("فشل الاتصال بخدمة الدفع");
      }
    }
  };

  const generateWhatsAppLink = (order: Order, paymentLink?: string) => {
    let message = `*طلب جديد من الموقع*\n`;
    message += `*رقم الطلب:* ${order.id}\n\n`;

    message += `*تفاصيل العميل:*\n`;
    message += `الاسم: ${order.customerName}\n`;
    message += `رقم التتبع الخاص بك هو رقم الطلب أعلاه.\n\n`;

    if (order.generalNotes)
      message += `*ملاحظات عامة:* ${order.generalNotes}\n`;

    message += `\n*الطلبات:*\n`;
    (order.items || []).forEach((item: any) => {
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      message += `- ${item.name} (${item.quantity}): ${itemTotal} د.ك\n`;
      if (item.selectedOption) message += `  الخيار: ${item.selectedOption}\n`;
      if (item.selectedExtras && item.selectedExtras.length > 0) {
        message += `  الإضافات: ${item.selectedExtras
          .map((e: any) => e.name)
          .join(", ")}\n`;
      }
      if (item.note) message += `  ملاحظة للمنتج: ${item.note}\n`;
    });

    message += `\n*الحساب:*\n`;
    if ((order as any).discountAmount > 0) {
      message += `الخصم (${(order as any).promoCode}): -${(order as any).discountAmount.toFixed(3)} د.ك\n`;
    }
    if (order.deliveryFee > 0) {
      message += `قيمة التوصيل: ${order.deliveryFee.toFixed(3)} د.ك\n`;
    } else {
      message += `التوصيل: مجاني\n`;
    }
    message += `*إجمالي الفاتورة: ${order.total.toFixed(3)} د.ك*\n`;

    if (paymentLink) {
      message += `\n*رابط الدفع الإلكتروني:*\n${paymentLink}\n`;
    }

    const encodedMessage = encodeURIComponent(message);
    let waNumber = order.customerPhone;

    if (!waNumber) {
      console.warn("Customer phone missing for WhatsApp Link");
      return "";
    }

    // Ensure Kuwait country code is present for 8-digit numbers
    let cleaned = waNumber.replace(/\D/g, "");
    if (cleaned.length === 8) {
      cleaned = "965" + cleaned;
    }

    return `https://wa.me/${cleaned}?text=${encodedMessage}`;
  };

  function getContextualGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "صباح الخير";
    if (hour >= 12 && hour < 17) return "مساء الخير";
    return "أهلاً بك";
  }

  const themeContext = useMemo(() => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday, 5 is Friday
    const hour = today.getHours();
    const month = today.getMonth();

    // Intelligent Product Selection based on time
    const riceProducts = products.filter(
      (p) =>
        !p.isOutOfStock &&
        (p.name?.includes("مجبوس") ||
          p.name?.includes("عيش") ||
          p.name?.includes("برياني") ||
          p.name?.includes("مطبق")),
    );
    const snackProducts = products.filter(
      (p) =>
        !p.isOutOfStock &&
        (p.name?.includes("ورق عنب") ||
          p.name?.includes("محاشي") ||
          p.name?.includes("كبة") ||
          p.name?.includes("سمبوسة") ||
          p.category?.includes("جانبي")),
    );
    const allAvailable = products.filter((p) => !p.isOutOfStock);

    const getRand = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

    const getRandomProductName = (list: any[], fallback: string) => {
      if (list.length > 0) return getRand(list).name;
      if (allAvailable.length > 0) return getRand(allAvailable).name;
      return fallback;
    };

    // Context 1: Friday Gathering (Friday 11 AM to 4 PM)
    if (day === 5 && hour >= 11 && hour <= 16) {
      const product = getRandomProductName(riceProducts, "مجبوس لحم");
      return {
        type: "friday",
        colors: "bg-green-800",
        title: getRand([
          "جمعتكم ما تكمل عيلتها؟",
          "زوارة الجمعة يبيلها الأصول",
          "يا حياكم الله بزوارة الجمعة",
        ]),
        desc: getRand([
          `شفنا طلبك حق زوارة الجمعة كذا مرة.. نظامنا يقول إن ${product} اليوم بيضبط جمعتكم لأن الشيف ضابطه ومجهزه بمقادير راهية!`,
          `الشيف اليوم محصل خوش مكونات طازجة.. وضبط لكم قصة ${product} تكفي وتوفي لكل العايلة!`,
        ]),
        image:
          "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2670&auto=format&fit=crop",
        overlay: "from-green-900 via-green-800/80 to-transparent",
        showSteam: false,
      };
    }

    // Context 2: Winter/Cold (Nov to Feb)
    if (month === 0 || month === 1 || month === 10 || month === 11) {
      const product = getRandomProductName(allAvailable, "مطبق بريميم");
      return {
        type: "winter",
        colors: "bg-[#5b3c11]", // Warm winter dark color
        title: getRand([
          "الجو غيم وبراد؟ ☁️",
          "أجواء الشتاء والبرد يمنا",
          "الجو يبيله أكل دافي يطيب الخاطر",
        ]),
        desc: getRand([
          `هذا مو اقتراح عشوائي... ذكاء التطبيق حلل إنك تحب الدفا بالشتاء، واليوم الجو بارد، فالشيف ضبط لك ${product} بهاراته وحرارته زيادة خصيصاً لهاالطقس.`,
          `ندري بخاطرك شيء يدفي.. ولأن الجو اليوم غيم، الشيف جهز لك صينية ${product} دافية تناسب هالجو من قلب!`,
        ]),
        image:
          "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2670&auto=format&fit=crop",
        overlay: "from-[#3a250a]/95 via-[#5b3c11]/70 to-transparent",
        showSteam: true,
      };
    }

    // Context 3: Morning (5 AM - 11 AM)
    if (hour >= 5 && hour < 11) {
      // Special logic for 10 AM (Lunch Prep)
      if (hour === 10) {
        const product = getRandomProductName(riceProducts, "مجبوس دجاج");
        return {
          type: "morning",
          colors: "bg-[#b67332]",
          title: "قصة الشيف اليوم 👨‍🍳",
          desc: `الشيف اليوم واصله لحم ودياي فرش من الفير.. وقرر يسوي وجبات ${product} محدودة، اطلبها الحين تضمن غدا طازج مايوصل كثر حلاته!`,
          image:
            "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2670&auto=format&fit=crop",
          overlay: "from-[#3a250a]/95 via-[#b67332]/70 to-transparent",
          showSteam: true,
        };
      }
      const product = getRandomProductName(snackProducts, "ريوق كويتي");
      return {
        type: "morning",
        colors: "bg-[#b67332]",
        title: getRand(["صباح الخير والنوير 🌻", "يا صباح السعادة والرضا ☀️"]),
        desc: getRand([
          `أدري إنك دايم تطلب بدري.. اليوم شكلك محتاج شيء قوي للدوام، ${product} فرش من الفرن راح يبدّع بيومك.`,
          `صباحك مبروك! نظامنا فهم إن مزاجك الصبح يبي ${product} حار وزاهب.. وهالطلب جاهز يطير لك خصيصاً!`,
        ]),
        image:
          "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2670&auto=format&fit=crop",
        overlay: "from-[#3a250a]/95 via-[#b67332]/70 to-transparent",
        showSteam: true,
      };
    }

    // Context 4: Lunch time
    if (hour >= 11 && hour < 16) {
      // Occasionally recommend mahashi for lunch as per user's note
      const useSnack = Math.random() > 0.7;
      const product = useSnack
        ? getRandomProductName(snackProducts, "ورق عنب")
        : getRandomProductName(riceProducts, "مجبوس لحم");

      return {
        type: "lunch",
        colors: "bg-brand",
        title: getRand([
          "غداك زاهب، حياك الله 🍛",
          "هلا بوقت الغدا السنع 🍽️",
          "قصة الشيف اليوم غير..",
        ]),
        desc: getRand([
          `مو عشوائي ترا! حللنا إن طلباتك وقت الغدا فيها ذوق مميز، واليوم الشيف حضّر وجبة ${product} كميتها محدودة بس عشان تلحق عليها وتستطعم!`,
          `الشيف اليوم محصل نعيمي فرش وقرر يسوي 20 طلب ${product} بس.. لا يطوفك هاليوم الإستثنائي!`,
        ]),
        image:
          "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2670&auto=format&fit=crop",
        overlay: "from-brand/95 via-brand/50 to-transparent",
        showSteam: false,
      };
    }

    // Context 5: Late Night
    if (hour >= 22 || hour < 3) {
      // Intelligent Night variation: sometimes rice, sometimes snacks
      const isRiceDesired = Math.random() > 0.5;
      const product = isRiceDesired
        ? getRandomProductName(riceProducts, "مجبوس لحم (نعيمي)")
        : getRandomProductName(snackProducts, "ورق عنب");

      const title = getRand([
        "يوعان بآخر الليل؟ 🌙",
        "سهرتك مو بروحك.. 🌙",
      ]);

      let desc = "";
      if (product.includes("مجبوس") || product.includes("لحم")) {
        desc = `تسهر بروحك؟ خلك معاي أدلعك بهالطبق (${product}) اللي ينسيك تعب اليوم كله ويفرش نومك راحة.`;
      } else {
        desc = `ندري سهراتج يبي لها مزاج خفيف.. عشان جذي جهزنالك ${product} على المزاج وما يثقل عالنوم!`;
      }

      return {
        type: "night",
        colors: "bg-[#1a1c29]",
        title: title,
        desc: desc,
        image:
          "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2670&auto=format&fit=crop",
        overlay: "from-[#1a1c29]/95 via-[#1a1c29]/80 to-transparent",
        showSteam: false,
      };
    }

    // Default
    const product = getRandomProductName(allAvailable, "مطبق بريميم");
    return {
      type: "default",
      colors: "bg-brand",
      title: getRand(["المذاق الأصيل", "نكهات كويتية أصيلة", "طعم يوديك بعيد"]),
      desc: getRand([
        "حيث يجتمع الماضي بالحاضر",
        `جرب ${product} واستمتع بالطعم الصح`,
        `محتار؟ عليك بـ ${product}`,
      ]),
      image:
        product && (product.includes("لحم") || product.includes("مجبوس"))
          ? "https://images.unsplash.com/photo-1544124499-58912cbddaad?q=80&w=2670&auto=format&fit=crop"
          : "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2670&auto=format&fit=crop",
      overlay: "from-brand/95 via-brand/50 to-transparent",
      showSteam: false,
    };
  }, [products]);

  return (
    <>
      <AnimatePresence>
        {isLoading && (
          <ZenSplashScreen
            logo={
              settings?.companyLogo || settings?.logo || DEFAULT_GLOBAL_LOGO
            }
          />
        )}
      </AnimatePresence>

      <DynamicEnvironment />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: 1 }}
        className={cn(
          "pb-24 max-w-2xl mx-auto min-h-screen shadow-sm text-brand overflow-x-hidden transition-colors duration-1000",
          goldenHourTheme.bg,
          goldenHourTheme.extraShadow || "",
        )}
        dir="rtl"
      >
        {/* Predictive Greeting & Zero Click Order */}
        {!isCheckout && customerPhone && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-stone-50/80 backdrop-blur-sm border-b border-stone-100 px-4 sm:px-6 py-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <span className="text-sm font-bold text-brand truncate max-w-[140px] sm:max-w-[200px]">
                    {customerName
                      ? `أهلاً ${customerName}`
                      : getContextualGreeting()}
                    ، نورتونا
                  </span>
                </div>

                {lastOrderInfo ? (
                  <button
                    onClick={handleZeroClickOrder}
                    disabled={isZeroClickLoading}
                    className="text-[11px] font-bold bg-white border border-brand/20 px-3 py-1.5 rounded-full text-brand shadow-sm hover:shadow-md hover:border-brand/40 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                  >
                    {isZeroClickLoading ? (
                      <>
                        <RefreshCcw className="w-3.5 h-3.5 animate-spin text-accent" />
                        <span>جاري التجهيز...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-3.5 h-3.5 text-accent" />
                        <span>اطلب المعتاد</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setIsCheckout(true)}
                    className="text-[10px] font-bold bg-white border border-stone-100 px-3 py-1 rounded-full text-brand hover:bg-stone-50/80 backdrop-blur-sm transition-all active:scale-95 shadow-sm shrink-0"
                  >
                    استكمال بياناتك؟
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Interactive Stories Filter */}
        {false && !isCheckout && (
          <div className="bg-stone-50/50 py-4 px-6 overflow-x-auto no-scrollbar border-b border-stone-100 flex gap-5">
            {[
              {
                title: "الكل",
                icon: <LayoutDashboard className="w-5 h-5 text-stone-500" />,
              },
              {
                title: "الأكثر مبيعاً",
                icon: <Star className="w-6 h-6 text-amber-500" />,
              },
              {
                title: "توصيل مجاني",
                icon: <Gift className="w-6 h-6 text-green-500" />,
              },
              {
                title: "تراث كويتي",
                icon: <Sparkles className="w-6 h-6 text-accent" />,
              },
            ].map((story, i) => {
              const isActive = activeStory === story.title;
              return (
                <motion.div
                  key={i}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setActiveStory(story.title);
                    const el = document.getElementById("products-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex flex-col items-center gap-2 cursor-pointer shrink-0 group w-16"
                >
                  <div
                    className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center p-1 transition-colors relative",
                      isActive
                        ? "bg-gradient-to-tr from-accent via-amber-500 to-brand"
                        : "bg-stone-200",
                    )}
                  >
                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center relative overflow-hidden shadow-inner">
                      {story.icon}
                      {isActive && (
                        <motion.div
                          animate={{ opacity: [0, 0.2, 0] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 bg-accent/20"
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold text-center leading-tight line-clamp-2",
                      isActive ? "text-brand" : "text-stone-500",
                    )}
                  >
                    {story.title}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Header */}
        <header
          className={cn(
            "sticky top-0 z-40 p-4 sm:p-6 flex items-center justify-between transition-all duration-500",
            isCheckout
              ? "bg-white border-b border-stone-100 shadow-sm"
              : "bg-white/70 backdrop-blur-2xl border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center p-0.5 bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden shrink-0">
              <img
                referrerPolicy="no-referrer"
                src={
                  settings?.companyLogo || settings?.logo || DEFAULT_GLOBAL_LOGO
                }
                onError={(e) => {
                  if (e.currentTarget.src.includes(DEFAULT_GLOBAL_LOGO)) {
                    e.currentTarget.onerror = null;
                  } else {
                    e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                  }
                }}
                alt="Logo"
                className="w-full h-full object-contain bg-white"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-brand leading-none tracking-tight flex items-center gap-2">
                {settings?.companyName ? (
                  settings.companyName
                ) : (
                  <>
                    شركة مطبخ التراث{" "}
                    <span className="text-accent">الكويتي</span>
                  </>
                )}
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <motion.div
                  animate={
                    tannourStatus.pulse
                      ? { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }
                      : {}
                  }
                  transition={{ duration: 2, repeat: Infinity }}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full bg-current",
                    tannourStatus.color,
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-extrabold uppercase tracking-wider",
                    tannourStatus.color,
                  )}
                >
                  {tannourStatus.text}
                </span>
                <span className="text-[10px] text-stone-300 mx-1">•</span>
                <span className="text-[10px] font-bold text-stone-400">
                  {goldenHourTheme.name}
                </span>
              </div>
            </div>
          </div>
          {!isCheckout && (
            <div className="flex items-center gap-2">
              <Link
                to="/track"
                onClick={() => {
                  if (customerPhone) {
                    try {
                      localStorage.setItem(
                        "customer_phone_track",
                        customerPhone,
                      );
                      window.name = customerPhone;
                    } catch (e) {}
                  }
                }}
                className="p-2.5 bg-brand text-accent rounded-xl hover:bg-brand/90 transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <Search className="w-4 h-4 text-white" />
                <span className="text-[10px] items-center font-bold hidden sm:flex text-white">
                  تتبع طلبك
                </span>
              </Link>
              <div className="relative">
                <button
                  onClick={() => setIsCheckout(true)}
                  className="p-2 sm:p-2.5 bg-white rounded-xl hover:bg-stone-50/80 backdrop-blur-sm transition-all active:scale-95 relative shadow-sm border border-stone-100"
                >
                  <ShoppingCart className="w-5 h-5 text-brand" />
                  {cart.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-lg font-extrabold shadow-md">
                      {cart.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Hero Section - Context Aware Banners */}
        {!isCheckout && (
          <div className="p-4 sm:p-6 mb-2">
            <motion.div
              whileHover={{ scale: 1.01 }}
              className={cn(
                `relative h-44 sm:h-52 rounded-[28px] overflow-hidden group shadow-xl shadow-accent/20`,
                themeContext.colors,
              )}
            >
              {/* Parallax background (simulated without heavy scroll listeners) */}
              <motion.div
                className={`absolute inset-0 bg-[url('${themeContext.image}')] bg-cover bg-center opacity-40 mix-blend-overlay`}
                animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
                transition={{
                  repeat: Infinity,
                  duration: 60,
                  ease: "linear",
                  repeatType: "reverse",
                }}
              />

              {/* Steam Effect for Winter Theme */}
              {themeContext.type === "winter" && (
                <div
                  className="absolute inset-x-0 mx-auto -bottom-10 w-full h-40 opacity-40 mix-blend-screen pointer-events-none"
                  style={{
                    backgroundImage:
                      "radial-gradient(ellipse at bottom, rgba(255,255,255,0.8) 0%, transparent 70%)",
                    filter: "blur(20px)",
                  }}
                ></div>
              )}

              {/* Ambient Shadow/Glow */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/40 rounded-full blur-[80px]"></div>
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-amber-500/30 rounded-full blur-[80px]"></div>

              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-t flex flex-col justify-end p-6 sm:p-8",
                  themeContext.overlay,
                )}
              >
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl sm:text-3xl font-extrabold text-white mb-1 drop-shadow-md"
                >
                  {themeContext.title}
                </motion.h2>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-stone-200 text-sm font-medium drop-shadow-md"
                >
                  {themeContext.desc}
                </motion.p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Faza'a Mood Search */}
        {!isCheckout && (
          <div className="px-4 sm:px-6 mb-2">
            <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-2 flex flex-col gap-2 relative z-20">
              <div className="flex items-center bg-stone-50/80 backdrop-blur-sm rounded-2xl px-4 py-3">
                <Search className="w-5 h-5 text-accent mr-2" />
                <motion.input
                  key={currentPlaceholder}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  type="text"
                  placeholder={currentPlaceholder}
                  value={moodQuery}
                  onChange={(e) => setMoodQuery(e.target.value)}
                  className="bg-transparent w-full outline-none text-sm font-bold text-brand placeholder:text-stone-400 placeholder:font-medium"
                />
              </div>
              
              <AnimatePresence>
                {moodQuery.trim() && moodMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-2 pb-2 text-center"
                  >
                    <div className="bg-gradient-to-r from-brand/5 via-brand/10 to-brand/5 rounded-xl p-3 inline-block">
                      <p className="text-sm font-bold text-brand leading-relaxed">{moodMessage}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Categories / Products */}
        <main className="p-4 sm:p-6 space-y-8">
          {/* Best Sellers */}
          {topProducts.length > 0 && !moodQuery.trim() && (
            <section className="mb-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-brand flex items-center gap-2">
                  <span className="text-accent text-xl">🔥</span> الأكثر طلباً
                </h3>
              </div>
              <RoyalLazySusan
                products={topProducts}
                onSelect={setSelectedProduct}
                settings={settings}
              />
            </section>
          )}

          <section id="products-section">
            {false && (
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-500">
                  {activeStory === "الكل" ? "القائمة الكاملة" : activeStory}
                </h3>
                <div className="h-px bg-stone-100 flex-grow mx-4"></div>
              </div>
            )}
            {(() => {
              let displayProducts =
                activeStory === "الكل"
                  ? products
                  : products.filter((p) => {
                      if (activeStory === "الأكثر مبيعاً")
                        return topProducts.some((tp) => tp.id === p.id);
                      if (activeStory === "توصيل مجاني") return true;
                      if (activeStory === "تراث كويتي")
                        return (
                          p.category?.includes("تراث") ||
                          p.name?.includes("كويت") ||
                          p.name?.includes("مجبوس") ||
                          p.name?.includes("دقوس") ||
                          p.name?.includes("مموش") ||
                          p.name?.includes("مطبق")
                        );
                      return true;
                    });
              
              if (moodQuery.trim()) {
                 if (moodFilter === "صواني") {
                    displayProducts = displayProducts.filter(p => p.name?.includes("صيني") || p.name?.includes("صينية") || p.category?.includes("صواني") || p.name?.includes("مجبوس") || p.name?.includes("طباخ"));
                 } else if (moodFilter === "خفيف") {
                    displayProducts = displayProducts.filter(p => {
                      const n = p.name?.toLowerCase() || "";
                      const c = p.category?.toLowerCase() || "";
                      const isHeavy = n.includes("مجبوس") || n.includes("برياني") || n.includes("مقلوب") || n.includes("برية") || n.includes("محاشي") || n.includes("صيني") || n.includes("قوزي") || n.includes("ذبيح") || n.includes("دجاج 65") || n.includes("مفطح") || n.includes("مطبق") || n.includes("مربين") || n.includes("مموش") || n.includes("بشاميل") || n.includes("ملفوف") || c.includes("ذبيح");
                      const isLight = c.includes("شورب") || n.includes("شورب") || n.includes("خفيف") || n.includes("سلط") || n.includes("هريس") || n.includes("جريش") || n.includes("مرق") || n.includes("روب") || n.includes("عيش مشخول") || n.includes("عيش مشغول") || n.includes("نخي") || n.includes("تشريب") || n.includes("ورق عنب");
                      return !isHeavy && isLight;
                    });
                 } else if (moodFilter === "حلو") {
                    displayProducts = displayProducts.filter(p => p.category?.includes("حلو") || p.name?.includes("حلو") || p.name?.includes("كاكاو"));
                 } else if (moodFilter === "سهران") {
                    displayProducts = displayProducts.filter(p => p.category?.includes("ساندوتش") || p.category?.includes("جانبي") || p.name?.includes("بوكس") || p.name?.includes("خفيف"));
                 } else {
                    // Normal search filtering if no specific mood matches, or if it matches "بحث"
                    displayProducts = displayProducts.filter(p => p.name?.toLowerCase().includes(moodQuery.toLowerCase()) || p.category?.toLowerCase().includes(moodQuery.toLowerCase()));
                 }
                 // if nothing found with mood filter but products exist, fallback to all (or best sellers) to not show an empty screen
                 if (displayProducts.length === 0) {
                    if (moodFilter === "خفيف") {
                        displayProducts = products.filter(p => {
                           const n = p.name?.toLowerCase() || "";
                           const c = p.category?.toLowerCase() || "";
                           const isHeavy = n.includes("مجبوس") || n.includes("برياني") || n.includes("مقلوب") || n.includes("برية") || n.includes("محاشي") || n.includes("صيني") || n.includes("قوزي") || n.includes("ذبيح") || n.includes("دجاج 65") || n.includes("مفطح") || n.includes("مطبق") || n.includes("مربين") || n.includes("مموش") || n.includes("بشاميل") || n.includes("ملفوف") || c.includes("ذبيح");
                           return !isHeavy;
                        }).slice(0, 5);
                    } else if (moodFilter === "حلو") {
                        displayProducts = products.filter(p => p.category?.includes("حلو") || p.name?.includes("حلو") || p.name?.includes("كاكاو") || p.name?.includes("كيك")).slice(0, 5);
                        if (displayProducts.length === 0) displayProducts = products.filter(p => (p.price || 0) < 15).slice(0, 5);
                    } else {
                        displayProducts = products.filter(p => (p.price || 0) < 15).slice(0, 5); // Fallback to affordable stuff
                    }
                 }
              }

              return displayProducts.length === 0 ? (
                <div className="p-8 text-center text-stone-400 font-bold border-2 border-dashed border-stone-100 rounded-2xl">
                  لا توجد بيانات لهذا التصنيف
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {displayProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      viewport={{ once: true }}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      style={{ minHeight: "120px" }}
                    >
                      <ChefWhisperCard
                        product={product}
                        settings={settings}
                        onSelect={setSelectedProduct}
                      />
                    </motion.div>
                  ))}
                </div>
              );
            })()}
          </section>
        </main>

        {/* Product Detail Modal */}
        <AnimatePresence>
          {selectedProduct && (
            <ProductModal
              product={selectedProduct}
              settings={settings}
              onClose={() => setSelectedProduct(null)}
              onAdd={addToCart}
            />
          )}
        </AnimatePresence>



        {/* Flash Sale Popup */}
        <AnimatePresence>
          {showFlashSale && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFlashSale(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-6"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFlashSale(false);
                }}
                className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors bg-white/10 rounded-full p-2"
              >
                <X className="w-6 h-6" />
              </button>
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="text-center w-full max-w-sm"
              >
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl relative border-4 border-white overflow-hidden">
                  <img
                    referrerPolicy="no-referrer"
                    src={
                      smartPick?.item?.imageUrl ||
                      smartPick?.item?.image ||
                      DEFAULT_GLOBAL_LOGO
                    }
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                    }}
                  />
                  <div className="absolute inset-0 bg-accent/10 mix-blend-overlay"></div>
                </div>
                <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight leading-tight">
                  {smartPick?.phrase || "اختيارنا لك"}
                </h2>
                <p className="text-stone-300 text-lg mb-8 leading-relaxed font-medium">
                  شرايك تجرب{" "}
                  <span className="font-bold text-white">
                    {smartPick?.item?.name}
                  </span>
                  ؟ الطعم الأصيل اللي راح يغير مزاجك اليوم.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFlashSale(false);
                    setSelectedProduct(smartPick?.item);
                  }}
                  className="w-full bg-gradient-to-r from-accent to-brand text-white py-5 rounded-2xl font-extrabold text-xl hover:shadow-[0_0_40px_rgba(255,140,0,0.4)] transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <ShoppingCart className="w-6 h-6" />
                  ألقِ نظرة! ({smartPick?.item?.price} د.ك)
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Notification - Kuwaiti Greeting w/ Epic 5 Effects */}
        <AnimatePresence>
          {orderSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-white/95 backdrop-blur-2xl overflow-hidden"
            >
              {/* The Brand Heartbeat Background (Effect 4) */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3],
                  x: [-20, 20, -20],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
              >
                <div className="w-[80vw] h-[80vw] sm:w-[600px] sm:h-[600px] bg-brand rounded-full blur-[100px] opacity-20" />
              </motion.div>

              {/* Points Rain (Effect 2) */}
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={`point-${i}`}
                  initial={{
                    y: "-10vh",
                    left: `${Math.random() * 100}%`,
                    opacity: 0,
                    rotate: 0,
                  }}
                  animate={{
                    y: "110vh",
                    opacity: [0, 1, 1, 0],
                    rotate: Math.random() * 360 + 360,
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    delay: 0.1 + Math.random() * 1.5,
                    ease: "easeInOut",
                  }}
                  className="absolute text-yellow-400 pointer-events-none drop-shadow-[0_0_10px_rgba(253,224,71,0.8)] z-0"
                >
                  {i % 3 === 0 ? (
                    <Star fill="currentColor" className="w-5 h-5" />
                  ) : (
                    <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                  )}
                </motion.div>
              ))}

              {/* The Unboxing Effect Container (Effect 5) */}
              <motion.div
                initial={{ scale: 0.5, y: 100, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{
                  type: "spring",
                  damping: 15,
                  stiffness: 100,
                  delay: 0.1,
                }}
                className="relative rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.5)] max-w-sm w-full z-20"
              >
                {/* Glassmorphism Glow (Rainbow Border equivalent) (Effect 6) */}
                <div className="absolute inset-[-4px] rounded-[3rem] bg-gradient-to-r from-accent via-white to-brand animate-pulse opacity-60 blur-sm pointer-events-none" />

                <div className="relative bg-brand/90 backdrop-blur-3xl border border-white/20 p-8 pt-12 pb-10 rounded-[3rem] flex flex-col items-center text-center gap-4 z-10 overflow-hidden">
                  {/* The Unboxing Lid (Flies up and fades) */}
                  <motion.div
                    initial={{ y: 0, rotateZ: 0, opacity: 1 }}
                    animate={{ y: -120, x: -30, rotateZ: -15, opacity: 0 }}
                    transition={{
                      delay: 0.7,
                      duration: 1.2,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="absolute -inset-[2px] bg-gradient-to-br from-brand to-stone-800 border min-h-[300px] border-white/20 rounded-[3rem] z-30 flex flex-col items-center justify-center pointer-events-none shadow-[0_30px_70px_rgba(0,0,0,0.6)] origin-top-left"
                  >
                    <div className="w-20 h-2 bg-white/20 rounded-full mb-4" />
                    <h2 className="text-2xl font-bold text-white/60">
                      جاري التحضير...
                    </h2>
                  </motion.div>

                  {/* The Calligraphic Stroke (Gold lines) (Effect 1) */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8, type: "spring" }}
                    className="w-28 h-28 bg-gradient-to-br from-yellow-100 to-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(253,224,71,0.5)] relative z-10 shrink-0"
                  >
                    <svg
                      width="60"
                      height="60"
                      viewBox="0 0 100 100"
                      className="relative z-10 drop-shadow-md"
                    >
                      <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                          duration: 1.2,
                          delay: 1,
                          ease: "easeInOut",
                        }}
                        fill="none"
                        stroke="white"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M25,55 C30,40 40,35 45,55 C50,75 60,85 85,35"
                      />
                      <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                          duration: 0.5,
                          delay: 2,
                          ease: "easeInOut",
                        }}
                        fill="none"
                        stroke="white"
                        strokeWidth="6"
                        strokeLinecap="round"
                        d="M55,15 L55,25"
                      />
                      {/* Drawing pencil tip spark */}
                      <motion.circle
                        initial={{ opacity: 1, scale: 1 }}
                        animate={{ opacity: 0, scale: 2 }}
                        transition={{ delay: 2.5 }}
                        r="4"
                        cx="55"
                        cy="20"
                        fill="white"
                      />
                    </svg>

                    {/* Gold dust explosion */}
                    {[...Array(16)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
                        animate={{
                          scale: [0, 1.5, 0],
                          opacity: [1, 1, 0],
                          x: Math.cos((i * (360 / 16) * Math.PI) / 180) * 120,
                          y: Math.sin((i * (360 / 16) * Math.PI) / 180) * 120,
                        }}
                        transition={{
                          duration: 1.2,
                          ease: "easeOut",
                          delay: 2.2,
                        }}
                        className="absolute w-2.5 h-2.5 bg-yellow-200 rounded-full shadow-[0_0_10px_rgba(253,224,71,1)] pointer-events-none"
                      />
                    ))}
                  </motion.div>

                  <h2 className="text-4xl font-extrabold text-white mt-2 drop-shadow-md">
                    تم استلام طلبك!
                  </h2>
                  <div className="h-px w-16 bg-white/30 my-1" />
                  <p className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 text-3xl font-extrabold italic tracking-wider drop-shadow-sm">
                    هني وعافية
                  </p>
                  <p className="text-white/80 text-sm font-medium mt-1 leading-relaxed">
                    حياك الله يا{" "}
                    <span className="font-bold text-white">
                      {orderSuccessCustomerData.name || "عزيزنا العميل"}
                    </span>
                    <br />
                    جاهزين لخدمتك بكل حب
                  </p>

                  {/* Tiny Wallet for Points collecting at bottom */}
                  {true && ( // Always show wallet for fun, or we could condition on customerPoints > 0
                    <motion.div
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 2, type: "spring" }}
                      className="mt-4 p-3 bg-white/10 rounded-2xl flex items-center gap-3 border border-white/20 w-full"
                    >
                      <div className="bg-yellow-400/20 p-2 rounded-xl text-yellow-400 shrink-0 shadow-[0_0_15px_rgba(253,224,71,0.3)]">
                        <Star className="w-5 h-5 fill-current" />
                      </div>
                      <div className="text-right flex-1">
                        <p className="text-[10px] text-white/50 font-bold mb-0.5">
                          محفظة النقاط
                        </p>
                        <p className="text-xs text-white font-bold">
                          تم إضافة نقاط الطلب بنجاح
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {psychMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={cn(
                "fixed border-2 border-accent/10 focus:border-accent/40 bg-stone-50/50 hover:bg-stone-50 transition-colors rounded-3xl shadow-xl p-5 z-[70] transition-all",
                psychMessage && psychMessage.title.includes("جمعة")
                  ? "bottom-[40%] left-6 right-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-96 ring-4 ring-accent/10 scale-110"
                  : isCheckout
                    ? "bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-80"
                    : "bottom-24 sm:bottom-28 left-4 right-4 sm:left-auto sm:right-6 sm:w-80",
              )}
            >
              <button
                onClick={() => setPsychMessage(null)}
                className="absolute top-4 left-4 text-stone-400 bg-stone-100 hover:bg-stone-200 rounded-full p-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-4 mb-4">
                {psychMessage.product && (
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-stone-100 shrink-0 border border-stone-100">
                    <img
                      referrerPolicy="no-referrer"
                      src={
                        psychMessage.product.imageUrl ||
                        psychMessage.product.image ||
                        DEFAULT_GLOBAL_LOGO
                      }
                      alt="Product"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                      }}
                    />
                  </div>
                )}
                <div className="pt-1">
                  <h3 className="font-bold text-brand leading-tight flex items-center gap-2">
                    {isCheckout ? (
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-accent" />
                    )}
                    {psychMessage.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1.5 font-medium">
                    {psychMessage.desc}
                  </p>
                </div>
              </div>

              {psychMessage.actionText && (
                <button
                  onClick={() => {
                    if (psychMessage.product) {
                      setSelectedProduct(psychMessage.product);
                    } else {
                      // General action: Scroll to products
                      const el = document.getElementById("products-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                      if (isCheckout) setIsCheckout(false);

                      // If it's the combo suggestion, we might want to highlight a certain category
                      if (psychMessage.title.includes("جمعة")) {
                        setActiveStory("تراث كويتي");
                      }
                    }
                    setPsychMessage(null);
                  }}
                  className="w-full py-3 bg-accent text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-accent/20 mt-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {psychMessage.actionText}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FOMO Popup */}
        <AnimatePresence>
          {showFomo &&
            fomoPurchases.length > 0 &&
            !isCheckout &&
            !orderSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={cn(
                  "fixed right-4 sm:right-6 z-40 pointer-events-auto transition-all duration-500",
                  cart.length > 0
                    ? "bottom-24 sm:bottom-28"
                    : "bottom-6 sm:bottom-8",
                )}
              >
                <div className="bg-white/95 backdrop-blur-md border border-stone-100 shadow-xl rounded-2xl p-3 flex items-center gap-3 w-72 sm:w-80 relative overflow-hidden pr-8">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFomoPurchases([]);
                      setShowFomo(false);
                    }}
                    className="absolute top-2 right-2 p-1 text-stone-400 hover:text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-full z-20 transition-colors"
                    title="إغلاق"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute top-0 right-0 w-1 h-full bg-accent"></div>
                  <div className="w-10 h-10 rounded-full flex-shrink-0 bg-accent/10 flex items-center justify-center text-accent">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="text-xs text-stone-500 mb-0.5 leading-snug">
                       {fomoPurchases[fomoIndex]?.type === 'scarcity' ? (
                          <>
                             <span className="font-bold text-red-500">🔥 ألحق!</span> باقي {Math.floor(Math.random() * 4) + 1} حبات بس من <span className="font-bold text-stone-800">{fomoPurchases[fomoIndex]?.productName}</span> اليوم.
                          </>
                       ) : fomoPurchases[fomoIndex]?.type === 'trend' ? (
                          <>
                             الكل في <span className="font-bold text-brand">{fomoPurchases[fomoIndex]?.area}</span> يطلب <span className="font-bold text-stone-800">{fomoPurchases[fomoIndex]?.productName}</span> اليوم.. لا تصير الوحيد اللي ما جربه!
                          </>
                       ) : fomoPurchases[fomoIndex]?.type === 'insight' ? (
                          <>
                              <span className="font-bold text-accent">🤔 هل لاحظت؟</span> طلبات <span className="font-bold text-stone-800">{fomoPurchases[fomoIndex]?.area}</span> زادت 15% اليوم، شكل عندهم احتفال كبير!
                          </>
                       ) : (
                          <>
                             <span className="font-bold text-stone-800">
                                {fomoPurchases[fomoIndex]?.name}
                             </span>{" "}
                             من {fomoPurchases[fomoIndex]?.area} طلب للتو {" "}
                             <span className="font-bold text-brand whitespace-nowrap">
                                {fomoPurchases[fomoIndex]?.productName}
                             </span>
                          </>
                       )}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {fomoPurchases[fomoIndex]?.type !== 'insight' && fomoPurchases[fomoIndex]?.type !== 'trend' ? getRelativeTime(fomoPurchases[fomoIndex]?.time) : "مؤشر الرادار الذكي 📡"}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        {/* Floating Cart Button for Mobile */}
        {cart.length > 0 && !isCheckout && !orderSuccess && (
          <motion.button
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            onClick={() => setIsCheckout(true)}
            className={`fixed bottom-6 left-4 right-4 sm:bottom-8 sm:left-6 sm:right-6 bg-brand text-white p-4 rounded-xl shadow-xl flex items-center justify-between z-30 font-bold transition-all ring-2 ring-white ${cartBouncing ? "scale-110 shadow-emerald-500/50 bg-emerald-600" : "active:scale-95"}`}
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-sm font-bold border border-white/30">
                {cart.length}
              </div>
              <span className="text-sm">اعتمد الطلب</span>
            </div>
            <div className="text-base font-medium">{total} د.ك</div>
          </motion.button>
        )}

        {/* Flying Plates Effect */}
        <AnimatePresence>
          {flyingPlates.map((plate) => (
            <motion.img
              key={plate.id}
              src={plate.img}
              className="fixed z-[100] w-16 h-16 object-contain shadow-xl pointer-events-none drop-shadow-xl"
              initial={{
                x: plate.startX - 32,
                y: plate.startY - 32,
                scale: 1,
                opacity: 1,
                rotate: 0,
              }}
              animate={{
                x: [
                  plate.startX - 32,
                  (plate.startX + window.innerWidth / 2) / 2 + 50,
                  window.innerWidth / 2 - 32,
                ],
                y: [
                  plate.startY - 32,
                  plate.startY - 100,
                  window.innerHeight - 60,
                ],
                scale: [1, 1.2, 0.2],
                opacity: [1, 1, 0],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            />
          ))}
        </AnimatePresence>

        {/* Version Label */}
        <div className="text-center py-4 opacity-20 pointer-events-none select-none text-[8px] font-light text-stone-400">
          Version 2.5.0.Release
        </div>
      </motion.div>

              {/* Checkout Sidebar/Overlay */}
        <AnimatePresence>
          {isCheckout && !orderSuccess && (
            <CheckoutOverlay
              cart={cart}
              total={total}
              deliveryFee={deliveryFee}
              itemsTotal={itemsTotal}
              customerName={customerName}
              customerPhone={customerPhone}
              customerPoints={customerPoints}
              generalNotes={generalNotes}
              setGeneralNotes={setGeneralNotes}
              address={address}
              regions={regions}
              settings={settings}
              onRegionChange={handleRegionChange}
              setCustomerName={setCustomerName}
              setCustomerPhone={setCustomerPhone}
              setAddress={setAddress}
              isLocked={isLocked}
              setIsLocked={setIsLocked}
              setCustomerPoints={setCustomerPoints}
              onClose={() => setIsCheckout(false)}
              onRemove={removeFromCart}
              onSubmit={handleSubmitOrder}
              formError={formError}
              setFormError={setFormError}
              isSubmitting={isSubmitting}
              isDev={window.location.hostname.includes('ais-dev') || searchParams.get('dev') === 'true'}
              promoCodeInput={promoCodeInput}
              setPromoCodeInput={setPromoCodeInput}
              appliedPromo={appliedPromo}
              setAppliedPromo={setAppliedPromo}
              promoError={promoError}
              validatePromo={validatePromo}
              isValidatingPromo={isValidatingPromo}
              discountAmount={discountAmount}
            />
          )}
        </AnimatePresence>
    </>
  );
}

const SizzlingSteam = () => (
  <div className="absolute inset-x-0 -top-6 bottom-0 z-10 pointer-events-none flex justify-center opacity-70 mix-blend-screen overflow-hidden">
    {[...Array(4)].map((_, i) => (
      <motion.div
        key={i}
        className="w-3 h-full bg-gradient-to-t from-transparent via-white to-transparent blur-md absolute bottom-0 origin-bottom"
        initial={{ opacity: 0, y: 10, scaleY: 0.5, x: (i - 1.5) * 8 }}
        animate={{
          opacity: [0, 0.6, 0],
          y: -40,
          scaleY: [0.5, 1.2, 1],
          x: (i - 1.5) * 12 + Math.random() * 5,
        }}
        transition={{
          duration: 2.5 + Math.random() * 2,
          repeat: Infinity,
          delay: i * 0.5,
          ease: "easeOut",
        }}
      />
    ))}
  </div>
);

const getWhisperText = (product: any) => {
  const name = product.name || "";
  const cat = product.category || "";

  if (name.includes("مجبوس") || name.includes("عيش") || name.includes("برياني"))
    return "نطبخه على نار هادية وننطره يتشرب عدل عشان تاكل أحلى عيش!";
  if (name.includes("لحم"))
    return "لحم ترف وذايب بمكانه، مبهرينه بخلطتنا الخاصة ليوم كامل علشانك!";
  if (name.includes("دياي") || name.includes("دجاج"))
    return "دياية محمشة وفرش، الطعم بيخليك ترجع تطلبها كل يوم!";
  if (
    cat.includes("سلط") ||
    name.includes("سلطة") ||
    name.includes("تبولة") ||
    name.includes("فتوش")
  )
    return "خضرتنا نقصها فرش كل يوم بيومه، عشان تستمتع بالقرمشة الصح!";
  if (
    cat.includes("حلو") ||
    name.includes("حلو") ||
    name.includes("لقيمات") ||
    name.includes("كيك")
  )
    return "نزبطها لك عشان تختم وجبتك بطعم يذوب بالحلج ويعدل مزاجك!";
  if (
    cat.includes("مشروب") ||
    name.includes("مشروب") ||
    name.includes("عصير") ||
    name.includes("بيبسي") ||
    name.includes("كولا") ||
    name.includes("لبن")
  )
    return "يسرسح على القلب ويبرد عليك، أصل الانتعاش!";
  if (name.includes("دقوس") || name.includes("صلصة") || name.includes("معبوج"))
    return "نطحنه ونجهزه ببهاراتنا السرية علشان يكمل نكهة وجبتك ويولعها!";
  if (name.includes("مشوي") || name.includes("شوي") || name.includes("شواية"))
    return "نشويه على الراحة عشان ياخذ ريحة وطعم الشوي الصح والمقرمش!";
  if (
    name.includes("بحري") ||
    name.includes("سمك") ||
    name.includes("ربيان") ||
    name.includes("ميد") ||
    name.includes("زبيدي")
  )
    return "صيدة اليوم طازجة ننظفها ونبهرها ببهارنا الخاص لتتذوق طعم البحر!";
  if (
    cat.includes("مقبلات") ||
    name.includes("متبل") ||
    name.includes("حمص") ||
    name.includes("ورق عنب")
  )
    return "نقنقة خفيفة ولذيذة تفتح نفسك للطبق الرئيسي، معمولة على أصولها!";

  return "ترا احنا نجهزه بكل حب علشان يوصلك طازج وبأحلى طعم وفريش!";
};

const ChefWhisperCard = ({
  product,
  settings,
  onSelect,
  isHorizontal = false,
}: {
  product: any;
  settings: any;
  onSelect: (p: any) => void;
  isHorizontal?: boolean;
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Logic for hot dish
  const isHot =
    product.category?.includes("طباخ") ||
    product.name?.includes("مجبوس") ||
    product.name?.includes("لحم") ||
    product.name?.includes("مشوي") ||
    product.name?.includes("دياي");
  const whisperText = getWhisperText(product);

  const fallbackLogo =
    settings?.companyLogo || settings?.logo || DEFAULT_GLOBAL_LOGO;
  const imgUrl = product.imageUrl || product.image || fallbackLogo;

  return (
    <div
      className={`relative perspective-[1000px] w-full ${isHorizontal ? "h-full" : ""}`}
    >
      <motion.div
        className={`w-full relative ${isHorizontal ? "h-full" : ""}`}
        animate={{ rotateY: isFlipped ? 180 : 0, scale: isFlipped ? 1.05 : 1 }}
        whileTap={{
          scale: isFlipped ? 1.05 : 1.02,
          boxShadow:
            isHot && !isFlipped ? "0 0 25px rgba(245, 158, 11, 0.3)" : "none",
        }}
        transition={{ duration: 0.6, type: "spring", damping: 15 }}
        style={{ transformStyle: "preserve-3d" }}
        onClick={(e) => {
          if (!isFlipped && !product.isOutOfStock) {
            // Short delay to show the warmth effect before opening modal (if hot)
            if (isHot) {
              setTimeout(() => onSelect(product), 150);
            } else {
              onSelect(product);
            }
          }
        }}
      >
        {/* Front Side */}
        <div
          className={`relative w-full bg-white/80 backdrop-blur-md rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex ${isHorizontal ? "flex-col justify-start p-4 pb-3 h-full" : "gap-5 p-5 min-h-[110px] items-center"} border ${product.isOutOfStock ? "border-stone-100 grayscale-[0.5] opacity-75" : "border-white hover:border-accent/20 hover:shadow-[0_20px_50px_rgba(26,46,34,0.06)] hover:-translate-y-1"} transition-all duration-500 cursor-pointer`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "translateZ(0)",
            WebkitTransform: "translateZ(0)",
          }}
        >
          {product.isOutOfStock && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/20 backdrop-blur-[1px] rounded-[24px]">
              <span className="bg-red-600/90 text-white px-5 py-1.5 rounded-full text-sm font-black shadow-lg transform -rotate-6 tracking-widest border border-white/50">
                نفذت الكمية
              </span>
            </div>
          )}
          {product.isNewProduct && !product.isOutOfStock && (
            <span className="absolute top-0 right-0 bg-gradient-to-tr from-accent to-amber-500 text-white text-[10px] font-bold px-3 py-1.5 z-10 rounded-tr-[24px] rounded-bl-2xl shadow-[0_2px_10px_rgba(194,97,21,0.3)]">
              جديد
            </span>
          )}

          {/* Golden Fold / Chef's Whisper trigger */}
          {!product.isOutOfStock && (
            <div
              className="absolute top-0 left-0 w-8 h-8 cursor-pointer z-30 group"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(true);
              }}
            >
              <div className="absolute top-0 left-0 border-t-[32px] border-r-[32px] border-t-accent group-hover:border-t-amber-500 border-r-transparent drop-shadow-md rounded-tl-[24px] transition-colors" />
            </div>
          )}

          <div
            className={`relative flex-shrink-0 overflow-hidden flex items-center justify-center bg-stone-50/50 rounded-2xl border border-stone-100/50 shadow-inner ${isHorizontal ? "w-20 h-20 mx-auto mb-2" : "w-16 h-16"}`}
          >
            {isHot && <SizzlingSteam />}
            <img
              referrerPolicy="no-referrer"
              src={imgUrl}
              onError={(e) => {
                if (e.currentTarget.src.includes(fallbackLogo)) {
                  e.currentTarget.onerror = null;
                  if (!e.currentTarget.src.includes(DEFAULT_GLOBAL_LOGO))
                    e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                } else {
                  e.currentTarget.src = fallbackLogo;
                }
              }}
              alt={product.name}
              className="w-full h-full object-contain p-1 transform hover:scale-105 transition-transform bg-white relative z-0"
            />
          </div>
          <div
            className={`flex flex-col flex-grow ${isHorizontal ? "text-center" : "justify-center"} overflow-hidden relative z-10`}
          >
            <h3
              className="font-black text-lg sm:text-lg text-brand leading-tight tracking-tight mt-1"
              style={{ wordBreak: "break-word" }}
            >
              {product.name}
            </h3>
            {product.preparationInstructions && (
              <p className="text-[10px] sm:text-[11px] text-stone-500 font-medium mt-1 leading-relaxed line-clamp-2">
                {product.preparationInstructions}
              </p>
            )}
            <p className="text-brand text-lg font-black mt-2">
              {product.price}{" "}
              <span className="text-[10px] sm:text-xs text-accent font-bold">
                د.ك
              </span>
            </p>
          </div>
          {!isHorizontal && (
            <div className="flex items-center pl-2 relative z-10">
              <div
                className={`p-2 sm:p-3 text-white rounded-2xl shadow-lg transition-all hover:scale-110 ${product.isOutOfStock ? "bg-stone-300" : "bg-gradient-to-tr from-accent to-amber-500 shadow-accent/30"}`}
              >
                <Plus className="w-5 h-5 stroke-[3]" />
              </div>
            </div>
          )}
        </div>

        {/* Back Side (The Whisper) */}
        <div
          className="absolute inset-0 w-full h-full bg-brand rounded-[24px] p-5 flex flex-col items-center justify-center text-center shadow-inner border border-brand cursor-pointer overflow-hidden z-40"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg) translateZ(0)",
            WebkitTransform: "rotateY(180deg) translateZ(0)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsFlipped(false);
          }}
        >
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-accent rounded-full blur-3xl opacity-30" />
          <div className="text-accent mb-3 flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 border border-accent/20 relative z-10">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>

          <p
            className="text-stone-100 font-medium text-sm leading-relaxed relative z-10"
          >
            "{whisperText}"
          </p>
          <span className="text-[10px] text-accent font-bold mt-auto tracking-widest pt-3 border-t border-accent/20 w-full relative z-10">
            اضغط للعودة
          </span>
        </div>
      </motion.div>
    </div>
  );
};

const RoyalLazySusan = ({
  products,
  onSelect,
  settings,
}: {
  products: any[];
  onSelect: (p: any) => void;
  settings: any;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () =>
    setCurrentIndex((prev) => (prev + 1) % products.length);
  const handlePrev = () =>
    setCurrentIndex((prev) => (prev - 1 + products.length) % products.length);

  if (!products || products.length === 0) return null;

  return (
    <div className="relative w-full h-[200px] flex items-center justify-center overflow-x-hidden perspective-[1200px] select-none touch-pan-y">
      <AnimatePresence initial={false}>
        {products.map((product, i) => {
          const rawOffset = i - currentIndex;
          let offset = rawOffset;
          // Handle circular wrap around visually
          if (rawOffset > Math.floor(products.length / 2))
            offset -= products.length;
          if (rawOffset < -Math.floor(products.length / 2))
            offset += products.length;

          // If it's too far left/right, don't render it for performance
          if (Math.abs(offset) > 2) return null;

          const isCenter = offset === 0;
          const xOffset = offset * 150; // spacing
          const zOffset = isCenter ? 0 : -100 - Math.abs(offset) * 50;
          const rotateY = -offset * 25; // tilt towards center
          const opacity = isCenter
            ? 1
            : Math.max(0, 1 - Math.abs(offset) * 0.4);
          const scale = isCenter
            ? 1
            : Math.max(0.7, 1 - Math.abs(offset) * 0.15);
          const zIndex = 100 - Math.abs(offset);

          return (
            <motion.div
              key={product.id}
              className="absolute w-[180px] h-[200px] cursor-grab active:cursor-grabbing"
              initial={false}
              animate={{
                x: xOffset,
                z: zOffset,
                rotateY,
                opacity,
                scale,
                zIndex,
              }}
              transition={{
                duration: 0.5,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
              style={{ originX: 0.5, originY: 0.5 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragEnd={(e, { offset: dragOffset, velocity }) => {
                const swipe = dragOffset.x;
                if (swipe < -40 || velocity.x < -300) {
                  handleNext();
                } else if (swipe > 40 || velocity.x > 300) {
                  handlePrev();
                }
              }}
              onClick={() => {
                if (isCenter) return; // allow clicking card inner logic (flip/select)
                if (offset > 0) handleNext();
                if (offset < 0) handlePrev();
              }}
            >
              {/* Use the new ChefWhisperCard but constrained for the horizontal carousel */}
              <div
                className={`w-full h-full ${!isCenter ? "pointer-events-none" : ""}`}
              >
                <ChefWhisperCard
                  product={product}
                  settings={settings}
                  onSelect={onSelect}
                  isHorizontal={true}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Navigation overlays */}
      <button
        onClick={handlePrev}
        className="absolute left-0 top-0 bottom-0 w-12 z-[200] opacity-0"
        aria-label="Previous"
      />
      <button
        onClick={handleNext}
        className="absolute right-0 top-0 bottom-0 w-12 z-[200] opacity-0"
        aria-label="Next"
      />
    </div>
  );
};

function ProductModal({
  product,
  settings,
  onClose,
  onAdd,
}: {
  product: Product;
  settings?: any;
  onClose: () => void;
  onAdd: (item: any, e?: React.MouseEvent) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOption, setSelectedOption] = useState<string>(
    product.options && product.options.length > 0 ? product.options[0] : "",
  );
  const [selectedExtras, setSelectedExtras] = useState<
    { name: string; price: number }[]
  >([]);
  const [note, setNote] = useState("");

  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const itemPrice = product.price + extrasTotal;

  const toggleExtra = (extra: { name: string; price: number }) => {
    if (selectedExtras.find((e) => e.name === extra.name)) {
      setSelectedExtras(selectedExtras.filter((e) => e.name !== extra.name));
    } else {
      setSelectedExtras([...selectedExtras, extra]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="bg-white w-full max-w-lg rounded-t-[32px] p-6 sm:p-8 max-h-[92vh] overflow-y-auto no-scrollbar shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.1)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 bg-stone-50/80 backdrop-blur-sm hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-12 h-1 bg-stone-100 rounded-full" />
        </div>

        <div className="flex flex-col sm:flex-row gap-6 mb-8 mt-2 group relative">
          <div className="relative shrink-0 flex justify-center">
            {(product as any).isNewProduct && (
              <span className="absolute top-0 right-0 sm:-right-2 -mt-2 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] sm:text-xs font-extrabold px-3 py-1 rounded-full z-20 shadow-[0_4px_15px_rgba(239,68,68,0.4)] border-2 border-white transform rotate-3">
                جديد
              </span>
            )}
            <div className="absolute inset-0 bg-brand blur-xl opacity-10 transform scale-90 group-hover:scale-100 transition-transform"></div>
            {(product as any).imageUrl ||
            product.image ||
            settings?.companyLogo ||
            settings?.logo ||
            DEFAULT_GLOBAL_LOGO ? (
              <img
                referrerPolicy="no-referrer"
                src={
                  (product as any).imageUrl ||
                  product.image ||
                  settings?.companyLogo ||
                  settings?.logo ||
                  DEFAULT_GLOBAL_LOGO
                }
                onError={(e) => {
                  const fallback =
                    settings?.companyLogo ||
                    settings?.logo ||
                    DEFAULT_GLOBAL_LOGO;
                  if (
                    e.currentTarget.src.includes(fallback) ||
                    e.currentTarget.src.includes(DEFAULT_GLOBAL_LOGO)
                  ) {
                    e.currentTarget.onerror = null;
                    if (!e.currentTarget.src.includes(DEFAULT_GLOBAL_LOGO))
                      e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                  } else {
                    e.currentTarget.src = fallback;
                  }
                }}
                className="w-[63px] h-[63px] object-contain bg-white rounded-2xl shadow-md relative border-2 border-stone-50 p-0"
              />
            ) : (
              <div className="w-[48px] h-[48px] flex items-center justify-center bg-stone-50/80 backdrop-blur-sm border-2 border-stone-100 text-stone-400 rounded-2xl shadow-md relative p-1">
                <span className="text-[10px] font-medium p-1 text-center leading-tight">
                  صورة غير متوفرة
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center text-center sm:text-right">
            {/* <span className="text-xs text-stone-400 font-bold mb-1">{product.category}</span> */}
            <h2 className="text-2xl font-bold text-brand leading-tight mb-1">
              {product.name}
            </h2>
            <p className="text-xs text-stone-400 font-medium mb-3">
              {product.nameEn}
            </p>
            <p className="text-2xl font-medium text-brand">
              {product.price} <span className="text-sm text-accent">د.ك</span>
            </p>
            {product.preparationInstructions && (
              <div className="mt-3 text-[11px] text-accent font-bold flex items-center justify-center sm:justify-start gap-1 p-2 bg-accent/10 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />{" "}
                <span className="leading-tight">
                  {product.preparationInstructions}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {product.options && product.options.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-500 block">
                بروتوكول التحضير
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {product.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => setSelectedOption(option)}
                    className={cn(
                      "py-3 rounded-xl border-2 transition-all font-bold text-sm",
                      selectedOption === option
                        ? "border-accent bg-accent/5 text-brand shadow-sm"
                        : "border-stone-100 bg-stone-50/50 text-stone-500 hover:border-stone-100",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.extras && product.extras.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-500 block">
                إضافات حصرية
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {product.extras.map((extra) => {
                  const isSelected = selectedExtras.find(
                    (e) => e.name === extra.name,
                  );
                  return (
                    <button
                      key={extra.name}
                      onClick={() => toggleExtra(extra)}
                      className={cn(
                        "flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 transition-all",
                        isSelected
                          ? "border-accent bg-accent/5"
                          : "border-stone-50 bg-stone-50/30 hover:border-stone-100",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all",
                            isSelected
                              ? "bg-accent border-accent text-white"
                              : "border-stone-100 bg-white",
                          )}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 stroke-[3]" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs sm:text-sm transition-colors font-bold",
                            isSelected ? "text-brand" : "text-stone-500",
                          )}
                        >
                          {extra.name}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-accent">
                        +{extra.price} د.ك
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs font-bold text-stone-500 block">
              رسالة الملاحظات
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="اكتب ملاحظتك هنا..."
              className="w-full p-4 bg-stone-50/80 backdrop-blur-sm border-2 border-stone-100 rounded-2xl focus:border-accent outline-none transition-all text-sm min-h-[100px] text-brand placeholder:text-stone-300 font-medium"
            />
          </div>

          <div className="flex items-center gap-4 pt-6 sticky bottom-0 bg-white/90 backdrop-blur-xl pb-4 border-t border-stone-50 mt-6">
            <div className="flex items-center bg-stone-50/80 backdrop-blur-sm border-2 border-stone-100 rounded-xl p-1 shrink-0">
              <button
                onClick={() => {
                  try {
                    if (navigator.vibrate) navigator.vibrate(30);
                  } catch (e) {}
                  setQuantity(Math.max(1, quantity - 1));
                }}
                className="p-4 sm:p-4 text-stone-400 hover:text-accent transition-colors shrink-0 active:scale-90"
                aria-label="Decrease quantity"
              >
                <Minus className="w-6 h-6" />
              </button>
              <span className="w-10 sm:w-12 text-center font-bold text-xl text-brand shrink-0">
                {quantity}
              </span>
              <button
                onClick={() => {
                  try {
                    if (navigator.vibrate) navigator.vibrate(30);
                  } catch (e) {}
                  setQuantity(quantity + 1);
                }}
                className="p-4 sm:p-4 text-stone-400 hover:text-accent transition-colors shrink-0 active:scale-90"
                aria-label="Increase quantity"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) =>
                onAdd(
                  {
                    id: "",
                    productId: product.id,
                    name: product.name,
                    image:
                      (product as any).imageUrl ||
                      product.image ||
                      settings?.companyLogo ||
                      settings?.logo ||
                      DEFAULT_GLOBAL_LOGO,
                    quantity,
                    price: itemPrice,
                    selectedOption,
                    selectedExtras,
                    note,
                    preparationInstructions: product.preparationInstructions,
                  },
                  e,
                )
              }
              className="flex-grow bg-brand text-white p-5 sm:p-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl text-xl"
            >
              <span>حطه بالسلة</span>
              <span className="w-px h-6 bg-white/30"></span>
              <span className="font-bold">{itemPrice * quantity} د.ك</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CheckoutOverlay({
  cart,
  total,
  deliveryFee,
  itemsTotal,
  customerName,
  customerPhone,
  customerPoints,
  generalNotes,
  setGeneralNotes,
  address,
  regions,
  onRegionChange,
  setCustomerName,
  setCustomerPhone,
  setAddress,
  isLocked,
  setIsLocked,
  setCustomerPoints,
  onClose,
  onRemove,
  onSubmit,
  formError,
  setFormError,
  isSubmitting,
  isDev,
  settings,
  promoCodeInput,
  setPromoCodeInput,
  appliedPromo,
  setAppliedPromo,
  promoError,
  validatePromo,
  isValidatingPromo,
  discountAmount,
}: any) {
  const [regionSearch, setRegionSearch] = useState("");
  const [showRegions, setShowRegions] = useState(false);
  const [step, setStep] = useState<"cart" | "delivery" | "payment">("cart");

  const filteredRegions = regions.filter(
    (r: any) =>
      (r.name || "").toLowerCase().includes(regionSearch.toLowerCase()) ||
      (r.name || "").includes(regionSearch),
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-end bg-brand/50 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
        className="bg-[#fafaf9] w-full sm:max-w-md h-[100dvh] overflow-hidden shadow-2xl flex flex-col sm:rounded-l-3xl border-l border-stone-100/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] border-b border-stone-50 flex items-center justify-between bg-white shrink-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] z-10 rounded-b-3xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (step === "payment") setStep("delivery");
                else if (step === "delivery") setStep("cart");
                else onClose();
              }}
              className="p-3 bg-stone-50 border border-stone-100 rounded-2xl hover:bg-brand hover:text-white hover:-translate-x-1 transition-all shadow-sm"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-brand flex items-center gap-2 tracking-tight mt-1">
                {step === "cart" ? "قائمة طلباتك" : step === "payment" ? "طريقة الدفع" : "بيانات التوصيل"}
              </h2>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-8 no-scrollbar bg-[#fafaf9]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-6 pt-10">
              <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-stone-50">
                <ShoppingCart className="w-12 h-12 text-stone-300 empty-state-art" />
              </div>
              <h3 className="text-2xl font-black text-brand mb-1">سلتك فاضية يالغالي!</h3>
              <p className="font-medium text-center text-sm max-w-[200px] mb-4">اطلب الحين وعيش تجربة مختلفة ومميزة مع أطباقنا</p>
              <button
                onClick={onClose}
                className="w-full py-4 mt-4 bg-brand text-white border border-brand rounded-2xl font-bold hover:bg-brand/90 transition-all shadow-md shadow-brand/20"
              >
                شوف المنيو
              </button>
            </div>
          ) : step === "cart" ? (
            <div className="animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="space-y-4">
                {(() => {
                  const totalQty = cart.reduce(
                    (s: number, i: any) => s + i.quantity,
                    0,
                  );
                  let msg = "اختيار مرتب، تقدر تكمل طلبك متى ما حبيت.";
                  const drinksCount = cart.filter(
                    (i: any) =>
                      i.name.includes("مشروب") ||
                      i.name.includes("بيبسي") ||
                      i.name.includes("كولا") ||
                      i.category?.includes("مشروب"),
                  ).length;

                  if (totalQty >= 5 && drinksCount === 0) {
                    const msgs = [
                      "طلبك كبير ما شاء الله! بس ناسي المشروبات اللي تبرد على القلب.",
                      "يا هلا بهالطلب الطيب! ما ودك تزيد مشروبات تروق المزاج؟",
                      "اختيار موفق وعوافي! بس جنه ناقصك شي يبرد على قلبك؟",
                    ];
                    msg =
                      msgs[
                        cart.reduce(
                          (s: number, i: any) => s + i.name.length,
                          0,
                        ) % msgs.length
                      ];
                  } else if (totalQty >= 4) {
                    const msgs = [
                      "عزيمة؟ اختيار مرتب ويكفي ويوفي، عليكم بالعافية.",
                      "يا سلام على هالجمعة! عليكم بالعافية ومطرح ما يسري يمري.",
                      "طلب العزايم الطيب! إن شاء الله يكون على ذوقكم وتستمتعون.",
                    ];
                    msg =
                      msgs[
                        cart.reduce(
                          (s: number, i: any) => s + i.name.length,
                          0,
                        ) % msgs.length
                      ];
                  } else if (totalQty === 1) {
                    const msgs = [
                      "وجبة خفيفة ومميزة لحالك، عوافي!",
                      "يا سلام على الاختيار، استمتع بوجبتك!",
                      "مدلع نفسك اليوم! عليك بالعافية.",
                      "لا يوقف! وجبة خفيفة ومطرح ما يسري يمري.",
                    ];
                    msg =
                      msgs[
                        cart.reduce(
                          (s: number, i: any) => s + i.name.length,
                          0,
                        ) % msgs.length
                      ];
                  } else {
                    const msgs = [
                      `طلبك يكفي تقريباً ${totalQty} أشخاص، اختيار ممتاز!`,
                      `لـ ${totalQty} أشخاص؟ خوش اختيار وعليكم بمليون عافية.`,
                      `اختيار رهيب ومرتب لعـ ${totalQty} أشخاص، صحتين وعافية!`,
                    ];
                    msg =
                      msgs[
                        cart.reduce(
                          (s: number, i: any) => s + i.name.length,
                          0,
                        ) % msgs.length
                      ];
                  }

                  const freeDelThreshold = settings?.freeDeliveryThreshold;
                  if (freeDelThreshold && itemsTotal < freeDelThreshold) {
                    const diff = freeDelThreshold - itemsTotal;
                    if (diff > 0 && diff <= 5) {
                      msg += ` (باقي لك ${diff} د.ك وتصير توصيلتك علينا!)`;
                    }
                  }

                  return (
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 mb-2 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      <div>
                        <h4 className="text-[11px] font-bold text-brand mb-0.5">
                          ذائقتك
                        </h4>
                        <p className="text-[10px] text-stone-600 leading-relaxed font-medium">
                          {msg}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
                  <h3 className="text-xs font-bold text-stone-500">
                    المنتجات المختارة ({cart.length})
                  </h3>
                </div>
                {cart.map((item: any, index: number) => (
                  <motion.div
                    key={`${item.id}-${index}`}
                    className="relative bg-red-500 rounded-3xl overflow-hidden shadow-sm"
                  >
                    <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center pointer-events-none">
                      <span className="text-white font-bold text-xs flex items-center gap-1">
                        <X className="w-4 h-4" /> مسح
                      </span>
                    </div>
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -100, right: 0 }}
                      dragElastic={0.3}
                      whileDrag={{ scale: 0.98, cursor: "grabbing" }}
                      onDragEnd={(e, info) => {
                        if (info.offset.x < -40) onRemove(item.id);
                      }}
                      className="flex gap-4 p-4 bg-white rounded-3xl border border-stone-100 relative group shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing w-full z-10"
                    >
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-brand text-base">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-white bg-brand px-2 py-0.5 rounded-md">
                              ×{item.quantity}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {item.selectedOption && (
                            <span className="text-[9px] font-bold bg-stone-50/80 backdrop-blur-sm text-stone-500 px-2 py-1 rounded-md border border-stone-100">
                              {item.selectedOption}
                            </span>
                          )}
                          {(item.selectedExtras || []).map(
                            (e: any, idx: number) => (
                              <span
                                key={`${e.name}-${idx}`}
                                className="text-[9px] font-bold bg-accent/5 text-accent px-2 py-1 rounded-md border border-accent/10"
                              >
                                +{e.name}
                              </span>
                            ),
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-stone-50">
                          <span className="text-[10px] font-bold text-stone-400">
                            المجموع الفرعي
                          </span>
                          <span className="text-lg font-medium text-brand">
                            {item.price * item.quantity}{" "}
                            <span className="text-xs text-accent">د.ك</span>
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="absolute -top-2 -left-2 w-8 h-8 bg-white text-red-500 hover:bg-red-500 hover:text-white rounded-full flex items-center justify-center border border-stone-100 shadow-md transition-all opacity-100 sm:opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
              <div className="pt-6 border-t border-stone-100 mt-6 hidden">
                {/* Phone moved to delivery step */}
              </div>
            </div>
          ) : step === "delivery" ? (
            <div className="animate-in slide-in-from-left-4 fade-in duration-300 space-y-6 pt-2">
                <div className="space-y-2">
                  <label className="text-sm items-center gap-1.5 font-bold text-stone-700 flex px-1">
                    <Phone className="w-4 h-4 text-accent" /> أدخل رقم هاتفك لإكمال الطلب
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="رقم الهاتف (8 أرقام)"
                    value={customerPhone}
                    pattern="[0-9]*"
                    onChange={(e) => {
                      const val = normalizeDigits(e.target.value).replace(/[^0-9]/g, "");
                      if (val.length <= 8) {
                        setCustomerPhone(val);
                      }
                      if (isLocked) {
                        setIsLocked(false);
                        setCustomerName("");
                        setAddress({ ...address, region: "", block: "", street: "", building: "" });
                        setCustomerPoints(0);
                      }
                    }}
                    className="w-full px-5 py-4 border-2 border-accent/10 focus:border-accent/40 bg-stone-50/50 hover:bg-stone-50 transition-colors rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-xl text-center tracking-[0.2em] shadow-sm"
                    dir="ltr"
                  />
                </div>
                {customerPhone.length >= 8 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* Improved Region Selection with Search */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] items-center gap-1.5 font-bold text-stone-500 flex px-1">
                      <MapPin className="w-3 h-3" /> المنطقة
                    </label>
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          autoFocus
                          placeholder="ابحث عن منطقتك..."
                          value={address.region}
                          onClick={() => setShowRegions(true)}
                          onBlur={() =>
                            setTimeout(() => setShowRegions(false), 200)
                          }
                          onChange={(e) => {
                            onRegionChange(e.target.value);
                            setRegionSearch(e.target.value);
                            setShowRegions(true);
                          }}
                          className="w-full px-5 py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-lg"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none">
                          <Search className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {showRegions && regions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute z-[60] top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-stone-100 rounded-xl shadow-xl no-scrollbar"
                        >
                          {filteredRegions.length === 0 ? (
                            <div className="p-4 text-xs text-stone-400 text-center italic">
                              لم يتم العثور على نتائج
                            </div>
                          ) : (
                            filteredRegions.map((r: any, idx: number) => (
                              <button
                                key={r.id || idx}
                                type="button"
                                onClick={() => {
                                  onRegionChange(r.name);
                                  setRegionSearch("");
                                  setShowRegions(false);
                                }}
                                className="w-full text-right p-3 hover:bg-accent/5 text-sm font-medium border-b border-stone-50 last:border-0 transition-colors flex items-center justify-between group"
                              >
                                <span className="text-brand group-hover:text-accent transition-colors">
                                  {r.name}
                                </span>
                                <ArrowRight className="w-3 h-3 text-stone-200 group-hover:text-accent transform rotate-180 transition-all" />
                              </button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Address Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] items-center gap-1.5 font-bold text-stone-500 flex px-1">
                        <Landmark className="w-3 h-3" /> القطعة
                      </label>
                      <input
                        placeholder="رقم القطعة"
                        value={address.block}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            block: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-base"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] items-center gap-1.5 font-bold text-stone-500 flex px-1">
                        <MapPin className="w-3 h-3" /> الشارع
                      </label>
                      <input
                        placeholder="اسم/رقم الشارع"
                        value={address.street}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            street: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] items-center gap-1.5 font-bold text-stone-500 flex px-1">
                        <Hash className="w-3 h-3" /> الجادة{" "}
                        <span className="text-stone-300 font-normal">
                          (اختياري)
                        </span>
                      </label>
                      <input
                        placeholder="الجادة"
                        value={address.avenue}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            avenue: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-base"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] items-center gap-1.5 font-bold text-stone-500 flex px-1">
                        <Home className="w-3 h-3" /> المنزل
                      </label>
                      <input
                        placeholder="رقم المنزل/المبنى"
                        value={address.building}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            building: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] items-center gap-1.5 font-bold text-stone-500 flex px-1">
                        <Layers className="w-3 h-3" /> الدور{" "}
                        <span className="text-stone-300 font-normal">
                          (اختياري)
                        </span>
                      </label>
                      <input
                        placeholder="الدور"
                        value={address.floor}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            floor: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-base"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] items-center gap-1.5 font-bold text-stone-500 flex px-1">
                        <Hash className="w-3 h-3" /> الشقة{" "}
                        <span className="text-stone-300 font-normal">
                          (اختياري)
                        </span>
                      </label>
                      <input
                        placeholder="رقم الشقة"
                        value={address.apartment}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            apartment: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-4 border-t border-stone-100">
                    <div className="space-y-1.5">
                      <label className="text-[10px] items-center gap-1.5 font-bold text-stone-500 flex px-1">
                        <User className="w-3 h-3" /> الاسم بالكامل
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="يرجى ادخال بياناتك (الاسم)"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (isLocked) setIsLocked(false);
                          }}
                          className={`w-full px-5 py-4 bg-white border ${isLocked ? "border-green-200" : "border-stone-100"} rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-lg`}
                        />
                        {isLocked && customerName && (
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 animate-in fade-in zoom-in duration-300">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {isLocked && customerName && (
                    <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between gap-2 text-green-700 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>
                          أهلاً {customerName}! ذكرتنا، هذي بياناتك المسجلة
                        </span>
                      </div>
                      {customerPoints > 0 && (
                        <span className="bg-white/80 py-1 px-2 rounded-lg text-[10px] text-green-800 border border-green-200/50 shadow-sm flex items-center gap-1">
                          <span className="text-sm">⭐</span> {customerPoints}{" "}
                          نقطة
                        </span>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-stone-500 px-1">
                      ملاحظات عامة (اختياري)
                    </label>
                    <textarea
                      placeholder="مثال: اتصل قبل الوصول بـ 5 دقائق"
                      value={generalNotes}
                      onChange={(e) => setGeneralNotes(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-stone-100 rounded-lg focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-medium text-sm min-h-[80px]"
                    />
                  </div>
                  </div>
                )}
            </div>
          ) : step === "payment" ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col items-center justify-center w-full pt-8 pb-4 px-2">
              
              <div className="bg-stone-50/80 backdrop-blur-sm border border-stone-100 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 w-full max-w-full relative overflow-hidden shadow-sm flex flex-col items-center justify-center mb-8">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent/5 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-brand/5 rounded-full blur-2xl"></div>
                
                <p className="text-stone-500 font-bold text-xs sm:text-sm mb-3 relative z-10 flex items-center gap-1.5 sm:gap-2 text-center flex-wrap justify-center line-clamp-2 leading-relaxed max-w-[90%]">
                  <Check className="w-4 h-4 text-accent shrink-0" />
                  <span>مجموع طلبك طال عمرك</span>
                </p>
                <div className="flex items-baseline gap-2 relative z-10 flex-wrap justify-center">
                   <span className="text-4xl sm:text-5xl font-bold text-brand tracking-tight break-all text-center">
                     {Number(itemsTotal + deliveryFee - discountAmount).toFixed(3)}
                   </span>
                   <span className="text-lg sm:text-xl font-bold text-stone-400 shrink-0">د.ك</span>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full mb-4">
                <div className="h-px bg-stone-100 flex-1"></div>
                <span className="text-stone-400 font-bold text-xs uppercase tracking-widest shrink-0 text-center">اختار شلون حاب تدفع الفاتورة؟</span>
                <div className="h-px bg-stone-100 flex-1"></div>
              </div>
            </div>
          ) : null}
        </div>

        {cart.length > 0 && (
          <div className="p-6 bg-white border-t border-stone-100 space-y-6 shadow-[0_-15px_40px_rgba(0,0,0,0.02)]">
            <AnimatePresence>
              {formError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3 text-amber-700 text-xs font-bold shadow-sm"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3 h-3" />
                  </div>
                  <p className="flex-1 leading-relaxed">{formError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3 px-1">
              {/* Promo Code Input */}
              {!appliedPromo ? (
                <div className="flex flex-col gap-1.5 pb-4 border-b border-stone-50">
                  <div className="flex gap-2">
                    <input
                      placeholder="كود الخصم (Promo Code)"
                      value={promoCodeInput}
                      onChange={(e) =>
                        setPromoCodeInput(normalizeDigits(e.target.value).toUpperCase())
                      }
                      className="flex-1 px-4 py-2 text-sm bg-stone-50/80 backdrop-blur-sm border border-stone-100 rounded-xl focus:border-accent outline-none placeholder:text-stone-300 font-bold"
                    />
                    <button
                      onClick={validatePromo}
                      disabled={isValidatingPromo || !promoCodeInput.trim()}
                      className="px-4 py-2 bg-brand text-white text-[10px] font-extrabold uppercase rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isValidatingPromo ? "..." : "تطبيق"}
                    </button>
                  </div>
                  {promoError && (
                    <p className="text-[10px] text-red-500 font-bold px-1">
                      {promoError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex justify-between items-center bg-green-50 border border-green-100 p-3 rounded-xl mb-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">
                      كود الخصم مفعل
                    </span>
                    <span className="text-xs font-extrabold text-green-800">
                      {appliedPromo.code}
                    </span>
                  </div>
                  <button
                    onClick={() => setAppliedPromo(null)}
                    className="w-6 h-6 rounded-full bg-white text-red-500 border border-red-50 flex items-center justify-center shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold text-stone-500">
                <span>مجموع طلباتك</span>
                <span className="text-brand font-medium">
                  {Number(itemsTotal || 0).toFixed(2)} د.ك
                </span>
              </div>

              {appliedPromo && (
                <div className="flex justify-between items-center text-xs font-bold text-green-600">
                  <span>الخصم ({appliedPromo.code})</span>
                  <span>- {discountAmount.toFixed(2)} د.ك</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold text-stone-500 pb-3 border-b border-stone-50">
                <span>توصيلة المندوب</span>
                <span className="font-bold">
                  {!address.region ? (
                    <span className="text-stone-300">ناطرين العنوان</span>
                  ) : deliveryFee === -1 ? (
                    <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 flex items-center gap-1 text-[10px]">
                      <AlertCircle className="w-3 h-3" /> المنطقة يبيلها تأكيد
                    </span>
                  ) : deliveryFee === 0 ? (
                    <span className="text-green-500 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
                      <Check className="w-3 h-3" /> التوصيل مجاني
                    </span>
                  ) : (
                    <span className="text-accent">
                      {Number(deliveryFee || 0).toFixed(2)} د.ك
                    </span>
                  )}
                </span>
              </div>
              {customerPoints > 0 && (
                <div className="flex justify-between items-center text-xs font-bold text-amber-600 pb-3 border-b border-stone-50">
                  <span>نقاط الولاء المكتسبة</span>
                  <span className="flex items-center gap-1">
                    ⭐ {customerPoints} نقطة
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold text-brand">
                  حسابك طال عمرك
                </span>
                <div className="text-2xl font-bold text-brand">
                  {Number(total || 0).toFixed(2)}{" "}
                  <span className="text-sm text-accent font-medium">د.ك</span>
                </div>
              </div>
            </div>

            {cart.some((item) => item.preparationInstructions) && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold animate-pulse shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  ⚠️ تنبيه: الطلب يحتوي على أصناف تتطلب وقتاً طويلاً للتجهيز.
                </span>
              </div>
            )}

            {/* Add store status check */}
            {(() => {
              const { isOpen, message } = checkStoreStatus(
                settings?.storeStatus,
              );
              return step === "cart" ? (
                <button
                  disabled={!isOpen}
                  onClick={() => {
                    if (!isOpen) {
                      setFormError(message);
                      return;
                    }
                    setStep("delivery");
                  }}
                  className={cn(
                    "w-full p-5 sm:p-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 text-lg group",
                    isOpen
                      ? "bg-brand text-white shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)]"
                      : "bg-stone-100 border border-stone-100 text-stone-400 cursor-not-allowed",
                  )}
                >
                  {!isOpen ? (
                    <span>{message}</span>
                  ) : (
                    <span>كمل بياناتك</span>
                  )}
                </button>
              ) : step === "delivery" ? (
                <div className="flex flex-col gap-3">
                  <button
                    disabled={!isOpen}
                    onClick={() => {
                      if (customerPhone.length < 8) {
                        setFormError("يرجى إدخال رقم هاتف صحيح مكون من 8 أرقام");
                      } else if (deliveryFee === -1) {
                        setFormError("يرجى اختيار منطقة صحيحة من القائمة");
                      } else if (!customerName) {
                        setFormError("يرجى ادخال بياناتك (الاسم)");
                      } else if (!isOpen) {
                        setFormError(message);
                      } else {
                        setFormError("");
                        setStep("payment");
                      }
                    }}
                    className={cn(
                      "w-full p-5 sm:p-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 text-lg group",
                      customerPhone.length === 8 && deliveryFee !== -1 && customerName && isOpen
                        ? "bg-brand text-white shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)]"
                        : "bg-stone-100 border border-stone-100 text-stone-400 cursor-not-allowed",
                    )}
                  >
                    {!isOpen ? (
                      <span>{message}</span>
                    ) : customerPhone.length < 8 ? (
                      <span>يرجى إدخال رقم هاتف صحيح مكون من 8 أرقام</span>
                    ) : deliveryFee === -1 ? (
                      <span>اختار منطقة التوصيل يالغالي</span>
                    ) : !customerName ? (
                      <span>يرجى ادخال بياناتك</span>
                    ) : (
                      <>
                        <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>ادفع الآن</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-4 fade-in duration-500">
                  <button
                    disabled={isSubmitting}
                    onClick={() => onSubmit(false)}
                    className={cn(
                      "w-full p-4 sm:p-5 rounded-2xl font-bold flex items-center justify-between gap-3 transition-all active:scale-[0.98] text-lg group text-right",
                      !isSubmitting
                        ? "bg-brand text-white shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)] hover:bg-brand/90"
                        : "bg-stone-200 text-stone-400 cursor-not-allowed",
                    )}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ opacity: [1, 0.5, 1], scale: [1, 0.98, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="flex items-center justify-center w-full gap-2"
                      >
                        <Sparkles className="w-5 h-5 opacity-80" />
                        <span>جاري تجهيز الطلب بأمان...</span>
                      </motion.div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                             <CreditCard className="w-6 h-6 text-white" />
                           </div>
                           <div className="flex flex-col items-start gap-1">
                             <span className="text-[17px]">تبي تدفعه كامل؟</span>
                           </div>
                        </div>
                      </>
                    )}
                  </button>

                  {!isSubmitting && (
                    <>
                      <button
                        onClick={() => onSubmit("traditional")}
                        className="w-full bg-stone-100 text-brand rounded-2xl p-4 sm:p-5 shadow-sm active:scale-[0.98] transition-all flex items-center justify-between gap-3 font-bold hover:bg-stone-200 text-lg border border-stone-100 text-right"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white border border-stone-100 rounded-xl flex items-center justify-center shrink-0">
                            <Layers className="w-6 h-6 text-accent" />
                          </div>
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[17px]">تبيها قطية؟</span>
                            <span className="text-[10px] font-medium text-stone-500 uppercase tracking-widest">قسم الفاتورة بمبالغ على ربعك</span>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => onSubmit("roulette")}
                        className="w-full bg-fuchsia-600 text-white rounded-2xl p-4 sm:p-5 shadow-md active:scale-[0.98] transition-all flex items-center justify-between gap-3 font-bold hover:bg-fuchsia-700 text-lg text-right"
                      >
                         <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                             <PartyPopper className="w-6 h-6 text-white" />
                           </div>
                           <div className="flex flex-col items-start gap-1">
                             <span className="text-[17px]">وهق غيرك 🎰</span>
                             <span className="text-[10px] font-medium opacity-80 uppercase tracking-widest">الخاسر باللعبة يدفع الفاتورة!</span>
                           </div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        <div className="fixed bottom-2 left-0 right-0 text-center text-stone-400 text-[10px] font-mono pointer-events-none">
          v4.0.0
        </div>
      </motion.div>
    </motion.div>
  );
}
