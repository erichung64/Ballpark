import { useEffect, useRef, useState } from "preact/hooks";
import { formatNum } from "../shared/format";
import { describeMiss, offBy } from "../shared/scoring";
import type { DayPayload, QuestionInfo, QuestionResult } from "../shared/types";
import { api } from "./api";
import { CrowdChart } from "./crowd-chart";
import { EMPTY, GuessDisplay, Keypad, entryValue, press, type Entry } from "./keypad";
import { Marks, Masthead } from "./ui";

type Phase = "opening" | "guessing" | "locking" | "revealed";

interface Props {
  day: DayPayload;
  player: string;
  relaxed: boolean;
  /** First-time player: use the longer clock. */
  firstDay: boolean;
  onFinish: (results: QuestionResult[]) => void;
}

export function Play({ day, player, relaxed, firstDay, onFinish }: Props) {
  const n = day.questions.length;
  const [results, setResults] = useState<(QuestionResult | null)[]>(() => day.mine.slice());
  // Resume at the first unanswered question; a finished day replays its reveals.
  const [qi, setQi] = useState(() => Math.max(0, day.mine.findIndex((r) => !r)));
  const [phase, setPhase] = useState<Phase>(() => (day.mine[qi] ? "revealed" : "opening"));
  const [entry, setEntry] = useState<Entry>(EMPTY);
  const [left, setLeft] = useState(day.seconds);
  const [error, setError] = useState<string | null>(null);
  const deadline = useRef(0);
  const total = useRef(day.seconds);
  const barRef = useRef<HTMLDivElement>(null);
  const latest = useRef(entry);
  latest.current = entry;
  const busy = useRef(false);

  const info = day.questions[qi]!;

  // Start (or resume) the question's clock on the server.
  useEffect(() => {
    if (phase !== "opening") return;
    setError(null);
    api
      .open(day.date, qi, player, relaxed || firstDay)
      .then((o) => {
        total.current = o.seconds;
        deadline.current = Date.now() + o.remainingMs;
        setPhase("guessing");
      })
      .catch((e: Error) => setError(e.message || "Couldn't reach Ballpark"));
  }, [phase, qi]);

  useEffect(() => {
    if (phase !== "guessing") return;
    let raf = 0;
    const tick = () => {
      const ms = deadline.current - Date.now();
      barRef.current?.style.setProperty("--t", String(Math.max(0, ms / (total.current * 1000))));
      setLeft(Math.ceil(Math.max(0, ms) / 1000));
      if (ms <= 0) {
        lock();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, qi]);

  // A physical keyboard works too: digits, ".", Backspace, k/m/b/t, Enter.
  useEffect(() => {
    if (phase !== "guessing") return;
    const letters: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      let next: Entry | null = null;
      if (/^[0-9.]$/.test(k)) next = press(latest.current, k);
      else if (k === "backspace") next = press(latest.current, "back");
      else if (letters[k]) next = press(latest.current, letters[k]!);
      else if (k === "enter" && entryValue(latest.current) != null) {
        e.preventDefault();
        lock();
        return;
      }
      if (next) {
        e.preventDefault();
        setEntry(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, qi]);

  async function lock() {
    if (busy.current) return;
    busy.current = true;
    setPhase("locking");
    setError(null);
    try {
      const r = await api.answer(day.date, qi, entryValue(latest.current), player);
      setResults((prev) => {
        const next = prev.slice();
        next[qi] = r;
        return next;
      });
      setPhase("revealed");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message || "Couldn't reach Ballpark");
      setPhase("guessing");
    } finally {
      busy.current = false;
    }
  }

  function next() {
    if (qi < n - 1) {
      const nq = qi + 1;
      setQi(nq);
      setEntry(EMPTY);
      setPhase(results[nq] ? "revealed" : "opening");
      window.scrollTo({ top: 0 });
    } else {
      onFinish(results.filter((r): r is QuestionResult => !!r));
    }
  }

  const r = results[qi];
  const urgent = phase === "guessing" && left <= 5;
  const runningTotal = results.reduce((sum, x) => sum + (x?.points ?? 0), 0);
  const value = entryValue(entry);

  return (
    <div class="play">
      <header class="play-head">
        <Masthead small />
        <Marks points={results.map((x) => x?.points ?? null)} current={qi} />
        {phase === "revealed" ? (
          <span class="running" aria-label={`Score so far: ${runningTotal}`}>
            <b>{runningTotal}</b> pts
          </span>
        ) : (
          <span class={`clock${urgent ? " urgent" : ""}`} aria-live="off">
            {`0:${String(phase === "guessing" ? left : total.current).padStart(2, "0")}`}
          </span>
        )}
      </header>
      <div class={`time-rule${phase === "guessing" ? " running" : ""}${phase === "revealed" ? " done" : ""}`} ref={barRef} />

      <main class={`play-body${phase === "revealed" && r ? "" : " guessing"}`}>
        <p class="kicker">
          Question {qi + 1} of {n} <span class="sep">·</span> {info.category}
        </p>

        {phase !== "revealed" || !r ? (
          <>
            <h1 class="question" key={qi}>
              {info.q}
            </h1>
            <GuessDisplay entry={entry} unit={info.unit} />
            <Keypad entry={entry} disabled={phase !== "guessing"} onChange={setEntry} />
            {error && <p class="error">{error}</p>}
            <div class="action-bar">
              <button class="btn primary" disabled={value == null || phase !== "guessing"} onClick={lock}>
                {phase === "locking" ? "Locking…" : value == null ? "Type a guess" : "Lock in my guess"}
              </button>
            </div>
          </>
        ) : (
          <Reveal key={qi} info={info} result={r} last={qi === n - 1} onNext={next} />
        )}
      </main>
    </div>
  );
}

function Reveal({ info, result, last, onNext }: { info: QuestionInfo; result: QuestionResult; last: boolean; onNext: () => void }) {
  const nextRef = useRef<HTMLButtonElement>(null);
  // Keyboard users land on "Next" (Preact's autoFocus only works at page load).
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [result]);
  const g = result.guess;
  const c = result.crowd;

  return (
    <div class="reveal">
      <h1 class="question small">{info.q}</h1>
      <div class="answer">
        <span class="answer-label">Answer</span>
        <span class="answer-value">{result.answerText}</span>
      </div>

      <div class="verdict">
        <span class="verdict-points">
          <svg class="score-ring" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="37" pathLength="100" strokeDasharray={`${result.points} 100`} />
          </svg>
          <b>{result.points}</b>
          <span>points</span>
        </span>
        <span class="verdict-text">
          {g == null ? (
            result.late ? "Out of time — no guess." : "No guess."
          ) : (
            <>
              You said <b>{formatNum(g)}</b> — {describeMiss(g, result.answer).toLowerCase()}.
            </>
          )}
        </span>
      </div>

      {result.closerThan != null && c.median != null ? (
        <>
          <ul class="compare">
            <li>
              Closer than <b>{Math.round(result.closerThan * 100)}%</b> of {c.players.toLocaleString()} players
            </li>
            <li class={result.beatCrowd ? "beat" : ""}>
              {result.beatCrowd ? "You beat the crowd. " : g != null && offBy(g, c.median) < 1.01 ? "You matched the crowd. " : "The crowd got closer. "}
              Their median guess was{" "}
              <b>
                {formatNum(c.median, 2)} {info.unit}
              </b>
              .
            </li>
          </ul>
          <CrowdChart info={info} result={result} />
        </>
      ) : (
        g != null && <GuessScale guess={g} answer={result.answer} />
      )}

      <p class="explain">
        {result.explain}{" "}
        <span class="source">
          {result.source.url ? (
            <a href={result.source.url} target="_blank" rel="noopener noreferrer">
              {result.source.name}
            </a>
          ) : (
            result.source.name
          )}
        </span>
      </p>

      <div class="action-bar">
        <button class="btn primary" onClick={onNext} ref={nextRef}>
          {last ? "See today's score" : "Next question"}
        </button>
      </div>
    </div>
  );
}

function GuessScale({ guess, answer }: { guess: number; answer: number }) {
  const offset = Math.log2(guess) - Math.log2(answer);
  // Keep the truth centered. Expand the scale for guesses beyond half or double.
  const octaves = Math.max(1, Math.ceil(Math.abs(offset)));
  const position = 50 + 50 * offset / octaves;
  return (
    <figure class="guess-scale" aria-label={`Your guess ${formatNum(guess)}. Answer ${formatNum(answer)}.`}>
      <figcaption class="kicker">Your estimate</figcaption>
      <div class="estimate-track" style={{ "--position": `${position}%` }}>
        <i class="estimate-target" />
        <i class="estimate-pin" />
      </div>
      <div class="scale-labels"><span>Low</span><strong>Answer</strong><span>High</span></div>
    </figure>
  );
}
