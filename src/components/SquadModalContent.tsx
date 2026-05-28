import React from "react";
import { motion } from "motion/react";
import { User, Landmark, Crown, Users, LogIn, DoorOpen, DoorClosed, Trophy, Star, Medal, Target, BrainCircuit } from "lucide-react";
import { cn } from "../utils";
import { robustGetCurrentPosition } from "../utils/geolocation";
import { SaduPresenceRug } from "./SaduPresenceRug";

interface SquadTier {
  id: string;
  name: string;
  minPoints: number;
  maxPoints?: number;
  benefit: string;
  description?: string;
  title?: string;
  icon: string;
  iconType?: string;
  adminColor?: string;
  bg: string;
  color: string;
  image?: string;
  imageUrl?: string;
  badgeColor?: string;
}

interface SquadModalContentProps {
  activeSquadTab: string;
  squadInfo: any;
  SQUAD_TIERS: SquadTier[];
  getSquadTier: (points: number) => SquadTier | null;
  topSquads: any[];
  customerPhone: string;
  customerName: string;
  customerPoints: number;
  LOYALTY_TIERS: any[];
  getLoyaltyTier: (p: number) => any;
  guestName: string;
  setGuestName: (v: string) => void;
  guestPhone: string;
  setGuestPhone: (v: string) => void;
  loginPhone: string;
  setLoginPhone: (v: string) => void;
  isJoiningSquad: boolean;
  setIsJoiningSquad: (v: boolean) => void;
  isCreatingSquad: boolean;
  setIsCreatingSquad: (v: boolean) => void;
  isSubmittingSquad: boolean;
  setIsSubmittingSquad: (v: boolean) => void;
  newSquadName: string;
  setNewSquadName: (v: string) => void;
  setActiveSquadId: (v: string | null) => void;
  setCustomerPhone: (v: string) => void;
  setCustomerName: (v: string) => void;
  setSquadInfo?: (v: any) => void;
  onClearSquadSession?: () => void;
  normalizeDigits: (s: string) => string;
  formatPoints: (n: number) => string;
  handleCreateSquad: () => void;
  handleJoinSquad: (id: string) => void;
  pendingGeofenceRequests?: any[];
  onRefresh?: () => void;
  onPrepareQatya?: (members: any[]) => void;
  userSquads?: any[];
  settings?: any;
  squadPresence?: any[];
  activeGroupOrder?: any;
  activeQatyaOrders?: any[];
  tempCodes?: any[];
  usualOrder?: any;
  squadBeautifulLog?: any;
  diwaniyaNotifications?: any[];
  unreadDiwaniyaNotifications?: number;
  products?: any[];
  onAddToCart?: (item: any, e?: React.MouseEvent) => void;
}

