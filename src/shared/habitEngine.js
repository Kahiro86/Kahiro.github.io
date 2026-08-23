// ── Habit engine v2 — the heart of Life OS ─────────────────────────
// Habits carry a per-date log: { "YYYY-MM-DD": { v: progress, s: skipped } }.
// Everything else — done-today, streaks, consistency, XP — derives from it.
// Kaizen rules: skipped days never break streaks, an unfinished *today*
// never breaks a streak, and paused habits are simply not scheduled.
import { CY, PU, GR, RE, AM, OR } from "./designTokens.js";
import { localDateStr, daysAgoStr } from "./dates.js";

export const HABIT_COLORS = [GR, CY, PU, AM, OR, RE, "#2DD4BF", "#F472B6"];
export const HABIT_ICONS = ["✨", "☀️", "🌙", "💧", "🏃", "💪", "🥩", "🧊", "📖", "📝", "🧘", "📊", "💰", "🎯", "🛏️", "🙏", "❤️", "🧠", "🚶", "🎓"];
export const DEFAULT_CATEGORIES = [
  "Morning Routine", "Night Routine", "Health", "Fitness", "Nutrition",
  "Trading", "Finance", "Learning", "Productivity", "Spiritual",
  "Relationships", "Business", "Personal Growth",
];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const newHabitId = () => `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const newHabit = (patch = {}) => ({
  id: newHabitId(),
  name: "",
  icon: "✨",
  color: HABIT_COLORS[0],
  category: "Personal Growth",
  freq: "daily",               // "daily" (weekday-scheduled) | "weekly" (N per week)
  days: [0, 1, 2, 3, 4, 5, 6], // scheduled weekdays; all 7 = daily
  weeklyTarget: 3,             // completions per week when freq === "weekly"
  target: 1,                   // completions/quantity per day (1 = simple check)
  unit: "",                    // e.g. "L", "pages", "steps" — for target > 1
  pillar: null,                // null | "wellness" | "nonneg" | "onepct" — surfaces as its own tier in Life OS
  notes: "",
  paused: false,
  archived: false,
  createdAt: localDateStr(),
  log: {},
  ...patch,
});

// ── Preset packs (opt-in — never auto-injected) ─────────────────────
const NONNEG_PRESETS = [
  { name: "Prayer", icon: "🙏", color: PU, category: "Spiritual" },
  { name: "Journaling", icon: "📝", color: CY, category: "Personal Growth" },
  { name: "Clean my space", icon: "🧹", color: GR, category: "Productivity" },
  { name: "Exercise", icon: "💪", color: RE, category: "Fitness" },
  { name: "Healthy eating", icon: "🥗", color: AM, category: "Nutrition" },
];
const WELLNESS_PRESETS = [
  { name: "Sleep", icon: "🛏️", color: PU, category: "Health", target: 8, unit: "h", wellnessMin: 6.5 },
  { name: "Hydration", icon: "💧", color: CY, category: "Health", target: 2, unit: "L" },
  { name: "Prayer & Bible study", icon: "📖", color: GR, category: "Spiritual", target: 15, unit: "min", wellnessMin: 15 },
];
// The 1% tier — habits only the disciplined few actually commit to. Tracked
// quant + qual (a graph each), same as the other elite tiers.
const ONEPCT_PRESETS = [
  { name: "Cold exposure", icon: "🧊", color: CY, category: "Health" },
  { name: "5 AM wake-up", icon: "☀️", color: AM, category: "Morning Routine" },
  { name: "Deep work", icon: "🎯", color: PU, category: "Productivity", target: 90, unit: "min" },
  { name: "Read", icon: "📖", color: GR, category: "Learning", target: 20, unit: "pages" },
];
export const makeNonNeg = () => NONNEG_PRESETS.map((p) => newHabit({ ...p, pillar: "nonneg" }));
export const makeWellness = () => WELLNESS_PRESETS.map((p) => newHabit({ ...p, pillar: "wellness" }));
export const makeOnePct = () => ONEPCT_PRESETS.map((p) => newHabit({ ...p, pillar: "onepct" }));

// ── Migration: v1 habits had { name, icon, history:[dates], done, streak } ──
// Defensive: silently drops null / non-object / nameless entries so one
// corrupt record can never crash the whole app.
export function migrateHabits(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((h) => h && typeof h === "object")
    .map((h, i) => {
    if (h.log && typeof h.log === "object" && h.id) {
      // Already v2 — but normalise fields a stale record may be missing.
      return { ...newHabit(), ...h, log: h.log, days: Array.isArray(h.days) ? h.days : [0, 1, 2, 3, 4, 5, 6] };
    }
    const log = {};
    if (Array.isArray(h.history)) h.history.forEach((d) => { log[d] = { v: 1 }; });
    else if (h.done) log[localDateStr()] = { v: 1 };
    return newHabit({
      // Deterministic id: migration runs on every read until first write, so
      // the same v1 habit must always map to the same v2 id.
      id: h.id || `mig_${i}_${(h.name || "h").toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      name: h.name || "Habit",
      icon: h.icon || "✨",
      color: HABIT_COLORS[i % HABIT_COLORS.length],
      category: h.category || "Personal Growth",
      log,
      createdAt: Object.keys(log).sort()[0] || localDateStr(),
    });
  });
}

