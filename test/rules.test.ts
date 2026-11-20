import { describe, expect, test } from "bun:test";
import { addDays, dayNumber, isLive, isSettled, liveWindow, toUTC } from "../src/shared/dates";
import { formatNum, formatTick, parseNum } from "../src/shared/format";
import { describeMiss, glyph, offBy, points } from "../src/shared/scoring";
import { EMPTY, entryValue, press, type Entry } from "../src/client/keypad";

describe("scoring", () => {
  test("closer scores more, with the anchors players are told", () => {
    expect(points(8849, 8849)).toBe(100);
    expect(points(8700, 8849)).toBe(100); // within 2%
    expect(points(9734, 8849)).toBe(95); // 10% high
    expect(points(2 * 8849, 8849)).toBe(50);
    expect(points(8849 / 2, 8849)).toBe(50);
    expect(points(88490, 8849)).toBe(14);
    expect(points(null, 8849)).toBe(0);
  });

  test("half and double are equally far off", () => {
    expect(points(50, 100)).toBe(points(200, 100));
    expect(offBy(50, 100)).toBe(2);
    expect(offBy(200, 100)).toBe(2);
  });

  test("points never increase as you move away", () => {
    let prev = 101;
    for (let r = 1; r < 1000; r *= 1.07) {
      const p = points(100 * r, 100);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
    expect(points(1e9, 1)).toBeGreaterThan(0); // a wild guess still scores something
  });

  test("plain-words distance", () => {
    expect(describeMiss(100, 100)).toBe("Spot on");
    expect(describeMiss(112, 100)).toBe("12% too high");
    expect(describeMiss(88, 100)).toBe("12% too low");
    expect(describeMiss(230, 100)).toBe("2.3× too high");
    expect(describeMiss(25, 100)).toBe("4× too low");
  });

  test("share glyphs", () => {
    expect([100, 90, 75, 50, 30, 10, 0].map(glyph).join("")).toBe("🎯🎯🟩🟨🟧🟥⬛");
  });
});

describe("keypad", () => {
  const type = (keys: (string | number)[]) => keys.reduce<Entry>((e, k) => press(e, k), EMPTY);
  test("numbers the way people say them", () => {
    expect(entryValue(type(["8", ".", "8", 1e3]))).toBe(8800);
    expect(entryValue(type(["4", "5", "0", 1e6]))).toBe(450e6);
    expect(entryValue(type(["2", "0", "6"]))).toBe(206);
  });
  test("editing", () => {
    expect(type(["0", "7"]).digits).toBe("7");
    expect(type([".", "5"]).digits).toBe("0.5");
    expect(type(["1", ".", ".", "2"]).digits).toBe("1.2");
    expect(type(["1", "2", "back"]).digits).toBe("1");
    expect(type([1e6, "back"]).mult).toBe(1);
    expect(type(["5", 1e6, 1e6]).mult).toBe(1); // tapping again toggles off
    expect(type(["5", 1e6, 1e9]).mult).toBe(1e9);
    expect(entryValue(type([]))).toBeNull();
    expect(entryValue(type(["0"]))).toBeNull();
  });
});

describe("number formatting", () => {
  test("readable at any magnitude", () => {
    expect(formatNum(8849)).toBe("8,850");
    expect(formatNum(8849, 4)).toBe("8,849");
    expect(formatNum(8.7e6)).toBe("8.7 million");
    expect(formatNum(4.01e13, 2)).toBe("40 trillion");
    expect(formatNum(11.574)).toBe("11.6");
    expect(formatNum(0.0021)).toBe("0.0021");
  });
  test("axis ticks", () => {
    expect([1, 10, 1e3, 1e4, 1e6, 1e9, 1e12, 1e15, 0.01].map(formatTick)).toEqual(["1", "10", "1K", "10K", "1M", "1B", "1T", "10¹⁵", "0.01"]);
  });
  test("parses what people type", () => {
    expect(parseNum("8,849")).toBe(8849);
    expect(parseNum("8.7m")).toBe(8.7e6);
    expect(parseNum("banana")).toBeNull();
  });
});

describe("dates", () => {
  test("day numbers start at the epoch", () => {
    expect(dayNumber("2026-11-20")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  test("a date is live while it's that date somewhere on Earth", () => {
    const w = liveWindow("2026-11-20");
    expect(isLive("2026-11-20", toUTC("2026-11-20"))).toBe(true);
    expect(isLive("2026-11-20", w.opens - 1)).toBe(false);
    expect(isLive("2026-11-20", w.closes)).toBe(false);
    expect(isSettled("2026-11-20", w.closes)).toBe(true);
  });
});
