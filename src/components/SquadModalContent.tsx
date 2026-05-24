import React from "react";
import { motion } from "motion/react";
import { User, Landmark, Crown, Users, LogIn } from "lucide-react";
import { cn } from "../utils";
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
  getSquadTier: (points: number) => SquadTier;
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
  tempCodes?: any[];
  usualOrder?: any;
  squadBeautifulLog?: any;
  diwaniyaNotifications?: any[];
  unreadDiwaniyaNotifications?: number;
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
  tempCodes = [],
  usualOrder = null,
  squadBeautifulLog = null,
  diwaniyaNotifications = [],
  unreadDiwaniyaNotifications = 0,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [myDiwaniyaTab, setMyDiwaniyaTab] = React.useState<"home" | "manage" | "orders" | "code" | "notifications" | "location">("home");

  const cleanPhoneLocal = (ph: string): string => {
    if (!ph) return "";
    const cleaned = String(ph).replace(/[^0-9]/g, "");
    if (cleaned.startsWith("965") && cleaned.length > 8) {
      return cleaned.slice(3);
    }
    return cleaned;
  };

  const isOwner = Boolean(squadInfo?.phone && customerPhone && cleanPhoneLocal(squadInfo.phone) === cleanPhoneLocal(customerPhone));
  const isCurrentMember = Boolean(squadInfo?.id && (isOwner || (customerPhone && squadInfo?.memberData?.isMember !== false && Boolean(squadInfo?.memberData?.phone || customerPhone))));

  // Geofencing states & actions
  const [isRegisteringGeo, setIsRegisteringGeo] = React.useState(false);
  const [geoStatusMsg, setGeoStatusMsg] = React.useState("");
  const [isApproving, setIsApproving] = React.useState<Record<string, boolean>>({});
  const [manualInput, setManualInput] = React.useState("");
  const [showManualInput, setShowManualInput] = React.useState(false);
  const [showResetLocation, setShowResetLocation] = React.useState(false);

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
      alert("الرجاء إدخال الإحداثيات أو رابط خرائط جوجل أولاً!");
      return;
    }
    
    const coords = parseGoogleMapsInput(manualInput);
    if (!coords) {
      alert("لم نتمكن من استخراج الإحداثيات. تأكد من إدخالها بالشكل الصحيح (مثال: 29.3759, 47.9774) أو لصق رابط خرائط جوجل صحيح.");
      return;
    }

    if (squadInfo?.lat !== undefined && squadInfo?.lng !== undefined) {
      const diff = calculateDistanceMeters(Number(squadInfo.lat), Number(squadInfo.lng), coords.lat, coords.lng);
      if (diff < 8) {
        setShowResetLocation(false);
        setGeoStatusMsg("الموقع نفسه تقريباً، ما يحتاج نغيّره ✅");
        return;
      }
    }

    setIsRegisteringGeo(true);
    setGeoStatusMsg("جاري حفظ الموقع يدوياً... 💾");
    try {
      const res = await fetch("/api/squad-set-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          squadId: squadInfo.id,
          phone: customerPhone,
          lat: coords.lat,
          lng: coords.lng
        })
      });
      if (res.ok) {
        setGeoStatusMsg("تم تسجيل موقع الديوانية الجغرافي بنجاح! 🎉");
        setManualInput("");
        setShowManualInput(false);
        setShowResetLocation(false);
        if (onRefresh) onRefresh();
      } else {
        setGeoStatusMsg("فشل التسجيل يدوياً. يرجى المحاولة لاحقاً.");
      }
    } catch (e) {
      setGeoStatusMsg("خطأ اتصال أثناء حفظ الموقع.");
    }
    setIsRegisteringGeo(false);
  };

  const saveCurrentLocationForSquad = React.useCallback((options?: { auto?: boolean; changeCheck?: boolean }) => {
    if (!squadInfo?.id) return;
    if (!navigator.geolocation) {
      const msg = "جهازك لا يدعم نظام تحديد المواقع الجغرافي.";
      if (options?.auto) setGeoStatusMsg(msg); else alert(msg);
      return;
    }
    setIsRegisteringGeo(true);
    setGeoStatusMsg(options?.auto ? "نحاول تثبيت موقع ديوانيتك الحالية تلقائياً... 📡" : (options?.changeCheck ? "نتأكد من موقعك الحالي قبل تغيير موقع الديوانية... 📡" : "جاري تثبيت موقع الديوانية الحالي... 📡"));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        if (squadInfo?.lat !== undefined && squadInfo?.lng !== undefined) {
          const diff = calculateDistanceMeters(Number(squadInfo.lat), Number(squadInfo.lng), latitude, longitude);
          if (diff < 8) {
            setIsRegisteringGeo(false);
            setShowResetLocation(false);
            setGeoStatusMsg("أنت بالموقع الحالي للديوانية، ما يحتاج نغيّر اللوكيشن ✅");
            return;
          }
        }
        try {
          const res = await fetch("/api/squad-set-location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              squadId: squadInfo.id,
              phone: customerPhone,
              lat: latitude,
              lng: longitude
            })
          });
          if (res.ok) {
            setGeoStatusMsg("تم تسجيل موقع الديوانية الجغرافي بنجاح! 🎉");
            setShowResetLocation(false);
            setSquadInfo?.({ ...squadInfo, lat: latitude, lng: longitude });
            if (onRefresh) window.setTimeout(onRefresh, 100);
          } else {
            setGeoStatusMsg("فشل التسجيل. يرجى المحاولة لاحقاً.");
          }
        } catch (e) {
          setGeoStatusMsg("خطأ اتصال أثناء حفظ الموقع.");
        }
        setIsRegisteringGeo(false);
      },
      (err) => {
        setIsRegisteringGeo(false);
        setShowResetLocation(true);
        const code = Number(err?.code || 0);
        if (code === 1) {
          setGeoStatusMsg("الموقع يحتاج سماح. فعّل اللوكيشن من المتصفح أو استخدم الإدخال اليدوي لتثبيت ديوانيتك الحالية.");
        } else if (code === 2) {
          setGeoStatusMsg("المتصفح لم يتمكن من قراءة موقعك حالياً. جرّب مرة ثانية أو استخدم الإدخال اليدوي.");
        } else if (code === 3) {
          setGeoStatusMsg("يبدو أنك في نفس موقع الديوانية الحالي. إذا كنت انتقلت فعلاً لمكان جديد اضغط مرة ثانية، أو استخدم الإدخال اليدوي عند الحاجة.");
        } else {
          setGeoStatusMsg("تعذر قراءة الموقع حالياً. جرّب مرة ثانية أو استخدم الإدخال اليدوي.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [squadInfo, customerPhone, onRefresh, setSquadInfo]);

  const handleRegisterLocation = () => saveCurrentLocationForSquad();

  const autoLocationSquadRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const squadId = squadInfo?.id ? String(squadInfo.id) : "";
    const isOwnerOfCurrent = Boolean(squadInfo?.phone && customerPhone && cleanPhoneLocal(squadInfo.phone) === cleanPhoneLocal(customerPhone));
    const needsLocation = squadInfo?.lat === undefined || squadInfo?.lng === undefined;
    if (!squadId || !isOwnerOfCurrent || !needsLocation || autoLocationSquadRef.current === squadId) return;
    autoLocationSquadRef.current = squadId;
    saveCurrentLocationForSquad({ auto: true });
  }, [squadInfo?.id, squadInfo?.phone, squadInfo?.lat, squadInfo?.lng, customerPhone, saveCurrentLocationForSquad]);

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
        alert("فشل تحديث الطلب.");
      }
    } catch (e) {
      alert("خطأ اتصال أثناء تحديث الطلب.");
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
      name: tier?.name || tier?.title || `مستوى ${index + 1}`,
      minPoints: min,
      maxPoints: max,
      benefit:
        tier?.benefit || tier?.label || tier?.description || tier?.reward || "",
      description: tier?.description || tier?.label || tier?.benefit || "",
      title: tier?.title || tier?.name || "",
      icon: tier?.icon || iconByType[tier?.iconType] || "🏅",
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
    getSquadTier(currentPoints);

  const safePoints = (value: any) => {
    const n = toNumber(value);
    return Number.isFinite(n) ? n : 0;
  };

  const toEnglishDigits = (value: any) => normalizeDigits(String(value ?? ""));
  const formatEnglishNumber = (value: any) => toEnglishDigits(String(value ?? ""));
  const getSquadGeofenceDistance = () => {
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
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 100;
  };
  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const f1 = lat1 * Math.PI / 180;
    const f2 = lat2 * Math.PI / 180;
    const df = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const visibleNotifications = (diwaniyaNotifications || []).filter((n: any) => !n.readAt);
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
    if (!isOwner && myDiwaniyaTab === "code") setMyDiwaniyaTab("home");
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
    const cleanLoginPhone = normalizeDigits(loginPhone || guestPhone || "").replace(/[^0-9]/g, "").slice(0, 8);
    if (!cleanLoginPhone || cleanLoginPhone.length < 8) {
      alert("اكتب رقم التلفون 8 أرقام عشان نرجع دواوينك.");
      return;
    }
    try {
      const res = await fetch(`/api/squad-gamification?phone=${encodeURIComponent(cleanLoginPhone)}`);
      const data = res.ok ? await res.json() : null;
      const foundSquads = Array.isArray(data?.userSquads) ? data.userSquads : [];
      if (!foundSquads.length) {
        setGuestPhone(cleanLoginPhone);
        setLoginPhone(cleanLoginPhone);
        alert("هذا الرقم غير مرتبط بأي ديوانية حالياً. تقدر تطلب دخول بكود أو تؤسس ديوانية جديدة.");
        return;
      }
      setCustomerPhone(cleanLoginPhone);
      setGuestPhone(cleanLoginPhone);
      const firstSquadId = String(foundSquads[0]?.id || "");
      setActiveSquadId(firstSquadId);
      if (setSquadInfo) setSquadInfo(null);
      try {
        localStorage.setItem("customer_phone_track", cleanLoginPhone);
        if (firstSquadId) localStorage.setItem("squadId", firstSquadId);
        else localStorage.removeItem("squadId");
        localStorage.removeItem("radar_dismissed_squads");
      } catch(e) {}
      if (onRefresh) window.setTimeout(onRefresh, 80);
    } catch(e) {
      alert("تعذر التحقق من الرقم حالياً. حاول مرة ثانية.");
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
      alert("دخل رقمك أولاً عشان نعرف حضورك بالديوانية.");
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
      else alert("تعذر تحديث حضورك حالياً.");
    } catch { alert("خطأ اتصال أثناء تحديث الحضور."); }
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
      } else alert(data?.error || "تعذر إنشاء كود مؤقت.");
    } catch { alert("خطأ اتصال أثناء إنشاء الكود."); }
    setTempCodeLoading(false);
  };

  const handleJoinWithTempCode = async () => {
    const cleanCode = tempJoinCode.trim();
    const cleanTempPhone = cleanPhoneLocal(normalizeDigits(tempJoinPhone || guestPhone || loginPhone || currentMemberPhone || "")).slice(0, 8);
    const finalName = (tempJoinName || guestName || customerName || "").trim();

    if (!cleanCode) {
      alert("اكتب كود الديوانية أولاً.");
      return;
    }

    if (!cleanTempPhone || cleanTempPhone.length !== 8 || !finalName) {
      setTempCodeNeedsProfile(true);
      alert("الكود جاهز. ادخل اسمك ورقمك لإكمال الدخول للديوانية.");
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
    } catch { alert("خطأ اتصال أثناء استخدام الكود."); }
    setTempCodeLoading(false);
  };

  const handleOpenGroupOrder = async () => {
    if (!squadInfo?.id || !currentMemberPhone) return;
    setGroupOrderLoading(true);
    try {
      const res = await fetch("/api/squad-group-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squadId: squadInfo.id, phone: currentMemberPhone, name: customerName || guestName || "عضو", action: "open", participants: squadMembersForSplit, title: `طلب ${cleanSquadName(squadInfo.name)} المفتوح` })
      });
      if (res.ok) {
        try { localStorage.setItem("split_prefill_members", JSON.stringify(squadMembersForSplit)); } catch {}
        if (onRefresh) onRefresh();
      } else alert("تعذر فتح طلب الربع.");
    } catch { alert("خطأ اتصال أثناء فتح طلب الربع."); }
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
    } catch {}

    if (onPrepareQatya) {
      onPrepareQatya(members);
      return;
    }

    alert(members.length
      ? "جهزنا أسماء وأرقام الربع للقطية."
      : "جهزنا القطيّة، أضف الربع عند صفحة الدفع.");
  }, [getPreparedQatyaMembers, onPrepareQatya]);

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

  const notificationIcon = (type: string) => {
    if (type === "join_request") return "🚪";
    if (type === "join_approved") return "🎉";
    if (type === "group_order_open") return "🍽️";
    if (type === "presence_in") return "👋";
    if (type === "temp_code") return "🔐";
    return "🔔";
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
          {/* Personal Loyalty Tier - Moved from main screen */}
          {customerPhone && (
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest text-right mb-1">
                بروتوكول الولاء الشخصي
              </h4>
              {(() => {
                const tier = getLoyaltyTier(customerPoints);
                return (
                  <div
                    className={cn(
                      "p-4 rounded-2xl border-2 flex items-center justify-between",
                      tier.bg,
                      tier.color === "text-sky-600"
                        ? "border-sky-100"
                        : tier.color === "text-yellow-600"
                          ? "border-yellow-100"
                          : "border-stone-100",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">
                        {tier.icon}
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-sm font-black text-brand">
                          مستوى {tier.name}
                        </span>
                        <span className="text-[10px] font-bold text-stone-500">
                          رصيدك: {customerPoints} {formatPoints(customerPoints)}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-stone-400 opacity-60">
                      حسابك الشخصي
                    </div>
                  </div>
                );
              })()}
            </div>
          )}


          {squadInfo && isCurrentMember && (
            <div className="bg-white/90 border border-stone-100 rounded-[28px] p-2 shadow-sm relative z-10">
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
                    إشعارات الديوانية
                    {unreadDiwaniyaNotifications > 0 && (
                      <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">{unreadDiwaniyaNotifications}</span>
                    )}
                  </h4>
                  <p className="text-[10px] font-bold text-stone-400">تنبيهات الربع والدخول وطلبات الديوانية، منفصلة عن الدفع.</p>
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {visibleNotifications.slice(0, 12).map((n: any) => (
                  <button
                    key={n.id}
                    onClick={() => markDiwaniyaNotificationsRead(n.id)}
                    className={cn(
                      "w-full p-3 rounded-2xl border text-right flex items-start justify-between gap-3 transition-all active:scale-[0.99]",
                      "bg-amber-50 border-amber-200 shadow-sm"
                    )}
                  >
                    <span className="text-xl shrink-0">{notificationIcon(n.type)}</span>
                    <div className="flex-1">
                      <div className="text-xs font-black text-brand">{n.title}</div>
                      <div className="text-[10px] font-bold text-stone-500 leading-relaxed mt-1">{n.message}</div>
                      <div className="text-[9px] font-black text-stone-300 mt-1">{n.squadName ? `ديوانية ${cleanSquadName(n.squadName)}` : "تنبيه ديوانية"}</div>
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
              <p className="text-[11px] font-bold text-stone-400 mt-1">أي تنبيه جديد للديوانية يظهر هنا بدون زحمة.</p>
            </div>
          )}

          {!isCreatingSquad && squadInfo && isCurrentMember && myDiwaniyaTab !== "notifications" && (
            <div className="grid gap-3 text-right font-sans">
              {myDiwaniyaTab === "home" && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-brand to-stone-900 text-white p-5 rounded-[30px] shadow-xl border border-white/10 space-y-4 overflow-hidden relative">
                    <div className="absolute -left-10 -top-10 w-32 h-32 bg-accent/20 blur-3xl rounded-full" />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full">حضور الديوانية</div>
                      <div>
                        <h4 className="text-base font-black">أنا في الديوانية الآن</h4>
                        <p className="text-[11px] text-white/70 font-bold">دخول وخروج واضح بدون تتبع مزعج.</p>
                      </div>
                    </div>
                    <div className="relative flex gap-2">
                      <button
                        onClick={() => handlePresenceToggle("in")}
                        disabled={isPresenceLoading || isPresentNow}
                        className={cn(
                          "flex-1 py-3 rounded-2xl text-xs font-black transition-all disabled:cursor-not-allowed",
                          isPresentNow ? "bg-emerald-400 text-brand opacity-100" : "bg-white text-brand active:scale-95",
                          (isPresenceLoading || isPresentNow) && "pointer-events-none"
                        )}
                      >
                        {isPresentNow ? "أنت موجود الآن ✅" : "أنا وصلت"}
                      </button>
                      <button
                        onClick={() => handlePresenceToggle("out")}
                        disabled={isPresenceLoading || !isPresentNow}
                        className={cn(
                          "flex-1 py-3 rounded-2xl text-xs font-black border border-white/10 transition-all disabled:cursor-not-allowed",
                          isPresentNow ? "bg-white text-brand active:scale-95" : "bg-white/10 text-white/45 opacity-50 pointer-events-none"
                        )}
                      >
                        طلعت / إيقاف الحضور
                      </button>
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

              {myDiwaniyaTab === "orders" && <div className="bg-white p-5 rounded-[30px] border border-stone-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black bg-accent/10 text-accent px-3 py-1 rounded-full">طلب الربع + قطية</span>
                  <h4 className="text-sm font-black text-brand">تنسيق طلب الربع</h4>
                </div>
                <p className="text-[11px] font-bold text-stone-500 leading-relaxed">جهّز طلب الربع وخلي القطيّة أسهل؛ نحفظ أسماء وأرقام الأعضاء تلقائياً لتعبئة المشاركين بسرعة.</p>
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
                    <p className="text-[10px] font-bold text-stone-400 mt-0.5">أنشئ كود للضيف أو ادخل كود ديوانية ثانية.</p>
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
                    {(activeTempCode?.code || tempCodes[0]?.code) ? <div className="text-center bg-white rounded-3xl p-5 border border-amber-100">
                      <div className="text-[10px] font-black text-stone-400 mb-2">الكود الحالي</div>
                      <div className="inline-flex bg-stone-50 border border-amber-100 rounded-2xl px-5 py-3 text-4xl font-black tracking-[0.35em] text-brand shadow-sm" dir="ltr">{activeTempCode?.code || tempCodes[0]?.code}</div>
                      <p className="text-[10px] font-bold text-stone-400 mt-3">أرسله للضيف، صالح لمدة ساعتين.</p>
                    </div> : <div className="bg-white border border-amber-100 rounded-2xl p-4 text-center text-[11px] font-bold text-stone-500">اضغط إنشاء كود وسيظهر هنا فوراً.</div>}
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
                      {tempCodeLoading ? "جاري الدخول..." : "دخول بالكود"}
                    </button>
                  </div>
                  {tempCodeNeedsProfile && (
                    <div className="rounded-2xl bg-white border border-brand/10 p-3 space-y-2">
                      <div className="text-[11px] font-black text-brand text-right">ادخل اسمك ورقمك لإكمال الدخول للديوانية</div>
                      <input
                        value={tempJoinName}
                        onChange={(e)=>setTempJoinName(e.target.value)}
                        placeholder="اسمك"
                        className="w-full bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 text-sm font-bold text-brand text-right"
                      />
                      <input
                        inputMode="numeric"
                        value={tempJoinPhone}
                        onChange={(e)=>setTempJoinPhone(normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0,8))}
                        placeholder="رقم تلفونك 8 أرقام"
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
                <p className="text-[11px] font-bold text-stone-500 leading-relaxed">هنا تختار الديوانية الحالية، تنتقل بين دواوينك بسهولة، أو تؤسس ديوانية جديدة بدون ما تزاحم الصفحة الرئيسية.</p>
                
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
                                     ديوانية {sq.name}
                                  </span>
                               </div>
                               <span className="text-[9px] font-bold text-stone-400 mt-1.5">
                                  {sq.lat !== undefined ? `📍 موقع الرادار: مثبت` : `⚠️ موقع الرادار غير مثبت`}
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
                    onChange={(e) =>
                      setGuestPhone(normalizeDigits(e.target.value).replace(/[^0-9]/g, "").slice(0, 8))
                    }
                    placeholder="رقم تلفونك بالإنجليزي - 8 أرقام"
                    maxLength={8}
                    inputMode="numeric"
                    pattern="[0-9]*"
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
                    {isSubmittingSquad ? "جاري التأسيس..." : "أسس الحين 🚀"}
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
                        ثبت موقع ديوانيتك حتى تظهر بطاقة الدخول للربع تلقائياً عند اقترابهم ضمن مسافة الأدمن ({formatEnglishNumber(getSquadGeofenceDistance())} متر).
                      </p>

                      {squadInfo.lat !== undefined && squadInfo.lng !== undefined ? (
                        <div className="bg-sky-50 px-4 py-3 rounded-2xl border border-sky-100 space-y-2">
                          <p className="text-xs font-black text-sky-800 flex items-center gap-1 justify-end">
                            <span>موقع الديوانية مسجّل ومفعّل حالياً بنجاح! ✅</span>
                          </p>
                          <p className="text-[10px] font-mono font-bold text-sky-600 tracking-tight">
                            إحداثيات: {Number(squadInfo.lat).toFixed(6)}, {Number(squadInfo.lng).toFixed(6)}
                          </p>
                          <button
                            type="button"
                            onClick={() => { window.location.href = `https://www.google.com/maps/search/?api=1&query=${squadInfo.lat},${squadInfo.lng}`; }}
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

                      {squadInfo.lat !== undefined && squadInfo.lng !== undefined && !showResetLocation ? (
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
                          onClick={handleRegisterLocation}
                          disabled={isRegisteringGeo}
                          className="w-full bg-stone-50 hover:bg-stone-100 border-2 border-stone-200/80 text-brand font-black text-xs py-3.5 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {isRegisteringGeo ? "جاري تثبيت الموقع... 🛰️" : (squadInfo.lat !== undefined ? "📍 تأكيد تغيير موقع الديوانية الحالي" : "📍 تعيين موقع الديوانية الجغرافي الحالي")}
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
                                    {isApproving[req.phone] ? "جاري..." : "قبول ✅"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-bold text-stone-400 text-center py-4">
                          لا توجد طلبات انضمام بالرادار حالياً. 
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
                        <p className="text-xs font-bold text-stone-500">تقدر تدخل بطريقتين: تسجل رقمك واسمك، أو تستخدم كود الضيف اللي يولّده المعزب.</p>
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
                          placeholder="اسمك"
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                        />
                        <input
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(normalizeDigits(e.target.value).replace(/[^0-9]/g, "").slice(0, 8))}
                          placeholder="رقم تلفونك 8 أرقام"
                          maxLength={8}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="w-full bg-white border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand focus:border-accent focus:outline-none transition-all text-right"
                        />
                        <button
                          onClick={() => handleJoinSquad(String(squadInfo.id))}
                          disabled={isSubmittingSquad}
                          className="w-full bg-accent text-white font-black text-sm py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isSubmittingSquad ? "جاري الانضمام..." : "انضم للديوانية الآن"}
                        </button>
                      </div>

                      <div className="rounded-[24px] border border-brand/10 bg-brand/[0.03] p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black bg-brand/10 text-brand px-2.5 py-1 rounded-full border border-brand/10">سريع ومباشر</span>
                          <h5 className="text-sm font-black text-brand">عندك كود دخول ساعتين؟</h5>
                        </div>
                        <p className="text-[11px] font-bold text-stone-500 leading-relaxed">إذا المعزب عطاك كود مؤقت، اكتب الكود هنا وادخل مباشرة بدون انتظار.</p>
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
                            {tempCodeLoading ? "جاري الدخول..." : "دخول بالكود"}
                          </button>
                        </div>
                        {tempCodeNeedsProfile && (
                          <div className="rounded-2xl bg-white border border-brand/10 p-3 space-y-2">
                            <div className="text-[11px] font-black text-brand text-right">ادخل اسمك ورقمك لإكمال الدخول للديوانية</div>
                            <input
                              value={tempJoinName}
                              onChange={(e)=>setTempJoinName(e.target.value)}
                              placeholder="اسمك"
                              className="w-full bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 text-sm font-bold text-brand text-right"
                            />
                            <input
                              inputMode="numeric"
                              value={tempJoinPhone}
                              onChange={(e)=>setTempJoinPhone(normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0,8))}
                              placeholder="رقم تلفونك 8 أرقام"
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
                      const v = normalizeDigits(e.target.value).replace(/[^0-9]/g, "").slice(0, 8);
                      setLoginPhone(v);
                      setGuestPhone(v);
                    }}
                    placeholder="8 أرقام"
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
                    <div className="text-[11px] font-black text-brand text-right">ادخل اسمك ورقمك لإكمال الدخول للديوانية</div>
                    <input
                      value={tempJoinName}
                      onChange={(e)=>setTempJoinName(e.target.value)}
                      placeholder="اسمك"
                      className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand text-right"
                    />
                    <input
                      inputMode="numeric"
                      value={tempJoinPhone}
                      onChange={(e)=>setTempJoinPhone(normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0,8))}
                      placeholder="رقم تلفونك 8 أرقام"
                      className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-4 py-3 text-sm font-bold text-brand text-right"
                    />
                  </div>
                )}
                <p className="text-[10px] font-bold text-stone-400 leading-relaxed">
                  اكتب الكود، وإذا ما كنت مسجل بنطلب اسمك ورقمك لإكمال الدخول.
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
            <Landmark className="w-5 h-5 text-accent" /> لوحة صدارة الدواوين
          </h4>
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden flex flex-col">
            {topSquads?.map((sq: any, idx: number) => {
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
                        {sqTier.name}
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
                          <span>{tier.icon}</span>
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
                        tier.icon
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
        </div>
      )}
    </div>
  );
};
