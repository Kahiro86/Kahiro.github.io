// ── Year of Consistency — the app-wide "did you show up" engine ─────
// A day counts as a "consistency day" when a real action landed on it
// anywhere in the app — reusing the ledger's own per-day totals
// (`xp.byDay`), not a second tracking system. The start date is stamped
// once, the first time this runs for a user with none recorded yet, from
// their earliest day of actual activity. It used to bootstrap from the
// app-open stamp, which quietly made a discipline metric partly a measure
// of presence. The philosophy: progress continues, recovery
// matters more than perfection — missing a day never resets the counter,
// only the current streak, and even that only breaks on a truly skipped
// day (today itself is always given the benefit of the doubt, same
// tolerance the per-habit streak logic already uses).
import { useEffect } from "react";
import { useStorageState } from "./useStorageState.js";
import { localDateStr, daysBetween, daysAgoStr } from "./dates.js";

export const CONSISTENCY_START_KEY = "year_of_consistency_start";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// One-time-stamped start date. Bootstraps from the earliest known login day
// for existing users, or today for a brand-new user. Never moves once set.
/**
 * When the consistency run began.
 *
 * This used to be seeded from `xp_logins` — the app-open stamp — which meant a
 * discipline metric was partly measuring presence. It now starts from the
 * first day of real activity.
 *
 * @param activityDays dates on which something was actually logged. Anything
 *        iterable of date strings works: a Set, an array, or an object keyed
 *        by date (the shape `activeDays` and `byDay` both use).
 *
 * A start that is already stored is never recomputed. It is a number the user
 * has been watching climb, and moving it — in either direction — would be
 * rewriting their history to match a later opinion about how to measure it.
 */
export function useConsistencyStart(activityDays) {
  const [raw, setStart, loaded] = useStorageState(CONSISTENCY_START_KEY, null);
  const start = typeof raw === "string" && DATE_RE.test(raw) ? raw : null;

  useEffect(() => {
    if (!loaded || start) return;
    const days = activityDays instanceof Set ? [...activityDays]
      : Array.isArray(activityDays) ? activityDays
      : activityDays && typeof activityDays === "object" ? Object.keys(activityDays)
      : [];
    const earliest = days.filter((d) => typeof d === "string" && DATE_RE.test(d)).sort()[0];
    setStart(earliest || localDateStr());
  }, [loaded, start, activityDays]);

  return { start: start || localDateStr(), loaded };
}

// Sum of the modules' own per-category counts already computed by
// computeXp's `stats` — no new counting logic, just a total across them.
export function totalActivities(stats = {}) {
  const keys = [
    "habitCompletions", "tradeCount", "workoutCount", "mealDays",
    "journalDays", "reviewCount", "booksFinished", "churchCount", "goalsDone",
  ];
  return keys.reduce((s, k) => s + (stats[k] || 0), 0);
}

// Everything below derives from `byDay` (xpEngine's per-date XP totals) — a
// date counts if it has any XP at all, regardless of which module earned it.
// `opts.isFull(d)` is an optional predicate: return true/false to
// force whether a day counts, or null to defer to the normal "any XP" rule
// (used for days with nothing scheduled). Absent → normal mode, every day
// with any XP counts.
export function consistencyStats(byDay = {}, start, today = localDateStr(), opts = {}) {
  const anyXp = (d) => (byDay[d] || 0) > 0;
  const isDay = typeof opts.isFull === "function"
    ? (d) => { const r = opts.isFull(d); return r === null || r === undefined ? anyXp(d) : !!r; }
    : anyXp;
  const totalDays = Math.max(1, daysBetween(start, today) + 1);

  // Day N of 365 — rolls forward into "Cycle 2" past day 365 rather than
  // resetting; cycle number and day-within-cycle both derive from the same
  // running count since start (Day 1 = the start date itself).
  const daySinceStart = daysBetween(start, today) + 1;
  const cycle = Math.floor((daySinceStart - 1) / 365) + 1;
  const dayInCycle = ((daySinceStart - 1) % 365) + 1;
  const daysRemaining = 365 - dayInCycle;
  // Strict: every consistency percentage floors (truncates), never rounds up,
  // so a meter can never read higher than what was actually earned.
  const cycleCompletionPct = Math.floor((dayInCycle / 365) * 100);

  // Current streak: consecutive consistency-days walking back from today.
  // Today not yet logged never breaks it — the day isn't over yet.
  let currentStreak = 0;
  for (let i = 0; i < 3650; i++) {
    const d = daysAgoStr(i);
    if (d < start) break;
    if (isDay(d)) currentStreak++;
    else if (d !== today) break;
  }

  // Longest streak ever, walking the whole history chronologically.
  let longestStreak = 0, run = 0;
  for (let i = daysBetween(start, today); i >= 0; i--) {
    const d = daysAgoStr(i);
    if (d < start) continue;
    if (isDay(d)) { run++; longestStreak = Math.max(longestStreak, run); }
    else run = 0;
  }

  let daysShownUp = 0;
  for (let i = daysBetween(start, today); i >= 0; i--) {
    const d = daysAgoStr(i);
    if (d < start || d > today) continue;
    if (isDay(d)) daysShownUp++;
  }
  const consistencyRate = Math.floor((daysShownUp / totalDays) * 100);

  // % of consistency-days within a trailing window (capped at `start`).
  const rangePct = (days) => {
    let have = 0, span = 0;
    for (let i = 0; i < days; i++) {
      const d = daysAgoStr(i);
      if (d < start) break;
      span++;
      if (isDay(d)) have++;
    }
    return span ? Math.floor((have / span) * 100) : 0;
  };

  return {
    start, today,
    cycle, dayInCycle, daysRemaining, cycleCompletionPct,
    currentStreak, longestStreak,
    consistencyRate, daysShownUp, totalDays,
    weeklyCompletion: rangePct(7),
    monthlyCompletion: rangePct(30),
    yearlyCompletion: rangePct(365),
  };
}