// ── Per-day queries ─────────────────────────────────────────────────
const weekdayOf = (ds) => new Date(`${ds}T12:00:00`).getDay();

// Daily scheduling only — weekly habits are handled by weekProgress, so they
// never appear in the daily list or count toward daily perfect-days.
export const isScheduled = (h, ds) =>
  !h.archived && !h.paused && h.freq !== "weekly" && ds >= (h.createdAt || "0") && (h.days || []).includes(weekdayOf(ds));

export const valueOn = (h, ds) => h.log?.[ds]?.v || 0;
export const isSkipped = (h, ds) => !!h.log?.[ds]?.s;
export const isDone = (h, ds) => valueOn(h, ds) >= (h.target || 1);
// "kept" = the day doesn't break a streak.
const isKept = (h, ds) => !isScheduled(h, ds) || isDone(h, ds) || isSkipped(h, ds);

// ── Mutations (pure — return a new habits array) ────────────────────
const patchLog = (habits, id, ds, fn) =>
  habits.map((h) => {
    if (h.id !== id) return h;
    const entry = fn(h.log?.[ds] || {});
    const log = { ...(h.log || {}) };
    if (entry) log[ds] = entry; else delete log[ds];
    return { ...h, log };
  });

// One tap: +1 toward target; tapping a completed habit resets it (undo).
export const tapHabit = (habits, id, ds = localDateStr()) =>
  patchLog(habits, id, ds, (e) => {
    const h = habits.find((x) => x.id === id);
    const target = h?.target || 1;
    const v = e.v || 0;
    if (v >= target) return null;          // undo a completed day
    return { ...e, v: v + 1, s: false };
  });

export const setHabitValue = (habits, id, value, ds = localDateStr()) =>
  patchLog(habits, id, ds, (e) => (value > 0 ? { ...e, v: value, s: false } : null));

export const toggleSkip = (habits, id, ds = localDateStr()) =>
  patchLog(habits, id, ds, (e) => (e.s ? null : { s: true }));

// ── Streaks ─────────────────────────────────────────────────────────
// Bounded to ~2 years: far beyond any real streak, but caps the worst case so
// the many places that call this (dashboard, header, insights) stay cheap.
export function currentStreak(h) {
  let streak = 0;
  for (let i = 0; i < 800; i++) {
    const ds = daysAgoStr(i);
    if (ds < (h.createdAt || "0")) break;
    if (!isScheduled(h, ds)) continue;
    if (isDone(h, ds)) { streak++; continue; }
    if (isSkipped(h, ds)) continue;         // skip preserves, doesn't add
    if (i === 0) continue;                  // today still in progress
    break;
  }
  return streak;
}

export function longestStreak(h) {
  const dates = Object.keys(h.log || {}).sort();
  if (!dates.length) return 0;
  let best = 0, run = 0;
  const start = new Date(`${dates[0]}T12:00:00`);
  const end = new Date(`${localDateStr()}T12:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = localDateStr(d);
    if (!isScheduled(h, ds)) continue;
    if (isDone(h, ds)) { run++; best = Math.max(best, run); }
    else if (!isSkipped(h, ds) && ds !== localDateStr()) run = 0;
  }
  return Math.max(best, run);
}

// ── Stats ───────────────────────────────────────────────────────────
export function rangeStats(h, daysBack) {
  let scheduled = 0, done = 0, skipped = 0;
  for (let i = 0; i < daysBack; i++) {
    const ds = daysAgoStr(i);
    if (ds < (h.createdAt || "0")) break;
    if (!isScheduled(h, ds)) continue;
    scheduled++;
    if (isDone(h, ds)) done++;
    else if (isSkipped(h, ds)) skipped++;
  }
  return { scheduled, done, skipped, pct: scheduled ? Math.floor((done / scheduled) * 100) : 0 };
}

/**
 * Completion rate across an explicit date range, for a set of habits.
 *
 * THE definition of completion rate for the legacy `habits` store. Analytics
 * had its own copy that disagreed with this one in two ways: it counted a
 * streak-safe skipped day as a miss, and it counted days before a habit
 * existed as scheduled-and-missed. Both made a period look worse than it was.
 *
 * Returns null — never 0 — when nothing was scheduled in the range. A period
 * that predates every habit has no rate, and 0% is a different claim.
 */
export function completionRate(habits, start, end) {
  const list = Array.isArray(habits) ? habits.filter(Boolean) : [];
  let scheduled = 0, done = 0, skipped = 0;
  for (const h of list) {
    const created = h.createdAt || "0";
    for (let d = new Date(`${start}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
      const ds = localDateStr(d);
      if (ds > end) break;
      if (ds < created) continue;          // it did not exist; it cannot have been missed
      if (!isScheduled(h, ds)) continue;
      if (isSkipped(h, ds)) { skipped++; continue; }  // streak-safe, not a miss
      scheduled++;
      if (isDone(h, ds)) done++;
    }
  }
  return {
    scheduled, done, skipped,
    pct: scheduled ? Math.floor((done / scheduled) * 100) : null,
  };
}

