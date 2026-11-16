import type { QuietHours } from "@/types/dropin";

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function parseHHMM(value: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Invalid time "${value}"`);
  return h * 60 + min;
}

/** Day of week (0=Sun) and minutes since midnight for `date` in `timeZone`. */
export function zonedClock(date: Date, timeZone: string): { dow: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
  } catch {
    // Unknown time zone: fall back to UTC rather than throwing inside event processing.
    return zonedClock(date, "UTC");
  }
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const dow = DAY_LABELS.indexOf(weekday as (typeof DAY_LABELS)[number]);
  return { dow: dow < 0 ? 0 : dow, minutes: hour * 60 + minute };
}

/**
 * Whether quiet hours are in effect at `at`.
 *
 * `days_of_week` lists the days on which a quiet window *starts*. An overnight
 * window (e.g. 23:00 → 07:00) that starts on Friday therefore also covers early
 * Saturday morning.
 */
export function isQuietHoursActive(config: Pick<QuietHours, "enabled" | "start_time" | "end_time" | "days_of_week" | "timezone"> | null | undefined, at: Date = new Date()): boolean {
  if (!config || !config.enabled || config.days_of_week.length === 0) return false;
  const start = parseHHMM(config.start_time);
  const end = parseHHMM(config.end_time);
  if (start === end) return false;
  const { dow, minutes } = zonedClock(at, config.timezone);
  const days = new Set(config.days_of_week);
  if (start < end) {
    return days.has(dow) && minutes >= start && minutes < end;
  }
  const prev = (dow + 6) % 7;
  return (days.has(dow) && minutes >= start) || (days.has(prev) && minutes < end);
}

/** Length of the quiet window in minutes. */
export function windowLength(start_time: string, end_time: string): number {
  const s = parseHHMM(start_time);
  const e = parseHHMM(end_time);
  return e > s ? e - s : 24 * 60 - s + e;
}

export function formatClock(hhmm: string, opts: { hour12?: boolean } = { hour12: true }): string {
  const total = parseHHMM(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!opts.hour12) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function describeDays(days: number[]): string {
  const sorted = [...new Set(days)].sort();
  if (sorted.length === 7) return "Every day";
  if (sorted.length === 0) return "No days";
  if (sorted.join() === "1,2,3,4,5") return "Weekdays";
  if (sorted.join() === "0,6") return "Weekends";
  return sorted.map((d) => DAY_LABELS[d]).join(", ");
}

export function defaultQuietHours(householdId: string, timezone: string, id: string): QuietHours {
  return {
    id,
    household_id: householdId,
    enabled: true,
    start_time: "00:00",
    end_time: "07:00",
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    timezone,
    updated_at: new Date().toISOString(),
    updated_by: null,
    synced_at: null,
  };
}
