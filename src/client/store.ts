// Everything a player has lives on their device: an anonymous id, streak,
// rain checks and a short history. No account needed.

import { addDays, diffDays } from "../shared/dates";

export interface DayRecord {
  date: string;
  number: number;
  results: { q: number; text: string; unit: string; guess: number | null; points: number; answerText: string; beatCrowd: boolean | null }[];
  score: number;
  done: boolean;
}

export interface Streak {
  current: number;
  best: number;
  /** Rain checks: each one covers a missed day automatically. */
  thermos: number;
  /** Last date that counts toward the streak (played or saved by a Thermos). */
  last: string | null;
}

export interface Saved {
  v: 1;
  player: string;
  relaxed: boolean;
  streak: Streak;
  days: Record<string, DayRecord>;
  /** Dates whose overnight card has been dismissed. */
  seen: Record<string, true>;
  /** Has finished a day (first-timers get step-by-step hints and a longer clock). */
  onboarded: boolean;
  /** One-off message to show on the next home screen. */
  notice: { kind: "thermos"; used: number } | { kind: "broken"; was: number } | null;
}

const KEY = "ballpark:v1";
export const THERMOS_MAX = 2;
export const THERMOS_EVERY = 7;

function fresh(): Saved {
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  return {
    v: 1,
    player: id,
    relaxed: false,
    streak: { current: 0, best: 0, thermos: 0, last: null },
    days: {},
    seen: {},
    onboarded: false,
    notice: null,
  };
}

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      if (s && s.v === 1 && s.player) return { ...fresh(), ...s };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  const s = fresh();
  save(s);
  return s;
}

export function save(s: Saved) {
  try {
    // Keep history small: the last 60 days are plenty for the MVP.
    const dates = Object.keys(s.days).sort();
    for (const d of dates.slice(0, Math.max(0, dates.length - 60))) delete s.days[d];
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. */
  }
}

/**
 * Apply missed days. A rain check automatically covers each missed day;
 * without enough of them the streak resets. Safe to call on every visit.
 */
export function reconcileStreak(s: Saved, today: string): boolean {
  const st = s.streak;
  if (!st.last || st.current === 0) return false;
  const gap = diffDays(st.last, today);
  if (gap <= 1) return false;
  const missed = gap - 1;
  if (st.thermos >= missed) {
    st.thermos -= missed;
    st.last = addDays(today, -1);
    s.notice = { kind: "thermos", used: missed };
  } else {
    s.notice = { kind: "broken", was: st.current };
    st.current = 0;
    st.thermos = 0;
  }
  return true;
}

/** Record today's finished puzzle. Returns true if a rain check was earned. */
export function completeDay(s: Saved, today: string): boolean {
  reconcileStreak(s, today);
  const st = s.streak;
  if (st.last === today) return false;
  st.current = st.last === addDays(today, -1) ? st.current + 1 : 1;
  st.best = Math.max(st.best, st.current);
  st.last = today;
  if (st.current % THERMOS_EVERY === 0 && st.thermos < THERMOS_MAX) {
    st.thermos += 1;
    return true;
  }
  return false;
}

/** Lifetime average points per question, and how often you beat the crowd. */
export function lifetime(s: Saved): { answers: number; average: number | null; beat: number; compared: number } {
  let answers = 0;
  let sum = 0;
  let beat = 0;
  let compared = 0;
  for (const d of Object.values(s.days)) {
    if (!d.done) continue;
    for (const r of d.results) {
      answers++;
      sum += r.points;
      if (r.beatCrowd != null) {
        compared++;
        if (r.beatCrowd) beat++;
      }
    }
  }
  return { answers, average: answers ? Math.round(sum / answers) : null, beat, compared };
}
