// ── Habit → XP / consistency feed ────────────────────────────────────
// Maps the new tracker's stores (ht_habits + ht_entries) into the raw
// material the shared XP engine already knows how to reward — the exact
// signals the old habit engine produced: every completed habit-day, perfect
// days, and per-habit streak runs. It derives them through the vendored
// tracker's OWN scheduling + completion rules, so day-of-week and quota
// habits count precisely as the tracker itself shows them.
//
// Pure and idempotent, like the rest of the XP engine: nothing is stored,
// XP is recomputed from immutable entries, so recomputation never
// double-awards and offline edits just re-derive.
import { daysAgoStr } from "../../shared/dates.js";
import { isScheduled } from "./logic/schedule";
import { isCompleted } from "./logic/completion";
import { toEntryMap } from "./logic/core";

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);
// Two years back — the same window the old per-habit streak walk used, long
// enough that every ladder milestone up to 365 can still be reached.
const LOOKBACK = 730;

// Per-subtype completion value. Kept at or above what each source paid before
// the Discipline merge so no day's XP can decrease (non-negotiable 6):
// purity was 10, journal 15, standard habits 10.
export const SUBTYPE_XP = { standard: 10, abstinence: 15, journal: 15 };

/**
 * Returns the raw signals for the XP engine to price with its own value
 * table (so tuning stays in one place):
 *   · completions — one date per completed habit-day (→ habitDone + Habit Mastery)
 *   · perfectDays — dates where ≥2 scheduled habits were all completed
 *   · streakHits  — { d, run } for every completed scheduled day, so the
 *                   engine's streak ladder can pay each milestone on the day
 *                   it was actually reached
 *   · bestStreak  — the longest per-habit run (feeds The Streak journey)
 */
export function habitFeed(htHabits, htEntries, today) {
  const habits = arr(htHabits).filter((h) => h && h.id && !h.archivedAt);
  const completions = [];   // { d, xp, habitId } — value depends on the habit's subtype
  const perfectDays = [];
  const streakHits = [];
  let bestStreak = 0;
  if (!habits.length) return { completions, perfectDays, streakHits, bestStreak };

  // Group entries by habit once, then a date→entry map per habit.
  const byHabit = new Map();
  for (const e of arr(htEntries)) {
    if (!e || !e.habitId) continue;
    let list = byHabit.get(e.habitId);
    if (!list) byHabit.set(e.habitId, (list = []));
    list.push(e);
  }
  const mapOf = new Map();
  for (const h of habits) mapOf.set(h.id, toEntryMap(byHabit.get(h.id) || []));

  // Completed habit-days — counted wherever a completing entry exists,
  // regardless of schedule, exactly as the old engine counted logs.
  for (const h of habits) {
    const worth = SUBTYPE_XP[h.subtype] || SUBTYPE_XP.standard;
    for (const [d, entry] of mapOf.get(h.id)) {
      if (isCompleted(h, entry)) completions.push({ d, xp: worth, habitId: h.id });
    }
  }

  // Per-habit streak walk, chronological. A completed scheduled day extends
  // the run; a scheduled but uncompleted PAST day breaks it (today is still
  // pending and never breaks). Same rule the tracker's own streak uses.
  for (const h of habits) {
    const map = mapOf.get(h.id);
    let run = 0;
    for (let i = LOOKBACK - 1; i >= 0; i--) {
      const ds = daysAgoStr(i);
      if (!isScheduled(h, ds)) continue;
      if (isCompleted(h, map.get(ds))) {
        run++;
        streakHits.push({ d: ds, run });
        if (run > bestStreak) bestStreak = run;
      } else if (ds !== today) {
        run = 0;
      }
    }
  }

  // Perfect days — a day is perfect when at least two habits are scheduled
  // and every scheduled one is done (a single-habit day is not a "perfect
  // day", matching the old rule).
  for (let i = 0; i < LOOKBACK; i++) {
    const ds = daysAgoStr(i);
    const sched = habits.filter((h) => isScheduled(h, ds));
    if (sched.length >= 2 && sched.every((h) => isCompleted(h, mapOf.get(h.id).get(ds)))) {
      perfectDays.push(ds);
    }
  }

  return { completions, perfectDays, streakHits, bestStreak };
}
