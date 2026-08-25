// ── Notification engine ──────────────────────────────────────────────
// The scheduling core of the Notification Center. Two synced stores:
//   notif_reminders  [ { id, title, desc, cat, date, time, repeat:{kind,n},
//                        priority, icon, notes, nav, paused, createdAt } ]
//   notif_log        [ { id, remId, occKey, cat, title, icon, priority,
//                        state, firedAt, doneAt, snoozeUntil, esc, pinned } ]
// Everything else derives. Duplicate-proofing across devices comes from the
// occurrence key: one reminder occurrence has exactly one identity
// ("remId@YYYY-MM-DD HH:MM"), the log syncs, and a firing only appends when
// that key isn't already present — so two devices can't both notify.
// Nairobi has no DST, but day-based repeats still use local Date(y,m,d)
// construction rather than millisecond stepping so timezone/DST shifts can
// never drift an occurrence time.
import { localDateStr, daysAgoStr, daysBetween } from "./dates.js";

export const NOTIF_CATS = [
  { id: "habits",       l: "Habits",       icon: "✅" },
  { id: "streaks",      l: "Streaks",      icon: "🔥" },
  { id: "life",         l: "Discipline",   icon: "🌱" },
  { id: "nutrition",    l: "Fuel",         icon: "🍽️" },
  { id: "athlete",      l: "Training",     icon: "💪" },
  { id: "trading",      l: "Trading",      icon: "📊" },
  { id: "finance",      l: "Finance",      icon: "💰" },
  { id: "faith",        l: "Faith",        icon: "📖" },
  { id: "mind",         l: "Mind",         icon: "🧠" },
  { id: "goals",        l: "Goals",        icon: "🎯" },
  { id: "achievements", l: "Achievements", icon: "🏆" },
  { id: "xp",           l: "XP & Levels",  icon: "✦" },
  { id: "system",       l: "System",       icon: "⚙️" },
  { id: "custom",       l: "Custom",       icon: "🔔" },
];
const CAT_IDS = new Set(NOTIF_CATS.map((c) => c.id));

export const PRIORITIES = [
  { id: "critical", l: "Critical", color: "#E5484D" },
  { id: "high",     l: "High",     color: "#E8A33D" },
  { id: "medium",   l: "Medium",   color: "#6BA6DE" },
  { id: "low",      l: "Low",      color: "#8A93A6" },
  { id: "silent",   l: "Silent",   color: "#5A6172" },
];
const PRIORITY_IDS = new Set(PRIORITIES.map((p) => p.id));
export const priorityColor = (id) => (PRIORITIES.find((p) => p.id === id) || PRIORITIES[2]).color;

export const REPEATS = [
  { id: "once",     l: "Once" },
  { id: "hourly",   l: "Hourly" },
  { id: "daily",    l: "Daily" },
  { id: "weekdays", l: "Weekdays" },
  { id: "weekends", l: "Weekends" },
  { id: "weekly",   l: "Weekly" },
  { id: "monthly",  l: "Monthly" },
  { id: "quarterly",l: "Quarterly" },
  { id: "yearly",   l: "Yearly" },
  { id: "nHours",   l: "Every N hours", n: true },
  { id: "nDays",    l: "Every N days",  n: true },
  { id: "nWeeks",   l: "Every N weeks", n: true },
];
const REPEAT_IDS = new Set(REPEATS.map((r) => r.id));

export const SNOOZES = [
  { l: "5 min", min: 5 }, { l: "10 min", min: 10 }, { l: "15 min", min: 15 },
  { l: "30 min", min: 30 }, { l: "1 hour", min: 60 }, { l: "3 hours", min: 180 },
  { l: "Tomorrow", min: null }, // resolved to next 08:00
];

// Modules a reminder can deep-link to ("attach" targets — habit, goal,
// workout, finance task, trading task all live inside their module). Compound
// ids ("firm:wealth") land on a merged module's specific inner group instead
// of always its default — see App.jsx's navTo/navHint.
export const NAV_TARGETS = [
  { id: "", l: "None" }, { id: "habits", l: "Discipline / habit" }, { id: "gym:today", l: "Body / training & fuel" },
  { id: "firm:trading", l: "Trading task" }, { id: "firm:wealth", l: "Finance task" },
  { id: "faith", l: "Faith" }, { id: "analytics:library", l: "Library / Mind" },
  // The Record's goals and Hall of Fame are real routes that nothing could
  // point a reminder at — the goals and achievements categories both answer
  // there, so the editor has to be able to offer them.
  { id: "analytics:goals", l: "Goals / wants" }, { id: "analytics:progress", l: "Progress / Hall of Fame" },
  { id: "dashboard", l: "Command Center" },
];

