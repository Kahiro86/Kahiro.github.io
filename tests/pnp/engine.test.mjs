// ── PNP engine arithmetic ────────────────────────────────────────────
// Every expected value below is worked out by hand in the comment beside
// it. A test whose expectation was produced by running the code proves
// only that the code is deterministic.
//
// Run: node tests/pnp/engine.test.mjs
import { metricsOf, netR, closedTrades } from "../../src/modules/pnp/engine/metrics.js";
import { maxDrawdownR, longestStreak, currentStreak, equityCurve } from "../../src/modules/pnp/engine/sequence.js";
import { groupBy, aggregate, sampleLevel, sampleSizeCheck, periodKey, tradesInPeriod } from "../../src/modules/pnp/engine/periods.js";
import { seedPhases, sanitizePhases, phaseWindowLabel, phaseForTime, isEuDst, isUsDst } from "../../src/modules/pnp/engine/phases.js";
import { reviewStats } from "../../src/modules/pnp/engine/review.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n          got  ${g}\n          want ${w}`); }
};

/**
 * A trade whose R is exactly what we choose.
 *
 * riskAmount = lots × |entry-stop| × (valuePerPipPerLot / pipSize).
 * With lots=1, pipSize=0.0001, valuePerPipPerLot=10 → perPip = 100000.
 * entry 1.1000, stop 1.0900 → stopDistance 0.01 → risk = 1 × 0.01 × 100000 = 1000.
 * So netPnl of ±1000 is ±1R, and exit price sets it directly.
 */
const mk = (id, date, rMultiple, extra = {}) => {
  const entry = 1.1, stop = 1.09;                 // 0.01 distance, risk 1000
  const exit = +(entry + 0.01 * rMultiple).toFixed(5); // Buy: +1R per 0.01
  return {
    id, date, time: "10:00", timeClosed: "11:30",
    status: "CLOSED", direction: "Buy",
    entry, stop, exit, target: 1.13,
    lots: 1, pipSize: 0.0001, valuePerPipPerLot: 10,
    commission: 0, swap: 0,
    accountId: "", ...extra,
  };
};

console.log("\n── metrics ──");
{
  const win = mk("t1", "2026-01-05", 2);      // exit 1.12 → +2000 → +2R
  const loss = mk("t2", "2026-01-06", -1);    // exit 1.09 → -1000 → -1R
  const be = mk("t3", "2026-01-07", 0.02);    // +20 → |0.02R| < 0.05 → BE

  eq("netR of a 2R winner", netR(win), 2);
  eq("netR of a 1R loser", netR(loss), -1);
  eq("outcome Win", metricsOf(win).outcome, "Win");
  eq("outcome Loss", metricsOf(loss).outcome, "Loss");
  eq("a 0.02R result is breakeven, not a win", metricsOf(be).outcome, "BE");
  eq("grossWinR of a loser is 0", metricsOf(loss).grossWinR, 0);
  eq("grossLossR of a loser is +1 (positive)", metricsOf(loss).grossLossR, 1);
  // winnerR/loserR must be null, not 0, or averages are wrong.
  eq("winnerR of a loser is null", metricsOf(loss).winnerR, null);
  eq("loserR of a winner is null", metricsOf(win).loserR, null);

  // MFE: price ran to 1.13 on a 0.01 stop → (1.13-1.10)/0.01 = 3R.
  // Closed at +2R → gap 1R.
  const withExc = mk("t4", "2026-01-08", 2, { mfePrice: 1.13, maePrice: 1.095 });
  eq("mfeR from price", metricsOf(withExc).mfeR, 3);
  // MAE: went to 1.095, i.e. 0.005 against → 0.5R of heat, quoted positive.
  eq("maeR is positive heat", metricsOf(withExc).maeR, 0.5);
  eq("mfeGapR = 3R offered - 2R kept", metricsOf(withExc).mfeGapR, 1);
  eq("missedR floors at 0", metricsOf(mk("t5", "2026-01-09", 3, { mfePrice: 1.12 })).missedR, 0);
  eq("mfeR is null when unrecorded", metricsOf(win).mfeR, null);

  // Bands
  eq("executionBand 9 → High", metricsOf(mk("t6", "2026-01-10", 1, { executionRating: 9 })).executionBand, "High (8-10)");
  eq("executionBand 5 → Mid", metricsOf(mk("t7", "2026-01-10", 1, { executionRating: 5 })).executionBand, "Mid (5-7)");
  eq("executionBand absent → Unrated", metricsOf(win).executionBand, "Unrated");
  // 13 rules: 13/13 = 100 Full; 11/13 = 84.6 → 85 High; 9/13 = 69.2 → 69 Broken.
  const all13 = Array.from({ length: 13 }, (_, i) => `r${i}`);
  eq("13/13 rules → 100%", metricsOf(mk("t8", "2026-01-10", 1, { ruleChecklist: all13 })).ruleAdherencePct, 100);
  eq("13/13 → Full", metricsOf(mk("t9", "2026-01-10", 1, { ruleChecklist: all13 })).ruleAdherenceBand, "Full (100%)");
  eq("11/13 → 85%", metricsOf(mk("ta", "2026-01-10", 1, { ruleChecklist: all13.slice(0, 11) })).ruleAdherencePct, 85);
  eq("11/13 → High", metricsOf(mk("tb", "2026-01-10", 1, { ruleChecklist: all13.slice(0, 11) })).ruleAdherenceBand, "High (80-99%)");
  eq("9/13 → Broken", metricsOf(mk("tc", "2026-01-10", 1, { ruleChecklist: all13.slice(0, 9) })).ruleAdherenceBand, "Broken (<80%)");

  // Wick-outs
  const wick = mk("td", "2026-01-11", -1, { wickedOut: "Yes", reachedOriginalTpAfterSl: "Yes" });
  eq("wickOutFlag", metricsOf(wick).wickOutFlag, 1);
  eq("wickRecoveryFlag when TP hit after SL", metricsOf(wick).wickRecoveryFlag, 1);
  eq("no recovery without a wick-out", metricsOf(mk("te", "2026-01-11", -1, { reachedOriginalTpAfterSl: "Yes" })).wickRecoveryFlag, 0);

  eq("open trades are excluded", closedTrades([{ ...win, status: "OPEN" }]).length, 0);
  eq("closed with no exit price is excluded", closedTrades([{ ...win, exit: "" }]).length, 0);
}

