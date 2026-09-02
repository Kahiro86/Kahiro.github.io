// ── Period review statistics ─────────────────────────────────────────
// Every number a daily, weekly or monthly review shows, derived from the
// trades whose date falls in the period.
//
// Nothing is stored. Notion stores these as rollups over a hand-maintained
// relation, and its weekly and monthly rollups aggregate only *directly
// linked* trades — never through "Includes Reviews" — so a weekly review
// reads 0 R unless you also link every trade to it individually. The
// behaviour its own documentation describes was never implemented in its
// schema. Deriving from the date removes the bug and the manual linking
// at the same time.
import { metricsOf } from "./metrics.js";
import { sequenceStats } from "./sequence.js";
import {
  tradesInPeriod, aggregate, sampleSizeCheck, sampleLevel, periodLabel, periodKey,
} from "./periods.js";

/**
 * The full statistics block for one period.
 *
 * `null` rather than 0 for profit factor and expectancy when there is
 * nothing to compute from: a review of a day you did not trade should say
 * so, not report an expectancy of zero as though you broke even.
 */
export function reviewStats(trades, kind, period, accountId = "") {
  const inPeriod = tradesInPeriod(trades, kind, period, accountId);
  const rows = inPeriod.map(metricsOf);
  const n = rows.length;

  const grossWin = aggregate(rows, "grossWinR", "sum");
  const grossLoss = aggregate(rows, "grossLossR", "sum");
  const totalR = aggregate(rows, "netR", "sum");
  const wins = rows.reduce((s, r) => s + r.isWin, 0);
  const losses = rows.reduce((s, r) => s + r.isLoss, 0);

  return {
    kind, period, label: periodLabel(kind, period),
    trades: inPeriod,
    tradesTaken: n,
    wins, losses,
    breakeven: rows.reduce((s, r) => s + r.isBreakeven, 0),
    totalR,
    grossWinR: grossWin,
    grossLossR: grossLoss,
    // A ratio, not two tiles to divide by eye.
    // Null, not Infinity, when there are no losses to divide by: a
    // profit factor needs a denominator, and "∞" reads as an edge.
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : null,
    winRatePct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : null,
    expectancyR: n ? +(totalR / n).toFixed(2) : null,
    avgExecution: rows.some((r) => r.executionRating) ? aggregate(rows.filter((r) => r.executionRating), "executionRating", "avg") : null,
    avgRuleAdherence: rows.some((r) => r.ruleAdherencePct != null) ? aggregate(rows, "ruleAdherencePct", "avg") : null,
    avgMfeGapR: rows.some((r) => r.mfeGapR != null) ? aggregate(rows, "mfeGapR", "avg") : null,
    missedR: rows.some((r) => r.missedR != null) ? aggregate(rows, "missedR", "sum") : null,
    wickOuts: rows.reduce((s, r) => s + r.wickOutFlag, 0),
    // The three Notion makes you type in by hand.
    ...sequenceStats(inPeriod),
    best: rows.length ? rows.reduce((a, b) => (b.netR > a.netR ? b : a)) : null,
    worst: rows.length ? rows.reduce((a, b) => (b.netR < a.netR ? b : a)) : null,
    sampleLevel: sampleLevel(n),
    sampleCheck: sampleSizeCheck(n),
  };
}

/**
 * The periods that have trades in them, newest first.
 *
 * A review list built from the trades rather than from existing reviews,
 * so a day you traded and never reviewed still appears — owed, not hidden.
 */
export function periodsWithTrades(trades, kind) {
  const seen = new Set();
  for (const t of trades) if (t.date) seen.add(periodKey(t.date, kind));
  return [...seen].sort().reverse();
}
