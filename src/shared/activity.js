// ── The activity feed ────────────────────────────────────────────────
// One canonical record for anything the person actually did, in one shape,
// so the Calendar, the Record, the recommendation layer and the streak maths
// all answer from the same evidence instead of each re-deriving "was this
// day done?" from a different store with slightly different rules.
//
// It is DERIVED, not a second database. Every module keeps its own store as
// the writer — nutrition_log owns meals, ht_entries owns habits, faith_church
// owns church — and this reads them. That matters for three reasons:
//
//   · no migration, so nothing existing has to be moved or risked;
//   · the feed cannot drift from the stores, because it IS the stores; and
//   · an edit or a delete propagates everywhere for free, since there is no
//     copy to keep in step.
//
// The app already worked this way for XP (shared/xp/collect.js turns stores
// into priced events). This is that idea generalised past XP, so the same
// evidence can answer "what happened on the 25th?" and "what am I neglecting?"
//
// The record (spec §9):
//   id        stable and derivable — the same activity always gets the same
//             id, which is what makes de-duplication possible without a table
//   date      YYYY-MM-DD, local
//   type      what was done ("habit", "workout", "meal", "prayer", …)
//   category  the domain it rolls up to, matching the XP domains
//   target    what was aimed at, in `unit` — null when there is no target
//   actual    what was recorded, in `unit`
//   unit      minutes, ml, sessions, kcal, …
//   pct       actual ÷ target as a whole percent — null when meaningless
//   status    unlogged · none · partial · complete · exceeded
//   source    the module that owns the write, so an edit has an address
//   label     what to show a person
import { localDateStr } from "./dates.js";
import { sanitizeNutrition, dayEntries, dayTotals, calcTargets, sanitizeProfile } from "../modules/athlete/nutrition.js";

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);
const ds10 = (v) => String(v || "").slice(0, 10);
const dOf = (v) => { const d = ds10(v); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; };
const num = (v) => (Number.isFinite(+v) ? +v : null);

export const STATUSES = ["unlogged", "none", "partial", "complete", "exceeded"];

/**
 * The four states a measured thing can be in, from a ratio. Kept here as the
 * one definition so a habit, a macro and a hydration target are all graded
 * by the same rule rather than three lookalike ternaries.
 */
export function statusOf(ratio) {
  if (ratio == null) return "unlogged";
  if (ratio <= 0) return "none";
  if (ratio < 1) return "partial";
  if (ratio > 1) return "exceeded";
  return "complete";
}

export const isDone = (a) => a.status === "complete" || a.status === "exceeded";

function activity({ id, date, type, category, label, actual = null, target = null, unit = null, source, meta }) {
  const ratio = target != null && target > 0 && actual != null ? actual / target : null;
  return {
    id, date, type, category, label, source,
    actual, target, unit,
    pct: ratio == null ? null : Math.round(ratio * 100),
    status: statusOf(ratio ?? (actual != null ? 1 : null)),
    ...(meta ? { meta } : {}),
  };
}

// ── Collectors ───────────────────────────────────────────────────────
// One per store. Each returns activities; none of them writes anything.

/**
 * Habits, with their magnitude intact. This is the collector the whole brief
 * turns on: a numeric habit contributes its actual value against its target,
 * so five minutes of a fifteen-minute stretch arrives as 33% partial rather
 * than as the absence of a completion.
 */
export function habitActivities({ htHabits, htEntries } = {}) {
  const habits = new Map(arr(htHabits).filter((h) => h.id).map((h) => [h.id, h]));
  const out = [];
  for (const e of arr(htEntries)) {
    const h = habits.get(e.habitId);
    const date = dOf(e.date);
    if (!h || !date) continue;

    const numeric = h.type === "numeric";
    const target = numeric ? num(h.target) : 1;
    const actual = num(e.value);
    if (actual == null) continue;

    // "No more than N" cannot be a percentage of an achievement — less is
    // better, so a ratio would read as progress toward failing.
    const atMost = numeric && h.targetDirection === "at_most";
    const a = atMost
      ? { ...activity({ id: `habit:${h.id}:${date}`, date, type: "habit", category: "discipline", label: h.name || "Habit", actual, target: null, unit: h.unit || null, source: "habits" }),
          status: target != null && actual <= target ? "complete" : "none", pct: null, target }
      : activity({
          id: `habit:${h.id}:${date}`, date, type: "habit", category: "discipline",
          label: h.name || "Habit", actual, target, unit: numeric ? (h.unit || null) : null,
          source: "habits",
        });
    out.push({ ...a, meta: { habitId: h.id, numeric } });
  }
  return out;
}

