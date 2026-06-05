import { DEFAULT_GLOBAL_LOGO } from "../constants";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Compass,
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
  Trophy,
  Medal,
  Target,
  Flame,
  Gift,
  LayoutDashboard,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  PartyPopper,
  Crown,
  Users,
  BellRing,
  LogIn,
} from "lucide-react";
import { Product, OrderItem, Order, Address, Region } from "../types";
import { db } from "../lib/firebase";
import { enableDiwaniyaImportantPush, isDiwaniyaPushReady, watchDiwaniyaForegroundPush, type DiwaniyaPushState } from "../lib/diwaniyaPush";
import { robustGetCurrentPosition } from "../utils/geolocation";
import LeafletLocationPicker from "../components/LeafletLocationPicker";
import LeafletKuwaitMap from "../components/LeafletKuwaitMap";

// Define the default product categories shown to customers.
// Removed "المشويات" و "المشروبات" per latest requirements.  If these
// categories are needed in the future they can be added via the admin UI.
const sanitizeWhatsAppText = (text: string) =>
  String(text || "").replace(/[\u{1F000}-\u{1FAFF}]/gu, "").replace(/\uFFFD/g, "");

const DEFAULT_PRODUCT_CATEGORIES = ["الولائم", "اللحوم", "الدجاج", "البحري", "المقبلات"];

const normalizeCategoryName = (value?: string) => String(value || "عام").trim() || "عام";

