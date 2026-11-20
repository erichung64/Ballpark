import { describe, expect, test } from "bun:test";
import { addDays, EPOCH } from "../src/shared/dates";
import { dayFor, getDays } from "../src/server/content";
import { QUESTIONS_PER_DAY } from "../src/shared/scoring";

describe("question bank", async () => {
  const days = await getDays();
  const all = days.flatMap((d) => d.questions);

  test("advances each calendar day and wraps with a new puzzle number", async () => {
    expect(await dayFor(addDays(EPOCH, -1))).toBeNull();
    for (let i = 0; i <= days.length; i++) {
      expect(await dayFor(addDays(EPOCH, i))).toEqual({ number: i + 1, day: days[i % days.length]! });
    }
  });

  test("every day has five questions", () => {
    expect(days.length).toBeGreaterThanOrEqual(7);
    for (const d of days) expect(d.questions).toHaveLength(QUESTIONS_PER_DAY);
  });

  test("ids are unique and every question is complete", () => {
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
    for (const q of all) {
      expect(q.q.endsWith("?"), q.id).toBe(true);
      expect(q.answerText.length, q.id).toBeGreaterThan(0);
      expect(q.explain.length, q.id).toBeGreaterThan(20);
      expect(q.source.name.length, q.id).toBeGreaterThan(0);
      if (q.source.url) expect(q.source.url, q.id).toMatch(/^https:\/\//);
    }
  });

  // The reveal chart's axis should frame the crowd: wide, with the answer away from the edges.
  test("chart axes frame the answer", () => {
    for (const q of all) {
      const span = Math.log10(q.max) - Math.log10(q.min);
      const t = (Math.log10(q.answer) - Math.log10(q.min)) / span;
      expect(span, q.id).toBeGreaterThanOrEqual(3.5);
      expect(t, `${q.id} sits at ${(t * 100).toFixed(0)}% of its axis`).toBeGreaterThan(0.1);
      expect(t, `${q.id} sits at ${(t * 100).toFixed(0)}% of its axis`).toBeLessThan(0.9);
    }
  });

  test("every answer can be typed on the keypad (under 1,000 trillion)", () => {
    for (const q of all) expect(q.answer, q.id).toBeLessThan(1e15);
  });

  test("each day mixes categories", () => {
    for (const d of days) expect(new Set(d.questions.map((q) => q.category)).size).toBeGreaterThanOrEqual(4);
  });
});
