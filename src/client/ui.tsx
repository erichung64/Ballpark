import { useEffect, useState } from "preact/hooks";

export function Masthead({ small }: { small?: boolean }) {
  return (
    <div class={`masthead${small ? " small" : ""}`}>
      <span class="masthead-name">Ballpark</span>
      {!small && <span class="masthead-tag">The daily estimate</span>}
    </div>
  );
}

export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function useReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Time until local midnight, "hh:mm:ss". */
export function useCountdown(): string {
  const calc = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0")).join(":");
  };
  const [v, setV] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setV(calc()), 1000);
    return () => clearInterval(t);
  }, []);
  return v;
}

/** One square per question, filled in proportion to its points. */
export function Marks({ points, current }: { points: (number | null)[]; current?: number }) {
  return (
    <ol class="marks" aria-label="Questions">
      {points.map((p, i) => (
        <li
          key={i}
          class={`${p == null ? "todo" : p === 0 ? "miss" : ""}${i === current ? " cur" : ""}`}
          aria-label={`Question ${i + 1}: ${p == null ? "not answered" : `${p} points`}`}
        >
          {p != null && p > 0 && <span style={{ height: `${Math.max(8, p)}%` }} />}
        </li>
      ))}
    </ol>
  );
}
