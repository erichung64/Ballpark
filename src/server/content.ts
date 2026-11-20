// The question bank. Server-only: answers never ship to the client before a
// guess is locked. Re-read when the file changes, so edits show up live.

import { statSync } from "node:fs";
import { join } from "node:path";
import { dayNumber } from "../shared/dates";
import type { QuestionInfo } from "../shared/types";

export interface QuestionDef extends QuestionInfo {
  answer: number;
  answerText: string;
  explain: string;
  source: { name: string; url?: string };
}

export interface DayDef {
  questions: QuestionDef[];
}

const FILE = join(import.meta.dir, "content/questions.json");
let cache: { mtime: number; days: DayDef[] } | null = null;

export async function getDays(): Promise<DayDef[]> {
  const mtime = statSync(FILE).mtimeMs;
  if (cache?.mtime === mtime) return cache.days;
  const raw = (await Bun.file(FILE).json()) as { days: DayDef[] };
  cache = { mtime, days: raw.days };
  return raw.days;
}

/** The question set for a date, or null before launch. Days cycle through the bank. */
export async function dayFor(date: string): Promise<{ number: number; day: DayDef } | null> {
  const number = dayNumber(date);
  if (number < 1) return null;
  const days = await getDays();
  if (!days.length) return null;
  return { number, day: days[(number - 1) % days.length]! };
}

export function publicInfo(q: QuestionDef): QuestionInfo {
  return { id: q.id, category: q.category, q: q.q, unit: q.unit, min: q.min, max: q.max };
}
