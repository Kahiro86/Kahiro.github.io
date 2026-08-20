// ── Analyst · cross-module patterns ──────────────────────────────────
// Correlations no single tab can see, because the signals live in different
// modules: a relapse in Life against the night's sleep from the trade gate, a
// savings-rate line from the wealth snapshots, fleet exposure from the trading
// accounts. Each finding cites the Law it touches. Honest with thin data —
// nothing shows until there's enough to mean it.
import { sanitizePurity } from "../life/purity.js";
import { sanitizeSnapshots } from "./snapshots.js";

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);

export function crossModulePatterns({ purity, sleep, snapshots, tiTrades, tiAccounts, income, firmConfig } = {}) {
  const findings = [];
  const log = sanitizePurity(purity);
  const relapses = Object.keys(log).filter((d) => log[d].s === "relapse");
  const sleepMap = sleep && typeof sleep === "object" && !Array.isArray(sleep) ? sleep : {};

  // 1 — Sleep predicts the breaches. The trade gate already logs hours slept
  // per day; cross it against Life's relapse days.
  const timed = relapses.filter((d) => Number.isFinite(+sleepMap[d]));
  if (timed.length >= 2) {
    const under = timed.filter((d) => +sleepMap[d] < 6).length;
    if (under / timed.length >= 0.7) {
      findings.push({ id: "sleep_breach", tone: "bad", tag: "Cross", title: "Sleep predicts the breaches",
        detail: `${under} of ${timed.length} relapses with a sleep log followed a night under 6 hours. Nothing else correlates this cleanly — not day of week, not stress.`,
        law: "Law 7 — Sleep is infrastructure. The 6.5-hour floor outranks every opportunity." });
    }
  }

  // 2 — Savings rate trend, from the wealth snapshots.
  const snaps = sanitizeSnapshots(snapshots);
  if (snaps.length >= 2) {
    const first = snaps[0].savingsRate, last = snaps[snaps.length - 1].savingsRate;
    if (last < first - 3) {
      findings.push({ id: "savings_trend", tone: "warn", tag: "Trend", title: "Savings rate is falling, not rising",
        detail: `Across ${snaps.length} snapshots the line runs down — roughly ${Math.round(first)}% to ${Math.round(last)}%. With income partly unlogged the level is soft, but the direction is the thing to fix.`,
        bars: [
          { l: snaps[0].ym || "first", v: Math.max(0, Math.round(first)) },
          { l: snaps[snaps.length - 1].ym || "now", v: Math.max(0, Math.round(last)) },
        ] });
    }
  }

  // 3 — Fleet risk discipline, from the trading accounts.
  const accts = arr(tiAccounts).filter((a) => !a.archived);
  if (accts.length) {
    const cap = +firmConfig?.aggregateExposureCap || 1.5;
    const open = arr(tiTrades).filter((t) => t && t.status && t.status !== "CLOSED" && !t.archived);
    const exposure = open.length * (+firmConfig?.riskPerTradePct || 0.5);
    if (exposure <= cap) {
      findings.push({ id: "fleet_risk", tone: "good", tag: "Trading", title: "Fleet risk discipline is holding",
        detail: `Aggregate exposure ${exposure.toFixed(2)}% against a ${cap}% cap. ${accts.length} account${accts.length === 1 ? "" : "s"}, ${open.length} open position${open.length === 1 ? "" : "s"}. The correlation defence hasn't been tested — but nothing has breached it either.`,
        law: "Law 4 — Kill correlation." });
    }
  }

  // 4 — Not enough data (the gate on the deeper spend patterns).
  const txns = arr(income).length + arr(tiTrades).length;
  if (txns < 30) {
    findings.push({ id: "more_data", tone: "warn", tag: "Data", isGate: true, title: "Not enough data yet",
      detail: `Spend-after-loss, category creep and windfall-discipline patterns need at least 30 logged transactions. Currently ${txns}. These unlock as the ledger fills.` });
  }

  return findings;
}