/** Workouts — one per session, counted as a session against a session. */
export function workoutActivities({ workouts } = {}) {
  return arr(workouts)
    .map((w) => {
      const date = dOf(w.date);
      if (!date) return null;
      return activity({
        id: `workout:${w.id || date}`, date, type: "workout", category: "body",
        label: w.type || w.name || "Workout", actual: 1, target: 1, unit: "session",
        source: "gym", meta: { sets: arr(w.sets).length },
      });
    })
    .filter(Boolean);
}

/**
 * A day's eating, graded against the day's real targets. Calories, protein
 * and fluid each become their own activity, because "did I eat" and "did I
 * hit protein" are different questions and collapsing them into one row is
 * how a day of 900 kcal reads as a completed day.
 */
export function nutritionActivities({ nutrition, nutritionProfile, hydration } = {}) {
  const log = sanitizeNutrition(nutrition);
  const t = calcTargets(sanitizeProfile(nutritionProfile));
  const direct = hydration && typeof hydration === "object" && !Array.isArray(hydration) ? hydration : {};
  const out = [];
  const days = new Set([...Object.keys(log), ...Object.keys(direct)].filter(dOf));

  for (const date of days) {
    const entries = dayEntries(log, date);
    const tot = dayTotals(entries);
    if (entries.length) {
      out.push(activity({ id: `meals:${date}`, date, type: "meal", category: "body", label: "Meals logged", actual: entries.length, target: 1, unit: "meals", source: "nutrition" }));
      if (t.kcal > 0) out.push(activity({ id: `kcal:${date}`, date, type: "calories", category: "body", label: "Calories", actual: Math.round(tot.kcal || 0), target: t.kcal, unit: "kcal", source: "nutrition" }));
      if (t.p > 0) out.push(activity({ id: `protein:${date}`, date, type: "protein", category: "body", label: "Protein", actual: Math.round(tot.p || 0), target: t.p, unit: "g", source: "nutrition" }));
    }
    // Fluid has two log paths and one definition — beverages in the food log
    // plus water logged against the linked habit.
    const ml = Math.round((tot.fluidMl || 0) + (num(direct[date]) || 0));
    if (ml > 0 && t.waterMl > 0) {
      out.push(activity({ id: `water:${date}`, date, type: "hydration", category: "body", label: "Hydration", actual: ml, target: t.waterMl, unit: "ml", source: "nutrition" }));
    }
  }
  return out;
}

/** Sleep, against the covenant's floor rather than an ideal. */
export function sleepActivities({ sleep, floor = 6.5 } = {}) {
  const map = sleep && typeof sleep === "object" && !Array.isArray(sleep) ? sleep : {};
  return Object.entries(map)
    .map(([date, h]) => {
      const hours = num(h);
      if (!dOf(date) || hours == null || hours <= 0) return null;
      return activity({ id: `sleep:${date}`, date, type: "sleep", category: "sleep", label: "Sleep", actual: hours, target: floor, unit: "h", source: "trading" });
    })
    .filter(Boolean);
}

/** Faith — church attendance, scripture, and reflection notes. */
export function faithActivities({ church, verses, faithNotes } = {}) {
  const out = [];
  for (const c of arr(church)) {
    const date = dOf(c.date);
    if (date) out.push(activity({ id: `church:${c.id || date}`, date, type: "church", category: "faith", label: c.title || "Church", actual: 1, target: 1, unit: "session", source: "faith" }));
  }
  // Scripture and notes are counted per DAY, not per row: reading four verses
  // in one sitting is one act of reading, and four rows on the calendar would
  // describe a devotion that did not happen.
  const perDay = (rows, type, label) => {
    const byDay = new Map();
    for (const r of arr(rows)) {
      const date = dOf(r.date || r.createdAt || r.addedAt);
      if (date) byDay.set(date, (byDay.get(date) || 0) + 1);
    }
    for (const [date, n] of byDay) {
      out.push(activity({ id: `${type}:${date}`, date, type, category: "faith", label, actual: n, target: 1, unit: type === "scripture" ? "passages" : "notes", source: "faith" }));
    }
  };
  perDay(verses, "scripture", "Scripture");
  perDay(faithNotes, "reflection", "Reflection");
  return out;
}

