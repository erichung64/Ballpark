// Number formatting for an estimation game: readable at any magnitude, from
// micrometres to 10⁶⁷.

const SUPERS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export function superscript(n: number): string {
  return (n < 0 ? "⁻" : "") + String(Math.abs(n)).replace(/\d/g, (d) => SUPERS[Number(d)]!);
}

export function roundSig(v: number, sig: number): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  const p = Math.floor(Math.log10(Math.abs(v))) - sig + 1;
  const f = 10 ** p;
  return Math.round(v / f) * f;
}

function plain(v: number, sig: number): string {
  const r = roundSig(v, sig);
  const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(r))));
  return r.toLocaleString("en-US", { maximumFractionDigits: Math.min(decimals, 6) });
}

/** "8,850" · "8.7 million" · "40 trillion" · "4.3 × 10¹⁹" · "0.0021". */
export function formatNum(v: number, sig = 3): string {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e15 || (a > 0 && a < 1e-4)) {
    const e = Math.floor(Math.log10(a));
    const m = roundSig(v / 10 ** e, sig);
    const mant = m === 1 ? "" : `${plain(m, sig)} × `;
    return `${mant}10${superscript(e)}`;
  }
  if (a >= 1e12) return `${plain(v / 1e12, sig)} trillion`;
  if (a >= 1e9) return `${plain(v / 1e9, sig)} billion`;
  if (a >= 1e6) return `${plain(v / 1e6, sig)} million`;
  return plain(v, sig);
}

/** Short form for axis ticks: 1 · 10 · 1K · 10K · 1M · 1B · 1T · 10¹⁵ · 0.01. */
export function formatTick(v: number): string {
  const e = Math.round(Math.log10(v));
  if (e >= 15 || e <= -4) return `10${superscript(e)}`;
  if (e >= 12) return `${10 ** (e - 12)}T`;
  if (e >= 9) return `${10 ** (e - 9)}B`;
  if (e >= 6) return `${10 ** (e - 6)}M`;
  if (e >= 3) return `${10 ** (e - 3)}K`;
  return String(10 ** e).replace(/^0\./, ".").replace(/^\./, "0.");
}

const WORDS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mn: 1e6,
  mil: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
  t: 1e12,
  tn: 1e12,
  trillion: 1e12,
};

/** Parse what people type: "8,849", "8.7m", "8.7 million", "4.3e19", "4.3x10^19". */
export function parseNum(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
  if (!s) return null;
  const sci = s.match(/^([\d.]+)\s*(?:x|×|\*)\s*10\s*\^\s*(-?\d+)$/);
  if (sci) return Number(sci[1]) * 10 ** Number(sci[2]);
  const m = s.match(/^([\d.]+(?:e-?\d+)?)\s*([a-z]+)?$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  if (!m[2]) return base;
  const mult = WORDS[m[2]];
  return mult ? base * mult : null;
}
