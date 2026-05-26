import React, { useMemo } from "react";

// Hashing function to select deterministic styles
const getHash = (str: string) => {
  let hash = 0;
  const cleanStr = String(str || "").trim().toLowerCase();
  for (let i = 0; i < cleanStr.length; i++) {
    hash = cleanStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

// Traditional Kuwaiti / Arabian high-fidelity icons paired with cozy titles
const CULTURAL_ICONS = [
  { icon: "⛵", title: "البوم", meaning: "سفينة الغوص للبحر" },
  { icon: "🌴", title: "البرحي", meaning: "نخلة الخير والبركة" },
  { icon: "☕", title: "الدلة", meaning: "رمز الكرم والضيافة" },
  { icon: "🦅", title: "الحر", meaning: "صقر الجزيرة الأصيل" },
  { icon: "🐪", title: "الهجين", meaning: "سفينة الصحراء الصبورة" },
  { icon: "📿", title: "الكهرب", meaning: "سبحة الكهرب العريقة" },
  { icon: "🏜️", title: "الشداد", meaning: "شمس السدو الذهبية" },
  { icon: "🪵", title: "الديوان", meaning: "السدو وبيت الشعر العريق" },
  { icon: "🕌", title: "الكوت", meaning: "مئذنة المساجد الطاهرة" },
  { icon: "🥣", title: "المجبوس", meaning: "سفرة الخير واللمة" },
  { icon: "🪁", title: "الزقرت", meaning: "بطل الطائرة الشراعية" },
  { icon: "🗝️", title: "بوابة السور", meaning: "بوابة السور العتيقة" },
];

// Rich, authentic Gulf/Kuwaiti traditional Sadu colors
const TONES = [
  // Deep Saffron Orange & Crimson (Classic Al-Sadu)
  { from: "#9A1C1C", via: "#DC5A15", to: "#4A0606", border: "border-amber-400/40", text: "text-amber-100", glow: "shadow-red-950/40" },
  // Oasis Palms - Dark Olive Teal & Pistachio
  { from: "#064E3B", via: "#10B981", to: "#022C22", border: "border-emerald-400/40", text: "text-emerald-100", glow: "shadow-emerald-950/40" },
  // falak deep sea (Gulf sailing)
  { from: "#1E3A8A", via: "#3B82F6", to: "#172554", border: "border-sky-400/40", text: "text-sky-100", glow: "shadow-blue-950/40" },
  // Desert Sunset Ochre & Honey Mustard
  { from: "#B45309", via: "#F59E0B", to: "#451A03", border: "border-yellow-400/40", text: "text-yellow-100", glow: "shadow-amber-950/40" },
  // Royal Majlis Purple & Damask
  { from: "#701A75", via: "#D946EF", to: "#3B0764", border: "border-fuchsia-400/40", text: "text-fuchsia-100", glow: "shadow-purple-950/40" },
  // Warm Charcoal Bedouin Tent (Black/Ochre)
  { from: "#1C1917", via: "#78716C", to: "#0C0A09", border: "border-amber-500/20", text: "text-stone-100", glow: "shadow-stone-950/40" },
];

export function SaduAvatar({
  name,
  phone = "",
  size = "md", // "sm" (32px), "md" (48px), "lg" (64px), "xl" (80px)
}: {
  name: string;
  phone?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
}) {
  const seedKey = name + "_" + (phone || "");
  const hash = useMemo(() => getHash(seedKey), [seedKey]);

  // Select color tone and cultural icon deterministically
  const colorTone = TONES[hash % TONES.length];
  const item = CULTURAL_ICONS[hash % CULTURAL_ICONS.length];

  // Specific Sadu geometric background design based on hash
  const patternSelect = hash % 4;

  const sizeClasses = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-base",
    lg: "w-14 h-14 text-xl",
    xl: "w-18 h-18 text-2xl h-[72px] w-[72px]",
    xxl: "w-24 h-24 text-4xl h-[96px] w-[96px]",
  }[size];

  const badgeSizeClasses = {
    xs: "w-3.5 h-3.5 text-[8px]",
    sm: "w-4.5 h-4.5 text-[9px]",
    md: "w-6 h-6 text-xs",
    lg: "w-8 h-8 text-base",
    xl: "w-10 h-10 text-lg",
    xxl: "w-14 h-14 text-2xl",
  }[size];

  return (
    <div
      className={`relative rounded-full flex items-center justify-center shrink-0 border-2 ${colorTone.border} bg-gradient-to-br ${colorTone.glow} shadow-lg overflow-hidden select-none transition-all duration-300 transform hover:scale-105 ${sizeClasses}`}
      style={{
        background: `linear-gradient(135deg, ${colorTone.from} 0%, ${colorTone.to} 100%)`,
      }}
      title={`${name} - ${item.title}: ${item.meaning}`}
    >
      {/* Sadu/Arabesque background overlay SVG to give beautiful authentic texture */}
      <svg
        className="absolute inset-0 w-full h-full opacity-35 mix-blend-overlay pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        {patternSelect === 0 && (
          // Chevron wave (traditional Sadu weave stripes)
          <path
            d="M -10,10 L 20,-20 M 20,40 L 80,-20 M 80,100 L 140,40 M -10,40 L 40,-10 M 10,70 L 70,10 M 40,100 L 100,40 M 10,100 L 100,10 M 0,0 L 100,100" 
            stroke="white"
            strokeWidth="3.5"
            strokeDasharray="4,4"
            fill="none"
          />
        )}
        {patternSelect === 1 && (
          // Diamond lattices (weave diamonds)
          <g fill="none" stroke="white" strokeWidth="2.5">
            <polygon points="50,15 85,50 50,85 15,50" />
            <polygon points="50,25 75,50 50,75 25,50" strokeDasharray="2,2" />
            <line x1="15" y1="50" x2="85" y2="50" />
            <line x1="50" y1="15" x2="50" y2="85" />
          </g>
        )}
        {patternSelect === 2 && (
          // Islamic Star of Al-Kout pattern
          <g fill="none" stroke="white" strokeWidth="2">
            <rect x="25" y="25" width="50" height="50" transform="rotate(45 50 50)" />
            <rect x="25" y="25" width="50" height="50" />
            <circle cx="50" cy="50" r="18" strokeDasharray="3,2" />
          </g>
        )}
        {patternSelect === 3 && (
          // Chevron vertical repeating bands
          <path
            d="M 10,-10 L 50,30 L 90,-10 M 10,15 L 50,55 L 90,15 M 10,40 L 50,80 L 90,40 M 10,65 L 50,105 L 90,65"
            stroke="white"
            strokeWidth="4"
            fill="none"
            opacity="0.8"
          />
        )}
      </svg>

      {/* Dynamic Sadu accent lines bordering top/bottom or left/right visually to look woven */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(255,255,255,0.25)_4px,rgba(255,255,255,0.25)_8px)] pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(255,255,255,0.25)_4px,rgba(255,255,255,0.25)_8px)] pointer-events-none" />

      {/* Central Luxury Medallion / Coin */}
      <div
        className={`flex items-center justify-center rounded-full bg-black/25 backdrop-blur-md shadow-inner border border-white/20 relative z-10 font-bold ${badgeSizeClasses}`}
      >
        <span
          className="transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] select-none animate-fade-in"
          style={{
            textShadow: "0 0 8px rgba(255,255,255,0.2)",
          }}
        >
          {item.icon}
        </span>
      </div>

      {/* Subtle shining absolute white dot simulating luxurious jewelry / gem */}
      <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-white opacity-60 animate-pulse pointer-events-none" />
    </div>
  );
}
