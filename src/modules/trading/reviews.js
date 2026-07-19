// ── Trading review cadence (Kaizen phase 5) ─────────────────────────
// The loop that turns trades into skill: a daily review on any day you
// closed a trade, a weekly review that unlocks every Sunday for the week
// just ended, and a monthly review from the month's last day. A review
// stays pending until written — discipline over speed.
import { localDateStr } from "../../shared/dates.js";
import { weekStartStr } from "../../shared/habitEngine.js";
import { getStats, periodPnl, calcPnl } from "./helpers.js";

export const sanitizeReviews = (raw) =>
  (Array.isArray(raw) ? raw : []).filter((r) =>
    r && typeof r === "object" && r.id &&
    ["daily", "weekly", "monthly", "incident"].includes(r.kind) && typeof r.period === "string");

export const newReview = (patch = {}) => ({
  id: `rv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  kind: "daily",       // daily | weekly | monthly | incident
  period: "",          // daily: YYYY-MM-DD · weekly: week-start · monthly: YYYY-MM · incident: trade date
  worked: "",
  fix: "",
  grade: "B",          // self-graded process discipline: A | B | C
  // Incident-review fields (manual XI.4) — the mandatory write-up after a breach.
  ref: "",             // the breaching trade's id
  enemy: "",           // which named enemy: overtrading | revenge | emotional | moneyfocus | other
  facts: "",           // what happened, facts only
  variance: "",        // "variance" (valid setup that lost) | "drift" (outside the plan)
  repair: "",          // the countermeasure that failed, and its repair
  reentry: "",         // re-entry condition, specific and dated
  createdAt: localDateStr(),
  ...patch,
});

// The four named enemies from the failure ledger (manual III.2 / XI.4).
export const ENEMIES = [
  { id: "overtrading", label: "Overtrading",     desc: "A setup that wasn't there · trading outside the window" },
  { id: "revenge",     label: "Revenge",         desc: "Re-entered to get it back · sized up after a loss" },
  { id: "emotional",   label: "Emotional entry", desc: "A trade you can't name · tired, angry, or euphoric" },
  { id: "moneyfocus",  label: "Money-focus",     desc: "Watching P&L mid-trade · trading the cash, not the setup" },
  { id: "other",       label: "Other",           desc: "A different break — name it in the facts" },
];

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return localDateStr(d); };
const prevMonthOf = (today) => {
  const d = new Date(+today.slice(0, 4), +today.slice(5, 7) - 2, 15);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Closed, non-archived trades inside a review period.
function tradesInPeriod(trades, kind, period) {
  const cl = (Array.isArray(trades) ? trades : []).filter((t) => t && t.status === "CLOSED" && !t.archived && t.date);
  if (kind === "daily") return cl.filter((t) => t.date === period);
  if (kind === "weekly") { const end = addDays(period, 6); return cl.filter((t) => t.date >= period && t.date <= end); }
  return cl.filter((t) => t.date.slice(0, 7) === period);
}

export function periodSummary(trades, kind, period) {
  const list = tradesInPeriod(trades, kind, period);
  const stats = getStats(list);
  const withCl = list.filter((t) => +t.checklistTotal > 0);
  const adherence = withCl.length
    ? Math.round((withCl.reduce((s, t) => s + Math.min(1, (+t.checklistScore || 0) / +t.checklistTotal), 0) / withCl.length) * 100)
    : null;
  return { count: list.length, wr: stats.wr, pnl: list.reduce((s, t) => s + calcPnl(t), 0), adherence };
}

export function periodLabel(kind, period) {
  if (kind === "daily") return new Date(`${period}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (kind === "weekly") return `Week of ${new Date(`${period}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return new Date(+period.slice(0, 4), +period.slice(5, 7) - 1, 15).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// What is owed right now. Nothing can be skipped — a pending review only
// clears when it is written.
// A breach: a closed, non-archived trade that ran with the checklist broken
// (score below total) or skipped entirely — the drift the manual hunts.
export const isBreach = (t) =>
  t && t.status === "CLOSED" && !t.archived &&
  ((+t.checklistTotal > 0 && (+t.checklistScore || 0) < +t.checklistTotal) || t.checklistSkipped === true);

export function pendingReviews(trades, reviews, today = localDateStr()) {
  const rs = sanitizeReviews(reviews);
  const has = (kind, period) => rs.some((r) => r.kind === kind && r.period === period);
  const hasIncident = (tradeId) => rs.some((r) => r.kind === "incident" && r.ref === tradeId);
  const out = [];

  // Incidents first — a breach demands its write-up before anything else. Only
  // recent, unreviewed breaches, newest first, capped so it can't flood.
  const cutoff = (() => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - 30); return localDateStr(d); })();
  const breaches = (Array.isArray(trades) ? trades : [])
    .filter((t) => isBreach(t) && t.id && (t.date || "") >= cutoff && !hasIncident(t.id))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 3);
  for (const t of breaches) {
    out.push({ kind: "incident", period: t.date || today, ref: t.id, label: `${t.instrument || "Trade"} · ${t.outcome || "closed"}` });
  }

  if (tradesInPeriod(trades, "daily", today).length && !has("daily", today)) {
    out.push({ kind: "daily", period: today });
  }

  // Weekly unlocks Sunday: from then, the week that just ended stays owed.
  const prevWeekStart = addDays(weekStartStr(today), -7);
  if (tradesInPeriod(trades, "weekly", prevWeekStart).length && !has("weekly", prevWeekStart)) {
    out.push({ kind: "weekly", period: prevWeekStart });
  }

  // Monthly unlocks on the month's last day; the previous month stays owed.
  const prevMonth = prevMonthOf(today);
  const curMonth = today.slice(0, 7);
  const lastDay = new Date(+today.slice(0, 4), +today.slice(5, 7), 0).getDate();
  if (tradesInPeriod(trades, "monthly", prevMonth).length && !has("monthly", prevMonth)) {
    out.push({ kind: "monthly", period: prevMonth });
  } else if (+today.slice(8, 10) === lastDay && tradesInPeriod(trades, "monthly", curMonth).length && !has("monthly", curMonth)) {
    out.push({ kind: "monthly", period: curMonth });
  }

  return out;
}

// Keep the daily-P&L helper handy for review context lines.
export { periodPnl };
