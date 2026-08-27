// ── Today-surface trackers (daily checklist, weekly/monthly goals, pings)
// Small, local-first stores that compose onto the Command Center. No
// gamification here — plain state. Pure helpers + sanitizers only.
//
// Only the monthly-overhead half has a live surface (OverheadToday, on Home).
// The checklist, weekly-goal and ping helpers below are deliberately kept
// after their surface was retired: their stores are in ORPHANED_CONTENT_KEYS
// — the user's own words, never purged — and these sanitizers are exactly
// what a future home for that data would need to read it back safely. They
// are the recovery path, not forgotten code, so leave them when sweeping for
// exports with no consumer.
import { localDateStr, daysBetween } from "./dates.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ── A. Daily checklist ───────────────────────────────────────────────
// Items the owner defines (default empty — never invent items). Each item:
// { id, text, core }. Completion is tracked per day, so it resets at
// rollover automatically; history persists for consistency views elsewhere.
export function sanitizeChecklist(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((i) => i && typeof i === "object" && typeof i.text === "string")
    .map((i) => ({ id: typeof i.id === "string" ? i.id : uid("dc"), text: i.text.slice(0, 120), core: !!i.core }));
}
export const newChecklistItem = (text = "", core = false) => ({ id: uid("dc"), text, core });
export function sanitizeChecklistLog(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [d, ids] of Object.entries(raw)) if (DATE_RE.test(d) && Array.isArray(ids)) out[d] = ids.filter((x) => typeof x === "string");
  return out;
}
export const isChecked = (logMap, ds, id) => Array.isArray(logMap?.[ds]) && logMap[ds].includes(id);
export function toggleChecked(logMap, ds, id) {
  const m = logMap && typeof logMap === "object" && !Array.isArray(logMap) ? { ...logMap } : {};
  const day = Array.isArray(m[ds]) ? [...m[ds]] : [];
  const i = day.indexOf(id);
  if (i >= 0) day.splice(i, 1); else day.push(id);
  m[ds] = day;
  return m;
}

// ── B. Weekly goal ───────────────────────────────────────────────────
// ISO-ish week key (Monday-anchored) so "a new week" is well-defined.
export function weekKey(ds = localDateStr()) {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7;            // Mon=0
  const monday = new Date(y, m - 1, d - dow);
  const jan1 = new Date(monday.getFullYear(), 0, 1);
  const wk = Math.floor((monday - jan1) / 604800000) + 1;
  return `${monday.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}
export function sanitizeWeekly(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return { text: typeof p.text === "string" ? p.text : "", week: typeof p.week === "string" ? p.week : "", updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null };
}
export const weeklyNeedsPrompt = (weekly, ds = localDateStr()) => sanitizeWeekly(weekly).week !== weekKey(ds);
export const sanitizeArchive = (raw) => (Array.isArray(raw) ? raw : []).filter((a) => a && typeof a.text === "string" && typeof a.key === "string");

// ── C. Monthly overhead goal ─────────────────────────────────────────
export const monthKey = (ds = localDateStr()) => ds.slice(0, 7);
export function sanitizeOverhead(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return { targetKsh: Number.isFinite(+p.targetKsh) && +p.targetKsh > 0 ? Math.round(+p.targetKsh) : 0, updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null };
}

// ── I. Recurring life pings ──────────────────────────────────────────
// Generic interval reminders — no gates, no locking. Dismissing resets the
// counter from that date.
export const DEFAULT_PINGS = [
  { id: "laundry", name: "Laundry", intervalDays: 14, lastDone: null },
  { id: "haircut", name: "Haircut", intervalDays: 14, lastDone: null },
];
export function sanitizePings(raw) {
  return (Array.isArray(raw) ? raw : DEFAULT_PINGS)
    .filter((p) => p && typeof p === "object" && typeof p.name === "string")
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : uid("pg"),
      name: p.name.slice(0, 40),
      intervalDays: Number.isFinite(+p.intervalDays) && +p.intervalDays >= 1 ? Math.round(+p.intervalDays) : 14,
      lastDone: DATE_RE.test(p.lastDone) ? p.lastDone : null,
    }));
}
export const newPing = (name = "", intervalDays = 14) => ({ id: uid("pg"), name, intervalDays, lastDone: null });
export function pingDue(ping, today = localDateStr()) {
  if (!ping.lastDone) return true;                       // never done → due
  return daysBetween(ping.lastDone, today) >= ping.intervalDays;
}
export const pingDaysUntil = (ping, today = localDateStr()) =>
  ping.lastDone ? ping.intervalDays - daysBetween(ping.lastDone, today) : 0;
