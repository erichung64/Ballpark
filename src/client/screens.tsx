import { useState } from "preact/hooks";
import { formatNum } from "../shared/format";
import { MAX_SCORE, points as pointsFor } from "../shared/scoring";
import type { Standing } from "../shared/types";
import { shareResult, shareText, type ShareOutcome } from "./share";
import { THERMOS_EVERY, THERMOS_MAX, lifetime, type DayRecord, type Saved } from "./store";
import { ScoreChart } from "./score-chart";
import { Marks, Masthead, longDate, useCountdown } from "./ui";

export interface DevInfo {
  date: string;
  prev: string;
  next: string;
}

function DevBar({ dev }: { dev: DevInfo }) {
  return (
    <p class="devbar">
      dev · playing <b>{dev.date}</b> · <a href={`?date=${dev.prev}`}>← day before</a> · <a href={`?date=${dev.next}`}>day after →</a> ·{" "}
      <a href="?">today</a>
    </p>
  );
}

function Dateline({ number, date }: { number: number; date: string }) {
  return (
    <p class="dateline">
      <span>No. {number}</span>
      <span>{longDate(date)}</span>
    </p>
  );
}

export function StreakLine({ saved, earned }: { saved: Saved; earned?: boolean }) {
  const st = saved.streak;
  const life = lifetime(saved);
  return (
    <section class="stats">
      <div class="stat">
        <span class="stat-value">{st.current}</span>
        <span class="stat-label">Day streak{st.best > st.current ? ` · best ${st.best}` : ""}</span>
      </div>
      <div class="stat" title={`A rain check covers a missed day automatically. Earn one every ${THERMOS_EVERY} days in a row (hold up to ${THERMOS_MAX}).`}>
        <span class="stat-value">
          {st.thermos}
          <span class="muted">/{THERMOS_MAX}</span>
        </span>
        <span class="stat-label">Rain checks</span>
      </div>
      <div class="stat">
        <span class="stat-value">{life.compared ? `${Math.round((life.beat / life.compared) * 100)}%` : "—"}</span>
        <span class="stat-label">Beat the crowd{life.average != null ? ` · avg ${life.average} pts` : ""}</span>
      </div>
      {earned && <p class="stat-note">Seven in a row — you earned a rain check. It saves your streak if you miss a day.</p>}
    </section>
  );
}

function Notice({ saved }: { saved: Saved }) {
  const n = saved.notice;
  if (!n) return null;
  return (
    <p class="notice">
      {n.kind === "thermos"
        ? `A rain check covered ${n.used > 1 ? `${n.used} missed days` : "the day you missed"} — your streak is intact.`
        : `Your ${n.was}-day streak ended. Today starts a new one.`}
    </p>
  );
}

/** Yesterday's final placing and the question that fooled everyone. */
export function YesterdayCard({ data, onDismiss }: { data: Standing; onDismiss: () => void }) {
  const h = data.hardest;
  return (
    <section class="yesterday">
      <p class="kicker">
        Yesterday · No. {data.number} <span class="sep">·</span> {data.settled ? "Final" : "Still counting"}
      </p>
      {data.score != null && (
        <p class="yesterday-score">
          You scored <b>{data.score}</b>
          {data.players >= 2 && data.beat != null && (
            <>
              {" "}
              — better than <b>{data.beat}%</b> of {data.players.toLocaleString()} players
            </>
          )}
          .
        </p>
      )}
      {h && (
        <p class="yesterday-hard">
          The one that fooled everyone: <i>{h.text}</i> The crowd's median guess was {formatNum(h.median, 2)} — {h.miss.toLowerCase()}. The answer:{" "}
          <b>{h.answerText}</b>.
        </p>
      )}
      <button class="btn text" onClick={onDismiss}>
        Dismiss
      </button>
    </section>
  );
}

