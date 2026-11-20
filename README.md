# Ballpark — the daily estimate

Five numbers a day, the same for everyone: "How many people visited the Louvre in 2024?" You type your best guess. **The closer you are, the more you score.** Then you see how everyone else guessed, and whether you beat the crowd.

> Pivoted from the earlier *Cold Spot* prototype (backed up in `.cold-spot-backup.tar.gz`; delete it whenever you like). The market analysis in `What Makes Daily Browser Games Go Viral.md` still applies: one shared puzzle a day, a spoiler-free share line, comparison that means something, streaks.

## Run it

```sh
bun install
bun run seed      # optional: a simulated crowd so the reveal charts have data
bun run dev       # http://localhost:3000
```

In development, `?date=2026-11-21` plays any day. The home and summary screens have ← / → links. Visiting the day after you've played shows yesterday's final standing and "the one that fooled everyone".

| Script | |
| --- | --- |
| `bun run dev` | Dev server with hot reload (API + app on one port) |
| `bun run start` | Production (`PORT`, default 3000) |
| `bun run seed` | Simulated players for today & yesterday (`--date YYYY-MM-DD --players N`) |
| `bun run reset` | Clear answers (`--sim` removes only simulated players) |
| `bun test` | Scoring, the keypad, the question bank, API secrecy and the clock |
| `bun run typecheck` | TypeScript |

The local database currently holds **simulated players** for #1 and #2 (1,240 and 860). Remove them with `bun run reset --sim`.

## How a round works

1. **Question** — one number to guess, with a 30-second clock (60 on your first day). The clock runs on the server, so reloading doesn't pause it and late answers score zero.
2. **Guess** — type it on the on-screen keypad, the way you'd say it: `8` `.` `8` `thousand`, or `450` `million`. There's no system keyboard to pop up. A physical keyboard works too (digits, `k`/`m`/`b`/`t`, Enter).
3. **Reveal** — the answer, your points, and how far off you were in plain words ("12% too low", "2.3× too high"). Then:
   - how many players you were closer than
   - whether you **beat the crowd**, meaning you were closer than everyone's median guess
   - a chart of where everyone guessed, with you and the crowd marked
   - a one-line explainer and a source
4. **Summary** — your score out of 500, how many players you beat, how often you beat the crowd, and **Where everyone finished** (today's scores, with yours marked). The share line looks like this:

```
Ballpark #1 — 418/500
🎯🟧🎯🎯🟩
Beat the crowd 2/5 · Top 1%
```

### Scoring

One rule: points depend on how far off you are, measured as a ratio, so guessing half or double the answer is equally far off.

| How close | Points |
| --- | --- |
| spot on (within 2%) | 100 |
| 10% off | ~95 |
| 25% off | ~85 |
| half or double | 50 |
| 3× off | 33 |
| 10× off | 14 |

It falls away smoothly, so a wild guess still earns a little; only no guess at all scores 0. The home screen draws this curve, so players know the rule before they start.

**Why not ranges?** An earlier version asked players for a guess *and* a confidence range. That's how a statistician thinks, not how people play: when asked how tall Everest is, you think of one number. "Beat the crowd" carries the depth instead. Real crowds lean systematically wrong on some questions (the simulated one lowballs the Louvre), so beating the median is a real achievement.

## Design

Editorial, like a newspaper puzzle page:
- newsprint background, black ink, hairline rules
- a double-ruled masthead
- *Newsreader* for headlines and questions, *Libre Franklin* for the interface and figures
- a single vermilion accent, reserved for the truth line and the clock
- a selected dark mode, not an automatic flip

The reveal chart follows the data-viz rules this project uses:
- one neutral series, so no legend
- bars with a 2 px gap and rounded data ends
- 3:1 contrast in both modes
- text in ink, never in data colours
- a per-bar tooltip on tap or hover, and a screen-reader table

## Code

```
src/shared/      scoring (closeness → points), number format/parse, dates, API types
src/server/
  index.ts       Bun.serve: HTML bundle + JSON API
  api.ts         /api/day · /api/open · /api/answer · /api/standing
  content.ts     loads content/questions.json (server-only)
  db.ts          bun:sqlite — question opens (the clock) + answers
  stats.ts       crowd histogram, median, "closer than" / beat-the-crowd, placing
src/client/      Preact app (~15 KB gzipped JS)
  play.tsx       question → guess → reveal
  keypad.tsx     number pad with thousand / million / billion / trillion keys
  crowd-chart.tsx  the reveal chart (crowd histogram, answer, you, crowd median)
  score-chart.tsx  the summary's "where everyone finished" chart
  screens.tsx    home, summary, yesterday card, stats
scripts/         seed, reset
test/            bun test suites
```

**Secrecy.** The day's questions load at release. Answers, explainers and crowd figures are sent only after a guess is locked, and `test/api.test.ts` checks that the day payload contains no answers. Identity is an anonymous id stored on the device, with no account; streaks, rain checks and history live there too.

**Days** cycle through `questions.json` from #1 on 2026-11-20 (`EPOCH` in `src/shared/dates.ts`). There are 8 days, 40 questions.

## Adding questions

Edit `src/server/content/questions.json`. Each question needs:
- `answer` and `answerText`
- a log axis (`min`, `max`)
- a short `explain` line
- a `source`

Prefer stable, well-documented figures, and give a year for anything that changes. Run `bun test`: it checks that:
- every day has 5 questions across at least 4 categories
- ids are unique
- every answer can be typed on the keypad (under 1,000 trillion)
- each chart axis frames its answer

## Not yet

- **More content.** Daily play needs a long queue of questions: 8 days isn't enough for launch.
- **Editorial review.** Each fact has a source, and the shakiest three (Louvre visitors, cloud weight, honey) were checked against their sources. Even so, have an editor verify the rest before launch.
- **Features still to build:** friend leagues, an archive and practice mode, accounts and sync, push notifications.
- **Name check.** "Ballpark" is a working title.