export const totalCompletions = (h) =>
  Object.entries(h.log || {}).filter(([, e]) => (e?.v || 0) >= (h.target || 1)).length;

// ── Weekly habits ───────────────────────────────────────────────────
const addDaysStr = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return localDateStr(d); };
export const weekStartStr = (ds = localDateStr()) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() - d.getDay()); return localDateStr(d); };
export const isWeekly = (h) => h.freq === "weekly";

// Completions logged within the week beginning `ws` (capped at today).
export function weekProgress(h, ws = weekStartStr()) {
  const today = localDateStr();
  const target = h.weeklyTarget || 1;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDaysStr(ws, i);
    if (day > today) break;
    if ((h.log?.[day]?.v || 0) >= (h.target || 1)) done++;
  }
  return { done, target, pct: Math.min(100, Math.floor((done / target) * 100)), met: done >= target };
}

// Consecutive prior weeks that met their target (this week still in progress
// never breaks it).
export function weeklyStreak(h) {
  let streak = 0;
  for (let w = 0; w < 520; w++) {
    const ws = addDaysStr(weekStartStr(), -7 * w);
    if (ws < weekStartStr(h.createdAt || localDateStr())) break;
    if (weekProgress(h, ws).met) streak++;
    else if (w === 0) continue;
    else break;
  }
  return streak;
}

export const isWellness = (h) => h.pillar === "wellness";
export const isNonNeg = (h) => h.pillar === "nonneg";
export const isOnePct = (h) => h.pillar === "onepct";

// A perfect day: every active habit scheduled that day was completed.
export function perfectDays(habits, daysBack = 365) {
  const act = habits.filter((h) => !h.archived);
  const days = [];
  for (let i = 0; i < daysBack; i++) {
    const ds = daysAgoStr(i);
    const sched = act.filter((h) => isScheduled(h, ds));
    if (sched.length >= 2 && sched.every((h) => isDone(h, ds))) days.push(ds);
  }
  return days;
}

// XP, levels and badges used to live here — a third parallel definition
// alongside xpEngine's and the gym module's. Since Gate 3 exactly one thing
// prices an action and one curve defines a level: src/shared/xp/values.js.
// These had no callers left; they are deleted rather than kept "just in case",
// because a spare XP formula in a habits file is precisely how the three
// disagreeing curves happened in the first place.


// ── Legacy adapter: Dashboard / AI panel / kaizen read this shape ────
export const toLegacy = (habits) =>
  (Array.isArray(habits) ? habits : []).filter((h) => !h.archived && !h.paused).map((h) => ({
    name: h.name, icon: h.icon,
    done: isDone(h, localDateStr()),
    streak: currentStreak(h),
  }));

// ── Routines ────────────────────────────────────────────────────────
export const newRoutine = (patch = {}) => ({
  id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  name: "", icon: "🌅", habitIds: [], ...patch,
});

export const completeRoutine = (habits, routine, ds = localDateStr()) => {
  const ids = Array.isArray(routine?.habitIds) ? routine.habitIds : [];
  return (Array.isArray(habits) ? habits : []).map((h) => {
    if (!ids.includes(h.id) || h.archived) return h;
    const target = h.target || 1;
    if ((h.log?.[ds]?.v || 0) >= target) return h;
    return { ...h, log: { ...(h.log || {}), [ds]: { v: target } } };
  });
};

export const routineProgress = (habits, routine, ds = localDateStr()) => {
  const ids = Array.isArray(routine?.habitIds) ? routine.habitIds : [];
  const members = (Array.isArray(habits) ? habits : []).filter((h) => ids.includes(h.id) && !h.archived);
  if (!members.length) return { done: 0, total: 0, pct: 0 };
  const done = members.filter((h) => isDone(h, ds)).length;
  return { done, total: members.length, pct: Math.floor((done / members.length) * 100) };
};