console.log("\n── sequence ──");
{
  // +1, -1, -1, -1, +2, -1  → cum: 1, 0, -1, -2, 0, -1
  // peak: 1, 1, 1, 1, 1, 1  → dd:  0, -1, -2, -3, -1, -2
  // max drawdown = 3
  const rs = [1, -1, -1, -1, 2, -1];
  const seq = rs.map((r, i) => mk(`s${i}`, `2026-02-0${i + 1}`, r));

  eq("equity curve cumR", equityCurve(seq).map((p) => p.cumR), [1, 0, -1, -2, 0, -1]);
  eq("equity curve drawdown", equityCurve(seq).map((p) => p.drawdown), [0, -1, -2, -3, -1, -2]);
  eq("maxDrawdownR is peak-to-trough, not worst trade", maxDrawdownR(seq), 3);
  eq("longest loss streak", longestStreak(seq, "loss"), 3);
  eq("longest win streak", longestStreak(seq, "win"), 1);
  eq("currentStreak is negative after a loss", currentStreak(seq), -1);

  // Breakeven must not break or extend a run: L, BE, L is a 2-loss streak.
  const withBe = [mk("b1", "2026-03-01", -1), mk("b2", "2026-03-02", 0.01), mk("b3", "2026-03-03", -1)];
  eq("BE neither breaks nor extends a streak", longestStreak(withBe, "loss"), 2);
  eq("currentStreak skips a trailing BE", currentStreak([...withBe]), -2);

  eq("empty set has no drawdown", maxDrawdownR([]), 0);
  eq("empty set has no streak", currentStreak([]), 0);
}

console.log("\n── periods & aggregation ──");
{
  const rows = [
    { netR: 2, grade: "A+", flags: ["FOMO", "Greed"] },
    { netR: -1, grade: "A+", flags: ["FOMO"] },
    { netR: -1, grade: "C", flags: [] },
    { netR: 3, grade: "A+", flags: ["Greed"] },
  ];
  eq("sum aggregate", aggregate(rows, "netR", "sum"), 3);
  eq("avg aggregate", aggregate(rows, "netR", "avg"), 0.75);
  eq("nulls are skipped, not zero-filled",
    aggregate([{ x: 4 }, { x: null }, { x: 2 }], "x", "avg"), 3);

  const byGrade = groupBy(rows, "grade", { valueField: "netR", agg: "sum", sort: "desc" });
  eq("grouped keys sorted by value desc", byGrade.map((b) => b.key), ["A+", "C"]);
  eq("A+ sums to 4", byGrade[0].value, 4);
  eq("A+ has n=3", byGrade[0].n, 3);

  // A multi-select puts a trade in every bucket it names.
  const byFlag = groupBy(rows, "flags", { valueField: "netR", agg: "sum" });
  eq("multi-select buckets", byFlag.map((b) => `${b.key}:${b.n}`), ["FOMO:2", "Greed:2"]);
  eq("FOMO sums 2 + -1 = 1", byFlag.find((b) => b.key === "FOMO").value, 1);

  eq("19 trades conclude nothing", sampleLevel(19), "none");
  eq("20 trades is a hint", sampleLevel(20), "hint");
  eq("50 trades is solid", sampleLevel(50), "solid");
  eq("sample check copy", sampleSizeCheck(3), "Too few trades - do not conclude anything".replace(" - ", " — "));

  // 2026-02-04 is a Wednesday; the Sunday-based week starts 2026-02-01.
  eq("weekly period key is the Sunday", periodKey("2026-02-04", "weekly"), "2026-02-01");
  eq("monthly period key", periodKey("2026-02-04", "monthly"), "2026-02");
  eq("daily period key is the date", periodKey("2026-02-04", "daily"), "2026-02-04");

  const feb = [mk("p1", "2026-02-03", 1), mk("p2", "2026-02-10", 1), mk("p3", "2026-03-01", 1)];
  eq("period membership is derived from the date, not a link",
    tradesInPeriod(feb, "weekly", "2026-02-01").map((t) => t.id), ["p1"]);
  eq("monthly period picks up the whole month",
    tradesInPeriod(feb, "monthly", "2026-02").map((t) => t.id), ["p1", "p2"]);
}

