export const STORE_TIME_ZONE = "Asia/Kuwait";

export const ARABIC_DAYS_MAP: Record<string, string> = {
  sunday: "الأحد",
  monday: "الإثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
  saturday: "السبت",
};

export const DAYS_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type DayKey = (typeof DAYS_ORDER)[number];

type WorkingHoursItem = {
  dayKey: string;
  dayName: string;
  enabled: boolean;
  text: string;
  isToday?: boolean;
};

export type StoreAvailability = {
  isOpen: boolean;
  message: string;
  formattedHours: string;
  todayText: string;
  weeklyList: WorkingHoursItem[];
  currentDayKey: string;
  storeStatus?: any;
};

const DEFAULT_OPEN = "12:00";
const DEFAULT_CLOSE = "23:30";

export const formatTime12h = (timeStr?: string): string => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) {
    return timeStr || "";
  }

  const [hStr, mStr] = timeStr.split(":");
  let hour = Number.parseInt(hStr, 10);
  const min = String(mStr || "00").padStart(2, "0").slice(0, 2);
  if (Number.isNaN(hour)) return timeStr;

  const period = hour >= 12 ? "م" : "ص";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${min} ${period}`;
};

const getOpeningHours = (storeStatus: any) =>
  storeStatus?.openingHours || storeStatus?.workingHours || storeStatus?.hours;

const parseMinutes = (value: any, fallback: string): number => {
  const source = typeof value === "string" && value.includes(":") ? value : fallback;
  const [hoursRaw, minutesRaw] = source.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return parseMinutes(fallback, DEFAULT_OPEN);
  }
  return Math.max(0, Math.min(23, hours)) * 60 + Math.max(0, Math.min(59, minutes));
};

const getKuwaitClock = (nowInput: Date | number | string = new Date()) => {
  const date = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", {
    timeZone: STORE_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(safeDate);

  const weekday = String(parts.find((part) => part.type === "weekday")?.value || "sunday").toLowerCase();
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const currentDayKey = (DAYS_ORDER.includes(weekday as DayKey) ? weekday : "sunday") as DayKey;
  const dayIndex = DAYS_ORDER.indexOf(currentDayKey);

  return {
    currentDayKey,
    previousDayKey: DAYS_ORDER[(dayIndex + DAYS_ORDER.length - 1) % DAYS_ORDER.length],
    currentMinutes: hour * 60 + minute,
  };
};

const getSampleHours = (openingHours: any) => {
  for (const dayKey of DAYS_ORDER) {
    const schedule = openingHours?.[dayKey];
    if (schedule?.open && schedule?.close) {
      return { open: schedule.open, close: schedule.close };
    }
  }
  return { open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
};

const normalizeSchedule = (schedule: any, sample: { open: string; close: string }) => ({
  enabled: schedule?.enabled !== false,
  open: schedule?.open || sample.open,
  close: schedule?.close || sample.close,
});

export function formatOpeningHoursSummary(
  storeStatus: any,
  nowInput: Date | number | string = new Date(),
): {
  summaryText: string;
  todayText: string;
  weeklyList: WorkingHoursItem[];
  currentDayKey: string;
} {
  const openingHours = getOpeningHours(storeStatus);
  const { currentDayKey } = getKuwaitClock(nowInput);

  if (!openingHours || typeof openingHours !== "object") {
    const defaultText = `من ${formatTime12h(DEFAULT_OPEN)} إلى ${formatTime12h(DEFAULT_CLOSE)}`;
    return {
      summaryText: `أوقات العمل: يومياً ${defaultText}`,
      todayText: defaultText,
      currentDayKey,
      weeklyList: DAYS_ORDER.map((dayKey) => ({
        dayKey,
        dayName: ARABIC_DAYS_MAP[dayKey],
        enabled: true,
        text: defaultText,
        isToday: dayKey === currentDayKey,
      })),
    };
  }

  const sample = getSampleHours(openingHours);
  const weeklyList = DAYS_ORDER.map((dayKey) => {
    const schedule = normalizeSchedule(openingHours[dayKey], sample);
    return {
      dayKey,
      dayName: ARABIC_DAYS_MAP[dayKey],
      enabled: schedule.enabled,
      text: schedule.enabled
        ? `من ${formatTime12h(schedule.open)} إلى ${formatTime12h(schedule.close)}`
        : "مغلق",
      isToday: dayKey === currentDayKey,
    };
  });

  const today = weeklyList.find((item) => item.dayKey === currentDayKey);
  const todayText = today?.enabled ? today.text : "مغلق اليوم";
  const enabledDays = weeklyList.filter((item) => item.enabled);
  let summaryText = `أوقات العمل اليوم (${ARABIC_DAYS_MAP[currentDayKey]}): ${todayText}`;

  if (enabledDays.length === 7 && enabledDays.every((item) => item.text === enabledDays[0].text)) {
    summaryText = `أوقات العمل: يومياً ${enabledDays[0].text}`;
  } else if (enabledDays.length === 0) {
    summaryText = "المطعم مغلق حسب جدول أوقات العمل.";
  }

  return { summaryText, todayText, weeklyList, currentDayKey };
}

const scheduleIsOpen = (schedule: any, currentMinutes: number, mode: "today" | "previous") => {
  if (!schedule?.enabled) return false;

  const openMinutes = parseMinutes(schedule.open, DEFAULT_OPEN);
  const closeMinutes = parseMinutes(schedule.close, DEFAULT_CLOSE);

  // Equal times are treated as a full working day for an enabled schedule.
  if (openMinutes === closeMinutes) return true;

  if (mode === "previous") {
    return closeMinutes < openMinutes && currentMinutes < closeMinutes;
  }

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  // Overnight shift: today's portion starts at opening and continues past midnight.
  return currentMinutes >= openMinutes;
};

export function checkStoreStatus(
  storeStatus: any,
  nowInput: Date | number | string = new Date(),
): StoreAvailability {
  if (!storeStatus) {
    return {
      isOpen: true,
      message: "",
      formattedHours: "",
      todayText: "",
      weeklyList: [],
      currentDayKey: getKuwaitClock(nowInput).currentDayKey,
    };
  }

  const { summaryText, todayText, weeklyList, currentDayKey } =
    formatOpeningHoursSummary(storeStatus, nowInput);

  const closedResult = (message: string): StoreAvailability => ({
    isOpen: false,
    message,
    formattedHours: summaryText,
    todayText,
    weeklyList,
    currentDayKey,
    storeStatus,
  });

  if (storeStatus.manualClose === true) {
    return closedResult(storeStatus.closeMessage || "المطعم مغلق حالياً بطلب من الإدارة.");
  }

  const openingHours = getOpeningHours(storeStatus);
  if (!openingHours || typeof openingHours !== "object" || Object.keys(openingHours).length === 0) {
    return {
      isOpen: true,
      message: "",
      formattedHours: summaryText,
      todayText,
      weeklyList,
      currentDayKey,
      storeStatus,
    };
  }

  const sample = getSampleHours(openingHours);
  const { previousDayKey, currentMinutes } = getKuwaitClock(nowInput);
  const todaySchedule = normalizeSchedule(openingHours[currentDayKey], sample);
  const previousSchedule = normalizeSchedule(openingHours[previousDayKey], sample);

  const isOpenNow =
    scheduleIsOpen(previousSchedule, currentMinutes, "previous") ||
    scheduleIsOpen(todaySchedule, currentMinutes, "today");

  if (!isOpenNow) {
    if (!todaySchedule.enabled) {
      return closedResult(
        storeStatus.closeMessage ||
          `المطعم مغلق اليوم (${ARABIC_DAYS_MAP[currentDayKey]}) حسب جدول أوقات العمل.`,
      );
    }
    return closedResult(
      storeStatus.closeMessage || "المطعم مغلق حالياً خارج أوقات العمل الرسمية.",
    );
  }

  return {
    isOpen: true,
    message: "",
    formattedHours: summaryText,
    todayText,
    weeklyList,
    currentDayKey,
    storeStatus,
  };
}

export function getConfiguredStoreStatus(data: any) {
  const storedStatus = data?.settings?.storeStatus || data?.storeStatus || {};
  const openingHours =
    data?.openingHours ||
    data?.workingHours ||
    storedStatus?.openingHours ||
    storedStatus?.workingHours ||
    storedStatus?.hours;

  if (!openingHours || typeof openingHours !== "object") return storedStatus;
  return {
    ...storedStatus,
    openingHours,
    workingHours: openingHours,
  };
}
