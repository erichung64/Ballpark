// Day keys are local calendar dates, "YYYY-MM-DD". Everyone gets the same
// scene for the same date, released at their local midnight.

export const EPOCH = "2026-11-20"; // Cold Spot #1

const DAY_MS = 86_400_000;

export function toUTC(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return fromUTC(toUTC(date) + n * DAY_MS);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayNumber(date: string): number {
  return diffDays(EPOCH, date) + 1;
}

export function isDateKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s));
}

/**
 * A date is live while it is that date somewhere on Earth:
 * from 00:00 at UTC+14 to 24:00 at UTC−12.
 */
export function liveWindow(date: string): { opens: number; closes: number } {
  const start = toUTC(date);
  return { opens: start - 14 * 3_600_000, closes: start + DAY_MS + 12 * 3_600_000 };
}

export function isLive(date: string, now = Date.now()): boolean {
  const w = liveWindow(date);
  return now >= w.opens && now < w.closes;
}

/** True once the date is over everywhere: final shares can settle. */
export function isSettled(date: string, now = Date.now()): boolean {
  return now >= liveWindow(date).closes;
}

/** True once the date has ended somewhere (the scene is no longer secret). */
export function hasEndedSomewhere(date: string, now = Date.now()): boolean {
  return now >= toUTC(date) + DAY_MS - 14 * 3_600_000;
}
