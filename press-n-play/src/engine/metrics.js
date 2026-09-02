// ── Per-trade R metrics ──────────────────────────────────────────────
// Everything the 34 charts read off a single trade, as pure functions.
//
// Nothing here is stored. A stored copy of a derived number drifts the
// moment the trade behind it is edited, and a journal whose stats quietly
// disagree with its own trades is worse than one with no stats.
//
// Most of the core already exists in tradingIntel.js and is reused rather
// than reimplemented — importantly `actualRR`, which IS Net R, and
// `tradeResult`, whose breakeven band (|net| < 0.05 × risk) is exactly the
// ±0.05 R tolerance the Notion spec specifies. Two implementations of that
// rule would eventually disagree.
import {
  actualRR, tradeResult, riskAmount, stopDistance, holdMinutes, netPnl,
} from "./trade.js";
import { RULE_CHECKLIST } from "./constants.js";

const n = (v) => (Number.isFinite(+v) ? +v : 0);
const has = (v) => v !== "" && v != null && Number.isFinite(+v);

/** A trade is only counted once it has actually closed at a price. */
export const isClosed = (t) => t.status === "CLOSED" && t.exit !== "" && t.exit != null;

/** Closed trades only, newest-last. The base every stat starts from. */
export const closedTrades = (trades, accountId = "") =>
  (Array.isArray(trades) ? trades : [])
    .filter(isClosed)
    .filter((t) => !accountId || t.accountId === accountId)
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.time || "").localeCompare(b.time || "") : a.date.localeCompare(b.date)));

// ── Outcome ──────────────────────────────────────────────────────────
/** Net R — profit in units of the risk taken. The spine of everything. */
export const netR = (t) => actualRR(t);

/** "Win" | "Loss" | "BE" | null. */
export const outcome = (t) => tradeResult(t);

export const isWin = (t) => (outcome(t) === "Win" ? 1 : 0);
export const isLoss = (t) => (outcome(t) === "Loss" ? 1 : 0);
export const isBreakeven = (t) => (outcome(t) === "BE" ? 1 : 0);

// ── Profit factor components ─────────────────────────────────────────
export const grossWinR = (t) => Math.max(0, netR(t));
export const grossLossR = (t) => Math.max(0, -netR(t));

/**
 * Winner / loser R return **null**, not 0, for the trades they exclude.
 *
 * Notion needs this because its filters cannot target a formula column, so
 * a blank is the only way to keep losers out of an average of winners. We
 * have no such limit — but the shape is kept because it is also simply
 * correct: averaging a winner's R across a set padded with zeros answers a
 * question nobody asked.
 */
export const winnerR = (t) => (isWin(t) ? netR(t) : null);
export const loserR = (t) => (isLoss(t) ? netR(t) : null);

// ── Excursion ────────────────────────────────────────────────────────
/**
 * MFE / MAE arrive as prices, because that is what a chart shows you.
 * Converting to R needs the trade's own stop distance, so a 20-pip run on
 * a 10-pip stop is 2R and the same run on a 40-pip stop is 0.5R.
 */
const excursionR = (t, price, favourable) => {
  const sd = stopDistance(t);
  if (!has(price) || sd <= 0) return null;
  const dir = t.direction === "Buy" ? 1 : -1;
  const move = (n(price) - n(t.entry)) * dir;
  const r = move / sd;
  // MAE is quoted as a positive number of R of heat taken.
  return +(favourable ? r : -r).toFixed(2);
};

/** How far it ran in your favour, in R. Null when not recorded. */
export const mfeR = (t) => excursionR(t, t.mfePrice, true);
/** How far it went against you before working, in R. Positive = heat. */
export const maeR = (t) => excursionR(t, t.maePrice, false);

/** R the trade offered that you did not keep. */
export const mfeGapR = (t) => {
  const m = mfeR(t);
  return m == null ? null : +(m - netR(t)).toFixed(2);
};

/**
 * Missed R is the gap, floored at zero.
 *
 * A trade that closed above its own recorded MFE means the MFE was logged
 * wrong, not that you "missed" negative R. Clamping keeps a data-entry
 * slip from flattering the average.
 */
export const missedR = (t) => {
  const g = mfeGapR(t);
  return g == null ? null : Math.max(0, g);
};

// ── Wick-outs ────────────────────────────────────────────────────────
export const wickOutFlag = (t) => (t.wickedOut === "Yes" ? 1 : 0);

/**
 * Stopped out, and then price reached where you were going anyway.
 * A high recovery rate is direct evidence the stops are too tight — the
 * idea was right and the placement was not.
 */
export const wickRecoveryFlag = (t) =>
  t.wickedOut === "Yes" && (t.reachedTp1AfterSl === "Yes" || t.reachedOriginalTpAfterSl === "Yes") ? 1 : 0;

// ── Grouping keys ────────────────────────────────────────────────────
export const executionBand = (t) => {
  const r = t.executionRating;
  if (!has(r) || +r <= 0) return "Unrated";
  if (+r >= 8) return "High (8-10)";
  if (+r >= 5) return "Mid (5-7)";
  return "Low (1-4)";
};

/** Ticked process rules ÷ 13, as a percentage. Null when never rated. */
export const ruleAdherencePct = (t) => {
  const ticked = Array.isArray(t.ruleChecklist) ? t.ruleChecklist.length : 0;
  if (!Array.isArray(t.ruleChecklist)) return null;
  return Math.round((ticked / RULE_CHECKLIST.length) * 100);
};

export const ruleAdherenceBand = (t) => {
  const p = ruleAdherencePct(t);
  if (p == null) return "Unrated";
  if (p >= 100) return "Full (100%)";
  if (p >= 80) return "High (80-99%)";
  return "Broken (<80%)";
};

export const newsVsNoNews = (t) => (t.highImpactNews === "Yes" ? "News" : "No News");

// ── Passthroughs, so charts read one module ──────────────────────────
export { riskAmount, holdMinutes, netPnl, stopDistance };

/**
 * Every derived value for one trade, in one object.
 *
 * Charts group and aggregate over field *names*, so they need a flat row
 * rather than a function per metric. Computed once per trade per render
 * and memoised upstream.
 */
export function metricsOf(t) {
  return {
    ...t,
    netR: netR(t),
    outcome: outcome(t),
    isWin: isWin(t), isLoss: isLoss(t), isBreakeven: isBreakeven(t),
    winRatePct: isWin(t) * 100,
    grossWinR: grossWinR(t), grossLossR: grossLossR(t),
    winnerR: winnerR(t), loserR: loserR(t),
    mfeR: mfeR(t), maeR: maeR(t), mfeGapR: mfeGapR(t), missedR: missedR(t),
    wickOutFlag: wickOutFlag(t), wickOutPct: wickOutFlag(t) * 100,
    wickRecoveryFlag: wickRecoveryFlag(t), wickRecoveryPct: wickRecoveryFlag(t) * 100,
    executionBand: executionBand(t),
    ruleAdherencePct: ruleAdherencePct(t),
    ruleAdherenceBand: ruleAdherenceBand(t),
    newsVsNoNews: newsVsNoNews(t),
    holdMinutes: holdMinutes(t),
    riskAmount: riskAmount(t),
    netPnl: netPnl(t),
  };
}
