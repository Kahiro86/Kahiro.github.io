// ── Habit intelligence — when are you actually strongest? ────────────
// Pure analysis over a habit's own log: completion rate by weekday across a
// window, plus the best/worst day so scheduling can follow the evidence.
import { daysAgoStr } from "./dates.js";
import { isScheduled, isDone } from "./habitEngine.js";

export const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dowOf = (ds) => { const [y, m, d] = ds.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };

// Per-weekday {scheduled, done, rate%} over the last `windowDays`.
export function weekdayStats(h, windowDays = 56) {
  const sched = Array(7).fill(0), done = Array(7).fill(0);
  for (let i = 0; i < windowDays; i++) {
    const ds = daysAgoStr(i);
    if (!isScheduled(h, ds)) continue;
    const w = dowOf(ds);
    sched[w]++;
    if (isDone(h, ds)) done[w]++;
  }
  return WD.map((name, w) => ({ w, name, scheduled: sched[w], done: done[w], rate: sched[w] ? Math.round((done[w] / sched[w]) * 100) : null }));
}

// Overall completion rate across the window (null if never scheduled).
export function overallRate(h, windowDays = 56) {
  let s = 0, d = 0;
  for (let i = 0; i < windowDays; i++) {
    const ds = daysAgoStr(i);
    if (!isScheduled(h, ds)) continue;
    s++;
    if (isDone(h, ds)) d++;
  }
  return s ? Math.round((d / s) * 100) : null;
}

// Strongest & weakest weekday — only when there's enough signal (≥2 days each
// with ≥2 scheduled occurrences), so a single fluke never drives advice.
export function bestWorst(h, windowDays = 56) {
  const st = weekdayStats(h, windowDays).filter((x) => x.scheduled >= 2 && x.rate != null);
  if (st.length < 2) return null;
  const sorted = [...st].sort((a, b) => b.rate - a.rate);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

// A one-line, evidence-based nudge — or "" when the gap isn't meaningful.
export function suggestion(h, windowDays = 56) {
  const bw = bestWorst(h, windowDays);
  if (!bw || bw.best.rate - bw.worst.rate < 25) return "";
  return `Strongest on ${bw.best.name} (${bw.best.rate}%), weakest on ${bw.worst.name} (${bw.worst.rate}%).`;
}