// Reminders saved before the module merge may still carry a bare legacy id —
// map those forward so they keep deep-linking correctly instead of silently
// landing on the dashboard once the old id is gone from NAV_TARGETS.
const LEGACY_NAV = { trading: "firm:trading", finance: "firm:wealth", athlete: "gym:today",
  mind: "analytics:library", "faith:mind": "analytics:library",
  journey: "analytics:progress", "journey:wants": "analytics:goals",
  life: "habits", "life:athlete": "gym:today", "life:purity": "habits", "life:journal": "habits" };

/**
 * The screen a category answers to. A reminder whose destination was never
 * set falls back to this rather than to nothing: a Fuel reminder that cannot
 * open Fuel is a note, and a note does not deserve to interrupt anyone.
 * Explicit "None" is still respected — nav only defaults when it is empty.
 */
export const NAV_BY_CAT = {
  habits: "habits", streaks: "habits", life: "habits",
  nutrition: "gym:today", athlete: "gym:today",
  trading: "firm:trading", finance: "firm:wealth",
  faith: "faith", mind: "analytics:library",
  goals: "analytics:goals", achievements: "analytics:progress", xp: "analytics:progress",
  system: "dashboard", custom: "dashboard",
};
export const navForCat = (cat) => NAV_BY_CAT[cat] || "dashboard";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export const newReminder = (patch = {}) => ({
  id: `nr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  title: "", desc: "", cat: "custom",
  date: localDateStr(), time: "08:00",
  repeat: { kind: "once", n: 2 },
  priority: "medium", icon: "🔔", notes: "", nav: "",
  paused: false, createdAt: localDateStr(),
  ...patch,
});

export function sanitizeReminders(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((r) => r && typeof r === "object" && typeof r.id === "string" && typeof r.title === "string" && r.title)
    .map((r) => ({
      id: r.id, title: r.title.slice(0, 80), desc: typeof r.desc === "string" ? r.desc : "",
      cat: CAT_IDS.has(r.cat) ? r.cat : "custom",
      date: DATE_RE.test(r.date) ? r.date : localDateStr(),
      time: TIME_RE.test(r.time) ? r.time : "08:00",
      repeat: {
        kind: REPEAT_IDS.has(r.repeat?.kind) ? r.repeat.kind : "once",
        n: Number.isInteger(+r.repeat?.n) && +r.repeat?.n >= 1 && +r.repeat?.n <= 90 ? +r.repeat.n : 2,
      },
      priority: PRIORITY_IDS.has(r.priority) ? r.priority : "medium",
      icon: typeof r.icon === "string" && r.icon ? r.icon.slice(0, 4) : "🔔",
      notes: typeof r.notes === "string" ? r.notes : "",
      nav: typeof r.nav === "string" ? (LEGACY_NAV[r.nav] ?? r.nav) : "",
      paused: !!r.paused,
      createdAt: DATE_RE.test(r.createdAt) ? r.createdAt : localDateStr(),
    }));
}

const LOG_STATES = new Set(["unread", "read", "done", "dismissed", "missed", "snoozed"]);
export function sanitizeNotifLog(raw) {
  const list = (Array.isArray(raw) ? raw : [])
    .filter((e) => e && typeof e === "object" && typeof e.id === "string" && typeof e.title === "string")
    .map((e) => ({
      id: e.id, remId: typeof e.remId === "string" ? e.remId : null,
      occKey: typeof e.occKey === "string" ? e.occKey : null,
      cat: CAT_IDS.has(e.cat) ? e.cat : "system",
      title: e.title.slice(0, 120),
      icon: typeof e.icon === "string" && e.icon ? e.icon.slice(0, 4) : "🔔",
      priority: PRIORITY_IDS.has(e.priority) ? e.priority : "medium",
      state: LOG_STATES.has(e.state) ? e.state : "unread",
      firedAt: Number.isFinite(+e.firedAt) ? +e.firedAt : 0,
      doneAt: Number.isFinite(+e.doneAt) ? +e.doneAt : null,
      snoozeUntil: Number.isFinite(+e.snoozeUntil) ? +e.snoozeUntil : null,
      esc: Number.isInteger(+e.esc) ? Math.min(3, Math.max(0, +e.esc)) : 0,
      pinned: !!e.pinned,
      // Where this notification leads. Reminders have always collected a
      // "Link to" destination and the fired entry has always dropped it, so
      // the one field that makes a notification actionable never survived
      // to the notification.
      nav: typeof e.nav === "string" ? e.nav : "",
    }));
  // Cross-device race can append the same occurrence twice before sync
  // settles — keep the earliest, drop the copy.
  const seen = new Set(); const out = [];
  for (const e of list.sort((a, b) => a.firedAt - b.firedAt)) {
    const k = e.occKey || e.id;
    if (seen.has(k)) continue;
    seen.add(k); out.push(e);
  }
  return out.sort((a, b) => b.firedAt - a.firedAt).slice(0, 400);
}

export const DEFAULT_PREFS = {
  cats: {},            // catId → false disables (absent = enabled)
  browser: false,      // browser Notification API while app is open
  escalation: true,    // re-alert unhandled reminders at 30/60/120 min
  briefing: true, evening: true,
};
export function sanitizePrefs(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const cats = {};
  if (p.cats && typeof p.cats === "object" && !Array.isArray(p.cats)) {
    for (const [k, v] of Object.entries(p.cats)) if (CAT_IDS.has(k) && v === false) cats[k] = false;
  }
  return { cats, browser: !!p.browser, escalation: p.escalation !== false, briefing: p.briefing !== false, evening: p.evening !== false };
}
export const catEnabled = (prefs, cat) => prefs.cats[cat] !== false;

// ── Occurrence math ──────────────────────────────────────────────────
const atTime = (ds, time) => {
  const [y, m, d] = ds.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0); // local constructor: DST-safe
};
const addDaysStr = (ds, n) => {
  const [y, m, d] = ds.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
};

// Most recent scheduled occurrence at or before `now` (Date), or null.
export function lastOccurrence(rem, now = new Date()) {
  const base = atTime(rem.date, rem.time);
  if (now < base) return null;
  const { kind, n } = rem.repeat;
  const today = localDateStr(now);

  if (kind === "once") return base;

  if (kind === "hourly" || kind === "nHours") {
    const step = (kind === "hourly" ? 1 : n) * 3600000;
    return new Date(base.getTime() + Math.floor((now - base) / step) * step);
  }

  const dayStep = kind === "daily" ? 1 : kind === "nDays" ? n : kind === "weekly" ? 7 : kind === "nWeeks" ? 7 * n : null;
  if (dayStep != null) {
    const k = Math.floor(daysBetween(rem.date, today) / dayStep) * dayStep;
    let occ = atTime(addDaysStr(rem.date, k), rem.time);
    if (occ > now) occ = atTime(addDaysStr(rem.date, k - dayStep), rem.time);
    return occ >= base ? occ : null;
  }

  if (kind === "weekdays" || kind === "weekends") {
    const match = (ds) => {
      const wd = atTime(ds, "12:00").getDay();
      return kind === "weekdays" ? wd >= 1 && wd <= 5 : wd === 0 || wd === 6;
    };
    for (let i = 0; i < 8; i++) {
      const ds = addDaysStr(today, -i);
      if (ds < rem.date) break;
      if (!match(ds)) continue;
      const occ = atTime(ds, rem.time);
      if (occ <= now) return occ;
    }
    return null;
  }

  // monthly / quarterly / yearly: same day-of-month, clamped to month length.
  const stepM = kind === "monthly" ? 1 : kind === "quarterly" ? 3 : 12;
  const [by, bm, bd] = rem.date.split("-").map(Number);
  const monthsSince = (now.getFullYear() - by) * 12 + (now.getMonth() + 1 - bm);
  for (let k = Math.floor(monthsSince / stepM) * stepM; k >= 0; k -= stepM) {
    const y = by + Math.floor((bm - 1 + k) / 12);
    const m = (bm - 1 + k) % 12;
    const dim = new Date(y, m + 1, 0).getDate();
    const occ = new Date(y, m, Math.min(bd, dim), ...rem.time.split(":").map(Number));
    if (occ <= now) return occ >= base ? occ : null;
  }
  return null;
}

export const occKeyOf = (rem, occ) => `${rem.id}@${localDateStr(occ)} ${rem.time}`;

// Reminders due to FIRE right now: latest occurrence is within the last 24h
// and no log entry exists for that occurrence yet.
export function dueToFire(reminders, log, prefs, now = new Date()) {
  const logged = new Set(log.map((e) => e.occKey).filter(Boolean));
  const out = [];
  for (const rem of reminders) {
    if (rem.paused || !catEnabled(prefs, rem.cat)) continue;
    const occ = lastOccurrence(rem, now);
    if (!occ || now - occ > 24 * 3600000) continue;
    const key = occKeyOf(rem, occ);
    if (!logged.has(key)) out.push({ rem, occ, occKey: key });
  }
  return out;
}

export const newLogEntry = (rem, occKey, firedAt = Date.now()) => ({
  id: `nl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  remId: rem.id, occKey, cat: rem.cat, title: rem.title, icon: rem.icon,
  priority: rem.priority, state: "unread", firedAt, doneAt: null,
  snoozeUntil: null, esc: 0, pinned: false,
  nav: typeof rem.nav === "string" && rem.nav ? rem.nav : navForCat(rem.cat),
});

