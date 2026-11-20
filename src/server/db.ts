// Storage: when each player first saw each question (for the clock), and
// their locked guess. Nothing else about players is kept.

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const DB_PATH = process.env.BALLPARK_DB ?? join(import.meta.dir, "../../data/ballpark.sqlite");
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH, { create: true, strict: true });
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL");

db.run(`CREATE TABLE IF NOT EXISTS opens (
  date TEXT NOT NULL,
  q INTEGER NOT NULL,
  player TEXT NOT NULL,
  at INTEGER NOT NULL,
  seconds INTEGER NOT NULL,
  PRIMARY KEY (date, q, player)
)`);

db.run(`CREATE TABLE IF NOT EXISTS guesses (
  date TEXT NOT NULL,
  q INTEGER NOT NULL,
  player TEXT NOT NULL,
  guess REAL,
  points INTEGER NOT NULL,
  late INTEGER NOT NULL DEFAULT 0,
  sim INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (date, q, player)
)`);
db.run("CREATE INDEX IF NOT EXISTS guesses_by_question ON guesses (date, q)");

export interface GuessRow {
  date: string;
  q: number;
  player: string;
  guess: number | null;
  points: number;
  late: number;
}

const qOpen = db.query<{ at: number; seconds: number }, { date: string; q: number; player: string }>(
  "SELECT at, seconds FROM opens WHERE date = $date AND q = $q AND player = $player",
);
const qInsertOpen = db.query(
  "INSERT OR IGNORE INTO opens (date, q, player, at, seconds) VALUES ($date, $q, $player, $at, $seconds)",
);
const qInsertGuess = db.query(
  `INSERT OR IGNORE INTO guesses (date, q, player, guess, points, late, sim, created_at)
   VALUES ($date, $q, $player, $guess, $points, $late, $sim, $now)`,
);
const qGuess = db.query<GuessRow, { date: string; q: number; player: string }>(
  "SELECT * FROM guesses WHERE date = $date AND q = $q AND player = $player",
);
const qPlayerDay = db.query<GuessRow, { date: string; player: string }>(
  "SELECT * FROM guesses WHERE date = $date AND player = $player ORDER BY q",
);

/** First sighting of a question starts its clock; later calls return the same start. */
export function openQuestion(date: string, q: number, player: string, seconds: number, now = Date.now()) {
  qInsertOpen.run({ date, q, player, at: now, seconds });
  return qOpen.get({ date, q, player })!;
}

export function getOpen(date: string, q: number, player: string) {
  return qOpen.get({ date, q, player });
}

export function insertGuess(
  g: { date: string; q: number; player: string; guess: number | null; points: number; late: boolean },
  sim = false,
): boolean {
  const res = qInsertGuess.run({ ...g, late: g.late ? 1 : 0, sim: sim ? 1 : 0, now: Date.now() });
  return res.changes > 0;
}

export function getGuess(date: string, q: number, player: string): GuessRow | null {
  return qGuess.get({ date, q, player });
}

export function getPlayerDay(date: string, player: string): GuessRow[] {
  return qPlayerDay.all({ date, player });
}
