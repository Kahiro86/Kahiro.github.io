// ── The trade record ─────────────────────────────────────────────────
// One trade, and the arithmetic that falls out of it. Everything else in
// the app reads from here.
//
// A trade is self-contained: it snapshots the instrument's pip size and
// value-per-pip at the moment it was logged, so editing the instrument
// list later never silently rewrites history. The same reason nothing
// derived is stored — risk, R and the outcome are recomputed from the
// trade's own numbers every time, and so can never drift from it.
import { localDateStr } from "../ui/dates.js";
import * as PNP from "./constants.js";

export const uid = (p = "t") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const posNum = (v) => Math.max(0, num(v));
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const arrStr = (v, max = 40) =>
  (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.slice(0, 120)).slice(0, max) : []);
/** Constrain to a known option list, so a stray value cannot become a chart bucket of one. */
const pick = (v, options) => (options.includes(v) ? v : "");
/**
 * Blank when absent, and blank for 0.
 *
 * 0 is the rating slider at rest, not a rating — and anything asking "has
 * this been rated?" would read a stored 0 as yes, lighting a chart up from
 * a trade nobody assessed.
 */
const rating = (v, hi = 10) => {
  if (v == null || v === "" || !Number.isFinite(+v)) return "";
  const n = Math.max(0, Math.min(hi, Math.round(+v)));
  return n === 0 ? "" : n;
};

export const DIRECTIONS = ["Buy", "Sell"];

export function newTrade(patch = {}) {
  return {
    id: uid(),
    accountId: "",
    date: localDateStr(),
    time: "", timeClosed: "",
    instrument: "", pipSize: 0.0001, valuePerPipPerLot: 10,
    direction: "Buy",
    entry: "", stop: "", target: "", exit: "",
    lots: "", riskPct: "", commission: "", swap: "",
    status: "OPEN",
    setupGrade: "", executionRating: "", managementStyle: "",
    ruleChecklist: [], preTradeFlags: [],
    mfePrice: "", maePrice: "", missedRReason: "",
    wickedOut: "", wickOutClass: "",
    reachedTp1AfterSl: "", reachedOriginalTpAfterSl: "",
    highImpactNews: "", lossCausedBy: "",
    phaseId: "", lessons: "",
    createdAt: new Date().toISOString(),
    editedAt: null,
    ...patch,
  };
}

/**
 * Rebuilds every trade from a known set of keys.
 *
 * A whitelist rather than a merge, so a corrupted or hand-edited store
 * cannot introduce a field the rest of the app has never heard of — and
 * so every trade in memory has the same shape whatever wrote it.
 */
export function sanitizeTrades(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const t of raw) {
    if (!t || typeof t !== "object" || !t.id) continue;
    out.push({
      id: String(t.id),
      accountId: str(t.accountId, 40),
      date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : localDateStr(),
      time: /^\d{2}:\d{2}$/.test(t.time) ? t.time : "",
      timeClosed: /^\d{2}:\d{2}$/.test(t.timeClosed) ? t.timeClosed : "",
      instrument: str(t.instrument, 20),
      pipSize: posNum(t.pipSize) || 0.0001,
      valuePerPipPerLot: posNum(t.valuePerPipPerLot) || 10,
      direction: t.direction === "Sell" ? "Sell" : "Buy",
      entry: num(t.entry), stop: num(t.stop), target: num(t.target),
      exit: t.exit === "" || t.exit == null ? "" : num(t.exit),
      lots: posNum(t.lots), riskPct: num(t.riskPct, 0),
      commission: num(t.commission, 0), swap: num(t.swap, 0),
      status: t.status === "CLOSED" ? "CLOSED" : "OPEN",
      setupGrade: pick(t.setupGrade, PNP.SETUP_GRADES),
      executionRating: rating(t.executionRating),
      managementStyle: pick(t.managementStyle, PNP.MANAGEMENT_STYLES),
      // null, not [], when never rated — so "unrated" and "rated zero of
      // thirteen" stay different answers.
      ruleChecklist: Array.isArray(t.ruleChecklist) ? arrStr(t.ruleChecklist, 20) : null,
      preTradeFlags: arrStr(t.preTradeFlags, 20),
      phaseId: str(t.phaseId, 40),
      mfePrice: t.mfePrice === "" || t.mfePrice == null ? "" : num(t.mfePrice),
      maePrice: t.maePrice === "" || t.maePrice == null ? "" : num(t.maePrice),
      missedRReason: pick(t.missedRReason, PNP.MISSED_R_REASONS),
      wickedOut: pick(t.wickedOut, PNP.YES_NO),
      wickOutClass: pick(t.wickOutClass, PNP.WICK_OUT_CLASSES),
      reachedTp1AfterSl: pick(t.reachedTp1AfterSl, PNP.YES_NO_NA),
      reachedOriginalTpAfterSl: pick(t.reachedOriginalTpAfterSl, PNP.YES_NO_NA),
      highImpactNews: pick(t.highImpactNews, PNP.YES_NO),
      lossCausedBy: pick(t.lossCausedBy, PNP.LOSS_CAUSES),
      lessons: str(t.lessons, 2000),
      createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
      editedAt: typeof t.editedAt === "string" ? t.editedAt : null,
    });
  }
  return out;
}