// One-off (non-reminder) log entries: achievements, system notices.
export const systemLogEntry = ({ title, cat = "system", icon = "⚙️", priority = "low", occKey = null, nav = "" }) => ({
  id: `nl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  remId: null, occKey, cat, title, icon, priority,
  state: "unread", firedAt: Date.now(), doneAt: null, snoozeUntil: null, esc: 0, pinned: false,
  // A notice with nowhere to go is a notice you can only dismiss. Every
  // system entry names the screen that answers it.
  nav: typeof nav === "string" && nav ? nav : navForCat(cat),
});

// ── Live buckets for the panel ───────────────────────────────────────
// active: needs attention now (unread/read/snooze elapsed, < 24h old)
// overdue: unhandled past 24h — the accountability shelf, never silently lost
export function bucketLog(log, now = Date.now()) {
  const active = [], overdue = [], snoozed = [];
  for (const e of log) {
    if (e.state === "done" || e.state === "dismissed") continue;
    if (e.state === "snoozed" && e.snoozeUntil && e.snoozeUntil > now) { snoozed.push(e); continue; }
    if (now - e.firedAt > 24 * 3600000) overdue.push(e);
    else active.push(e);
  }
  return { active, overdue, snoozed };
}

// Escalation: how many re-alerts an unhandled entry has earned (30/60/120min).
export const escalationDue = (e, now = Date.now()) => {
  if (e.state === "done" || e.state === "dismissed" || (e.snoozeUntil && e.snoozeUntil > now)) return 0;
  const age = now - e.firedAt;
  return age > 120 * 60000 ? 3 : age > 60 * 60000 ? 2 : age > 30 * 60000 ? 1 : 0;
};

// ── Analytics — honesty about how you respond to your own system ─────
export function notifAnalytics(log, days = 30) {
  const since = Date.now() - days * 86400000;
  const entries = log.filter((e) => e.remId && e.firedAt >= since);
  if (!entries.length) return { n: 0 };
  const done = entries.filter((e) => e.state === "done");
  const ignored = entries.filter((e) => e.state === "missed" || e.state === "dismissed" || (e.state !== "done" && Date.now() - e.firedAt > 24 * 3600000));
  const respMins = done.filter((e) => e.doneAt).map((e) => (e.doneAt - e.firedAt) / 60000);
  const byTitle = {};
  for (const e of entries) {
    byTitle[e.title] = byTitle[e.title] || { done: 0, total: 0 };
    byTitle[e.title].total++;
    if (e.state === "done") byTitle[e.title].done++;
  }
  const ranked = Object.entries(byTitle).filter(([, v]) => v.total >= 2)
    .map(([t, v]) => ({ t, pct: Math.round((v.done / v.total) * 100), total: v.total }));
  const byWeekday = [0, 0, 0, 0, 0, 0, 0].map(() => ({ done: 0, total: 0 }));
  for (const e of entries) {
    const wd = new Date(e.firedAt).getDay();
    byWeekday[wd].total++;
    if (e.state === "done") byWeekday[wd].done++;
  }
  const wdPct = byWeekday.map((x, i) => ({ i, pct: x.total ? Math.round((x.done / x.total) * 100) : null, total: x.total })).filter((x) => x.total >= 2);
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return {
    n: entries.length,
    completionPct: Math.round((done.length / entries.length) * 100),
    avgResponseMin: respMins.length ? Math.round(respMins.reduce((s, v) => s + v, 0) / respMins.length) : null,
    mostCompleted: [...ranked].sort((a, b) => b.pct - a.pct)[0] || null,
    mostIgnored: [...ranked].sort((a, b) => a.pct - b.pct)[0] || null,
    bestDay: wdPct.length ? WD[[...wdPct].sort((a, b) => b.pct - a.pct)[0].i] : null,
    worstDay: wdPct.length > 1 ? WD[[...wdPct].sort((a, b) => a.pct - b.pct)[0].i] : null,
  };
}

// Next upcoming occurrence (for the editor's "next fires at" preview).
export function nextOccurrenceLabel(rem, now = new Date()) {
  // walk forward up to 400 days to find the first occurrence after now
  const probe = new Date(now.getTime());
  for (let i = 0; i <= 400; i++) {
    const ds = addDaysStr(localDateStr(now), i);
    const cand = atTime(ds, rem.time);
    if (cand <= now) continue;
    const back = lastOccurrence(rem, new Date(cand.getTime() + 1000));
    if (back && Math.abs(back - cand) < 60000) {
      return cand.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    if (rem.repeat.kind === "hourly" || rem.repeat.kind === "nHours") {
      const last = lastOccurrence(rem, now);
      if (last) {
        const step = (rem.repeat.kind === "hourly" ? 1 : rem.repeat.n) * 3600000;
        return new Date(last.getTime() + step).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" });
      }
    }
  }
  return probe && null;
}

// ── Push queue: upcoming occurrences for the server sender ───────────
// The service-worker push channel can reach a fully-closed app, but only a
// server can fire it. Rather than replicate this whole repeat engine
// server-side, the client precomputes the next few days of occurrences
// whenever it's open and syncs them as `push_queue`; the Edge Function just
// delivers what's due. Pure + deterministic — same result on every device.
export function upcomingOccurrences(rem, now = new Date(), horizonMs = 7 * 86400000) {
  const end = new Date(now.getTime() + horizonMs);
  const { kind, n } = rem.repeat;
  const out = [];

  if (kind === "hourly" || kind === "nHours") {
    const step = (kind === "hourly" ? 1 : n) * 3600000;
    const base = atTime(rem.date, rem.time).getTime();
    let t = base;
    if (t <= now.getTime()) t = base + Math.ceil((now.getTime() - base) / step) * step;
    if (t <= now.getTime()) t += step;
    for (; t <= end.getTime() && out.length < 400; t += step) out.push(new Date(t));
    return out;
  }

  const days = Math.ceil(horizonMs / 86400000) + 1;
  for (let i = 0; i <= days; i++) {
    const ds = addDaysStr(localDateStr(now), i);
    const cand = atTime(ds, rem.time);
    if (cand <= now || cand > end) continue;
    // Validate the candidate against the same repeat rule used everywhere.
    const back = lastOccurrence(rem, new Date(cand.getTime() + 1000));
    if (back && Math.abs(back - cand) < 60000) out.push(cand);
  }
  return out;
}

// Flat, time-sorted list of the next reminders to push: { occKey, at, title,
// body, url }. Honours paused, silent priority and disabled categories.
// The hash is how a cold open carries a destination: index.html is the only
// document, so a path cannot say "the Body facet" but a fragment can, and
// main.jsx reads it on boot.
export const pushUrlFor = (rem) => {
  const nav = typeof rem?.nav === "string" && rem.nav ? rem.nav : navForCat(rem?.cat);
  return nav ? `./#${nav}` : "./";
};

export function buildPushQueue(reminders, prefs, now = new Date(), horizonDays = 7) {
  const p = sanitizePrefs(prefs);
  const out = [];
  for (const rem of sanitizeReminders(reminders)) {
    if (rem.paused || rem.priority === "silent" || !catEnabled(p, rem.cat)) continue;
    for (const occ of upcomingOccurrences(rem, now, horizonDays * 86400000)) {
      out.push({
        occKey: occKeyOf(rem, occ), at: occ.getTime(),
        title: `${rem.icon || "🔔"} ${rem.title}`, body: rem.desc || "Reminder",
        // Where tapping it should land. This was hardcoded to "./", so every
        // push arrived with nowhere to go and the whole point of a reminder
        // reaching a closed phone was lost at the last step.
        url: pushUrlFor(rem),
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 200);
}
