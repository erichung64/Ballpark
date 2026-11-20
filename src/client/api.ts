import type { DayPayload, QuestionResult, Standing } from "../shared/types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const post = <T>(url: string, body: unknown) =>
  call<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  day: (date: string, player: string) => call<DayPayload>(`/api/day?date=${date}&player=${encodeURIComponent(player)}`),

  open: (date: string, q: number, player: string, relaxed: boolean) =>
    post<{ seconds: number; remainingMs: number }>("/api/open", { date, q, player, relaxed }),

  answer: (date: string, q: number, guess: number | null, player: string) =>
    post<QuestionResult>("/api/answer", { date, q, guess, player }),

  standing: (date: string, player: string, force = false) =>
    call<Standing>(`/api/standing?date=${date}&player=${encodeURIComponent(player)}${force ? "&force=1" : ""}`),
};
