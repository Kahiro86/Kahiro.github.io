// ── Focus sessions — deep-work timer log ─────────────────────────────
// Each completed block is one record: how long, on what, when. Pure and
// corruption-tolerant so the stats never throw on a mangled store.
import { localDateStr, daysAgoStr } from "./dates.js";

export const FOCUS_KEY = "focus_sessions";
export const PRESETS = [25, 50, 90]; // minutes

const uid = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const clampMin = (v) => Math.min(600, Math.round(+v || 0)); // may be < 1 → caller drops it

export function sanitizeSessions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s === "object" && clampMin(s.minutes) >= 1)
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : uid(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : localDateStr(),
      minutes: clampMin(s.minutes),
      label: typeof s.label === "string" ? s.label.trim().slice(0, 80) : "",
      at: typeof s.at === "string" ? s.at : "",
    }));
}

export function addSession(list, { minutes, label }) {
  const m = clampMin(minutes);
  if (m < 1) return sanitizeSessions(list); // nothing to log
  const s = { id: uid(), date: localDateStr(), minutes: m, label: (label || "").trim().slice(0, 80), at: new Date().toISOString() };
  return [s, ...sanitizeSessions(list)];
}

export const dayMinutes = (list, ds = localDateStr()) =>
  sanitizeSessions(list).filter((s) => s.date === ds).reduce((a, s) => a + s.minutes, 0);

export const totalMinutes = (list) => sanitizeSessions(list).reduce((a, s) => a + s.minutes, 0);

// Rolling 7-day deep-work minutes (today back 6 days).
export function last7Minutes(list) {
  const clean = sanitizeSessions(list);
  let sum = 0;
  for (let i = 0; i < 7; i++) { const d = daysAgoStr(i); sum += clean.filter((s) => s.date === d).reduce((a, s) => a + s.minutes, 0); }
  return sum;
}

export const sessionCount = (list, ds = localDateStr()) => sanitizeSessions(list).filter((s) => s.date === ds).length;
