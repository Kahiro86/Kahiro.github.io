// ── The 34 charts, as data ───────────────────────────────────────────
// One definition each, not one component each. Thirty-four near-identical
// React files would be thirty-four places to fix the same bug.
//
// `requires` names the trade fields a chart reads. A chart whose fields
// are never populated is *dark*, and says which field it is waiting for —
// it never renders an empty axis, and never plots a zero it invented.
//
// Numbering follows the Notion dashboard so a chart called "26" here is
// the same chart you were reading there.

/** The nine the spec says to read if you only read nine. */
export const STARRED = [7, 8, 9, 15, 18, 22, 26, 30, 34];

export const CHARTS = [
  // ── Core performance ───────────────────────────────────────────────
  { id: 1, group: "core", type: "number", title: "Expectancy", unit: "R",
    agg: "avg", field: "netR",
    caption: "Average R per trade. The number that decides whether the strategy survives." },
  { id: 2, group: "core", type: "number", title: "Total R", unit: "R",
    agg: "sum", field: "netR" },
  { id: 3, group: "core", type: "number", title: "Win rate", unit: "%",
    agg: "avg", field: "winRatePct",
    caption: "Context only. 40% at 3R beats 70% at 0.5R." },
  { id: 4, group: "core", type: "number", title: "Gross win R", unit: "R",
    agg: "sum", field: "grossWinR" },
  { id: 5, group: "core", type: "number", title: "Gross loss R", unit: "R",
    agg: "sum", field: "grossLossR" },
  { id: 6, group: "core", type: "number", title: "Closed trades",
    agg: "count", field: "netR",
    caption: "Read everything above through this." },
  // Notion cannot divide two aggregates in a chart, so its dashboard asks
  // you to eyeball tiles 4 and 5. We can just divide.
  { id: 4.5, group: "core", type: "number", title: "Profit factor",
    agg: "profitFactor", field: "netR",
    caption: "Gross win ÷ gross loss. Below 1.0 you are losing money; above 1.5 is a real edge." },

  // ── Breakdowns ─────────────────────────────────────────────────────
  { id: 7, group: "breakdown", type: "column", title: "Total R by rule adherence",
    groupBy: "ruleAdherenceBand", agg: "sum", field: "netR",
    requires: ["ruleChecklist"],
    caption: "If the losses live in Broken, the problem is not the strategy." },
  { id: 8, group: "breakdown", type: "column", title: "Total R by session phase",
    groupBy: "phaseId", agg: "sum", field: "netR", labelBy: "phase",
    requires: ["phaseId"] },
  { id: 9, group: "breakdown", type: "column", title: "Total R by setup grade",
    groupBy: "setupGrade", agg: "sum", field: "netR",
    requires: ["setupGrade"],
    caption: "If A+ does not outperform B, the grading criteria are wrong." },
  { id: 10, group: "breakdown", type: "column", title: "Total R by execution quality",
    groupBy: "executionBand", agg: "sum", field: "netR",
    requires: ["executionRating"] },
  { id: 11, group: "breakdown", type: "column", title: "Total R by management style",
    groupBy: "managementStyle", agg: "sum", field: "netR",
    requires: ["managementStyle"] },
  { id: 12, group: "breakdown", type: "column", title: "Total R by pair",
    groupBy: "instrument", agg: "sum", field: "netR" },
  { id: 13, group: "breakdown", type: "column", title: "News vs no-news",
    groupBy: "newsVsNoNews", agg: "sum", field: "netR",
    requires: ["highImpactNews"] },
  { id: 14, group: "breakdown", type: "line", title: "R by month",
    groupBy: "month", agg: "sum", field: "netR" },

  // ── Opportunity left behind ────────────────────────────────────────
  { id: 15, group: "opportunity", type: "number", title: "Avg MFE gap", unit: "R",
    agg: "avg", field: "mfeGapR", requires: ["mfePrice"],
    caption: "The cost of exiting early. A large persistent gap means your targets or your hands are the problem, not your entries." },
  { id: 16, group: "opportunity", type: "number", title: "Avg missed R", unit: "R",
    agg: "avg", field: "missedR", requires: ["mfePrice"] },
  { id: 19, group: "opportunity", type: "number", title: "Avg MAE", unit: "R",
    agg: "avg", field: "maeR", requires: ["maePrice"],
    caption: "Heat taken. Deep MAE on winners means your entries are early." },
  { id: 20, group: "opportunity", type: "number", title: "Avg MFE", unit: "R",
    agg: "avg", field: "mfeR", requires: ["mfePrice"] },

  // ── Wick-outs ──────────────────────────────────────────────────────
  { id: 17, group: "wick", type: "number", title: "Wick-out rate", unit: "%",
    agg: "avg", field: "wickOutPct", requires: ["wickedOut"] },
  { id: 18, group: "wick", type: "number", title: "Wick recovery rate", unit: "%",
    agg: "avg", field: "wickRecoveryPct", requires: ["wickedOut"],
    filter: "wickedOut",
    caption: "Of the trades wicked out, how many later reached target. High means your stops are too tight — the idea was right." },
  { id: 32, group: "wick", type: "donut", title: "Why you get wicked out",
    groupBy: "wickOutClass", agg: "count", field: "netR",
    requires: ["wickOutClass"], filter: "wickedOut",
    caption: "SL Too Tight and Poor SL Placement are fixable. Correct Invalidation is the system working — leave those alone." },

  // ── Trade quality ──────────────────────────────────────────────────
  { id: 21, group: "quality", type: "number", title: "Best trade", unit: "R",
    agg: "max", field: "netR" },
  { id: 22, group: "quality", type: "number", title: "Worst trade", unit: "R",
    agg: "min", field: "netR",
    caption: "If this is worse than −1R, a stop was moved or a rule was broken. That is the account-killer." },
  { id: 23, group: "quality", type: "number", title: "Average winner", unit: "R",
    agg: "avg", field: "winnerR" },
  { id: 24, group: "quality", type: "number", title: "Average loser", unit: "R",
    agg: "avg", field: "loserR",
    caption: "Should sit near −1R. Drifting past it means stops are being moved." },
  { id: 25, group: "quality", type: "number", title: "Avg time in trade", unit: "min",
    agg: "avg", field: "holdMinutes" },

  // ── Timing ─────────────────────────────────────────────────────────
  { id: 26, group: "timing", type: "column", title: "Best & worst trading times",
    groupBy: "phaseId", agg: "avg", field: "netR", sort: "desc", labelBy: "phase",
    requires: ["phaseId"],
    caption: "Average R is volume-neutral, so a phase cannot look good just because you traded it often. This is the true ranking of your day — trust it over chart 8." },
  { id: 27, group: "timing", type: "column", title: "Win rate by session phase",
    groupBy: "phaseId", agg: "avg", field: "winRatePct", sort: "desc", labelBy: "phase",
    requires: ["phaseId"],
    caption: "High win rate here with low average R in 26 means you are taking small profits." },
  { id: 28, group: "timing", type: "column", title: "Avg R by day of week",
    groupBy: "dayOfWeek", agg: "avg", field: "netR" },

  // ── Donuts ─────────────────────────────────────────────────────────
  { id: 29, group: "donut", type: "donut", title: "Win / loss / breakeven",
    groupBy: "outcome", agg: "count", field: "netR",
    caption: "A fat breakeven slice usually means stops pulled to BE too early." },
  { id: 30, group: "donut", type: "donut", title: "What caused the losses",
    groupBy: "lossCausedBy", agg: "count", field: "netR",
    requires: ["lossCausedBy"],
    caption: "Market Randomness is an acceptable slice. Psychology and Execution are not — those are the ones that end accounts." },
  { id: 31, group: "donut", type: "donut", title: "Rule adherence split",
    groupBy: "ruleAdherenceBand", agg: "count", field: "netR",
    requires: ["ruleChecklist"] },
  { id: 33, group: "donut", type: "donut", title: "Where your trades go",
    groupBy: "phaseId", agg: "count", field: "netR", labelBy: "phase",
    requires: ["phaseId"],
    caption: "Read against 8 and 26: trades concentrated in a phase those show as negative is the fastest fix available." },

  // ── Psychology ─────────────────────────────────────────────────────
  { id: 34, group: "psych", type: "bar", title: "Total R by pre-trade state",
    groupBy: "preTradeFlags", agg: "sum", field: "netR", sort: "asc",
    requires: ["preTradeFlags"],
    caption: "Revenge and FOMO are the bars to watch. If either is deeply negative, that is a hard stand-down rule — not a thing to manage better." },

  // ── Beyond Notion ──────────────────────────────────────────────────
  // Four charts the Notion build cannot draw at all, because none of them
  // can be computed without looking at the sequence of trades.
  { id: 101, group: "sequence", type: "equity", title: "Equity curve & drawdown", unit: "R",
    caption: "Cumulative R over time, with drawdown from the running peak shaded beneath." },
  { id: 102, group: "sequence", type: "number", title: "Max drawdown", unit: "R",
    agg: "maxDrawdown",
    caption: "Peak-to-trough on the R curve. Manual in Notion; computed here." },
  { id: 103, group: "sequence", type: "number", title: "Longest loss streak",
    agg: "lossStreak",
    caption: "Manual in Notion — formulas cannot see neighbouring rows." },
  { id: 104, group: "sequence", type: "number", title: "Longest win streak",
    agg: "winStreak" },
];

