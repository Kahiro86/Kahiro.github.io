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

export const newHabitId = () => `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

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
  pillar: null,                // null | "wellness" | "nonneg" — surfaces specially in Life OS
  notes: "",
  paused: false,
  archived: false,
  createdAt: localDateStr(),
  log: {},
  ...patch,
});

// ── Preset packs (opt-in — never auto-injected) ─────────────────────
export const NONNEG_PRESETS = [
  { name: "Prayer", icon: "🙏", color: PU, category: "Spiritual" },
  { name: "Journaling", icon: "📝", color: CY, category: "Personal Growth" },
  { name: "Clean my space", icon: "🧹", color: GR, category: "Productivity" },
  { name: "Exercise", icon: "💪", color: RE, category: "Fitness" },
  { name: "Healthy eating", icon: "🥗", color: AM, category: "Nutrition" },
];
export const WELLNESS_PRESETS = [
  { name: "Sleep", icon: "🛏️", color: PU, category: "Health", target: 8, unit: "h", wellnessMin: 7.5 },
  { name: "Hydration", icon: "💧", color: CY, category: "Health", target: 2, unit: "L" },
  { name: "Prayer & Bible study", icon: "📖", color: GR, category: "Spiritual", target: 15, unit: "min", wellnessMin: 15 },
];
export const makeNonNeg = () => NONNEG_PRESETS.map((p) => newHabit({ ...p, pillar: "nonneg" }));
export const makeWellness = () => WELLNESS_PRESETS.map((p) => newHabit({ ...p, pillar: "wellness" }));

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
  return { scheduled, done, skipped, pct: scheduled ? Math.round((done / scheduled) * 100) : 0 };
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
  return { done, target, pct: Math.min(100, Math.round((done / target) * 100)), met: done >= target };
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

// ── Gamification: XP earned only from real completions ──────────────
export function xpOf(habits) {
  habits = Array.isArray(habits) ? habits : [];
  const completions = habits.reduce((s, h) => s + totalCompletions(h), 0);
  const perfect = perfectDays(habits).length;
  const streakBonus = habits.reduce((s, h) => s + Math.min(currentStreak(h), 100), 0);
  return completions * 10 + perfect * 25 + streakBonus * 2;
}
export const levelOf = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const xpForLevel = (lvl) => (lvl - 1) * (lvl - 1) * 50;

export function badges(habits, lvl = null) {
  habits = Array.isArray(habits) ? habits : [];
  const completions = habits.reduce((s, h) => s + totalCompletions(h), 0);
  const bestStreak = habits.reduce((m, h) => Math.max(m, longestStreak(h)), 0);
  const perfect = perfectDays(habits).length;
  if (lvl == null) lvl = levelOf(xpOf(habits));
  return [
    { icon: "🌱", name: "First Rep",     desc: "Complete 1 habit",        got: completions >= 1 },
    { icon: "🔥", name: "Kaizen Week",   desc: "7-day streak",            got: bestStreak >= 7 },
    { icon: "⚙️", name: "Iron Month",    desc: "30-day streak",           got: bestStreak >= 30 },
    { icon: "💯", name: "Century Club",  desc: "100 completions",         got: completions >= 100 },
    { icon: "⭐", name: "Perfect Day",   desc: "All habits in one day",   got: perfect >= 1 },
    { icon: "🌟", name: "Perfect Week",  desc: "7 perfect days",          got: perfect >= 7 },
    { icon: "🚀", name: "Level 5",       desc: "Reach level 5",           got: lvl >= 5 },
    { icon: "👑", name: "Level 10",      desc: "Reach level 10",          got: lvl >= 10 },
  ];
}

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
  return { done, total: members.length, pct: Math.round((done / members.length) * 100) };
};
