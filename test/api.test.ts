import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dbPath = join(tmpdir(), `ballpark-test-${process.pid}.sqlite`);
process.env.BALLPARK_DB = dbPath;
let api: typeof import("../src/server/api");
let db: typeof import("../src/server/db");

beforeAll(async () => {
  api = await import("../src/server/api");
  db = await import("../src/server/db");
});
afterAll(() => {
  for (const ext of ["", "-wal", "-shm"]) rmSync(dbPath + ext, { force: true });
});

const DATE = "2026-11-20";
const P = "player-one";
const get = (path: string) => new Request(`http://test${path}`);
const post = (path: string, body: unknown) =>
  new Request(`http://test${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const answer = (body: Record<string, unknown>) => api.handleAnswer(post("/api/answer", { date: DATE, player: P, ...body }), "ip");

describe("api", () => {
  test("the day payload never includes answers", async () => {
    const body = await (await api.handleDay(get(`/api/day?date=${DATE}&player=${P}`))).json();
    expect(body.questions).toHaveLength(5);
    const raw = JSON.stringify(body);
    for (const leak of ['"answer"', '"answerText"', '"explain"', "8849", "8,849"]) expect(raw).not.toContain(leak);
    expect(body.mine.every((m: unknown) => m === null)).toBe(true);
  });

  test("opening a question starts a clock that resumes, not resets", async () => {
    const first = await (await api.handleOpen(post("/api/open", { date: DATE, q: 0, player: P }), "ip")).json();
    expect(first.seconds).toBe(30);
    await Bun.sleep(30);
    const again = await (await api.handleOpen(post("/api/open", { date: DATE, q: 0, player: P }), "ip")).json();
    expect(again.remainingMs).toBeLessThan(first.remainingMs);
  });

  test("locking a guess reveals the answer; one guess per question", async () => {
    const r = await (await answer({ q: 0, guess: 9000 })).json();
    expect(r).toMatchObject({ q: 0, guess: 9000, points: 100, answer: 8849, late: false });
    expect(r.crowd.players).toBe(1);
    expect(r.closerThan).toBeNull(); // too few players to compare yet
    const again = await (await answer({ q: 0, guess: 1 })).json();
    expect(again.guess).toBe(9000);
  });

  test("comparisons kick in once there's a crowd", async () => {
    for (const [i, g] of [5000, 6000, 20000, 30000, 100].entries()) {
      db.insertGuess({ date: DATE, q: 0, player: `crowd-${i}`, guess: g, points: 0, late: false }, true);
    }
    const r = await (await api.handleDay(get(`/api/day?date=${DATE}&player=${P}`))).json();
    const mine = r.mine[0];
    expect(mine.crowd.players).toBe(6);
    expect(mine.closerThan).toBe(1); // 9,000 beats all five
    expect(mine.beatCrowd).toBe(true);
    expect(mine.crowd.median).toBeGreaterThan(5000);
  });

  test("a guess after the clock runs out scores nothing", async () => {
    db.openQuestion(DATE, 1, P, 30, Date.now() - 60_000);
    const r = await (await answer({ q: 1, guess: 8.7e6 })).json();
    expect(r).toMatchObject({ late: true, points: 0, guess: null });
  });

  test("rejects junk", async () => {
    expect((await answer({ q: 9, guess: 1 })).status).toBe(400);
    expect((await answer({ q: 2, guess: -5 })).status).toBe(400);
    expect((await answer({ q: 2, guess: "lots" })).status).toBe(400);
    expect((await api.handleAnswer(post("/api/answer", { date: DATE, q: 2, guess: 5, player: "x" }), "ip")).status).toBe(400);
  });

  test("standing ranks finished players", async () => {
    for (const q of [2, 3, 4]) await answer({ q, guess: null });
    for (let q = 0; q < 5; q++) db.insertGuess({ date: DATE, q, player: "rival-player", guess: 1, points: 1, late: false }, true);
    const s = await (await api.handleStanding(get(`/api/standing?date=${DATE}&player=${P}&force=1`))).json();
    expect(s).toMatchObject({ score: 100, players: 2, rank: 1, beat: 50, settled: true });
    expect(s.distribution.reduce((a: number, b: number) => a + b, 0)).toBe(2);
    expect(s.hardest.miss).toMatch(/too (low|high)/);
  });
});