export const GROUPS = [
  { id: "core", label: "Core performance" },
  { id: "sequence", label: "Sequence" },
  { id: "breakdown", label: "Breakdowns" },
  { id: "timing", label: "Timing" },
  { id: "quality", label: "Trade quality" },
  { id: "opportunity", label: "Opportunity left behind" },
  { id: "wick", label: "Wick-outs" },
  { id: "donut", label: "Splits" },
  { id: "psych", label: "Psychology" },
];

export const isStarred = (c) => STARRED.includes(c.id);

/**
 * Which of a chart's required fields no trade has populated.
 *
 * Returning the missing field names rather than a boolean is what lets a
 * dark chart say "needs Setup Grade" instead of "no data" — the second
 * tells you nothing about how to fix it.
 */
export function missingFields(chart, rows) {
  if (!chart.requires || !chart.requires.length) return [];
  return chart.requires.filter((f) => !rows.some((r) => {
    const v = r[f];
    return Array.isArray(v) ? v.length > 0 : v !== "" && v != null;
  }));
}

/** Human labels for the fields a dark chart is waiting on. */
export const FIELD_LABELS = {
  setupGrade: "Setup Grade", executionRating: "Execution Rating",
  ruleChecklist: "Rule Checklist", preTradeFlags: "Pre-Trade Flags",
  phaseId: "Session Phase", mfePrice: "MFE", maePrice: "MAE",
  wickedOut: "Wicked Out?", wickOutClass: "Wick-Out Classification",
  highImpactNews: "High-Impact News?", managementStyle: "Management Style",
  lossCausedBy: "Loss Caused By",
};
