/** Formatting helpers that respect the household's time zone. */

function safeTz(tz?: string) {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export function formatTime(iso: string | Date, tz?: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: safeTz(tz) }).format(new Date(iso));
}

export function formatDate(iso: string | Date, tz?: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: safeTz(tz) }).format(new Date(iso));
}

export function formatDateTime(iso: string | Date, tz?: string): string {
  return `${formatDate(iso, tz)} · ${formatTime(iso, tz)}`;
}

function dayKey(d: Date, tz?: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: safeTz(tz) }).format(d);
}

/** "Today", "Yesterday", or a date — used for grouping timelines. */
export function dayLabel(iso: string | Date, tz?: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const k = dayKey(d, tz);
  if (k === dayKey(now, tz)) return "Today";
  if (k === dayKey(new Date(now.getTime() - 86_400_000), tz)) return "Yesterday";
  if (k === dayKey(new Date(now.getTime() + 86_400_000), tz)) return "Tomorrow";
  return formatDate(d, tz, { weekday: "long", month: "short", day: "numeric" });
}

export function relativeTime(iso: string | Date, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  const future = diff < 0;
  const s = Math.abs(diff);
  const fmt = (n: number, unit: string) => (future ? `in ${n}${unit}` : `${n}${unit} ago`);
  if (s < 45) return future ? "in a moment" : "Just now";
  if (s < 3600) return fmt(Math.round(s / 60), " min");
  if (s < 86400) return fmt(Math.round(s / 3600), " h");
  if (s < 86400 * 7) return fmt(Math.round(s / 86400), " d");
  return formatDate(iso);
}

export function greeting(now: Date = new Date(), tz?: string): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: safeTz(tz) }).format(now));
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatWeight(kg: number | null | undefined): string | null {
  if (kg == null) return null;
  return kg < 1 ? `${Math.round(kg * 1000)} g` : `${Number(kg.toFixed(1))} kg`;
}