// ── Derived, never stored ────────────────────────────────────────────
/** Money per 1.0 of price movement, per lot. */
const perPip = (t) => (t.pipSize > 0 ? t.valuePerPipPerLot / t.pipSize : 0);

export const stopDistance = (t) => Math.abs(num(t.entry) - num(t.stop));
export const rewardDistance = (t) => Math.abs(num(t.target) - num(t.entry));
export const riskAmount = (t) => Math.round(posNum(t.lots) * stopDistance(t) * perPip(t));
export const projectedRR = (t) => {
  const sd = stopDistance(t);
  return sd > 0 ? +(rewardDistance(t) / sd).toFixed(2) : 0;
};
export const fees = (t) => num(t.commission, 0) + num(t.swap, 0);

export function grossPnl(t) {
  if (t.exit === "" || t.exit == null) return 0;
  const d = t.direction === "Buy" ? 1 : -1;
  return Math.round(posNum(t.lots) * (num(t.exit) - num(t.entry)) * d * perPip(t));
}
export const netPnl = (t) => (t.status === "CLOSED" ? grossPnl(t) - fees(t) : 0);

/**
 * Win / Loss / Breakeven, with a tolerance of 0.05R either side of zero.
 *
 * Floating-point equality against exactly zero is unreliable, and more to
 * the point a trade that closed for a few pence is not a win — treating it
 * as one flatters the win rate and the streaks alike.
 */
export function tradeResult(t) {
  if (t.status !== "CLOSED" || t.exit === "" || t.exit == null) return null;
  const n = netPnl(t);
  const risk = riskAmount(t);
  if (n === 0 || (risk > 0 && Math.abs(n) < 0.05 * risk)) return "BE";
  return n > 0 ? "Win" : "Loss";
}

/** Profit in units of the risk taken. The spine of every statistic here. */
export const actualRR = (t) => {
  const risk = riskAmount(t);
  return risk > 0 ? +(netPnl(t) / risk).toFixed(2) : 0;
};

const toMin = (hhmm) => { const [h, m] = (hhmm || "00:00").split(":").map(Number); return h * 60 + m; };
export function holdMinutes(t) {
  if (!t.timeClosed || !t.time) return null;
  const d = toMin(t.timeClosed) - toMin(t.time);
  return d >= 0 ? d : d + 1440;   // wrapped past midnight
}

export const RESULT_COLORS = { Win: "#3FB950", Loss: "#F85149", BE: "#E3B341" };

export const fmtMoney = (n) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;

// ── Accounts ─────────────────────────────────────────────────────────
export const ACCOUNT_TYPES = ["Live", "Funded", "Demo", "Backtest"];

export function sanitizeAccounts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a) => a && typeof a === "object" && a.id).map((a) => ({
    id: String(a.id),
    name: str(a.name, 60) || "Account",
    type: ACCOUNT_TYPES.includes(a.type) ? a.type : "Demo",
    startBalance: num(a.startBalance, 0),
    goalBalance: num(a.goalBalance, 0),
    riskPct: num(a.riskPct, 1),
    status: a.status === "archived" ? "archived" : "active",
  }));
}

/** An account's balance is its start plus what its trades actually did. */
export function accountBalance(account, trades) {
  const mine = trades.filter((t) => t.accountId === account.id && t.status === "CLOSED");
  return Math.round(account.startBalance + mine.reduce((s, t) => s + netPnl(t), 0));
}

export const DEFAULT_INSTRUMENTS = [
  { symbol: "EURUSD", pipSize: 0.0001, valuePerPipPerLot: 10 },
  { symbol: "GBPUSD", pipSize: 0.0001, valuePerPipPerLot: 10 },
  { symbol: "USDJPY", pipSize: 0.01, valuePerPipPerLot: 9.1 },
  { symbol: "XAUUSD", pipSize: 0.1, valuePerPipPerLot: 10 },
  { symbol: "NAS100", pipSize: 1, valuePerPipPerLot: 1 },
  { symbol: "US30", pipSize: 1, valuePerPipPerLot: 1 },
];
