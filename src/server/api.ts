// HTTP API. Questions go out at release; answers, explainers and crowd figures
// go out only after a guess is locked. The clock is enforced here, not just in
// the browser, so a question can't be paused to look it up.

import { dayNumber, hasEndedSomewhere, isDateKey, isLive, isSettled } from "../shared/dates";
import { MAX_SCORE, describeMiss, offBy, points } from "../shared/scoring";
import type { DayPayload, QuestionResult, Standing } from "../shared/types";
import { dayFor, publicInfo, type QuestionDef } from "./content";
import { getGuess, getOpen, getPlayerDay, insertGuess, openQuestion, type GuessRow } from "./db";
import { compare, crowd, dayTotals, distribution, placing } from "./stats";

export const isDev = process.env.NODE_ENV !== "production";
export const SECONDS = 30;
export const RELAXED_SECONDS = 60;
/** Network slack on top of the visible clock. */
const GRACE_MS = 4000;
const PLAYER_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function json(req: Request, data: unknown, status = 200): Response {
  const body = JSON.stringify(data);
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (body.length > 1024 && (req.headers.get("accept-encoding") ?? "").includes("gzip")) {
    headers["content-encoding"] = "gzip";
    headers.vary = "accept-encoding";
    return new Response(Bun.gzipSync(body), { status, headers });
  }
  return new Response(body, { status, headers });
}

const fail = (req: Request, error: string, status = 400) => json(req, { error }, status);

function dateError(date: unknown): string | null {
  if (!isDateKey(date)) return "Bad date";
  if (dayNumber(date) < 1) return "Ballpark hadn't launched yet on that date";
  if (!isDev && !isLive(date)) return "That puzzle isn't live";
  return null;
}

// ---- rate limiting (per IP, token bucket) ----------------------------------
const buckets = new Map<string, { tokens: number; at: number }>();
function allow(ip: string, perMinute = 120): boolean {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  const ok = b.tokens >= 1;
  if (ok) b.tokens -= 1;
  buckets.set(ip, b);
  if (buckets.size > 50_000) buckets.clear();
  return ok;
}

async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

function result(date: string, q: number, def: QuestionDef, row: GuessRow): QuestionResult {
  return {
    q,
    guess: row.guess,
    points: row.points,
    late: !!row.late,
    answer: def.answer,
    answerText: def.answerText,
    explain: def.explain,
    source: def.source,
    crowd: crowd(date, q, def),
    ...compare(date, q, def, row.guess),
  };
}

// ---- handlers -------------------------------------------------------------
export async function handleDay(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const err = dateError(date);
  if (err) return fail(req, err, 404);
  const d = (await dayFor(date!))!;
  const player = url.searchParams.get("player");
  const rows = player && PLAYER_RE.test(player) ? getPlayerDay(date!, player) : [];
  const payload: DayPayload = {
    date: date!,
    number: d.number,
    questions: d.day.questions.map(publicInfo),
    seconds: SECONDS,
    mine: d.day.questions.map((def, i) => {
      const row = rows.find((r) => r.q === i);
      return row ? result(date!, i, def, row) : null;
    }),
    dev: isDev,
  };
  return json(req, payload);
}

/** Start (or resume) a question's clock. Returns the time left. */
export async function handleOpen(req: Request, ip: string): Promise<Response> {
  if (!allow(ip)) return fail(req, "Slow down a little", 429);
  const body = await readJson<{ date?: unknown; q?: unknown; player?: unknown; relaxed?: unknown }>(req);
  if (!body) return fail(req, "Bad request");
  const err = dateError(body.date);
  if (err) return fail(req, err, 404);
  const date = body.date as string;
  if (typeof body.player !== "string" || !PLAYER_RE.test(body.player)) return fail(req, "Bad player");
  const d = (await dayFor(date))!;
  const q = body.q;
  if (typeof q !== "number" || !Number.isInteger(q) || q < 0 || q >= d.day.questions.length) return fail(req, "Bad question");
  const open = openQuestion(date, q, body.player, body.relaxed === true ? RELAXED_SECONDS : SECONDS);
  const remainingMs = Math.max(0, open.at + open.seconds * 1000 - Date.now());
  return json(req, { seconds: open.seconds, remainingMs });
}

export async function handleAnswer(req: Request, ip: string): Promise<Response> {
  if (!allow(ip)) return fail(req, "Slow down a little", 429);
  const body = await readJson<{ date?: unknown; q?: unknown; guess?: unknown; player?: unknown }>(req);
  if (!body) return fail(req, "Bad request");
  const err = dateError(body.date);
  if (err) return fail(req, err, 404);
  const date = body.date as string;
  const player = body.player;
  if (typeof player !== "string" || !PLAYER_RE.test(player)) return fail(req, "Bad player");
  const d = (await dayFor(date))!;
  const q = body.q;
  if (typeof q !== "number" || !Number.isInteger(q) || q < 0 || q >= d.day.questions.length) return fail(req, "Bad question");
  const def = d.day.questions[q]!;
  let guess: number | null = null;
  if (body.guess != null) {
    if (typeof body.guess !== "number" || !Number.isFinite(body.guess) || body.guess <= 0) return fail(req, "Bad guess");
    guess = body.guess;
  }

  // The clock started when the question was first opened.
  const open = getOpen(date, q, player) ?? openQuestion(date, q, player, SECONDS);
  const late = Date.now() > open.at + open.seconds * 1000 + GRACE_MS;
  // A late guess could have been looked up: it scores nothing and stays out of the crowd figures.
  if (late) guess = null;
  insertGuess({ date, q, player, guess, points: points(guess, def.answer), late });
  return json(req, result(date, q, def, getGuess(date, q, player)!));
}

export async function handleStanding(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const player = url.searchParams.get("player");
  if (!isDateKey(date) || dayNumber(date) < 1) return fail(req, "Bad date");
  if (!player || !PLAYER_RE.test(player)) return fail(req, "Bad player");
  // In development, ?force=1 pretends the day is over everywhere.
  const force = isDev && url.searchParams.get("force") === "1";
  const d = (await dayFor(date))!;
  const rows = getPlayerDay(date, player);
  const totals = dayTotals(date);
  const mine = rows.length === d.day.questions.length ? rows.reduce((s, r) => s + r.points, 0) : null;
  const place = mine != null ? placing(totals, mine) : { players: totals.size, rank: null, beat: null };

  // The question that fooled the crowd most — only once it can't spoil anyone.
  let hardest: Standing["hardest"] = null;
  if (force || hasEndedSomewhere(date)) {
    let worst = 1;
    d.day.questions.forEach((def, i) => {
      const m = crowd(date, i, def).median;
      if (m == null || offBy(m, def.answer) <= worst) return;
      worst = offBy(m, def.answer);
      hardest = { q: i, text: def.q, median: m, answerText: def.answerText, unit: def.unit, miss: describeMiss(m, def.answer) };
    });
  }

  const payload: Standing = {
    date,
    number: d.number,
    settled: force || isSettled(date),
    score: mine,
    players: place.players,
    rank: place.rank,
    beat: place.beat,
    distribution: distribution(totals, MAX_SCORE),
    hardest,
  };
  return json(req, payload);
}