/** The scoring rule, drawn: points against how far off you are. */
function ScoringCurve() {
  const W = 320;
  const X0 = 14;
  const X1 = W - 14;
  const TOP = 16;
  const BASE = 70;
  const lim = Math.log2(10);
  const xOf = (d: number) => X0 + ((d + lim) / (2 * lim)) * (X1 - X0);
  const yOf = (p: number) => BASE - ((BASE - TOP) * p) / 100;
  const path = Array.from({ length: 121 }, (_, i) => {
    const d = -lim + (2 * lim * i) / 120;
    return `${i ? "L" : "M"}${xOf(d).toFixed(1)},${yOf(100 / (1 + Math.abs(d) ** 1.5)).toFixed(1)}`;
  }).join("");
  const marks = [
    { d: -lim, label: "÷10" },
    { d: -1, label: "Half" },
    { d: 0, label: "Spot on" },
    { d: 1, label: "Double" },
    { d: lim, label: "×10" },
  ];
  return (
    <figure class="curve">
      <figcaption class="kicker">Points for how close you get</figcaption>
      <svg viewBox={`0 0 ${W} 96`} role="img" aria-label="Spot on scores 100. Half or double scores 50. Ten times off scores 14.">
        <line class="curve-base" x1={X0} x2={X1} y1={BASE + 0.5} y2={BASE + 0.5} />
        <path class="curve-area" d={`${path}L${X1},${BASE}L${X0},${BASE}Z`} />
        <path class="curve-line" d={path} />
        {marks.map((m) => {
          const p = pointsFor(2 ** m.d, 1);
          return (
            <g key={m.label}>
              <circle class="curve-dot" cx={xOf(m.d)} cy={yOf(p)} r={4} />
              <text class="curve-pts" x={xOf(m.d)} y={yOf(p) - 8} text-anchor="middle">
                {p}
              </text>
              <text class="curve-label" x={xOf(m.d)} y={90} text-anchor={m.d === -lim ? "start" : m.d === lim ? "end" : "middle"}>
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function HowToPlay() {
  return (
    <section class="how">
      <p class="kicker">How to play</p>
      <ol>
        <li>
          <b>Type your best guess.</b> The thousand, million and billion keys make big numbers easy.
        </li>
        <li>
          <b>The closer you get, the more you score.</b> Nobody gets zero for trying.
        </li>
        <li>
          <b>See how everyone else guessed</b> — and whether you beat the crowd's median guess.
        </li>
      </ol>
      <ScoringCurve />
    </section>
  );
}

export function Home(props: {
  date: string;
  number: number;
  categories: string[];
  saved: Saved;
  started: boolean;
  seconds: number;
  onPlay: () => void;
  onToggleRelaxed: () => void;
  yesterday: Standing | null;
  onDismissYesterday: () => void;
  dev: DevInfo | null;
}) {
  const { saved } = props;
  return (
    <main class="page home">
      <Masthead />
      <Dateline number={props.number} date={props.date} />

      <section class="lede">
        <h1>Five numbers. How close can you get?</h1>
        <p class="deck">Guess each one. The closer you are, the more you score — then see how you did against everyone else.</p>
        <p class="today">
          <span class="kicker">Today</span> {props.categories.join(" · ")}
        </p>
        <button class="btn primary big" onClick={props.onPlay}>
          {props.started ? "Continue today's Ballpark" : "Start today's Ballpark"}
        </button>
        <p class="fine">
          5 questions · {saved.relaxed || !saved.onboarded ? props.seconds * 2 : props.seconds} seconds each
          {!saved.onboarded && " on your first day"}
        </p>
      </section>

      <Notice saved={saved} />
      {props.yesterday && <YesterdayCard data={props.yesterday} onDismiss={props.onDismissYesterday} />}

      <HowToPlay />

      <StreakLine saved={saved} />

      <footer class="foot">
        <label class="toggle">
          <input type="checkbox" checked={saved.relaxed} onChange={props.onToggleRelaxed} />
          <span>Relaxed timer ({props.seconds * 2} seconds)</span>
        </label>
        {props.dev && <DevBar dev={props.dev} />}
      </footer>
    </main>
  );
}

export function Summary(props: {
  rec: DayRecord;
  saved: Saved;
  earned: boolean;
  standing: Standing | null;
  yesterday: Standing | null;
  onDismissYesterday: () => void;
  onReplay: () => void;
  dev: DevInfo | null;
}) {
  const { rec, standing } = props;
  const countdown = useCountdown();
  const [status, setStatus] = useState<ShareOutcome | null>(null);
  const text = shareText(rec, standing);
  const compared = rec.results.filter((r) => r.beatCrowd != null);
  const beatN = compared.filter((r) => r.beatCrowd).length;

  async function share() {
    const s = await shareResult(text);
    setStatus(s);
    if (s !== "cancelled") setTimeout(() => setStatus(null), 2400);
  }

  const ranked = standing && standing.score != null && standing.players > 0;
  const bigCrowd = ranked && standing!.players >= 20;

  return (
    <main class="page summary">
      <Masthead small />
      <Dateline number={rec.number} date={rec.date} />

      <section class="score-block">
        <p class="kicker">Today's score</p>
        <p class="score">
          <b>{rec.score}</b>
          <span>/{MAX_SCORE}</span>
        </p>
        <Marks points={rec.results.map((r) => r.points)} />
        <div class="score-stats">
          <p>
            <b>{bigCrowd ? `Better than ${standing!.beat}%` : ranked ? `Rank ${standing!.rank}` : "—"}</b>
            <span>{ranked ? `of ${standing!.players.toLocaleString()} players so far` : "counting players…"}</span>
          </p>
          <p>
            <b>{compared.length ? `${beatN} of ${compared.length}` : "—"}</b>
            <span>times you beat the crowd</span>
          </p>
        </div>
        {bigCrowd && <ScoreChart bins={standing!.distribution} score={rec.score} max={MAX_SCORE} />}
        <button class="btn primary big" onClick={share}>
          {status === "copied" ? "Copied — paste it anywhere" : status === "shared" ? "Shared" : status === "failed" ? "Couldn't copy" : "Share your score"}
        </button>
        <pre class="share-preview" aria-label="Share text preview">
          {text}
        </pre>
      </section>

      <section class="ledger">
        <p class="kicker">Your answers</p>
        <ol>
          {rec.results.map((r) => (
            <li key={r.q}>
              <p class="ledger-q">{r.text}</p>
              <p class="ledger-row">
                <span>
                  Answer <b>{r.answerText}</b>
                </span>
                <span class="muted">
                  {r.guess != null ? `you said ${formatNum(r.guess)}` : "no guess"}
                  {r.beatCrowd && " · beat the crowd"}
                </span>
                <span class={`ledger-pts${r.points ? "" : " miss"}`}>{r.points}</span>
              </p>
            </li>
          ))}
        </ol>
        <button class="btn text" onClick={props.onReplay}>
          Look through today's reveals again
        </button>
      </section>

      {props.yesterday && <YesterdayCard data={props.yesterday} onDismiss={props.onDismissYesterday} />}
      <StreakLine saved={props.saved} earned={props.earned} />

      <section class="tomorrow">
        <p class="kicker">Next Ballpark in</p>
        <p class="countdown">{countdown}</p>
        <p class="fine">Your placing keeps updating as the rest of the world plays. Final standings tomorrow.</p>
      </section>
      {props.dev && (
        <footer class="foot">
          <DevBar dev={props.dev} />
        </footer>
      )}
    </main>
  );
}
