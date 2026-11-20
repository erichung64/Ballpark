// Ballpark scoring. One guess per question; the closer it is, the more it
// scores. Distance is measured as a ratio (guessing half or double the answer
// is equally far off), and points fall away smoothly:
//
//   spot on (within ~2%) → 100 · 10% off → ~95 · 25% off → ~85
//   half or double → 50 · ×3 off → 33 · ×10 off → 14
//
// Nobody scores zero for trying; only no guess at all scores 0.

export const QUESTIONS_PER_DAY = 5;
export const MAX_SCORE = QUESTIONS_PER_DAY * 100;

/** How far off a guess is, as a factor ≥ 1 (2 means half or double). */
export function offBy(guess: number, answer: number): number {
  return guess >= answer ? guess / answer : answer / guess;
}

export function points(guess: number | null, answer: number): number {
  if (guess == null || !(guess > 0)) return 0;
  const doublings = Math.abs(Math.log2(guess / answer));
  return Math.round(100 / (1 + doublings ** 1.5));
}

/** Plain-words distance: "spot on", "12% too low", "2.3× too high". */
export function describeMiss(guess: number, answer: number): string {
  const r = guess / answer;
  if (Math.abs(r - 1) < 0.02) return "Spot on";
  if (r > 1) return r < 2 ? `${Math.round((r - 1) * 100)}% too high` : `${trimRatio(r)}× too high`;
  return r > 0.5 ? `${Math.round((1 - r) * 100)}% too low` : `${trimRatio(1 / r)}× too low`;
}

function trimRatio(r: number): string {
  if (r >= 100) return Math.round(r).toLocaleString("en-US");
  if (r >= 10) return String(Math.round(r));
  return String(Math.round(r * 10) / 10);
}

/** Share-row glyph for one question. */
export function glyph(p: number): string {
  if (p >= 90) return "🎯";
  if (p >= 70) return "🟩";
  if (p >= 45) return "🟨";
  if (p >= 20) return "🟧";
  if (p > 0) return "🟥";
  return "⬛";
}
