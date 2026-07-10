// ── Discipline Engine (Kaizen phase 12) ─────────────────────────────
// One 0–100 score for "did I keep my own standards", computed from real
// records across every OS. Consistency-weighted: each domain contributes
// its completion *ratio* over the window, so one missed day dents the
// score slightly — it never zeroes it. Domains with no data are excluded
// (a new user isn't punished for modules they haven't started).
import { isScheduled, isDone, isNonNeg } from "./habitEngine.js";
import { daysAgoStr, localDateStr } from "./dates.js";

const ratioOverWindow = (habits, daysBack) => {
  let sched = 0, done = 0;
  for (let i = 0; i < daysBack; i++) {
    const ds = daysAgoStr(i);
    for (const h of habits) {
      if (!isScheduled(h, ds)) continue;
      sched++;
      if (isDone(h, ds)) done++;
    }
  }
  return sched ? done / sched : null;
};

// deps: { habits (v2, active), trades, workouts, entries, weekPlanDays }
// weekPlanDays = planned training days per week (non-rest days).
function disciplineBreakdown(deps, daysBack = 30) {
  const habits = (deps.habits || []).filter((h) => h && !h.archived && !h.paused);
  const trades = Array.isArray(deps.trades) ? deps.trades : [];
  const workouts = Array.isArray(deps.workouts) ? deps.workouts : [];
  const entries = Array.isArray(deps.entries) ? deps.entries : [];
  const since = daysAgoStr(daysBack - 1);
  const domains = [];

  const nonNegs = habits.filter(isNonNeg);
  const others = habits.filter((h) => !isNonNeg(h));
  const rNon = ratioOverWindow(nonNegs, daysBack);
  if (rNon !== null) domains.push({ key: "nonneg", label: "Non-Negotiables", ratio: rNon });
  const rHab = ratioOverWindow(others, daysBack);
  if (rHab !== null) domains.push({ key: "habits", label: "Habits", ratio: rHab });

  // Journaling: days with at least one entry vs a humane 5-days-a-week target.
  const jDays = new Set(entries.map((e) => (e?.date || "").slice(0, 10)).filter((d) => d >= since)).size;
  if (entries.length) domains.push({ key: "journal", label: "Journaling", ratio: Math.min(1, jDays / (daysBack * (5 / 7))) });

  // Training: sessions logged vs the weekly plan.
  const planned = Math.max(1, Math.round(daysBack / 7) * (deps.weekPlanDays ?? 5));
  const wCount = workouts.filter((w) => w?.date >= since).length;
  if (workouts.length) domains.push({ key: "training", label: "Training", ratio: Math.min(1, wCount / planned) });

  // Trading discipline: mean checklist adherence on closed trades in window
  // (how often the process was followed — independent of P&L).
  const cl = trades.filter((t) => t && t.status === "CLOSED" && !t.archived && t.date >= since && +t.checklistTotal > 0);
  if (cl.length) {
    const adherence = cl.reduce((s, t) => s + Math.min(1, (+t.checklistScore || 0) / +t.checklistTotal), 0) / cl.length;
    domains.push({ key: "trading", label: "Trading process", ratio: adherence });
  }

  return domains;
}

export function disciplineScore(deps, daysBack = 30) {
  const domains = disciplineBreakdown(deps, daysBack);
  if (!domains.length) return { score: 0, domains, empty: true };
  const score = Math.round((domains.reduce((s, d) => s + d.ratio, 0) / domains.length) * 100);
  return { score, domains, empty: false };
}

// Weekly series for the progression chart: score per trailing 7-day window,
// oldest → newest. Uses habit logs only for cheap history (trades/workouts
// join the live score; habits are the daily spine).
export function disciplineSeries(deps, weeks = 12) {
  const habits = (deps.habits || []).filter((h) => h && !h.archived && !h.paused);
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    let sched = 0, done = 0;
    for (let i = w * 7; i < w * 7 + 7; i++) {
      const ds = daysAgoStr(i);
      for (const h of habits) {
        if (!isScheduled(h, ds)) continue;
        sched++;
        if (isDone(h, ds)) done++;
      }
    }
    out.push({
      label: w === 0 ? "Now" : `-${w}w`,
      score: sched ? Math.round((done / sched) * 100) : 0,
    });
  }
  return out;
}

export const todayStr = () => localDateStr();
