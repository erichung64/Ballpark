// Crowd figures: how everyone guessed on a question, how one guess compares,
// and where a player finished on the day.

import { QUESTIONS_PER_DAY } from "../shared/scoring";
import type { Crowd } from "../shared/types";
import type { QuestionDef } from "./content";
import { db } from "./db";

export const BINS = 32;
/** Below this many players, crowd comparisons aren't meaningful yet. */
export const MIN_CROWD = 5;

const qCount = db.query<{ n: number }, { date: string; q: number }>(
  "SELECT COUNT(*) AS n FROM guesses WHERE date = $date AND q = $q",
);
const qRows = db.query<{ guess: number | null }, { date: string; q: number }>(
  "SELECT guess FROM guesses WHERE date = $date AND q = $q",
);
const qTotals = db.query<{ player: string; total: number }, { date: string; n: number }>(
  "SELECT player, SUM(points) AS total FROM guesses WHERE date = $date GROUP BY player HAVING COUNT(*) = $n",
);

interface Cached {
  n: number;
  crowd: Crowd;
  /** Every player's error (|log of guess ÷ answer|), sorted; timeouts count as infinitely far. */
  errors: Float64Array;
}

// Recomputing is cheap, but skip it entirely when nothing new has arrived.
const cache = new Map<string, Cached>();

const errorOf = (guess: number | null, answer: number) => (guess != null && guess > 0 ? Math.abs(Math.log(guess / answer)) : Infinity);

function load(date: string, q: number, def: QuestionDef): Cached {
  const key = `${date}:${q}`;
  const n = qCount.get({ date, q })!.n;
  const hit = cache.get(key);
  if (hit && hit.n === n) return hit;

  const rows = qRows.all({ date, q });
  const lo = Math.log10(def.min);
  const span = Math.log10(def.max) - lo;
  const bins = new Array<number>(BINS).fill(0);
  const guesses: number[] = [];
  const errors = new Float64Array(rows.length);
  rows.forEach((r, i) => {
    errors[i] = errorOf(r.guess, def.answer);
    if (r.guess == null || !(r.guess > 0)) return;
    guesses.push(r.guess);
    const t = (Math.log10(r.guess) - lo) / span;
    bins[Math.max(0, Math.min(BINS - 1, Math.floor(t * BINS)))]!++;
  });
  errors.sort();
  guesses.sort((a, b) => a - b);
  const mid = guesses.length >> 1;
  const median = guesses.length ? (guesses.length % 2 ? guesses[mid]! : Math.sqrt(guesses[mid - 1]! * guesses[mid]!)) : null;
  const entry = { n, crowd: { players: rows.length, median, bins }, errors };
  cache.set(key, entry);
  if (cache.size > 2000) cache.clear();
  return entry;
}

export function crowd(date: string, q: number, def: QuestionDef): Crowd {
  return load(date, q, def).crowd;
}

/** How one guess compares: the share of other players it beat, and whether it beat the crowd's median. */
export function compare(date: string, q: number, def: QuestionDef, guess: number | null) {
  const { errors, crowd: c } = load(date, q, def);
  if (c.players < MIN_CROWD) return { closerThan: null, beatCrowd: null };
  const mine = errorOf(guess, def.answer);
  // Count players strictly further off (binary search on the sorted errors).
  let lo = 0;
  let hi = errors.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (errors[m]! <= mine) lo = m + 1;
    else hi = m;
  }
  const further = errors.length - lo;
  return {
    closerThan: further / Math.max(1, errors.length - 1),
    beatCrowd: c.median != null && mine < errorOf(c.median, def.answer),
  };
}

export function dayTotals(date: string): Map<string, number> {
  return new Map(qTotals.all({ date, n: QUESTIONS_PER_DAY }).map((r) => [r.player, r.total]));
}

/** Rank among everyone who finished; ties share the better rank. */
export function placing(totals: Map<string, number>, mine: number) {
  let above = 0;
  let below = 0;
  for (const t of totals.values()) {
    if (t > mine) above++;
    else if (t < mine) below++;
  }
  const players = totals.size;
  return { players, rank: above + 1, beat: players ? Math.round((below / players) * 100) : 0 };
}

export const SCORE_BAND = 25;

/** How many finishers landed in each 25-point band of the day's score. */
export function distribution(totals: Map<string, number>, max: number): number[] {
  const bins = new Array<number>(Math.ceil(max / SCORE_BAND)).fill(0);
  for (const t of totals.values()) bins[Math.min(bins.length - 1, Math.floor(t / SCORE_BAND))]!++;
  return bins;
}
