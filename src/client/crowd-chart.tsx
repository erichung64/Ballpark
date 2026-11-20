// The reveal chart: where everyone's guesses landed (a histogram on a log
// scale) with two labelled rules — your guess in ink, the answer in the accent
// — and the crowd's median as a small marker under the baseline. Every mark
// carries its value as a label, so nothing depends on reading colour.

import { useState } from "preact/hooks";
import { formatNum, formatTick } from "../shared/format";
import type { QuestionInfo, QuestionResult } from "../shared/types";

const W = 340;
const H = 156;
const X0 = 12;
const X1 = W - 12;
const ROW1 = 11; // top label rows
const ROW2 = 24;
const TOP = 34; // tallest bar
const BASE = 104; // histogram baseline
const CROWD_Y = BASE + 24;
const TICKS = H - 4;

export function decadeTicks(min: number, max: number, maxLabels = 6): number[] {
  const a = Math.ceil(Math.log10(min) - 1e-9);
  const b = Math.floor(Math.log10(max) + 1e-9);
  const stride = Math.max(1, Math.ceil((b - a + 1) / maxLabels));
  const out: number[] = [];
  for (let e = a; e <= b; e += stride) out.push(10 ** e);
  return out;
}

/** Rough text width at 10px, for keeping labels inside the frame and apart. */
const textW = (s: string) => s.length * 6.1;

export function CrowdChart({ info, result }: { info: QuestionInfo; result: QuestionResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const { bins, median } = result.crowd;
  const lmin = Math.log10(info.min);
  const span = Math.log10(info.max) - lmin;
  const x = (v: number) => X0 + (X1 - X0) * Math.min(1, Math.max(0, (Math.log10(v) - lmin) / span));
  const binW = (X1 - X0) / bins.length;
  const barW = Math.min(24, binW - 2); // 2px surface gap between bars
  const max = Math.max(1, ...bins);
  const binOf = (v: number) => Math.max(0, Math.min(bins.length - 1, Math.floor(((Math.log10(v) - lmin) / span) * bins.length)));
  const binRange = (i: number) => [10 ** (lmin + (span * i) / bins.length), 10 ** (lmin + (span * (i + 1)) / bins.length)] as const;

  const ax = x(result.answer);
  const gx = result.guess != null ? x(result.guess) : null;
  const mx = median != null ? x(median) : null;
  const myBin = result.guess != null ? binOf(result.guess) : null;

  // Top labels: the answer on row 1; yours shares it when there's room, otherwise row 2.
  const answerText = `Answer ${formatNum(result.answer, 2)}`;
  const youText = result.guess != null ? `You ${formatNum(result.guess, 2)}` : "";
  const place = (px: number, text: string) => {
    const w = textW(text);
    const left = Math.max(X0, Math.min(X1 - w, px - w / 2));
    return { left, right: left + w };
  };
  const aLab = place(ax, answerText);
  const yLab = gx != null ? place(gx, youText) : null;
  const youRow = yLab && (yLab.right + 8 > aLab.left && yLab.left < aLab.right + 8) ? ROW2 : ROW1;

  function bar(i: number, n: number) {
    if (n === 0) return null;
    const h = (n / max) * (BASE - TOP);
    const bx = X0 + i * binW + (binW - barW) / 2;
    const r = Math.min(3, barW / 2, h);
    const y = BASE - h;
    // Rounded data end, square at the baseline.
    const d = `M${bx},${BASE}V${y + r}Q${bx},${y} ${bx + r},${y}H${bx + barW - r}Q${bx + barW},${y} ${bx + barW},${y + r}V${BASE}Z`;
    const cls = `bar${i === myBin ? " mine" : ""}${hover === i ? " hot" : ""}`;
    return <path key={i} d={d} class={cls} style={{ "--i": i } as Record<string, number>} />;
  }

  function onMove(e: PointerEvent) {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const i = Math.floor((((e.clientX - r.left) / r.width) * W - X0) / binW);
    setHover(i >= 0 && i < bins.length && bins[i]! > 0 ? i : null);
  }

  const tip = hover != null ? binRange(hover) : null;
  const crowdText = median != null ? `Crowd ${formatNum(median, 2)}` : "";
  const cLab = mx != null ? place(mx, crowdText) : null;

  return (
    <figure class="crowd">
      <figcaption class="kicker">Where everyone guessed</figcaption>
      <div class="crowd-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Histogram of ${result.crowd.players} players' guesses. ${answerText}. ${youText}. ${crowdText}.`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {bins.map((n, i) => bar(i, n))}
          <line class="baseline" x1={X0} x2={X1} y1={BASE + 0.5} y2={BASE + 0.5} />

          {gx != null && yLab && (
            <g class="you-mark">
              <line x1={gx} x2={gx} y1={youRow + 4} y2={BASE} />
            </g>
          )}

          <line class="truth" x1={ax} x2={ax} y1={ROW1 + 4} y2={BASE} pathLength={1} />
          {gx != null && yLab && (
            <text class="rule-label you-label" x={yLab.left} y={youRow}>
              <tspan class="rule-key">You</tspan> {formatNum(result.guess!, 2)}
            </text>
          )}
          <text class="rule-label answer" x={aLab.left} y={ROW1}>
            <tspan class="rule-key">Answer</tspan> {formatNum(result.answer, 2)}
          </text>

          {mx != null && cLab && (
            <g class="crowd-mark">
              <path d={`M${mx},${BASE + 3}l4.5,7h-9z`} />
              <text class="lane-label" x={cLab.left} y={CROWD_Y}>
                <tspan class="rule-key">Crowd</tspan> {formatNum(median!, 2)}
              </text>
            </g>
          )}

          {decadeTicks(info.min, info.max).map((v) => (
            <text key={v} class="tick-label" x={x(v)} y={TICKS} text-anchor="middle">
              {formatTick(v)}
            </text>
          ))}
        </svg>
        {tip && hover != null && (
          <div class="crowd-tip" style={{ left: `${((X0 + (hover + 0.5) * binW) / W) * 100}%` }}>
            <b>{bins[hover]!.toLocaleString()}</b> guessed {formatNum(tip[0], 2)}–{formatNum(tip[1], 2)}
          </div>
        )}
      </div>
      <table class="sr-only">
        <caption>Guesses by range</caption>
        <tbody>
          {bins.map((n, i) =>
            n ? (
              <tr key={i}>
                <th scope="row">
                  {formatNum(binRange(i)[0], 2)} to {formatNum(binRange(i)[1], 2)} {info.unit}
                </th>
                <td>{n}</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
    </figure>
  );
}