const normalizeProductSearchText = (value?: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .trim();



const normalizeCustomerProductKey = (product: any) => {
  const normalizedName = normalizeProductSearchText(product?.name || product?.productName || product?.nameAr || "");
  const normalizedCategory = normalizeProductSearchText(product?.category || "");
  return `${normalizedCategory}::${normalizedName}`;
};

const mergeCustomerFeaturedState = (base: any, extra: any) => {
  if (!base || !extra) return base || extra;
  const baseFeatured = isAdminMenuFeatured(base);
  const extraFeatured = isAdminMenuFeatured(extra);
  if (!baseFeatured && !extraFeatured) return base;
  const bestRank = Math.min(getMenuFeaturedRank(base), getMenuFeaturedRank(extra));
  return {
    ...base,
    isMenuFeatured: baseFeatured || extraFeatured,
    featuredInMenu: base?.featuredInMenu === true || extra?.featuredInMenu === true,
    isFeatured: base?.isFeatured === true || extra?.isFeatured === true,
    featured: base?.featured === true || extra?.featured === true,
    featuredRank: Number.isFinite(bestRank) ? bestRank : 99,
  };
};

const preferCustomerDisplayProduct = (current: any, candidate: any) => {
  if (!current) return candidate;
  const currentHasImage = Boolean(current?.imageUrl || current?.image);
  const candidateHasImage = Boolean(candidate?.imageUrl || candidate?.image);
  let preferred = current;
  if (!currentHasImage && candidateHasImage) preferred = candidate;
  const currentActive = current?.isActive !== false && !current?.isOutOfStock;
  const candidateActive = candidate?.isActive !== false && !candidate?.isOutOfStock;
  if (!currentActive && candidateActive) preferred = candidate;
  return mergeCustomerFeaturedState(preferred, preferred === current ? candidate : current);
};

const getCustomerVisibleProducts = (list: any[] = []) => {
  const grouped = new Map<string, any>();
  (Array.isArray(list) ? list : []).forEach((product: any) => {
    const key = normalizeCustomerProductKey(product);
    if (!key || key === "::") return;
    const current = grouped.get(key);
    grouped.set(key, preferCustomerDisplayProduct(current, product));
  });
  return Array.from(grouped.values());
};

const isAdminMenuFeatured = (product: any) =>
  product?.isMenuFeatured === true || product?.featuredInMenu === true;

const getMenuFeaturedRank = (product: any) => {
  const rank = Number(product?.featuredRank ?? product?.featuredOrder ?? product?.featuredPriority ?? 99);
  return Number.isFinite(rank) && rank > 0 ? rank : 99;
};

const getProductIdentityKey = (product: any) => {
  const normalizedName = normalizeProductSearchText(product?.name || product?.productName || product?.nameAr || "");
  const normalizedCategory = normalizeProductSearchText(product?.category || "");
  return `${normalizedCategory}::${normalizedName}`;
};

const uniqueMenuSignalProducts = (items: any[] = []) => {
  const seen = new Set<string>();
  return (Array.isArray(items) ? items : []).filter((product: any) => {
    const key = getProductIdentityKey(product);
    if (!key || key === "::" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getAutoMenuSignalTitle = (tone: string) => {
  switch (tone) {
    case "diwaniya": return "أصناف نرشحها حق الديوانية وتلوق ليمعة الربع ☕";
    case "cart": return "اختيارات تكمل طلبك بدون زحمة 👌";
    case "morning": return "اختيارات تفتح النفس بهالصبحيات 🌅";
    case "lunch": return "اختيارات غداها حاضر وطعمها في محله 🍛";
    case "weekend": return "يمعة الويكند يبي لها هالذوق 🪵";
    case "night": return "خفايف لطيفة تكمّل السهرة 🌙";
    default: return "اختيارات منتقاة بعناية لذوقك ✨";
  }
};

const getKuwaitiLiveMenuSignal = (products: any[], cart: any[], squadInfo?: any) => {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const isWeekend = day === 4 || day === 5 || day === 6;
  const active = uniqueMenuSignalProducts((products || []).filter((p: any) => p?.isActive !== false && !p?.isOutOfStock && Number(p?.price || 0) > 0));
  const text = (p: any) => `${p?.name || ""} ${p?.category || ""} ${p?.description || ""}`.toLowerCase();
  const groups = {
    breakfast: active.filter((p: any) => /ريوق|فطور|خبز|جبن|بيض|كبدة|نخي/.test(text(p))),
    lunch: active.filter((p: any) => /مجبوس|برياني|مطبق|مربين|عيش|وليمة|لحم|دجاج/.test(text(p))),
    diwaniya: active.filter((p: any) => /ديوانية|صينية|بوكس|وليمة|مشويات|مقبلات|ورق|محشي|ميني/.test(text(p))),
    light: active.filter((p: any) => /خفيف|شورب|سلط|روب|مرق|هريس|جريش/.test(text(p))),
    sweet: active.filter((p: any) => /حلو|كيك|تمر|رهش|لقيمات|كاكاو/.test(text(p))),
  };
  const adminFeatured = active
    .filter(isAdminMenuFeatured)
    .sort((a: any, b: any) => getMenuFeaturedRank(a) - getMenuFeaturedRank(b));
  const mergePicks = (primary: any[], fallback: any[]) => uniqueMenuSignalProducts([...(primary || []), ...(fallback || [])]).slice(0, 3);
  const pick = (list: any[]) => mergePicks(adminFeatured, list.filter(Boolean));

  if (squadInfo?.id && pick(groups.diwaniya).length) return { title: getAutoMenuSignalTitle("diwaniya"), subtitle: "", items: pick(groups.diwaniya), tone: "diwaniya" };
  if (cart?.length && active.length) {
    const cartCategories = new Set(cart.map((i: any) => normalizeCategoryName(i.category)));
    const complement = active.filter((p: any) => !cartCategories.has(normalizeCategoryName(p.category)));
    const items = mergePicks(adminFeatured, complement);
    if (items.length) return { title: getAutoMenuSignalTitle("cart"), subtitle: "", items, tone: "cart" };
  }
  if (hour < 11 && pick(groups.breakfast).length) return { title: getAutoMenuSignalTitle("morning"), subtitle: "", items: pick(groups.breakfast), tone: "morning" };
  if (hour >= 11 && hour < 17 && pick(groups.lunch).length) return { title: getAutoMenuSignalTitle("lunch"), subtitle: "", items: pick(groups.lunch), tone: "lunch" };
  if (isWeekend && pick(groups.diwaniya).length) return { title: getAutoMenuSignalTitle("weekend"), subtitle: "", items: pick(groups.diwaniya), tone: "weekend" };
  if (hour >= 21 && pick(groups.light).length) return { title: getAutoMenuSignalTitle("night"), subtitle: "", items: pick(groups.light), tone: "night" };
  const defaultItems = mergePicks(adminFeatured, active);
  return { title: getAutoMenuSignalTitle("default"), subtitle: "", items: defaultItems, tone: "default" };
};

const getSharedProductCategories = (source: any, productList: any[] = []) => {
  const configured =
    source?.productCategories ||
    source?.menuCategories ||
    source?.settings?.productCategories ||
    source?.settings?.menuCategories ||
    [];
  const configuredNames = Array.isArray(configured)
    ? configured.map((cat: any) => normalizeCategoryName(typeof cat === "string" ? cat : cat?.name || cat?.title)).filter(Boolean)
    : [];
  const productNames = productList.map((p: any) => normalizeCategoryName(p?.category)).filter(Boolean);
  return Array.from(new Set([...configuredNames, ...DEFAULT_PRODUCT_CATEGORIES, ...productNames]));
};

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  cn,
  normalizePhone,
  normalizeDigits,
  isValidPhone,
  checkStoreStatus,
  formatKuwaitiDate,
} from "../utils";
import {
  calculateItemAddons,
  calculateItemTotalWithAddons,
  calculateItemBasePriceWithHiddenAddons,
  getVisibleAddons,
  normalizeAddons,
  isAddonRequired,
  getQuantityRuleLimits,
} from "../utils/priceCalculation";
import { ZenSplashScreen } from "../components/ZenSplashScreen";
import { DynamicEnvironment } from "../components/DynamicEnvironment";
import { redirectToPayment } from "../utils/redirect";
import { SquadModalContent } from "../components/SquadModalContent";
import { buildWhatsAppInvoiceText, buildWhatsAppPaymentLinkText } from "../utils/invoiceShare";


const cleanPhoneForSquad = (phone: any): string => {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");

  // If it starts with 965 and is longer than 8 digits, it's a full country code
  if (cleaned.startsWith("965") && cleaned.length > 8) {
    cleaned = cleaned.slice(3);
  }

  // Kuwait numbers are 8 digits. Take the last 8 digits available to be safe.
  if (cleaned.length >= 8) {
    return cleaned.slice(-8);
  }
  return cleaned;
};

const clampSquadGeofenceDistance = (value: any, fallback = 100): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(10, Math.min(1000, Math.round(n)));
};

const getSquadGeofenceDistance = (settings: any): number => {
  const candidates = [
    settings?.squadGeofenceDistance,
    settings?.settings?.squadGeofenceDistance,
    settings?.squadSettings?.geofenceDistance,
    settings?.squadSettings?.squadGeofenceDistance,
    settings?.diwaniyaGeofenceDistance,
    settings?.settings?.diwaniyaGeofenceDistance,
    settings?.geofenceDistance,
    settings?.settings?.geofenceDistance,
    settings?.radarDistance,
    settings?.settings?.radarDistance,
    settings?.radarGeofenceDistance,
    settings?.settings?.radarGeofenceDistance,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return clampSquadGeofenceDistance(n);
  }
  return 100;
};

const getSquadSpecificGeofenceDistance = (squad: any, settings: any): number => {
  return clampSquadGeofenceDistance(
    squad?.geofenceDistance ??
      squad?.squadGeofenceDistance ??
      squad?.diwaniyaGeofenceDistance ??
      squad?.radarDistance ??
      squad?.location?.geofenceDistance,
    getSquadGeofenceDistance(settings)
  );
};

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
    // vibration disabled: keep visual notification stable
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

const formatPoints = (count: number) => {
  if (count === 1) return "نقطة واحدة";
  if (count === 2) return "نقطتين";
  if (count >= 3 && count <= 10) return `${count} نقاط`;
  return `${count} نقطة`;
};

const INITIAL_LOYALTY_TIERS = [
  { id: "bronze", name: "شلة ديوانية", minPoints: 0, maxPoints: 99, color: "text-amber-700", bg: "bg-amber-50", icon: "🤝", benefit: "بداية أسطورة! طلعاتك الياية فيها مفاجآت." },
  { id: "silver", name: "عزوة", minPoints: 100, maxPoints: 499, color: "text-slate-600", bg: "bg-slate-100", icon: "🛡️", benefit: "خصم ٥٪ تلقائي على جميع طلباتك!" },
  { id: "gold", name: "نواخذة", minPoints: 500, maxPoints: 1499, color: "text-yellow-600", bg: "bg-yellow-50", icon: "👑", benefit: "خصم ١٠٪ وعروض حصرية لك بس." },
  { id: "diamond", name: "شيوخ", minPoints: 1500, maxPoints: 999999, color: "text-sky-600", bg: "bg-sky-50", icon: "🦅", benefit: "خصم ١٥٪ + توصيل مجاني مدى الحياة!" }
];


const normalizeAdminArray = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    try { return normalizeAdminArray(JSON.parse(raw)); } catch { return []; }
  }
  if (typeof raw === "object") {
    const candidate = raw.tiers ?? raw.levels ?? raw.items ?? raw.list ?? raw.values;
    if (candidate && candidate !== raw) return normalizeAdminArray(candidate);
    return Object.entries(raw).map(([key, value]: any) => (
      value && typeof value === "object" ? { id: value.id ?? key, ...value } : null
    )).filter(Boolean);
  }
  return [];
};

const parseAdminPoints = (value: any): number => {
  const n = Number(String(value ?? 0)
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};


const getAdminSquadTierIconType = (tier: any): string => {
  const raw = String(tier?.iconType || tier?.icon || "");
  const byEmoji: Record<string, string> = { "🏆": "Trophy", "👑": "Crown", "⭐": "Star", "🏅": "Medal", "🥉": "Medal", "🔥": "Flame", "⚔️": "Swords", "💎": "Diamond", "🚀": "Rocket", "🛡️": "Shield", "🎯": "Target" };
  return byEmoji[raw] || raw || "Target";
};

const renderAdminSquadTierBadge = (tier: any, sizeClass = "w-9 h-9") => {
  const iconType = getAdminSquadTierIconType(tier);
  const gradient = String(tier?.adminColor || tier?.iconColor || tier?.color || "").includes("from-")
    ? String(tier?.adminColor || tier?.iconColor || tier?.color)
    : "from-orange-400 to-orange-600";
  const iconClass = sizeClass.includes("w-16") ? "w-8 h-8" : sizeClass.includes("w-12") ? "w-6 h-6" : "w-5 h-5";
  const content = iconType === "Medal" ? <Medal className={iconClass} />
    : iconType === "Star" ? <Star className={iconClass} />
    : iconType === "Crown" ? <Crown className={iconClass} />
    : iconType === "Trophy" ? <Trophy className={iconClass} />
    : iconType === "Target" ? <Target className={iconClass} />
    : iconType === "Flame" ? <span className={sizeClass.includes("w-16") ? "text-3xl" : "text-xl"}>🔥</span>
    : iconType === "Swords" ? <span className={sizeClass.includes("w-16") ? "text-3xl" : "text-xl"}>⚔️</span>
    : iconType === "Diamond" ? <span className={sizeClass.includes("w-16") ? "text-3xl" : "text-xl"}>💎</span>
    : iconType === "Rocket" ? <span className={sizeClass.includes("w-16") ? "text-3xl" : "text-xl"}>🚀</span>
    : iconType === "Shield" ? <span className={sizeClass.includes("w-16") ? "text-3xl" : "text-xl"}>🛡️</span>
    : <Target className={iconClass} />;
  return <span className={`${sizeClass} rounded-full flex items-center justify-center text-white bg-gradient-to-br ${gradient} shrink-0 shadow-sm`}>{content}</span>;
};

const normalizeSquadTierForCustomer = (tier: any, index: number, all: any[]) => {
  const sortedMins = all.map((t: any) => parseAdminPoints(t?.minPoints ?? t?.points ?? t?.requiredPoints ?? 0)).sort((a, b) => a - b);
  const minPoints = parseAdminPoints(tier?.minPoints ?? tier?.points ?? tier?.requiredPoints ?? 0);
  const nextMin = sortedMins.find((v) => v > minPoints);
  const safeColors = ["text-orange-700", "text-slate-700", "text-amber-700", "text-purple-700", "text-emerald-700", "text-sky-700"];
  const safeBgs = ["bg-orange-50", "bg-slate-100", "bg-amber-50", "bg-purple-50", "bg-emerald-50", "bg-sky-50"];
  const iconType = String(tier?.iconType || tier?.icon || "");
  return {
    ...tier,
    id: String(tier?.id ?? tier?.name ?? tier?.title ?? index),
    name: tier?.name || tier?.title || "",
    minPoints,
    maxPoints: parseAdminPoints(tier?.maxPoints ?? (nextMin ? nextMin - 1 : 999999999)),
    color: String(tier?.color || "").startsWith("text-") ? tier.color : safeColors[index] || "text-brand",
    adminColor: String(tier?.adminColor || tier?.iconColor || tier?.color || "").includes("from-") ? String(tier?.adminColor || tier?.iconColor || tier?.color) : "from-orange-400 to-orange-600",
    bg: String(tier?.bg || "").startsWith("bg-") ? tier.bg : safeBgs[index] || "bg-stone-50",
    iconType,
    icon: tier?.icon || (iconType === "Trophy" ? "🏆" : iconType === "Crown" ? "👑" : iconType === "Star" ? "⭐" : iconType === "Medal" ? "🏅" : iconType === "Flame" ? "🔥" : iconType === "Swords" ? "⚔️" : iconType === "Diamond" ? "💎" : iconType === "Rocket" ? "🚀" : iconType === "Shield" ? "🛡️" : "🎯"),
    benefit: tier?.benefit || tier?.label || tier?.description || "",
    description: tier?.description || tier?.label || tier?.benefit || "",
    challenge: tier?.challenge || tier?.challengeText || tier?.mission || tier?.label || tier?.benefit || "",
    challengeText: tier?.challengeText || tier?.challenge || tier?.mission || tier?.label || tier?.benefit || "",
    imageUrl: tier?.imageUrl || tier?.image || tier?.logo || tier?.badgeImage || "",
    image: tier?.image || tier?.imageUrl || tier?.logo || tier?.badgeImage || "",
    logo: tier?.logo || tier?.imageUrl || tier?.image || tier?.badgeImage || "",
  };
};

const getAnyPoints = (source: any): number => {
  const value = source?.points ?? source?.totalPoints ?? source?.teamPoints ?? source?.score ?? source?.balance ?? source?.totalOrders ?? 0;
  const n = Number(String(value).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const normalizeProductForAddons = (product: any) => {
  if (!product) return null;
  return {
    ...product,
    addons: normalizeAddons(product.addons)
  };
};

const getAddonKey = (addon: any) =>
  String(addon?.id || addon?.addonId || addon?.name || "");

const cleanCustomerAddonLabel = (value: any): string => {
  const original = String(value || "").trim();
  if (!original) return "";

  const cleaned = original
    .replace(/\s*[\(\[\{]?\s*المقترح\s*[0-9٠-٩۰-۹]+\s*[\)\]\}]?/g, " ")
    .replace(/\s*[\(\[\{]?\s*كل\s*[0-9٠-٩۰-۹]+\s*أ?طباق?\s*تحسب\s*مر[ةه]\s*[\)\]\}]?/g, " ")
    .replace(/\s*[\(\[\{]?\s*تحسب\s*مر[ةه]\s*[\)\]\}]?/g, " ")
    .replace(/\s*[-–—|•:،,]+\s*$/g, "")
    .replace(/^\s*[-–—|•:،,]+\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || original;
};

export default function CustomerSite() {
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updatePhoneLayout = () => setIsPhoneLayout(mediaQuery.matches);
    updatePhoneLayout();
    mediaQuery.addEventListener?.("change", updatePhoneLayout);
    return () => mediaQuery.removeEventListener?.("change", updatePhoneLayout);
  }, []);

  const [settings, setSettings] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("cached_settings");
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      return {};
    }
  });
  
  const LOYALTY_TIERS = useMemo(() => {
    const tiers = normalizeAdminArray(settings.loyaltyTiers ?? settings.loyaltyLevels ?? settings.loyaltySettings?.tiers);
    return tiers.length > 0 ? tiers : INITIAL_LOYALTY_TIERS;
  }, [settings.loyaltyTiers, settings.loyaltyLevels, settings.loyaltySettings]);

  const SQUAD_TIERS = useMemo(() => {
    // مستويات طريق الديوانية تؤخذ فقط من قاعدة البيانات المشتركة، بدون أي مستويات افتراضية من الواجهة.
    const rawTiers = normalizeAdminArray(settings.squadTiers ?? settings.squadLevels ?? settings.diwaniyaTiers ?? settings.diwaniyaLevels ?? settings.squadSettings?.tiers);
    return [...rawTiers]
      .map((tier, index, all) => normalizeSquadTierForCustomer(tier, index, all))
      .filter((tier: any) => Boolean(String(tier?.name || "").trim()))
      .sort((a, b) => Number(a.minPoints || 0) - Number(b.minPoints || 0));
  }, [settings.squadTiers, settings.squadLevels, settings.diwaniyaTiers, settings.diwaniyaLevels, settings.squadSettings]);

  const getLoyaltyTier = useCallback((points: number) => {
    return LOYALTY_TIERS.find((t: any) => points >= t.minPoints && points <= t.maxPoints) || LOYALTY_TIERS[0];
  }, [LOYALTY_TIERS]);

  const getSquadTier = useCallback((points: number) => {
    return SQUAD_TIERS.find((t: any) => { const min = Number(t.minPoints ?? t.points ?? t.requiredPoints ?? 0); const max = Number(t.maxPoints ?? 999999999); return points >= min && points <= max; }) || [...SQUAD_TIERS].reverse().find((t: any) => points >= Number(t.minPoints ?? t.points ?? t.requiredPoints ?? 0)) || null;
  }, [SQUAD_TIERS]);

  const LoyaltyTierCard = ({ customerPoints, customerName }: { customerPoints: number, customerName: string }) => {
    const currentTier = useMemo(() => getLoyaltyTier(customerPoints), [customerPoints]);
    const nextTierIndex = useMemo(() => LOYALTY_TIERS.indexOf(currentTier) + 1, [currentTier, LOYALTY_TIERS]);
    const nextTier = useMemo(() => nextTierIndex < LOYALTY_TIERS.length ? LOYALTY_TIERS[nextTierIndex] : null, [nextTierIndex, LOYALTY_TIERS]);
    
    const progressPercent = useMemo(() => {
      if (!nextTier) return 100;
      const range = nextTier.minPoints - currentTier.minPoints;
      const currentProgress = customerPoints - currentTier.minPoints;
      return Math.min(100, Math.max(0, (currentProgress / (range || 1)) * 100));
    }, [customerPoints, currentTier, nextTier]);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-[32px] p-6 border-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden transition-all duration-500", 
          currentTier.bg, 
          currentTier.id === 'diamond' ? 'border-sky-200' : currentTier.id === 'gold' ? 'border-yellow-200' : 'border-stone-100'
        )}
      >
        {/* Glow Effects */}
        {(currentTier.id === 'gold' || currentTier.id === 'diamond') && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div 
                    animate={{ 
                      rotate: 360,
                      scale: [1, 1.2, 1]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className={cn(
                      "absolute -top-24 -right-24 w-64 h-64 blur-3xl opacity-30",
                      currentTier.id === 'gold' ? 'bg-yellow-400' : 'bg-sky-400'
                    )}
                />
            </div>
        )}
        
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 10 }}
              className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl shrink-0"
            >
              {renderAdminSquadTierBadge(currentTier, "w-14 h-14")}
            </motion.div>
            <div className="text-right">
              <h3 className="text-xl font-black text-brand flex items-center gap-2">
                مستوى {currentTier.name}
                {currentTier.id === 'diamond' && <Crown className="w-5 h-5 text-sky-500 fill-current" />}
              </h3>
              <p className="text-xs font-bold text-stone-500">
                 حياك الله يا {customerName || "بطل"}! رصيدك {customerPoints} {formatPoints(customerPoints)}
              </p>
            </div>
          </div>
          <div className="hidden sm:block">
             <div className="px-3 py-1 bg-white/60 rounded-full border border-white/40">
                <span className="text-[10px] font-black uppercase tracking-tighter opacity-40 text-brand">رادار الولاء</span>
             </div>
          </div>
        </div>

        <div className="relative z-10">
           {nextTier ? (
             <>
               <div className="flex justify-between items-end mb-2.5 px-0.5">
                 <p className="text-xs font-bold text-brand">
                    <span className="opacity-60">باقي لك</span> <span className="text-accent underline font-black mx-0.5">{nextTier.minPoints - customerPoints}</span> <span className="opacity-60">وتصير</span> <span className="font-black text-stone-800">{nextTier.name}!</span> 🚀
                 </p>
                 <span className="text-[10px] font-black text-stone-400">
                   {Math.round(progressPercent)}%
                 </span>
               </div>
               <div className="h-3 bg-white/80 rounded-full overflow-hidden border border-stone-100/50 p-0.5 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "h-full rounded-full relative overflow-hidden", 
                      currentTier.id === 'diamond' ? 'bg-sky-500' : currentTier.id === 'gold' ? 'bg-yellow-500' : 'bg-brand'
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </motion.div>
               </div>
             </>
           ) : (
             <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-200/50 flex items-center gap-3">
                <div className="bg-sky-500 p-2 rounded-lg text-white">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="font-black text-sm text-sky-700">لقد وصلت لقمة الهرم!</h4>
                  <p className="text-[10px] font-bold text-sky-600/80">أنت الحين أسطورة ماسيّة، كل الدلع لك.</p>
                </div>
             </div>
           )}

           <div className="mt-6 p-4 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">🎁</div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-0.5">مكتسباتك</p>
                <p className="text-[11px] font-black text-brand leading-tight">{currentTier.benefit}</p>
              </div>
           </div>
        </div>
      </motion.div>
    );
  };
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem("cached_products");
      return cached ? getCustomerVisibleProducts(JSON.parse(cached)) : [];
    } catch (e) {
      return [];
    }
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(() => {
    try {
      return !localStorage.getItem("cached_products");
    } catch (e) {
      return true;
    }
  });
  const [topProducts, setTopProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem("cached_top_products");
      return cached ? getCustomerVisibleProducts(JSON.parse(cached)) : [];
    } catch (e) {
      return [];
    }
  });
  const [regions, setRegions] = useState<Region[]>(() => {
    try {
      const cached = localStorage.getItem("cached_regions");
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckout, setIsCheckout] = useState(false);
  const [checkoutInitialStep, setCheckoutInitialStep] = useState<"cart" | "delivery" | "payment">("cart");
  const closeCheckoutToMenu = () => {
    setIsCheckout(false);
    setCheckoutInitialStep("cart");
    setTimeout(() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };
  const [isCreatingSquad, setIsCreatingSquad] = useState(false);
  const [newSquadName, setNewSquadName] = useState("");
  const [isSubmittingSquad, setIsSubmittingSquad] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [isJoiningSquad, setIsJoiningSquad] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderSuccessId, setOrderSuccessId] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [orderPaymentLink, setOrderPaymentLink] = useState("");

  const [lastOrderInfo, setLastOrderInfo] = useState<any>(null);
  const [customerOrderHistory, setCustomerOrderHistory] = useState<any[]>([]);
  const [customerHistoricalOrdersCount, setCustomerHistoricalOrdersCount] = useState(0);
  const [isZeroClickLoading, setIsZeroClickLoading] = useState(false);

  const [orderSuccessCustomerData, setOrderSuccessCustomerData] = useState({
    name: "",
    phone: "",
  });

  const [customerName, setCustomerName] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [customerPhone, setCustomerPhone] = useState(() => {
    try { return localStorage.getItem("customer_phone_track") || ""; } catch(e) { return ""; }
  });
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
  
  // Gamification & Squads
  const [squadInfo, setSquadInfo] = useState<any>(null);
  const [userSquads, setUserSquads] = useState<any[]>([]);
  const [topSquads, setTopSquads] = useState<any[]>([]);
  const strongestFiveSquads = useMemo(() => (Array.isArray(topSquads) ? topSquads : [])
    .map((sq: any) => ({
      ...sq,
      displayPoints: getAnyPoints(sq) || Number(sq.teamPoints || sq.totalPoints || sq.points || sq.totalOrders || 0),
    }))
    .sort((a: any, b: any) => Number(b.displayPoints || 0) - Number(a.displayPoints || 0))
    .slice(0, 5), [topSquads]);
  const [pendingGeofenceRequests, setPendingGeofenceRequests] = useState<any[]>([]);
  const [activeSquads, setActiveSquads] = useState<any[]>([]);
  const [myGeofenceRequests, setMyGeofenceRequests] = useState<any[]>([]);
  const [squadPresence, setSquadPresence] = useState<any[]>([]);
  const [activeGroupOrder, setActiveGroupOrder] = useState<any>(null);
  const [activeQatyaOrders, setActiveQatyaOrders] = useState<any[]>([]);
  const [tempCodes, setTempCodes] = useState<any[]>([]);
  const [usualOrder, setUsualOrder] = useState<any>(null);
  const [squadBeautifulLog, setSquadBeautifulLog] = useState<any>(null);
  const [diwaniyaNotifications, setDiwaniyaNotifications] = useState<any[]>([]);
  const [unreadDiwaniyaNotifications, setUnreadDiwaniyaNotifications] = useState(0);
  const [showSquadModal, setShowSquadModal] = useState(false);

  const [showAppetiteTheatre, setShowAppetiteTheatre] = useState(() => {
    try {
      return !sessionStorage.getItem("appetite_theatre_shown");
    } catch (e) {
      return true;
    }
  });

  const [theatrePhrase] = useState(() => {
    const APPETITE_PHRASES = [
      "نقدم لكم أفخم طعم مع خدمة تليق بمقامكم الكريم 🤝☕",
      "يا هلا ومسهلا بالربع.. الكرم على أصوله تلاقونه بالسدو ☕",
      "دلة وهيل، وجمعة تفتح النفس على أطيب طعم تراثي 🍢",
      "اقلط عندنا.. ذوق الماضي بلمسة الحاضر الفخمة تفضل 🐪"
    ];
    return APPETITE_PHRASES[Math.floor(Math.random() * APPETITE_PHRASES.length)];
  });

  // 🧬 Biometrics, Gyroscope & Automatic Proximity Login
  const [biometricScanSquad, setBiometricScanSquad] = useState<any | null>(null);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [biometricStep, setBiometricStep] = useState<"ready" | "scanning" | "success" | "idle">("idle");

  const triggerBiometricBypassJoin = (sq: any) => {
    if (sessionStorage.getItem(`biometric_autologin_${sq.id}`)) return;
    sessionStorage.setItem(`biometric_autologin_${sq.id}`, "1");
    setBiometricScanSquad(sq);
    setIsBiometricScanning(true);
    setBiometricStep("scanning");
    triggerHapticAndSound("click");

    setTimeout(() => {
      // Generate unique traditional guest profiles
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const guestPhone = `9005${suffix}`;
      const names = ["بوجاسم", "بوشهاب", "بوسعود", "بوخالد", "بوعلي", "بوفهد"];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const autoName = `ضيف السدو - ${randomName}`;

      try {
        localStorage.setItem("customer_phone_track", guestPhone);
        localStorage.setItem("customerName", autoName);
      } catch (e) {}
      setCustomerPhone(guestPhone);
      setCustomerName(autoName);

      fetch("/api/squad-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: guestPhone,
          squadId: sq.id,
          name: autoName,
          isAuto: true
        })
      }).then((res) => {
        if (res.ok) {
          fetch("/api/squad-presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              squadId: sq.id,
              phone: guestPhone,
              name: autoName,
              action: "in"
            })
          }).then(() => {
            fetchSquadGamification();
            triggerHapticAndSound("success");
            setBiometricStep("success");
            setTimeout(() => {
              setIsBiometricScanning(false);
              setBiometricScanSquad(null);
              // Open and focus squad modal
              setActiveSquadId(sq.id);
              setShowSquadModal(true);
              setZeroClickWelcome({
                squadName: sq.name,
                name: autoName
              });
            }, 1200);
          });
        }
      });
    }, 2400);
  };
  const [initialSquadCode, setInitialSquadCode] = useState("");
  const [activeSquadTab, setActiveSquadTab] = useState<"overview"|"orders"|"notifications"|"location"|"leaderboard"|"tiers">("overview");
  const [activeSquadId, setActiveSquadId] = useState(() => localStorage.getItem("squadId") || "");
  const squadSessionTokenRef = useRef(0);
  const latestSquadRequestRef = useRef({ phone: "", squadId: "" });
  const [isRadarBannerCollapsed, setIsRadarBannerCollapsed] = useState(false);
  const [isNearbyRadarPanelCollapsed, setIsNearbyRadarPanelCollapsed] = useState(false);
  const hasAnimatedRadarBannerRef = useRef(false);

  useEffect(() => {
    const hasPending = myGeofenceRequests.some(r => r.status === "pending");
    if (hasPending && !hasAnimatedRadarBannerRef.current) {
      hasAnimatedRadarBannerRef.current = true;
      setIsRadarBannerCollapsed(false);
      const timer = setTimeout(() => {
        setIsRadarBannerCollapsed(true);
      }, 6000);
      return () => clearTimeout(timer);
    } else if (!hasPending) {
      hasAnimatedRadarBannerRef.current = false;
    }
  }, [myGeofenceRequests]);

  const applySquadGamificationData = useCallback((data: any, requestPhone: string, requestSquadId: string) => {
       setTopSquads(data.topSquads || []);
       setActiveSquads(data.activeSquads || []);

       // بيانات المستخدم والديوانية لا تنعرض إلا إذا فيه رقم مسجل فعلاً.
       // هذا يمنع رجوع كروت الديوانية بعد تسجيل الخروج بسبب رد قديم من السيرفر.
       if (!requestPhone) {
         setUserSquads([]);
         setPendingGeofenceRequests([]);
         setMyGeofenceRequests([]);
         setSquadPresence([]);
         setActiveGroupOrder(null);
         setActiveQatyaOrders([]);
         setTempCodes([]);
         setUsualOrder(null);
         setSquadBeautifulLog(null);
         setDiwaniyaNotifications([]);
         setUnreadDiwaniyaNotifications(0);
         setSquadInfo(null);
         return;
       }

       setUserSquads(data.userSquads || []);
       setPendingGeofenceRequests(data.pendingGeofenceRequests || []);
       setMyGeofenceRequests(data.myGeofenceRequests || []);
       setSquadPresence(data.squadPresence || []);
       setActiveGroupOrder(data.activeGroupOrder || null);
       setActiveQatyaOrders(Array.isArray(data.activeQatyaOrders) ? data.activeQatyaOrders : []);
       setTempCodes(data.tempCodes || []);
       setUsualOrder(data.usualOrder || null);
       setSquadBeautifulLog(data.squadBeautifulLog || null);
       setDiwaniyaNotifications(data.diwaniyaNotifications || []);
       setUnreadDiwaniyaNotifications(Number(data.unreadDiwaniyaNotifications || 0));
       if (data.mySquad || requestSquadId) {
         if (data.myMemberData?.name && data.myMemberData.name !== "عميل") {
            setCustomerName(prev => prev || data.myMemberData.name);
         }
         setSquadInfo(data.mySquad ? {
            ...data.mySquad,
            rank: data.myRank,
            memberData: data.myMemberData
         } : null);
       } else {
         setSquadInfo(null);
       }
  }, []);

  const fetchSquadGamificationFor = useCallback(async (phoneOverride?: string, squadIdOverride?: string) => {
    const requestToken = squadSessionTokenRef.current;
    const requestPhone = phoneOverride ?? customerPhone;
    const requestSquadId = squadIdOverride ?? activeSquadId;
    try {
       const endpoint = `/api/squad-gamification?phone=${encodeURIComponent(requestPhone)}&squadId=${encodeURIComponent(requestSquadId)}`;
       const res = await fetch(endpoint);
       if (!res.ok) return;
       const data = await res.json();
       const isExplicitRefresh = phoneOverride !== undefined || squadIdOverride !== undefined;
       if (!isExplicitRefresh) {
         if (requestToken !== squadSessionTokenRef.current) return;
         if (latestSquadRequestRef.current.phone !== requestPhone || latestSquadRequestRef.current.squadId !== requestSquadId) return;
       }
       applySquadGamificationData(data, requestPhone, requestSquadId);
    } catch(e) {}
  }, [customerPhone, activeSquadId, applySquadGamificationData]);

  const fetchSquadGamification = useCallback(() => {
    return fetchSquadGamificationFor();
  }, [fetchSquadGamificationFor]);

  // Geofencing background states
  const [zeroClickWelcome, setZeroClickWelcome] = useState<{ squadName: string; name: string } | null>(null);
  const [mockLocation, setMockLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hideMockOption, setHideMockOption] = useState(false);
  const [radarNearbySquads, setRadarNearbySquads] = useState<any[]>([]);
  const [radarLoadingMap, setRadarLoadingMap] = useState<Record<string, boolean>>({});
  const [radarSuccessMap, setRadarSuccessMap] = useState<Record<string, boolean>>({});
  const [isOwnerJoinAlertCollapsed, setIsOwnerJoinAlertCollapsed] = useState(true);
  const [isQatyaAlertCollapsed, setIsQatyaAlertCollapsed] = useState(true);
  const [ownerJoinDecisionLoading, setOwnerJoinDecisionLoading] = useState<Record<string, boolean>>({});
  const [radarStatus, setRadarStatus] = useState<"idle" | "checking" | "ready" | "denied" | "weak" | "unsupported" | "empty">("idle");
  const [showRadarInstructionModal, setShowRadarInstructionModal] = useState(false);
  const [radarStatusMsg, setRadarStatusMsg] = useState("نطلب موقعك عشان الديوانية تعتمد على القرب الحقيقي.");
  const [radarAccuracy, setRadarAccuracy] = useState<number | null>(null);
  const radarStatusRef = useRef<typeof radarStatus>("idle");
  const locationPromptAttemptsRef = useRef(0);
  const locationPromptTimerRef = useRef<number | null>(null);
  const [radarDismissedList, setRadarDismissedList] = useState<string[]>(() => {
     try {
       return JSON.parse(localStorage.getItem("radar_dismissed_squads") || "[]");
     } catch(e) {
       return [];
     }
  });

  // Save dismissed array
  useEffect(() => {
     localStorage.setItem("radar_dismissed_squads", JSON.stringify(radarDismissedList));
  }, [radarDismissedList]);

  useEffect(() => {
     // عند تغيير الرقم أو الخروج نرجع رادار الديوانيات نظيفاً حتى تظهر بطاقات القرب للضيف الجديد.
     setRadarDismissedList([]);
     setRadarSuccessMap({});
     setRadarNearbySquads([]);
     setIsNearbyRadarPanelCollapsed(false);
     try { localStorage.removeItem("radar_dismissed_squads"); } catch(e) {}
  }, [customerPhone]);

  useEffect(() => {
     if (radarNearbySquads.length > 0) {
       setIsNearbyRadarPanelCollapsed(false);
       setIsOwnerJoinAlertCollapsed(true);
       setIsQatyaAlertCollapsed(true);
     }
  }, [radarNearbySquads.length]);

  useEffect(() => {
     if ((pendingGeofenceRequests?.length || 0) > 0) {
       setIsOwnerJoinAlertCollapsed(true);
       setIsNearbyRadarPanelCollapsed(true);
       setIsQatyaAlertCollapsed(true);
     }
  }, [pendingGeofenceRequests?.length]);

  const qatyaNotifications = useMemo(() => {
    return (diwaniyaNotifications || [])
      .filter((n: any) => {
        if (String(n.type || "") !== "qatya_request" || n.readAt) return false;
        const oId = n.meta?.orderId;
        if (!oId) return false;
        return (activeQatyaOrders || []).some((o: any) => String(o.id) === String(oId));
      })
      .slice(0, 5);
  }, [diwaniyaNotifications, activeQatyaOrders]);

  const wobbleNotifications = useMemo(() => {
    return (diwaniyaNotifications || [])
      .filter((n: any) => String(n.type || "") === "wobble_alert" && !n.readAt)
      .slice(0, 3);
  }, [diwaniyaNotifications]);

  const [isWobbleAlertCollapsed, setIsWobbleAlertCollapsed] = useState(false);

  useEffect(() => {
    if (qatyaNotifications.length > 0) {
      setIsQatyaAlertCollapsed(true);
      setIsNearbyRadarPanelCollapsed(true);
      setIsOwnerJoinAlertCollapsed(true);
      setIsWobbleAlertCollapsed(true);
    }
  }, [qatyaNotifications.length]);

  useEffect(() => {
    if (wobbleNotifications.length > 0 && !qatyaNotifications.length) {
      setIsWobbleAlertCollapsed(true);
    }
  }, [wobbleNotifications.length, qatyaNotifications.length]);

  const refreshRadarOnce = useCallback(async () => {
      if (mockLocation) {
        setRadarStatus("ready");
        setRadarStatusMsg("تم تفعيل الموقع التجريبي المحاكي بجانب ديوانية قريبة للتجربة 🧪");
        return;
      }
     if (!navigator.geolocation) {
       setRadarStatus("unsupported");
       setRadarStatusMsg("جهازك أو المتصفح ما يدعم تحديد الموقع، لذلك الرادار ما يقدر يشتغل على هذا الجهاز.");
       return;
     }

     setRadarStatus("checking");
     setRadarStatusMsg("جاري الاتصال بالأقمار الصناعية لتحديد موقعك... 📡");
     setRadarDismissedList([]);
     setIsNearbyRadarPanelCollapsed(false);
     try { localStorage.removeItem("radar_dismissed_squads"); } catch(e) {}

     try {
       const position = await robustGetCurrentPosition({
         timeout: 25000,
         maximumAge: 0,
         enableHighAccuracy: true
       });
       
       const accuracy = Number(position.coords.accuracy || 0);
       setRadarAccuracy(Math.round(accuracy));
       if (accuracy > 600) {
         setRadarStatus("weak");
         setRadarStatusMsg("اشتغل الموقع، لكن الدقة ضعيفة جداً. افتح GPS أو الواي فاي وجرّب تحديث الموقع حتى لا نحكم عليك بعيد بالغلط.");
       } else {
         setRadarStatus("ready");
         setRadarStatusMsg("تم التقاط موقعك بنجاح. الرادار شغال الآن، وإذا فيه ديوانية قريبة راح تظهر لك مباشرة.");
       }
     } catch (err: any) {
       const isDenied = err.code === 1;
       setRadarStatus(isDenied ? "denied" : "idle");
       setRadarStatusMsg(
         isDenied
           ? "المتصفح رفض إعطاء الموقع. لا يوجد زر سحري يتجاوز الحظر؛ لازم تغيّر الإذن إلى سماح من إعدادات الموقع ثم تعيد المحاولة."
           : "الرادار حاول فعلاً لكنه ما قدر يلتقط موقعك الآن. تأكد من تشغيل GPS والإنترنت ثم جرّب مرة ثانية."
       );
       if (isDenied) {
         setShowRadarInstructionModal(true);
       }
     }
  }, [mockLocation]);

  useEffect(() => {
     radarStatusRef.current = radarStatus;
  }, [radarStatus]);

  useEffect(() => {
     if (mockLocation || !navigator.geolocation) return;

     const clearPromptTimer = () => {
       if (locationPromptTimerRef.current !== null) {
         window.clearTimeout(locationPromptTimerRef.current);
         locationPromptTimerRef.current = null;
       }
     };

     const shouldTryAgain = async () => {
       if (locationPromptAttemptsRef.current >= 3) return false;
       if (["ready", "denied", "unsupported"].includes(radarStatusRef.current)) return false;
       try {
         if (navigator.permissions && (navigator as any).permissions?.query) {
           const permission = await (navigator as any).permissions.query({ name: "geolocation" as PermissionName });
           if (permission.state === "denied") {
             setRadarStatus("denied");
             setRadarStatusMsg("الموقع مقفّل من المتصفح. فعّله من إعدادات الموقع عشان الديوانية تعتمد عليك صح.");
             setShowRadarInstructionModal(true);
             return false;
           }
         }
       } catch(e) {}
       return true;
     };

     const askForDiwaniyaLocation = async () => {
       clearPromptTimer();
       if (!(await shouldTryAgain())) return;

       locationPromptAttemptsRef.current += 1;
       const attempt = locationPromptAttemptsRef.current;
       setRadarStatusMsg(
         attempt === 1
           ? "نحتاج موقعك الآن عشان نربطك بالديوانية القريبة."
           : attempt === 2
             ? "نذكّرك مرة ثانية: فعّل اللوكيشن عشان تظهر لك ديوانيتك."
             : "آخر تذكير للّوكيشن؛ الديوانية تعتمد على الموقع."
       );
       refreshRadarOnce();

       if (attempt < 3) {
         locationPromptTimerRef.current = window.setTimeout(async () => {
           if (["ready", "denied", "unsupported"].includes(radarStatusRef.current)) return;
           await askForDiwaniyaLocation();
         }, 17000);
       }
     };

     askForDiwaniyaLocation();

     const onVisibleOrFocus = () => {
       if (document.visibilityState !== "hidden" && !["ready", "checking", "denied", "unsupported"].includes(radarStatusRef.current)) {
         askForDiwaniyaLocation();
       }
     };

     window.addEventListener("focus", onVisibleOrFocus);
     document.addEventListener("visibilitychange", onVisibleOrFocus);

     return () => {
       clearPromptTimer();
       window.removeEventListener("focus", onVisibleOrFocus);
       document.removeEventListener("visibilitychange", onVisibleOrFocus);
     };
  }, [mockLocation, refreshRadarOnce]);

  useEffect(() => {
     const askWhenLocationIsOff = async () => {
       if (mockLocation) return;
       if (!navigator.geolocation) return;
       if (radarStatus === "ready") return;

       try {
         if (navigator.permissions && (navigator as any).permissions?.query) {
           const permission = await (navigator as any).permissions.query({ name: "geolocation" as PermissionName });
           if (permission.state === "granted" && radarStatus === "idle") {
             setRadarStatus("ready");
             setRadarStatusMsg("الرادار جاهز. اضغط تحديث الموقع إذا تبي نطلع لك الدواوين القريبة.");
           }
         }
       } catch(e) {
         // On unsupported platforms (iOS Safari), do NOT auto-reset or auto-prompt on focus
       }
     };

     askWhenLocationIsOff();

     const onVisible = () => {
       if (document.visibilityState === "visible" && radarStatus !== "ready" && radarStatus !== "checking") {
         askWhenLocationIsOff();
       }
     };

     const onFocus = () => {
       if (radarStatus !== "ready" && radarStatus !== "checking") {
         askWhenLocationIsOff();
       }
     };

     window.addEventListener("focus", onFocus);
     document.addEventListener("visibilitychange", onVisible);
     return () => {
       window.removeEventListener("focus", onFocus);
       document.removeEventListener("visibilitychange", onVisible);
     };
  }, [refreshRadarOnce, mockLocation, radarStatus]);

  const clearSquadSessionOnThisDevice = useCallback(() => {
     squadSessionTokenRef.current += 1;
     setCustomerPhone("");
     setCustomerName("");
     setGuestPhone("");
     setGuestName("");
     setLoginPhone("");
     setIsCreatingSquad(false);
     setIsJoiningSquad(false);
     setActiveSquadId("");
     setSquadInfo(null);
     setUserSquads([]);
     setPendingGeofenceRequests([]);
     setMyGeofenceRequests([]);
     setSquadPresence([]);
     setActiveGroupOrder(null);
     setTempCodes([]);
     setUsualOrder(null);
     setSquadBeautifulLog(null);
     setDiwaniyaNotifications([]);
     setUnreadDiwaniyaNotifications(0);
     setRadarNearbySquads([]);
     setRadarDismissedList([]);
     setRadarSuccessMap({});
     setRadarStatus("idle");
     setRadarStatusMsg("سجل دخولك أو شغّل الرادار إذا تبي نطلع لك الدواوين القريبة.");
     try {
       localStorage.removeItem("customer_phone_track");
       localStorage.removeItem("squadId");
       localStorage.removeItem("radar_dismissed_squads");
       localStorage.removeItem("split_prefill_members");
     } catch(e) {}
     window.setTimeout(() => {
       setShowSquadModal(true);
     }, 0);
  }, []);

  // Distance formula using Haversine
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
     const R = 6371e3; // metres
     const φ1 = lat1 * Math.PI / 180;
     const φ2 = lat2 * Math.PI / 180;
     const Δφ = (lat2 - lat1) * Math.PI / 180;
     const Δλ = (lon2 - lon1) * Math.PI / 180;

     const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
               Math.cos(φ1) * Math.cos(φ2) *
               Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

     return R * c; // in metres
  };

  // Watch position with highest accuracy
  useEffect(() => {
     if (!navigator.geolocation) {
       setRadarStatus("unsupported");
       setRadarStatusMsg("جهازك أو المتصفح ما يدعم تحديد الموقع.");
       return;
     }
     if (mockLocation) {
        const checkPositionMock = () => {
          const userLat = mockLocation.lat;
          const userLng = mockLocation.lng;
          setRadarAccuracy(5);

          // Zero-Click Proximity Presence check for viewed squad
          (() => {
            const currentPhone = customerPhone || "";
            const isAlreadyMember = userSquads.some((us: any) => String(us.id) === String(activeSquadId));
            if (currentPhone && currentPhone.length >= 8 && activeSquadId && squadInfo && isAlreadyMember) {
              const sLat = squadInfo.lat ?? squadInfo.location?.lat;
              const sLng = squadInfo.lng ?? squadInfo.location?.lng;
              if (sLat !== undefined && sLng !== undefined) {
                const dist = calculateDistance(userLat, userLng, Number(sLat), Number(sLng));
                const limit = getSquadSpecificGeofenceDistance(squadInfo, settings);
                if (dist < limit) {
                  const cleanCurrent = cleanPhoneForSquad(currentPhone).slice(-8);
                  const isPresent = squadPresence.some((p: any) => cleanPhoneForSquad(p.phone).slice(-8) === cleanCurrent);
                  if (!isPresent) {
                    const lastAutoTimeVal = parseFloat(sessionStorage.getItem(`last_auto_check_${activeSquadId}`) || "0");
                    if (Date.now() - lastAutoTimeVal > 45000) {
                      sessionStorage.setItem(`last_auto_check_${activeSquadId}`, String(Date.now()));
                      fetch("/api/squad-presence", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          squadId: activeSquadId,
                          phone: currentPhone,
                          name: customerName || "عضو",
                          action: "in",
                          isAuto: true
                        })
                      }).then(res => {
                        if (res.ok) {
                          fetchSquadGamification();
                          setZeroClickWelcome({
                            squadName: squadInfo.name,
                            name: customerName || "أحد الربع"
                          });
                        }
                      }).catch(e => console.error(e));
                    }
                  }
                }
              }
            }
          })();
          setRadarStatus("ready");
          setRadarStatusMsg("الموقع التجريبي مفعّل بنجاح. نحن الحين جنب ديوانية قريبة 🧪");

          const nearby: any[] = [];

          activeSquads.forEach((sq: any) => {
            if (String(sq.id) === String(activeSquadId)) return;
            if (radarDismissedList.includes(String(sq.id))) return;

            const isAlreadyMember = userSquads.some((us: any) => String(us.id) === String(sq.id));
            const isOwnerOfNearby = cleanPhoneForSquad(sq.phone || "") === cleanPhoneForSquad(customerPhone || "");
            const hasReq = myGeofenceRequests.some((r: any) => String(r.squadId) === String(sq.id));
            if (!isAlreadyMember && hasReq) return;

            if (sq.lat !== undefined && sq.lng !== undefined) {
              const dist = calculateDistance(userLat, userLng, Number(sq.lat), Number(sq.lng));
              const geofenceLimit = getSquadSpecificGeofenceDistance(sq, settings);
              if (dist < geofenceLimit) {
                nearby.push({
                  ...sq,
                  distance: Math.round(dist),
                  geofenceDistance: geofenceLimit,
                  isAlreadyMember,
                  isOwnerOfNearby
                });

                // Smart auto-login geofence bypass
                if (!customerPhone && !sessionStorage.getItem(`biometric_autologin_${sq.id}`)) {
                  triggerBiometricBypassJoin(sq);
                }
              }
            }
          });

          nearby.sort((a, b) => a.distance - b.distance);
          setRadarNearbySquads(nearby);
        };

        checkPositionMock();
        return;
      }

      if (activeSquads.length === 0) {
       setRadarStatus("empty");
       setRadarStatusMsg("ما فيه دواوين مفعلة بالرادار حالياً.");
       setRadarNearbySquads([]);
       return;
     }

     let watchId: number | null = null;

     const checkPosition = (position: GeolocationPosition) => {
       const userLat = position.coords.latitude;
       const userLng = position.coords.longitude;
       const accuracy = Number(position.coords.accuracy || 0);
       setRadarAccuracy(Math.round(accuracy));
       if (accuracy > 600) {
         setRadarStatus("weak");
       setRadarStatusMsg("الموقع طالع تقريبي حيل، فما نبي نقول إنك بعيد أو قريب بالغلط.");
         setRadarNearbySquads([]);
         return;
       }
       setRadarStatus("ready");
       setRadarStatusMsg(`الرادار شغال. إذا كنت قريب من ديوانية، بنطلع لك بطاقة الدخول أو التبديل.`);

       // Zero-Click Proximity Presence check for viewed squad
       (() => {
         const currentPhone = customerPhone || "";
         if (currentPhone && currentPhone.length >= 8 && activeSquadId && squadInfo && userSquads.some((us: any) => String(us.id) === String(activeSquadId))) {
           const sLat = squadInfo.lat ?? squadInfo.location?.lat;
           const sLng = squadInfo.lng ?? squadInfo.location?.lng;
           if (sLat !== undefined && sLng !== undefined) {
             const dist = calculateDistance(userLat, userLng, Number(sLat), Number(sLng));
             const limit = getSquadSpecificGeofenceDistance(squadInfo, settings);
             if (dist < limit) {
               const cleanCurrent = cleanPhoneForSquad(currentPhone).slice(-8);
               const isPresent = squadPresence.some((p: any) => cleanPhoneForSquad(p.phone).slice(-8) === cleanCurrent);
               if (!isPresent) {
                 const lastAutoTimeVal = parseFloat(sessionStorage.getItem(`last_auto_check_${activeSquadId}`) || "0");
                 if (Date.now() - lastAutoTimeVal > 45000) {
                   sessionStorage.setItem(`last_auto_check_${activeSquadId}`, String(Date.now()));
                   fetch("/api/squad-presence", {
                     method: "POST",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({
                       squadId: activeSquadId,
                       phone: currentPhone,
                       name: customerName || "عضو",
                       action: "in",
                       isAuto: true
                     })
                   }).then(res => {
                     if (res.ok) {
                       fetchSquadGamification();
                       setZeroClickWelcome({
                         squadName: squadInfo.name,
                         name: customerName || "أحد الربع"
                       });
                     }
                   }).catch(e => console.error(e));
                 }
               }
             }
           }
         }
       })();

       const nearby: any[] = [];

       activeSquads.forEach((sq: any) => {
         if (String(sq.id) === String(activeSquadId)) return;
         if (radarDismissedList.includes(String(sq.id))) return;

         // Smart nearby: members get a switch suggestion, non-members get a join request.
         const isAlreadyMember = userSquads.some((us: any) => String(us.id) === String(sq.id));
         const isOwnerOfNearby = cleanPhoneForSquad(sq.phone || "") === cleanPhoneForSquad(customerPhone || "");
         const hasReq = myGeofenceRequests.some((r: any) => String(r.squadId) === String(sq.id));
         if (!isAlreadyMember && hasReq) return;

         if (sq.lat !== undefined && sq.lng !== undefined) {
           const dist = calculateDistance(userLat, userLng, Number(sq.lat), Number(sq.lng));
           const geofenceLimit = getSquadSpecificGeofenceDistance(sq, settings);
           if (dist < geofenceLimit) {
             nearby.push({
               ...sq,
               distance: Math.round(dist),
               geofenceDistance: geofenceLimit,
               isAlreadyMember,
               isOwnerOfNearby
             });

             // Smart auto-login geofence bypass
             if (!customerPhone && !sessionStorage.getItem(`biometric_autologin_${sq.id}`)) {
               triggerBiometricBypassJoin(sq);
             }
           }
         }
       });

       // Sort by distance
       nearby.sort((a, b) => a.distance - b.distance);
       setRadarNearbySquads(nearby);
     };

     watchId = navigator.geolocation.watchPosition(
       checkPosition,
       (err) => {
         console.warn("Geofence watchPosition error: ", err);
         setRadarStatus(err.code === 1 ? "denied" : "idle");
       setRadarStatusMsg(err.code === 1 ? "الموقع مقفّل من المتصفح. فعّله إذا تبي الرادار يطلع لك الدواوين القريبة." : "الرادار ما اشتغل الحين. اضغط تشغيل الرادار وجرب مرة ثانية.");
       },
       { enableHighAccuracy: true, timeout: 20050, maximumAge: 10000 }
     );

     return () => {
       if (watchId !== null) navigator.geolocation.clearWatch(watchId);
     };
  }, [activeSquads, activeSquadId, radarDismissedList, myGeofenceRequests, settings, userSquads, mockLocation]);

  // 🧬 gyroscopic tilt & desktop mouse reflection to update CSS styles for Frosty Amber-Glass
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const rx = (e.clientX / window.innerWidth - 0.5) * 24;
      const ry = (e.clientY / window.innerHeight - 0.5) * 24;
      document.documentElement.style.setProperty("--tilt-x", rx.toFixed(2));
      document.documentElement.style.setProperty("--tilt-y", ry.toFixed(2));
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const tx = e.gamma ? Math.max(-15, Math.min(15, e.gamma / 2)) : 0;
      const ty = e.beta ? Math.max(-15, Math.min(15, (e.beta - 40) / 2)) : 0;
      document.documentElement.style.setProperty("--tilt-x", tx.toFixed(2));
      document.documentElement.style.setProperty("--tilt-y", ty.toFixed(2));
    };

    window.addEventListener("mousemove", handleMouse);
    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  // Listen for simulated automatic welcome events
  useEffect(() => {
    const handleAutoWelcome = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setZeroClickWelcome({
          squadName: detail.squadName,
          name: detail.name
        });
      }
    };
    window.addEventListener("squad_auto_welcome", handleAutoWelcome);
    return () => {
      window.removeEventListener("squad_auto_welcome", handleAutoWelcome);
    };
  }, []);

  // Polling for approved geofence requests
  useEffect(() => {
     let pollInterval: any = null;
     
     const hasPending = myGeofenceRequests.some(r => r.status === "pending");
     if (hasPending) {
       pollInterval = setInterval(() => {
         fetchSquadGamification();
       }, 5000);
     }

     const approvedReq = customerPhone ? myGeofenceRequests.find(r => r.status === "approved" && String(r.squadId) !== String(activeSquadId)) : null;
     if (approvedReq) {
       localStorage.setItem("squadId", approvedReq.squadId);
       setActiveSquadId(approvedReq.squadId);
       fetchSquadGamification();
     }

     return () => {
       if (pollInterval) clearInterval(pollInterval);
     };
  }, [myGeofenceRequests, activeSquadId, fetchSquadGamification]);

  useEffect(() => {
     if (!customerPhone || !activeSquadId) return;
     const interval = window.setInterval(() => {
       fetchSquadGamification();
     }, 5000);
     return () => window.clearInterval(interval);
  }, [customerPhone, activeSquadId, fetchSquadGamification]);

  const handleSwitchToNearbySquad = (targetSquad: any) => {
     if (!targetSquad?.id) return;
     localStorage.setItem("squadId", String(targetSquad.id));
     setActiveSquadId(String(targetSquad.id));
     setRadarDismissedList(prev => [...prev.filter(id => String(id) !== String(targetSquad.id)), String(targetSquad.id)]);
     setRadarNearbySquads(prev => prev.filter(s => String(s.id) !== String(targetSquad.id)));
     setShowSquadModal(true);
     window.setTimeout(fetchSquadGamification, 60);
  };

  const normalizeEightDigitPhone = (value: any) =>
     cleanPhoneForSquad(normalizeDigits(String(value || "")).replace(/[^0-9]/g, "")).slice(0, 8);

  const submitRadarJoinRequest = async (targetSquad: any, requestPhone: string, requestName: string) => {
     if (!targetSquad?.id) return;
     setRadarLoadingMap(prev => ({ ...prev, [targetSquad.id]: true }));
     try {
       const res = await fetch("/api/squad-geofence-join-request", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           name: (requestName || "").trim(),
           phone: normalizeEightDigitPhone(requestPhone),
           squadId: targetSquad.id,
           distance: targetSquad.distance || 0
         })
       });
       if (res.ok) {
         setRadarSuccessMap(prev => ({ ...prev, [targetSquad.id]: true }));
         fetchSquadGamification();
         setTimeout(() => {
           setRadarDismissedList(prev => [...prev, String(targetSquad.id)]);
           setRadarNearbySquads(prev => prev.filter(s => String(s.id) !== String(targetSquad.id)));
         }, 3000);
       } else {
         alert("ما قدرنا ندز طلبك للمعزب. جرّب مرة ثانية.");
       }
     } catch (e) {
       alert("ما قدرنا نوصل للسيرفر. جرّب بعد شوي.");
     }
     setRadarLoadingMap(prev => ({ ...prev, [targetSquad.id]: false }));
  };

  const handleSendRadarRequest = async (targetSquad: any) => {
     if (!targetSquad) return;
     let requestPhone = cleanPhoneForSquad(normalizeDigits(customerPhone || "")).slice(0, 8);
     let requestName = (customerName || "").trim();
     if (requestPhone.length !== 8 || !requestName) {
       setRadarJoinDraft({ squad: targetSquad, phone: requestPhone, name: requestName });
       return;
     }

     await submitRadarJoinRequest(targetSquad, requestPhone, requestName);
  };

  const handleOpenQatyaNotification = async (notification: any) => {
    const phone = cleanPhoneForSquad(customerPhone || "").slice(-8);
    const orderId = notification?.meta?.orderId;
    try {
      if (phone && notification?.id) {
        await fetch("/api/diwaniya-notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, notificationId: notification.id })
        });
      }
    } catch(e) {}
    if (orderId) {
      navigate(`/split/${orderId}?phone=${encodeURIComponent(phone)}&tab=payment`);
    } else if (notification?.meta?.url) {
      navigate(notification.meta.url);
    }
  };

  const [dismissedQatyas, setDismissedQatyas] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed_qatyas") || "[]");
    } catch {
      return [];
    }
  });

  const [dismissedWobbles, setDismissedWobbles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed_wobbles") || "[]");
    } catch {
      return [];
    }
  });

  const dismissQatya = useCallback((id: string) => {
    setDismissedQatyas((prev) => {
      const fresh = [...prev, String(id)];
      try {
        localStorage.setItem("dismissed_qatyas", JSON.stringify(fresh));
      } catch (e) {}
      return fresh;
    });
  }, []);

  const dismissWobble = useCallback((id: string) => {
    setDismissedWobbles((prev) => {
      const fresh = [...prev, String(id)];
      try {
        localStorage.setItem("dismissed_wobbles", JSON.stringify(fresh));
      } catch (e) {}
      return fresh;
    });
  }, []);

  const handleOpenWobbleItem = useCallback(async (n: any) => {
    const phone = cleanPhoneForSquad(customerPhone || "").slice(-8);
    try {
      if (phone && n?.id && n?.sourceKind === "notification") {
        await fetch("/api/diwaniya-notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, notificationId: n.id })
        });
      }
    } catch(e) {}
    setShowSquadModal(true);
    setActiveSquadId(n.squadId || "");
    setActiveSquadTab("overview");
    dismissWobble(n.id);
  }, [customerPhone, dismissWobble]);

  const qatyaAlertItems = useMemo(() => {
    const notificationItems = (qatyaNotifications || [])
      .map((n: any) => ({ ...n, sourceKind: "notification" }))
      .filter((n: any) => !dismissedQatyas.includes(String(n.id)) && !dismissedQatyas.includes(String(n.meta?.orderId)));
    
    const notifiedOrderIds = new Set(notificationItems.map((n: any) => String(n?.meta?.orderId || "")).filter(Boolean));
    const orderItems = (activeQatyaOrders || [])
      .filter((o: any) => {
        if (!o?.id) return false;
        const idStr = String(o.id);
        const compositeId = `active-qatya-${idStr}`;
        return !notifiedOrderIds.has(idStr) && !dismissedQatyas.includes(idStr) && !dismissedQatyas.includes(compositeId);
      })
      .map((o: any) => ({
        id: `active-qatya-${o.id}`,
        type: "qatya_request",
        sourceKind: "active_order",
        title: "قطية مفتوحة للديوانية",
        message: "اضغط هنا عشان تسجل اسمك وتدفع قطيتك بالكي نت 💰",
        squadName: o.squadName || squadInfo?.name || "",
        meta: { orderId: o.id, url: `/split/${o.id}` },
      }));
    return [...notificationItems, ...orderItems].slice(0, 5);
  }, [qatyaNotifications, activeQatyaOrders, squadInfo?.name, dismissedQatyas]);

  const wobbleAlertItems = useMemo(() => {
    return (wobbleNotifications || [])
      .map((n: any) => ({ ...n, sourceKind: "notification" }))
      .filter((n: any) => !dismissedWobbles.includes(String(n.id)));
  }, [wobbleNotifications, dismissedWobbles]);

  const hasCustomerCartDock = cart.length > 0 && !isCheckout && !orderSuccess && !selectedProduct;
  const floatingAlertBottom = hasCustomerCartDock ? "bottom-[96px] sm:bottom-[104px]" : "bottom-6";
  const floatingAlertBottomMid = hasCustomerCartDock ? "bottom-[156px] sm:bottom-[164px]" : "bottom-24";
  const floatingAlertBottomHigh = hasCustomerCartDock ? "bottom-[216px] sm:bottom-[224px]" : "bottom-40";
  const floatingAlertBubbleSide = "left-4 md:left-auto md:right-6";
  const floatingAlertPanelSide = "left-4 right-4 md:left-auto md:right-6";

  const handleOpenQatyaAlertItem = async (item: any) => {
    if (item?.sourceKind === "notification") {
      await handleOpenQatyaNotification(item);
      return;
    }
    const phone = cleanPhoneForSquad(customerPhone || "").slice(-8);
    const orderId = item?.meta?.orderId;
    if (orderId) navigate(`/split/${orderId}?phone=${encodeURIComponent(phone)}&tab=payment`);
  };

  const enableImportantDiwaniyaPush = async () => {
    if (!customerPhone || isEnablingDiwaniyaPush) return;
    setIsEnablingDiwaniyaPush(true);
    try {
      const result = await enableDiwaniyaImportantPush({
        phone: customerPhone,
        squadId: activeSquadId || squadInfo?.id || "",
      });
      setDiwaniyaPushState(result.state);
      const welcomeSeenKey = "diwaniya_push_welcome_seen";
      const shouldShowWelcome = result.state === "saved" && (() => {
        try { return localStorage.getItem(welcomeSeenKey) !== "1"; } catch { return true; }
      })();
      if (shouldShowWelcome) {
        try { localStorage.setItem(welcomeSeenKey, "1"); } catch {}
        setCartMoment("يا هلا والله 🌿 تنبيهاتك تفعّلت… بنبلغك بالأمور المهمة أول بأول");
        window.setTimeout(() => setCartMoment(null), 5200);
      } else {
        setCartMoment(result.message);
        window.setTimeout(() => setCartMoment(null), 3600);
      }
    } catch (error: any) {
      setDiwaniyaPushState("error");
      setCartMoment(error?.message || "ما قدرنا نفعّل تنبيهات الديوانية");
      window.setTimeout(() => setCartMoment(null), 3600);
    } finally {
      setIsEnablingDiwaniyaPush(false);
    }
  };

  const handleOwnerJoinDecision = async (targetPhone: string, approved: boolean, targetSquadId?: string) => {
     const decisionSquadId = targetSquadId || squadInfo?.id;
     if (!targetPhone || !decisionSquadId) return;
     setOwnerJoinDecisionLoading(prev => ({ ...prev, [targetPhone]: true }));
     try {
       const res = await fetch("/api/squad-geofence-approve-request", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ phone: targetPhone, squadId: decisionSquadId, approved })
       });
       if (res.ok) {
         await fetchSquadGamification();
       } else {
         alert("ما قدرنا نحدّث طلب الدخول.");
       }
     } catch(e) {
       alert("الاتصال تعطل وقت تحديث طلب الدخول.");
     }
     setOwnerJoinDecisionLoading(prev => ({ ...prev, [targetPhone]: false }));
  };

  const handleCreateSquad = async () => {
    const cleanOwnerPhone = cleanPhoneForSquad(normalizeDigits(guestPhone || "")).slice(0, 8);
    const cleanOwnerName = String(guestName || "").trim();
    if (!newSquadName.trim() || cleanOwnerPhone.length !== 8 || !cleanOwnerName) {
       alert("اكتب اسم الديوانية واسمك ورقم تلفونك 8 أرقام");
       setGuestPhone(cleanOwnerPhone);
       setGuestName(cleanOwnerName);
       return;
    }
    setGuestPhone(cleanOwnerPhone);
    setGuestName(cleanOwnerName);
    setIsSubmittingSquad(true);
    try {
       const res = await fetch("/api/squad-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
             name: newSquadName,
             phone: cleanOwnerPhone,
             customerName: cleanOwnerName
          })
       });
       if (res.ok) {
          const data = await res.json();
          setCustomerPhone(cleanOwnerPhone);
          setCustomerName(cleanOwnerName);
          localStorage.setItem("customer_phone_track", cleanOwnerPhone);
          localStorage.setItem("squadId", data.squad.id.toString());
          sessionStorage.setItem("created_squad_needs_location", data.squad.id.toString());
          const newSquadId = data.squad.id.toString();
          squadSessionTokenRef.current += 1;
          latestSquadRequestRef.current = { phone: cleanOwnerPhone, squadId: newSquadId };
          setActiveSquadId(newSquadId);
          setSquadInfo({ ...data.squad, memberData: { name: cleanOwnerName, phone: cleanOwnerPhone, isMember: true } });
          setIsCreatingSquad(false);
          setUserSquads((prev) => [data.squad, ...prev.filter((s:any) => String(s.id) !== String(data.squad.id))]);
          await fetchSquadGamificationFor(cleanOwnerPhone, newSquadId);
       }
    } catch(e) {}
    setIsSubmittingSquad(false);
  };

  const handleJoinSquad = async (squadId: string) => {
    const cleanJoinPhone = cleanPhoneForSquad(normalizeDigits(guestPhone || "")).slice(0, 8);
    const cleanJoinName = String(guestName || "").trim();
    if (cleanJoinPhone.length !== 8 || !cleanJoinName) {
       alert("اكتب اسمك ورقم تلفونك 8 أرقام عشان نكمل");
       setGuestPhone(cleanJoinPhone);
       setGuestName(cleanJoinName);
       return;
    }
    setGuestPhone(cleanJoinPhone);
    setGuestName(cleanJoinName);
    setIsSubmittingSquad(true);
    try {
       const res = await fetch("/api/squad-join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
             phone: cleanJoinPhone,
             squadId: squadId,
             name: cleanJoinName
          })
       });
       if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.pendingApproval) {
            alert("دزينا طلبك للمعزب. إذا وافق تدش الديوانية على طول.");
            setIsJoiningSquad(false);
          } else {
            setCustomerPhone(cleanJoinPhone);
            setCustomerName(cleanJoinName);
            localStorage.setItem("customer_phone_track", cleanJoinPhone);
            localStorage.setItem("squadId", squadId);
            setActiveSquadId(squadId);
            if (false) {
              setSquadInfo({} as any);
              setUserSquads((prev) => prev);
            }
            setIsJoiningSquad(false);
            window.setTimeout(fetchSquadGamification, 50);
          }
       }
    } catch(e) {}
    setIsSubmittingSquad(false);
  };
  
  // Track magic link
  useEffect(() => {
    // Basic fast check to ensure reliability across all browsers
    const searchStr = window.location.search;
    const urlParams = new URLSearchParams(searchStr);
    
    const sId = urlParams.get("squadId");
    if (sId) {
      localStorage.setItem("squadId", sId);
      setActiveSquadId(sId);
      setShowSquadModal(true);
      urlParams.delete("squadId");
      setSearchParams(urlParams, { replace: true });
    }
    
    const showSquads = urlParams.get("showSquads");
    if (showSquads === "true") {
      setShowSquadModal(true);
      urlParams.delete("showSquads");
      setSearchParams(urlParams, { replace: true });
    }

    const codeParam = urlParams.get("code");
    if (codeParam) {
      setInitialSquadCode(codeParam);
      setShowSquadModal(true);
      urlParams.delete("code");
      setSearchParams(urlParams, { replace: true });
    }
  }, []); // Run only once on mount

  useEffect(() => {
    squadSessionTokenRef.current += 1;
    latestSquadRequestRef.current = { phone: customerPhone, squadId: activeSquadId };
    if (activeSquadId) {
       localStorage.setItem("squadId", activeSquadId);
    }
  }, [activeSquadId, customerPhone]);

  // Fetch gamification info
  useEffect(() => {
     fetchSquadGamification();
  }, [fetchSquadGamification]);

  const moodPlaceholders = useMemo(() => [
    "شلون مزاجك اليوم؟ أو عندك عزيمة؟ اكتب ونفزع لك! 👨‍🍳",
    "بنتي مريضة وأبي شي يدفي صدرها.. 🤍",
    "تونا رادين من السفر والبيت فاضي وميتين يوع.. ✈️",
    "شنو بخاطرك اليوم؟ اكتب اللي بقلبك ومالك إلا يرضيك 🎯",
    "يوعان ومحتار? عطني وضعك وأنا أضبطك 🚀",
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
  const [activeProductCategory, setActiveProductCategory] = useState<string | null>(null);
  const [quickProductSearch, setQuickProductSearch] = useState("");
  const [showFlashSale, setShowFlashSale] = useState(false);
  const [smartPick, setSmartPick] = useState<any>(null); // Re-adding smartPick
  const [flyingPlates, setFlyingPlates] = useState<
    { id: string; img: string; startX: number; startY: number }[]
  >([]);
  const [cartBouncing, setCartBouncing] = useState(false);
  const [cartMoment, setCartMoment] = useState<string | null>(null);
  const [diwaniyaPushState, setDiwaniyaPushState] = useState<DiwaniyaPushState | "idle">("idle");
  const [isEnablingDiwaniyaPush, setIsEnablingDiwaniyaPush] = useState(false);
  const [canUseDiwaniyaPush, setCanUseDiwaniyaPush] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [radarJoinDraft, setRadarJoinDraft] = useState<{ squad: any; phone: string; name: string } | null>(null);

  useEffect(() => {
    const updateOnline = () => setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    isDiwaniyaPushReady().then(setCanUseDiwaniyaPush).catch(() => setCanUseDiwaniyaPush(false));
    return watchDiwaniyaForegroundPush((payload) => {
      const title = payload?.notification?.title || "تنبيه من الديوانية";
      setCartMoment(title);
      // vibration disabled: keep visual notification stable
      window.setTimeout(() => setCartMoment(null), 3600);
    });
  }, []);

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
        name: "حزة الظهر",
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
      "يا بعد عيني وعسى ربي يشافي بنيتج الغالية ويبعد عنها كل مكروه.. هبيتلج وسويت لج شوربة الشفاء بالخضار العطرة تراثية دافية تدفي صدرها وترد عافيتها، أجر وعافية يا رب 🤍🍲",
      "سلامات وما تدش الشر الغالية 🌿.. أجر وعافية يا بعد قلبي.. الشيف طبخ لج شوربة لسان عصفور بالهيل دافية وخفيفة تدفي الصدر وتبرّي العظام وتتمنى لها الشفاء العاجل 🥣🤍",
      "أجر وعافية يا بعد طوايف أهلي.. هذي شورباتنا العريقة المطبوخة على نار هادئة وممزوجة بالخضار العطرة، رصيناها لج بالقمة عشان تدفي الصدر وتنعش الروح، عساها بالشفاء التام يا بنيتي 🍵✨"
    ],
    travel: [
      "الحمد لله على السلامة يا بعد قلبي وتوّ ما نورت الديرة! ✈️ البيت فاضي وميتين يوع من السفر والدرب؟ فزعتنا الحين تجيكم! جربوا صوانينا السريعة المشبعة والساخنة اللي تترس العين والبطن وتتحضر فوراً وتنسيكم التعب ������💛",
      "قرت عينكم بالوصول والردة بالسلامة يا بعد قلبي! 💛 أدري البيت فاضي والتعب واصل حده.. الشيف جهّز لكم صواني الولائم السريعة الفورية والساخنة، توصلكم فوراً تسد الجوع وتدفئ نفوسكم! 🥘✨",
      "الحمد لله على سلامة الدرب يبا! 🌍 البيت خالي ولا تحاتون تشغيل جولة.. هذي صوانينا المشبعة المشهية السريعة اللي سويناها لعيون روعتكم، توصلكم ساخنة وتنهي اليوع ومحسوبة فوراً 🍽️👑"
    ],
    sad: [
      "روّق مزاجك! ماكو شيء يسوى، وهالحلو بيعدل يومك 🍫✨",
      "الدنيا ما تسوى زعلك.. اطلب الحلو اللي يخفف على قلبك ويفتح النفس 🍰",
      "المزاج مو اوكي؟ صدقني شوية سكر وكاكاو بيغيرون النكد لفرح.. دلع نفسك 🎂"
    ],
    late: [
      "تسهر بروحك؟ خلك معاي أدلعك بهالطلبات اللي تنسيك تعب اليوم 🌙🍛",
      "يوع آخر الليل ما يرحم.. اطلب لك اللي بخاطرك وكمل سهرتك فيه 🍲",
      "شنو مقعدك لي هالحزة؟ جوع؟ الشيف بعده زاهب ويجهز لك خوش طلب! 🥘"
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

    if (q.includes("مريض") || q.includes("تعب") || q.includes("برد") || q.includes("زكام") || q.includes("معدت") || q.includes("بنتي") || q.includes("ولد") || q.includes("سخون") || q.includes("كح") || q.includes("شفا") || q.includes("حرار") || q.includes("يدفي") || q.includes("صدر") || q.includes("مريضه") || q.includes("تعبان")) {
      msg = getDeterministicMsg(moodResponses.sick);
      filter = "مريض";
    } else if (q.includes("سفر") || q.includes("راد") || q.includes("راجع") || q.includes("فاضي") || q.includes("طريق") || q.includes("المطار") || q.includes("الدرب") || q.includes("سافر") || (q.includes("يوع") && q.includes("بيت")) || (q.includes("جوع") && q.includes("بيت")) || q.includes("يوعانين") || q.includes("جوعانين") || q.includes("ميتين")) {
      msg = getDeterministicMsg(moodResponses.travel);
      filter = "سفر";
    } else if (q.includes("ضيف") || q.includes("عزيم") || q.includes("متوهق") || q.includes("ربع") || q.includes("ديواني")) {
      msg = getDeterministicMsg(moodResponses.gathering);
      filter = "صواني";
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
        setPromoError(data.error || "الكوبون مو صحيح");
      }
    } catch (e) {
      setPromoError("ما قدرنا نتحقق من الكوبون");
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
        setCustomerOrderHistory([]);
        setCustomerHistoricalOrdersCount(0);
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
              const normalizedOrders = Array.isArray(orders) ? orders : [];
              setCustomerOrderHistory(normalizedOrders);
              setCustomerHistoricalOrdersCount(normalizedOrders.length);
              const successfulOrder = orders.find((o: any) => {
                let rawStatus = o.status;
                if (!rawStatus) {
                  if (o.paymentStatus === "paid")
                    rawStatus = "تم الدفع بنجاح";
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
            } else {
              setCustomerOrderHistory([]);
              setCustomerHistoricalOrdersCount(0);
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
            setCustomerPoints(Math.round(customerData.loyaltyPoints || 0));
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
        await Promise.all([
          fetchWithRetry("/api/products").then((allProducts) => {
            if (!isMounted) return;
            const validProducts = getCustomerVisibleProducts(Array.isArray(allProducts) ? allProducts : []);
            setProducts(validProducts);
            try {
              localStorage.setItem("cached_products", JSON.stringify(validProducts));
            } catch (e) {}
            setIsLoadingProducts(false);
          }),
          fetchWithRetry("/api/top-products").then(d => { 
            if (isMounted) {
              const list = getCustomerVisibleProducts(Array.isArray(d) ? d : []);
              setTopProducts(list);
              try {
                localStorage.setItem("cached_top_products", JSON.stringify(list));
              } catch (e) {}
            }
          }),
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
            if (isMounted) {
              setRegions(sorted);
              try {
                localStorage.setItem("cached_regions", JSON.stringify(sorted));
              } catch (e) {}
            }
          }),
          fetchWithRetry("/api/settings").then(d => { 
            if (isMounted && d) {
              setSettings(d);
              try {
                localStorage.setItem("cached_settings", JSON.stringify(d));
              } catch (e) {}
            }
          }),
          fetchWithRetry("/api/debug", 1).then(d => { if (isMounted && d) console.log(d); })
        ]);
      } catch (err: any) {
        if (err && err.message && (err.message.includes("Failed to fetch") || err.message.includes("Load failed"))) return;
        console.error("Error initiating fetch", err);
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
          setIsLoading(false);
        }
      }
    };

    loadData();
    // Customer brand splash appears on the initial page entrance only.
    // If we have cached content already, we can dismiss it very quickly (e.g. 250ms) to make it feel blazing fast!
    // Otherwise, we wait for the database fetch to complete, with a safety timeout of 2500ms max.
    const hasCache = (() => {
      try {
        return !!localStorage.getItem("cached_products");
      } catch (e) {
        return false;
      }
    })();
    
    const splashDelay = hasCache ? 250 : 2500;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, splashDelay);

    // Auto-refresh every 15 seconds to keep data live (Best Sellers, New Arrivals, etc.)
    const refreshInterval = setInterval(loadData, 15000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
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
                    product: normalizeProductForAddons(product),
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
                    const itemsDesc =
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
                    title: "المعذرة، الطلب مخلص",
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


  useEffect(() => {
    const checkoutStep = searchParams.get("checkout");
    if (checkoutStep !== "payment" || products.length === 0) return;
    try {
      const raw = sessionStorage.getItem("orser_checkout_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (Array.isArray(draft.cart) && draft.cart.length > 0) setCart(draft.cart);
        if (draft.customerName) setCustomerName(draft.customerName);
        if (draft.customerPhone) setCustomerPhone(draft.customerPhone);
        if (draft.address) setAddress(draft.address);
      }
      setCheckoutInitialStep("payment");
      setIsCheckout(true);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("checkout");
      setSearchParams(nextParams, { replace: true });
    } catch (e) {
      setCheckoutInitialStep("payment");
      setIsCheckout(true);
    }
  }, [searchParams, products.length, setSearchParams]);

  const handlePrepareQatyaFromDiwaniya = useCallback((members: any[] = []) => {
    const cleanMembers = Array.isArray(members) ? members : [];
    try {
      localStorage.setItem("split_prefill_members", JSON.stringify(cleanMembers));
      localStorage.setItem("split_prefill_ready", "1");
      localStorage.setItem("split_prefill_source", "diwaniya_checkout");
      if (squadInfo?.id) localStorage.setItem("split_prefill_squad_id", String(squadInfo.id));
    } catch (e) {}

    setShowSquadModal(false);

    if (cart.length > 0) {
      setCheckoutInitialStep("payment");
      setIsCheckout(true);
      setCartMoment(cleanMembers.length
        ? "جهزنا القطيّة بأسماء الربع. اختار القطيّة من طرق الدفع."
        : "جهزنا القطيّة. اختار القطيّة من طرق الدفع.");
      window.setTimeout(() => setCartMoment(null), 3500);
      return;
    }

    setCartMoment("جهزنا القطيّة. اختار الأصناف أولاً، وبعدها افتح السلة واختر القطيّة.");
    window.setTimeout(() => setCartMoment(null), 4500);
    window.setTimeout(() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }, [cart.length]);

  const itemsTotal = cart.reduce(
    (sum, item) => sum + calculateItemTotalWithAddons(item),
    0,
  );

  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.type === "percentage") {
      discountAmount = itemsTotal * (appliedPromo.value / 100);
    } else {
      discountAmount = appliedPromo.value;
    }
  } else if (squadInfo) {
    const dynamicTierId = getSquadTier(getAnyPoints(squadInfo))?.id;
    if (dynamicTierId === "diamond") {
      discountAmount = itemsTotal * 0.15; // 15% discount for diamond
    } else if (dynamicTierId === "gold") {
      discountAmount = itemsTotal * 0.10; // 10% discount for gold
    } else if (dynamicTierId === "silver") {
      discountAmount = itemsTotal * 0.05; // 5% discount for silver
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
              product: normalizeProductForAddons(product),
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
            const itemsDesc =
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
        const creativeCart: OrderItem[] = [];
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
      alert("ما ضبطت وياي الحين، جرّب مرة ثانية.");
    } finally {
      setIsZeroClickLoading(false);
    }
  };

  const addToCart = (item: OrderItem, e?: React.MouseEvent) => {
    triggerHapticAndSound();

    if (e) {
      const rect = (e.currentTarget?.getBoundingClientRect() || (e.target as HTMLElement)?.getBoundingClientRect());
      if (rect) {
        const customEvent = new CustomEvent("steam-add-item", {
          detail: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          }
        });
        document.dispatchEvent(customEvent);
      }
    }

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
    const addedName = item?.name || "الطلب";
    setCartMoment(`${addedName} انضاف للطلب`);
    setCartBouncing(true);
    window.setTimeout(() => setCartBouncing(false), 520);
    window.setTimeout(() => setCartMoment(null), 2100);
    setSelectedProduct(null);
  };

  const removeFromCart = (id: string) => {
    triggerHapticAndSound();
    setCart(cart.filter((item) => item.id !== id));
  };

  useEffect(() => {
    const normalizeRegionName = (value: any) =>
      String(value || "")
        .trim()
        .replace(/[إأآا]/g, "ا")
        .replace(/[ة]/g, "ه")
        .replace(/\s+/g, " ")
        .toLowerCase();

    const typedRegion = normalizeRegionName(address.region);

    if (!typedRegion) {
      setDeliveryFee(0);
      return;
    }

    const selectedRegion = regions.find(
      (r: any) => normalizeRegionName(r.name) === typedRegion,
    );

    if (!selectedRegion) {
      // Never treat an unknown typed region as free delivery.
      // Keep it as invalid until the customer chooses a real region from the shared DB list.
      setDeliveryFee(-1);
      return;
    }

    const isFreeDeliveryForced = settings?.isFreeDelivery === true;

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
      { key: "phone", value: customerPhone, label: "رقم التلفون" },
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
        `كمل هالبيانات: ${missingFields.map((f) => f.label).join("، ")}`,
      );
      return;
    }

    if (deliveryFee === -1) {
      setFormError(
        "المنطقة مو مضبوطة. اختار منطقة من القائمة.",
      );
      return;
    }

    // Region Validation (redundant but safe)
    const normalizeRegionName = (value: any) =>
      String(value || "")
        .trim()
        .replace(/[إأآا]/g, "ا")
        .replace(/[ة]/g, "ه")
        .replace(/\s+/g, " ")
        .toLowerCase();
    const normalizedRegion = normalizeRegionName(address.region);
    const matchedRegion = regions.find(
      (r: any) => normalizeRegionName(r.name) === normalizedRegion,
    );
    if (!matchedRegion) {
      setFormError(
        "اختار منطقة صحيحة من القائمة عشان نحسب التوصيل صح.",
      );
      return;
    }

    const { isOpen, message } = checkStoreStatus(settings?.storeStatus);
    if (!isOpen) {
      setFormError(message);
      return;
    }

    setIsSubmitting(true);

    const splitPrefillSource = splitMode ? String(localStorage.getItem("split_prefill_source") || "") : "";
    const splitPrefillReady = splitMode ? String(localStorage.getItem("split_prefill_ready") || "") === "1" : false;
    const splitPrefillRawMembers = splitMode ? String(localStorage.getItem("split_prefill_members") || "") : "";
    const isDiwaniyaQatya = Boolean(splitMode && (splitPrefillSource.startsWith("diwaniya") || splitPrefillReady || splitPrefillRawMembers.length > 2));

    const orderData: any = {
      customerName,
      customerPhone,
      address,
      items: cart.map(item => ({
        ...item,
        addons: calculateItemAddons(item)
      })),
      deliveryFee,
      isFreeDelivery: deliveryFee === 0 || settings?.isFreeDelivery === true,
      deliveryType: "company",
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
      orderData.qatiaType = isDiwaniyaQatya ? "diwaniya" : "traditional";
      orderData.splitOrigin = isDiwaniyaQatya ? splitPrefillSource : "customer_traditional";
    }

    if (isDiwaniyaQatya) {
      orderData.squadId = squadInfo?.id || localStorage.getItem("split_prefill_squad_id") || localStorage.getItem("squadId");
      orderData.squadName = squadInfo?.name;
      orderData.squadTier = squadInfo?.tier;
    }

    if (splitMode && isDiwaniyaQatya) {
      orderData.splitType = splitMode;
      try {
        const rawMembers = localStorage.getItem("split_prefill_members");
        const storedMembers = rawMembers ? JSON.parse(rawMembers) : [];
        const squadMembers = Array.isArray(squadInfo?.membersList) ? squadInfo.membersList : [];
        const members = Array.isArray(storedMembers) && storedMembers.length > 0 ? storedMembers : squadMembers;
        const cleanMap = new Map<string, any>();
        members.forEach((member: any) => {
          const phone = String(member?.phone || "").replace(/\D/g, "").slice(-8);
          if (!phone) return;
          cleanMap.set(phone, {
            name: member?.name || member?.displayName || member?.customerName || "عضو",
            phone,
          });
        });

        const checkoutPhone = String(customerPhone || "").replace(/\D/g, "").slice(-8);
        if (checkoutPhone && !cleanMap.has(checkoutPhone)) {
          cleanMap.set(checkoutPhone, { name: customerName || "ضيف", phone: checkoutPhone });
        }

        const memberCount = Math.max(1, cleanMap.size);
        const equalAmount = Number((Number(orderData.total || 0) / memberCount).toFixed(3));
        const preparedMembers = Array.from(cleanMap.values()).map((member: any) => ({
          name: member?.name || "عضو",
          phone: member.phone,
          amount: equalAmount,
          status: "pending",
          splitMode: "equal",
          source: "diwaniya_qatya"
        }));

        if (preparedMembers.length > 0) {
          orderData.splitParticipants = preparedMembers;
          orderData.splitPayments = preparedMembers;
          orderData.splitCount = preparedMembers.length;
          orderData.equalSplitAmount = equalAmount;
        }
      } catch (e) {}
    } else if (splitMode) {
      orderData.splitType = splitMode;
      try {
        localStorage.removeItem("split_prefill_members");
        localStorage.removeItem("split_prefill_ready");
        localStorage.removeItem("split_prefill_source");
        localStorage.removeItem("split_prefill_squad_id");
      } catch (e) {}
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
          errData?.error || "ما قدرنا ندز الطلب. جرّب مرة ثانية.",
        );
        setIsSubmitting(false);
        return;
      }

      let responseData: any;
      const responseDataText = await response.text();
      try {
        responseData = JSON.parse(responseDataText);
      } catch (e) {
        setFormError("وصلنا رد مو مفهوم من السيرفر.");
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
        try {
          sessionStorage.setItem("orser_checkout_draft", JSON.stringify({
            cart, customerName, customerPhone, address, deliveryFee, checkoutStep: "payment"
          }));
        } catch (e) {}
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
      }, 600);
    } catch (error: any) {
      if (
        error &&
        error.message &&
        (error.message.includes("Load failed") ||
          error.message.includes("Failed to fetch"))
      ) {
        // Silently handle Load failed to avoid AI Studio log spam
        setFormError(
          "ما قدرنا نوصل للسيرفر. شكله قاعد يتحدث، نطر 10 ثواني وجرب مرة ثانية.",
        );
      } else {
        console.error("Order error:", error);
        setFormError(
          "الاتصال تعطل. تأكد من النت وجرب مرة ثانية.",
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
        alert("ما قدرنا نجهز رابط الدفع");
      }
    } catch (e: any) {
      if (
        e &&
        e.message &&
        (e.message.includes("Load failed") ||
          e.message.includes("Failed to fetch"))
      ) {
        alert(
          "ما نقدر نوصل الحين. السيرفر قاعد يعيد التشغيل، نطر شوي وجرب.",
        );
      } else {
        alert("ما قدرنا نوصل لخدمة الدفع");
      }
    }
  };

  const generateWhatsAppLink = (order: Order, paymentLink?: string) => {
    let message = paymentLink ? buildWhatsAppPaymentLinkText(order, paymentLink) : buildWhatsAppInvoiceText(order);

    if (order.generalNotes) {
      message += `

\u2709\uFE0F *ملاحظات عامة:* ${order.generalNotes}`;
    }

    const encodedMessage = encodeURIComponent(sanitizeWhatsAppText(message));
    const waNumber = order.customerPhone;

    if (!waNumber) {
      console.warn("Customer phone missing for WhatsApp Link");
      return "";
    }

    let cleaned = waNumber.replace(/\D/g, "");
    if (cleaned.length === 8) {
      cleaned = "965" + cleaned;
    }

    return `https://api.whatsapp.com/send?phone=${cleaned}&text=${encodedMessage}`;
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
          `لأننا نعرف ذوقك اللي يفضل الدفا وقت الشتاء، واليوم الجو بارد، فالشيف ضبط لك ${product} بهاراته وحرارته زيادة خصيصاً لهاالطقس.`,
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
          `ذوقك وقت الغدا مميز عندنا، واليوم الشيف حضّر وجبة ${product} بكمية محدودة عشان لا يطوفك هالطعم!`,
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

      <AnimatePresence>
        {!isLoading && showAppetiteTheatre && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#faf8f5] overflow-hidden"
          >
            {/* Elegant Background Patterns / Sadu aesthetics */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#f2ece2] opacity-80 pointer-events-none" />
            
            {/* Soft decorative traditional circles */}
            <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#0d3a22]/5 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#b28a41]/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-sm w-full px-6 text-center flex flex-col items-center justify-center h-full">
              {/* Logo / Emblems */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, cubicBezier: [0.16, 1, 0.3, 1] }}
                className="mb-8 relative"
              >
                <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-[#b28a41] p-2 mx-auto">
                  <img
                    src={settings?.companyLogo || settings?.logo || DEFAULT_GLOBAL_LOGO}
                    alt="Logo"
                    className="w-full h-full object-contain rounded-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {/* Visual sparkles */}
                <span className="absolute -top-1 -right-1 text-yellow-500 text-lg animate-bounce">✨</span>
              </motion.div>

              {/* Luxurious Visual Title & Subtitle */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="space-y-4 mb-10 text-right w-full"
                dir="rtl"
              >
                <div className="flex justify-center mb-1">
                  <span className="text-[10px] text-white uppercase font-black tracking-widest bg-[#0d3a22] px-3.5 py-1.5 rounded-full border border-[#0d3a22]/10 shadow-sm shadow-[#0d3a22]/10">
                    بيت الضيافة الرقمي الفاخر ☕⚜️
                  </span>
                </div>
                
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0d3a22] leading-snug text-center font-sans mt-3 px-2">
                  يا حيا الله من لفانا.. يمعتنا على الطيب والذوق الكويتي الأصيل ✨
                </h1>

                {/* Elegant Sadu Divider */}
                <div className="flex items-center justify-center gap-3 py-1 my-2">
                  <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#b28a41]" />
                  <span className="text-stone-400 text-xs shrink-0">❖ ❖ ❖</span>
                  <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#b28a41]" />
                </div>

                <p className="text-stone-600 font-bold text-center text-xs sm:text-sm leading-relaxed px-4">
                  {theatrePhrase}
                </p>
              </motion.div>

              {/* Direct Call to Action Button group */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="flex flex-col gap-3.5 w-full font-sans"
              >
                {/* Primary: Open Menu */}
                <button
                  onClick={() => {
                    try { sessionStorage.setItem("appetite_theatre_shown", "1"); } catch(e) {}
                    setShowAppetiteTheatre(false);
                    triggerHapticAndSound("click");
                  }}
                  className="w-full bg-[#0d3a22] text-white py-4 px-6 rounded-2xl font-black text-sm shadow-lg hover:bg-[#072414] transition-all flex items-center justify-center gap-2 border-b-4 border-[#061e11]"
                >
                  <Sparkles className="w-4 h-4 text-[#cdaf78]" />
                  <span>افتح المنيو واستمتع بالذوق</span>
                </button>

                {/* Secondary: I am from the Diwaniya */}
                <button
                  onClick={() => {
                    try { sessionStorage.setItem("appetite_theatre_shown", "1"); } catch(e) {}
                    setShowAppetiteTheatre(false);
                    setShowSquadModal(true);
                    triggerHapticAndSound("click");
                  }}
                  className="w-full bg-[#faf8f5] hover:bg-stone-100 text-[#0d3a22] py-3.5 px-6 rounded-2xl font-black text-xs transition-all flex flex-col items-center justify-center gap-1 border border-stone-200"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#b28a41]" />
                    <span>دخول الربع (أعضاء مجلس الديوانية) 👥</span>
                  </div>
                  <span className="text-[10px] text-[#b28a41] opacity-90 font-bold">ملتقى الربع واليمعات</span>
                </button>
              </motion.div>

              {/* Subdued foot credits */}
              <p className="absolute bottom-6 text-[10px] text-stone-400 font-bold tracking-wider font-sans">
                كرم الضيافة الكويتي الأصيل
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DynamicEnvironment />

      {/* listen for simulated auto check in events */}
      <AnimatePresence>
        {zeroClickWelcome && (
          <motion.div
            initial={{ opacity: 0, y: -100, scale: 0.9, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: -60, scale: 0.9, x: "-50%" }}
            className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] sm:w-[480px] bg-slate-950/95 border-2 border-orange-500/50 backdrop-blur-md text-right rounded-[24px] p-5 shadow-2xl z-[9999] text-white overflow-hidden shadow-orange-950/40"
          >
            {/* Pulsing Ember Background Glow */}
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-orange-600/25 rounded-full blur-2xl animate-pulse pointer-events-none" />
            
            <div className="flex items-start justify-between gap-4 relative z-10">
              <button
                onClick={() => setZeroClickWelcome(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 text-stone-300 hover:text-white flex items-center justify-center transition-all mt-0.5"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex-1 text-right">
                <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full border border-orange-500/25 tracking-wide">
                  رادار الحضور التلقائي المأهول (Zero-Click) 📡🔥
                </span>
                
                <h4 className="font-sans font-black text-sm text-amber-100 mt-2.5">
                  يا هلا بالربع! تم الدخول تلقائياً
                </h4>
                
                <p className="font-sans font-bold text-xs text-stone-300 leading-relaxed mt-1.5 animate-pulse">
                  حياك الله يا <span className="text-orange-400 font-black">{zeroClickWelcome.name}</span> في ديوانية <span className="text-amber-100 font-black">{zeroClickWelcome.squadName}</span>! رادارنا لقط حضورك وتم الترحيب بك على السجادة، واشتعل الجمر الافتراضي الدافي 🔥 تحت الدلة إيذاناً ببدء السهرة المقندة ☕✨.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: 1 }}
        className={cn(
          "pb-24 max-w-2xl lg:max-w-6xl mx-auto min-h-screen shadow-sm text-brand overflow-x-hidden transition-colors duration-1000 customer-signature-shell",
          goldenHourTheme.bg,
          goldenHourTheme.extraShadow || "",
        )}
        dir="rtl"
      >
        {/* Squad Gamification Banner */}
        {!isCheckout && (
          <div className="px-4 sm:px-6 pt-4 pb-2 bg-stone-50/80 backdrop-blur-sm border-b border-stone-100">
            {squadInfo ? (
              <div 
                onClick={() => { setActiveSquadTab("overview"); setShowSquadModal(true); }}
                className="bg-gradient-to-l from-accent/10 to-transparent border border-accent/20 rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-accent/15 transition-all shadow-sm"
              >
                 <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-white shadow-sm border border-accent/20 flex items-center justify-center text-accent shrink-0 relative">
                       <Crown className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                       <p className="text-[10px] text-stone-500 font-bold leading-tight">ديوانيتك</p>
                       <p className="text-sm font-black text-brand leading-tight flex items-center gap-1.5">
                         {squadInfo.name}
                       </p>
                       <p className="mt-1 text-[11px] font-extrabold text-amber-700/85 leading-tight">
                         {getSquadTier(getAnyPoints(squadInfo))?.name ? `${getSquadTier(getAnyPoints(squadInfo))?.name} + ` : ""}رصيدك {getAnyPoints(squadInfo)} نقطة
                       </p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2 shrink-0">
                    <ArrowRight className="w-4 h-4 text-stone-400 rotate-180" />
                 </div>
              </div>
            ) : (
              <div 
                onClick={() => { setActiveSquadTab("leaderboard"); setShowSquadModal(true); }}
                className="bg-gradient-to-l from-orange-50 to-transparent border border-orange-100 rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-orange-100/50 transition-all shadow-sm"
              >
                 <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-white shadow-sm border border-orange-200 flex items-center justify-center text-orange-500 shrink-0 relative">
                       <Crown className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                       <p className="text-[10px] text-stone-500 font-bold leading-tight">صدارة الدواوين 👑</p>
                       <p className="text-sm font-black text-brand leading-tight flex items-center gap-1.5">
                         {topSquads.length > 0 ? `${topSquads[0].name} بالصدارة!` : "ادخل التحدي مع ديوانيتك!"} 
                       </p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2 shrink-0">
                    <div className="text-[10px] font-bold text-orange-600 bg-white px-2 py-1 rounded-full shadow-sm border border-orange-100 flex items-center gap-1">
                       <span>سجل دخول / أسس</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-400 rotate-180" />
                 </div>
              </div>
            )}
          </div>
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
            "sticky top-0 z-40 px-4 py-4 sm:px-6 sm:py-5 flex items-start justify-between gap-3 transition-all duration-500 overflow-visible",
            isCheckout
              ? "bg-white border-b border-stone-100 shadow-sm"
              : "bg-white/70 backdrop-blur-2xl border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
          )}
        >
          <div className="flex items-start gap-3 min-w-0 flex-1 overflow-visible">
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
            <div className="flex flex-col min-w-0 flex-1 text-right overflow-visible py-1">
              <h1 className="text-xl sm:text-2xl font-black text-brand leading-[1.45] tracking-tight flex items-center gap-2 min-w-0 whitespace-normal break-words overflow-visible">
                {settings?.companyName ? (
                  settings.companyName
                ) : (
                  <>
                    شركة مطبخات{" "}
                    <span className="text-accent">لكويتي</span>
                  </>
                )}
              </h1>
              <div className="flex items-center gap-x-1.5 gap-y-1 mt-2 flex-wrap leading-[1.6] min-h-[24px] overflow-visible py-1">
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
                    "text-[11px] font-extrabold uppercase tracking-wider leading-[1.6] py-0.5",
                    tannourStatus.color,
                  )}
                >
                  {tannourStatus.text}
                </span>
                <span className="text-[10px] text-stone-300 mx-1">•</span>
                <span className="text-[11px] font-bold text-stone-400 leading-[1.6] py-0.5">
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
                className="p-2.5 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-all flex items-center justify-center shadow-md active:scale-95"
              >
                <Search className="w-4 h-4" />
              </Link>
              <div className="relative">
                <button
                  onClick={() => setIsCheckout(true)}
                  className="p-2 sm:p-2.5 bg-white rounded-xl hover:bg-stone-50/80 backdrop-blur-sm transition-all active:scale-95 relative shadow-sm border border-stone-100"
                >
                  <ShoppingBag className="w-5 h-5 text-brand" />
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
                `orser-context-hero relative h-44 sm:h-52 rounded-[28px] overflow-hidden group shadow-xl shadow-accent/20`,
                themeContext.colors,
              )}
            >
              {/* Parallax background (simulated without heavy scroll listeners) */}
              <motion.div
                className="orser-context-bg absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
                style={{ backgroundImage: `url(${themeContext.image})` }}
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
                  onChange={(e) => setMoodQuery(normalizeDigits(e.target.value))}
                  dir="rtl" className="orser-search-input bg-transparent w-full outline-none text-sm font-bold text-brand placeholder:text-stone-400 placeholder:font-medium"
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
        <main className="p-4 sm:p-6 lg:p-8 space-y-8 customer-products-zone customer-wow-menu">



          {(() => {
            const liveSignal = getKuwaitiLiveMenuSignal(products, cart, squadInfo);
            if (!liveSignal.items.length || moodQuery.trim()) return null;
            return (
              <section className="relative overflow-hidden rounded-[32px] border border-amber-100/70 bg-[#faf8f4]/95 p-6 shadow-sm backdrop-blur-xl">
                {/* Subtle light glow accent */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-amber-200/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between gap-4 mb-5 border-b border-amber-100/30 pb-4 relative z-10">
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-amber-200 bg-amber-50 text-[10px] sm:text-[11px] font-bold text-amber-900 mb-2">
                      ✨ من اختياراتنا لكم
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-brand leading-snug">{liveSignal.title}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                  {liveSignal.items.map((p: any) => {
                    const fallbackLogo = settings?.companyLogo || settings?.logo || DEFAULT_GLOBAL_LOGO;
                    const imgUrl = p.imageUrl || p.image || fallbackLogo;
                    return (
                      <button
                        key={p.id || p.name}
                        onClick={() => setSelectedProduct(p)}
                        className="group flex items-center gap-3.5 rounded-2xl border border-stone-200/40 bg-white p-3 text-right active:scale-[.98] hover:border-amber-300 hover:shadow-md transition-all duration-300 min-h-[92px]"
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-stone-50 border border-stone-100 shadow-sm">
                          <img
                            src={imgUrl}
                            alt={p.name}
                            onError={(e) => {
                              if (!e.currentTarget.src.includes(DEFAULT_GLOBAL_LOGO)) {
                                e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                              }
                            }}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs sm:text-sm font-extrabold text-brand line-clamp-2 leading-snug break-words group-hover:text-amber-950 transition-colors duration-200">{p.name}</div>
                          <div className="inline-flex items-center text-[11px] font-black text-amber-800 bg-amber-50/50 px-2 py-0.5 rounded-md">{Number(p.price || 0).toFixed(3)} د.ك</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })()}



          {cart.length > 0 && (() => {
            const liveSignal = getKuwaitiLiveMenuSignal(products, cart, squadInfo);
            const suggestion = liveSignal.items.find((p: any) => !cart.some((c: any) => c.productId === p.id || c.name === p.name));
            if (!suggestion) return null;
            const fallbackLogo = settings?.companyLogo || settings?.logo || DEFAULT_GLOBAL_LOGO;
            return (
              <button
                onClick={() => setSelectedProduct(suggestion)}
                className="w-full text-right group flex items-center justify-between gap-4 rounded-3xl border border-amber-200/50 bg-[#faf8f4]/90 hover:bg-amber-50/40 p-4 shadow-sm active:scale-[.99] transition-all duration-300"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-amber-100 bg-stone-50">
                    <img
                      src={suggestion.imageUrl || suggestion.image || fallbackLogo}
                      alt={suggestion.name}
                      onError={(e) => {
                        if (!e.currentTarget.src.includes(DEFAULT_GLOBAL_LOGO)) {
                          e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
                        }
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="text-right min-w-0 flex-1 space-y-1">
                    <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100/50 rounded-full px-2.5 py-0.5">توليفة تكمّل سلتك 🍲</span>
                    <p className="text-xs sm:text-sm font-black text-brand line-clamp-1 group-hover:text-amber-950 transition-colors">
                      وش رايك نكمّلها مع <span className="text-amber-800 font-extrabold">{suggestion.name}</span>؟
                    </p>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-800 group-hover:bg-amber-100 group-hover:translate-x-1 transition-all shrink-0">
                  <span className="text-sm font-black">←</span>
                </div>
              </button>
            );
          })()}


          {/* Best Sellers */}
          {topProducts.length > 0 && !moodQuery.trim() && (
            <section className="mb-2">
              <div className="best-seller-wow-head flex items-center justify-between mb-4">
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
                 if (moodFilter === "مريض") {
                    // Traditional Healing soups mixed with aromatic vegetables stacked at the top!
                    const sickCustomSoups = [
                      {
                        id: "emotional_soup_1",
                        name: "شوربة الشفاء بالخضار العطرة 🍲",
                        nameEn: "Healing Soup with Aromatic Vegetables",
                        price: 1.5,
                        category: "شوربات الشفاء العريقة",
                        description: "شوربة دافئة غنية بقطع الدجاج والخضار الطازجة مع الكرفس والبقدونس والهيل، تدفئ الصدر والبلعوم وتعيد العافية بإذن الله.",
                        imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80",
                        options: [],
                        extras: [],
                        addons: [],
                        isNewProduct: true,
                        supplierId: "we27tunga",
                        isActive: true
                      },
                      {
                        id: "emotional_soup_2",
                        name: "شوربة لسان عصفور تراثية بالهيل 🥣",
                        nameEn: "Traditional Orzo Soup with Cardamom",
                        price: 1.25,
                        category: "شوربات الشفاء العريقة",
                        description: "شوربة دافئة خفيفة من القمح المحمر، مطبوخة بمرق الدجاج الهادئ والبهارات الناعمة لتسكين التعب وزيادة المناعة.",
                        imageUrl: "https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?auto=format&fit=crop&w=600&q=80",
                        options: [],
                        extras: [],
                        addons: [],
                        isNewProduct: true,
                        supplierId: "we27tunga",
                        isActive: true
                      }
                    ];
                    
                    const existingComforts = products.filter(p => {
                      const n = p.name?.toLowerCase() || "";
                      const c = p.category?.toLowerCase() || "";
                      return n.includes("جريش") || n.includes("هريس") || n.includes("مرق") || n.includes("شورب") || c.includes("شورب") || n.includes("مشخول") || n.includes("عيش مشغول");
                    });
                    
                    displayProducts = existingComforts.length ? existingComforts : products.filter((p) => p?.isActive !== false && !p?.isOutOfStock).slice(0, 5);
                 } else if (moodFilter === "سفر") {
                    // Fast, comforting, satisfying trays that solve starving-after-travel
                    const travelCustomTrays = [
                      {
                        id: "emotional_travel_1",
                        name: "صينية مجبوس لحم سريعة (نعيمي) 🥘",
                        nameEn: "Express Family Naemi Machboos Tray",
                        price: 38,
                        category: "صواني الولائم الفورية",
                        description: "صينية دسمة وحارة ومحفوفة تكفي من ٣ إلى ٥ أشخاص، تجهز فوراً لتنسيكم تعب السفر وتملأ البيت برائحة الهيل والزعفران الكويتي الأصيل.",
                        imageUrl: "https://images.unsplash.com/photo-1545093149-618ce3bcf49d?auto=format&fit=crop&w=600&q=80",
                        options: [],
                        extras: [],
                        addons: [],
                        isNewProduct: true,
                        supplierId: "we27tunga",
                        isActive: true
                      },
                      {
                        id: "emotional_travel_2",
                        name: "صينية برياني دجاج مشبعة فورية 🍗",
                        nameEn: "Express Chicken Biryani Tray",
                        price: 12,
                        category: "صواني الولائم الفورية",
                        description: "صينية غنية بقطع الدجاج والبهارات الفاخرة، مع عيش حار ومكسرات وبصل محمر، تسد أشد الجوع في دقائق للراجعين من السفر والدرب.",
                        imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
                        options: [],
                        extras: [],
                        addons: [],
                        isNewProduct: true,
                        supplierId: "we27tunga",
                        isActive: true
                      }
                    ];
                    
                    const existingTrays = products.filter(p => {
                      const n = p.name?.toLowerCase() || "";
                      const c = p.category?.toLowerCase() || "";
                      return n.includes("صينية") || n.includes("صيني") || n.includes("مجبوس") || n.includes("برياني") || n.includes("قوزي") || n.includes("ذبيح") || c.includes("الولائم") || n.includes("بشاميل");
                    });
                    
                    displayProducts = existingTrays.length ? existingTrays : products.filter((p) => p?.isActive !== false && !p?.isOutOfStock).slice(0, 5);
                 } else if (moodFilter === "صواني") {
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

              const allCategories = getSharedProductCategories(settings, displayProducts);
              const query = quickProductSearch.trim();
              const searchedProducts = query
                ? displayProducts.filter((product: any) => {
                    const haystack = `${product?.name || ""} ${product?.nameEn || ""} ${product?.category || ""}`;
                    return normalizeProductSearchText(haystack).includes(normalizeProductSearchText(query));
                  })
                : displayProducts;
              const groupedProducts = allCategories
                .map((category) => ({
                  category,
                  items: searchedProducts.filter((product: any) => normalizeCategoryName(product?.category) === category),
                }))
                .filter((group) => group.items.length > 0);

              if (isLoadingProducts) {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="bg-white border border-stone-100 rounded-2xl p-4 h-32 animate-pulse flex flex-col justify-between">
                         <div className="w-1/2 h-6 bg-stone-200 rounded-lg"></div>
                         <div className="w-full flex justify-between items-end mt-4">
                            <div className="w-1/4 h-5 bg-stone-200 rounded-lg"></div>
                            <div className="w-10 h-10 bg-brand rounded-xl"></div>
                         </div>
                      </div>
                    ))}
                  </div>
                );
              }

              return searchedProducts.length === 0 ? (
                <div className="space-y-4">
                  <div className="product-search-signature bg-white/90 border border-stone-100 rounded-3xl p-4 shadow-sm">
                    <div className="flex items-center gap-3 bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3">
                      <Search className="w-4 h-4 text-stone-400" />
                      <input
                        value={quickProductSearch}
                        onChange={(e) => setQuickProductSearch(e.target.value)}
                        placeholder="تدور على طبق معيّن؟"
                        className="bg-transparent outline-none w-full text-sm font-bold text-brand placeholder:text-stone-400"
                      />
                    </div>
                  </div>
                  <div className="al-empty-state p-8 text-center border-2 border-dashed border-amber-100 rounded-[28px] bg-white/80">
                    <div className="al-empty-icon">🍽️</div>
                    <strong>هالقسم فاضي الحين</strong>
                    <span>جرّب قسم ثاني أو اكتب اسم الطبق اللي تبيه.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="product-search-signature bg-white/90 border border-stone-100 rounded-3xl p-4 shadow-sm">
                    <div className="flex items-center gap-3 bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3">
                      <Search className="w-4 h-4 text-stone-400" />
                      <input
                        value={quickProductSearch}
                        onChange={(e) => setQuickProductSearch(e.target.value)}
                        placeholder="تدور على طبق معيّن؟"
                        className="bg-transparent outline-none w-full text-sm font-bold text-brand placeholder:text-stone-400"
                      />
                    </div>
                  </div>
                  {quickProductSearch.trim() ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {searchedProducts.slice(0, 60).map((product) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="h-full flex flex-col"
                          style={{ minHeight: "120px" }}
                        >
                          <ChefWhisperCard product={product} settings={settings} onSelect={setSelectedProduct} />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupedProducts.map((group) => {
                        const isOpen = activeProductCategory === group.category;
                        return (
                          <div key={group.category} className="category-signature-card bg-white border border-stone-100 rounded-[28px] shadow-sm overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setActiveProductCategory(isOpen ? null : group.category)}
                              className="w-full flex items-center justify-between gap-4 p-5 text-right"
                            >
                              <div className="flex flex-col items-start">
                                <span className="text-lg font-extrabold text-brand">{group.category}</span>
                                <span className="text-[11px] font-bold text-stone-400">{group.items.length} منتج</span>
                              </div>
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                                isOpen ? "bg-brand text-white rotate-180" : "bg-stone-50 text-brand"
                              )}>
                                <ArrowRight className="w-4 h-4 rotate-90" />
                              </div>
                            </button>

                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22 }}
                                  className="overflow-hidden"
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 p-4 pt-0">
                                    {group.items.slice(0, 48).map((product) => (
                                      <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="h-full flex flex-col"
                                        style={{ minHeight: "120px" }}
                                      >
                                        <ChefWhisperCard product={product} settings={settings} onSelect={setSelectedProduct} />
                                      </motion.div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                    className="w-full h-full object-contain bg-white p-2"
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
                      قاعدين نجهز...
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
                "fixed border-2 border-accent/10 focus:border-accent/40 bg-stone-50/50 hover:bg-stone-50 transition-colors rounded-3xl shadow-xl p-5 z-[70]",
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
                      className="w-full h-full object-contain bg-white p-2"
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
                  "fixed right-4 sm:right-6 z-40 pointer-events-auto transition-[bottom] duration-300",
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

        <AnimatePresence>
          {!isOnline && (
            <motion.div
              className="customer-offline-toast"
              dir="rtl"
              initial={{ opacity: 0, y: -10, x: "-50%", scale: 0.96 }}
              animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
              exit={{ opacity: 0, y: -10, x: "-50%", scale: 0.96 }}
            >
              <span />
              <div>
                <strong>انقطع الاتصال…</strong>
                <small>بنرجع لك المنيو أول ما يرجع النت.</small>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🧬 Interactive Steam Companion Overlay & Biometric Scanner */}
        <SteamCompanion />

        <AnimatePresence>
          {isBiometricScanning && biometricScanSquad && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-stone-950/95 text-stone-100 font-sans p-6 text-center backdrop-blur-md"
            >
              <div className="flex flex-col items-center gap-6 max-w-sm w-full">
                {/* Animated 3D Face scanner badge */}
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3.5, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-dashed border-[#b28a41] opacity-60"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="absolute inset-2 rounded-full border border-emerald-500 bg-emerald-500/10"
                  />
                  {/* Futuristic Scan Lines */}
                  <motion.div
                    animate={{ y: [-45, 45, -45] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="absolute left-6 right-6 h-0.5 bg-emerald-400 shadow-[0_0_15px_#34d399]"
                  />
                  <div className="text-4xl relative z-10 filter drop-shadow">🧬</div>
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#b28a41] bg-[#b28a41]/10 px-3 py-1 rounded-full w-fit mx-auto border border-[#b28a41]/20">بصمة الوجه الموثوقة والموقع 🧬</span>
                  <h3 className="text-lg font-black text-white">جاري الاتصال السحابي بالديوانية...</h3>
                  <p className="text-xs text-stone-400 font-medium leading-relaxed px-4">
                    تم اكتشاف وجودك الفعلي بجوار <strong className="text-emerald-400 font-black">"{biometricScanSquad.name}"</strong>. نربط جهازك بالقرعة والسدو تلقائياً.
                  </p>
                </div>

                {/* Dynamic authentic scan steps */}
                <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col gap-3 text-right text-xs text-stone-400 font-mono" dir="rtl">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold">✓ تم بنجاح</span>
                    <span className="font-sans font-bold text-stone-300">١. فحص تواجد الجيروسكوب والـ GPS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {biometricStep === "scanning" ? (
                      <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-[#b28a41] font-black">جاري التعرف...🧬</motion.span>
                    ) : (
                      <span className="text-emerald-400 font-bold">✓ تم التوثيق</span>
                    )}
                    <span className="font-sans font-bold text-stone-300">٢. مسح بصمة الوجه والتحقق (FaceID)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {biometricStep === "scanning" ? (
                      <span className="text-stone-600">بالانتظار...</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">✓ دخلت السدو</span>
                    )}
                    <span className="font-sans font-bold text-stone-300">٣. وضع قدمك على سجادة مجلس الربع</span>
                  </div>
                </div>

                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1.5 font-mono">
                  <span>☕</span> Sadu Diwaniya Ecosystem • 100% Zero-Click
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {cartMoment && !isCheckout && (
            <motion.div
              className="cart-moment-toast"
              dir="rtl"
              initial={{ opacity: 0, y: 18, x: "-50%", scale: 0.96 }}
              animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
              exit={{ opacity: 0, y: 18, x: "-50%", scale: 0.96 }}
            >
              <Check className="w-4 h-4" />
              <strong>{cartMoment}</strong>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Smart Cart Bottom Bar */}
        {cart.length > 0 && !isCheckout && !orderSuccess && !selectedProduct && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className={`al-cart-bar font-bold transition-all ${cartBouncing ? "scale-[1.03] shadow-emerald-500/30" : ""}`}
            dir="rtl"
          >
            <button
              type="button"
              onClick={() => {
                setCheckoutInitialStep("cart");
                setIsCheckout(true);
              }}
              className="al-cart-summary"
              aria-label="عرض السلة"
            >
              <div className="bg-white/15 backdrop-blur-sm px-3 py-2 rounded-2xl text-sm font-black border border-white/20 shrink-0">
                {cart.length}
              </div>
              <div className="min-w-0 text-right">
                <strong className="block leading-tight">سلتك جاهزة</strong>
                <span className="text-[11px] text-white/65">{cart.length} منتجات · {total} د.ك</span>
              </div>
            </button>
            <div className="al-cart-actions shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCheckoutInitialStep("cart");
                  setIsCheckout(true);
                }}
              >
                عرض السلة
              </button>
              <button
                type="button"
                className="al-cart-checkout"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // يبقى العميل في المنيو مع السلة صحيحة؛ فتح السلة يكون من منطقة السلة نفسها.
                  setIsCheckout(false);
                  window.requestAnimationFrame(() => {
                    const menuAnchor = document.getElementById("menu") || document.querySelector("[data-menu-anchor]") || document.body;
                    menuAnchor?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                  });
                }}
              >
                إضافة منتجات
              </button>
            </div>
          </motion.div>
        )}

        {/* Squad Gamification Modal */}
        <AnimatePresence>
           {showSquadModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-end justify-center bg-brand/40 backdrop-blur-sm overflow-x-hidden"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setShowSquadModal(false);
                }}
              >
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="bg-stone-50 w-full max-w-md rounded-t-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                   <div className="p-4 sm:p-5 bg-white border-b border-stone-100 flex items-center justify-between shrink-0">
                      <div className="flex flex-col text-right">
                         <h3 className="font-black text-lg sm:text-xl text-brand flex items-center gap-2">
                            <Crown className="w-5 h-5 text-accent" />
                            {squadInfo ? squadInfo.name : "صدارة الدواوين 🏆"}
                         </h3>
                         <p className="text-stone-500 text-[10px] sm:text-xs font-bold mt-1">
                           {squadInfo ? "ديوانيتك الحالية" : "سجل الحين وطور ديوانيتك!"}
                         </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {customerPhone && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              clearSquadSessionOnThisDevice();
                            }}
                            className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 hover:bg-rose-100 transition-colors font-black text-base sm:text-lg active:scale-95"
                            aria-label="تسجيل خروج من الديوانية"
                            title="تسجيل خروج"
                          >
                            🚪
                          </button>
                        )}
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowSquadModal(false);
                          }}
                          className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:text-brand hover:bg-stone-200 transition-colors font-black text-xs active:scale-95"
                          aria-label="إغلاق صفحة الديوانية"
                          title="إغلاق"
                        >
                          <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 pb-8 custom-scrollbar relative z-0">

                      <div className="grid grid-cols-3 gap-2 mb-5" dir="rtl">
                        {[
                          { id: "overview", label: "الديوانية" },
                          { id: "leaderboard", label: "الصدارة" },
                          { id: "tiers", label: "المستويات" },
                        ].map((tab: any) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveSquadTab(tab.id as any)}
                            className={cn(
                              "rounded-2xl px-3 py-3 text-[11px] font-black border transition-all",
                              activeSquadTab === tab.id
                                ? "bg-brand text-white border-brand shadow-md"
                                : "bg-white text-stone-500 border-stone-100"
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <SquadModalContent 
                        activeSquadTab={activeSquadTab}
                        squadInfo={squadInfo}
                        userSquads={userSquads}
                        settings={settings}
                        squadPresence={squadPresence}
                        activeGroupOrder={activeGroupOrder}
                        activeQatyaOrders={activeQatyaOrders}
                        tempCodes={tempCodes}
                        usualOrder={usualOrder}
                        squadBeautifulLog={squadBeautifulLog}
                        diwaniyaNotifications={diwaniyaNotifications}
                        unreadDiwaniyaNotifications={unreadDiwaniyaNotifications}
                        SQUAD_TIERS={SQUAD_TIERS}
                        getSquadTier={getSquadTier}
                        topSquads={topSquads}
                        customerPhone={customerPhone}
                        customerName={customerName}
                         customerPoints={customerPoints}
                         LOYALTY_TIERS={LOYALTY_TIERS}
                         getLoyaltyTier={getLoyaltyTier}
                        guestName={guestName}
                        setGuestName={setGuestName}
                        guestPhone={guestPhone}
                        setGuestPhone={setGuestPhone}
                        loginPhone={loginPhone}
                        setLoginPhone={setLoginPhone}
                        isJoiningSquad={isJoiningSquad}
                        setIsJoiningSquad={setIsJoiningSquad}
                        isCreatingSquad={isCreatingSquad}
                        setIsCreatingSquad={setIsCreatingSquad}
                        isSubmittingSquad={isSubmittingSquad}
                        setIsSubmittingSquad={setIsSubmittingSquad}
                        newSquadName={newSquadName}
                        setNewSquadName={setNewSquadName}
                        setActiveSquadId={setActiveSquadId}
                        setCustomerPhone={setCustomerPhone}
                        setCustomerName={setCustomerName}
                        setSquadInfo={setSquadInfo}
                        onClearSquadSession={clearSquadSessionOnThisDevice}
                        normalizeDigits={normalizeDigits}
                        formatPoints={formatPoints}
                        handleCreateSquad={handleCreateSquad}
                        handleJoinSquad={handleJoinSquad}
                       pendingGeofenceRequests={pendingGeofenceRequests}
                       onRefresh={fetchSquadGamification}
                       onPrepareQatya={handlePrepareQatyaFromDiwaniya}
                       products={products}
                       onAddToCart={addToCart}
                       initialCode={initialSquadCode}
                       setInitialCode={setInitialSquadCode}
                      />
                   </div>
                </motion.div>
              </motion.div>
           )}
        </AnimatePresence>

        {/* Checkout Sidebar/Overlay */}
        <AnimatePresence>
          {isCheckout && !orderSuccess && (
            <CheckoutOverlay
              initialStep={checkoutInitialStep}
              cart={cart}
              setCart={setCart}
              onClose={closeCheckoutToMenu}
              onRemove={removeFromCart}
              total={total}
              deliveryFee={deliveryFee}
              itemsTotal={itemsTotal}
              address={address}
              setAddress={setAddress}
              regions={regions}
              onRegionChange={handleRegionChange}
              settings={settings}
              normalizeDigits={normalizeDigits}
              onSubmit={handleSubmitOrder}
              isSubmitting={isSubmitting}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPoints={customerPoints}
              setCustomerPoints={setCustomerPoints}
              isLocked={isLocked}
              setIsLocked={setIsLocked}
              generalNotes={generalNotes}
              setGeneralNotes={setGeneralNotes}
              formError={formError}
              setFormError={setFormError}
              promoCodeInput={promoCodeInput}
              setPromoCodeInput={setPromoCodeInput}
              appliedPromo={appliedPromo}
              setAppliedPromo={setAppliedPromo}
              promoError={promoError}
              setPromoError={setPromoError}
              isValidatingPromo={isValidatingPromo}
              validatePromo={validatePromo}
              discountAmount={discountAmount}
              squadInfo={squadInfo}
              userSquads={userSquads}
              setShowSquadModal={setShowSquadModal}
              getLoyaltyTier={getLoyaltyTier}
              lastOrderInfo={lastOrderInfo}
              customerOrderHistory={customerOrderHistory}
              customerHistoricalOrdersCount={customerHistoricalOrdersCount}
              loyaltyTiers={LOYALTY_TIERS}
              isZeroClickLoading={isZeroClickLoading}
              handleZeroClickOrder={handleZeroClickOrder}
            />
          )}
        </AnimatePresence>

        {/* Floating elements like flying plates */}
        {flyingPlates.map((plate) => (
          <FlyingPlate
            key={plate.id}
            img={plate.img}
            startX={plate.startX}
            startY={plate.startY}
            onComplete={() => {
              setFlyingPlates((prev) => prev.filter((p) => p.id !== plate.id));
              setCartBouncing(true);
              setTimeout(() => setCartBouncing(false), 600);
            }}
          />
        ))}

        {/* حالة رادار الديوانية وتشغيل اللوكيشن بوضوح */}
        <AnimatePresence>
          {!isCheckout && radarNearbySquads.length === 0 && radarStatus !== "idle" && radarStatus !== "empty" && radarStatus !== "ready" && (
            <motion.div
              initial={{ opacity: 0, y: 56, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 56, scale: 0.98 }}
              className={cn(
                "customer-mobile-stable-alert fixed md:w-[330px] bg-white text-brand rounded-[22px] px-3.5 py-3 shadow-xl z-[85] border border-amber-100 text-right font-sans",
                floatingAlertPanelSide,
                floatingAlertBottom,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => radarStatus === "denied" ? setShowRadarInstructionModal(true) : refreshRadarOnce()}
                  disabled={radarStatus === "checking"}
                  className="bg-brand text-white rounded-2xl px-4 py-2 text-[10px] font-black active:scale-95 shrink-0 disabled:opacity-60"
                >
                  {radarStatus === "checking" ? "جاري الفحص" : radarStatus === "denied" ? "طريقة التفعيل" : radarStatus === "weak" ? "تحسين الدقة" : "تشغيل الرادار"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-end gap-1.5 text-[11px] font-black">
                    <span>{radarStatus === "denied" ? "الموقع غير متاح" : radarStatus === "weak" ? "الموقع تقريبي" : "رادار الديوانية"}</span>
                    {radarStatus === "denied" && <MapPin className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <div className="text-[9px] font-bold text-stone-500 mt-0.5 leading-snug line-clamp-2">
                    {radarStatus === "denied" ? "فعّله من المتصفح لتشغيل الرادار." : radarStatusMsg}
                  </div>
                  {radarAccuracy !== null && <div className="text-[8px] font-black text-stone-400 mt-0.5">الدقة: {radarAccuracy}م</div>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* رادار التراث - إشعار جيو لوكيشن ذكي للديوانيات القريبة */}
        <AnimatePresence>
          {radarNearbySquads.length > 0 && (
            isNearbyRadarPanelCollapsed ? (
              <motion.button
                key="collapsed-nearby-radar"
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                onClick={() => {
                  setIsNearbyRadarPanelCollapsed(false);
                  setIsOwnerJoinAlertCollapsed(true);
                  setIsQatyaAlertCollapsed(true);
                }}
                className={cn(
                  "customer-soft-alert-bubble customer-mobile-stable-alert-bubble fixed w-12 h-12 bg-slate-900/95 text-amber-100 rounded-full shadow-2xl z-[85] border border-amber-500/30 backdrop-blur-md flex items-center justify-center text-xs font-black",
                  floatingAlertBubbleSide,
                  floatingAlertBottom,
                )}
                title="فتح رادار الديوانيات القريبة"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                </span>
                <span className="text-base">📡</span>
              </motion.button>
            ) : (
              <motion.div
                key="expanded-nearby-radar"
                initial={{ opacity: 0, y: 150, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 150, scale: 0.9 }}
                className={cn(
                  "customer-mobile-stable-alert fixed md:w-[400px] max-h-[min(420px,calc(100dvh-140px))] overflow-y-auto bg-slate-900 text-white rounded-[32px] p-6 shadow-2xl z-[85] border-2 border-amber-500/20 text-right font-sans space-y-4",
                  floatingAlertPanelSide,
                  floatingAlertBottom,
                )}
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
                  <button
                    onClick={() => setIsNearbyRadarPanelCollapsed(true)}
                    className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/15 flex items-center justify-center transition-all shrink-0"
                    title="تصغير رادار الديوانيات"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <span className="text-[10px] font-black bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">رادار الديوانية 📡</span>
                    <h4 className="font-black text-sm mt-2 text-amber-100">
                      لقطنا دواوين قريبة منك 📍
                    </h4>
                  </div>
                  <div className="relative flex h-3 w-3 mt-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </div>
                </div>

                <p className="text-[11px] font-bold text-slate-300 leading-normal">
                  إذا هذي ديوانيتك بدّل لها، وإذا مو عضو دز طلب والمعزب يوافق عليك.
                </p>

                <LeafletKuwaitMap
                  markers={radarNearbySquads.filter((sq: any) => sq.lat !== undefined && sq.lng !== undefined).map((sq: any) => ({
                    id: String(sq.id),
                    name: `ديوانية ${sq.name}`,
                    lat: Number(sq.lat),
                    lng: Number(sq.lng),
                    subtitle: `تبعد ${normalizeDigits(String(sq.distance))}م`,
                    color: sq.isAlreadyMember ? '#10b981' : '#f59e0b',
                    radiusMeters: Number(sq.geofenceDistance || 80),
                    size: 28,
                  }))}
                  center={radarNearbySquads[0]?.lat && radarNearbySquads[0]?.lng ? { lat: Number(radarNearbySquads[0].lat), lng: Number(radarNearbySquads[0].lng) } : { lat: 29.3375, lng: 47.9774 }}
                  zoom={15}
                  dark
                  showRange
                  heightClassName="h-[220px]"
                />

                <div className="space-y-3">
                  {radarNearbySquads.map((sq: any) => {
                    const isLoading = radarLoadingMap[sq.id];
                    const isSuccess = radarSuccessMap[sq.id];

                    return (
                      <div 
                        key={sq.id} 
                        className="p-3 bg-slate-800 rounded-2xl border border-slate-700/50 flex flex-col gap-2 transition-all hover:bg-slate-800/90"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 border border-amber-500/10 px-2 py-0.5 rounded-lg font-mono">
                            تبعد {normalizeDigits(String(sq.distance))}م
                          </span>
                          <span className="text-xs font-black text-white">ديوانية {sq.name}</span>
                        </div>

                        {isSuccess ? (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-1.5 px-3 rounded-xl text-[10px] font-black text-center animate-pulse">
                            دزينا طلبك للمعزب! ناطرين موافقته 📡
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end mt-1 flex-wrap">
                            <button
                              onClick={() => setIsNearbyRadarPanelCollapsed(true)}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[10px] py-1.5 px-3 rounded-xl transition-all inline-flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              تصغير
                            </button>
                            
                            {sq.isAlreadyMember ? (
                              <button
                                onClick={() => handleSwitchToNearbySquad(sq)}
                                className="bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-[10px] py-1.5 px-4 rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
                              >
                                {sq.isOwnerOfNearby ? "فعّل ديوانيتك هنا 👑" : "أنا عضو هنا، خلّها الحالية ✅"}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendRadarRequest(sq)}
                                disabled={isLoading}
                                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 text-slate-950 font-black text-[10px] py-1.5 px-4 rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
                              >
                                {isLoading ? "ندز الطلب..." : "دز طلب للمعزب 📡"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!customerPhone && (
                  <p className="text-[9px] font-bold text-amber-500/50 text-center pt-2">
                    سجل رقمك عشان يوصل طلبك للمعزب باسمك ورقمك!
                  </p>
                )}
              </motion.div>
            )
          )}
        </AnimatePresence>

        <AnimatePresence>
          {radarJoinDraft && (
            <motion.div
              key="radar-join-phone-sheet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setRadarJoinDraft(null);
              }}
            >
              <motion.div
                initial={{ y: 32, scale: 0.96, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 24, scale: 0.97, opacity: 0 }}
                className="w-full max-w-sm rounded-[30px] bg-white text-brand p-5 shadow-2xl border border-amber-100 text-right"
                dir="rtl"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setRadarJoinDraft(null)}
                    className="h-9 w-9 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center"
                    aria-label="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div>
                    <p className="text-[10px] font-black text-amber-600">طلب دخول ديوانية</p>
                    <h3 className="text-lg font-black mt-1">اسمك ورقمك للمعزب</h3>
                    <p className="text-xs font-bold text-stone-500 mt-1 leading-6">
                      اكتب اسمك ورقم تلفونك 8 أرقام. الاثنين مطلوبين عشان ندز طلب الدخول.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={radarJoinDraft.phone}
                    onChange={(e) => setRadarJoinDraft((prev) => prev ? { ...prev, phone: normalizeEightDigitPhone(e.target.value) } : prev)}
                    placeholder="90000000"
                    className="w-full rounded-2xl border-2 border-stone-100 bg-stone-50 px-4 py-4 text-center text-xl font-black tracking-[0.18em] outline-none focus:border-amber-400"
                    dir="ltr"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={radarJoinDraft.name}
                    onChange={(e) => setRadarJoinDraft((prev) => prev ? { ...prev, name: e.target.value.slice(0, 30) } : prev)}
                    placeholder="اسمك"
                    className="w-full rounded-2xl border border-stone-100 bg-white px-4 py-3 text-right text-sm font-bold outline-none focus:border-amber-300"
                  />
                  <button
                    type="button"
                    disabled={radarJoinDraft.phone.length !== 8 || !String(radarJoinDraft.name || "").trim()}
                    onClick={async () => {
                      const cleanPhone = normalizeEightDigitPhone(radarJoinDraft.phone);
                      const cleanName = String(radarJoinDraft.name || "").trim();
                      if (cleanPhone.length !== 8 || !cleanName) {
                        alert("اكتب اسمك ورقم تلفونك 8 أرقام عشان نكمل طلب الدخول");
                        return;
                      }
                      setCustomerPhone(cleanPhone);
                      setGuestPhone(cleanPhone);
                      setCustomerName(cleanName);
                      setGuestName(cleanName);
                      try { localStorage.setItem("customer_phone_track", cleanPhone); } catch(e) {}
                      const draft = { ...radarJoinDraft, name: cleanName };
                      setRadarJoinDraft(null);
                      await submitRadarJoinRequest(draft.squad, cleanPhone, cleanName);
                    }}
                    className="w-full rounded-2xl bg-amber-500 text-slate-950 px-4 py-4 text-sm font-black shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all disabled:opacity-45"
                  >
                    أرسل الطلب للمعزب
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* دليل تشغيل الرادار وتفعيل الموقع للمتصفح والأجهزة */}
        <AnimatePresence>
          {showRadarInstructionModal && (
            <motion.div
              key="radar-instruction-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowRadarInstructionModal(false);
              }}
            >
              <motion.div
                initial={{ y: 22, scale: 0.97, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 18, scale: 0.98, opacity: 0 }}
                className="w-full max-w-[315px] rounded-[26px] bg-white text-brand px-5 py-5 shadow-2xl border border-amber-100 text-center font-sans relative"
                dir="rtl"
              >
                <button
                  type="button"
                  onClick={() => setShowRadarInstructionModal(false)}
                  className="absolute top-3 left-3 h-8 w-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>

                <MapPin className="w-9 h-9 mx-auto text-amber-500 mb-3" />
                <h3 className="text-lg font-black text-brand leading-tight">الموقع غير متاح</h3>
                <p className="mt-1.5 text-[11px] font-bold text-stone-500 leading-relaxed">
                  فعّله من المتصفح لتشغيل الرادار.
                </p>

                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/45 px-3 py-3 text-right">
                  <p className="text-[11px] font-black text-brand mb-1">الخطوات</p>
                  <ol className="space-y-1.5 text-[10px] font-bold text-stone-600 leading-relaxed list-decimal list-inside">
                    <li>افتح إعدادات الموقع.</li>
                    <li>اختر سماح.</li>
                    <li>ارجع واضغط جرّب الآن.</li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowRadarInstructionModal(false);
                    refreshRadarOnce();
                  }}
                  className="mt-4 w-full py-3 rounded-2xl bg-brand hover:bg-brand/95 text-white text-[11px] font-black shadow-lg shadow-brand/15 active:scale-95 transition-all text-center"
                >
                  جرّب الآن
                </button>
                <button
                  type="button"
                  onClick={() => setShowRadarInstructionModal(false)}
                  className="mt-2 w-full py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-500 text-[11px] font-bold transition-all text-center"
                >
                  تراجع
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* تنبيه عام للمعزب عند وصول طلب انضمام حتى خارج صفحة الديوانية */}
        <AnimatePresence>
          {customerPhone && pendingGeofenceRequests.length > 0 && (
            isOwnerJoinAlertCollapsed ? (
              <motion.button
                key="owner-join-alert-collapsed"
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                onClick={() => {
                  setIsOwnerJoinAlertCollapsed(false);
                  setIsNearbyRadarPanelCollapsed(true);
                  setIsQatyaAlertCollapsed(true);
                }}
                className={cn(
                  "customer-soft-alert-bubble customer-mobile-stable-alert-bubble is-amber fixed rounded-full relative bg-slate-900/95 text-amber-100 border border-amber-500/30 shadow-2xl z-[85] flex items-center justify-center backdrop-blur-md",
                  floatingAlertBubbleSide,
                  floatingAlertBottomMid,
                )}
                title="طلبات انضمام معلقة"
              >
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                </span>
                <BellRing className="w-5 h-5" />
                <span className="customer-soft-alert-count">{pendingGeofenceRequests.length}</span>
              </motion.button>
            ) : (
              <motion.div
                key="owner-join-alert-expanded"
                initial={{ opacity: 0, y: 120, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 120, scale: 0.92 }}
                className={cn(
                  "customer-mobile-stable-alert fixed md:w-[390px] max-h-[min(410px,calc(100dvh-160px))] overflow-y-auto bg-slate-900 text-white rounded-[32px] p-5 shadow-2xl z-[85] border-2 border-amber-500/20 text-right font-sans space-y-4",
                  floatingAlertPanelSide,
                  floatingAlertBottom,
                )}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <button
                    onClick={() => setIsOwnerJoinAlertCollapsed(true)}
                    className="w-8 h-8 rounded-full bg-white/10 text-slate-300 hover:text-white hover:bg-white/15 flex items-center justify-center transition-all shrink-0"
                    title="تصغير طلبات الانضمام"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <span className="text-[10px] font-black bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">رادار الديوانية 📡</span>
                    <h4 className="font-black text-sm mt-2 text-amber-100">في واحد ناطر موافقة المعزب</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">اقبل أو ارفض من هني بدون لا تطلع من المنيو.</p>
                  </div>
                  <div className="relative flex h-3 w-3 mt-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </div>
                </div>

                <div className="space-y-3">
                  {pendingGeofenceRequests.slice(0, 5).map((req: any, idx: number) => (
                    <div key={`${req.phone}-${idx}`} className="p-3 bg-slate-800 rounded-2xl border border-slate-700/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 border border-amber-500/10 px-2 py-0.5 rounded-lg">يبعد {req.distance ? normalizeDigits(String(req.distance)) : "قريب"}م</span>
                        <div className="text-right">
                          {req.squadName && <div className="text-[9px] font-black text-amber-300 mb-0.5">ديوانية {req.squadName}</div>}
                          <div className="text-xs font-black text-white">{req.name || "عضو قريب"}</div>
                          <div className="text-[10px] font-bold text-slate-400 font-mono">{req.phone}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleOwnerJoinDecision(req.phone, false, req.squadId)}
                          disabled={ownerJoinDecisionLoading[req.phone]}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[10px] font-black px-3 py-2 rounded-xl active:scale-95"
                        >
                          رفض
                        </button>
                        <button
                          onClick={() => handleOwnerJoinDecision(req.phone, true, req.squadId)}
                          disabled={ownerJoinDecisionLoading[req.phone]}
                          className="bg-emerald-400 hover:bg-emerald-500 text-slate-950 text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 shadow-sm"
                        >
                          {ownerJoinDecisionLoading[req.phone] ? "ثواني..." : "قبول"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* تنبيه قطية الديوانية للأعضاء حتى وهم يتصفحون المنيو */}
        <AnimatePresence>
          {customerPhone && qatyaAlertItems.length > 0 && (
            isQatyaAlertCollapsed ? (
              <motion.button
                key="qatya-alert-collapsed"
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                onClick={() => {
                  setIsQatyaAlertCollapsed(false);
                  setIsNearbyRadarPanelCollapsed(true);
                  setIsOwnerJoinAlertCollapsed(true);
                }}
                className={cn(
                  "customer-soft-alert-bubble customer-mobile-stable-alert-bubble is-emerald fixed rounded-full bg-brand text-white border border-emerald-300/30 shadow-2xl z-[85] flex items-center justify-center backdrop-blur-md",
                  floatingAlertBubbleSide,
                  floatingAlertBottomHigh,
                )}
                title="قطية ديوانية"
              >
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
                </span>
                <CreditCard className="w-5 h-5" />
                <span className="customer-soft-alert-count">{qatyaAlertItems.length}</span>
              </motion.button>
            ) : (
              <motion.div
                key="qatya-alert-expanded"
                initial={{ opacity: 0, y: 120, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 120, scale: 0.92 }}
                className={cn(
                  "customer-mobile-stable-alert fixed md:w-[390px] max-h-[min(360px,calc(100dvh-160px))] overflow-y-auto bg-brand text-white rounded-[32px] p-5 shadow-2xl z-[85] border-2 border-emerald-300/20 text-right font-sans space-y-4",
                  floatingAlertPanelSide,
                  floatingAlertBottom,
                )}
              >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <button
                    onClick={() => setIsQatyaAlertCollapsed(true)}
                    className="w-8 h-8 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/15 flex items-center justify-center transition-all shrink-0"
                    title="تصغير إشعار القطيّة"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <span className="text-[10px] font-black bg-white/10 text-emerald-100 px-3 py-1 rounded-full border border-white/10">قطية الديوانية 💳</span>
                    <h4 className="font-black text-sm mt-2 text-white">عندك قطية من الربع</h4>
                    <p className="text-[10px] font-bold text-white/70 mt-1">الشباب بالديوانية ناطرينك تشارك بقطية الحساب.</p>
                  </div>
                </div>
                {canUseDiwaniyaPush && diwaniyaPushState !== "saved" && (
                  <button
                    type="button"
                    onClick={enableImportantDiwaniyaPush}
                    disabled={isEnablingDiwaniyaPush}
                    className="w-full rounded-2xl bg-white text-brand px-4 py-3 text-[11px] font-black shadow-sm active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    {isEnablingDiwaniyaPush ? "نفعّلها..." : "فعّل تنبيهات القطيّة ووهق غيرك المهمة"}
                  </button>
                )}
                {diwaniyaPushState === "saved" && (
                  <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-[11px] font-black text-emerald-100">
                    تنبيهات القطيّة ووهق غيرك مفعّلة على هالجهاز
                  </div>
                )}
                <div className="space-y-3">
                  {qatyaAlertItems.map((n: any) => (
                    <div key={n.id} className="relative group/item">
                      <button
                        type="button"
                        onClick={() => handleOpenQatyaAlertItem(n)}
                        className="w-full p-3 pl-12 bg-white/10 hover:bg-white/15 rounded-2xl border border-white/10 text-right active:scale-[0.98] transition-all"
                      >
                        <div className="text-[10px] font-black text-emerald-100 mb-1">{n.squadName ? `ديوانية ${n.squadName}` : "ديوانية الربع"}</div>
                        <div className="text-xs font-black text-white">{n.title || "عندك قطيّة"}</div>
                        <div className="text-[10px] font-bold text-white/70 mt-1">{n.message || "دش وحدد قطيتك وادفع مباشرة."}</div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          dismissQatya(n.id);
                          if (n.meta?.orderId) {
                            dismissQatya(n.meta.orderId);
                          }
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-rose-500/30 text-white hover:text-rose-200 flex items-center justify-center transition-all shadow-sm z-10"
                        title="إخفاء التنبيه"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* Wobble Alerts (نداء الدلة) */}
        <AnimatePresence>
          {customerPhone && wobbleAlertItems.length > 0 && (
            isWobbleAlertCollapsed ? (
              <motion.button
                key="wobble-alert-collapsed"
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                onClick={() => {
                  setIsWobbleAlertCollapsed(false);
                  setIsQatyaAlertCollapsed(true);
                  setIsNearbyRadarPanelCollapsed(true);
                  setIsOwnerJoinAlertCollapsed(true);
                }}
                className={cn(
                  "customer-soft-alert-bubble customer-mobile-stable-alert-bubble is-amber fixed rounded-full bg-stone-900 text-white border border-amber-500/30 shadow-2xl z-[86] flex items-center justify-center backdrop-blur-md left-20", // offset left to not overlap with qatya initially
                  floatingAlertBottomHigh,
                )}
                title="نداء الديوانية"
              >
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                </span>
                <span className="text-xl">☕</span>
                <span className="customer-soft-alert-count bg-amber-500">{wobbleAlertItems.length}</span>
              </motion.button>
            ) : (
              <motion.div
                key="wobble-alert-expanded"
                initial={{ opacity: 0, y: 120, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 120, scale: 0.92 }}
                className={cn(
                  "customer-mobile-stable-alert fixed md:w-[390px] max-h-[min(360px,calc(100dvh-160px))] overflow-y-auto bg-stone-900 border border-amber-500/40 text-white rounded-[32px] p-5 shadow-2xl z-[86] text-right font-sans space-y-4",
                  floatingAlertPanelSide,
                  floatingAlertBottom,
                )}
              >
                <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3">
                  <button
                    onClick={() => setIsWobbleAlertCollapsed(true)}
                    className="w-8 h-8 rounded-full bg-white/5 text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all shrink-0"
                    title="تصغير إشعار النداء"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30 shadow-sm animate-pulse">فنجان لك ☕</span>
                    <h4 className="font-black text-sm mt-2 text-white">نداء من الربع</h4>
                    <p className="text-[10px] font-bold text-white/70 mt-1">أحد شباب الديوانية قاعد ينادي.</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {wobbleAlertItems.map((n: any) => (
                    <div key={n.id} className="relative group/item">
                      <button
                        type="button"
                        onClick={() => handleOpenWobbleItem(n)}
                        className="w-full relative overflow-hidden p-3 pl-12 bg-amber-950/20 hover:bg-amber-900/30 rounded-2xl border border-amber-500/10 text-right active:scale-[0.98] transition-all"
                      >
                        <div className="absolute top-1 left-1 opacity-10 text-4xl pointer-events-none">🔊</div>
                        <div className="text-[10px] font-black text-amber-400 mb-1">{n.squadName ? `ديوانية ${n.squadName}` : "ديوانية الربع"}</div>
                        <div className="text-sm font-black text-white leading-relaxed whitespace-pre-wrap">{n.message || "ينادي الربع"}</div>
                        <div className="text-[10px] font-bold text-white/50 mt-1.5 flex gap-1 items-center justify-end">
                          <span>من {n.fromName || "عضو"}</span>
                          <span className="text-amber-500">•</span>
                          <span>الآن</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          dismissWobble(n.id);
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-rose-500/30 text-white hover:text-rose-200 flex items-center justify-center transition-all shadow-sm z-10"
                        title="إخفاء التنبيه"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>

        {/* جاري انتظار القبول من صاحب الديوانية */}
        <AnimatePresence>
          {myGeofenceRequests.some(r => r.status === "pending") && (
            isRadarBannerCollapsed ? (
              <motion.button
                key="collapsed-radar"
                initial={{ opacity: 0, scale: 0.8, x: 50 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 50 }}
                onClick={() => setIsRadarBannerCollapsed(false)}
                className="customer-mobile-stable-alert-bubble fixed top-24 left-4 md:left-auto md:right-6 bg-slate-900/95 text-slate-100 rounded-full p-3.5 shadow-2xl z-50 border border-amber-500/40 text-right backdrop-blur-md flex items-center gap-2 hover:bg-slate-800 transition-all select-none group"
                title="توسيع رادار الانضمام"
              >
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                </div>
                <span className="text-[10px] font-black text-amber-400 hidden group-hover:inline max-w-0 group-hover:max-w-xs transition-with-duration duration-300 overflow-hidden whitespace-nowrap">
                  نراجع الطلب بالرادار... 📡
                </span>
                <span className="text-xs">📡</span>
              </motion.button>
            ) : (
              <motion.div
                key="expanded-radar"
                initial={{ opacity: 0, scale: 0.95, y: -50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -50 }}
                className="customer-mobile-stable-alert fixed top-24 left-6 right-6 md:left-auto md:right-6 md:w-[350px] bg-slate-900/95 text-slate-100 rounded-3xl p-4 shadow-xl z-50 border border-amber-500/20 text-right backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <button 
                    onClick={() => setIsRadarBannerCollapsed(true)}
                    className="text-stone-400 hover:text-white text-xs bg-white/10 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                  >
                    ✕
                  </button>
                  <div className="flex-1 flex items-center justify-end gap-2.5">
                    <div className="flex flex-col text-right">
                      <p className="text-xs font-black text-slate-100">ناطرين قبول صاحب الديوانية... 📡</p>
                      <p className="text-[10px] opacity-75 font-semibold text-slate-300 mt-0.5 animate-pulse">طلبك قيد المراجعة الفورية بالرادار.</p>
                    </div>
                    <div className="relative flex h-2.5 w-2.5 shrink-0 mt-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

const FlyingPlate = ({ img, startX, startY, onComplete }: any) => {
  return (
    <motion.div
      initial={{ 
        x: startX - 24, 
        y: startY - 24, 
        scale: 1, 
        opacity: 1,
        rotate: 0 
      }}
      animate={{ 
        x: 40, // Target position for the left-bottom cart button (approx)
        y: window.innerHeight - 80, 
        scale: 0.2, 
        opacity: 0,
        rotate: 360 
      }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      onAnimationComplete={onComplete}
      className="fixed z-[9999] pointer-events-none"
    >
      <img src={img} className="w-12 h-12 rounded-full shadow-lg object-contain bg-white p-1 border border-stone-100" />
    </motion.div>
  );
};

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
      className={`menu-product-shell relative perspective-[1000px] w-full h-full min-h-[110px]`}
    >
      <motion.div
        className={`w-full h-full relative`}
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
          className={`menu-product-card relative w-full bg-white/80 backdrop-blur-md rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex ${isHorizontal ? "menu-product-card-horizontal flex-col justify-start p-4 pb-3 h-full" : "flex-row items-center p-4 gap-4 min-h-[120px]"} border ${product.isOutOfStock ? "border-stone-100 grayscale-[0.5] opacity-75" : "border-white hover:border-accent/20 hover:shadow-[0_20px_50px_rgba(26,46,34,0.06)] hover:-translate-y-1"} transition-all duration-500 cursor-pointer`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
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

          {/* Horizontal Layout (Carousel) remains unchanged */}
          {isHorizontal ? (
            <>
              <div className="menu-product-image relative flex-shrink-0 overflow-hidden flex items-center justify-center rounded-[22px] w-20 h-20 mx-auto mb-2 shadow-[0_14px_28px_rgba(26,46,34,0.12)] ring-1 ring-white/70">
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
                  className="menu-product-img orser-product-img w-full h-full object-cover bg-transparent relative z-0"
                />
              </div>
              <div className="flex flex-col flex-grow text-center overflow-hidden relative z-10">
                <h3 className="font-extrabold text-sm text-brand leading-tight tracking-tight mt-1 line-clamp-2 min-h-[2.5em] flex items-center justify-center" style={{ wordBreak: "break-word" }}>
                  {product.name}
                </h3>
                {product.preparationInstructions && (
                  <div className="mt-1 flex items-center justify-center gap-1 py-0.5 px-2 bg-rose-50/40 border border-rose-100/20 rounded-full mx-auto w-max max-w-[95%] shadow-[0_1px_2px_rgba(244,63,94,0.01)] event-none select-none">
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                    <span className="text-[8px] sm:text-[9.5px] text-rose-600 font-bold leading-none text-center truncate max-w-[130px]" title={product.preparationInstructions}>
                      {product.preparationInstructions}
                    </span>
                  </div>
                )}
                <p className="text-brand text-sm font-black mt-1.5">
                  {calculateItemBasePriceWithHiddenAddons({
                    id: "", productId: product.id, name: product.name, quantity: 1, price: product.price, selectedExtras: [], product: normalizeProductForAddons(product)
                  })}{" "}
                  <span className="text-[9px] text-accent font-bold">د.ك</span>
                </p>
              </div>
            </>
          ) : (
            /* NEW VERTICAL LAYOUT FOR LIST ITEMS EXACTLY AS REQUESTED */
            <>
              {/* Right Side: Add Button (first child in RTL renders on the right) */}
              <div className="flex-shrink-0 flex items-center justify-center relative z-10 w-12 h-full">
                <div
                  className={`w-12 h-12 flex items-center justify-center text-white rounded-2xl shadow-lg transition-all hover:scale-110 ${product.isOutOfStock ? "bg-stone-300" : "bg-gradient-to-tr from-accent to-amber-500 shadow-accent/30"}`}
                >
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
              </div>

              {/* Center Content: Title over Image over Price over Notes */}
              <div className="orser-product-content flex-1 flex flex-col items-center justify-center text-center relative z-10 py-1 pl-4">
                {/* 1. Title */}
                <h3 className="product-title font-black text-[17px] sm:text-lg text-brand leading-snug tracking-tight mb-3" style={{ wordBreak: "break-word" }}>
                  {product.name}
                </h3>
                
                {/* Image-first display: no white frame, just the food as the visual anchor */}
                <div className="product-media-frame relative w-full max-w-[214px] flex flex-col items-center pt-1 pb-4">
                  {/* 2. Image */}
                  <div className="menu-product-image relative w-[150px] h-[86px] sm:w-[168px] sm:h-[94px] flex-shrink-0 overflow-hidden flex items-center justify-center z-10 mb-2 rounded-[22px] shadow-[0_16px_38px_rgba(26,46,34,0.16)] ring-1 ring-white/80">
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
                      className="menu-product-img orser-product-img w-full h-full object-cover bg-transparent relative z-0"
                    />
                  </div>

                  {/* 3. Price (floating under the image, not attached to a frame) */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-white/80 shadow-[0_8px_22px_rgba(26,46,34,0.08)] px-4 py-1 rounded-full flex items-center justify-center z-20 whitespace-nowrap">
                    <span className="text-brand font-black text-sm">
                      {calculateItemBasePriceWithHiddenAddons({
                        id: "", productId: product.id, name: product.name, quantity: 1, price: product.price, selectedExtras: [], product: normalizeProductForAddons(product)
                      })}
                    </span>
                    <span className="text-[11px] text-accent font-bold mx-1">د.ك</span>
                  </div>
                </div>

                {/* 4. Notes */}
                {product.preparationInstructions && (
                  <div className="product-notes-soft mt-2.5 flex items-center justify-center gap-1 px-2.5 py-0.5 bg-rose-50/40 border border-rose-100/20 rounded-full mx-auto w-max max-w-[95%] z-10 text-center shadow-[0_1px_2px_rgba(244,63,94,0.01)] event-none select-none">
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                    <span className="text-[8px] sm:text-[9.5px] text-rose-600 font-bold leading-none text-center truncate max-w-[130px]" title={product.preparationInstructions}>
                      {product.preparationInstructions}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Back Side (The Whisper) */}
        <div
          className="absolute inset-0 w-full h-full bg-brand rounded-[24px] p-5 flex flex-col items-center justify-center text-center shadow-inner border border-brand cursor-pointer overflow-hidden z-40"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            WebkitTransform: "rotateY(180deg)",
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
    <div className="best-seller-wow-carousel relative w-full h-[200px] flex items-center justify-center overflow-x-hidden perspective-[1200px] select-none touch-pan-y">
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
              className="best-seller-wow-card absolute w-[180px] h-[200px] cursor-grab active:cursor-grabbing"
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
  const productAddons = useMemo(() => normalizeAddons((product as any).addons), [product]);
  const normalizedProduct = useMemo(() => ({ ...(product as any), addons: productAddons }), [product, productAddons]);
  const [selectedAddonsIds, setSelectedAddonsIds] = useState<string[]>(() => {
    return productAddons
      .filter((a: any) => {
        const limits = getQuantityRuleLimits(a, 1);
        return limits.available && (isAddonRequired(a) || a.quantityRule?.mode === 'auto' || a.quantityRule?.mode === 'required');
      })
      .map((a: any) => getAddonKey(a));
  });
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>(() => {
    const qs: Record<string, number> = {};
    productAddons.forEach((a: any) => {
      const limits = getQuantityRuleLimits(a, 1);
      const key = getAddonKey(a);
      if (limits.available && (isAddonRequired(a) || a.quantityRule?.mode === 'auto' || a.quantityRule?.mode === 'required')) {
        qs[key] = Math.max(limits.min, a.quantityRule?.mode === 'auto' ? limits.suggested : 1);
      }
    });
    return qs;
  });
  const [note, setNote] = useState("");

  useEffect(() => {
    setSelectedAddonsIds((prev) => {
      const forced = productAddons
        .filter((a: any) => {
          const limits = getQuantityRuleLimits(a, quantity);
          return limits.available && (isAddonRequired(a) || a.quantityRule?.mode === 'auto' || a.quantityRule?.mode === 'required');
        })
        .map((a: any) => getAddonKey(a));
      const available = new Set(productAddons.filter((a: any) => getQuantityRuleLimits(a, quantity).available).map((a: any) => getAddonKey(a)));
      return Array.from(new Set([...prev.filter((id) => available.has(id)), ...forced]));
    });
    setAddonQuantities((prev) => {
      const next = { ...prev };
      productAddons.forEach((a: any) => {
        const limits = getQuantityRuleLimits(a, quantity);
        const key = getAddonKey(a);
        if (!limits.available) {
          delete next[key];
          return;
        }
        const mustStay = isAddonRequired(a) || a.quantityRule?.mode === 'auto' || a.quantityRule?.mode === 'required';
        if (mustStay) {
          const desired = a.quantityRule?.mode === 'auto' ? limits.suggested : Math.max(limits.min, next[key] ?? 1);
          next[key] = Math.max(limits.min, Math.min(limits.max, desired));
        } else if (next[key] !== undefined) {
          next[key] = Math.max(limits.min, Math.min(limits.max, next[key]));
        }
      });
      return next;
    });
  }, [quantity, productAddons]);

  const mockItem = {
    id: "",
    productId: product.id,
    name: product.name,
    quantity,
    price: product.price,
    selectedOption,
    selectedExtras,
    selectedAddonsIds,
    addonQuantities,
    product: normalizedProduct
  } as any;
  const modalTotalPrice = calculateItemTotalWithAddons(mockItem);
  const itemPrice = modalTotalPrice / quantity;

  const toggleExtra = (extra: { name: string; price: number }) => {
    if (selectedExtras.find((e) => e.name === extra.name)) {
      setSelectedExtras(selectedExtras.filter((e) => e.name !== extra.name));
    } else {
      setSelectedExtras([...selectedExtras, extra]);
    }
  };

  const toggleAddon = (addonId: string) => {
    const addon = productAddons.find((a: any) => getAddonKey(a) === addonId);
    if (!addon) return;
    const limits = getQuantityRuleLimits(addon, quantity);
    if (!limits.available) return;

    if (selectedAddonsIds.includes(addonId)) {
      if (isAddonRequired(addon) || addon.quantityRule?.mode === 'auto') {
         // Mandatory/automatic addons cannot be unchecked, but their quantity can be changed below.
         return;
      }
      setSelectedAddonsIds(selectedAddonsIds.filter((id) => id !== addonId));
      const newQs = { ...addonQuantities };
      delete newQs[addonId];
      setAddonQuantities(newQs);
    } else {
      setSelectedAddonsIds([...selectedAddonsIds, addonId]);
      setAddonQuantities({ ...addonQuantities, [addonId]: Math.max(limits.min, addon.quantityRule?.mode === 'auto' ? limits.suggested : 1) });
    }
  };

  const updateAddonQty = (addonId: string, delta: number) => {
    const addon = productAddons.find((a: any) => getAddonKey(a) === addonId);
    if (!addon) return;
    const limits = getQuantityRuleLimits(addon, quantity);
    if (!limits.available) return;
    const current = addonQuantities[addonId] ?? Math.max(limits.min, 1);
    const next = Math.max(limits.min, Math.min(limits.max, current + delta));
    setAddonQuantities({ ...addonQuantities, [addonId]: next });
  };

  const canAddProduct = () => {
    for (const addon of productAddons) {
      const key = getAddonKey(addon);
      const limits = getQuantityRuleLimits(addon, quantity);
      const selected = selectedAddonsIds.includes(key);
      const qty = Number(addonQuantities[key] || 0);

      if (!limits.available && selected) return false;
      if (limits.available && selected && (qty < limits.min || qty > limits.max)) return false;
      if (limits.available && (isAddonRequired(addon) || addon.quantityRule?.mode === 'required') && qty < limits.min) return false;
    }
    return true;
  };

  const normalizeForSmartRecommendation = (value: any) =>
    String(value || "")
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[^\u0600-\u06FFa-z0-9]+/g, " ")
      .trim();

  const isSmartRecommendationAddon = (addon: any) => {
    const key = getAddonKey(addon);
    const limits = getQuantityRuleLimits(addon, quantity);
    if (!limits.available || selectedAddonsIds.includes(key)) return false;
    if (isAddonRequired(addon) || addon.quantityRule?.mode === 'auto' || addon.quantityRule?.mode === 'required') return false;
    if (addon.calculationType === 'per_x_items' || addon.quantityRule?.enabled) return false;

    const addonName = normalizeForSmartRecommendation(addon.name);
    const productName = normalizeForSmartRecommendation(product.name);
    if (!addonName) return false;
    if (productName && (productName.includes(addonName) || addonName.includes(productName))) return false;

    const blockedWords = [
      'صينيه', 'صينية', 'طبق', 'اطباق', 'وجبه', 'وجبة', 'نفر', 'نفرين', 'نفرين',
      'حجم', 'مقاس', 'كيلو', 'نصف', 'ربع', 'بوكس', 'بوكسات', 'علبه', 'علبة',
      'حبه', 'حبة', 'باكج', 'باقة', 'سيت', 'كرتون', 'درزن', 'خروف', 'ذبيحه', 'ذبيحة'
    ].map(normalizeForSmartRecommendation);
    if (blockedWords.some((word) => addonName === word || addonName.includes(word))) return false;

    const preferredWords = [
      'صوص', 'صلصه', 'صلصة', 'دقوس', 'روب', 'لبن', 'سلطه', 'سلطة', 'مشروب',
      'بيبسي', 'سفن', 'ماء', 'بطاط', 'مقبلات', 'مخلل', 'ليمون', 'مكسرات',
      'كاجو', 'لوز', 'زبيب', 'بصل', 'شطة', 'شطة', 'حار', 'مرق'
    ].map(normalizeForSmartRecommendation);

    return preferredWords.some((word) => addonName.includes(word));
  };

  const smartRecommendedAddons = productAddons.filter(isSmartRecommendationAddon).slice(0, 1);

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
        className="product-detail-layer bg-gradient-to-b from-[#fffaf2] via-white to-white w-full max-w-lg rounded-t-[32px] p-6 sm:p-8 max-h-[92vh] overflow-y-auto no-scrollbar shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.1)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-44 opacity-20 blur-3xl"
          style={{
            backgroundImage: `url(${(product as any).imageUrl || product.image || settings?.companyLogo || settings?.logo || DEFAULT_GLOBAL_LOGO})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 bg-stone-50/80 backdrop-blur-sm hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-12 h-1 bg-stone-100 rounded-full" />
        </div>

        <div className="flex flex-col sm:flex-row gap-6 mb-8 mt-2 group relative z-10">
          <div className="relative shrink-0 flex justify-center">
            {(product as any).isNewProduct && (
              <span className="absolute top-1 right-1 sm:-right-3 sm:-top-2 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] sm:text-xs font-extrabold px-3 py-1 rounded-full z-20 shadow-[0_4px_15px_rgba(239,68,68,0.4)] border-2 border-white transform rotate-3">
                جديد
              </span>
            )}
            <div className="absolute inset-0 bg-brand blur-2xl opacity-15 transform scale-90 group-hover:scale-100 transition-transform"></div>
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
                className="w-[108px] h-[108px] sm:w-[126px] sm:h-[126px] object-contain bg-white p-2 rounded-[28px] shadow-[0_20px_48px_rgba(26,46,34,0.18)] relative ring-1 ring-white/80"
              />
            ) : (
              <div className="w-[108px] h-[108px] sm:w-[126px] sm:h-[126px] flex items-center justify-center bg-stone-50/80 backdrop-blur-sm border border-stone-100 text-stone-400 rounded-[28px] shadow-md relative p-1">
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
              {calculateItemBasePriceWithHiddenAddons({
                id: "",
                productId: product.id,
                name: product.name,
                quantity: quantity || 1,
                price: product.price,
                selectedExtras: selectedExtras,
                selectedAddonsIds: selectedAddonsIds,
                product: normalizeProductForAddons(product),
              })}{" "}
              <span className="text-sm text-accent">د.ك</span>
            </p>
            {product.preparationInstructions && (
              <div className="mt-2 text-[9px] sm:text-[10.5px] text-rose-600 font-bold flex items-center justify-center sm:justify-start gap-1 py-0.5 px-2 bg-rose-50/40 border border-rose-100/20 rounded-full max-w-max">
                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />{" "}
                <span className="leading-none">
                  {product.preparationInstructions}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {Array.isArray(product.options) && product.options.length > 0 && (
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

          {Array.isArray(product.extras) && product.extras.length > 0 && (
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
                      {extra.price > 0 && (
                        <span className="text-xs font-bold text-accent">
                          +{extra.price} د.ك
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {productAddons.length > 0 && (
            <div className="space-y-4">
              {smartRecommendedAddons.map((recommendedAddon: any) => {
                const recommendedAddonName = cleanCustomerAddonLabel(recommendedAddon.name);
                const creativeMessages = [
                  // عبارات تشويقية
                  `أضف لمسة سحرية لطلبك مع "${recommendedAddonName}" ✨`,
                  `السر في التفاصيل! جرب إضافة "${recommendedAddonName}" لتجربة لا تُنسى 😋`,
                  `تخيل الطعم مع "${recommendedAddonName}"... مزيج لا يقاوم! 🔥`,
                  `اختيار الذواقة الأول: إضافة "${recommendedAddonName}" مع هذا الطبق 🌟`,
                  `لا تفوت التجربة المتكاملة مع "${recommendedAddonName}" 🤌`,
                  `مزيج مذهل! الكثير يفضلون إضافة "${recommendedAddonName}" لتعزيز النكهة 😋`,
                  // عبارات فيها تفاعل
                  `ناقصك شيء واحد عشان يكمل الطلب.. "${recommendedAddonName}"! 😉`,
                  `وش رأيك تكملها وتضيف "${recommendedAddonName}"؟ ماراح تندم 😍`,
                  `الأغلبية يطلبون "${recommendedAddonName}" مع هذا الطلب.. جربه! 👍`,
                  // عبارات وصفية ومغرية
                  `غوص في بحر النكهات المتناغمة مع "${recommendedAddonName}" 🌊`,
                  `خلي طلبك غير مع إضافة "${recommendedAddonName}" المذهلة 💯`,
                  `الطعم الأصلي يحلى أكثر مع "${recommendedAddonName}" 👑`,
                  `إضافة صغيرة تصنع فرق كبير: "${recommendedAddonName}" ✨`,
                  // عبارات سريعة ومرحة
                  `تدلع نفسك؟ ضيف "${recommendedAddonName}" وما عليك 😎`,
                  `ليش تاكله عادي في حين ممكن تخليه أسطوري مع "${recommendedAddonName}"؟ 🚀`,
                  `خلي الطعم يتكلم! أضف "${recommendedAddonName}" واستمتع 🤤`,
                  `السعادة تكتمل بهالإضافة: "${recommendedAddonName}" ❤️`
                ];
                const charSum = (getAddonKey(recommendedAddon) + product.id).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
                const message = creativeMessages[charSum % creativeMessages.length];
                
                return (
                <div 
                  key={`ai-rec-${getAddonKey(recommendedAddon)}`}
                  onClick={() => toggleAddon(getAddonKey(recommendedAddon))}
                  className="bg-indigo-50/50 border border-indigo-100 p-3 sm:p-4 rounded-xl flex gap-3 items-start cursor-pointer transition-all hover:bg-indigo-50"
                >
                  <div className="text-xl">💡</div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-2 mb-1.5">
                      ترشيح ذكي 
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">موصى به لك</span>
                    </h4>
                    <p className="text-[11px] text-indigo-800/80 leading-relaxed font-medium">
                      {message}
                    </p>
                  </div>
                </div>
                );
              })}

              <div className="space-y-3">
                <label className="text-xs font-bold text-stone-500 block">
                  إضافات للمنتج
                </label>
              <div className="product-addons-luxury grid grid-cols-1 gap-3 sm:gap-4">
                {productAddons.map((addon: any) => {
                  const addonKey = getAddonKey(addon);
                  const addonDisplayName = cleanCustomerAddonLabel(addon.name);
                  const isSelected = selectedAddonsIds.includes(addonKey);
                  const limits = getQuantityRuleLimits(addon, quantity);
                  const isMandatory = isAddonRequired(addon) || addon.quantityRule?.mode === 'auto';
                  const effectiveSelected = limits.available && (isSelected || isMandatory);
                  const currentAddonQty = addonQuantities[addonKey] ?? Math.max(limits.min, 1);
                  return (
                    <div
                      key={addonKey}
                      onClick={() => toggleAddon(addonKey)}
                      className={cn(
                        "addon-lux-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer",
                        !limits.available
                          ? "border-stone-100 bg-stone-50/70 opacity-60 cursor-not-allowed"
                          : effectiveSelected
                          ? isMandatory ? "addon-lux-card-selected addon-lux-card-required border-accent bg-accent/10 cursor-default opacity-90" : "addon-lux-card-selected border-accent bg-accent/5"
                          : "border-stone-50 bg-stone-50/30 hover:border-stone-100",
                      )}
                    >
                      <div className="addon-lux-title flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all",
                            effectiveSelected
                              ? "bg-accent border-accent text-white"
                              : "border-stone-100 bg-white",
                          )}
                        >
                          {effectiveSelected && (
                            <Check className="w-3 h-3 stroke-[3]" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs sm:text-sm transition-colors font-bold",
                            effectiveSelected ? "text-brand" : "text-stone-500",
                          )}
                        >
                          {addonDisplayName}
                        </span>
                      </div>
                      
                      <div className="addon-lux-meta flex items-center gap-2">
                        {effectiveSelected && (
                           <div className="addon-lux-qty flex items-center gap-2 bg-white rounded-md border border-stone-200" onClick={e => e.stopPropagation()}>
                              <button disabled={!limits.available || currentAddonQty <= limits.min} className="px-2 text-stone-400 hover:text-accent font-bold disabled:opacity-30" onClick={() => updateAddonQty(addonKey, -1)}>-</button>
                              <span className="addon-lux-qty-value text-xs font-bold w-4 text-center text-brand">{currentAddonQty}</span>
                              <button disabled={!limits.available || currentAddonQty >= limits.max} className="px-2 text-stone-400 hover:text-accent font-bold disabled:opacity-30" onClick={() => updateAddonQty(addonKey, 1)}>+</button>
                           </div>
                        )}
                        {addon.price > 0 && !addon.isHiddenPrice && (
                          <span className="text-xs font-bold text-accent">
                            {addon.freeQuantity && addon.freeQuantity > 0 ? (
                              <span className="text-[10px] text-green-600 block sm:inline mb-1 sm:mb-0 sm:ml-1">(أول {addon.freeQuantity} مجاناً) </span>
                            ) : null}
                            +{addon.price} د.ك
                          </span>
                        )}
                        {(addon.price === 0 || addon.isHiddenPrice) && addon.freeQuantity && addon.freeQuantity > 0 && (
                            <span className="text-[10px] font-bold text-green-600">أول {addon.freeQuantity} مجاناً</span>
                        )}
                        {isMandatory && (
                            <span className="text-[9px] font-bold text-red-500 mr-2 border border-red-200 bg-red-50 px-1 rounded block sm:inline whitespace-nowrap">إلزامي</span>
                        )}
                        {!limits.available && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1 rounded block sm:inline whitespace-nowrap">متاحة من كمية {limits.minProductQty}+</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                    // vibration disabled: keep visual notification stable
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
                    // vibration disabled: keep visual notification stable
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
              disabled={!canAddProduct()}
              onClick={(e) => {
                if (!canAddProduct()) return;
                onAdd(
                  {
                    id: "",
                    productId: product.id,
                    supplierId: (product as any).supplierId,
                    supplierName: (product as any).supplierName || (product as any).supplier,
                    name: product.name,
                    image:
                      (product as any).imageUrl ||
                      product.image ||
                      settings?.companyLogo ||
                      settings?.logo ||
                      DEFAULT_GLOBAL_LOGO,
                    quantity,
                    price: product.price,
                    selectedOption,
                    selectedExtras,
                    selectedAddonsIds: selectedAddonsIds,
                    addonQuantities,
                    note,
                    preparationInstructions: product.preparationInstructions,
                    product: normalizeProductForAddons(product),
                  },
                  e,
                );
              }}
              className="flex-grow bg-brand text-white p-5 sm:p-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl text-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>حطه بالسلة</span>
              <span className="w-px h-6 bg-white/30"></span>
              <span className="font-bold">
                {calculateItemTotalWithAddons({
                    id: "",
                    productId: product.id,
                    name: product.name,
                    quantity,
                    price: product.price,
                    selectedExtras,
                    selectedAddonsIds: selectedAddonsIds,
                    addonQuantities,
                    product: normalizeProductForAddons(product),
                })} د.ك
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CheckoutOverlay({
  initialStep = "cart",
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
  squadInfo,
  userSquads,
  setShowSquadModal,
  getLoyaltyTier,
  lastOrderInfo,
  customerOrderHistory = [],
  customerHistoricalOrdersCount = 0,
  loyaltyTiers = [],
  isZeroClickLoading,
  handleZeroClickOrder,
}: any) {
  const [regionSearch, setRegionSearch] = useState("");
  const [showRegions, setShowRegions] = useState(false);
  const [step, setStep] = useState<"cart" | "delivery" | "payment">(initialStep);
  const lastOrderItemsCount = Array.isArray(lastOrderInfo?.items) ? lastOrderInfo.items.length : 0;
  const lastOrderTotal = Number(lastOrderInfo?.total || lastOrderInfo?.amount || 0);
  const cleanHistory = Array.isArray(customerOrderHistory) ? customerOrderHistory : [];
  const normalizedLoyaltyTiers = Array.isArray(loyaltyTiers) ? loyaltyTiers : [];
  const currentTier = getLoyaltyTier(customerPoints || 0);
  const currentTierIndex = normalizedLoyaltyTiers.findIndex((tier: any) => String(tier?.id ?? tier?.name) === String(currentTier?.id ?? currentTier?.name));
  const nextTier = currentTierIndex >= 0 ? normalizedLoyaltyTiers[currentTierIndex + 1] : null;
  const expectedPoints = Math.max(0, Math.floor(Number(itemsTotal || 0)));
  const pointsAfterOrder = Number(customerPoints || 0) + expectedPoints;
  const upcomingTier = nextTier && pointsAfterOrder >= Number(nextTier?.minPoints || 0) ? nextTier : null;
  const pointsNeeded = nextTier ? Math.max(0, Number(nextTier.minPoints || 0) - Number(customerPoints || 0)) : 0;
  const profileChecks = [
    Boolean(String(customerName || '').trim()),
    String(customerPhone || '').replace(/[^0-9]/g, '').length >= 8,
    Boolean(address?.region),
    Boolean(address?.block && address?.street && address?.building),
    Boolean(String(generalNotes || '').trim()),
  ];
  const profileCompletion = Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100);
  const getOrderTime = (order: any) => new Date(order?.createdAt || order?.paidAt || order?.date || order?.timestamp || 0).getTime() || 0;
  const loyaltyActivity = cleanHistory
    .filter((order: any) => {
      const status = String(order?.status || '').toLowerCase();
      const paymentStatus = String(order?.paymentStatus || '').toLowerCase();
      return paymentStatus === 'paid' || status.includes('تم الدفع') || status.includes('تم التوصيل') || status.includes('delivered') || status.includes('completed');
    })
    .sort((a: any, b: any) => getOrderTime(b) - getOrderTime(a))
    .slice(0, 3)
    .map((order: any) => ({
      id: order?.id || order?.invoiceId || order?.linkedInvoiceId || 'طلب',
      points: Math.max(0, Math.floor(Number(order?.total || order?.totalAmount || order?.amount || 0))),
      date: getOrderTime(order) ? formatKuwaitiDate(getOrderTime(order)).date : 'حديثاً',
    }));
  const frequentOrders = Array.from(cleanHistory.reduce((map: Map<string, any>, order: any) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (!items.length) return map;
    const label = items.slice(0, 2).map((item: any) => item?.name).filter(Boolean).join(' + ') || 'طلب سابق';
    const key = items.map((item: any) => `${item?.id || item?.name}:${item?.quantity || 1}`).sort().join('|') || label;
    const current = map.get(key) || { label, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(order?.total || order?.totalAmount || order?.amount || 0);
    map.set(key, current);
    return map;
  }, new Map<string, any>()).values()).sort((a: any, b: any) => b.count - a.count || b.total - a.total).slice(0, 3);
  const addressBook = Array.from(cleanHistory.reduce((map: Map<string, any>, order: any) => {
    const orderAddress = typeof order?.address === 'object' && order.address ? order.address : {};
    const region = orderAddress.region || order?.region || order?.deliveryInfo?.region || order?.deliveryInfo?.zoneName || '';
    const block = orderAddress.block || '';
    const street = orderAddress.street || '';
    const building = orderAddress.building || '';
    const label = [region, block && `ق${block}`, street, building && `م${building}`].filter(Boolean).join(' - ');
    if (!label) return map;
    const current = map.get(label) || { label, count: 0 };
    current.count += 1;
    map.set(label, current);
    return map;
  }, new Map<string, any>()).values()).sort((a: any, b: any) => b.count - a.count).slice(0, 3);
  const favoriteItem = (() => {
    const counts = new Map<string, number>();
    cleanHistory.forEach((order: any) => (Array.isArray(order?.items) ? order.items : []).forEach((item: any) => {
      const name = String(item?.name || '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + Number(item?.quantity || 1));
    }));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  })();

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  const filteredRegions = regions.filter(
    (r: any) =>
      (r.name || "").toLowerCase().includes(regionSearch.toLowerCase()) ||
      (r.name || "").includes(regionSearch),
  );

  const prepareDiwaniyaSplitMembers = async () => {
    const cleanPhoneForSplit = (value: any) => String(value || "").replace(/[^0-9]/g, "").replace(/^965(?=\d{8}$)/, "").slice(-8);
    const currentSquadId = String(squadInfo?.id || localStorage.getItem("squadId") || "");
    const map = new Map<string, any>();

    const addMembers = (source: any) => {
      if (!Array.isArray(source)) return;
      source.forEach((member: any) => {
        const phone = cleanPhoneForSplit(member?.phone || member?.mobile || member?.customerPhone);
        if (!phone || phone.length < 8) return;
        const name = String(member?.name || member?.customerName || member?.displayName || "عضو").trim() || "عضو";
        map.set(phone, { phone, name });
      });
    };

    addMembers(squadInfo?.membersList);
    addMembers(squadInfo?.participants);
    const activeUserSquad = Array.isArray(userSquads)
      ? userSquads.find((sq: any) => String(sq?.id) === currentSquadId)
      : null;
    addMembers(activeUserSquad?.membersList);

    const customerCleanPhone = cleanPhoneForSplit(customerPhone);
    if (customerCleanPhone) {
      map.set(customerCleanPhone, {
        phone: customerCleanPhone,
        name: String(customerName || squadInfo?.memberData?.name || "أنت").trim() || "أنت",
      });
    }

    if (currentSquadId && customerCleanPhone) {
      try {
        const res = await fetch(`/api/squad-gamification?phone=${encodeURIComponent(customerCleanPhone)}&squadId=${encodeURIComponent(currentSquadId)}`);
        if (res.ok) {
          const data = await res.json();
          addMembers(data?.mySquad?.membersList);
          const apiUserSquad = Array.isArray(data?.userSquads)
            ? data.userSquads.find((sq: any) => String(sq?.id) === currentSquadId)
            : null;
          addMembers(apiUserSquad?.membersList);
        }
      } catch (e) {}
    }

    const members = Array.from(map.values());
    try {
      localStorage.setItem("split_prefill_members", JSON.stringify(members));
      localStorage.setItem("split_prefill_ready", members.length ? "1" : "0");
      localStorage.setItem("split_prefill_source", "diwaniya_checkout");
      localStorage.setItem("split_prefill_squad_id", currentSquadId);
    } catch (e) {}
    return members;
  };

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
        className="checkout-wow-panel bg-[#fafaf9] w-full sm:max-w-[680px] lg:max-w-[820px] h-[100dvh] overflow-hidden shadow-2xl flex flex-col sm:rounded-l-3xl border-l border-stone-100/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="checkout-wow-header p-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] border-b border-stone-50 flex items-center justify-between bg-white shrink-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] z-10 rounded-b-3xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (step === "payment") setStep("delivery");
                else onClose();
              }}
              className="p-3 bg-stone-50 border border-stone-100 rounded-2xl hover:bg-brand hover:text-white hover:-translate-x-1 transition-all shadow-sm"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-brand flex items-center gap-2 tracking-tight mt-1">
                {step === "cart" ? "ملخص الطلب" : step === "payment" ? "طريقة الدفع" : "العنوان"}
              </h2>
            </div>
          </div>
        </div>

        <div className="checkout-wow-body flex-grow overflow-y-auto p-6 space-y-8 no-scrollbar bg-[#fafaf9]">
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
                {squadInfo && (
                  <div className="bg-gradient-to-r from-accent/10 to-transparent border border-accent/20 rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-accent opacity-5 blur-3xl rounded-full translate-x-10 -translate-y-10"></div>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-accent/20 flex items-center justify-center text-accent shrink-0 relative z-10">
                           <Crown className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col relative z-10">
                           <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">ديوانيتك الحالية</span>
                           <span className="text-base font-black text-brand leading-tight">
                              {squadInfo.name}
                           </span>
                           {userSquads && userSquads.length > 1 && (
                              <button onClick={() => setShowSquadModal(true)} className="text-[10px] text-accent underline text-right mt-0.5">
                                 تغيير الديوانية
                              </button>
                           )}
                        </div>
                     </div>
                  </div>
                )}
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
                                +{e.name} {e.price ? `(${e.price} د.ك)` : ''}
                              </span>
                            ),
                          )}
                          {getVisibleAddons(item).map(
                            (addon: any, idx: number) => (
                              <span
                                key={`addon-${addon.addonId}-${idx}`}
                                className="text-[9px] font-bold bg-accent/5 text-accent px-2 py-1 rounded-md border border-accent/10"
                              >
                                +{addon.quantity} {cleanCustomerAddonLabel(addon.name)} {(addon.payableQuantity === 0 || addon.price === 0) && !addon.isHiddenPrice ? '(مجاني)' : addon.price > 0 && !addon.isHiddenPrice ? `(${addon.price} د.ك)` : ''}
                              </span>
                            ),
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-stone-50">
                          <span className="text-[11px] font-bold text-stone-400 leading-[1.6] py-0.5">
                            المجموع الفرعي
                          </span>
                          <span className="text-lg font-medium text-brand">
                            {calculateItemTotalWithAddons(item)}{" "}
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
            <div className={cn("address-wow-step animate-in slide-in-from-left-4 fade-in duration-300 space-y-6 pt-2", customerPhone.length >= 8 && "address-phone-complete")}>
                <div className="space-y-2">
                  <label className="text-sm items-center gap-1.5 font-bold text-stone-700 flex px-1">
                    <Phone className="w-4 h-4 text-accent" /> اكتب رقم تلفونك عشان نكمل الطلب
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="رقم التلفون (8 أرقام)"
                    value={customerPhone}
                    pattern="[0-9]*"
                    onChange={(e) => {
                      const val = normalizeDigits(e.target.value).replace(/[^0-9]/g, "");
                      if (val.length <= 8) {
                        setCustomerPhone(val);
                        if (val.length === 8) {
                          window.setTimeout(() => {
                            const regionEl = document.querySelector('[data-region-field="true"]') as HTMLElement | null;
                            regionEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });
                            regionEl?.focus?.();
                          }, 160);
                        }
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
                    {customerHistoricalOrdersCount > 1 && lastOrderInfo && lastOrderItemsCount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="smart-return-card smart-return-card-visible"
                        dir="rtl"
                      >
                        <div className="smart-return-glow" />
                        <div className="smart-return-icon">
                          <RefreshCcw className={cn("w-5 h-5", isZeroClickLoading && "animate-spin")} />
                        </div>
                        <div className="smart-return-copy">
                          <strong>{customerName ? `حيّاك ${customerName}، نجهز نفس طلبك اللي فات؟` : "حيّاك، نجهز نفس طلبك اللي فات؟"}</strong>
                          <p>
                            اختصار جاهز من آخر طلب: {lastOrderItemsCount} أصناف
                            {lastOrderTotal > 0 ? ` · ${lastOrderTotal.toFixed(3)} د.ك تقريباً` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleZeroClickOrder}
                          disabled={isZeroClickLoading}
                          className="smart-return-action"
                        >
                          {isZeroClickLoading ? "نجهزه..." : "جهز نفس الطلب"}
                        </button>
                      </motion.div>
                    )}
                    {/* Improved Region Selection with Search */}
                  <div className="space-y-1.5 relative">
                    <label className="text-xs sm:text-sm items-center gap-1.5 font-bold text-stone-500 flex px-1 mb-1">
                      <MapPin className="w-4 h-4" /> المنطقة
                    </label>
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          autoFocus
                          placeholder="ابحث عن منطقتك..."
                          data-region-field="true"
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
                            <div className="p-4 text-xs text-red-500 text-center font-extrabold bg-red-50/70 border-b border-red-100">
                              اختار منطقة صحيحة من القائمة
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
                      {address.region && deliveryFee === -1 && !showRegions && (
                        <div className="mt-2 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-[11px] font-extrabold text-red-600 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>اختار منطقة صحيحة من القائمة عشان رسوم التوصيل تطلع صح.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <LeafletLocationPicker
                    value={(address as any)?.location || ((address as any)?.lat && (address as any)?.lng ? { lat: (address as any).lat, lng: (address as any).lng } : null)}
                    onChange={(location) => setAddress((prev: any) => ({
                      ...(prev || address || {}),
                      location,
                      lat: location.lat,
                      lng: location.lng,
                      mapProvider: 'leaflet-openstreetmap',
                    }) as any)}
                    onAddressGuess={(guess) => setAddress((prev: any) => {
                      const current = prev || address || {};
                      const cleanAutoAddressField = (value: any, kind: 'block' | 'street' | 'building') => {
                        let text = String(value ?? '').trim();
                        if (!text) return '';
                        const patterns: Record<typeof kind, RegExp> = {
                          block: /^[\s\u200e\u200f]*(?:قطعة|قطعه|ق\.?|block)\s*[:：#\-–—،,]?\s*/i,
                          street: /^[\s\u200e\u200f]*(?:شارع|ش\.?|street|road|طريق)\s*[:：#\-–—،,]?\s*/i,
                          building: /^[\s\u200e\u200f]*(?:منزل|بيت|مبنى|مبني|بناية|عمارة|م\.?|building|house|home)\s*[:：#\-–—،,]?\s*/i,
                        };
                        let previous = '';
                        while (previous !== text) {
                          previous = text;
                          text = text.replace(patterns[kind], '').trim();
                        }
                        return normalizeDigits(text);
                      };
                      return {
                        ...current,
                        region: guess.region || current.region || '',
                        block: cleanAutoAddressField(guess.block || current.block, 'block'),
                        street: cleanAutoAddressField(guess.street || current.street, 'street'),
                        building: cleanAutoAddressField(guess.building || current.building, 'building'),
                        extraDetails: current.extraDetails || guess.extraDetails || '',
                      } as any;
                    })}
                  />

                  {/* Address Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm items-center gap-1.5 font-bold text-stone-500 flex px-1 mb-1">
                        <Landmark className="w-4 h-4" /> القطعة
                      </label>
                      <input
                        placeholder="القطعة"
                        value={address.block}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            block: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-3 py-3 sm:px-4 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-sm sm:text-base"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm items-center gap-1.5 font-bold text-stone-500 flex px-1 mb-1">
                        <MapPin className="w-4 h-4" /> الشارع
                      </label>
                      <input
                        placeholder="الشارع"
                        value={address.street}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            street: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-3 py-3 sm:px-4 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm items-center gap-1.5 font-bold text-stone-500 flex px-1 mb-1">
                        <Hash className="w-4 h-4" /> الجادة{" "}
                        <span className="text-stone-300 font-normal text-[10px] sm:text-xs">
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
                        className="w-full px-3 py-3 sm:px-4 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-sm sm:text-base"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm items-center gap-1.5 font-bold text-stone-500 flex px-1 mb-1">
                        <Home className="w-4 h-4" /> المنزل
                      </label>
                      <input
                        placeholder="المنزل"
                        value={address.building}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            building: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-3 py-3 sm:px-4 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm items-center gap-1.5 font-bold text-stone-500 flex px-1 mb-1">
                        <Layers className="w-4 h-4" /> الدور{" "}
                        <span className="text-stone-300 font-normal text-[10px] sm:text-xs">
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
                        className="w-full px-3 py-3 sm:px-4 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-sm sm:text-base"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm items-center gap-1.5 font-bold text-stone-500 flex px-1 mb-1">
                        <Hash className="w-4 h-4" /> الشقة{" "}
                        <span className="text-stone-300 font-normal text-[10px] sm:text-xs">
                          (اختياري)
                        </span>
                      </label>
                      <input
                        placeholder="الشقة"
                        value={address.apartment}
                        onChange={(e) =>
                          setAddress({
                            ...address,
                            apartment: normalizeDigits(e.target.value),
                          })
                        }
                        className="w-full px-3 py-3 sm:px-4 sm:py-4 bg-white border border-stone-100 rounded-xl focus:border-accent outline-none transition-all placeholder:text-stone-300 text-brand font-bold text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-4 border-t border-stone-100">
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm items-center gap-1.5 font-bold text-stone-500 flex px-1 mb-1">
                        <User className="w-4 h-4" /> الاسم بالكامل
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="اكتب اسمك"
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
                    <label className="text-xs sm:text-sm font-bold text-stone-500 px-1 mb-1 block">
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
            <div className="payment-wow-step animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col items-center justify-start w-full pt-1 pb-1 px-2">
              <motion.div
                initial={{ opacity: 0, y: 18, rotateX: -8 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="invoice-reveal-stage"
                dir="rtl"
              >
                <div className="invoice-reveal-orbit invoice-reveal-orbit-one" />
                <div className="invoice-reveal-orbit invoice-reveal-orbit-two" />
                <div className="invoice-reveal-paper">
                  <div className="invoice-reveal-topline">
                    <span>لحظة فتح الفاتورة</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3>الفاتورة ترتبت وجاهزة للاختيار</h3>
                  <p>راجع الملخص، وبعدها اختار الطريقة المناسبة لك بدون تغيير على أي خطوة دفع.</p>
                  <div className="invoice-reveal-stats">
                    <div><b>{cart.length}</b><small>أصناف</small></div>
                    <div><b>{address.region || "العنوان"}</b><small>التوصيل</small></div>
                    <div><b>{Number(total || 0).toFixed(3)}</b><small>د.ك</small></div>
                  </div>
                </div>
              </motion.div>
              
              <div className="invoice-payment-divider">
                <div className="h-px bg-stone-100 flex-1"></div>
                <span>اختار شلون حاب تدفع الفاتورة؟</span>
                <div className="h-px bg-stone-100 flex-1"></div>
              </div>
            </div>
          ) : null}
        </div>

        {cart.length > 0 && (
          <div className={`checkout-wow-footer checkout-footer-${step} ${step === "payment" ? "p-4 sm:p-5 space-y-3" : "p-6 space-y-6"} bg-white border-t border-stone-100 shadow-[0_-15px_40px_rgba(0,0,0,0.02)]`}>
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

            {step !== "payment" && (
            <div className="space-y-3 px-1">
              {/* Promo Code Input */}
              {step !== "cart" && (!appliedPromo ? (
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
              ))}

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

              {step !== "cart" && (
                <>
              <div className="flex justify-between items-center text-xs font-bold text-stone-500 pb-3 border-b border-stone-50">
                <span>رسوم التوصيل</span>
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
                  <div className="flex flex-col gap-0.5">
                    <span>رصيد نقاطك</span>
                    {getLoyaltyTier(customerPoints).minPoints > 0 && (
                       <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full w-fit">
                          مستوى {getLoyaltyTier(customerPoints).name}
                       </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1">
                    ⭐ {customerPoints} نقطة
                  </span>
                </div>
              )}
              {/* Expected Points */}
              <div className="flex justify-between items-center text-xs font-bold text-brand/40 pb-3 border-b border-stone-50">
                <span>النقاط المتوقعة من هذا الطلب</span>
                <span className="flex items-center gap-1">
                  + {Math.floor(itemsTotal)} ⚡
                </span>
              </div>
                </>
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
            )}

            {step !== "payment" && cart.some((item) => item.preparationInstructions) && (
              <div className="mt-2.5 p-2 bg-rose-50/40 border border-rose-100/20 rounded-xl flex items-center gap-1.5 text-rose-600 text-[10px] sm:text-xs font-semibold shadow-[0_1px_2px_rgba(244,63,94,0.01)] animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>
                  تنبيه لطيف: الطلب يحتوي على أصناف تتطلب وقتاً إضافياً للتجهيز.
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
                        setFormError("اكتب رقم تلفون صحيح من 8 أرقام");
                      } else if (deliveryFee === -1) {
                        setFormError("اختار منطقة صحيحة من القائمة");
                      } else if (!customerName) {
                        setFormError("اكتب اسمك");
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
                      <span>اكتب رقم تلفون صحيح من 8 أرقام</span>
                    ) : deliveryFee === -1 ? (
                      <span>اختار منطقة التوصيل يالغالي</span>
                    ) : !customerName ? (
                      <span>اكتب بياناتك</span>
                    ) : (
                      <>
                        <Check className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>ادفع الآن</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <>
                <div className="payment-choice-hint" dir="rtl">
                  <strong>اختر طريقة الدفع المناسبة</strong>
                  <span>اسحب أو انزل شوي: الدفع الكامل، القطيّة، ووهق غيرك كلها متاحة هنا.</span>
                </div>
                <div className="payment-method-wow-grid flex flex-col gap-3 animate-in slide-in-from-bottom-4 fade-in duration-500">
                  <button
                    disabled={isSubmitting}
                    onClick={() => onSubmit(false)}
                    className={cn(
                      "payment-method-card payment-method-card-full w-full p-4 sm:p-5 rounded-2xl font-bold flex items-center justify-between gap-3 transition-all active:scale-[0.98] text-lg group text-right",
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
                        <span>نجهز الطلب بأمان...</span>
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
	                        onClick={async () => {
	                          const hasCurrentDiwaniya = Boolean(squadInfo?.id || localStorage.getItem("squadId"));
	                          if (hasCurrentDiwaniya) {
	                            await prepareDiwaniyaSplitMembers();
	                          } else {
	                            try {
	                              localStorage.removeItem("split_prefill_members");
	                              localStorage.removeItem("split_prefill_ready");
	                              localStorage.removeItem("split_prefill_source");
	                              localStorage.removeItem("split_prefill_squad_id");
	                            } catch (e) {}
	                          }
	                          onSubmit("traditional");
	                        }}
                        className="payment-method-card payment-method-card-qatya w-full bg-stone-100 text-brand rounded-2xl p-4 sm:p-5 shadow-sm active:scale-[0.98] transition-all flex items-center justify-between gap-3 font-bold hover:bg-stone-200 text-lg border border-stone-100 text-right"
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
	                        onClick={() => {
	                          try {
	                            localStorage.removeItem("split_prefill_members");
	                            localStorage.removeItem("split_prefill_ready");
	                            localStorage.removeItem("split_prefill_source");
	                            localStorage.removeItem("split_prefill_squad_id");
	                          } catch (e) {}
	                          onSubmit("roulette");
	                        }}
                        className="payment-method-card payment-method-card-wahag w-full bg-fuchsia-600 text-white rounded-2xl p-4 sm:p-5 shadow-md active:scale-[0.98] transition-all flex items-center justify-between gap-3 font-bold hover:bg-fuchsia-700 text-lg text-right"
                      >
                         <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                             <PartyPopper className="w-6 h-6 text-white" />
                           </div>
                           <div className="flex flex-col items-start gap-1">
                             <span className="text-[17px]">وهّق غيرك</span>
                             <span className="text-[10px] font-medium opacity-90 tracking-wide">دخلوا أسماءكم… والنظام يختار من يتحمّل الطلب</span>
                           </div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
                </>
              );
            })()}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// 🧬 Ambient Steam Companion with high-performance Web animations
interface SteamPuff {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  opacity: number;
  size: number;
}

const SteamCompanion: React.FC = () => {
  const [puffs, setPuffs] = useState<SteamPuff[]>([]);

  useEffect(() => {
    // Generate constant ambient gentle steam at the bottom margins
    const interval = setInterval(() => {
      const id = Math.random();
      const startX = Math.random() * window.innerWidth;
      const startY = window.innerHeight - 30;
      setPuffs((prev) => [
        ...prev.slice(-25), // Prevent memory leaks, limit active particles
        {
          id,
          startX,
          startY,
          currentX: startX,
          currentY: startY,
          opacity: 0.12 + Math.random() * 0.12,
          size: 40 + Math.random() * 60
        }
      ]);
    }, 1800);

    // Listen to custom item additions to trigger interactive dancing steam trails
    const handleAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{ x: number; y: number }>;
      const { x, y } = customEvent.detail;
      const count = 10; // multiple particles forming a physical dancing trail
      for (let i = 0; i < count; i++) {
        const id = Math.random() + i;
        const delay = i * 60;
        setTimeout(() => {
          setPuffs((prev) => [
            ...prev,
            {
              id,
              startX: x + (Math.random() - 0.5) * 40,
              startY: y + (Math.random() - 0.5) * 40,
              currentX: x,
              currentY: y,
              opacity: 0.8,
              size: 28 + Math.random() * 20
            }
          ]);
        }, delay);
      }
    };

    document.addEventListener("steam-add-item", handleAdd);

    return () => {
      clearInterval(interval);
      document.removeEventListener("steam-add-item", handleAdd);
    };
  }, []);

  // Frame tick animation update
  useEffect(() => {
    let animId: number;
    const targetX = window.innerWidth / 2; // Floating cart region
    const targetY = window.innerHeight - 80;

    const tick = () => {
      setPuffs((prev) => {
        return prev
          .map((p) => {
            // Ambient particles float straight up, added-item particles dance towards the bottom cart
            const isAmbient = p.opacity < 0.4;
            if (isAmbient) {
              return {
                ...p,
                currentY: p.currentY - 0.7,
                currentX: p.currentX + Math.sin(p.currentY / 30) * 0.4,
                opacity: p.opacity - 0.002
              };
            } else {
              // Interactive trail path interpolation to the cart
              const dx = targetX - p.currentX;
              const dy = targetY - p.currentY;
              return {
                ...p,
                currentX: p.currentX + dx * 0.08 + (Math.random() - 0.5) * 4,
                currentY: p.currentY + dy * 0.08 + (Math.random() - 0.5) * 4,
                opacity: p.opacity - 0.02,
                size: p.size + 0.4
              };
            }
          })
          .filter((p) => p.opacity > 0 && p.currentY > 0);
      });
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {puffs.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full filter blur-[20px]"
          style={{
            left: `${p.currentX}px`,
            top: `${p.currentY}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            background: "radial-gradient(circle, rgba(205,162,80,0.3) 0%, rgba(13,58,34,0.02) 60%, transparent 100%)",
            transform: "translate(-50%, -50%)"
          }}
        />
      ))}
    </div>
  );
};