console.log("\n── session phases ──");
{
  const ph = sanitizePhases(seedPhases());
  eq("15 phases seeded", ph.length, 15);

  // Summer: the Notion table's own clock values.
  eq("A1 in September", phaseWindowLabel(ph.find((p) => p.phase === "A1"), "2026-09-02"), "03:00 – 04:00");
  eq("L1 in September", phaseWindowLabel(ph.find((p) => p.phase === "L1"), "2026-09-02"), "10:00 – 11:00");
  eq("NY2 in September", phaseWindowLabel(ph.find((p) => p.phase === "NY2"), "2026-09-02"), "16:30 – 17:30");

  // Winter: both shift an hour later in EAT, which is the twice-a-year
  // manual edit the Notion table asks for.
  eq("L1 in January shifts an hour", phaseWindowLabel(ph.find((p) => p.phase === "L1"), "2026-01-15"), "11:00 – 12:00");
  eq("NY2 in January shifts an hour", phaseWindowLabel(ph.find((p) => p.phase === "NY2"), "2026-01-15"), "17:30 – 18:30");
  // Japan observes no daylight saving, so Asia must NOT move.
  eq("A1 does not move in January", phaseWindowLabel(ph.find((p) => p.phase === "A1"), "2026-01-15"), "03:00 – 04:00");

  eq("EU summer time in July", isEuDst("2026-07-01"), true);
  eq("EU winter in December", isEuDst("2026-12-01"), false);
  eq("US daylight time in July", isUsDst("2026-07-01"), true);

  // The same clock time is a different phase either side of the change.
  const at = (t, ds) => ph.find((p) => p.id === phaseForTime(ph, t, ds)).phase;
  eq("11:30 is L2 in July", at("11:30", "2026-07-15"), "L2");
  eq("11:30 is L1 in January", at("11:30", "2026-01-15"), "L1");

  // `+null` is 0, so a naive coercion gives Custom a real 00:00 window.
  const custom = ph.find((p) => p.phase === "Custom");
  eq("Custom has no window", [custom.startOffset, custom.endOffset], [null, null]);
  eq("Custom renders as a dash", phaseWindowLabel(custom, "2026-09-02"), "—");
  eq("a time outside every window falls to Custom", at("00:30", "2026-09-02"), "Custom");
}

console.log("\n── review stats ──");
{
  const rs = [mk("r1", "2026-02-03", 2), mk("r2", "2026-02-04", -1), mk("r3", "2026-02-10", 1)];
  // Feb 3 and 4 are both in the week starting Sunday Feb 1; Feb 10 is not.
  const w = reviewStats(rs, "weekly", "2026-02-01");
  eq("weekly picks up its own days with no linking", w.tradesTaken, 2);
  eq("weekly total R", w.totalR, 1);
  eq("weekly profit factor 2 ÷ 1", w.profitFactor, 2);
  eq("weekly expectancy", w.expectancyR, 0.5);

  const mo = reviewStats(rs, "monthly", "2026-02");
  eq("monthly picks up the whole month without linking", mo.tradesTaken, 3);
  eq("monthly computes its own drawdown", mo.maxDrawdownR, 1);

  // A period with no trades must not report zeros as though it broke even.
  const none = reviewStats(rs, "daily", "2026-02-05");
  eq("an untraded day has no expectancy", none.expectancyR, null);
  eq("an untraded day has no profit factor", none.profitFactor, null);
  eq("an all-wins period has no profit factor either",
    reviewStats([mk("w1", "2026-05-01", 2)], "daily", "2026-05-01").profitFactor, null);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
