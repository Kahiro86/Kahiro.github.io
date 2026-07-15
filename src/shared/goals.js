// ── Universal goals engine ───────────────────────────────────────────
// One goal system for every area of life — not just finance. A goal is a
// number moving toward a target: books read, kgs lifted, KES saved, days
// prayed. Checkpoints (25/50/75%) and completion are auto-stamped with the
// date they were first crossed, achievements-style: stamps are written
// once and never removed, so the XP engine can derive rewards
// idempotently from them (same guarantee as xp_achievements).
import { localDateStr, daysBetween } from "./dates.js";

export const GOAL_AREAS = [
  { id: "fitness",  label: "Fitness",      icon: "💪", color: "#6C8EB5" },
  { id: "health",   label: "Health",       icon: "❤️", color: "#C96A6A" },
  { id: "trading",  label: "Trading",      icon: "📈", color: "#5E8A9C" },
  { id: "finance",  label: "Finance",      icon: "💰", color: "#6F8F7F" },
  { id: "learning", label: "Learning",     icon: "🎓", color: "#767FA6" },
  { id: "career",   label: "Career",       icon: "💼", color: "#8E96A3" },
  { id: "faith",    label: "Spiritual",    icon: "⛪", color: "#B09A6F" },
  { id: "habit",    label: "Habit",        icon: "🔁", color: "#6E8B74" },
  { id: "reading",  label: "Reading",      icon: "📚", color: "#8B7CA0" },
  { id: "social",   label: "Relationship", icon: "🤝", color: "#A5946B" },
  { id: "growth",   label: "Personal",     icon: "🌱", color: "#8FA58E" },
  { id: "custom",   label: "Custom",       icon: "🎯", color: "#9C90AE" },
];
export const areaOf = (id) => GOAL_AREAS.find((a) => a.id === id) || GOAL_AREAS[GOAL_AREAS.length - 1];

// Checkpoint thresholds — each stamps a date the first time it's crossed.
export const CHECKPOINTS = [25, 50, 75];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dOf = (v) => (typeof v === "string" && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
const num = (v, min = 0) => (Number.isFinite(+v) ? Math.max(min, +v) : min);

export function sanitizeGoals(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const g of raw) {
    if (!g || typeof g !== "object" || !g.id || typeof g.name !== "string" || !g.name.trim()) continue;
    const ms = {};
    if (g.ms && typeof g.ms === "object" && !Array.isArray(g.ms)) {
      for (const p of CHECKPOINTS) if (dOf(g.ms[p])) ms[p] = g.ms[p].slice(0, 10);
    }
    out.push({
      id: String(g.id),
      area: GOAL_AREAS.some((a) => a.id === g.area) ? g.area : "custom",
      name: g.name.trim().slice(0, 120),
      unit: typeof g.unit === "string" ? g.unit.trim().slice(0, 24) : "",
      target: num(g.target) || 1,
      current: num(g.current),
      deadline: dOf(g.deadline),
      note: typeof g.note === "string" ? g.note.slice(0, 500) : "",
      ms,
      createdAt: dOf(g.createdAt) || localDateStr(),
      completedAt: dOf(g.completedAt),
      archived: !!g.archived,
    });
  }
  return out;
}

export const newGoal = ({ area = "custom", name, target = 1, unit = "", deadline = null, note = "", current = 0 }) =>
  stamp({
    id: `g${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    area, name: (name || "").trim(), unit, target: num(target) || 1, current: num(current),
    deadline: dOf(deadline), note, ms: {}, createdAt: localDateStr(), completedAt: null, archived: false,
  });

export const goalPct = (g) => (g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0);

// Stamp any newly crossed checkpoints / completion. Stamps are permanent —
// lowering progress later never un-earns them (idempotent XP derivation).
function stamp(g) {
  const pct = goalPct(g);
  const today = localDateStr();
  const ms = { ...g.ms };
  for (const p of CHECKPOINTS) if (pct >= p && !ms[p]) ms[p] = today;
  const completedAt = g.completedAt || (pct >= 100 ? today : null);
  return { ...g, ms, completedAt };
}

export const setGoalProgress = (goals, id, current) =>
  sanitizeGoals(goals).map((g) => (g.id === id ? stamp({ ...g, current: num(current) }) : g));

export const addGoalProgress = (goals, id, delta) =>
  sanitizeGoals(goals).map((g) => (g.id === id ? stamp({ ...g, current: Math.max(0, g.current + (+delta || 0)) }) : g));

export const updateGoal = (goals, id, patch) =>
  sanitizeGoals(goals).map((g) => (g.id === id ? stamp(sanitizeGoals([{ ...g, ...patch, id: g.id }])[0] || g) : g));

// The next checkpoint (or the finish line) still ahead of this goal.
export function nextCheckpoint(g) {
  const pct = goalPct(g);
  for (const p of CHECKPOINTS) if (pct < p) return { pct: p, value: Math.ceil((p / 100) * g.target) };
  return pct < 100 ? { pct: 100, value: g.target } : null;
}

export const goalDaysLeft = (g) => (g.deadline ? daysBetween(localDateStr(), g.deadline) : null);

export function goalsSummary(raw) {
  const goals = sanitizeGoals(raw).filter((g) => !g.archived);
  const active = goals.filter((g) => !g.completedAt);
  const completed = goals.filter((g) => g.completedAt);
  const avgPct = active.length ? Math.round(active.reduce((s, g) => s + goalPct(g), 0) / active.length) : 0;
  // "closest" = the active goal nearest its finish line — today's best lever.
  const closest = [...active].sort((a, b) => goalPct(b) - goalPct(a))[0] || null;
  return { active, completed, avgPct, closest, total: goals.length };
}
