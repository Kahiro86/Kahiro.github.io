// "Did this day count?" — the single definition of completion.
import type { Habit, Entry } from "./dbTypes";

/**
 * No row means unlogged, which is not a completion. An explicit value of
 * 0 means the user recorded a miss — also not a completion, but a
 * genuinely different state that Layer 1 preserves and the UI shows
 * differently (an x, not an empty cell).
 */
/**
 * Whether "explicitly missed" is a state this habit can be in — Layer 2b §3.
 *
 * For an `at_most` habit it is not. The tri-state model reads `value = 0`
 * as a recorded miss, but for "no more than 30 minutes of scrolling" a
 * logged zero is the BEST possible outcome, not a failure. You cannot
 * fail to not smoke. So for these habits 0 is a completion, and the
 * explicit-miss state is disallowed rather than left to be discovered:
 * the only way to say "I did not log this" is to have no row.
 */
export function allowsExplicitMiss(habit: Habit): boolean {
  return !(habit.type === "numeric" && habit.targetDirection === "at_most");
}

export function isCompleted(habit: Habit, entry: Entry | null | undefined): boolean {
  if (!entry) return false;
  if (habit.type === "boolean") return entry.value === 1;
  const target = habit.target ?? 0;
  return habit.targetDirection === "at_most" ? entry.value <= target : entry.value >= target;
}

// ── How MUCH of it was done ──────────────────────────────────────────
// isCompleted answers a yes/no question, and every consumer downstream has
// been reading only that — so five minutes of a fifteen-minute stretch was
// indistinguishable from not stretching at all. The value was never lost
// (Layer 1 stores entry.value verbatim); nothing computed with it.
//
// The ratio is deliberately NOT clamped at 1. Twenty minutes against a
// fifteen-minute target is 133%, and flattening that to "done" throws away
// the fact that the target may be too low.

export type CompletionStatus = "unlogged" | "none" | "partial" | "complete" | "exceeded";

export interface Completion {
  /** actual ÷ target, or null when the habit has no meaningful ratio. */
  ratio: number | null;
  /** Whole-percent form of `ratio`, for display. Null when ratio is null. */
  pct: number | null;
  status: CompletionStatus;
  /** What was recorded, in the habit's own unit. Null when nothing was. */
  actual: number | null;
  target: number | null;
  unit: string | null;
  done: boolean;
}

const UNLOGGED: Completion = {
  ratio: null, pct: null, status: "unlogged", actual: null, target: null, unit: null, done: false,
};

export function completionOf(habit: Habit, entry: Entry | null | undefined): Completion {
  const unit = habit.unit ?? null;
  if (!entry) return { ...UNLOGGED, target: habit.target ?? null, unit };

  const actual = entry.value;
  const done = isCompleted(habit, entry);

  // A boolean habit has no magnitude: it is done or explicitly not.
  if (habit.type !== "numeric") {
    return {
      ratio: done ? 1 : 0, pct: done ? 100 : 0,
      status: done ? "complete" : "none",
      actual, target: 1, unit, done,
    };
  }

  const target = habit.target ?? 0;

  // "No more than N" inverts the meaning of a ratio: less is better, so a
  // percentage of the ceiling is a measure of how close to failing you came,
  // not of progress. Reporting 33% for "3 of a maximum 9 cigarettes" as if
  // it were a third of an achievement would be exactly backwards.
  if (habit.targetDirection === "at_most") {
    return {
      ratio: null, pct: null,
      status: done ? "complete" : "none",
      actual, target, unit, done,
    };
  }

  if (target <= 0) {
    return { ratio: null, pct: null, status: done ? "complete" : "none", actual, target, unit, done };
  }

  const ratio = actual / target;
  const status: CompletionStatus =
    ratio <= 0 ? "none" : ratio < 1 ? "partial" : ratio > 1 ? "exceeded" : "complete";

  return { ratio, pct: Math.round(ratio * 100), status, actual, target, unit, done };
}
