import { useEffect, useRef, useState } from "preact/hooks";
import { addDays, isDateKey, localDate } from "../shared/dates";
import type { DayPayload, QuestionResult, Standing } from "../shared/types";
import { api } from "./api";
import { Play } from "./play";
import { Home, Summary, type DevInfo } from "./screens";
import { completeDay, load, reconcileStreak, save, type DayRecord, type Saved } from "./store";
import { Masthead } from "./ui";

type Screen = "loading" | "home" | "play" | "summary";

function recordFrom(d: DayPayload, results: QuestionResult[]): DayRecord {
  const rows = results.map((r) => ({
    q: r.q,
    text: d.questions[r.q]!.q,
    unit: d.questions[r.q]!.unit,
    guess: r.guess,
    points: r.points,
    answerText: r.answerText,
    beatCrowd: r.beatCrowd,
  }));
  return { date: d.date, number: d.number, results: rows, score: rows.reduce((s, r) => s + r.points, 0), done: true };
}

export function App() {
  const override = new URLSearchParams(location.search).get("date");
  const [today] = useState(() => isDateKey(override) ? override : localDate());

  const [saved, setSaved] = useState<Saved>(() => {
    const s = load();
    if (reconcileStreak(s, today)) save(s);
    return s;
  });
  const latest = useRef(saved);
  latest.current = saved;
  /** Apply a change to saved state synchronously, persist it, and re-render. */
  const update = <T,>(fn: (s: Saved) => T): T => {
    const next = structuredClone(latest.current);
    const out = fn(next);
    save(next);
    latest.current = next;
    setSaved(next);
    return out;
  };

  const [day, setDay] = useState<DayPayload | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [error, setError] = useState<string | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [yesterday, setYesterday] = useState<Standing | null>(null);
  const [earned, setEarned] = useState(false);

  function finish(d: DayPayload, results: QuestionResult[]) {
    const got = update((s) => {
      s.days[d.date] = recordFrom(d, results);
      s.notice = null;
      s.onboarded = true;
      return completeDay(s, d.date);
    });
    setEarned(got);
  }

  function fetchDay() {
    setError(null);
    api
      .day(today, saved.player)
      .then((d) => {
        setDay(d);
        if (d.mine.every(Boolean)) {
          if (!latest.current.days[d.date]?.done) finish(d, d.mine as QuestionResult[]);
          setScreen("summary");
        } else setScreen("home");
      })
      .catch((e: Error) => setError(e.message || "Couldn't reach Ballpark"));
  }
  useEffect(fetchDay, []);

  // Let a timed round finish. Idle and returning tabs pick up the new local day.
  useEffect(() => {
    if (isDateKey(override) || screen === "play") return;
    const refresh = () => {
      if (localDate() !== today) location.reload();
    };
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(refresh, Math.max(0, midnight.getTime() - Date.now()));
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [today, override, screen]);

  // Your placing today, refreshed whenever the summary is shown.
  useEffect(() => {
    if (screen !== "summary" || !day) return;
    api.standing(day.date, saved.player).then(setStanding).catch(() => {});
  }, [screen, day]);

  // Yesterday's final result, until dismissed.
  useEffect(() => {
    if (!day) return;
    const prev = Object.values(saved.days)
      .filter((r) => r.done && r.date < today && !saved.seen[r.date])
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!prev) return;
    api
      .standing(prev.date, saved.player, day.dev && !!override)
      .then((s) => setYesterday(s.score != null ? s : null))
      .catch(() => {});
  }, [day]);

  const dismissYesterday = () => {
    if (yesterday) update((s) => void (s.seen[yesterday.date] = true));
    setYesterday(null);
  };

  const dev: DevInfo | null = day?.dev ? { date: today, prev: addDays(today, -1), next: addDays(today, 1) } : null;

  if (error || screen === "loading" || !day) {
    return (
      <main class="splash">
        <Masthead />
        <p class="splash-msg">{error ?? "Setting today's questions…"}</p>
        {error && (
          <button class="btn primary" onClick={fetchDay}>
            Try again
          </button>
        )}
      </main>
    );
  }

  if (screen === "play") {
    return (
      <Play
        day={day}
        player={saved.player}
        relaxed={saved.relaxed}
        firstDay={!saved.onboarded}
        onFinish={(results) => {
          setDay({ ...day, mine: results });
          if (!latest.current.days[day.date]?.done) finish(day, results);
          setScreen("summary");
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  const rec = saved.days[day.date];
  if (screen === "summary" && rec) {
    return (
      <Summary
        rec={rec}
        saved={saved}
        earned={earned}
        standing={standing}
        yesterday={yesterday}
        onDismissYesterday={dismissYesterday}
        onReplay={() => setScreen("play")}
        dev={dev}
      />
    );
  }

  return (
    <Home
      date={day.date}
      number={day.number}
      categories={day.questions.map((q) => q.category)}
      saved={saved}
      started={day.mine.some(Boolean)}
      seconds={day.seconds}
      onPlay={() => {
        update((s) => void (s.notice = null));
        setScreen("play");
      }}
      onToggleRelaxed={() => update((s) => void (s.relaxed = !s.relaxed))}
      yesterday={yesterday}
      onDismissYesterday={dismissYesterday}
      dev={dev}
    />
  );
}
