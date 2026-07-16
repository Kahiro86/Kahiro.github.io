// ── Weekly review — one focus at a time ──────────────────────────────
// The reflective counterpart to the daily briefing and the analytics
// reports: not more numbers, but a single chosen focus for the week. The
// dashboard recaps the week, suggests the weakest area, and lets you set
// one focus — which then persists and reminds you gently until the week
// turns over. Stored as { "YYYY-Www": "focus text" }, keyed by ISO week.
import { rangeStats } from "./habitEngine.js";

// ISO-8601 week key for a local date (e.g. "2026-W29"). Weeks start Monday;
// the year is the one that owns the Thursday of that week.
export function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;          // Sun→7
  d.setUTCDate(d.getUTCDate() + 4 - day);  // to Thursday of this week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const KEY_RE = /^\d{4}-W\d{2}$/;
const DISMISSED = "—"; // sentinel: prompted this week, chose to skip

export function sanitizeFocus(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (KEY_RE.test(k) && typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 60);
  }
  return out;
}

// The current week's focus: a real string, the DISMISSED sentinel, or null.
export function focusThisWeek(raw, date = new Date()) {
  const clean = sanitizeFocus(raw);
  return clean[isoWeekKey(date)] || null;
}
export const isDismissed = (v) => v === DISMISSED;
export const setFocus = (raw, text, date = new Date()) =>
  ({ ...sanitizeFocus(raw), [isoWeekKey(date)]: (text || "").trim().slice(0, 60) || DISMISSED });
export const dismissFocus = (raw, date = new Date()) =>
  ({ ...sanitizeFocus(raw), [isoWeekKey(date)]: DISMISSED });

// The weakest habit category over the last 30 days — the natural focus
// suggestion. Returns { cat, pct } or null when there isn't enough data.
export function weakestArea(habits) {
  const list = (Array.isArray(habits) ? habits : []).filter((h) => h && !h.archived && !h.paused);
  const byCat = {};
  for (const h of list) {
    const s = rangeStats(h, 30);
    if (!s.scheduled) continue;
    const cat = h.category || "Personal Growth";
    byCat[cat] = byCat[cat] || { sched: 0, done: 0 };
    byCat[cat].sched += s.scheduled;
    byCat[cat].done += s.done;
  }
  const ranked = Object.entries(byCat)
    .map(([cat, x]) => ({ cat, pct: Math.round((x.done / x.sched) * 100) }))
    .sort((a, b) => a.pct - b.pct);
  return ranked.length ? ranked[0] : null;
}
