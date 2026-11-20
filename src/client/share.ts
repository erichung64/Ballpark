// The share artifact: plain text that pastes anywhere and gives nothing away.

import { MAX_SCORE, glyph } from "../shared/scoring";
import type { Standing } from "../shared/types";
import type { DayRecord } from "./store";

export function shareText(rec: DayRecord, standing: Standing | null, origin = location.origin): string {
  const lines = [`Ballpark #${rec.number} — ${rec.score}/${MAX_SCORE}`, rec.results.map((r) => glyph(r.points)).join("")];
  const compared = rec.results.filter((r) => r.beatCrowd != null);
  const parts: string[] = [];
  if (compared.length) parts.push(`Beat the crowd ${compared.filter((r) => r.beatCrowd).length}/${compared.length}`);
  // Placing is only worth sharing when it's a brag: top half of a real crowd.
  const top = standing?.beat != null ? Math.max(1, 100 - standing.beat) : null;
  if (top != null && top <= 50 && standing!.players >= 20) parts.push(`Top ${top}%`);
  if (parts.length) lines.push(parts.join(" · "));
  lines.push(origin.replace(/^https?:\/\//, ""));
  return lines.join("\n");
}

export type ShareOutcome = "shared" | "copied" | "failed" | "cancelled";

export async function shareResult(text: string): Promise<ShareOutcome> {
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok ? "copied" : "failed";
  }
}
