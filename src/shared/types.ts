export interface QuestionInfo {
  id: string;
  category: string;
  q: string;
  /** Unit shown after numbers ("m", "visitors"). */
  unit: string;
  /** Log-scale axis bounds. */
  min: number;
  max: number;
}

export interface Crowd {
  /** Players who locked this question (including timeouts). */
  players: number;
  /** The crowd's median guess, or null if nobody guessed. */
  median: number | null;
  /** Count of guesses per equal log-width bin across the axis. */
  bins: number[];
}

export interface QuestionResult {
  q: number;
  guess: number | null;
  points: number;
  /** True if the guess arrived after the clock ran out. */
  late: boolean;
  answer: number;
  answerText: string;
  explain: string;
  source: { name: string; url?: string };
  crowd: Crowd;
  /** Share of other players you were closer than (null while the crowd is tiny). */
  closerThan: number | null;
  /** Closer than the crowd's median guess (null while the crowd is tiny). */
  beatCrowd: boolean | null;
}

export interface DayPayload {
  date: string;
  number: number;
  questions: QuestionInfo[];
  seconds: number;
  mine: (QuestionResult | null)[];
  dev: boolean;
}

export interface Standing {
  date: string;
  number: number;
  settled: boolean;
  score: number | null;
  /** Players who finished all five questions. */
  players: number;
  /** 1 = best. Ties share a rank. */
  rank: number | null;
  /** Percent of finishers you scored strictly higher than. */
  beat: number | null;
  /** Finishers per 25-point band of the day's score (0–24, 25–49 … 475–500). */
  distribution: number[];
  /** The question where the crowd's median guess was furthest off. */
  hardest: { q: number; text: string; median: number; answerText: string; unit: string; miss: string } | null;
}
