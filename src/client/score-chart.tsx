// "Where everyone finished": the day's scores as a histogram, with your band
// in ink and everyone else in the neutral crowd tone. One series plus one
// highlighted bar, so the "You" label is the only key needed.

import { useState } from "preact/hooks";

const W = 340;
const H = 116;
const X0 = 10;
const X1 = W - 10;
const TOP = 18;
const BASE = 84;
const BAND = 25;

export function ScoreChart({ bins, score, max }: { bins: number[]; score: number; max: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const slot = (X1 - X0) / bins.length;
  const barW = Math.min(24, slot - 2);
  const top = Math.max(1, ...bins);
  const mine = Math.min(bins.length - 1, Math.floor(score / BAND));
  const x = (v: number) => X0 + ((X1 - X0) * v) / max;
  const label = (i: number) => `${i * BAND}–${Math.min(max, i * BAND + BAND - 1)}`;

  function onMove(e: PointerEvent) {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const i = Math.floor((((e.clientX - r.left) / r.width) * W - X0) / slot);
    setHover(i >= 0 && i < bins.length ? i : null);
  }

  return (
    <figure class="crowd scores">
      <figcaption class="kicker">Where everyone finished</figcaption>
      <div class="crowd-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Histogram of today's scores. You scored ${score}.`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {bins.map((n, i) => {
            if (!n) return null;
            const h = Math.max(2, (n / top) * (BASE - TOP));
            const bx = X0 + i * slot + (slot - barW) / 2;
            const r = Math.min(3, barW / 2, h);
            const y = BASE - h;
            const d = `M${bx},${BASE}V${y + r}Q${bx},${y} ${bx + r},${y}H${bx + barW - r}Q${bx + barW},${y} ${bx + barW},${y + r}V${BASE}Z`;
            const cls = i === mine ? "bar mine" : `bar${hover === i ? " hot" : ""}`;
            return <path key={i} d={d} class={cls} style={{ "--i": i } as Record<string, number>} />;
          })}
          <line class="baseline" x1={X0} x2={X1} y1={BASE + 0.5} y2={BASE + 0.5} />
          <text class="you-label" x={X0 + (mine + 0.5) * slot} y={Math.max(11, BASE - Math.max(2, (bins[mine]! / top) * (BASE - TOP)) - 6)} text-anchor="middle">
            You
          </text>
          {[0, 100, 200, 300, 400, 500].filter((v) => v <= max).map((v) => (
            <text key={v} class="tick-label" x={x(v)} y={H - 10} text-anchor="middle">
              {v}
            </text>
          ))}
        </svg>
        {hover != null && (
          <div class="crowd-tip" style={{ left: `${((X0 + (hover + 0.5) * slot) / W) * 100}%` }}>
            <b>{bins[hover]!.toLocaleString()}</b> scored {label(hover)}
          </div>
        )}
      </div>
      <table class="sr-only">
        <caption>Players by score</caption>
        <tbody>
          {bins.map((n, i) => (
            <tr key={i}>
              <th scope="row">{label(i)}</th>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
