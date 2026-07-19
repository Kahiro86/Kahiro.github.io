// ── The morning directive — the coach layer ─────────────────────────
// The cockpit is a mirror: it reflects every number back. This is the
// coach on top of it. It reads the same signals, ranks them across
// domains, and returns the single most important thing to do right now,
// stated as an order with a reason — plus, when it matters, one secondary
// concern. Two of its signals are cross-domain and live nowhere else:
// trade-checklist discipline over recent trades, and workout pace vs the
// weekly plan. When nothing needs fixing it affirms, it never invents work.
import { localDateStr, daysAgoStr } from "./dates.js";
import { WEEK_PLAN } from "../modules/athlete/constants.js";
import { isNonNeg, isWeekly, isScheduled, isDone, currentStreak } from "./habitEngine.js";
import { pendingReviews, sanitizeReviews } from "../modules/trading/reviews.js";
import { billsDueSoon } from "../modules/finance/bills.js";

// WEEK_PLAN is ordered MON→SUN; JS getDay() is 0=Sun..6=Sat.
const planFor = (ds) => WEEK_PLAN[(new Date(`${ds}T12:00:00`).getDay() + 6) % 7];
export const isRestDay = (ds) => planFor(ds)?.type === "Rest";

// deps: { habits, trades, reviews, bills, workouts, ds?, mission?, scoreDelta? }
export function buildDirective(deps = {}) {
  const ds = deps.ds || localDateStr();
  const arr = (x) => (Array.isArray(x) ? x : []);
  const habits = arr(deps.habits).filter((h) => h && !h.archived && !h.paused);
  const trades = arr(deps.trades).filter((t) => t && !t.archived);
  const workouts = arr(deps.workouts).filter((w) => w && w.date);
  const c = []; // candidate concerns: { score, key, icon, tone, nav, headline, why }

  // 1. Non-negotiables still open — the floor of the day.
  const openNN = habits.filter((h) => isNonNeg(h) && !isWeekly(h) && isScheduled(h, ds) && !isDone(h, ds));
  if (openNN.length) {
    c.push({ score: 90, key: "nonneg", icon: "❤️", tone: "urgent", nav: "life",
      headline: `Lock in your non-negotiables — start with ${openNN[0].name}.`,
      why: `${openNN.length} still open. These are the floor, not the ceiling.` });
  }

  // 2. A long streak scheduled today and not yet done — protect it.
  const atRisk = habits
    .filter((h) => isScheduled(h, ds) && !isDone(h, ds) && currentStreak(h) >= 7)
    .sort((a, b) => currentStreak(b) - currentStreak(a))[0];
  if (atRisk) {
    const st = currentStreak(atRisk);
    c.push({ score: 70 + Math.min(st, 120) / 4, key: "risk", icon: "🔥", tone: "urgent", nav: "life",
      headline: `Protect the ${st}-day ${atRisk.name} streak.`,
      why: "Scheduled today and still unchecked — one rep keeps it alive." });
  }

  // 3. Trade-checklist discipline (cross-domain) — look at the recent window.
  const recent = trades
    .filter((t) => +t.checklistTotal > 0)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 5);
  if (recent.length >= 3) {
    const gaps = recent.filter((t) => (+t.checklistScore || 0) < +t.checklistTotal).length;
    if (gaps >= 2) {
      c.push({ score: 80, key: "discipline", icon: "🎯", tone: "urgent", nav: "firm:trading",
        headline: "Tighten your trade discipline before the next entry.",
        why: `${gaps} of your last ${recent.length} trades skipped the checklist — that's where the edge leaks.` });
    }
  }

  // 4. Trade reviews owed — the loss only teaches once it's written.
  const owed = pendingReviews(trades, sanitizeReviews(deps.reviews));
  if (owed.length) {
    c.push({ score: 68, key: "reviews", icon: "📋", tone: "urgent", nav: "firm:trading",
      headline: `Close your ${owed.length} open trade review${owed.length > 1 ? "s" : ""}.`,
      why: "The edge compounds when you journal the loss, not just take it." });
  }

  // 5. Workout pace vs the weekly plan (cross-domain) — Mon→today. Only once
  //    the workout tracker is actually in use (a session in the last 21 days),
  //    so someone who simply doesn't log workouts is never nagged.
  const tracksWorkouts = workouts.some((w) => w.date && w.date >= daysAgoStr(21));
  if (tracksWorkouts) {
    const monOffset = (new Date(`${ds}T12:00:00`).getDay() + 6) % 7;
    let expected = 0;
    const weekDates = [];
    for (let i = 0; i <= monOffset; i++) {
      const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() - i);
      const key = localDateStr(d);
      weekDates.push(key);
      if (!isRestDay(key)) expected++;
    }
    const doneThisWeek = new Set(workouts.map((w) => w.date).filter((k) => weekDates.includes(k))).size;
    const behind = expected - doneThisWeek;
    if (behind >= 2) {
      c.push({ score: 62 + behind * 4, key: "pace", icon: "🏋️", tone: "info", nav: "life:athlete",
        headline: `You're ${behind} workout${behind > 1 ? "s" : ""} behind this week's plan.`,
        why: "Catch one back today before the gap sets the tone for the week." });
    }
  }

  // 6. Bills due soon.
  const bills = billsDueSoon(deps.bills || []);
  if (bills.length) {
    c.push({ score: 60, key: "bills", icon: "💰", tone: "info", nav: "firm:wealth",
      headline: `Handle ${bills[0].name} before it's late.`,
      why: `${bills.length} bill${bills.length > 1 ? "s" : ""} due within 7 days.` });
  }

  // 7. Month-end: close the month clean to keep the scaling gate alive. Only
  //    in the final days of a month that has closed trades but no monthly
  //    review yet — the strategic bookend to the trade-by-trade reviews.
  const lastDay = new Date(+ds.slice(0, 4), +ds.slice(5, 7), 0).getDate();
  const daysLeft = lastDay - +ds.slice(8, 10);
  if (daysLeft <= 4) {
    const curMonth = ds.slice(0, 7);
    const closedThisMonth = trades.filter((t) => t.status === "CLOSED" && (t.date || "").slice(0, 7) === curMonth).length;
    const reviewedMonth = sanitizeReviews(deps.reviews).some((r) => r.kind === "monthly" && r.period === curMonth);
    if (closedThisMonth > 0 && !reviewedMonth) {
      c.push({ score: 55, key: "monthclose", icon: "🏛️", tone: "info", nav: "firm:doctrine",
        headline: `Close the month clean — ${daysLeft === 0 ? "today's the last day" : `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`}.`,
        why: "A withdrawal and a breach-free monthly review keep your scaling gate alive." });
    }
  }

  // Rank. If nothing needs fixing, affirm honestly from where the day stands.
  c.sort((a, b) => b.score - a.score);
  const mission = deps.mission;
  if (!c.length) {
    if (mission && mission.total > 0 && mission.pct === 100) {
      return { key: "clear", icon: "✅", tone: "good", nav: "life",
        headline: "Everything's done. Hold the standard.",
        why: "Nothing is owed today — rest is part of the work.", suppress: [] };
    }
    if (deps.scoreDelta > 0) {
      return { key: "ahead", icon: "📈", tone: "good", nav: "analytics",
        headline: "You're ahead of yesterday — keep the pace.",
        why: "No fires to fight. Do the next rep before the momentum cools.", suppress: [] };
    }
    return { key: "start", icon: "🎯", tone: "good", nav: "life",
      headline: "No alarms today — pick your hardest task and start there.",
      why: "Momentum is built on the thing you'd rather avoid.", suppress: [] };
  }

  const top = c[0];
  const second = c.find((x) => x !== top && x.score >= 58);
  const map = { nonneg: "nonneg", risk: "risk_", reviews: "reviews", bills: "bills" };
  return {
    key: top.key, icon: top.icon, tone: top.tone, nav: top.nav,
    headline: top.headline, why: top.why,
    also: second ? second.headline : null,
    suppress: map[top.key] ? [map[top.key]] : [],
  };
}
