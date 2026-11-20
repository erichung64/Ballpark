// Simulated crowd for local testing and demos. Real players aren't affected,
// and `bun run reset --sim` removes everything this adds.
//
//   bun run seed                              # yesterday (900) + today (420)
//   bun run seed --date 2026-11-21 --players 300
//
// Each question gets a share of people who actually know (they land close),
// and everyone else guesses around a crowd-wide lean, because real crowds are
// systematically wrong about some things — which is what makes "beat the
// crowd" interesting. The lean is capped so the answer never ends up outside
// everyone's guesses, which no real crowd does.

import { parseArgs } from "node:util";
import { addDays, localDate } from "../src/shared/dates";
import { roundSig } from "../src/shared/format";
import { points } from "../src/shared/scoring";
import { dayFor } from "../src/server/content";
import { db, insertGuess } from "../src/server/db";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { date: { type: "string" }, players: { type: "string" } },
});

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedDay(date: string, players: number) {
  const d = await dayFor(date);
  if (!d) {
    console.log(`${date}: before launch, skipped`);
    return;
  }
  const rand = rng(`seed:${date}`);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  const existing = db.query<{ n: number }, { date: string }>("SELECT COUNT(DISTINCT player) n FROM guesses WHERE date = $date AND sim = 1").get({ date })!.n;
  // How hard each question is for the crowd (spread, in natural-log units) and which way it leans.
  const qs = d.day.questions.map(() => ({
    knowers: 0.06 + rand() * 0.2,
    lean: Math.max(-0.75, Math.min(0.75, gauss() * 0.45)),
    spread: 0.35 + rand() * 0.85,
  }));

  db.transaction(() => {
    for (let p = 0; p < players; p++) {
      const player = `sim-${date}-${existing + p}`;
      const skill = 0.4 + rand() * 1.1;
      d.day.questions.forEach((def, qi) => {
        if (rand() < 0.03) {
          insertGuess({ date, q: qi, player, guess: null, points: 0, late: true }, true);
          return;
        }
        const q = qs[qi]!;
        const raw = rand() < q.knowers ? def.answer * Math.exp(gauss() * 0.1) : def.answer * Math.exp(q.lean + gauss() * q.spread * skill);
        // People type round numbers.
        const guess = roundSig(raw, rand() < 0.6 ? 1 : 2);
        insertGuess({ date, q: qi, player, guess, points: points(guess, def.answer), late: false }, true);
      });
    }
  })();
  console.log(`${date} (#${d.number}): +${players} simulated players`);
}

if (values.date) {
  await seedDay(values.date, Number(values.players ?? 420));
} else {
  const today = localDate();
  await seedDay(addDays(today, -1), Number(values.players ?? 900));
  await seedDay(today, Number(values.players ?? 420));
}
