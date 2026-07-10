// ── Analytics engine (Kaizen phase 9) ───────────────────────────────
// Every OS feeds one aggregator. Two products:
//   periodReport(deps, days)  — per-OS numbers for the trailing window,
//                               each with a delta vs the window before it.
//   correlations(deps)        — weekly-bucket series + Pearson r for the
//                               relationships worth knowing about.
// Trends over isolated numbers; honest "needs more data" under small n.
import { daysAgoStr, localDateStr } from "./dates.js";
import { isScheduled, isDone, valueOn, isWellness, perfectDays } from "./habitEngine.js";
import { calcPnl } from "../modules/trading/helpers.js";
import { sanitizeNutrition, dayTotals } from "../modules/athlete/nutrition.js";

const inWindow = (ds, start, end) => ds && ds >= start && ds <= end;
const win = (offsetDays, days) => ({ start: daysAgoStr(offsetDays + days - 1), end: daysAgoStr(offsetDays) });

function habitPct(habits, start, end) {
  let sched = 0, done = 0;
  for (let d = new Date(`${start}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
    const ds = localDateStr(d);
    if (ds > end) break;
    for (const h of habits) {
      if (!isScheduled(h, ds)) continue;
      sched++;
      if (isDone(h, ds)) done++;
    }
  }
  return sched ? Math.round((done / sched) * 100) : null;
}

function collect(deps, offsetDays, days) {
  const { start, end } = win(offsetDays, days);
  const habits = (deps.habits || []).filter((h) => h && !h.archived && !h.paused);
  const spiritual = habits.filter((h) => h.category === "Spiritual");
  const cl = (deps.trades || []).filter((t) => t && t.status === "CLOSED" && !t.archived && inWindow(t.date, start, end));
  const withCl = cl.filter((t) => +t.checklistTotal > 0);
  const wo = (deps.workouts || []).filter((w) => w && inWindow(w.date, start, end));
  const j = (deps.entries || []).filter((e) => e && inWindow((e.date || "").slice(0, 10), start, end));
  const inc = (deps.income || []).filter((e) => e && inWindow((e.date || "").slice(0, 10), start, end));
  const church = (deps.church || []).filter((d) => typeof d === "string" && inWindow(d, start, end));
  const finished = (deps.library || []).filter((b) => b && inWindow(b.finishedAt, start, end));
  const decisions = (deps.decisions || []).filter((d) => d && inWindow(d.date, start, end));
  const nlog = sanitizeNutrition(deps.nutrition);
  const nDays = Object.keys(nlog).filter((d) => inWindow(d, start, end));
  const nKcal = nDays.map((d) => dayTotals(nlog[d]).kcal);

  return {
    habitPct: habitPct(habits, start, end),
    perfect: perfectDays(habits, offsetDays + days).filter((d) => inWindow(d, start, end)).length,
    journal: j.length,
    trades: cl.length,
    wr: cl.length ? Math.round((cl.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL").length / cl.length) * 100) : null,
    pnl: cl.reduce((s, t) => s + calcPnl(t), 0),
    adherence: withCl.length ? Math.round((withCl.reduce((s, t) => s + Math.min(1, (+t.checklistScore || 0) / +t.checklistTotal), 0) / withCl.length) * 100) : null,
    sessions: wo.length,
    volume: wo.reduce((s, w) => s + (+w.totalVolume || 0), 0),
    cardioMin: wo.filter((w) => w.type === "cardio").reduce((s, w) => s + (+w.duration || 0), 0),
    income: inc.reduce((s, e) => s + (+e.amount || 0), 0),
    spiritualPct: habitPct(spiritual, start, end),
    church: church.length,
    booksDone: finished.length,
    decisionsLogged: decisions.length,
    nutriDays: nDays.length,
    nutriKcal: nKcal.length ? Math.round(nKcal.reduce((s, v) => s + v, 0) / nKcal.length) : null,
  };
}

export function periodReport(deps, days) {
  const cur = collect(deps, 0, days);
  const prev = collect(deps, days, days);
  return { cur, prev, days };
}

// ── Correlations over weekly buckets (last 10 weeks) ────────────────
export function pearson(pairs) {
  const pts = pairs.filter(([a, b]) => a != null && b != null);
  const n = pts.length;
  if (n < 4) return null;
  const mx = pts.reduce((s, [a]) => s + a, 0) / n;
  const my = pts.reduce((s, [, b]) => s + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (const [a, b] of pts) { num += (a - mx) * (b - my); dx += (a - mx) ** 2; dy += (b - my) ** 2; }
  if (!dx || !dy) return null;
  return +(num / Math.sqrt(dx * dy)).toFixed(2);
}

export const rVerdict = (r) => {
  if (r == null) return "Not enough data yet — keep logging.";
  const dir = r > 0 ? "rise together" : "move in opposite directions";
  if (Math.abs(r) >= 0.5) return `Strong link (r=${r}): these ${dir}.`;
  if (Math.abs(r) >= 0.25) return `Mild link (r=${r}): these tend to ${dir}.`;
  return `No clear link yet (r=${r}).`;
};

export function weeklySeries(deps, weeks = 10) {
  const habits = (deps.habits || []).filter((h) => h && !h.archived && !h.paused);
  const nonSleep = habits.filter((h) => !(isWellness(h) && /sleep/i.test(h.name || "")));
  const sleep = habits.find((h) => isWellness(h) && /sleep/i.test(h.name || ""));
  const spiritual = habits.filter((h) => h.category === "Spiritual");
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const { start, end } = win(w * 7, 7);
    let sleepSum = 0, sleepN = 0;
    if (sleep) {
      for (let d = new Date(`${start}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
        const ds = localDateStr(d);
        if (ds > end) break;
        const v = valueOn(sleep, ds);
        if (v > 0) { sleepSum += v; sleepN++; }
      }
    }
    const wo = (deps.workouts || []).filter((x) => x && inWindow(x.date, start, end));
    const j = (deps.entries || []).filter((e) => e && inWindow((e.date || "").slice(0, 10), start, end));
    out.push({
      label: w === 0 ? "Now" : `-${w}w`,
      habitPct: habitPct(nonSleep, start, end),
      sleepAvg: sleepN ? +(sleepSum / sleepN).toFixed(1) : null,
      sessions: wo.length,
      spiritualPct: habitPct(spiritual, start, end),
      journal: j.length,
    });
  }
  return out;
}

// Checklist adherence vs outcomes: the process-vs-results comparison.
export function checklistVsPnl(trades) {
  const cl = (trades || []).filter((t) => t && t.status === "CLOSED" && !t.archived && +t.checklistTotal > 0);
  const grp = (list) => ({
    n: list.length,
    wr: list.length ? Math.round((list.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL").length / list.length) * 100) : null,
    avgPnl: list.length ? Math.round(list.reduce((s, t) => s + calcPnl(t), 0) / list.length) : null,
  });
  const full = cl.filter((t) => (+t.checklistScore || 0) >= +t.checklistTotal);
  const partial = cl.filter((t) => (+t.checklistScore || 0) < +t.checklistTotal);
  return { full: grp(full), partial: grp(partial), total: cl.length };
}