/** Journal entries and the day's purity claim. */
export function disciplineActivities({ entries, purity } = {}) {
  const out = [];
  const seen = new Set();
  for (const e of arr(entries)) {
    const date = dOf(e.date);
    if (!date || seen.has(date)) continue;
    seen.add(date);
    out.push(activity({ id: `journal:${date}`, date, type: "journal", category: "discipline", label: "Journal", actual: 1, target: 1, unit: "entry", source: "habits" }));
  }
  const log = purity && typeof purity === "object" && !Array.isArray(purity) ? purity : {};
  for (const [date, day] of Object.entries(log)) {
    if (!dOf(date) || !day) continue;
    const clean = day.s === "pure";
    out.push({
      ...activity({ id: `purity:${date}`, date, type: "purity", category: "discipline", label: "Abstinence", actual: clean ? 1 : 0, target: 1, unit: "day", source: "habits" }),
      status: clean ? "complete" : "none",
    });
  }
  return out;
}

// ── The feed ─────────────────────────────────────────────────────────
/**
 * Everything, sorted, de-duplicated by id. Ids are derived from what the
 * activity IS rather than from when it was collected, so re-running this
 * never produces a second copy of the same day's protein — which is the
 * whole defence against the duplicate records the brief is worried about.
 */
export function buildActivityFeed(deps = {}) {
  const all = [
    ...habitActivities(deps),
    ...workoutActivities(deps),
    ...nutritionActivities(deps),
    ...sleepActivities(deps),
    ...faithActivities(deps),
    ...disciplineActivities(deps),
  ];
  const byId = new Map();
  for (const a of all) if (a && a.date && !byId.has(a.id)) byId.set(a.id, a);
  return [...byId.values()].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : x.type.localeCompare(y.type)));
}

/** The feed grouped by day — what the Calendar renders from. */
export function activityByDay(feed) {
  const out = {};
  for (const a of arr(feed)) (out[a.date] ||= []).push(a);
  return out;
}

/** One day's activities. */
export const activitiesOn = (feed, date) => arr(feed).filter((a) => a.date === date);

/** A window ending today, oldest first. */
export function windowOf(feed, days = 30, today = localDateStr()) {
  const start = new Date(`${today}T12:00:00`);
  start.setDate(start.getDate() - (days - 1));
  const from = localDateStr(start);
  return arr(feed).filter((a) => a.date >= from && a.date <= today);
}

/**
 * A type's record over a window: how often it was logged, how often it was
 * met, and the average of what was actually recorded. Days with no row are
 * counted as unlogged rather than as misses — an unrecorded day is an
 * unknown, and grading it as a failure is how a report starts lying about
 * the weeks somebody was busy.
 */
export function summarise(feed, type, days = 30, today = localDateStr()) {
  const rows = windowOf(feed, days, today).filter((a) => a.type === type);
  const logged = rows.length;
  const met = rows.filter(isDone).length;
  const measured = rows.filter((a) => a.actual != null && a.target != null && a.pct != null);
  return {
    type, days, logged, met,
    unlogged: days - logged,
    consistency: logged ? Math.round((met / logged) * 100) : null,
    coverage: Math.round((logged / days) * 100),
    avgPct: measured.length ? Math.round(measured.reduce((s, a) => s + a.pct, 0) / measured.length) : null,
    partial: rows.filter((a) => a.status === "partial").length,
  };
}

/** Every type present in the feed, so callers need no hardcoded list. */
export const typesIn = (feed) => [...new Set(arr(feed).map((a) => a.type))].sort();
