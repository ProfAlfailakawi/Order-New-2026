import React, { useState, useEffect, useRef } from "react";
import { Coffee, Flame, Volume2, VolumeX, Sparkles, HelpCircle, RefreshCw } from "lucide-react";
import { cn } from "../utils";

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
  "يا هلا بملفى الربع وسفير الدوانية! 👑",
  "تقهو يا بعد حيي وخلك ريلاكس! ✨",
  "استكانة شاي خدران بالنعناع تعدل الراس! 🌿",
  "الديوانية عامرة بأهلها والربع كلهم! ❤️",
  "أكرمكم الله وعاشت كويت التراث! 🇰🇼",
  "يا معود صب شاي سنقيل حار! ☕",
  "الدلة تدور والفنجان رنان! 🔔"
];

// Determine Cup representation model based on member points/tier
const getCupType = (points: number, isHost: boolean = false): {
  id: string;
  label: string;
  desc: string;
  icon: string;
} => {
  if (isHost) {
    return { id: "dallah", label: "دلة رسلان ذهبية", desc: "المعزب وقائد الدوانية كرم وريادة", icon: "👑" };
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
  return { id: "plain_finjan", label: "فنجان قهوة تقليدي", desc: "مستوى برونزي - يديد بالدوانية ومنور", icon: "🤝" };
};

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

  const displayEntities = [
    ...seatedMembers.map((member, index) => ({ ...member, type: "member", index })),
    ...pendingGeofenceRequests.map((req, index) => ({
      phone: req.phone,
      name: req.name,
      type: "radar_guest",
      distance: req.distance,
      index: seatedMembers.length + index,
    })),
  ];

  return (
    <div className="relative w-full overflow-hidden text-right select-none select-text-none">
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

      {/* Control panel and headers */}
      <div className="flex items-center justify-between mb-3 px-3">
        <button
          onClick={() => {
            setSoundEnabled(p => !p);
            if (!soundEnabled) playSynthSound("clink");
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-tight border active:scale-95 transition-all text-stone-300 border-stone-800 bg-stone-900/40 hover:text-white"
          )}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>صوت الفناجين شغال</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-stone-500" />
              <span>فناجين صامتة</span>
            </>
          )}
        </button>

        <div className="flex flex-col text-right">
          <span className="text-[10.5px] font-black text-amber-500 flex items-center gap-1 justify-end uppercase tracking-wider">
            سجادة السدو المباشرة 📡 <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
          </span>
          <p className="text-[10px] font-bold text-stone-400 mt-0.5">جلسة تفاعلية حية تدردش بالفناجين والقدوع مع الربع</p>
        </div>
      </div>

      {/* THE COVETED TRADITIONAL KUWAITI SADU RUG */}
      <div className="relative shadow-2xl rounded-3xl border border-stone-900/60 overflow-hidden bg-[#240405] w-full py-7 px-4 min-h-[440px] flex flex-col justify-between">
        {/* Weave overlay for coarse fabric look */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.22]"
          style={{
            backgroundImage: "linear-gradient(90deg, #000 50%, transparent 50%)",
            backgroundSize: "3px 100%"
          }}
        />

        {/* Traditional Left Sadu Border Band */}
        <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between overflow-hidden opacity-95">
          <div className="w-full h-full bg-gradient-to-r from-stone-950 via-[#a71d22] to-stone-950 border-r border-[#ff6b6b]/15 flex flex-col items-center py-2 gap-1 bg-[size:100%_40px]">
            {/* Native woven tribal glyphs replicated in CSS triangles/ribbons */}
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-0.5 opacity-80 scale-75">
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

        {/* Traditional Right Sadu Border Band */}
        <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-between overflow-hidden opacity-95">
          <div className="w-full h-full bg-gradient-to-l from-stone-950 via-[#a71d22] to-stone-950 border-l border-[#ff6b6b]/15 flex flex-col items-center py-2 gap-1 bg-[size:100%_40px]">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-0.5 opacity-80 scale-75">
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
        <div className="absolute top-0 left-8 right-8 h-1 bg-[#1a1a1a] flex justify-between pointer-events-none">
          {Array.from({ length: 60 }).map((_, idx) => (
            <div key={idx} className="w-[1.5px] h-3.5 bg-gradient-to-b from-[#fbf5e6] to-[#1a1a1a] opacity-60" />
          ))}
        </div>
        <div className="absolute bottom-0 left-8 right-8 h-1 bg-[#1a1a1a] flex justify-between pointer-events-none">
          {Array.from({ length: 60 }).map((_, idx) => (
            <div key={idx} className="w-[1.5px] h-3.5 bg-gradient-to-t from-[#fbf5e6] to-[#1a1a1a] opacity-60" />
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
          <div className="absolute top-9 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[220px] px-3">
            {isCurrentlyWobbling(hostMember.wobbleAt) && (
              <div className="mb-2 bg-stone-950/95 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-2xl text-[9px] font-black shadow-xl text-center leading-snug">
                {hostMember.wobbleMsg || "حيالله الربع، المجلس منوّر!"}
              </div>
            )}
            <div className="rounded-[24px] border border-amber-400/20 bg-stone-950/75 backdrop-blur-md px-4 py-3 shadow-2xl text-center min-w-[170px]">
              <div className="flex items-center justify-center gap-2 text-[10px] font-black text-amber-300 mb-1">
                <span>👑</span>
                <span>المعزب</span>
                <span>🪔</span>
              </div>
              <div className="inline-flex items-center justify-center rounded-full bg-emerald-400 text-stone-950 px-4 py-1 text-sm font-black shadow-md max-w-full truncate">
                {hostMember.name || "المعزب"}
              </div>
              <div className="mt-1 text-[9px] font-bold text-stone-300">راعي الديوانية ومضيف الربع</div>
            </div>
          </div>
        )}

        {/* Central visual piece: The Golden Dallah on visual hot embers inside a traditional burner */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none z-10 scale-90 sm:scale-100">
          <div className="relative group flex items-center justify-center">
            {/* Hot Embers Glow */}
            <div className="absolute w-28 h-28 bg-[#d42d13] blur-2xl rounded-full opacity-45 mix-blend-screen animate-pulse" />
            
            {/* Pulsing Concentric Circular Sadu Weaving Rays */}
            <div className="absolute w-36 h-36 border-4 border-dashed border-yellow-500/25 rounded-full animate-[spin_40s_linear_infinite]" />
            <div className="absolute w-28 h-28 border-[1.5px] border-amber-600/30 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
            
            {/* Floating Smoke trails */}
            <div className="absolute -top-14 flex gap-1.5 justify-center">
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
            <svg width="85" height="110" viewBox="0 0 100 125" fill="none" className="filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]">
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
            <span className="absolute bottom-1 bg-amber-500/90 text-stone-950 font-black text-[8px] px-1.5 py-0.5 rounded-full border border-yellow-300/30">
              دلة الديوانية
            </span>
          </div>
        </div>

        {/* جلسة الديوانية بدون زحمة: بطاقات صغيرة مرتبة بدل تكدس حول الدلة */}
        <div className="relative z-20 mt-8 mb-2 px-3">
          <div className="rounded-[28px] border border-amber-500/15 bg-stone-950/70 backdrop-blur-md shadow-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[9px] font-black text-amber-300 bg-amber-400/10 border border-amber-400/15 rounded-full px-2.5 py-1">
                {displayEntities.length > 0 ? `${displayEntities.length} حول الدلة` : "المجلس هادئ"}
              </span>
              <div className="text-right">
                <h4 className="text-xs font-black text-[#faf0d9]">جلسة الربع</h4>
                <p className="text-[8px] font-bold text-[#faf0d9]/45 mt-0.5">مرتبة حتى لو صاروا ١٠ وأكثر</p>
              </div>
            </div>

            {displayEntities.length === 0 ? (
              <div className="text-center px-5 py-5 bg-black/25 rounded-2xl border border-white/5">
                <HelpCircle className="w-7 h-7 text-yellow-500 mx-auto mb-2" />
                <h4 className="text-xs font-black text-amber-500">منو بالديوانية الحين؟</h4>
                <p className="text-[10px] text-stone-300 font-bold mt-1.5 leading-relaxed">
                  سجّل حضورك أو خل الربع يقربون من الرادار، وتظهر الجلسة هنا بشكل مرتب وواضح. 📡
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {displayEntities.map((entity: any, i: number) => {
                  const isMe = cleanPhoneLocal(entity.phone) === cleanPhoneLocal(currentMemberPhone);
                  const parsedPoints = entity.points || entity.score || 0;
                  const isRadarGuest = entity.type === "radar_guest";
                  const wobbling = isCurrentlyWobbling(entity.wobbleAt);
                  const displayName = entity.name || "أحد الربع";

                  return (
                    <button
                      key={`${entity.phone}-${entity.index}`}
                      type="button"
                      onClick={() => handleCupClick(entity)}
                      className={cn(
                        "relative min-h-[68px] rounded-2xl border px-3 py-2 text-right transition-all active:scale-95 overflow-hidden",
                        isMe
                          ? "bg-emerald-400 text-stone-950 border-emerald-200 shadow-lg"
                          : isRadarGuest
                            ? "bg-rose-950/55 text-stone-100 border-rose-500/25"
                            : "bg-black/30 text-stone-100 border-white/5 hover:border-amber-400/20"
                      )}
                    >
                      {wobbling && <div className="absolute inset-0 bg-amber-400/10 animate-pulse" />}
                      <div className="relative flex items-center justify-between gap-2">
                        <span className="w-8 h-8 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-base border border-white/10">
                          {isMe ? "أنت" : isRadarGuest ? "📡" : parsedPoints >= 200 ? "👑" : "☕"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black truncate">{displayName}</div>
                          <div className={cn("text-[8px] font-bold mt-1 truncate", isMe ? "text-stone-800/70" : "text-stone-400")}>
                            {isRadarGuest ? `قريب بالرادار${entity.distance ? ` • ${entity.distance}م` : ""}` : `${parsedPoints} نقطة`}
                          </div>
                        </div>
                      </div>
                      {wobbling && (
                        <div className={cn("relative mt-2 text-[8px] font-black rounded-xl px-2 py-1 leading-snug", isMe ? "bg-white/35 text-stone-950" : "bg-amber-400/10 text-amber-300")}>
                          {entity.wobbleMsg || "يا هلا بالربع!"}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info showing total attendees */}
        <div className="flex items-center justify-between mt-4 px-3 relative z-10 gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/45 px-2.5 py-1 rounded-full border border-emerald-900/35 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{presentMembers.length} حاضر بالديوانية</span>
            </span>
            {pendingGeofenceRequests.length > 0 && (
              <span className="text-[9px] font-black text-rose-400 bg-rose-950/45 px-2.5 py-1 rounded-full border border-rose-900/35 flex items-center gap-1 animate-pulse">
                <span>{pendingGeofenceRequests.length} بانتظار الموافقة</span>
              </span>
            )}
          </div>
          <div className="text-right">
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
      {wobbleInputOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-[9999] p-4 flex items-center justify-center animate-fade-in text-right">
          <div className="bg-stone-900 border border-stone-800 rounded-[35px] max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setWobbleInputOpen(false)}
                className="text-stone-400 hover:text-white bg-stone-800/60 rounded-full w-8 h-8 flex items-center justify-center text-xs font-black"
              >
                ✕
              </button>
              <h3 className="text-base font-black text-amber-500">
                هز فنجانك وخل ديوانيتك تهتز وتصوت للربع! ☕
              </h3>
            </div>

            <p className="text-xs text-stone-300 font-bold leading-relaxed">
              اختر عبارة ترحيب كويتية تقليدية أو اكتب عبارتك الخاصة بالديوانية، وفنجانك على سجادة السدو راح يهتز ويبث صوت رنة الفنجان على تليفونات ربعك المتواجدين حالياً!
            </p>

            {/* Quick Sadu Phrases List */}
            <div className="grid grid-cols-1 gap-2">
              {SADU_PHRASES.map((phrase, pi) => (
                <button
                  key={pi}
                  onClick={() => triggerMyWobble(phrase)}
                  disabled={isSubmittingWobble}
                  className="w-full text-right p-3 rounded-2xl bg-stone-950/60 border border-stone-800/60 hover:border-amber-500/35 hover:bg-stone-950 text-xs font-black text-amber-100/90 active:scale-[0.98] transition-all"
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
                className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-right text-xs font-black text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="bg-stone-950/40 p-3 rounded-2xl text-[10px] text-stone-400 text-center font-bold">
              كل جديد يوصل للحضور مباشرة، والديوانية دايمًا على اتصال. 📡
            </div>
          </div>
        </div>
      )}

      {/* SELECTED MEMBER POPUP DETAILS DISPLAY */}
      {selectedCupInfo && !selectedCupInfo.isMe && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-[9999] p-4 flex items-center justify-center animate-fade-in text-right">
          <div className="bg-stone-900 border border-stone-800 rounded-[35px] max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedCupInfo(null)}
                className="text-stone-400 hover:text-white bg-stone-800/60 rounded-full w-8 h-8 flex items-center justify-center text-xs font-black"
              >
                ✕
              </button>
              <span className="text-[10px] font-black bg-amber-950/80 text-amber-500 px-3 py-1 rounded-full uppercase">
                {selectedCupInfo.cupMeta.label}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center py-2">
              {/* Grand render of their cup */}
              <div className="relative w-20 h-20 bg-stone-950/50 rounded-full flex items-center justify-center border border-white/5 shadow-inner mb-3">
                <span className="text-3xl animate-bounce">{selectedCupInfo.cupMeta.icon}</span>
              </div>
              <h4 className="text-lg font-black text-stone-100">{selectedCupInfo.name}</h4>
              <p className="text-xs text-stone-400 font-bold mt-1">
                رصيد النقاط الشخصي: <strong className="text-amber-500">{selectedCupInfo.points} نقطة</strong>
              </p>
            </div>

            <div className="bg-stone-950/60 p-4 rounded-2xl border border-stone-800 text-xs font-bold text-stone-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-400">{selectedCupInfo.cupMeta.desc}</span>
                <span className="text-stone-500">:المكانة بالدوانية</span>
              </div>
              {selectedCupInfo.checkedInAt && (
                <div className="flex justify-between">
                  <span className="text-stone-400">
                    {new Date(selectedCupInfo.checkedInAt).toLocaleTimeString("ar-KW", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-stone-500">:وقت الحضور</span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (soundEnabled) {
                  playSynthSound("clink");
                }
                alert(`بادرت بتحية الفناجين مع ${selectedCupInfo.name}! ☕🔔`);
                setSelectedCupInfo(null);
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 py-3 rounded-2xl text-xs font-black active:scale-95 transition-all text-center"
            >
              🤝 قهند راسك معه (صب تحية وتبادل رنة الفناجين)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