export const SquadModalContent: React.FC<SquadModalContentProps> = ({
  activeSquadTab,
  squadInfo,
  SQUAD_TIERS,
  getSquadTier,
  topSquads,
  customerPhone,
  customerName,
  customerPoints,
  LOYALTY_TIERS,
  getLoyaltyTier,
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  loginPhone,
  setLoginPhone,
  isJoiningSquad,
  setIsJoiningSquad,
  isCreatingSquad,
  setIsCreatingSquad,
  isSubmittingSquad,
  setIsSubmittingSquad,
  newSquadName,
  setNewSquadName,
  setActiveSquadId,
  setCustomerPhone,
  setCustomerName,
  setSquadInfo,
  onClearSquadSession,
  normalizeDigits,
  formatPoints,
  handleCreateSquad,
  handleJoinSquad,
  pendingGeofenceRequests = [],
  onRefresh,
  onPrepareQatya,
  userSquads = [],
  settings,
  squadPresence = [],
  activeGroupOrder = null,
  activeQatyaOrders = [],
  tempCodes = [],
  usualOrder = null,
  squadBeautifulLog = null,
  diwaniyaNotifications = [],
  unreadDiwaniyaNotifications = 0,
  products = [],
  onAddToCart,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [myDiwaniyaTab, setMyDiwaniyaTab] = React.useState<"home" | "manage" | "orders" | "code" | "notifications" | "location">("home");

  // 🧠 AI Co-Host smart state & learning engine (Concise, functional and connected to real products)
  const [aiActiveIndex, setAiActiveIndex] = React.useState(0);
  const [aiIsLearning, setAiIsLearning] = React.useState(false);
  const [aiLearntCount, setAiLearntCount] = React.useState(0);

  const aiProducts = React.useMemo(() => {
    if (!products || products.length === 0) return null;
    
    // Find beautiful real products that match or fall back safely
    const main = products.find((p: any) => p?.name?.includes("مجبوس") || p?.name?.includes("ذبيحة") || p?.name?.includes("لحم")) || products[0];
    const warm = products.find((p: any) => p?.name?.includes("كرك") || p?.name?.includes("شاي") || p?.name?.includes("دلة") || p?.name?.includes("قهوة") || p?.name?.includes("حار")) || products[2] || products[0];
    const dessert = products.find((p: any) => p?.name?.includes("صاج") || p?.name?.includes("ورق عنب") || p?.name?.includes("حلو") || p?.name?.includes("جريش") || p?.name?.includes("هريس") || p?.name?.includes("مربين")) || products[1] || products[0];
    
    return { main, warm, dessert };
  }, [products]);

  const activeRecommendation = React.useMemo(() => {
    if (!aiProducts) {
      return {
        text: "يحلل الجو وتفضيلات الديوانية حالياً لجلب توصية دقيقة للربع...",
        product: null
      };
    }
    
    const { main, warm, dessert } = aiProducts;
    
    switch (aiActiveIndex) {
      case 0:
        return {
          text: "الجو حار (45°م). المعزب يوصي بطبق خفيف ممتاز للرطوبة وتلطيف الجلسة ماليّاً ومذاقيّاً:",
          product: dessert
        };
      case 1:
        return {
          text: "لمتكم عامرة الليلة ومجتمعة. المعزب يقترح صنف الديوانية الشعبي الرئيسي الأكثر طلباً وتوفيراً:",
          product: main
        };
      case 2:
      default:
        return {
          text: "رنة الفنجان تطلب الكرم. المعزب يوصي بطلب وتجهيز النكهة الأصيلة للربع:",
          product: warm
        };
    }
  }, [aiProducts, aiActiveIndex]);

  const cleanPhoneLocal = (ph: string): string => {
    if (!ph) return "";
    let cleaned = String(ph).replace(/[^0-9]/g, "");
    
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, "");
    
    // If it starts with 965 and is longer than 8 digits, chop it off
    if (cleaned.startsWith("965") && cleaned.length > 8) {
      cleaned = cleaned.slice(3);
    }
    
    // Kuwait mobile numbers are 8 digits
    if (cleaned.length >= 8) {
      return cleaned.slice(-8);
    }
    return cleaned;
  };

  const isOwner = Boolean(squadInfo?.phone && customerPhone && cleanPhoneLocal(squadInfo.phone) === cleanPhoneLocal(customerPhone));
  const isCurrentMember = Boolean(squadInfo?.id && (isOwner || (customerPhone && squadInfo?.memberData?.isMember !== false && Boolean(squadInfo?.memberData?.phone || customerPhone))));
  const openQatyaOrder = (activeQatyaOrders || [])[0] || null;
  const openQatyaCount = (activeQatyaOrders || []).length;
  const currentUserRoleLabel = isOwner ? "المعزب" : isCurrentMember ? "عضو" : "ضيف";
  const currentUserRoleTone = isOwner
    ? "bg-amber-50 text-amber-700 border-amber-100"
    : isCurrentMember
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-sky-50 text-sky-700 border-sky-100";
  const activeQatyaPaidAmount = Number(openQatyaOrder?.paidAmount || 0);
  const activeQatyaTotal = Number(openQatyaOrder?.total || 0);
  const activeQatyaRemaining = Math.max(0, Number(openQatyaOrder?.remainingAmount ?? (activeQatyaTotal - activeQatyaPaidAmount)) || 0);
  const activeQatyaProgress = activeQatyaTotal > 0 ? Math.min(100, Math.max(0, (activeQatyaPaidAmount / activeQatyaTotal) * 100)) : 0;
  const preparedQatyaPreview = React.useMemo(() => {
    const map = new Map<string, any>();
    (squadInfo?.membersList || []).forEach((member: any) => {
      const phone = cleanPhoneLocal(String(member?.phone || "")).slice(0, 8);
      if (!phone) return;
      map.set(phone, { phone, name: member?.name || "عضو" });
    });
    const selfPhone = cleanPhoneLocal(customerPhone || guestPhone || loginPhone || "").slice(0, 8);
    if (selfPhone) {
      map.set(selfPhone, {
        phone: selfPhone,
        name: customerName || guestName || squadInfo?.memberData?.name || "أنت",
      });
    }
    return Array.from(map.values());
  }, [cleanPhoneLocal, customerName, customerPhone, guestName, guestPhone, loginPhone, squadInfo?.memberData?.name, squadInfo?.membersList]);
  const handleOpenActiveQatya = (orderId?: string) => {
    const targetId = orderId || openQatyaOrder?.id;
    if (!targetId) return;
    const phone = cleanPhoneLocal(customerPhone || "").slice(-8);
    window.location.href = `/split/${targetId}?phone=${encodeURIComponent(phone)}&tab=payment`;
  };

  // Geofencing states & actions
  const [isRegisteringGeo, setIsRegisteringGeo] = React.useState(false);
  const [geoStatusMsg, setGeoStatusMsg] = React.useState("");
  const [isApproving, setIsApproving] = React.useState<Record<string, boolean>>({});
  const [manualInput, setManualInput] = React.useState("");
  const [showManualInput, setShowManualInput] = React.useState(false);
  const [showResetLocation, setShowResetLocation] = React.useState(false);
  const [geoDistanceTouched, setGeoDistanceTouched] = React.useState(false);

  const clampGeofenceDistance = React.useCallback((value: any, fallback = 100, maxAllowed = 100) => {
    const n = Number(value);
    const limit = Math.max(10, Math.round(Number(maxAllowed) || 100));
    if (!Number.isFinite(n) || n <= 0) return Math.max(10, Math.min(limit, Math.round(Number(fallback) || 100)));
    return Math.max(10, Math.min(limit, Math.round(n)));
  }, []);

  const getSquadOwnGeofenceDistance = React.useCallback(() => {
    let storedDistance: any = undefined;
    try { storedDistance = squadInfo?.id ? localStorage.getItem(`squad_geofence_distance_${squadInfo.id}`) : undefined; } catch(e) {}
    return clampGeofenceDistance(
      squadInfo?.geofenceDistance ??
        storedDistance ??
        squadInfo?.squadGeofenceDistance ??
        squadInfo?.diwaniyaGeofenceDistance ??
        squadInfo?.radarDistance ??
        squadInfo?.location?.geofenceDistance,
      50,
      1000
    );
  }, [
    clampGeofenceDistance,
    squadInfo?.id,
    squadInfo?.geofenceDistance,
    squadInfo?.squadGeofenceDistance,
    squadInfo?.diwaniyaGeofenceDistance,
    squadInfo?.radarDistance,
    squadInfo?.location?.geofenceDistance,
  ]);

  const [localGeofenceDistance, setLocalGeofenceDistance] = React.useState(() => getSquadOwnGeofenceDistance());

  const getRegisteredSquadLat = React.useCallback(() => {
    const raw = squadInfo?.lat ?? squadInfo?.location?.lat ?? squadInfo?.latitude ?? squadInfo?.location?.latitude;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }, [squadInfo?.lat, squadInfo?.location?.lat, squadInfo?.latitude, squadInfo?.location?.latitude]);

  const getRegisteredSquadLng = React.useCallback(() => {
    const raw = squadInfo?.lng ?? squadInfo?.location?.lng ?? squadInfo?.longitude ?? squadInfo?.location?.longitude;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }, [squadInfo?.lng, squadInfo?.location?.lng, squadInfo?.longitude, squadInfo?.location?.longitude]);

  const registeredSquadLat = getRegisteredSquadLat();
  const registeredSquadLng = getRegisteredSquadLng();
  const hasRegisteredSquadLocation = registeredSquadLat !== undefined && registeredSquadLng !== undefined;

  React.useEffect(() => {
    if (!geoDistanceTouched) {
      setLocalGeofenceDistance(getSquadOwnGeofenceDistance());
    }
  }, [getSquadOwnGeofenceDistance, geoDistanceTouched]);

  const parseGoogleMapsInput = (input: string) => {
    // Regex for decimal coordinates: lat, lng
    const coordReg = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    const match = input.match(coordReg);
    if (match) {
      return { lat: Number(match[1]), lng: Number(match[2]) };
    }
    
    // Regex for URLs containing coords
    const urlMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (urlMatch) {
      return { lat: Number(urlMatch[1]), lng: Number(urlMatch[2]) };
    }

    // Try finding search coordinates with "q=lat,lng"
    const qMatch = input.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
    }
    return null;
  };

  const handleManualLocationSubmit = async () => {
    if (!manualInput.trim()) {
      alert("حط الإحداثيات أو رابط خرائط جوجل أول.");
      return;
    }
    
    const coords = parseGoogleMapsInput(manualInput);
    if (!coords) {
      alert("ما قدرنا نطلع الإحداثيات. تأكد من الصيغة أو حط رابط خرائط صحيح.");
      return;
    }

    if (registeredSquadLat !== undefined && registeredSquadLng !== undefined) {
      const diff = calculateDistanceMeters(registeredSquadLat, registeredSquadLng, coords.lat, coords.lng);
      if (diff < 30) {
        setShowResetLocation(false);
        setGeoStatusMsg("أنت بالموقع الحالي للديوانية، ما يحتاج نغيّر اللوكيشن ✅");
        return;
      }
    }

    setIsRegisteringGeo(true);
    setGeoStatusMsg("نحفظ الموقع يدويًا... 💾");
    try {
      const res = await fetch("/api/squad-set-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            squadId: squadInfo.id,
            phone: customerPhone,
            lat: coords.lat,
            lng: coords.lng,
            geofenceDistance: localGeofenceDistance
          })
        });
      if (res.ok) {
        setGeoStatusMsg("تم تسجيل موقع الديوانية الجغرافي بنجاح! 🎉");
        setManualInput("");
        setShowManualInput(false);
        setShowResetLocation(false);
        setSquadInfo?.({
          ...squadInfo,
          lat: coords.lat,
          lng: coords.lng,
          geofenceDistance: localGeofenceDistance,
          squadGeofenceDistance: localGeofenceDistance,
          location: { ...(squadInfo?.location || {}), lat: coords.lat, lng: coords.lng, geofenceDistance: localGeofenceDistance },
        });
        if (onRefresh) onRefresh();
      } else {
        setGeoStatusMsg("ما ضبط التسجيل اليدوي. جرّب بعد شوي.");
      }
    } catch (e) {
      setGeoStatusMsg("الاتصال تعطل وقت حفظ الموقع.");
    }
    setIsRegisteringGeo(false);
  };

  const saveCurrentLocationForSquad = React.useCallback(async (options?: { auto?: boolean; changeCheck?: boolean }) => {
    if (!squadInfo?.id) return;
    if (!navigator.geolocation) {
      const msg = "جهازك لا يدعم نظام تحديد المواقع الجغرافي.";
      if (options?.auto) setGeoStatusMsg(msg); else alert(msg);
      return;
    }

    setIsRegisteringGeo(true);
    setGeoStatusMsg(options?.auto ? "نحاول نثبت موقع ديوانيتك تلقائياً... 📡" : (options?.changeCheck ? "نتأكد من موقعك الحالي قبل تغيير موقع الديوانية... 📡" : "نثبت موقع الديوانية الحالي... 📡"));

    try {
      const position = await robustGetCurrentPosition({
        timeout: options?.changeCheck ? 15000 : 20000,
        enableHighAccuracy: true
      });
      const { latitude, longitude } = position.coords;
      if (registeredSquadLat !== undefined && registeredSquadLng !== undefined) {
        const diff = calculateDistanceMeters(registeredSquadLat, registeredSquadLng, latitude, longitude);
        if (diff < 30) {
          setShowResetLocation(false);
          setGeoStatusMsg("أنت بالموقع الحالي للديوانية، ما يحتاج نغيّر اللوكيشن ✅");
          return;
        }
      }

      const res = await fetch("/api/squad-set-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          squadId: squadInfo.id,
          phone: customerPhone,
          lat: latitude,
          lng: longitude,
          geofenceDistance: localGeofenceDistance
        })
      });
      if (res.ok) {
        setGeoStatusMsg("تم تسجيل موقع الديوانية الجغرافي بنجاح! 🎉");
        setShowResetLocation(false);
        setSquadInfo?.({
          ...squadInfo,
          lat: latitude,
          lng: longitude,
          geofenceDistance: localGeofenceDistance,
          squadGeofenceDistance: localGeofenceDistance,
          location: { ...(squadInfo?.location || {}), lat: latitude, lng: longitude, geofenceDistance: localGeofenceDistance },
        });
        if (onRefresh) window.setTimeout(onRefresh, 100);
      } else {
        setShowResetLocation(true);
        setGeoStatusMsg("ما ضبط التسجيل. جرّب بعد شوي.");
      }
    } catch (err: any) {
      setShowResetLocation(true);
      const code = Number(err?.code || 0);
      if (code === 1) {
        setGeoStatusMsg("الموقع يحتاج سماح. فعّل اللوكيشن من المتصفح أو استخدم الإدخال اليدوي لتثبيت ديوانيتك الحالية.");
      } else if (code === 2) {
        setGeoStatusMsg("المتصفح لم يتمكن من قراءة موقعك حالياً. جرّب مرة ثانية أو استخدم الإدخال اليدوي.");
      } else if (code === 3) {
        setGeoStatusMsg("انتهت مهلة قراءة الموقع. فتح خرائط جوجل أو الإدخال اليدوي يظل متاحاً عند الحاجة.");
      } else {
        setGeoStatusMsg("ما قدرنا نقرأ الموقع الحين. جرّب مرة ثانية أو استخدم الإدخال اليدوي.");
      }
    } finally {
      setIsRegisteringGeo(false);
    }
  }, [squadInfo, customerPhone, onRefresh, setSquadInfo, localGeofenceDistance, registeredSquadLat, registeredSquadLng]);

  const handleRegisterLocation = () => saveCurrentLocationForSquad();

  const autoLocationSquadRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const squadId = squadInfo?.id ? String(squadInfo.id) : "";
    const isOwnerOfCurrent = Boolean(squadInfo?.phone && customerPhone && cleanPhoneLocal(squadInfo.phone) === cleanPhoneLocal(customerPhone));
    const needsLocation = registeredSquadLat === undefined || registeredSquadLng === undefined;
    if (!squadId || !isOwnerOfCurrent || !needsLocation || autoLocationSquadRef.current === squadId) return;
    autoLocationSquadRef.current = squadId;
    saveCurrentLocationForSquad({ auto: true });
  }, [squadInfo?.id, squadInfo?.phone, registeredSquadLat, registeredSquadLng, customerPhone, saveCurrentLocationForSquad]);

  const handleApproveRejectRequest = async (targetPhone: string, approved: boolean) => {
    setIsApproving(prev => ({ ...prev, [targetPhone]: true }));
    try {
      const res = await fetch("/api/squad-geofence-approve-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: targetPhone,
          squadId: squadInfo.id,
          approved
        })
      });
      if (res.ok) {
        if (onRefresh) onRefresh();
      } else {
      alert("ما قدرنا نحدّث الطلب.");
      }
    } catch (e) {
      alert("الاتصال تعطل وقت تحديث الطلب.");
    }
    setIsApproving(prev => ({ ...prev, [targetPhone]: false }));
  };

  const handleShareSquadLink = async () => {
    const link = `https://${window.location.host}/?squadId=${squadInfo?.id}`;
    const shareText = `تعال انضم لديوانيتنا "ديوانية ${cleanSquadName(squadInfo?.name)}" في مطبخ التراث الكويتي وجمع نقاط معنا! عروض وخصومات مميزة بانتظارنا: ${link}`;
    const shareData: ShareData = {
      title: `انضم لديوانية ${cleanSquadName(squadInfo?.name)}`,
      text: shareText,
      url: link,
    };

    try {
      // افتح قائمة المشاركة الأصلية في الجوال حتى تظهر AirDrop / Copy / Share وباقي الخيارات.
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare(shareData))
      ) {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        prompt("رابط الدعوة:", link);
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return;

      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          prompt("رابط الدعوة:", link);
        }
      } catch {
        prompt("رابط الدعوة:", link);
      }
    }
  };

  const toNumber = (value: any): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const normalized = value
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
        .replace(/[^0-9.-]/g, "");
      const n = Number(normalized);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  const resolveTierImage = (tier: any): string => {
    return (
      tier?.imageUrl ||
      tier?.image ||
      tier?.imageURL ||
      tier?.iconUrl ||
      tier?.iconURL ||
      tier?.photoUrl ||
      tier?.photo ||
      tier?.badgeImage ||
      tier?.badgeUrl ||
      tier?.badge ||
      tier?.logo ||
      tier?.levelImage ||
      tier?.tierImage ||
      ""
    );
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
    const iconClass = sizeClass.includes("w-12") ? "w-6 h-6" : "w-5 h-5";
    const content = iconType === "Medal" ? <Medal className={iconClass} />
      : iconType === "Star" ? <Star className={iconClass} />
      : iconType === "Crown" ? <Crown className={iconClass} />
      : iconType === "Trophy" ? <Trophy className={iconClass} />
      : iconType === "Target" ? <Target className={iconClass} />
      : iconType === "Flame" ? <span className="text-xl">🔥</span>
      : iconType === "Swords" ? <span className="text-xl">⚔️</span>
      : iconType === "Diamond" ? <span className="text-xl">💎</span>
      : iconType === "Rocket" ? <span className="text-xl">🚀</span>
      : iconType === "Shield" ? <span className="text-xl">🛡️</span>
      : <Target className={iconClass} />;
    return <span className={`${sizeClass} rounded-full flex items-center justify-center text-white bg-gradient-to-br ${gradient} shrink-0 shadow-sm`}>{content}</span>;
  };

  const normalizeSquadTier = (tier: any, index: number): SquadTier => {
    const fallbackColors = [
      "text-orange-700",
      "text-slate-600",
      "text-yellow-700",
      "text-purple-700",
    ];
    const fallbackBg = [
      "bg-orange-50",
      "bg-slate-50",
      "bg-amber-50",
      "bg-purple-50",
    ];
    const iconByType: Record<string, string> = {
      Medal: "🥉",
      Star: "⭐",
      Crown: "👑",
      Trophy: "🏆",
      Flame: "🔥",
      Swords: "⚔️",
      Diamond: "💎",
      Rocket: "🚀",
      Shield: "🛡️",
    };
    const min = toNumber(
      tier?.minPoints ??
        tier?.pointsRequired ??
        tier?.requiredPoints ??
        tier?.threshold ??
        tier?.points ??
        0,
    );
    const max =
      tier?.maxPoints !== undefined ? toNumber(tier.maxPoints) : undefined;
    return {
      id: String(tier?.id ?? tier?.name ?? index),
      name: tier?.name || tier?.title || "",
      minPoints: min,
      maxPoints: max,
      benefit:
        tier?.benefit || tier?.label || tier?.description || tier?.reward || "",
      description: tier?.description || tier?.label || tier?.benefit || "",
      title: tier?.title || tier?.name || "",
      icon: tier?.icon || iconByType[tier?.iconType] || "",
      iconType: tier?.iconType || getAdminSquadTierIconType(tier),
      adminColor: String(tier?.adminColor || tier?.iconColor || tier?.color || "").includes("from-") ? String(tier?.adminColor || tier?.iconColor || tier?.color) : "from-orange-400 to-orange-600",
      bg: tier?.bg || tier?.bgClass || fallbackBg[index % fallbackBg.length],
      color:
        tier?.textColor ||
        tier?.textClass ||
        tier?.colorClass ||
        (String(tier?.color || "").startsWith("text-")
          ? tier.color
          : fallbackColors[index % fallbackColors.length]),
      image: resolveTierImage(tier),
      imageUrl: resolveTierImage(tier),
      badgeColor: tier?.badgeColor || tier?.color || "",
    };
  };

  const sortedTiers = (SQUAD_TIERS || [])
    .map(normalizeSquadTier)
    .filter((tier) => Boolean(String(tier?.name || "").trim()))
    .sort((a, b) => Number(a.minPoints || 0) - Number(b.minPoints || 0));

  const currentPoints = toNumber(
    squadInfo?.points ??
      squadInfo?.totalPoints ??
      squadInfo?.teamPoints ??
      squadInfo?.score ??
      squadInfo?.balance ??
      squadInfo?.totalOrders ??
      0,
  );

  const currentTier =
    [...sortedTiers]
      .reverse()
      .find((t) => currentPoints >= Number(t.minPoints || 0)) ||
    sortedTiers[0] ||
    null;

  const safePoints = (value: any) => {
    const n = toNumber(value);
    return Number.isFinite(n) ? n : 0;
  };

  const toEnglishDigits = (value: any) => normalizeDigits(String(value ?? ""));
  const formatEnglishNumber = (value: any) => toEnglishDigits(String(value ?? ""));
  const getSquadGeofenceDistance = React.useCallback(() => {
    const candidates = [
      settings?.maxSquadGeofenceDistance,
      settings?.settings?.maxSquadGeofenceDistance,
      settings?.maxDiwaniyaGeofenceDistance,
      settings?.settings?.maxDiwaniyaGeofenceDistance,
      settings?.squadGeofenceDistance,
      settings?.settings?.squadGeofenceDistance,
      settings?.squadSettings?.maxGeofenceDistance,
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
    const allowed = candidates
      .map((value: any) => Number(value))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (allowed.length > 0) return clampGeofenceDistance(Math.max(...allowed), 50, 1000);
    return 50;
  }, [clampGeofenceDistance, settings]);

  React.useEffect(() => {
    if (!geoDistanceTouched || !squadInfo?.id || registeredSquadLat === undefined || registeredSquadLng === undefined) return;
    const nextDistance = clampGeofenceDistance(localGeofenceDistance, getSquadOwnGeofenceDistance(), getSquadGeofenceDistance());
    if (Number(squadInfo?.geofenceDistance) !== nextDistance || Number(squadInfo?.location?.geofenceDistance) !== nextDistance) {
      setSquadInfo?.({
        ...squadInfo,
        geofenceDistance: nextDistance,
        squadGeofenceDistance: nextDistance,
        location: { ...(squadInfo?.location || {}), geofenceDistance: nextDistance },
      });
    }
    const timer = window.setTimeout(async () => {
      try {
        await fetch("/api/squad-set-location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            squadId: squadInfo.id,
            phone: customerPhone,
            lat: registeredSquadLat,
            lng: registeredSquadLng,
            geofenceDistance: nextDistance,
          }),
        });
      } catch {}
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    geoDistanceTouched,
    localGeofenceDistance,
    squadInfo?.id,
    registeredSquadLat,
    registeredSquadLng,
    customerPhone,
    clampGeofenceDistance,
    getSquadOwnGeofenceDistance,
    getSquadGeofenceDistance,
    setSquadInfo,
  ]);

  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const f1 = lat1 * Math.PI / 180;
    const f2 = lat2 * Math.PI / 180;
    const df = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const activeQatyaIds = new Set((activeQatyaOrders || []).map((order: any) => String(order?.id || order?.orderId || "")).filter(Boolean));
  const isQatyaNotification = (notification: any) => {
    const type = String(notification?.type || "");
    return ["qatya_request", "qatya_open", "qatya_payment", "split_payment", "payment_required", "split_payment_required"].includes(type);
  };
  const visibleNotifications = (diwaniyaNotifications || []).filter((n: any) => {
    if (n.readAt) return false;
    const type = String(n?.type || "");
    const orderId = String(n?.meta?.orderId || n?.orderId || "");
    if (isQatyaNotification(n)) {
      if (!activeQatyaIds.size) return false;
      return orderId ? activeQatyaIds.has(orderId) : Boolean(openQatyaOrder);
    }
    if (type === "group_order_open" && !activeGroupOrder) return false;
    return true;
  });
  const hasRealUsualOrder = Boolean(usualOrder?.items?.length && Number(usualOrder?.total || 0) > 0);
  const hasRealBeautifulLog = Boolean(squadBeautifulLog && (Number(squadBeautifulLog.ordersCount || 0) > 0 || Number(squadBeautifulLog.presentCount || 0) > 0 || squadBeautifulLog.favoriteItemName));


  const [isPresenceLoading, setIsPresenceLoading] = React.useState(false);
  const [tempCodeLoading, setTempCodeLoading] = React.useState(false);
  const [activeTempCode, setActiveTempCode] = React.useState<any>(null);
  const [tempJoinCode, setTempJoinCode] = React.useState("");
  const [tempJoinName, setTempJoinName] = React.useState("");
  const [tempJoinPhone, setTempJoinPhone] = React.useState("");
  const [tempCodeNeedsProfile, setTempCodeNeedsProfile] = React.useState(false);
  const [groupOrderLoading, setGroupOrderLoading] = React.useState(false);

  React.useEffect(() => {
    // If a guest/friend comes with a scanned QR Code containing ?code=xxxx, parse and fill it in!
    try {
      const params = new URLSearchParams(window.location.search);
      const guestCode = params.get("code");
      if (guestCode) {
        setTempJoinCode(guestCode);
        setMyDiwaniyaTab("code");
        
        // Remove 'code' from URL quietly to keep window pristine
        params.delete("code");
        const nextUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, "", nextUrl);
      }
    } catch (e) {
      console.warn("Auto-fill code from url failed:", e);
    }
  }, []);

  React.useEffect(() => {
    // Allow guests and owners to access code tab to enter codes or generate codes
    // if (!isOwner && myDiwaniyaTab === "code") setMyDiwaniyaTab("home");
  }, [isOwner, myDiwaniyaTab]);

  React.useEffect(() => {
    if (!squadInfo?.id || !isOwner) return;
    let createdId = "";
    try { createdId = sessionStorage.getItem("created_squad_needs_location") || ""; } catch(e) {}
    if (createdId && String(createdId) === String(squadInfo.id)) {
      setMyDiwaniyaTab("location");
      setShowResetLocation(false);
      setGeoStatusMsg("تم تأسيس الديوانية. فعّل الموقع الآن حتى تظهر للربع القريبين منك.");
      try { sessionStorage.removeItem("created_squad_needs_location"); } catch(e) {}
    }
  }, [squadInfo?.id, isOwner]);

  const handleLoginByPhone = async () => {
    const rawPhone = loginPhone || guestPhone || "";
    if (!rawPhone || !rawPhone.trim()) {
      alert("⚠️ يرجى كتابة رقم التلفون أولاً لتتمكن من الدخول إلى ديوانيتك.");
      return;
    }

    // Comprehensive cleaning of the input phone number
    let cleaned = normalizeDigits(rawPhone).replace(/[^0-9]/g, "");
    
    // Auto-strip country code +965 or 00965 or leading 965 if it makes it longer than 8 digits
    if (cleaned.startsWith("00965") && cleaned.length > 8) {
      cleaned = cleaned.slice(5);
    } else if (cleaned.startsWith("965") && cleaned.length > 8) {
      cleaned = cleaned.slice(3);
    }
    
    // Strip leading zeros
    cleaned = cleaned.replace(/^0+/, "");

    if (cleaned.length < 8) {
      alert(`⚠️ الرقم الذي أدخلته غير مكتمل أو غير صحيح (${rawPhone}).\n\nيرجى كتابة رقم تلفون كويتي صحيح مكون من 8 أرقام لنتمكن من البحث عن ديوانيتك.`);
      return;
    }

    // Grab the actual 8 digits
    const finalPhone = cleaned.slice(-8);

    try {
      const res = await fetch(`/api/squad-gamification?phone=${encodeURIComponent(finalPhone)}`);
      
      if (!res.ok) {
        alert("⚠️ حدث خطأ أثناء الاتصال بالخادم للتأكد من الموضع. يرجى المحاولة بعد قليل.");
        return;
      }
      
      const data = await res.json();
      const foundSquads = Array.isArray(data?.userSquads) ? data.userSquads : [];
      
      if (!foundSquads.length) {
        setGuestPhone(finalPhone);
        setLoginPhone(finalPhone);
        alert(`❌ لم نجد أي ديوانية مسجلة للرقم (${finalPhone}) حالياً.\n\nتأكد من كتابة الرقم الصحيح أو:\n1. اطلب كود الدخول المؤقت من معزب ديوانيتك.\n2. أو أسس ديوانية جديدة للربع الآن بالخطوات في الأسفل!`);
        return;
      }
      
      setCustomerPhone(finalPhone);
      setGuestPhone(finalPhone);
      setLoginPhone(finalPhone);
      
      const firstSquadId = String(foundSquads[0]?.id || "");
      setActiveSquadId(firstSquadId);
      if (setSquadInfo) setSquadInfo(null);
      
      try {
        localStorage.setItem("customer_phone_track", finalPhone);
        if (firstSquadId) localStorage.setItem("squadId", firstSquadId);
        else localStorage.removeItem("squadId");
        localStorage.removeItem("radar_dismissed_squads");
      } catch(e) {}
      
      if (onRefresh) window.setTimeout(onRefresh, 80);
      alert(`✅ تم الدخول بنجاح!\nمرحباً بك في ديوانية "${foundSquads[0].name}".`);
    } catch(e) {
      alert("⚠️ تعذر الاتصال بالشبكة حالياً. تأكد من اتصالك بالإنترنت وحاول مجدداً.");
    }
  };

  const startCreateNewSquad = () => {
    setIsCreatingSquad(true);
    setIsJoiningSquad(false);
    setNewSquadName("");
    if (customerPhone && !guestPhone) setGuestPhone(customerPhone);
    if (customerName && !guestName) setGuestName(customerName);
  };

  const currentMemberPhone = customerPhone || guestPhone;
  const isPresentNow = squadPresence.some((p: any) => cleanPhoneLocal(p.phone) === cleanPhoneLocal(currentMemberPhone));
  const presentMembers = squadPresence.filter((p: any) => p?.phone);
  const squadMembersForSplit = (squadInfo?.membersList || []).map((m: any) => ({ name: m.name || "عضو", phone: m.phone })).filter((m:any)=>m.phone);

  const handlePresenceToggle = async (action: "in" | "out") => {
    if (!squadInfo?.id || !currentMemberPhone) {
      alert("حط رقم تلفونك أول عشان نثبت حضورك بالديوانية.");
      return;
    }
    setIsPresenceLoading(true);
    try {
      const res = await fetch("/api/squad-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squadId: squadInfo.id, phone: currentMemberPhone, name: customerName || guestName || "عضو", action })
      });
      if (res.ok && onRefresh) onRefresh();
      else alert("ما قدرنا نحدّث حضورك الحين.");
    } catch { alert("الاتصال تعطل وقت تحديث الحضور."); }
    setIsPresenceLoading(false);
  };

  const handleWobbleAction = async (msg: string) => {
    if (!squadInfo?.id || !currentMemberPhone) return;
    try {
      const res = await fetch("/api/squad-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          squadId: squadInfo.id, 
          phone: currentMemberPhone, 
          name: customerName || guestName || "عضو", 
          action: "wobble",
          message: msg
        })
      });
      if (res.ok && onRefresh) onRefresh();
    } catch (e) {
      console.error("Wobble sync failed:", e);
    }
  };

  const handleCreateTempCode = async () => {
    if (!squadInfo?.id || !customerPhone) return;
    setTempCodeLoading(true);
    try {
      const res = await fetch("/api/squad-temp-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squadId: squadInfo.id, phone: customerPhone })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveTempCode(data);
        if (onRefresh) onRefresh();
      } else alert(data?.error || "ما قدرنا ننشئ كود مؤقت.");
    } catch { alert("الاتصال تعطل وقت إنشاء الكود."); }
    setTempCodeLoading(false);
  };

  const handleJoinWithTempCode = async () => {
    const cleanCode = tempJoinCode.trim();
    const cleanTempPhone = cleanPhoneLocal(normalizeDigits(tempJoinPhone || guestPhone || loginPhone || currentMemberPhone || "")).slice(0, 8);
    const finalName = (tempJoinName || guestName || customerName || "").trim();

    if (!cleanCode) {
      alert("حط كود الديوانية أول.");
      return;
    }

    if (!cleanTempPhone || cleanTempPhone.length !== 8 || !finalName) {
      setTempCodeNeedsProfile(true);
      alert("الكود مضبوط. حط اسمك ورقم تلفونك ونكمل دخولك للديوانية.");
      return;
    }

    setTempCodeLoading(true);
    try {
      const res = await fetch("/api/squad-join-temp-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode, phone: cleanTempPhone, name: finalName })
      });
      const data = await res.json();
      if (res.ok) {
        setCustomerPhone(cleanTempPhone);
        setCustomerName(finalName);
        setGuestPhone(cleanTempPhone);
        setGuestName(finalName);
        try { localStorage.setItem("customer_phone_track", cleanTempPhone); } catch(e) {}
        setActiveSquadId(String(data.squad.id));
        setTempCodeNeedsProfile(false);
        if (onRefresh) onRefresh();
      } else {
        alert(data?.error || "الكود غير صحيح أو انتهت صلاحيته.");
      }
    } catch { alert("الاتصال تعطل وقت استخدام الكود."); }
    setTempCodeLoading(false);
  };

  const handleOpenGroupOrder = async () => {
    if (!squadInfo?.id || !currentMemberPhone) return;
    setGroupOrderLoading(true);
    try {
      const res = await fetch("/api/squad-group-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squadId: squadInfo.id, phone: currentMemberPhone, name: customerName || guestName || "عضو", action: "open", participants: squadMembersForSplit, title: `طلب الربع - ${cleanSquadName(squadInfo.name)}` })
      });
      if (res.ok) {
        try { localStorage.setItem("split_prefill_members", JSON.stringify(squadMembersForSplit)); } catch {}
        if (onRefresh) onRefresh();
      } else alert("ما قدرنا نفتح طلب الربع.");
    } catch { alert("الاتصال تعطل وقت فتح طلب الربع."); }
    setGroupOrderLoading(false);
  };


  const getPreparedQatyaMembers = React.useCallback(() => {
    const source = Array.isArray(activeGroupOrder?.participants) && activeGroupOrder.participants.length
      ? activeGroupOrder.participants
      : squadMembersForSplit;
    const map = new Map<string, any>();
    source.forEach((member: any) => {
      const phone = cleanPhoneLocal(String(member?.phone || "")).slice(0, 8);
      if (!phone) return;
      map.set(phone, { phone, name: member?.name || "عضو" });
    });
    return Array.from(map.values());
  }, [activeGroupOrder, squadMembersForSplit]);

  const handlePrepareQatya = React.useCallback(() => {
    const members = getPreparedQatyaMembers();
    try {
      localStorage.setItem("split_prefill_members", JSON.stringify(members));
      localStorage.setItem("split_prefill_ready", "1");
      localStorage.setItem("split_prefill_source", "diwaniya_checkout");
      if (squadInfo?.id) localStorage.setItem("split_prefill_squad_id", String(squadInfo.id));
    } catch {}

    if (onPrepareQatya) {
      onPrepareQatya(members);
      return;
    }

    alert(members.length
      ? "جهزنا أسماء وأرقام الربع للقطية."
      : "جهزنا القطيّة، أضف الربع عند صفحة الدفع.");
  }, [getPreparedQatyaMembers, onPrepareQatya]);

  const handleGuestPrepareQatya = React.useCallback(() => {
    const guestCleanPhone = cleanPhoneLocal(normalizeDigits(guestPhone || loginPhone || customerPhone || "")).slice(0, 8);
    const guestCleanName = String(guestName || customerName || "").trim();

    if (!guestCleanName || guestCleanPhone.length !== 8) {
      alert("اكتب اسمك ورقمك 8 أرقام عشان نجهز قطية ضيف باسمك.");
      return;
    }

    setGuestName(guestCleanName);
    setGuestPhone(guestCleanPhone);
    setCustomerName(guestCleanName);
    setCustomerPhone(guestCleanPhone);

    const membersMap = new Map<string, any>();
    getPreparedQatyaMembers().forEach((member: any) => {
      const phone = cleanPhoneLocal(String(member?.phone || "")).slice(0, 8);
      if (!phone) return;
      membersMap.set(phone, { phone, name: member?.name || "عضو" });
    });
    membersMap.set(guestCleanPhone, { phone: guestCleanPhone, name: guestCleanName || "ضيف" });

    const members = Array.from(membersMap.values());
    try {
      localStorage.setItem("customer_phone_track", guestCleanPhone);
      if (squadInfo?.id) localStorage.setItem("squadId", String(squadInfo.id));
      localStorage.setItem("split_prefill_members", JSON.stringify(members));
      localStorage.setItem("split_prefill_ready", "1");
      localStorage.setItem("split_prefill_source", "diwaniya_guest_qatya");
    } catch {}

    if (onPrepareQatya) {
      onPrepareQatya(members);
      return;
    }

    alert("جهزنا قطية الضيف. اختار الأصناف وبعدها دش السلة واختار القطيّة.");
  }, [
    cleanPhoneLocal,
    customerName,
    customerPhone,
    getPreparedQatyaMembers,
    guestName,
    guestPhone,
    loginPhone,
    normalizeDigits,
    onPrepareQatya,
    setCustomerName,
    setCustomerPhone,
    setGuestName,
    setGuestPhone,
    squadInfo?.id,
  ]);

  const handleCloseGroupOrder = async () => {
    if (!squadInfo?.id || !currentMemberPhone) return;
    setGroupOrderLoading(true);
    try {
      const res = await fetch("/api/squad-group-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squadId: squadInfo.id, phone: currentMemberPhone, action: "close" })
      });
      if (res.ok && onRefresh) onRefresh();
    } catch {}
    setGroupOrderLoading(false);
  };

  const markDiwaniyaNotificationsRead = async (notificationId?: string) => {
    if (!currentMemberPhone) return;
    try {
      await fetch("/api/diwaniya-notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: currentMemberPhone, notificationId, all: !notificationId })
      });
      if (onRefresh) onRefresh();
    } catch {}
  };

  const openDiwaniyaNotification = async (notification: any) => {
    await markDiwaniyaNotificationsRead(notification?.id);
    const type = String(notification?.type || "");
    const orderId = notification?.meta?.orderId || notification?.orderId;
    const directUrl = notification?.meta?.url || notification?.url;
    if ((type === "qatya_request" || type === "split_payment" || type === "payment_required") && orderId) {
      const phone = cleanPhoneLocal(currentMemberPhone || "").slice(-8);
      window.location.href = `/split/${orderId}?phone=${encodeURIComponent(phone)}&tab=payment`;
      return;
    }
    if ((type === "qatya_request" || type === "split_payment" || type === "payment_required") && directUrl) {
      window.location.href = directUrl;
      return;
    }
    if (type === "join_request" || type === "radar_join_request") {
      setMyDiwaniyaTab("location");
      return;
    }
    if (type === "group_order_open") {
      setMyDiwaniyaTab("orders");
      return;
    }
    setMyDiwaniyaTab("home");
  };

  const notificationIcon = (type: string) => {
    if (type === "join_request") return "🚪";
    if (type === "join_approved") return "🎉";
    if (type === "group_order_open") return "🍽️";
    if (type === "presence_in") return "👋";
    if (type === "temp_code") return "🔐";
    return "🔔";
  };

  const handleAddAiProductToCart = (prod: any) => {
    if (!prod) return;
    if (onAddToCart) {
      onAddToCart({
        id: Date.now().toString() + Math.random(),
        productId: prod.id,
        name: prod.name,
        price: prod.price || 0,
        quantity: 1,
        selectedOption: prod.options?.[0] || "",
        selectedExtras: [],
      });
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 25, 40]);
      }
      alert(`تم إضافة "${prod.name}" لطلب الربع بنجاح! 🥳🧉`);
      
      setAiIsLearning(true);
      setTimeout(() => {
        setAiActiveIndex((prev) => (prev + 1) % 3);
        setAiLearntCount((prev) => prev + 1);
        setAiIsLearning(false);
      }, 750);
    } else {
      alert("الطلب الجماعي جاهز للتعديل! اضغط الصنب من المنيو بالخارج أو تواصل مع المعزب.");
    }
  };

  const handleAiChange = () => {
    setAiIsLearning(true);
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(30);
    }
    setTimeout(() => {
      setAiActiveIndex((prev) => (prev + 1) % 3);
      setAiLearntCount((prev) => prev + 1);
      setAiIsLearning(false);
    }, 700);
  };

  const cleanSquadName = (name: any) => {
    const raw = String(name || "").trim();
    return (
      raw.replace(/^(ديوانيتي\s*)?(ديوانية\s*)+/i, "").trim() || raw || "ربعكم"
    );
  };

  return (
    <div
      className="squad-luxury flex flex-col gap-6"
      id="squad-content-container"
    >
      {activeSquadTab === "overview" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
          {squadInfo && isCurrentMember && (
            <div className="squad-stable-tabs bg-white/90 border border-stone-100 rounded-[28px] p-2 shadow-sm relative z-10 backdrop-blur-xl">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center" dir="rtl">
                {[
                  { id: "home", label: "الرئيسية", icon: "🏠" },
                  { id: "manage", label: "دواويني", icon: "🛖" },
                  { id: "orders", label: "الطلبات", icon: "🍽️" },
                  ...(isOwner ? [{ id: "code", label: "الكود", icon: "🔐" }] : []),
                  { id: "location", label: "الموقع", icon: "📍" },
                  { id: "notifications", label: "تنبيهات", icon: "🔔", badge: unreadDiwaniyaNotifications },
                ].map((tab: any) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMyDiwaniyaTab(tab.id)}
                    className={cn(
                      "relative rounded-2xl px-2 py-2.5 text-[10px] font-black transition-all leading-tight min-h-[58px]",
                      myDiwaniyaTab === tab.id
                        ? "bg-brand text-white shadow-md scale-[1.02]"
                        : "bg-stone-50 text-stone-500 border border-stone-100"
                    )}
                  >
                    <span className="block text-base mb-0.5">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center">
                        {formatEnglishNumber(tab.badge)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {myDiwaniyaTab === "home" && !isCreatingSquad && squadInfo && isCurrentMember && (
            <div className="rounded-[30px] border border-amber-100 bg-gradient-to-br from-white via-amber-50/40 to-white p-5 shadow-sm text-right font-sans mb-3" dir="rtl">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-2xl bg-brand text-white px-3 py-1.5 text-[10px] font-black shadow-sm">ديوانيتك الحالية</span>
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-brand truncate">{cleanSquadName(squadInfo?.name)}</h3>
                  <p className="mt-1 text-[11px] font-bold text-stone-400">المستوى: {currentTier?.name || 'مستوى الديوانية'} · رصيدك {formatEnglishNumber(customerPoints || 0)} نقطة</p>
                </div>
              </div>
            </div>
          )}

          {customerPhone && myDiwaniyaTab === "notifications" && visibleNotifications.length > 0 && (
            <div className="bg-white rounded-[30px] border border-amber-100 shadow-sm p-5 text-right space-y-3 font-sans">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => markDiwaniyaNotificationsRead()}
                  className="text-[10px] font-black text-stone-400 bg-stone-50 px-3 py-1.5 rounded-xl active:scale-95"
                >
                  تحديد الكل كمقروء
                </button>
                <div>
                  <h4 className="text-base font-black text-brand flex items-center justify-end gap-2">
                    تنبيهات الديوانية
                    {unreadDiwaniyaNotifications > 0 && (
                      <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">{unreadDiwaniyaNotifications}</span>
                    )}
                  </h4>
                  <p className="text-[10px] font-bold text-stone-400">كل شي يخص الربع والدخول والقطيّة، بدون زحمة.</p>
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {visibleNotifications.slice(0, 12).map((n: any) => (
                  <button
                    key={n.id}
                    onClick={() => openDiwaniyaNotification(n)}
                    className={cn(
                      "w-full p-3 rounded-2xl border text-right flex items-start justify-between gap-3 transition-all active:scale-[0.99]",
                      "bg-amber-50 border-amber-200 shadow-sm"
                    )}
                  >
                    <span className="text-xl shrink-0">{notificationIcon(n.type)}</span>
                    <div className="flex-1">
                      <div className="text-xs font-black text-brand">{n.title}</div>
                      <div className="text-[10px] font-bold text-stone-500 leading-relaxed mt-1">{n.message}</div>
                      <div className="text-[9px] font-black text-stone-300 mt-1">{n.squadName ? `ديوانية ${cleanSquadName(n.squadName)}` : "تنبيه من الديوانية"}</div>
                    </div>
                    {!n.readAt && <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {myDiwaniyaTab === "notifications" && visibleNotifications.length === 0 && customerPhone && (
            <div className="bg-white rounded-[30px] border border-stone-100 shadow-sm p-6 text-center text-right font-sans">
              <div className="text-3xl mb-2">🔔</div>
              <h4 className="text-sm font-black text-brand">ما عندك إشعارات جديدة</h4>
              <p className="text-[11px] font-bold text-stone-400 mt-1">أي شي جديد من الربع يطلع هني بهدوء.</p>
            </div>
          )}

          {!isCreatingSquad && squadInfo && isCurrentMember && myDiwaniyaTab !== "notifications" && (
            <div className="grid gap-3 text-right font-sans">
	              {myDiwaniyaTab === "home" && (
                <div className="space-y-4">
                  <div className="rounded-[26px] border border-stone-100 bg-white/90 p-4 shadow-sm" dir="rtl">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handlePresenceToggle(isPresentNow ? "out" : "in")}
                        disabled={isPresenceLoading}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black border shadow-sm active:scale-95 disabled:opacity-50 transition-all shrink-0",
                          isPresentNow
                            ? "bg-white text-stone-700 border-stone-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100"
                        )}
                      >
                        {isPresentNow ? <DoorClosed className="w-4 h-4" /> : <DoorOpen className="w-4 h-4" />}
                        <span>{isPresentNow ? "طلعت من الديوانية" : "وصلت الديوانية"}</span>
                      </button>
                      <div className="text-right min-w-0">
                        <div className="text-[10px] font-black text-stone-400">حضورك الحالي</div>
                      </div>
                    </div>
                  </div>

                  {/* Sadu Rug - سجادة السدو الكويتية الحية */}
                  <SaduPresenceRug
                    presentMembers={presentMembers}
                    pendingGeofenceRequests={pendingGeofenceRequests}
                    currentMemberPhone={currentMemberPhone}
                    squadInfo={squadInfo}
                    onWobbleAction={handleWobbleAction}
                    isOwner={isOwner}
                  />
                </div>
              )}

              {myDiwaniyaTab === "orders" && <div className="bg-white p-5 rounded-[30px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black bg-accent/10 text-accent px-3 py-1 rounded-full">طلب الربع + قطية</span>
                  <h4 className="text-sm font-black text-brand">تنسيق طلب الربع</h4>
                </div>
                <p className="text-[11px] font-bold text-stone-500 leading-relaxed">اختار الأصناف، وإذا وصلت للقطيّة تلقى الربع جاهزين بدون تكرار أسماء أو أرقام.</p>
                
                {/* 🧠 معزب الذكاء الاصطناعي الودود - مدمج بذكاء مع المنتجات الحقيقية ويتعلم من الاختيارات */}
                <div className="bg-gradient-to-br from-amber-500/[0.06] via-amber-600/[0.01] to-stone-50/10 border border-amber-500/15 rounded-3xl p-4 text-right space-y-3 relative overflow-hidden shadow-inner">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 blur-xl rounded-full pointer-events-none" />
                  
                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    {/* Level / Learning status */}
                    <span className="text-[9px] font-black text-amber-600 bg-amber-500/10 py-1 px-2.5 rounded-full animate-pulse">
                      {aiLearntCount === 0 ? "الذكاء يتعلم ذوقكم 🧬" : `تم استيعاب ${aiLearntCount} من تفضيلات الربع! 🧠`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-amber-500/10 text-amber-600 rounded-lg">
                        <BrainCircuit className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-black text-amber-500">معزب الذكاء الاصطناعي</span>
                    </div>
                  </div>

                  {aiIsLearning ? (
                    <div className="py-4 flex flex-col items-center justify-center space-y-2 text-center">
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-black text-stone-500 animate-pulse">المعزب يعيد ضبط حساباته ويستخلص التفضيل التالي للربع...</span>
                    </div>
                  ) : (
                    <>
                      {/* Short Recommendation Text */}
                      <p className="text-[10.5px] text-stone-600 font-bold leading-relaxed">
                        {activeRecommendation.text}
                      </p>

                      {/* Real Connected Product Banner */}
                      {activeRecommendation.product ? (
                        <div className="flex items-center justify-between p-2.5 bg-white border border-amber-500/15 rounded-2xl gap-3">
                          <div className="flex items-center gap-2 text-right">
                            {activeRecommendation.product.image && (
                              <img
                                src={activeRecommendation.product.image}
                                alt={activeRecommendation.product.name}
                                className="w-10 h-10 rounded-xl object-cover border border-stone-100"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div>
                              <div className="text-[10.5px] font-black text-stone-850 line-clamp-1">{activeRecommendation.product.name}</div>
                              <div className="text-[9.5px] font-bold text-amber-600">
                                {Number(activeRecommendation.product.price || 0).toFixed(3)} د.ك
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions Inside Banner */}
                          <div className="flex gap-1 items-center">
                            <button
                              type="button"
                              onClick={() => handleAddAiProductToCart(activeRecommendation.product)}
                              className="bg-amber-500 hover:bg-amber-600 text-stone-950 px-3 py-1.5 rounded-xl text-[9.5px] font-black transition-all active:scale-95 shadow-sm"
                            >
                              إضافة فوريّة 🛒
                            </button>
                            <button
                              type="button"
                              onClick={handleAiChange}
                              className="bg-stone-50 hover:bg-stone-100 text-stone-400 p-1.5 rounded-xl border border-stone-200 text-[9.5px]"
                              title="تخطي ليتعلم المعزب ذوقك"
                            >
                              🔄
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-stone-400 text-center py-2">لا توجد منتجات متاحة بالتوصية حالياً.</div>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-[24px] border border-stone-100 bg-stone-50/80 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className={cn("rounded-full border px-3 py-1 text-[10px] font-black", currentUserRoleTone)}>{currentUserRoleLabel}</span>
                    <div className="text-right">
                      <div className="text-sm font-black text-brand">مراجعة قبل القطيّة</div>
                      <div className="text-[10px] font-bold text-stone-400">تأكيد سريع قبل فتح القطيّة، حتى تبدأ وأنت مرتّب.</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-white border border-stone-100 p-3">
                      <div className="text-[9px] font-black text-stone-400">الديوانية</div>
                      <div className="text-xs font-black text-brand truncate">{cleanSquadName(squadInfo?.name)}</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-stone-100 p-3">
                      <div className="text-[9px] font-black text-stone-400">الأسماء الجاهزة</div>
                      <div className="text-xs font-black text-brand">{formatEnglishNumber(preparedQatyaPreview.length)}</div>
                    </div>
                    <div className="rounded-2xl bg-white border border-stone-100 p-3">
                      <div className="text-[9px] font-black text-stone-400">الحالة</div>
                      <div className="text-xs font-black text-brand">{activeGroupOrder ? "طلب مفتوح" : openQatyaOrder ? "قطية مفتوحة" : "جاهز"}</div>
                    </div>
                  </div>
                </div>
                {activeGroupOrder ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-[10px] font-black text-emerald-700">مفتوح الآن</span><strong className="text-xs text-brand">{activeGroupOrder.title || "طلب مفتوح"}</strong></div>
                    <div className="text-[10px] font-bold text-stone-500">المشاركين الجاهزين للقطية: {(activeGroupOrder.participants || squadMembersForSplit).length}</div>
                    <div className="flex gap-2"><button onClick={handlePrepareQatya} className="flex-1 bg-brand text-white rounded-xl py-2 text-[10px] font-black">جهّز القطية</button><button onClick={handleCloseGroupOrder} disabled={groupOrderLoading} className="flex-1 bg-stone-100 text-stone-500 rounded-xl py-2 text-[10px] font-black">إغلاق الطلب</button></div>
                  </div>
                ) : <button onClick={handleOpenGroupOrder} disabled={groupOrderLoading} className="w-full bg-brand text-white rounded-2xl py-3 text-xs font-black shadow-md active:scale-95">افتح طلب للربع</button>}
                {hasRealUsualOrder && <button onClick={() => alert("الطلب المعتاد جاهز كفكرة عرض داخل الديوانية، وربطه بالسلة يحتاج مسار إضافة الأصناف للسلة في صفحة الطلب.")} className="w-full bg-stone-50 text-brand border border-stone-100 rounded-2xl py-3 text-xs font-black">كرر الطلب المعتاد للديوانية ({usualOrder.items.length} أصناف)</button>}
              </div>}

              {myDiwaniyaTab === "code" && <div className="bg-white p-5 rounded-[30px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">صالح ساعتين</span>
                  <div className="text-right">
                    <h4 className="text-base font-black text-brand">الكود السريع</h4>
                    <p className="text-[10px] font-bold text-stone-400 mt-0.5">أنشئ كود للضيف أو دش كود ديوانية ثانية.</p>
                  </div>
                </div>

                {isOwner && (
                  <div className="rounded-[24px] border border-amber-100 bg-amber-50/45 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black bg-white text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">للمعزب</span>
                      <h5 className="text-sm font-black text-brand">إنشاء كود دخول</h5>
                    </div>
                    <button onClick={handleCreateTempCode} disabled={tempCodeLoading} className="w-full bg-brand hover:bg-accent text-white rounded-2xl py-4 text-sm font-black shadow-md active:scale-95 transition-all">
                      {tempCodeLoading ? "نجهز الكود..." : "إنشاء كود دخول للضيف 🔐"}
                    </button>
                    {(activeTempCode?.code || tempCodes[0]?.code) ? (
                      <div className="text-center bg-white rounded-3xl p-5 border border-amber-100 space-y-4">
                        <div>
                          <div className="text-[10px] font-black text-stone-400 mb-2">الكود الفوري الحالي</div>
                          <div className="inline-flex bg-stone-50 border border-amber-100 rounded-2xl px-5 py-3 text-3xl font-black tracking-[0.3em] text-brand shadow-nm" dir="ltr">
                            {activeTempCode?.code || tempCodes[0]?.code}
                          </div>
                          <p className="text-[9.5px] font-bold text-stone-400 mt-2">أرسل الكود للضيف، صالح لمدة ساعتين.</p>
                        </div>
                        
                        {/* QR Code Presentation */}
                        <div className="border-t border-dashed border-stone-100 pt-3 flex flex-col items-center">
                          <span className="text-[10px] font-black text-amber-600 mb-2 flex items-center gap-1">
                            📱 رمز الـ QR للدخول الفوري المقرون بالرابط
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const activeCode = activeTempCode?.code || tempCodes[0]?.code;
                              const qrUrl = `${window.location.origin}${window.location.pathname}?code=${activeCode}`;
                              if (typeof navigator !== "undefined" && navigator.clipboard) {
                                navigator.clipboard.writeText(qrUrl);
                                alert("تم نسخ رابط الانضمام التلقائي السريع للديوانية! 📋✨");
                              }
                            }}
                            className="bg-stone-50 hover:bg-stone-100 p-2.5 rounded-2xl border border-stone-100 relative group transition-all active:scale-[0.98] flex items-center justify-center cursor-pointer"
                            title="اضغط لنسخ رابط الدخول السريع"
                          >
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?code=${activeTempCode?.code || tempCodes[0]?.code}`)}`}
                              alt="سكان كود الدخول"
                              className="w-28 h-28 rounded-lg shadow-inner filter contrast-[1.08]"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-stone-900/10 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <span className="bg-brand/90 text-white text-[8px] font-black px-2 py-1 rounded-lg">إضغط لنسخ الرابط 📋</span>
                            </div>
                          </button>
                          <p className="text-[9.5px] text-stone-400 font-bold mt-2.5 leading-relaxed">
                            يقدر ضيفك يمسح الكود بكاميرا تلفونه ويدخل ديوانية "{cleanSquadName(squadInfo?.name)}" تلقائياً وبسهولة بضمة واحدة!
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-amber-100 rounded-2xl p-4 text-center text-[11px] font-bold text-stone-500">
                        اضغط إنشاء كود وسيتولد رمز الـ QR الكود فوراً ومعه الرابط السريع للربع.
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-[24px] border border-brand/10 bg-brand/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black bg-brand/10 text-brand px-2.5 py-1 rounded-full border border-brand/10">دخول سريع</span>
                    <h5 className="text-sm font-black text-brand">عندك كود ديوانية؟</h5>
                  </div>
                  <p className="text-[11px] font-bold text-stone-500 leading-relaxed">حتى لو أنت معزب في ديوانيتك، تقدر تدخل ديوانية ثانية أنت عضو فيها عن طريق الكود هنا.</p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
                    <input
                      inputMode="numeric"
                      value={tempJoinCode}
                      onChange={(e)=>setTempJoinCode(normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0,4))}
                      placeholder="كود الديوانية"
                      className="w-full flex-1 bg-white border border-stone-200 rounded-2xl px-4 py-3 text-center font-black text-brand"
                    />
                    <button onClick={handleJoinWithTempCode} disabled={tempCodeLoading} className="w-full sm:w-auto bg-brand text-white rounded-2xl px-5 py-3 text-xs font-black shadow-sm active:scale-95">
                      {tempCodeLoading ? "ندخلك..." : "دخول بالكود"}
                    </button>
                  </div>
                  {tempCodeNeedsProfile && (
                    <div className="rounded-2xl bg-white border border-brand/10 p-3 space-y-2">
                      <div className="text-[11px] font-black text-brand text-right">حط اسمك ورقم تلفونك ونكمل دخولك للديوانية</div>
                      <input
                        value={tempJoinName}
                        onChange={(e)=>setTempJoinName(e.target.value)}
                        placeholder="اسمك"
                        className="w-full bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 text-sm font-bold text-brand text-right"
                      />
                      <input
                        type="tel"
                        value={tempJoinPhone}
                        onChange={(e) => {
                          const v = normalizeDigits(e.target.value);
                          const cleaned = v.replace(/[^0-9]/g, "").slice(0, 8);
                          setTempJoinPhone(cleaned);
                        }}
                        placeholder="رقم تلفونك (٨ أرقام)"
                        maxLength={8}
                        className="w-full bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 text-sm font-bold text-brand text-right"
                      />
                    </div>
                  )}
                </div>
              </div>}

              {myDiwaniyaTab === "orders" && hasRealBeautifulLog && <div className="bg-white p-5 rounded-[30px] border border-stone-100 shadow-sm space-y-3">
                <h4 className="text-sm font-black text-brand">سجل الديوانية الجميل</h4>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-stone-50 rounded-2xl p-3"><div className="text-lg font-black text-brand">{squadBeautifulLog.ordersCount || 0}</div><div className="text-[9px] font-bold text-stone-400">طلبات قريبة</div></div>
                  <div className="bg-stone-50 rounded-2xl p-3"><div className="text-lg font-black text-brand">{squadBeautifulLog.presentCount || 0}</div><div className="text-[9px] font-bold text-stone-400">موجودين الآن</div></div>
                </div>
                <p className="text-[11px] font-bold text-stone-500">أكثر صنف محبوب: <b className="text-brand">{squadBeautifulLog.favoriteItemName || "يتحدد بعد أول طلبات أكثر"}</b></p>
              </div>}
            </div>
          )}

          {/* My Diwaniyas Panel with Switcher and Role Indicators */}
          {myDiwaniyaTab === "manage" && !isCreatingSquad && customerPhone && userSquads && userSquads.length > 0 && (
             <div className="flex flex-col gap-3 bg-stone-100/55 p-5 rounded-[28px] border border-stone-200/50 text-right font-sans">
                <div className="flex items-center justify-between border-b border-stone-200/50 pb-2">
                   <span className="text-[10px] font-black bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">{userSquads.length} مسجلة</span>
                   <h4 className="text-xs font-black text-brand uppercase tracking-widest flex items-center gap-1.5 justify-end">
                      إدارتي للدواوين والتنقل بينها 🛖
                   </h4>
                </div>
                <p className="text-[11px] font-bold text-stone-500 leading-relaxed">اختَر ديوانيتك الحالية، تنقّل بين دواوينك، أو أسّس ديوانية جديدة بهدوء.</p>
                
                <div className="space-y-2 mt-1">
                   {userSquads.map((sq: any) => {
                      const isActive = String(squadInfo?.id) === String(sq.id);
                      const isOwnerOfSq = sq.phone && (cleanPhoneLocal(sq.phone) === cleanPhoneLocal(customerPhone));
                      
                      return (
                         <div 
                            key={sq.id} 
                            className={cn(
                               "p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5",
                               isActive 
                                 ? "bg-white border-accent shadow-sm" 
                                 : "bg-white/80 hover:bg-white border-stone-100"
                            )}
                         >
                            <div className="flex items-center gap-3 shrink-0">
                               <button 
                                  onClick={() => {
                                     if (!isActive) {
                                        const nextSquadId = String(sq.id);
                                        try { localStorage.setItem("squadId", nextSquadId); } catch(e) {}
                                        setActiveSquadId(nextSquadId);
                                        setSquadInfo?.({ ...sq, memberData: { ...(sq.memberData || {}), phone: customerPhone, name: customerName || sq.memberData?.name || "عميل", isMember: true } });
                                     }
                                  }}
                                  disabled={isActive}
                                  className={cn(
                                     "text-[10px] font-black px-3.5 py-2 rounded-xl transition-all shadow-sm shrink-0",
                                     isActive 
                                       ? "bg-accent/10 text-accent font-black border border-accent/20 cursor-default" 
                                       : "bg-brand text-white hover:bg-accent hover:shadow-md active:scale-95"
                                  )}
                               >
                                  {isActive ? "✨ الحالية" : "✈️ الدخول لها"}
                               </button>
                            </div>

                            <div className="flex flex-col text-right">
                               <div className="flex items-center gap-1.5 justify-end flex-wrap">
                                  {isOwnerOfSq ? (
                                     <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                                        👑 معزبها
                                     </span>
                                  ) : (
                                     <span className="text-[8px] font-black bg-stone-500 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                                        👥 عضو فيها
                                     </span>
                                  )}
                                  <span className="text-sm font-black text-brand leading-none">
                                     {cleanSquadName(sq.name)}
                                  </span>
                               </div>
                               <span className="text-[9px] font-bold text-stone-400 mt-1.5">
                                  {(sq.lat ?? sq.location?.lat) !== undefined ? `📍 موقع الرادار: مثبت` : `⚠️ موقع الرادار غير مثبت`}
                                </span>
                            </div>
                         </div>
                      );
                   })}
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2">
                   <button
                      type="button"
                      onClick={startCreateNewSquad}
                      className="w-full bg-accent text-white rounded-2xl py-3 text-[11px] font-black shadow-sm active:scale-95"
                   >
                      + تأسيس ديوانية جديدة في موقع ثاني
                   </button>
                   <p className="text-[9px] font-bold text-stone-400 text-right leading-relaxed">
                      تقدر تكون معزب بأكثر من ديوانية أو عضو عند ربعك، وتختار الديوانية الحالية وقت الطلب.
                   </p>
                </div>
             </div>
          )}

          {isCreatingSquad && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-4 p-6 bg-white rounded-3xl border-2 border-stone-100 shadow-xl"
            >
              <div className="flex flex-col text-right">
                <h4 className="font-black text-lg text-brand mb-1">
                  تأسيس ديوانية يديدة ✨
                </h4>
                <p className="text-xs font-bold text-stone-500 mb-4">
                  اجمع ربعك ونافسوا الدواوين الثانية!
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col gap-1 text-right">
                  <label className="text-[10px] font-black text-stone-400 mr-2">
                    اسم الديوانية
                  </label>
                  <input
                    type="text"
                    value={newSquadName}
                    onChange={(e) => setNewSquadName(e.target.value)}
                    placeholder="مثال: ديوانية الفزعة"
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                  />
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <label className="text-[10px] font-black text-stone-400 mr-2">
                    اسمك بالعربي
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="عشان ربعك يعرفونك"
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                  />
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <label className="text-[10px] font-black text-stone-400 mr-2">
                    رقم تلفونك
                  </label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => {
                      const v = normalizeDigits(e.target.value);
                      const cleaned = v.replace(/[^0-9]/g, "").slice(0, 8);
                      setGuestPhone(cleaned);
                    }}
                    placeholder="رقم تلفونك (8 أرقام)"
                    maxLength={8}
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsCreatingSquad(false)}
                    className="flex-1 bg-stone-100 text-stone-500 font-black text-xs py-4 rounded-xl active:scale-95 transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleCreateSquad}
                    disabled={isSubmittingSquad}
                    className="flex-[2] bg-brand text-white font-black text-xs py-4 rounded-xl shadow-lg shadow-brand/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmittingSquad ? "نأسسها..." : "أسس الحين 🚀"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {!isCreatingSquad && squadInfo ? (
            (() => {
              const squadPoints = safePoints(
                squadInfo.points ??
                  squadInfo.totalPoints ??
                  squadInfo.teamPoints ??
                  squadInfo.score ??
                  squadInfo.balance ??
                  0,
              );
              const currentSquadTier =
                [...sortedTiers]
                  .reverse()
                  .find((t) => squadPoints >= safePoints(t.minPoints)) ||
                sortedTiers[0] ||
                getSquadTier(squadPoints);
              const nextSquadTier =
                sortedTiers.find(
                  (t) => safePoints(t.minPoints) > squadPoints,
                ) || null;
              const nextRequiredPoints = nextSquadTier
                ? safePoints(nextSquadTier.minPoints)
                : safePoints(currentSquadTier?.minPoints);
              const currentRequiredPoints = safePoints(
                currentSquadTier?.minPoints,
              );

              let progressPercent = 100;
              if (nextSquadTier) {
                const range = Math.max(
                  1,
                  nextRequiredPoints - currentRequiredPoints,
                );
                const currentProgress = Math.max(
                  0,
                  squadPoints - currentRequiredPoints,
                );
                progressPercent = Math.min(
                  100,
                  Math.max(0, (currentProgress / range) * 100),
                );
              }

              return (
                <div key="overview-content" className="flex flex-col gap-6">
                  {myDiwaniyaTab === "home" && (
                  <div className="flex flex-col gap-3">
                    <h4 className="font-black text-brand text-lg flex items-center gap-2 text-right">
                      <User className="w-5 h-5 text-accent" /> ترتيب الأعضاء
                    </h4>
                    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden flex flex-col">
                      {squadInfo.membersList
                        ?.sort(
                          (a: any, b: any) =>
                            (b.orderCount || 0) - (a.orderCount || 0),
                        )
                        .map((mem: any, idx: number) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-center justify-between p-4 border-b border-stone-50 last:border-0",
                              mem.phone === squadInfo.memberData?.phone
                                ? "bg-accent/5 font-bold"
                                : "",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center font-black text-stone-400 text-sm shrink-0">
                                {idx === 0 ? "👑" : idx + 1}
                              </div>
                              <span
                                className={cn(
                                  "text-sm",
                                  mem.phone === squadInfo.memberData?.phone
                                    ? "text-brand font-black"
                                    : "text-stone-700 font-bold",
                                )}
                              >
                                {mem.name || "عضو"}{" "}
                                {mem.phone === squadInfo.memberData?.phone &&
                                  "(أنت)"}
                              </span>
                            </div>
                            <div className="bg-stone-50 px-3 py-1 rounded-full text-xs font-bold text-stone-600 border border-stone-100 font-mono">
                              {formatEnglishNumber(mem.orderCount || 0)}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  )}

                  {/* رادار تحديد الموقع الجغرافي للديوانية - للقائد */}
                  {isOwner && myDiwaniyaTab === "location" && (
                    <div className="rounded-[28px] bg-white border border-stone-100 shadow-sm p-5 space-y-4 text-right">
                      <div className="flex items-center justify-between border-b border-stone-50 pb-3">
                        <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-wider">رادار الديوانية 📡</span>
                        <h4 className="font-black text-brand text-sm">إرشاد الرادار الجغرافي</h4>
                      </div>
                      
                      <p className="text-xs font-bold text-stone-500 leading-relaxed">
                        ثبّت موقع ديوانيتك واختر مدى ظهور بطاقة الدخول للربع القريبين منك، وخله على المسافة الأنسب لجلساتكم.
                      </p>

                      <div className="rounded-[24px] bg-emerald-50/70 border border-emerald-100 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-mono font-black bg-white text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                            {formatEnglishNumber(localGeofenceDistance)} متر
                          </span>
                          <div className="text-right">
                            <div className="text-xs font-black text-brand">مدى ظهور بطاقة الدخول</div>
                            <div className="text-[10px] font-bold text-stone-500 mt-0.5">اختر المسافة المناسبة لظهور بطاقة الدخول.</div>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max={Math.max(10, getSquadGeofenceDistance())}
                          value={clampGeofenceDistance(localGeofenceDistance, getSquadOwnGeofenceDistance(), getSquadGeofenceDistance())}
                          onChange={(e) => {
                            const nextDistance = clampGeofenceDistance(e.target.value, getSquadOwnGeofenceDistance(), getSquadGeofenceDistance());
                            setGeoDistanceTouched(true);
                            setLocalGeofenceDistance(nextDistance);
                            try { localStorage.setItem(`squad_geofence_distance_${squadInfo?.id}`, String(nextDistance)); } catch(e) {}
                          }}
                          className="w-full accent-emerald-600"
                        />
                        <div className="flex items-center justify-between text-[9px] font-black text-stone-400">
                          <span>حتى {formatEnglishNumber(getSquadGeofenceDistance())}م</span>
                          <span>دقيق 10م</span>
                        </div>
                      </div>

                      {hasRegisteredSquadLocation ? (
                        <div className="bg-sky-50 px-4 py-3 rounded-2xl border border-sky-100 space-y-2">
                          <p className="text-xs font-black text-sky-800 flex items-center gap-1 justify-end">
                            <span>موقع الديوانية مسجّل ومفعّل حالياً بنجاح! ✅</span>
                          </p>
                          <p className="text-[10px] font-mono font-bold text-sky-600 tracking-tight">
                            إحداثيات: {registeredSquadLat?.toFixed(6)}, {registeredSquadLng?.toFixed(6)}
                          </p>
                          <button
                            type="button"
                            onClick={() => { window.location.href = `https://www.google.com/maps/search/?api=1&query=${registeredSquadLat},${registeredSquadLng}`; }}
                            className="inline-block text-[10px] font-black text-accent hover:underline"
                          >
                            عرض على خرائط جوجل 🧭
                          </button>
                        </div>
                      ) : (
                        <div className="bg-orange-50 px-4 py-3 rounded-2xl border border-orange-100">
                          <p className="text-xs font-black text-orange-850">
                            ⚠️ موقع الديوانية غير مسجّل حتى الآن!
                          </p>
                          <p className="text-[10px] font-bold text-orange-600/80 mt-1 leading-normal">
                            الربع القراب منك ما يقدرون يستقبلون إشعارات الرادار للانضمام السريع إلا بعد تعيين موقع ديوانيتكم.
                          </p>
                        </div>
                      )}

                      {hasRegisteredSquadLocation && !showResetLocation ? (
                        <button
                          type="button"
                          onClick={() => saveCurrentLocationForSquad({ changeCheck: true })}
                          disabled={isRegisteringGeo}
                          className="w-full bg-white hover:bg-stone-50 border-2 border-stone-200/80 text-stone-600 font-black text-xs py-3.5 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isRegisteringGeo ? "نتأكد من موقعك... 🛰️" : "📍 تغيير موقع الديوانية عند الانتقال لمكان جديد"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRegisterLocation}
                          disabled={isRegisteringGeo}
                          className="w-full bg-stone-50 hover:bg-stone-100 border-2 border-stone-200/80 text-brand font-black text-xs py-3.5 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {isRegisteringGeo ? "نثبت الموقع... 🛰️" : (hasRegisteredSquadLocation ? "📍 تأكيد تغيير موقع الديوانية الحالي" : "📍 تعيين موقع الديوانية الجغرافي الحالي")}
                        </button>
                      )}

                      <div className="pt-2 border-t border-stone-50 space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowManualInput(!showManualInput)}
                          className="w-full text-[11px] font-black text-stone-500 hover:text-accent transition-colors flex items-center justify-center gap-1"
                        >
                          {showManualInput ? "إخفاء الخيار اليدوي ✖️" : "أو إدخال الموقع يدويًا (إحداثيات أو خرائط جوجل) 📍"}
                        </button>

                        {showManualInput && (
                          <div className="space-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-100">
                            <label className="text-[10px] font-black text-stone-600 block text-right">
                              ألصق رابط الموقع من خرائط جوجل أو الإحداثيات مباشرة:
                            </label>
                            <input
                              type="text"
                              value={manualInput}
                              onChange={(e) => setManualInput(e.target.value)}
                              placeholder="مثال: 29.3759, 47.9774 أو رابط خرائط جوجل"
                              className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-xs text-brand text-right focus:border-accent outline-none placeholder:text-stone-300 font-medium"
                            />
                            <button
                              type="button"
                              onClick={handleManualLocationSubmit}
                              disabled={isRegisteringGeo}
                              className="w-full bg-accent hover:bg-accent/90 text-white font-black text-[10px] py-2 rounded-xl active:scale-95 transition-all text-center"
                            >
                              حفظ الإحداثيات يدويًا 💾
                            </button>
                          </div>
                        )}
                      </div>

                      {geoStatusMsg && (
                        <p className="text-[10px] font-black text-center text-accent animate-pulse">
                          {geoStatusMsg}
                        </p>
                      )}
                    </div>
                  )}

                  {!isOwner && myDiwaniyaTab === "location" && (
                    <div className="rounded-[28px] bg-white border border-stone-100 shadow-sm p-5 space-y-4 text-right">
                      <div className="flex items-center justify-between border-b border-stone-50 pb-3">
                        <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full">إرشادات فقط</span>
                        <h4 className="font-black text-brand text-sm">موقع الديوانية 📍</h4>
                      </div>
                      <p className="text-xs font-bold text-stone-500 leading-relaxed">
                        التحكم بتثبيت أو تغيير موقع الرادار للمعزب فقط. أنت كعضو تقدر تشغّل سماح الموقع من المتصفح حتى يظهر لك الرادار والتنقل بين الدواوين القريبة.
                      </p>
                      <div className="bg-stone-50 rounded-2xl border border-stone-100 p-4 text-[11px] font-bold text-stone-500 leading-relaxed">
                        إذا ما ظهر لك إشعار القرب: فعّل صلاحية الموقع من المتصفح، قرّب من الديوانية، ثم افتح صفحة الديوانية أو اضغط تشغيل الرادار من التنبيه.
                      </div>
                    </div>
                  )}

                  {/* طلبات الانضمام عبر الرادار - للقائد */}
                  {isOwner && myDiwaniyaTab === "location" && (
                    <div className="rounded-[28px] bg-white border border-stone-100 shadow-sm p-5 space-y-4 text-right">
                      <div className="flex items-center justify-between border-b border-stone-50 pb-3">
                        <span className="text-[11px] font-mono font-black bg-accent/10 text-accent px-2.5 py-1 rounded-full">{formatEnglishNumber(pendingGeofenceRequests?.length || 0)} معلق</span>
                        <h4 className="font-black text-brand text-sm flex items-center gap-1.5 justify-end">
                          <Users className="w-4 h-4 text-accent" /> طلبات الرادار المعلقة
                        </h4>
                      </div>

                      {pendingGeofenceRequests && pendingGeofenceRequests.length > 0 ? (
                        <div className="space-y-3">
                          {pendingGeofenceRequests.map((req: any, idx: number) => (
                            <div key={idx} className="p-3.5 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">يبعد {req.distance ? formatEnglishNumber(req.distance) : formatEnglishNumber(getSquadGeofenceDistance())}م</span>
                                <span className="text-sm font-black text-brand">{req.name}</span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] font-bold text-stone-400 font-mono">{req.phone}</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApproveRejectRequest(req.phone, false)}
                                    disabled={isApproving[req.phone]}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black px-3 py-1.5 rounded-xl border border-rose-100 active:scale-95 transition-all text-center"
                                  >
                                    رفض ❌
                                  </button>
                                  <button
                                    onClick={() => handleApproveRejectRequest(req.phone, true)}
                                    disabled={isApproving[req.phone]}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-4.5 py-1.5 rounded-xl shadow-sm active:scale-95 transition-all text-center"
                                  >
                                    {isApproving[req.phone] ? "ثواني..." : "قبول ✅"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-stone-400 text-center py-4">
                          ماكو طلبات انضمام بالرادار حالياً. 
                          <br />
                          <span className="text-[10px] opacity-75">تظهر هنا فوراً عندما يقترب كنعور من ديوانيتك!</span>
                        </p>
                      )}
                    </div>
                  )}

                  {!isCurrentMember && (
                    <div className="rounded-[28px] bg-white border-2 border-accent/20 shadow-xl p-5 space-y-4 text-right">
                      <div className="space-y-1">
                        <h4 className="font-black text-brand text-lg">انضم لهذه الديوانية</h4>
                        <p className="text-xs font-bold text-stone-500">تقدر تدخل بطريقتين: تحط اسمك ورقمك، أو تستخدم كود الضيف من المعزب.</p>
                      </div>

                      <div className="rounded-[24px] border border-stone-100 bg-stone-50 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black bg-white text-stone-500 px-2.5 py-1 rounded-full border border-stone-200">الخيار الأساسي</span>
                          <h5 className="text-sm font-black text-brand">دخول برقمك</h5>
                        </div>
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleJoinSquad(String(squadInfo.id));
                            }
                          }}
                          placeholder="اسمك"
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                        />
                        <input
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => {
                            const v = normalizeDigits(e.target.value);
                            const cleaned = v.replace(/[^0-9]/g, "").slice(0, 8);
                            setGuestPhone(cleaned);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleJoinSquad(String(squadInfo.id));
                            }
                          }}
                          placeholder="رقم تلفونك (8 أرقام)"
                          maxLength={8}
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                        />
                        <button
                          onClick={() => handleJoinSquad(String(squadInfo.id))}
                          disabled={isSubmittingSquad}
                          className="w-full bg-accent text-white font-black text-sm py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isSubmittingSquad ? "ندخلك..." : "انضم للديوانية الآن"}
                        </button>
                      </div>

                      <div className="rounded-[26px] border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black bg-white text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">ضيف + قطية</span>
                          <h5 className="text-sm font-black text-brand">افتح قطية داخل الديوانية</h5>
                        </div>
                        <p className="text-[11px] font-bold text-stone-500 leading-relaxed">
                          إذا أنت ضيف وتبي تطلب للربع، نربط الطلب باسم الديوانية ونجهز أسماء الأعضاء. اختار الأصناف وبعدها اختر القطيّة من الدفع.
                        </p>
                        <button
                          type="button"
                          onClick={handleGuestPrepareQatya}
                          className="w-full bg-brand text-white font-black text-sm py-4 rounded-2xl shadow-lg shadow-brand/15 active:scale-95 transition-all"
                        >
                          جهز قطية كضيف
                        </button>
                        <div className="text-[10px] font-bold text-amber-700 bg-white/70 border border-amber-100 rounded-2xl px-3 py-2 leading-relaxed">
                          ما ندخلك كعضو تلقائياً، فقط نجهز القطيّة والطلب باسمك داخل هذه الديوانية.
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-brand/10 bg-brand/[0.03] p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black bg-brand/10 text-brand px-2.5 py-1 rounded-full border border-brand/10">سريع ومباشر</span>
                          <h5 className="text-sm font-black text-brand">عندك كود دخول ساعتين؟</h5>
                        </div>
                        <p className="text-[11px] font-bold text-stone-500 leading-relaxed">إذا المعزب عطاك كود مؤقت، اكتب الكود هني ودش مباشرة بدون انتظار.</p>
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
                          <input
                            inputMode="numeric"
                            value={tempJoinCode}
                            onChange={(e)=>setTempJoinCode(normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0,4))}
                            placeholder="الكود"
                            className="w-full flex-1 bg-white border border-stone-200 rounded-2xl px-4 py-3 text-center font-black text-brand"
                          />
                          <button
                            onClick={handleJoinWithTempCode}
                            disabled={tempCodeLoading}
                            className="w-full sm:w-auto bg-brand text-white rounded-2xl px-5 py-3 text-xs font-black shadow-sm active:scale-95"
                          >
                            {tempCodeLoading ? "ندخلك..." : "دخول بالكود"}
                          </button>
                        </div>
                        {tempCodeNeedsProfile && (
                          <div className="rounded-2xl bg-white border border-brand/10 p-3 space-y-2">
                            <div className="text-[11px] font-black text-brand text-right">حط اسمك ورقم تلفونك ونكمل دخولك للديوانية</div>
                            <input
                              value={tempJoinName}
                              onChange={(e)=>setTempJoinName(e.target.value)}
                              placeholder="اسمك"
                              className="w-full bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 text-sm font-bold text-brand text-right"
                            />
                            <input
                              type="tel"
                              value={tempJoinPhone}
                              onChange={(e) => {
                                const v = normalizeDigits(e.target.value);
                                const cleaned = v.replace(/[^0-9]/g, "").slice(0, 8);
                                setTempJoinPhone(cleaned);
                              }}
                              placeholder="رقم تلفونك (8 أرقام)"
                              maxLength={8}
                              className="w-full bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 text-sm font-bold text-brand text-right"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isCurrentMember && myDiwaniyaTab === "home" && (
                    <button
                      onClick={handleShareSquadLink}
                      className="w-full bg-brand text-white font-black text-sm py-4 rounded-xl shadow-lg active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                    >
                      {copied ? "تم النسخ! 👍" : "انشر رابط دعوة ربعك للديوانية 🔗"}
                    </button>
                  )}
                </div>
              );
            })()
          ) : !isCreatingSquad ? (
            <div className="bg-orange-50 rounded-[30px] p-6 border border-orange-100 shadow-sm flex flex-col gap-4 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 mb-4 shadow-inner">
                  <Users className="w-8 h-8" />
                </div>
                <h4 className="font-black text-lg text-brand mb-2">
                  دخول أو تأسيس ديوانية
                </h4>
                <p className="text-sm font-bold text-stone-600 px-4 leading-relaxed">
                  بدلت تلفونك؟ دخل رقمك ونرجّع دواوينك. أو أسس ديوانية جديدة للمكان اللي أنت فيه.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-orange-100 space-y-3 text-right">
                <label className="text-[10px] font-black text-stone-400 mr-2">
                  رقم تلفونك
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={loginPhone || guestPhone}
                    onChange={(e) => {
                      const v = normalizeDigits(e.target.value);
                      const filtered = v.replace(/[^0-9]/g, "").slice(0, 8);
                      setLoginPhone(filtered);
                      setGuestPhone(filtered);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLoginByPhone();
                      }
                    }}
                    placeholder="رقم تلفونك (8 أرقام)"
                    maxLength={8}
                    className="flex-1 bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                  />
                  <button
                    onClick={handleLoginByPhone}
                    className="bg-brand text-white font-black text-xs px-4 rounded-2xl shadow-md active:scale-95"
                  >
                    دخول
                  </button>
                </div>
                <p className="text-[10px] font-bold text-stone-400 leading-relaxed">
                  إذا الرقم مرتبط بدواوين، راح تظهر لك فوراً وتقدر تختار الحالية.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-4 border border-brand/10 space-y-3 text-right">
                <label className="text-[10px] font-black text-stone-400 mr-2">
                  عندك كود من المعزب؟
                </label>
                <div className="flex gap-2">
                  <input
                    inputMode="numeric"
                    value={tempJoinCode}
                    onChange={(e)=>setTempJoinCode(normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0,4))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleJoinWithTempCode();
                      }
                    }}
                    placeholder="كود الديوانية"
                    className="flex-1 bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-black text-brand focus:border-accent focus:outline-none transition-all text-center"
                  />
                  <button
                    onClick={handleJoinWithTempCode}
                    disabled={tempCodeLoading}
                    className="bg-brand text-white font-black text-xs px-4 rounded-2xl shadow-md active:scale-95"
                  >
                    دخول بالكود
                  </button>
                </div>
                {tempCodeNeedsProfile && (
                  <div className="grid grid-cols-1 gap-2">
                    <div className="text-[11px] font-black text-brand text-right">حط اسمك ورقم تلفونك ونكمل دخولك للديوانية</div>
                    <input
                      value={tempJoinName}
                      onChange={(e)=>setTempJoinName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleJoinWithTempCode();
                        }
                      }}
                      placeholder="اسمك"
                      className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand text-right"
                    />
                    <input
                      type="tel"
                      value={tempJoinPhone}
                      onChange={(e) => {
                        const v = normalizeDigits(e.target.value);
                        const cleaned = v.replace(/[^0-9]/g, "").slice(0, 8);
                        setTempJoinPhone(cleaned);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleJoinWithTempCode();
                        }
                      }}
                      placeholder="رقم تلفونك (8 أرقام)"
                      maxLength={8}
                      className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand text-right"
                    />
                  </div>
                )}
                <p className="text-[10px] font-bold text-stone-400 leading-relaxed">
                  اكتب الكود، وإذا مو مسجل بنطلب اسمك ورقم تلفونك ونكمل دخولك.
                </p>
              </div>

              <button
                onClick={startCreateNewSquad}
                className="w-full bg-brand text-white font-black text-sm py-4 rounded-2xl shadow-md active:scale-95"
              >
                تأسيس ديوانية جديدة ✨
              </button>
            </div>
          ) : null}
        </div>
      )}

      {activeSquadTab === "leaderboard" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
          <h4 className="font-black text-brand text-lg flex items-center gap-2 text-right">
            <Landmark className="w-5 h-5 text-accent" /> صدارة الدواوين
          </h4>
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden flex flex-col">
            {(!topSquads || topSquads.length === 0) && (
              <div className="p-5 text-center text-xs font-black text-stone-400">
                أول ديوانية تجمع نقاطها راح تظهر هنا ضمن صدارة الدواوين.
              </div>
            )}
            {topSquads?.slice(0, 5).map((sq: any, idx: number) => {
              const sqTier = getSquadTier(
                toNumber(
                  sq.points ??
                    sq.totalPoints ??
                    sq.score ??
                    sq.totalOrders ??
                    0,
                ),
              );
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between p-4 border-b border-stone-50 last:border-0",
                    sq.id === squadInfo?.id ? "bg-accent/5 font-bold" : "",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0",
                        idx === 0
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-stone-50 text-stone-400",
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-sm font-black text-stone-700">
                        {sq.name}
                      </span>
                      <span className="text-[10px] text-stone-400 font-bold">
                        {sqTier?.name || ""}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-black text-accent font-mono">
                    {toNumber(
                      sq.points ??
                        sq.totalPoints ??
                        sq.score ??
                        sq.totalOrders ??
                        0,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSquadTab === "tiers" && (
        <div className="space-y-5 animate-in fade-in duration-500 text-right">
          {sortedTiers.length === 0 ? (
            <div className="rounded-[28px] border border-stone-100 bg-white p-5 shadow-sm text-center text-xs font-black text-stone-400">
              طريق الديوانية بانتظار إعداد مستوياته من لوحة الأدمن.
            </div>
          ) : null}
          {sortedTiers.length > 0 ? (
          <div className="rounded-[28px] border border-stone-100 bg-white p-5 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-black text-brand text-lg">
                  طريق الديوانية
                </h4>
                <p className="text-[11px] font-bold text-stone-400">
                  طريق واضح يبين مستواكم وكم باقي للمستوى القادم
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-black">
                {currentPoints} نقطة
              </span>
            </div>

            <div className="squad-tier-road relative pt-2 pb-1 overflow-x-auto overflow-y-visible px-1">
              <div className="squad-tier-road-track absolute top-8 right-10 left-10 h-2 rounded-full bg-stone-100" />
              <div
                className="squad-tier-road-grid relative grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(sortedTiers.length, 1)}, minmax(88px, 1fr))`,
                  minWidth: `${Math.max(sortedTiers.length, 1) * 92}px`,
                }}
              >
                {sortedTiers.map((tier) => {
                  const reached = currentPoints >= Number(tier.minPoints || 0);
                  const isCurrent = currentTier?.id === tier.id;
                  return (
                    <div
                      key={tier.id}
                      className="relative flex flex-col items-center text-center gap-2 min-w-0"
                    >
                      <div
                        className={cn(
                          "w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-xl shadow-sm bg-white z-10 transition-all overflow-hidden",
                          reached
                            ? "border-accent scale-105"
                            : "border-stone-100 opacity-70",
                          isCurrent && "ring-4 ring-accent/15",
                        )}
                      >
                        {tier.imageUrl || tier.image ? (
                          <img
                            src={tier.imageUrl || tier.image}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          renderAdminSquadTierBadge(tier, "w-9 h-9")
                        )}
                      </div>
                      <span
                        className={cn(
                          "squad-tier-road-name text-[10px] font-black leading-tight max-w-[92px] whitespace-normal break-words",
                          reached
                            ? tier.color || "text-brand"
                            : "text-stone-400",
                        )}
                      >
                        {tier.name}
                      </span>
                      <span className="squad-tier-road-points text-[9px] font-bold text-stone-400 leading-tight">
                        {tier.minPoints}+ نقطة
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          ) : null}

          {sortedTiers.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {sortedTiers.map((tier) => {
              const reached = currentPoints >= Number(tier.minPoints || 0);
              const isCurrent = currentTier?.id === tier.id;
              return (
                <div
                  key={tier.id}
                  className={cn(
                    "p-5 rounded-2xl border-2 transition-all relative overflow-hidden",
                    tier.bg,
                    isCurrent ? "border-brand shadow-md" : "border-stone-100",
                  )}
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                      {tier.imageUrl || tier.image ? (
                        <img
                          src={tier.imageUrl || tier.image}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        renderAdminSquadTierBadge(tier, "w-10 h-10")
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <h5
                          className={cn(
                            "font-black text-lg truncate",
                            tier.color,
                          )}
                        >
                          {tier.name}
                        </h5>
                        <span className="text-[10px] font-bold opacity-60 tracking-tighter shrink-0">
                          {tier.minPoints}+ نقطة
                        </span>
                      </div>
                      <p className="text-[11px] font-black text-stone-600 mt-1 leading-relaxed">
                        {tier.benefit}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] font-black text-accent mt-2">
                          هذا مستواكم الحالي ✨
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
