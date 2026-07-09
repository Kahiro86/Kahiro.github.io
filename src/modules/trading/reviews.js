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
    ["daily", "weekly", "monthly"].includes(r.kind) && typeof r.period === "string");

export const newReview = (patch = {}) => ({
  id: `rv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  kind: "daily",       // daily | weekly | monthly
  period: "",          // daily: YYYY-MM-DD · weekly: week-start YYYY-MM-DD · monthly: YYYY-MM
  worked: "",
  fix: "",
  grade: "B",          // self-graded process discipline: A | B | C
  createdAt: localDateStr(),
  ...patch,
});

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return localDateStr(d); };
const prevMonthOf = (today) => {
  const d = new Date(+today.slice(0, 4), +today.slice(5, 7) - 2, 15);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Closed, non-archived trades inside a review period.
export function tradesInPeriod(trades, kind, period) {
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
export function pendingReviews(trades, reviews, today = localDateStr()) {
  const rs = sanitizeReviews(reviews);
  const has = (kind, period) => rs.some((r) => r.kind === kind && r.period === period);
  const out = [];

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
