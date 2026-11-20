// Number entry the way people say numbers: "8.8 thousand", "450 million".
// An on-screen keypad, so there's no system keyboard to pop up and push the
// layout around, and big numbers are two taps instead of nine zeros.


export interface Entry {
  digits: string;
  mult: number;
}

export const EMPTY: Entry = { digits: "", mult: 1 };

export const MULTS = [
  { label: "thousand", v: 1e3 },
  { label: "million", v: 1e6 },
  { label: "billion", v: 1e9 },
  { label: "trillion", v: 1e12 },
];

export function entryValue(e: Entry): number | null {
  const n = Number(e.digits);
  return e.digits && Number.isFinite(n) && n > 0 ? n * e.mult : null;
}

/** Apply one key press. Keys: "0"–"9", ".", "back", or a multiplier as a number. */
export function press(e: Entry, key: string | number): Entry {
  if (typeof key === "number") return { ...e, mult: e.mult === key ? 1 : key };
  if (key === "back") {
    if (!e.digits && e.mult > 1) return { ...e, mult: 1 };
    return { ...e, digits: e.digits.slice(0, -1) };
  }
  if (key === ".") {
    if (e.digits.includes(".")) return e;
    return { ...e, digits: (e.digits || "0") + "." };
  }
  const [whole = "", frac] = e.digits.split(".");
  if (frac != null ? frac.length >= 3 : whole.length >= 9) return e;
  if (e.digits === "0") return { ...e, digits: key };
  return { ...e, digits: e.digits + key };
}

/** "8800" → "8,800" while keeping a trailing "." or partial decimals as typed. */
function grouped(digits: string): string {
  const [whole = "", frac] = digits.split(".");
  const w = whole ? Number(whole).toLocaleString("en-US") : "0";
  return frac != null ? `${w}.${frac}` : w;
}

export function GuessDisplay({ entry, unit }: { entry: Entry; unit: string }) {
  const value = entryValue(entry);
  const word = MULTS.find((m) => m.v === entry.mult)?.label;
  if (!entry.digits && !word) {
    return (
      <div class="guess-display empty" aria-live="polite">
        <p class="guess-big">Your guess?</p>
        <p class="guess-sub">Type a number. The closer you get, the more you score.</p>
      </div>
    );
  }
  return (
    <div class="guess-display" aria-live="polite">
      <p class="guess-big">
        {entry.digits ? grouped(entry.digits) : <span class="muted">…</span>}
        {word && <span class="guess-word"> {word}</span>}
        <span class="guess-unit"> {unit}</span>
      </p>
      {/* Spell out "8.8 thousand" as 8,800; millions and up already read fine as words. */}
      <p class="guess-sub">{value != null && entry.mult > 1 && value < 1e9 ? `= ${Math.round(value).toLocaleString("en-US")} ${unit}` : " "}</p>
    </div>
  );
}

export function Keypad({ entry, disabled, onChange }: { entry: Entry; disabled: boolean; onChange: (e: Entry) => void }) {
  const key = (k: string, label = k, aria?: string) => (
    <button type="button" class="key" disabled={disabled} aria-label={aria ?? label} onClick={() => onChange(press(entry, k))}>
      {label}
    </button>
  );
  const mult = (i: number) => {
    const m = MULTS[i]!;
    return (
      <button
        type="button"
        class={`key mult${entry.mult === m.v ? " on" : ""}`}
        disabled={disabled}
        aria-pressed={entry.mult === m.v}
        onClick={() => onChange(press(entry, m.v))}
      >
        {m.label}
      </button>
    );
  };
  return (
    <div class="keypad" role="group" aria-label="Number pad">
      {key("1")}
      {key("2")}
      {key("3")}
      {mult(0)}
      {key("4")}
      {key("5")}
      {key("6")}
      {mult(1)}
      {key("7")}
      {key("8")}
      {key("9")}
      {mult(2)}
      {key(".", ".", "decimal point")}
      {key("0")}
      {key("back", "⌫", "delete")}
      {mult(3)}
    </div>
  );
}
