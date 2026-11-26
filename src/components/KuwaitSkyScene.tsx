import React, { useEffect, useState } from "react";
import { getKuwaitWeather, isRainCode, type KuwaitWeather } from "../lib/kuwaitWeather";
import "../kuwait-sky.css";

/**
 * Background-only "real Kuwait sky" for the menu hero banner.
 * Reads the single shared Open-Meteo request (see lib/kuwaitWeather) and the
 * local hour; falls back to a time-of-day scene when weather is unavailable.
 * Purely decorative: aria-hidden, pointer-events none, sits under the hero text.
 */

export type SkyScene = "clear" | "heat" | "dust" | "rain" | "sunset" | "night";

// Same hour windows as the existing golden-hour label in CustomerSite.
const timeOfDayScene = (hour: number): SkyScene => {
  if (hour >= 16 && hour < 18) return "sunset";
  if (hour >= 5 && hour < 16) return "clear";
  return "night";
};

const DUST_CODES = [45, 48];
const HEAT_THRESHOLD_C = 38;
const DUST_VISIBILITY_M = 5000;

export function pickSkyScene(weather: KuwaitWeather | null, hour: number): SkyScene {
  const fallback = timeOfDayScene(hour);
  if (!weather) return fallback;
  if (isRainCode(weather.code)) return "rain";
  const isDay = weather.isDay ?? fallback !== "night";
  if (
    DUST_CODES.includes(weather.code) ||
    (weather.visibility !== null && weather.visibility < DUST_VISIBILITY_M)
  )
    return isDay ? "dust" : "night";
  if (hour >= 16 && hour < 18) return "sunset";
  if (!isDay) return "night";
  if (weather.temperature !== null && weather.temperature >= HEAT_THRESHOLD_C) return "heat";
  return "clear";
}

// Deterministic star field (no Math.random so the scene is stable between renders).
const STARS = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 61.8 + 7) % 100,
  y: ((i * 37.3) % 62) + 3,
  r: i % 5 === 0 ? 1.4 : i % 3 === 0 ? 1 : 0.7,
  d: (i % 7) * 0.6,
}));

// Generic low-rise band (stretched to full width; rectangles tolerate stretching).
const BLOCKS: Array<[number, number, number]> = [
  // [x, width, height] in a 400 x 60 box
  [0, 18, 22], [18, 12, 30], [30, 22, 18], [52, 10, 36], [62, 20, 24],
  [82, 14, 40], [96, 26, 20], [122, 12, 32], [134, 18, 26], [152, 10, 44],
  [162, 24, 22], [186, 16, 34], [202, 20, 18], [222, 12, 38], [234, 22, 26],
  [256, 14, 48], [270, 18, 24], [288, 12, 30], [300, 24, 20], [324, 10, 42],
  [334, 20, 26], [354, 16, 34], [370, 14, 22], [384, 16, 30],
];

const isLit = (scene: SkyScene) => scene === "night" || scene === "rain";

function SkylineBand({ scene }: { scene: SkyScene }) {
  return (
    <svg className="ks-band" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {BLOCKS.map(([x, w, h]) => (
        <rect key={x} x={x} y={60 - h} width={w} height={h} className="ks-fill" />
      ))}
      {isLit(scene) &&
        BLOCKS.filter((_, i) => i % 2 === 0).map(([x, w, h], i) => (
          <rect key={`w${x}`} x={x + w / 3} y={60 - h + 5 + (i % 3) * 4} width={1.6} height={1.6} className="ks-window" />
        ))}
    </svg>
  );
}

/** Kuwait Towers + Liberation Tower, kept at a fixed aspect ratio. */
function Landmarks({ scene }: { scene: SkyScene }) {
  return (
    <svg className="ks-landmarks" viewBox="0 0 200 160" preserveAspectRatio="xMinYMax meet" aria-hidden="true" focusable="false">
      <g className="ks-fill">
        {/* Kuwait Towers: main tower with two spheres */}
        <path d="M58 160 L60.6 6 L61.4 6 L64 160 Z" />
        <circle cx="61" cy="58" r="15" />
        <circle cx="61" cy="30" r="8.5" />
        {/* second tower with one sphere */}
        <path d="M82 160 L84.2 52 L85.8 52 L88 160 Z" />
        <circle cx="85" cy="82" r="10.5" />
        {/* third, slender needle */}
        <path d="M43 160 L44.6 76 L45.4 76 L47 160 Z" />
        {/* Liberation Tower: shaft, pod, antenna */}
        <path d="M146 160 L148.5 40 L153.5 40 L156 160 Z" />
        <path d="M143 48 L157 48 L160 40 L157 32 L143 32 L140 40 Z" />
        <rect x="149.6" y="10" width="1.8" height="22" />
        <rect x="150.1" y="0" width="0.8" height="12" />
        {/* low base buildings tying the landmarks to the ground */}
        <rect x="30" y="142" width="70" height="18" />
        <rect x="120" y="136" width="20" height="24" />
        <rect x="160" y="146" width="36" height="14" />
      </g>
      {isLit(scene) && (
        <g className="ks-glow">
          <circle cx="61" cy="58" r="15" />
          <circle cx="61" cy="30" r="8.5" />
          <circle cx="85" cy="82" r="10.5" />
          <rect x="143" y="38" width="14" height="2" />
          <circle cx="150.5" cy="1.2" r="1.3" className="ks-beacon" />
        </g>
      )}
    </svg>
  );
}

export function KuwaitSkyScene() {
  const [weather, setWeather] = useState<KuwaitWeather | null>(null);
  const [hour] = useState(() => new Date().getHours());

  useEffect(() => {
    let alive = true;
    getKuwaitWeather().then((w) => {
      if (alive) setWeather(w);
    });
    return () => {
      alive = false;
    };
  }, []);

  const scene = pickSkyScene(weather, hour);
  const hasSun = scene === "clear" || scene === "heat" || scene === "dust" || scene === "sunset";

  return (
    <div
      key={scene}
      className={`ks-sky ks-${scene}`}
      data-sky={scene}
      data-sky-source={weather ? "weather" : "time"}
      aria-hidden="true"
    >
      {scene === "night" && (
        <svg className="ks-stars" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.35} style={{ animationDelay: `${s.d}s` }} />
          ))}
        </svg>
      )}
      {scene === "night" && <span className="ks-moon" />}
      {hasSun && <span className="ks-sun" />}
      {scene === "rain" && (
        <>
          <span className="ks-cloud ks-cloud-a" />
          <span className="ks-cloud ks-cloud-b" />
          <span className="ks-rain" />
        </>
      )}
      {scene === "dust" && (
        <>
          <span className="ks-dust ks-dust-a" />
          <span className="ks-dust ks-dust-b" />
        </>
      )}
      {scene === "heat" && <span className="ks-shimmer" />}
      <Landmarks scene={scene} />
      <SkylineBand scene={scene} />
      {scene === "heat" && <span className="ks-shimmer ks-shimmer-front" />}
      <span className="ks-scrim" />
    </div>
  );
}
