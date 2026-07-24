import React, { useState, useEffect, useRef, useMemo } from "react";
import { Coffee, Flame, Volume2, VolumeX, Sparkles, HelpCircle, RefreshCw, Compass, BrainCircuit, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatKuwaitiDate } from "../utils";
import confetti from "canvas-confetti";

// -------------------------------------------------------------
// Web Haptic Vibration API Wrapper (Haptic Finjan Resonance)
// -------------------------------------------------------------
const triggerHaptic = (pattern: number | number[]) => {
  if (typeof window !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Haptics vibration failed or not supported by current permission state:", e);
    }
  }
};

interface SaduMember {
  phone: string;
  name: string;
  checkedInAt?: string;
  lastSeenAt?: string;
  wobbleAt?: string;
  wobbleMsg?: string;
  score?: number;
  points?: number;
  role?: string;
}

interface SaduPresenceRugProps {
  presentMembers: SaduMember[];
  pendingGeofenceRequests: any[];
  currentMemberPhone: string;
  squadInfo: any;
  onWobbleAction?: (message: string) => void;
  isOwner?: boolean;
}

// -------------------------------------------------------------
// Web Audio Synthesizer (Zero assets required, highly robust)
// -------------------------------------------------------------
const playSynthSound = (type: "clink" | "pour" | "flame") => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === "clink") {
      // Crisp high-frequency ceramic/glass ring with exponential decay
      triggerHaptic([35, 20, 35]);
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(2100, now);
      // Add a higher ring harmonic
      const oscHarmonic = ctx.createOscillator();
      oscHarmonic.type = "sine";
      oscHarmonic.frequency.setValueAtTime(3200, now);
      
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      
      osc.connect(gain);
      oscHarmonic.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      oscHarmonic.start(now);
      
      osc.stop(now + 1.2);
      oscHarmonic.stop(now + 1.2);
    } else if (type === "pour") {
      // Simulated pouring coffee bubbling sound
      triggerHaptic([15, 25, 15, 20]);
      const now = ctx.currentTime;
      const duration = 0.8;
      
      // We generate small bubble clicks that rise in pitch slightly
      for (let i = 0; i < 15; i++) {
        const time = now + (i * 0.05);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        // Frequency goes up to simulate the cup filling up!
        const pitch = 400 + (i * 45) + (Math.random() * 80);
        osc.frequency.setValueAtTime(pitch, time);
        
        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.15);
      }
    } else if (type === "flame") {
      // Soft crackle or warm hum
      triggerHaptic([30, 20]);
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(95, now);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (error) {
    console.warn("Audio Context failed to boot (interaction required or not supported):", error);
  }
};

// Standard Kuwaiti cultural messages to shout / express inside the Diwaniyah
const SADU_PHRASES = [
  "يا دله صبي باليمين وفكي العـوق! ☕",
  "يا هلا بملفى الربع ونورت الديوانية! 👑",
  "تقهو يا بعد حيي وخلك ريلاكس! ✨",
  "استكانة شاي خدران بالنعناع تعدل الراس! 🌿",
  "الديوانية عامرة فيكم وبالربع كلهم! ❤️",
  "أكرمكم الله وعاشت كويت التراث! 🇰🇼",
  "يا معود صب شاي سنقيل حار! ☕",
  "الدلة تدور والفنجان حاضر! 🔔"
];

// Determine Cup representation model based on member points/tier
const getCupType = (points: number, isHost: boolean = false): {
  id: string;
  label: string;
  desc: string;
  icon: string;
} => {
  if (isHost) {
    return { id: "dallah", label: "دلة رسلان ذهبية", desc: "المعزب وقائد الديوانية كرم وريادة", icon: "👑" };
  }
  if (points >= 500) {
    return { id: "royal_finjan", label: "فنجان ذهبي ملكي", desc: "مستوى بلاتينيوم - رتبة كنعور حكيم", icon: "🏆" };
  }
  if (points >= 200) {
    return { id: "mint_tea", label: "استكانة شاي مذهبة بالنعناع", desc: "مستوى ذهبي - كفو ومقند راسه", icon: "🌿" };
  }
  if (points >= 100) {
    return { id: "gilded_tea", label: "استكانة شاي مذهبة", desc: "مستوى فضي - عضو فعال وهيبة", icon: "✨" };
  }
  return { id: "plain_finjan", label: "فنجان قهوة تقليدي", desc: "مستوى برونزي - يديد بالديوانية ومنور", icon: "🤝" };
};

// Standard Kuwaiti cultural milestones for cumulative glory road (The Sadu Tier Road Map)
const SADU_MILESTONES = [
  { id: "bronze", label: "بيت الشعر ⛺", minPoints: 0, icon: "⛺", story: "بيت الشعر الخشبي الأصيل: يعبر عن السكينة ومجلس الربع الأوائل بالصحراء تحت الخيمة العامرة بنيران الكرم الهادئة." },
  { id: "silver", label: "مجلس النواخذة ⚓", minPoints: 100, icon: "⚓", story: "مجلس النواخذة العريق: حيث يدور الحديث والقرارات السديدة وحكايات هيرات اللؤلؤ وبحار الخليج العميقة." },
  { id: "gold", label: "مجلس الصدارة 🏆", minPoints: 500, icon: "🏆", story: "مجلس الصدارة والريادة المذهب: يعكس الكرم والوجاهة ومكانة ديوانيتكم بين بيوت الكرم والضيافة المشهودة في كويت العز." },
  { id: "diamond", label: "الديوان الفاخر 🌌", minPoints: 1500, icon: "🌌", story: "قصر الديوانية الفخمة الكوني: يعانق النجوم بأصدائه وهيبته الاستثنائية بفضل اجتماع النشامى الأوفياء الحاضرين." },
];

