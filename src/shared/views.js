// ── Published cross-module views (spec §5.3) ─────────────────────────
// Single-writer rule: each module owns its own stores. When another module
// needs that data it comes through a function defined here — never a direct
// store read. This is what stops the merges quietly coming apart: a facet that
// reaches into another's tables re-creates the coupling the merges removed,
// and nothing catches it until two screens disagree.
//
// These are read-only projections. Nothing in this file writes.
import { localDateStr } from "./dates.js";
import { migrateHabits, completionRate, isScheduled, isDone } from "./habitEngine.js";
import { habitFeed } from "../modules/habits/xpFeed.js";
import { sanitizeNutrition, dayTotals, sanitizeProfile } from "../modules/athlete/nutrition.js";
import { dayTargets } from "../modules/athlete/bodyTargets.js";
import { gymSessionsToWorkouts } from "../modules/gym/gymSessions.js";

const ds10 = (v) => String(v || "").slice(0, 10);
const back = (today, n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return localDateStr(d); };

/** Sleep — one authoritative source (criterion 40). `trade_sleep`, hours per day. */
export const SLEEP_FLOOR_HOURS = 6.5;
export function sleepView(rawSleep) {
  const map = rawSleep && typeof rawSleep === "object" && !Array.isArray(rawSleep) ? rawSleep : {};
  const byDay = {};
  for (const [d, h] of Object.entries(map)) {
    const hours = Number(h);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(hours) || hours <= 0) continue;
    byDay[d] = { hours, heldFloor: hours >= SLEEP_FLOOR_HOURS };
  }
  return {
    byDay,
    hoursOn: (d) => byDay[d]?.hours ?? null,
    heldFloorOn: (d) => (byDay[d] ? byDay[d].heldFloor : null),   // null ≠ false: unlogged is not a breach
    loggedDays: Object.keys(byDay).length,
  };
}

/**
 * Discipline publishes completions. The Firm reads its gate criteria through
 * this — it never touches ht_* or `habits` itself (criterion 39).
 */
export function disciplineView({ htHabits, htEntries, legacyHabits, today = localDateStr() } = {}) {
  const feed = habitFeed(htHabits, htEntries, today);
  const doneByDay = new Map();
  for (const c of feed.completions) {
    if (!doneByDay.has(c.d)) doneByDay.set(c.d, new Set());
    doneByDay.get(c.d).add(c.habitId);
  }
  const legacy = migrateHabits(legacyHabits).filter((h) => h && !h.archived && !h.paused);

  return {
    completedOn: (d) => doneByDay.get(d)?.size ?? 0,
    anyOn: (d) => (doneByDay.get(d)?.size ?? 0) > 0,
    // Scheduled-vs-done for the legacy store, through the engine's one
    // definition — null when nothing was scheduled, never 0.
    rateBetween: (start, end) => completionRate(legacy, start, end),
    scheduledOn: (d) => legacy.filter((h) => isScheduled(h, d)).length,
    heldOn: (d) => legacy.filter((h) => isScheduled(h, d) && isDone(h, d)).length,
    days: [...doneByDay.keys()].sort(),
  };
}

/** Body publishes sessions and adherence. */
export function bodyView({ nutrition, nutritionProfile, workouts, gymSessions, today = localDateStr() } = {}) {
  const log = sanitizeNutrition(nutrition);
  const profile = sanitizeProfile(nutritionProfile);
  const sessions = [
    ...(Array.isArray(workouts) ? workouts.filter(Boolean) : []),
    ...gymSessionsToWorkouts(gymSessions),
  ];
  const trainedDays = new Set(sessions.map((w) => ds10(w.date)).filter(Boolean));

  const adherenceOn = (d) => {
    const entries = log[d];
    if (!entries || !entries.length) return null;               // unlogged ≠ missed
    const t = dayTotals(entries);
    const target = dayTargets({ profile, sessions, ds: d, today }).targets;
    return {
      logged: true,
      trained: trainedDays.has(d),
      protein: target.p > 0 ? (t.p || 0) / target.p : null,
      kcal: target.kcal > 0 ? (t.kcal || 0) / target.kcal : null,
      hitProtein: target.p > 0 && (t.p || 0) >= target.p * 0.95,
    };
  };

  return {
    adherenceOn,
    trainedOn: (d) => trainedDays.has(d),
    loggedDays: Object.keys(log).sort(),
    sessionCount: sessions.length,
  };
}

/** The last `n` dates ending today, oldest first. */
export const windowDays = (today, n) => Array.from({ length: n }, (_, i) => back(today, n - 1 - i));
