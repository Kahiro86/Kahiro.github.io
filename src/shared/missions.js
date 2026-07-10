// ── Mission System (Kaizen phase 10) ────────────────────────────────
// One hierarchy: year objectives → quarter goals → month missions →
// week priorities → day actions. Stored flat in the `missions` key;
// parentId links levels, so completing a day action visibly moves the
// bars above it. The answer to "what should I do now?" is nextActions().
import { localDateStr } from "./dates.js";

const MISSION_LEVELS = ["year", "quarter", "month", "week", "day"];
export const newMission = (patch = {}) => ({
  id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
  level: "day",
  title: "",
  parentId: null,
  done: false,
  due: "",                 // YYYY-MM-DD, optional
  createdAt: localDateStr(),
  completedAt: null,
  ...patch,
});

export const sanitizeMissions = (raw) =>
  (Array.isArray(raw) ? raw : []).filter((m) => m && typeof m === "object" && m.id && MISSION_LEVELS.includes(m.level));

export const toggleMission = (missions, id) =>
  missions.map((m) => (m.id === id ? { ...m, done: !m.done, completedAt: m.done ? null : localDateStr() } : m));

// Today's answer to "what should I do now?": open day-level actions that are
// due (or dateless), soonest first, then open week priorities as backup.
export function nextActions(missions, limit = 5) {
  const today = localDateStr();
  const open = missions.filter((m) => !m.done);
  const days = open
    .filter((m) => m.level === "day" && (!m.due || m.due <= today))
    .sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : 1);
  const weeks = open.filter((m) => m.level === "week");
  return [...days, ...weeks].slice(0, limit);
}

// Progress of a mission = its own done flag when it's a leaf, otherwise the
// fraction of completed descendants — so every small action moves the top.
export function rollup(missions, id) {
  const kids = missions.filter((m) => m.parentId === id);
  if (!kids.length) {
    const self = missions.find((m) => m.id === id);
    return { done: self?.done ? 1 : 0, total: 1, pct: self?.done ? 100 : 0 };
  }
  let done = 0, total = 0;
  for (const k of kids) {
    const r = rollup(missions, k.id);
    done += r.done; total += r.total;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