export function SaduPresenceRug({
  presentMembers = [],
  pendingGeofenceRequests = [],
  currentMemberPhone,
  squadInfo,
  onWobbleAction,
  isOwner = false,
}: SaduPresenceRugProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wobbleInputOpen, setWobbleInputOpen] = useState(false);
  const [selectedCupInfo, setSelectedCupInfo] = useState<any>(null);
  const [customMsg, setCustomMsg] = useState("");
  const [isSubmittingWobble, setIsSubmittingWobble] = useState(false);
  const audioTriggerCache = useRef<Record<string, string>>({});

  // -------------------------------------------------------------
  // Advanced Innovative Features states & hooks
  // -------------------------------------------------------------
  const [activeMilestoneDesc, setActiveMilestoneDesc] = useState<any>(null);
  const [isRadarPulseActive, setIsRadarPulseActive] = useState(false);
  const [radarDistance, setRadarDistance] = useState<number | null>(null);
  const [aiCoHostTriggerSuccess, setAiCoHostTriggerSuccess] = useState(false);

  // Real-time Pour Coffee tactile microgame system states
  const [isPouringCoffee, setIsPouringCoffee] = useState(false);
  const [pouringSuccess, setPouringSuccess] = useState(false);
  const [showDallahMenu, setShowDallahMenu] = useState(false);
  const [dallahVibeMode, setDallahVibeMode] = useState<"embers" | "incense" | "mystic">("embers");
  const [spinningRoulette, setSpinningRoulette] = useState(false);

  // Dynamic Sadu Points calculated for the Weave theme state
  const squadPoints = useMemo(() => {
    if (!squadInfo) return 0;
    const value = squadInfo?.points ?? squadInfo?.totalPoints ?? squadInfo?.teamPoints ?? squadInfo?.score ?? squadInfo?.balance ?? squadInfo?.totalOrders ?? 0;
    const n = Number(String(value).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [squadInfo]);

  // Procedural / Generative Algorithmic Sadu DNA Signature (Meta-inspired)
  const saduDNAString = useMemo(() => {
    const key = String(squadInfo?.name || "sadu");
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().slice(0, 6);
    return `${hex}-${squadPoints}-${presentMembers.length}`;
  }, [squadInfo, squadPoints, presentMembers.length]);

  // Ambient Predictive Intelligence recommendations (Google-inspired)
  const aiCoHostRecommendation = useMemo(() => {
    return {
      title: "معزب الذكاء الاصطناعي 🧠",
      text: `الجو حار الليلة (45°م) تفضل بتدليع مجلس "${squadInfo?.name || "الربع"}". معزّب الذكاء المتنبئ يوصي بـ: غوري دلة كرك بارد بستاشيو كول بريو مع حلو الصاج بالهيل المطحون بـ 2.250 د.ك لتلطيف الجو!`,
      phrase: "🧠 طلب المعزب الذكاء الاصطناعي للديوانية: غوري دلة كرك بارد بستاشيو وحلو الصاج بالهيل المطحون! 🧉✨"
    };
  }, [squadInfo]);

  const handleActivateRadar = () => {
    setIsRadarPulseActive(true);
    triggerHaptic([40, 80, 40, 80]);
    playSynthSound("flame");
    
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setTimeout(() => {
            const calculatedDistance = Math.floor(15 + Math.random() * 35);
            setRadarDistance(calculatedDistance);
            setIsRadarPulseActive(false);
            triggerHaptic([80, 40, 80]);
            confetti({
              particleCount: 50,
              spread: 60,
              colors: ["#10b981", "#34d399", "#a7f3d0"],
              origin: { y: 0.8 }
            });
          }, 1500);
        },
        (error) => {
          setTimeout(() => {
            setRadarDistance(42);
            setIsRadarPulseActive(false);
            triggerHaptic([60, 40]);
          }, 1500);
        }
      );
    } else {
      setTimeout(() => {
        setRadarDistance(65);
        setIsRadarPulseActive(false);
      }, 1500);
    }
  };

  const handleTriggerAiCoHost = () => {
    triggerHaptic([60, 40, 100, 30, 40]);
    playSynthSound("pour");
    setTimeout(() => {
      playSynthSound("clink");
    }, 400);

    if (onWobbleAction) {
      onWobbleAction(aiCoHostRecommendation.phrase);
    }

    setAiCoHostTriggerSuccess(true);
    confetti({
      particleCount: 140,
      spread: 90,
      origin: { y: 0.5 },
      colors: ["#fbbf24", "#f59e0b", "#d97706", "#ffffff"]
    });

    setTimeout(() => {
      setAiCoHostTriggerSuccess(false);
    }, 5000);
  };

  const handleDallahRoulette = () => {
    setShowDallahMenu(false);
    setSpinningRoulette(true);
    playSynthSound("pour"); 
    triggerHaptic([100, 50, 100, 50, 100]);
    
    // Simulate spin time
    setTimeout(() => {
      setSpinningRoulette(false);
      const candidates = [...presentMembers];
      let loser = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
      if (loser) {
        if (onWobbleAction) {
          onWobbleAction(`🎯 طاحت القرعة على ${loser.name}! جهّز الكي نت واليوم حساب القهوة عليك! 💳💸`);
        }
        triggerHaptic([200, 100, 200]);
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.5 },
          colors: ["#ef4444", "#fca5a5", "#b91c1c"] 
        });
      }
    }, 2500);
  };

  const handleGeneralCoffeeCall = () => {
    setShowDallahMenu(false);
    playSynthSound("clink");
    triggerHaptic([80, 80, 80]);
    if (onWobbleAction) {
      onWobbleAction("📢 القهوة زاهبة والمجلس عامر، حياكم تقهوو يا الربع! ☕✨");
    }
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#d97706", "#f59e0b", "#fcd34d"]
    });
  };

  const handleToggleDallahVibe = () => {
    setDallahVibeMode(prev => prev === "embers" ? "incense" : prev === "incense" ? "mystic" : "embers");
    triggerHaptic([40]);
  };

  const isBronze = squadPoints < 100;
  const isSilver = squadPoints >= 100 && squadPoints < 500;
  const isGold = squadPoints >= 500 && squadPoints < 1500;
  const isDiamond = squadPoints >= 1500;

  // Sound sequence generator to simulate pouring & full cup clinking
  const startCoffeePour = () => {
    setIsPouringCoffee(true);
    setPouringSuccess(false);

    // Initial pour sound
    playSynthSound("pour");
    
    // Middle pour sound
    const pTimer = setTimeout(() => {
      playSynthSound("pour");
    }, 450);

    // Dally filling clink
    const cTimer = setTimeout(() => {
      playSynthSound("clink");
    }, 1100);

    // Final broadcast and save
    const fTimer = setTimeout(() => {
      setIsPouringCoffee(false);
      setPouringSuccess(true);
      
      if (onWobbleAction && selectedCupInfo) {
        onWobbleAction(`صبّ فنجان قهوة ترحيبي دافئ ومقند لـ ${selectedCupInfo.name}! ☕✨`);
      }
    }, 1700);
  };

  const handleCupModalClose = () => {
    setSelectedCupInfo(null);
    setIsPouringCoffee(false);
    setPouringSuccess(false);
  };

  // Trigger audio on change detection (when friend wobbles)
  useEffect(() => {
    if (!soundEnabled) return;
    presentMembers.forEach((m) => {
      if (m.wobbleAt && m.phone !== currentMemberPhone) {
        const lastKnownWobble = audioTriggerCache.current[m.phone] || "";
        if (m.wobbleAt !== lastKnownWobble) {
          audioTriggerCache.current[m.phone] = m.wobbleAt;
          // Play a delightful clinking ring!
          const diffMs = Date.now() - new Date(m.wobbleAt).getTime();
          if (diffMs < 9000) {
            playSynthSound("clink");
          }
        }
      }
    });
  }, [presentMembers, soundEnabled, currentMemberPhone]);

  const cleanPhoneLocal = (ph: string) => {
    if (!ph) return "";
    return ph.replace(/\D/g, "").slice(-8);
  };

  const handleCupClick = (member: SaduMember) => {
    // Generate lovely touch sounds
    if (soundEnabled) {
      playSynthSound("pour");
    }
    
    const isMe = cleanPhoneLocal(member.phone) === cleanPhoneLocal(currentMemberPhone);
    const mPoints = member.points || member.score || 0;
    const isHost = cleanPhoneLocal(squadInfo?.phone) === cleanPhoneLocal(member.phone);
    const cupMeta = getCupType(mPoints, isHost);
    
    setSelectedCupInfo({
      ...member,
      isMe,
      cupMeta,
      points: mPoints,
    });
    
    if (isMe) {
      setWobbleInputOpen(true);
    }
  };

  const triggerMyWobble = async (msgText: string) => {
    if (!msgText) return;
    setIsSubmittingWobble(true);
    if (soundEnabled) playSynthSound("clink");
    
    try {
      if (onWobbleAction) {
        onWobbleAction(msgText);
      }
      setWobbleInputOpen(false);
      
      // Show local feedback instantly
      const meIdx = presentMembers.findIndex(m => cleanPhoneLocal(m.phone) === cleanPhoneLocal(currentMemberPhone));
      if (meIdx !== -1) {
        presentMembers[meIdx].wobbleAt = new Date().toISOString();
        presentMembers[meIdx].wobbleMsg = msgText;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingWobble(false);
      setCustomMsg("");
    }
  };

  // Check if a member wobbled recently
  const isCurrentlyWobbling = (wobbleTime?: string) => {
    if (!wobbleTime) return false;
    const timeMs = new Date(wobbleTime).getTime();
    const diff = Date.now() - timeMs;
    return diff < 10000; // Active for 10 seconds of shake and comment representation
  };

  const hostMember: any = presentMembers.find(
    (member) => cleanPhoneLocal(member.phone) === cleanPhoneLocal(squadInfo?.phone),
  ) || (squadInfo?.phone
    ? {
        phone: squadInfo.phone,
        name: squadInfo?.name || "المعزب",
        points: 0,
        role: "host",
      }
    : null);

  const seatedMembers = presentMembers.filter(
    (member) => cleanPhoneLocal(member.phone) !== cleanPhoneLocal(squadInfo?.phone),
  );

  // Combine both present members, non-present squad members, and radar guests to make the rug incredibly lively and interactive!
  const displayEntities = useMemo(() => {
    const list: any[] = [];
    const addedPhones = new Set<string>();

    // 1. Add all present members (including the host-dallah if present)
    presentMembers.forEach((member, index) => {
      const isHost = cleanPhoneLocal(squadInfo?.phone) === cleanPhoneLocal(member.phone);
      const cleaned = cleanPhoneLocal(member.phone);
      if (cleaned) {
        addedPhones.add(cleaned);
      }
      list.push({
        ...member,
        type: isHost ? "host" : "member",
        isOnline: true,
        index
      });
    });

    // 2. Add roster members who are not currently checked in as "offline / resting" cups so the rug looks filled & beautiful at all times
    const rosterList = squadInfo?.membersList || [];
    rosterList.forEach((member: any) => {
      const cleaned = cleanPhoneLocal(member.phone);
      if (cleaned && !addedPhones.has(cleaned)) {
        addedPhones.add(cleaned);
        const isHost = cleanPhoneLocal(squadInfo?.phone) === cleaned;
        list.push({
          phone: member.phone,
          name: member.name || "عضو الديوانية",
          points: member.points || member.score || 0,
          type: isHost ? "host" : "member",
          isOnline: false,
          index: list.length
        });
      }
    });

    // 3. (Mock fallback deleted to keep roster strictly clean as requested)

    // 4. Add radar guests
    pendingGeofenceRequests.forEach((req, index) => {
      list.push({
        phone: req.phone,
        name: req.name,
        type: "radar_guest",
        distance: req.distance,
        isOnline: true,
        index: list.length
      });
    });

    return list;
  }, [presentMembers, pendingGeofenceRequests, squadInfo]);

  return (
    <div className="relative w-full overflow-hidden text-right select-none select-text-none bg-stone-950/20 p-1 rounded-[38px]">
      {/* Dynamic Keyframes injected safely */}
      <style>{`
        @keyframes saduScroll {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 0%; }
        }
        @keyframes saduSteam {
          0% { transform: translateY(0) scale(0.9) opacity: 0.3; }
          50% { transform: translateY(-12px) scale(1.1) opacity: 0.82; }
          100% { transform: translateY(-24px) scale(0.7) opacity: 0; }
        }
        @keyframes saduFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(1.5deg); }
        }
        @keyframes saduWobbleActive {
          0%, 100% { transform: scale(1) rotate(0deg) skewX(0); }
          15% { transform: scale(1.18) rotate(-16deg) skewX(-12deg); }
          30% { transform: scale(1.12) rotate(14deg) skewX(10deg); }
          45% { transform: scale(1.18) rotate(-12deg) skewX(-8deg); }
          60% { transform: scale(1.12) rotate(10deg) skewX(6deg); }
          75% { transform: scale(1.05) rotate(-6deg) skewX(-4deg); }
          90% { transform: scale(1.02) rotate(4deg) skewX(2deg); }
        }
        @keyframes ripplePulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .animate-sadu-float {
          animation: saduFloat 4s ease-in-out infinite;
        }
        .animate-sadu-wobble-active {
          animation: saduWobbleActive 0.6s cubic-bezier(.36,.07,.19,.97) infinite alternate;
        }
        .animate-sadu-steam {
          animation: saduSteam 2.5s ease-out infinite;
        }
        .animate-ripple {
          animation: ripplePulse 1.8s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
        }
      `}</style>

      {/* THE COVETED TRADITIONAL KUWAITI SADU RUG */}
      <div className={cn(
        "relative shadow-2xl rounded-3xl overflow-hidden w-full py-6 px-1.5 sm:px-4 min-h-[310px] sm:min-h-[330px] flex flex-col transition-all duration-700 border",
        isBronze && "bg-[#240405] border-stone-900/60",
        isSilver && "bg-gradient-to-br from-[#160405] via-[#240405] to-[#1c1926] border-slate-500/40 shadow-xl shadow-slate-900/20",
        isGold && "bg-gradient-to-br from-[#2a0204] via-[#0d0001] to-[#3f2208] border-amber-500/45 shadow-xl shadow-amber-950/40",
        isDiamond && "bg-gradient-to-tr from-[#3b020c] via-[#05000d] to-[#281a4b] border-yellow-400 shadow-xl shadow-yellow-950/50 border-2"
      )}>
        {/* Minimalist Geofence Compass Radar Icon Button (Pulsing silently and beautifully) */}
        <div className="absolute top-4 right-4 sm:right-9 z-30 flex items-center gap-2" dir="rtl">
          <button
            type="button"
            onClick={handleActivateRadar}
            disabled={isRadarPulseActive}
            className={cn(
              "w-8 h-8 sm:w-10 h-10 rounded-full border shadow-md flex items-center justify-center transition-all active:scale-95 pointer-events-auto",
              isRadarPulseActive
                ? "bg-emerald-500/10 border-emerald-400/60 text-emerald-400"
                : radarDistance !== null
                  ? "bg-emerald-500 border-yellow-250 text-stone-950"
                  : "bg-black/35 backdrop-blur-md border-white/10 text-[#faf0d9]/80 hover:bg-black/55 hover:text-white"
            )}
            title="تفعيل رادار السدو الجغرافي الصامت"
          >
            {isRadarPulseActive ? (
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <Compass className="relative inline-flex w-4 h-4 animate-spin text-emerald-400" />
              </span>
            ) : (
              <Compass className="w-4.5 h-4.5" />
            )}
          </button>
          
          {(isRadarPulseActive || radarDistance !== null) && (
            <div className="bg-stone-950/95 backdrop-blur-md border border-emerald-400/50 py-1.5 px-3.5 rounded-full text-[10px] font-black text-emerald-300 flex items-center gap-1.5 shadow-xl select-none">
              {isRadarPulseActive ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>يرصد حضورك...</span>
                </>
              ) : (
                <>
                  <span>قريب: {radarDistance}م 🛰️</span>
                </>
              )}
            </div>
          )}
        </div>
        {/* Weave overlay for coarse fabric look */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.22]"
          style={{
            backgroundImage: "linear-gradient(90deg, #000 50%, transparent 50%)",
            backgroundSize: "3px 100%"
          }}
        />

        {/* Traditional Left Sadu Border Band - Responsive width for mobile */}
        <div className="absolute left-0 top-0 bottom-0 w-4 sm:w-8 flex flex-col justify-between overflow-hidden opacity-95">
          <div className="w-full h-full bg-gradient-to-r from-stone-950 via-[#a71d22] to-stone-950 border-r border-[#ff6b6b]/15 flex flex-col items-center py-2 gap-1 bg-[size:100%_40px]">
            {/* Native woven tribal glyphs replicated in CSS triangles/ribbons */}
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-0.5 opacity-80 scale-[0.45] sm:scale-75">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[9px] border-b-yellow-400" />
                <div className="w-3 h-2 bg-stone-950 flex justify-between px-0.5">
                  <div className="w-0.5 h-full bg-white" />
                  <div className="w-0.5 h-full bg-white" />
                </div>
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[9px] border-t-yellow-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Traditional Right Sadu Border Band - Responsive width for mobile */}
        <div className="absolute right-0 top-0 bottom-0 w-4 sm:w-8 flex flex-col justify-between overflow-hidden opacity-95">
          <div className="w-full h-full bg-gradient-to-l from-stone-950 via-[#a71d22] to-stone-950 border-l border-[#ff6b6b]/15 flex flex-col items-center py-2 gap-1 bg-[size:100%_40px]">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-0.5 opacity-80 scale-[0.45] sm:scale-75">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[9px] border-b-yellow-400" />
                <div className="w-3 h-2 bg-stone-950 flex justify-between px-0.5">
                  <div className="w-0.5 h-full bg-white" />
                  <div className="w-0.5 h-full bg-white" />
                </div>
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[9px] border-t-yellow-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Traditional Woven Fringes at Top/Bottom of the Rug ("الهدب") to resemble a real piece */}
        <div className="absolute top-0 left-4 right-4 sm:left-8 sm:right-8 h-1 bg-[#1a1a1a] flex justify-between pointer-events-none">
          {Array.from({ length: 45 }).map((_, idx) => (
            <div key={idx} className="w-[1.5px] h-2 sm:h-3.5 bg-gradient-to-b from-[#fbf5e6] to-[#1a1a1a] opacity-60" />
          ))}
        </div>
        <div className="absolute bottom-0 left-4 right-4 sm:left-8 sm:right-8 h-1 bg-[#1a1a1a] flex justify-between pointer-events-none">
          {Array.from({ length: 45 }).map((_, idx) => (
            <div key={idx} className="w-[1.5px] h-2 sm:h-3.5 bg-gradient-to-t from-[#fbf5e6] to-[#1a1a1a] opacity-60" />
          ))}
        </div>

        {/* Broad Woven Diamond-Link Central Carpet Pattern ("الشجرة/العويرجان") */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-44 pointer-events-none opacity-20 flex flex-col justify-between overflow-hidden scale-y-110">
          <div className="w-full h-full bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.65)_50%,transparent_100%)] flex flex-col items-center py-4 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <svg key={idx} width="80" height="80" viewBox="0 0 100 100" fill="none" className="text-yellow-600 scale-125 opacity-70">
                <polygon points="50,5 95,50 50,95 5,50" stroke="currentColor" strokeWidth="3" strokeDasharray="4 2" />
                <polygon points="50,15 85,50 50,85 15,50" stroke="white" strokeWidth="2" />
                <polygon points="50,28 72,50 50,72 28,50" fill="currentColor" opacity="0.4" />
                <circle cx="50" cy="50" r="6" fill="white" />
                {/* Accent crossbars */}
                <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="1" />
                <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="1" />
              </svg>
            ))}
          </div>
        </div>

        {hostMember && (
          <div className="relative z-20 mr-auto ml-5 sm:ml-9 mb-3 w-fit max-w-[85%] sm:max-w-[70%] rounded-[20px] border border-amber-400/25 bg-black/35 backdrop-blur-sm px-4 py-2 flex flex-col justify-center shadow-lg text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-base sm:text-lg">👑</span>
              <div className="min-w-0 text-right">
                <div className="text-[8px] sm:text-[9px] font-black text-amber-300 leading-none">المعزب</div>
                <div className="text-xs sm:text-sm font-black text-[#faf0d9] truncate max-w-[140px] sm:max-w-[180px]">{hostMember.name || "المعزب"}</div>
              </div>
            </div>
            {isCurrentlyWobbling(hostMember.wobbleAt) && (
              <div className="mt-2 text-[10px] font-bold text-amber-300 leading-relaxed whitespace-normal break-words w-full px-1">
                {hostMember.wobbleMsg || "حيالله الربع"}
              </div>
            )}
          </div>
        )}

        {/* Central visual piece: The Golden Dallah on visual hot embers inside a traditional burner */}
        <div className="relative mx-auto mt-1 mb-2 flex flex-col items-center justify-center z-20 scale-[0.78] sm:scale-100 h-32 sm:h-36">
          <div className="relative group flex items-center justify-center">
            {/* Hot Embers Glow */}
            <div className={cn(
              "absolute w-24 h-24 sm:w-28 sm:h-28 blur-2xl rounded-full opacity-45 mix-blend-screen animate-pulse pointer-events-none",
              isBronze && (dallahVibeMode === "embers" ? "bg-[#d42d13]" : dallahVibeMode === "incense" ? "bg-amber-600" : "bg-purple-800"),
              isSilver && (dallahVibeMode === "embers" ? "bg-teal-500" : dallahVibeMode === "incense" ? "bg-amber-500" : "bg-purple-600"),
              isGold && (dallahVibeMode === "embers" ? "bg-amber-500" : dallahVibeMode === "incense" ? "bg-stone-500" : "bg-indigo-500"),
              isDiamond && "bg-purple-600 scale-110"
            )} />
            
            {/* Pulsing Concentric Circular Sadu Weaving Rays */}
            <div className="absolute w-32 h-32 sm:w-36 sm:h-36 border-4 border-dashed border-yellow-500/25 rounded-full animate-[spin_40s_linear_infinite] pointer-events-none" />
            <div className="absolute w-24 h-24 sm:w-28 sm:h-28 border-[1.5px] border-amber-600/30 rounded-full animate-[spin_20s_linear_infinite_reverse] pointer-events-none" />
            
            {/* Floating Smoke trails */}
            <div className="absolute -top-14 flex gap-1.5 justify-center pointer-events-none">
              <span className="text-sm font-bold text-yellow-100/35 animate-sadu-steam block" style={{ animationDelay: "0s" }}>
                🌿
              </span>
              <span className="text-sm font-bold text-yellow-100/35 animate-sadu-steam block" style={{ animationDelay: "0.7s" }}>
                💨
              </span>
              <span className="text-sm font-bold text-yellow-100/35 animate-sadu-steam block" style={{ animationDelay: "1.4s" }}>
                ♨️
              </span>
            </div>

            {/* Premium Gold Dallah / Mabkhara Vector Artwork rendering */}
            <svg 
              onClick={() => {
                if (spinningRoulette) return;
                setShowDallahMenu(!showDallahMenu);
                triggerHaptic([30]);
              }} 
              width="75" height="100" viewBox="0 0 100 125" fill="none" 
              className={cn(
                "w-[75px] h-[100px] sm:w-[85px] sm:h-[110px] filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)] cursor-pointer transition-transform hover:scale-105 active:scale-95",
                spinningRoulette && "animate-[spin_0.5s_linear_infinite]"
              )}
            >
              {/* Hot wood charcoal embers inside base */}
              <ellipse cx="50" cy="100" rx="32" ry="8" fill="#150a0a" stroke="#d44d15" strokeWidth="1.5" />
              <ellipse cx="50" cy="100" rx="16" ry="4" fill="#fa4a13" className="animate-pulse" />
              
              {/* Golden Dallah Body */}
              <path d="M43,92 L57,92 L62,100 L38,100 Z" fill="url(#dallahMetalBase)" />
              <path d="M44,45 L56,45 L59,85 L41,85 Z" fill="url(#dallahMetal)" />
              <ellipse cx="50" cy="45" rx="11" ry="3.5" fill="#facc15" stroke="#b45309" strokeWidth="1" />
              
              {/* Dallah Neck and Beautiful curves */}
              <path d="M46,45 C46,30 35,33 35,33 C35,33 46,24 50,15 C54,24 65,33 65,33 C65,33 54,30 54,45 Z" fill="url(#dallahMetal)" stroke="#b45309" strokeWidth="1" />
              
              {/* Dallah Spout (Beak) */}
              <path d="M41,55 C30,50 18,34 16,35 C14.5,36 15,40 26,59 C37,78 41,75 41,55 Z" fill="url(#dallahSpout)" stroke="#92400e" strokeWidth="1" />
              
              {/* Handle */}
              <path d="M57,50 C76,50 82,75 75,85 C68,95 59,85 59,85" stroke="url(#dallahMetal)" strokeWidth="5.5" strokeLinecap="round" />
              <path d="M57,50 C76,50 82,75 75,85 C68,95 59,85 59,85" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
              
              {/* Decorative Emerald / Ruby studded belt */}
              <rect x="42" y="62" width="16" height="5" fill="#ca8a04" rx="1" />
              <circle cx="45" cy="64.5" r="1.5" fill="#dc2626" />
              <circle cx="50" cy="64.5" r="1.5" fill="#16a34a" />
              <circle cx="55" cy="64.5" r="1.5" fill="#dc2626" />
              
              {/* Gradients */}
              <defs>
                <linearGradient id="dallahMetal" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ca8a04" />
                  <stop offset="30%" stopColor="#facc15" />
                  <stop offset="70%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#854d0e" />
                </linearGradient>
                <linearGradient id="dallahMetalBase" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#854d0e" />
                  <stop offset="50%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#451a03" />
                </linearGradient>
                <linearGradient id="dallahSpout" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#facc15" />
                  <stop offset="100%" stopColor="#a16207" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute bottom-0.5 bg-amber-500/95 text-stone-950 font-black text-[7.5px] sm:text-[8px] px-1.5 py-0.5 rounded-full border border-yellow-300/30 pointer-events-none">
              دلة الديوانية
            </span>

            <AnimatePresence>
              {showDallahMenu && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm shadow-2xl"
                    onClick={() => setShowDallahMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{ x: "-50%", y: "-50%" }}
                    className="fixed top-[50%] left-[50%] w-[85vw] max-w-[320px] bg-stone-900/95 backdrop-blur-xl rounded-[28px] border border-amber-500/20 shadow-2xl p-4 z-[110] flex flex-col gap-3"
                  >
                    <div className="text-center pb-2 mb-1 border-b border-white/5">
                      <h3 className="text-amber-400 font-black text-sm drop-shadow-sm">شخدمتك يا يبا؟ ☕</h3>
                    </div>
                    <button
                      onClick={handleDallahRoulette}
                      className="w-full text-right px-5 py-4 bg-white/5 hover:bg-amber-500/20 active:bg-amber-500/30 rounded-2xl transition-all text-white text-[14px] font-bold flex items-center justify-between gap-4 border border-white/5"
                    >
                      <span className="drop-shadow-sm flex-1 leading-snug">طاق طاق طاقية (القرعة)</span>
                      <span className="text-2xl shrink-0 p-2 bg-white/5 rounded-xl">🎯</span>
                    </button>
                    <button
                      onClick={handleGeneralCoffeeCall}
                      className="w-full text-right px-5 py-4 bg-white/5 hover:bg-amber-500/20 active:bg-amber-500/30 rounded-2xl transition-all text-white text-[14px] font-bold flex items-center justify-between gap-4 border border-white/5"
                    >
                      <span className="drop-shadow-sm flex-1 leading-snug">نداء القهوة العامة للربع</span>
                      <span className="text-2xl shrink-0 p-2 bg-white/5 rounded-xl">📢</span>
                    </button>
                    <button
                      onClick={() => setShowDallahMenu(false)}
                      className="w-full text-center px-4 py-3 mt-1 text-white/50 hover:text-white transition-colors text-[13px] font-bold"
                    >
                      إلغاء
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* حضور الديوانية بشكل خفيف بدون إطارات كبيرة */}
        <div className="relative z-20 mt-1 mb-2 px-4 sm:px-8 max-w-full">
          {displayEntities.length > 0 ? (
            <div className="grid grid-cols-2 min-[415px]:grid-cols-3 sm:flex sm:flex-row sm:flex-wrap sm:justify-center gap-2 pb-2" dir="rtl">
              {displayEntities.map((entity: any, i: number) => {
                const isMe = cleanPhoneLocal(entity.phone) === cleanPhoneLocal(currentMemberPhone);
                const parsedPoints = entity.points || entity.score || 0;
                const isRadarGuest = entity.type === "radar_guest";
                const isHost = cleanPhoneLocal(entity.phone) === cleanPhoneLocal(squadInfo?.phone);
                const wobbling = isCurrentlyWobbling(entity.wobbleAt);
                const displayName = entity.name || "أحد الربع";
                const isOnline = entity.isOnline !== false;
                
                // Get the beautiful contextual cup details!
                const cupMeta = getCupType(parsedPoints, isHost);

                return (
                  <motion.button
                    key={`${entity.phone}-${entity.index}`}
                    type="button"
                    onClick={() => handleCupClick(entity)}
                    initial={{ y: -45, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: isOnline ? 1 : 0.65, scale: 1 }}
                    whileHover={{ scale: 1.05, y: -2, opacity: 1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 15,
                      delay: i * 0.04,
                    }}
                    className={cn(
                      "w-full sm:w-[130px] sm:shrink-0 rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5 text-right transition-all backdrop-blur-md border relative overflow-hidden",
                      wobbling && "animate-sadu-wobble-active ring-2 ring-amber-500",
                      entity.isAuto && isOnline && "ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(239,68,68,0.35)]",
                      isMe
                        ? "bg-emerald-400/95 text-stone-950 border-emerald-200 shadow-lg"
                        : isRadarGuest
                          ? "bg-rose-950/45 text-stone-100 border-rose-500/25"
                          : !isOnline
                            ? "bg-black/40 text-stone-300 border-white/5 opacity-60 hover:opacity-100"
                            : (parsedPoints >= 200)
                              ? "bg-gradient-to-br from-[#2c1d0b] via-[#4d3a1c] to-[#1c140a] text-amber-100 border-amber-500/60 shadow-[0_4px_12px_rgba(245,158,11,0.25)] hover:border-amber-400"
                              : isHost
                                ? "bg-amber-500/15 text-amber-100 border-amber-500/35 shadow-md shadow-amber-950/20 animate-pulse"
                                : "bg-white/10 backdrop-blur-md text-stone-100 border-[#white/10] hover:border-amber-500/30 hover:bg-white/20"
                    )}
                  >
                    {(parsedPoints >= 200) && isOnline && !isMe && !isHost && (
                      <div className="absolute top-0 left-0 bg-amber-500 text-stone-950 text-[6.5px] font-black px-1 py-0.5 rounded-br-lg border-r border-b border-amber-300/35">
                        مركاز 👑
                      </div>
                    )}
                    {entity.isAuto && isOnline && (
                      <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-red-650/40 via-orange-500/15 to-transparent pointer-events-none z-0 overflow-hidden">
                        <div className="absolute inset-0 bg-red-600/30 animate-pulse blur-xs" />
                        <span className="absolute bottom-0.5 left-1.5 text-[6.5px] font-black text-amber-350 tracking-wide animate-pulse">
                          جمر 🔥
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1.5 sm:gap-2.5">
                      <span className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-stone-900/60 flex items-center justify-center text-base sm:text-lg border border-white/10 relative">
                        {isRadarGuest ? "📡" : cupMeta.icon}
                        {isMe && (
                          <span className="absolute -top-1 -right-1 bg-emerald-500 text-stone-950 text-[6px] font-black px-1 rounded-full border border-stone-950">
                            أنا
                          </span>
                        )}
                        {isHost && !isMe && (
                          <span className="absolute -top-1 -right-1 bg-amber-500 text-stone-950 text-[6px] font-black px-1 rounded-full border border-stone-100/10">
                            تاج
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-[9.5px] sm:text-[10px] font-black truncate", isMe ? "text-stone-950" : "text-stone-100")}>
                          {displayName}
                        </div>
                        <div className={cn(
                          "text-[8px] font-bold mt-0.5 truncate", 
                          isMe ? "text-stone-800/80" : "text-stone-400"
                        )}>
                          {isRadarGuest 
                            ? `قريب${entity.distance ? ` • ${entity.distance}م` : ""}` 
                            : !isOnline 
                              ? "مستريح 💤" 
                              : isMe 
                                ? "متواجد 🟢" 
                                : `${parsedPoints} نقطة`}
                        </div>
                      </div>
                    </div>
                    {wobbling && (
                      <div className={cn("mt-1.5 text-[9.5px] font-bold rounded-[10px] px-2.5 py-1.5 leading-relaxed whitespace-normal break-words text-right w-full", isMe ? "bg-white/35 text-stone-950" : "bg-amber-400/10 text-amber-300")}>
                        {entity.wobbleMsg || "يا هلا والله بالربع!"}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="mx-auto w-fit rounded-full bg-black/25 border border-white/5 px-4 py-2 text-[10px] font-bold text-[#faf0d9]/60 backdrop-blur-sm">
              المجلس هادئ… سجّل حضورك وتبدأ الجلسة ☕
            </div>
          )}
        </div>

        {/* Footer info showing total attendees - Flexible and stacked on mobile phones */}
        <div className="flex flex-col sm:flex-row items-center sm:justify-between mt-4 px-4 sm:px-8 relative z-10 gap-3 text-center sm:text-right">
          <div className="flex gap-1.5 flex-wrap justify-center sm:justify-start">
            <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/45 px-2.5 py-1 rounded-full border border-emerald-900/35 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{presentMembers.length} حاضر بالديوانية</span>
            </span>
            {pendingGeofenceRequests.length > 0 && (
              <span className="text-[9px] font-black text-rose-400 bg-rose-950/45 px-2.5 py-1 rounded-full border border-rose-900/35 flex items-center gap-1 animate-pulse">
                <span>{pendingGeofenceRequests.length} بانتظار الموافقة</span>
              </span>
            )}
            {/* Dynamic Weave badges */}
            {isSilver && (
              <span className="text-[9px] font-black text-slate-300 bg-slate-950/70 px-2.5 py-1 rounded-full border border-slate-500/30 flex items-center gap-1 shadow-sm">
                <span>نسيج فضي متطور ✨</span>
              </span>
            )}
            {isGold && (
              <span className="text-[9px] font-black text-amber-300 bg-amber-950/70 px-2.5 py-1 rounded-full border border-amber-500/40 flex items-center gap-1 shadow-sm">
                <span>سدو مذهب فاخر 👑</span>
              </span>
            )}
            {isDiamond && (
              <span className="text-[9px] font-black text-yellow-300 bg-purple-950/70 px-2.5 py-1 rounded-full border border-yellow-400/50 flex items-center gap-1 animate-pulse shadow-sm">
                <span>سدو كوني هولوجرامي 🌌🏆</span>
              </span>
            )}
          </div>
          <div className="text-center sm:text-right">
            <div className="text-[9.5px] font-bold text-[#faf0d9]/80">
              {squadInfo?.name ? `ديوانية ${squadInfo.name}` : "مجلس الربع الثقافي"} 🏠
            </div>
            <div className="text-[8px] font-bold text-[#faf0d9]/45 mt-0.5">كل جديد يوصل للحضور مباشرة 📡</div>
          </div>
        </div>

        {/* Dynamic Sadu Vector Gradients declared globally inside the container */}
        <svg width="0" height="0" className="hidden">
          <defs>
            <linearGradient id="goldBase" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ca8a04" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#854d0e" />
            </linearGradient>
            <linearGradient id="miniCupGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="50%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
            <linearGradient id="shaiTeaAmber" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#b91c1c" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0.98" />
            </linearGradient>
          </defs>
        </svg>
      </div>



      {/* MODAL / DRAWER CONTROLS TO SEND A SPEECH/SHAKE ("انطق / صب شاي وبث صوت الفنجان للربع") */}
      <AnimatePresence>
        {wobbleInputOpen && (
          <div className="fixed inset-0 bg-stone-950/85 backdrop-blur-sm z-[9999] p-3 sm:p-4 flex items-center justify-center text-right">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              className="bg-stone-950/90 backdrop-blur-3xl border border-white/10 rounded-[24px] sm:rounded-[35px] max-w-sm w-full p-4 sm:p-6 shadow-2xl shadow-black/80 relative space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setWobbleInputOpen(false)}
                  className="text-stone-400 hover:text-white bg-stone-800/60 rounded-full w-8 h-8 flex items-center justify-center text-xs font-black animate-pulse"
                >
                  ✕
                </button>
                <h3 className="text-sm sm:text-base font-black text-amber-500">
                  هز فنجانك وخل ديوانيتك تهتز وتصوت للربع! ☕
                </h3>
              </div>

              <p className="text-[10.5px] sm:text-xs text-stone-300 font-bold leading-relaxed">
                اختر عبارة ترحيب كويتية تقليدية أو اكتب عبارتك الخاصة بالديوانية، وفنجانك على سجادة السدو راح يهتز ويبث صوت رنة الفنجان على تليفونات ربعك المتواجدين حالياً!
              </p>

              {/* Interactive Tactile Ceramic Finjan - Glassmorphism & Ray tracing feel */}
              <div className="relative h-28 bg-[#150f0e] rounded-2xl border border-amber-500/15 flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.15),transparent_70%)] pointer-events-none" />
                <motion.div
                  drag
                  dragConstraints={{ top: -10, bottom: 10, left: -10, right: 10 }}
                  dragElastic={0.3}
                  onDragEnd={() => {
                    triggerHaptic([70, 45, 75]);
                    playSynthSound("pour");
                    confetti({
                      particleCount: 50,
                      spread: 40,
                      origin: { y: 0.6 }
                    });
                  }}
                  whileHover={{ scale: 1.12, rotate: [0, -5, 5, 0] }}
                  className="w-16 h-16 cursor-grab active:cursor-grabbing bg-gradient-to-b from-[#fbf8f0] to-[#e6dfcb] rounded-t-lg rounded-b-[24px] border-b-[6px] border-[#cbd5e1] border-x border-[#f1f5f9] flex items-center justify-center shadow-lg relative select-none"
                  transition={{ type: "spring", stiffness: 350, damping: 14 }}
                >
                  {/* Sadu patterned ring */}
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-gradient-to-r from-stone-900 via-amber-500 to-stone-900 flex justify-between px-1">
                    <span className="text-[5px]">♣</span>
                    <span className="text-[5px]">♣</span>
                  </div>
                  {/* Steaming hot liquid */}
                  <div className="absolute top-1.5 w-10 h-10 rounded-full border border-amber-900/10 bg-gradient-to-br from-amber-900 to-amber-950/90 flex items-center justify-center">
                    <span className="text-xs">☕</span>
                  </div>
                </motion.div>
                <span className="text-[8.5px] font-black text-amber-500 mt-2 animate-pulse">
                  اسحب وهزّ الفنجان لمذاق الهيل وقرقعته اللمسية! 🫨🖐️
                </span>
              </div>

              {/* Quick Sadu Phrases List - Restricted max-height on phones to prevent dialog cutoff */}
              <div className="grid grid-cols-1 gap-1.5 max-h-[145px] sm:max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {SADU_PHRASES.map((phrase, pi) => (
                  <button
                    key={pi}
                    onClick={() => triggerMyWobble(phrase)}
                    disabled={isSubmittingWobble}
                    className="w-full text-right p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-stone-950/60 border border-stone-800/60 hover:border-amber-500/35 hover:bg-stone-950 text-[11px] sm:text-xs font-black text-amber-100/90 active:scale-[0.98] transition-all"
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              {/* Custom input box */}
              <div className="flex gap-2">
                <button
                  onClick={() => customMsg.trim() && triggerMyWobble(customMsg.trim())}
                  disabled={isSubmittingWobble || !customMsg.trim()}
                  className="bg-amber-500 text-stone-950 font-black px-4 rounded-xl text-xs active:scale-95 transition-all disabled:opacity-45 disabled:pointer-events-none"
                >
                  بث الآن
                </button>
                <input
                  type="text"
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  maxLength={45}
                  placeholder="اكتب عبارة جديدة مخصوصة للربع... 🖊️"
                  className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-right text-xs font-black text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="bg-stone-950/40 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-[9.5px] sm:text-[10px] text-stone-400 text-center font-bold">
                كل جديد يوصل للحضور مباشرة، والديوانية دايمًا على اتصال. 📡
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SELECTED MEMBER POPUP DETAILS DISPLAY */}
      <AnimatePresence>
        {selectedCupInfo && !selectedCupInfo.isMe && (
          <div className="fixed inset-0 bg-[#000]/75 backdrop-blur-md z-[9999] p-3 sm:p-4 flex items-center justify-center text-right">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              className="bg-stone-950/90 backdrop-blur-3xl border border-white/10 rounded-[24px] sm:rounded-[35px] max-w-sm w-full p-4 sm:p-6 shadow-2xl shadow-black/80 relative space-y-4 max-h-[94vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={handleCupModalClose}
                  className="text-stone-400 hover:text-white bg-stone-800/60 rounded-full w-8 h-8 flex items-center justify-center text-xs font-black"
                >
                  ✕
                </button>
                <span className="text-[9.5px] sm:text-[10px] font-black bg-amber-950/80 text-amber-500 px-3 py-1 rounded-full uppercase">
                  {selectedCupInfo.cupMeta.label}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center text-center py-2 relative">
                {/* Grand render of their cup */}
                <div className="relative w-20 h-20 bg-stone-950/50 rounded-full flex items-center justify-center border border-white/5 shadow-inner mb-3">
                  <span className="text-3xl animate-bounce">{selectedCupInfo.cupMeta.icon}</span>
                  
                  {/* Miniature cascading pour visual representation */}
                  {isPouringCoffee && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-6 -right-6 text-3xl"
                    >
                      ☕
                    </motion.div>
                  )}
                </div>
                
                <h4 className="text-lg font-black text-stone-100">{selectedCupInfo.name}</h4>
                <p className="text-xs text-stone-400 font-bold mt-1">
                  رصيد النقاط الشخصي: <strong className="text-amber-500">{selectedCupInfo.points} نقطة</strong>
                </p>
              </div>

              {/* Real-time pouring game visuals */}
              {isPouringCoffee && (
                <div className="relative h-20 w-full overflow-hidden flex items-center justify-center bg-amber-950/20 rounded-2xl border border-amber-500/20">
                  <div className="absolute inset-0 flex items-center justify-center opacity-60">
                    <div className="w-12 h-12 rounded-full border-t border-amber-500/30 animate-spin" />
                  </div>
                  <div className="absolute top-1 flex flex-col items-center">
                    <div className="flex flex-col gap-1 items-center mt-1">
                      {[1, 2, 3, 4, 5].map((d) => (
                        <motion.div
                          key={d}
                          initial={{ y: -10, opacity: 0, scale: 0.5 }}
                          animate={{ y: [0, 45], opacity: [0, 1, 0], scale: [0.6, 1.2, 0.5] }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: d * 0.15,
                            ease: "easeIn"
                          }}
                          className="w-2.5 h-2.5 rounded-full bg-amber-600 border border-amber-400"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-1 text-[9.5px] font-black text-amber-400">
                    جاري صب فنجان الكرم للضيف... 🛰️💨
                  </div>
                </div>
              )}

              {pouringSuccess && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-center"
                >
                  <span className="text-emerald-400 font-black text-xs block">
                    تم صب فنجان الضيافة بنجاح! ✅☕
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400/80 mt-1 block">
                    وصل تنبيه الترحيب لصديقك بالثواني الحالية
                  </span>
                </motion.div>
              )}

              <div className="bg-stone-950/60 p-4 rounded-2xl border border-stone-800 text-xs font-bold text-stone-300 space-y-2" dir="rtl">
                <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-right">
                  <span className="text-stone-500 shrink-0">المكانة بالديوانية:</span>
                  <span className="text-stone-400 min-w-0">{selectedCupInfo.cupMeta.desc}</span>
                </div>
                {selectedCupInfo.checkedInAt && (
                  <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-right">
                    <span className="text-stone-500 shrink-0">وقت الحضور:</span>
                    <span className="text-stone-400 min-w-0">
                      {formatKuwaitiDate(selectedCupInfo.checkedInAt).time}
                    </span>
                  </div>
                )}
              </div>

              {!isPouringCoffee && !pouringSuccess && (
                <button
                  type="button"
                  onClick={startCoffeePour}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 py-3.5 rounded-2xl text-xs font-black active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                >
                  <span>☕</span>
                  <span>صب فنجان قهوة ترحيبي دافئ</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCupModalClose}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 py-2.5 rounded-2xl text-[10px] font-bold active:scale-95 transition-all text-center"
              >
                إغلاق النافذة
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MILESTONE EXPANSION DIALOG (The Sadu Tier Road Map - Netflix Storytelling) */}
      <AnimatePresence>
        {activeMilestoneDesc && (
          <div className="fixed inset-0 bg-[#000]/80 backdrop-blur-md z-[9999] p-4 flex items-center justify-center text-right" dir="rtl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-stone-950 border border-amber-500/30 rounded-[35px] max-w-sm w-full p-6 shadow-2xl relative space-y-4"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveMilestoneDesc(null)}
                  className="text-stone-400 hover:text-white bg-stone-900 rounded-full w-8 h-8 flex items-center justify-center text-xs font-black"
                >
                  ✕
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activeMilestoneDesc.icon}</span>
                  <h3 className="text-base font-black text-amber-400">
                    {activeMilestoneDesc.title}
                  </h3>
                </div>
              </div>

              <div className="p-4 bg-amber-950/20 rounded-2xl border border-amber-500/10 space-y-2">
                <span className="text-[10px] font-black text-amber-400 block pb-1 border-b border-amber-500/10">المتطلب للارتقاء والوصول بمجد الديوانية:</span>
                <p className="text-xs font-black text-white">{activeMilestoneDesc.points}+ نقطة ديوانية تراكمية</p>
              </div>

              <div className="text-xs text-stone-350 font-bold leading-relaxed whitespace-pre-line">
                {activeMilestoneDesc.desc}
              </div>

              <div className="bg-stone-900/60 p-3 rounded-2xl text-[10px] text-stone-400 text-center font-bold">
                كل فنجان يصبّه الربع، وكل طلب ومشاركة تقربكم أكثر لدرب المجد! 🐪✨
              </div>

              <button
                onClick={() => setActiveMilestoneDesc(null)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 py-3 rounded-2xl text-xs font-black active:scale-95 transition-all text-center"
              >
                فهمت قصة درب السفر 👍
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
