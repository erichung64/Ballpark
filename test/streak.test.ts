import { beforeAll, describe, expect, test } from "bun:test";
import type { Saved } from "../src/client/store";

// store.ts touches localStorage/crypto only in load()/save(); the streak logic is pure.
let completeDay: (s: Saved, today: string) => boolean;
let reconcileStreak: (s: Saved, today: string) => boolean;
beforeAll(async () => {
  ({ completeDay, reconcileStreak } = await import("../src/client/store"));
});

const fresh = (): Saved => ({
  v: 1,
  player: "test",
  relaxed: false,
  streak: { current: 0, best: 0, thermos: 0, last: null },
  days: {},
  seen: {},
  notice: null,
});

describe("cold streak & Thermos", () => {
  test("consecutive days build a streak and earn a Thermos every 7", () => {
    const s = fresh();
    let earned = 0;
    for (let i = 0; i < 14; i++) if (completeDay(s, `2026-12-${String(i + 1).padStart(2, "0")}`)) earned++;
    expect(s.streak.current).toBe(14);
    expect(earned).toBe(2);
    expect(s.streak.thermos).toBe(2);
  });

  test("playing twice in a day doesn't double count", () => {
    const s = fresh();
    completeDay(s, "2026-12-01");
    completeDay(s, "2026-12-01");
    expect(s.streak.current).toBe(1);
  });

  test("a Thermos covers a missed day", () => {
    const s = fresh();
    for (let i = 1; i <= 7; i++) completeDay(s, `2026-12-0${i}`);
    expect(s.streak.thermos).toBe(1);
    completeDay(s, "2026-12-09"); // missed the 8th
    expect(s.streak.current).toBe(8);
    expect(s.streak.thermos).toBe(0);
    expect(s.notice).toEqual({ kind: "thermos", used: 1 });
  });

  test("without a Thermos the streak thaws", () => {
    const s = fresh();
    completeDay(s, "2026-12-01");
    completeDay(s, "2026-12-02");
    expect(reconcileStreak(s, "2026-12-05")).toBe(true);
    expect(s.streak.current).toBe(0);
    expect(s.notice).toEqual({ kind: "broken", was: 2 });
    completeDay(s, "2026-12-05");
    expect(s.streak.current).toBe(1);
    expect(s.streak.best).toBe(2);
  });
});
