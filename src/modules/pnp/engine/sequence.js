// ── Sequence statistics ──────────────────────────────────────────────
// Max drawdown, streaks, and the equity curve.
//
// These are the three things the Notion build gives up on. Its own notes
// are blunt about why: "Notion formulas cannot look at neighbouring rows",
// so max drawdown, win streaks and loss streaks are manual number fields
// you read off a broker statement and type in on every weekly and monthly
// review.
//
// They are trivial the moment you can see the sequence. That is the whole
// of this file, and it removes the only manual entry in the system.
import { netR, outcome, closedTrades } from "./metrics.js";

/**
 * Cumulative R over time, with the running peak and the drawdown from it.
 *
 * One pass, so the curve and the drawdown can never disagree — computing
 * them separately is how a dashboard ends up showing a max drawdown that
 * does not appear anywhere on its own chart.
 */
export function equityCurve(trades) {
  const cl = closedTrades(trades);
  let cum = 0;
  let peak = 0;
  return cl.map((t) => {
    cum = +(cum + netR(t)).toFixed(2);
    peak = Math.max(peak, cum);
    return {
      id: t.id,
      date: t.date,
      r: netR(t),
      cumR: cum,
      peak,
      // Negative or zero. Plotted as a band beneath the curve.
      drawdown: +(cum - peak).toFixed(2),
    };
  });
}

/**
 * The deepest peak-to-trough fall on the R curve, as a positive number.
 *
 * Peak-to-trough, not worst-trade: a run of six −0.4R losses is a 2.4R
 * drawdown even though no single trade looks alarming, and that is the
 * number that ends accounts.
 */
export function maxDrawdownR(trades) {
  const curve = equityCurve(trades);
  if (!curve.length) return 0;
  return +Math.abs(Math.min(0, ...curve.map((p) => p.drawdown))).toFixed(2);
}

/** Where the deepest drawdown started and ended — for annotating the chart. */
export function maxDrawdownSpan(trades) {
  const curve = equityCurve(trades);
  if (!curve.length) return null;
  let worst = null;
  for (const p of curve) {
    if (!worst || p.drawdown < worst.drawdown) worst = p;
  }
  if (!worst || worst.drawdown >= 0) return null;
  // Walk back to the peak this fall started from.
  const end = curve.indexOf(worst);
  let start = end;
  while (start > 0 && curve[start - 1].cumR < worst.peak) start--;
  return {
    depth: +Math.abs(worst.drawdown).toFixed(2),
    fromDate: curve[Math.max(0, start - 1)].date,
    toDate: worst.date,
    trades: end - start + 1,
  };
}

/**
 * Longest unbroken run of one outcome.
 *
 * Breakevens neither extend nor break a run — they are not a result, and
 * counting them either way would misreport both streaks. This mirrors how
 * the habit tracker treats an unscheduled day.
 */
export function longestStreak(trades, kind = "loss") {
  const want = kind === "win" ? "Win" : "Loss";
  const other = kind === "win" ? "Loss" : "Win";
  let best = 0;
  let run = 0;
  for (const t of closedTrades(trades)) {
    const o = outcome(t);
    if (o === want) { run++; best = Math.max(best, run); }
    else if (o === other) run = 0;
    // BE: leave the run untouched.
  }
  return best;
}

/**
 * The run in progress right now, signed: +3 = three wins, −2 = two losses.
 *
 * This is what the stand-down gate reads, so it counts backwards from the
 * most recent trade and stops at the first result that breaks the run.
 */
export function currentStreak(trades) {
  const cl = closedTrades(trades);
  let dir = null;
  let run = 0;
  for (let i = cl.length - 1; i >= 0; i--) {
    const o = outcome(cl[i]);
    if (o === "BE") continue;
    if (dir === null) { dir = o; run = 1; continue; }
    if (o !== dir) break;
    run++;
  }
  if (dir === null) return 0;
  return dir === "Win" ? run : -run;
}

/** Everything a review needs, in one pass over the period's trades. */
export function sequenceStats(trades) {
  return {
    maxDrawdownR: maxDrawdownR(trades),
    longestWinStreak: longestStreak(trades, "win"),
    longestLossStreak: longestStreak(trades, "loss"),
    currentStreak: currentStreak(trades),
  };
}
