// ── Purity & Self-Control engine ─────────────────────────────────────
// A dated log of confirmed days: { "YYYY-MM-DD": { s: "pure"|"relapse",
// triggers: [..], helped, trigger, improve } }. Streak rules:
//   · only confirmed consecutive pure days count backwards from today
//   · an unlogged *today* is pending — it never breaks the streak
//   · a relapse resets the current streak to 0, calmly and without shame:
//     day 0 is where every streak starts.
import { localDateStr, daysAgoStr, daysBetween } from "../../shared/dates.js";

export const MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

export const TRIGGERS = [
  "Stress", "Boredom", "Loneliness", "Late-night phone", "Fatigue",
  "Social media", "Idle time", "Conflict", "Other",
];

// Shown after a successful check-in — rotated by date so it feels alive.
const QUOTES = [
  "Discipline is choosing what you want most over what you want now.",
  "You are not fighting yourself — you are training yourself.",
  "Every clean day is a vote for the person you're becoming.",
  "Self-control is strength under command, not suppression.",
  "The man who conquers himself is greater than one who conquers a city.",
  "Freedom isn't doing what you want. It's wanting what is good.",
  "One day at a time is how every long streak was ever built.",
  "Purity of heart is to will one thing.",
  "Your future self is watching today with gratitude.",
  "Strong desires make a weak master but an excellent servant.",
  "You don't need more willpower — you need fewer negotiations.",
  "Guard the first minute and the whole day follows.",
];
export const quoteForDay = (ds = localDateStr()) => {
  let h = 0;
  for (let i = 0; i < ds.length; i++) h = (h * 31 + ds.charCodeAt(i)) >>> 0;
  return QUOTES[h % QUOTES.length];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function sanitizePurity(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!DATE_RE.test(k) || !v || typeof v !== "object") continue;
    if (v.s !== "pure" && v.s !== "relapse") continue;
    out[k] = { ...v, triggers: Array.isArray(v.triggers) ? v.triggers.filter((t) => typeof t === "string") : [] };
  }
  return out;
}

export const statusOn = (log, ds) => log[ds]?.s || null;

export function setDay(log, ds, status) {
  const next = { ...log };
  if (status === null) delete next[ds];
  else next[ds] = { ...(next[ds] || { triggers: [] }), s: status };
  return next;
}

export function patchDay(log, ds, patch) {
  if (!log[ds]) return log;
  return { ...log, [ds]: { ...log[ds], ...patch } };
}

// Current streak: confirmed pure days ending today (or yesterday when today
// is still pending). Any relapse or unlogged past day ends the count.
export function currentStreak(log, today = localDateStr()) {
  let i = statusOn(log, today) ? 0 : 1; // pending today doesn't break
  if (statusOn(log, today) === "relapse") return 0;
  let streak = 0;
  for (; i < 4000; i++) {
    const s = statusOn(log, daysAgoStr(i));
    if (s === "pure") streak++;
    else break;
  }
  return streak;
}

export function longestStreak(log) {
  const dates = Object.keys(log).filter((d) => log[d].s === "pure").sort();
  if (!dates.length) return 0;
  let best = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    const gap = daysBetween(dates[i - 1], dates[i]);
    // a relapse between two pure days always shows as a logged red day, so a
    // 1-day gap of anything other than contiguity breaks the run
    run = gap === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export function purityStats(logRaw, today = localDateStr()) {
  const log = logRaw;
  const entries = Object.entries(log);
  const totalPure = entries.filter(([, v]) => v.s === "pure").length;
  const pctOver = (days) => {
    const since = daysAgoStr(days - 1);
    let pure = 0, logged = 0;
    for (const [d, v] of entries) {
      if (d < since || d > today) continue;
      logged++;
      if (v.s === "pure") pure++;
    }
    return logged ? Math.round((pure / logged) * 100) : null;
  };
  return {
    current: currentStreak(log, today),
    longest: longestStreak(log),
    totalPure,
    pct30: pctOver(30),
    pct90: pctOver(90),
    pct365: pctOver(365),
  };
}

// Relapse pattern analysis — insights, never accusations.
export function relapseInsights(log, today = localDateStr()) {
  const relapses = Object.entries(log).filter(([, v]) => v.s === "relapse");
  const since30 = daysAgoStr(29);
  const last30 = relapses.filter(([d]) => d >= since30 && d <= today).length;
  const byTrigger = {};
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const [d, v] of relapses) {
    for (const t of v.triggers || []) byTrigger[t] = (byTrigger[t] || 0) + 1;
    byWeekday[new Date(`${d}T12:00:00`).getDay()]++;
  }
  const topTrigger = Object.entries(byTrigger).sort((a, b) => b[1] - a[1])[0] || null;
  const maxWd = Math.max(...byWeekday);
  const topWeekday = maxWd > 0 ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][byWeekday.indexOf(maxWd)] : null;
  return { total: relapses.length, last30, topTrigger, topWeekday, byTrigger };
}

// Weekly consistency for the trend chart: % pure of logged days, per week.
export function weeklyPurity(log, weeks = 12, today = localDateStr()) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    let pure = 0, logged = 0, relapse = 0;
    for (let i = w * 7; i < w * 7 + 7; i++) {
      const s = statusOn(log, daysAgoStr(i));
      if (!s) continue;
      logged++;
      if (s === "pure") pure++;
      else relapse++;
    }
    out.push({ label: w === 0 ? "Now" : `-${w}w`, pct: logged ? Math.round((pure / logged) * 100) : 0, relapses: relapse });
  }
  return out;
}
