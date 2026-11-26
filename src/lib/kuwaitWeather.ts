// Single shared read of the current Kuwait weather (Open-Meteo, no key).
// DynamicEnvironment (rain overlay) and the hero sky both read this one
// cached promise, so the page still makes exactly one weather request.

export type KuwaitWeather = {
  code: number;
  temperature: number | null;
  isDay: boolean | null;
  visibility: number | null; // metres
};

// Kuwait coords: lat 29.3759, lon 47.9774
const KUWAIT_WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=29.3759&longitude=47.9774&current=weather_code,temperature_2m,is_day,visibility";

export const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

let pending: Promise<KuwaitWeather | null> | null = null;

export function getKuwaitWeather(): Promise<KuwaitWeather | null> {
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(KUWAIT_WEATHER_URL);
        if (!res.ok) return null;
        const data = await res.json();
        const cur = data?.current ?? {};
        const legacy = data?.current_weather ?? {};
        const isDayRaw = num(cur.is_day) ?? num(legacy.is_day);
        return {
          code: num(cur.weather_code) ?? num(legacy.weathercode) ?? 0,
          temperature: num(cur.temperature_2m) ?? num(legacy.temperature),
          isDay: isDayRaw === null ? null : isDayRaw === 1,
          visibility: num(cur.visibility),
        };
      } catch {
        // API blocked or offline: callers fall back to their no-weather state.
        return null;
      }
    })();
  }
  return pending;
}

export const isRainCode = (code: number) => RAIN_CODES.includes(code);
