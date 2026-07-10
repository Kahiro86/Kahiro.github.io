import { GR, CY, PU, AM, RE, T2 } from "../../shared/designTokens.js";
import { INSTRUMENTS } from "./constants.js";
import { localDateStr } from "../../shared/dates.js";

export const genId = () => `t${Date.now().toString(36)}`;
export const getPV = (i) => INSTRUMENTS.find((x) => x.l === i)?.pv ?? 20;
export const gcol = (g) => (g === "A+" ? GR : g === "A" || g === "A-" ? CY : g === "B+" ? PU : g === "B" ? AM : RE);
export const ocol = (o) => ({ WIN: GR, LOSS: RE, BE: AM, PARTIAL: CY }[o] ?? T2);

// Total commission + swap/fees for a trade (0 when unset — no effect on old trades).
const tradeFees = (t) => (+t.commission || 0) + (+t.swapFees || 0);

export const calcPnl = (t) => {
  if (t.status === "CLOSED" && t.pnl !== undefined) return t.pnl;
  const en = +t.entryPrice || 0;
  const pv = getPV(t.instrument);
  const n = +t.contracts || 1;
  const d = t.direction === "LONG" ? 1 : -1;
  const fees = tradeFees(t);
  if (t.hasPartial && t.partialExitPrice && t.remainingExitPrice) {
    const ps = +t.partialSize || 0.5;
    return Math.round(
      ps * n * (+t.partialExitPrice - en) * d * pv +
        (1 - ps) * n * (+t.remainingExitPrice - en) * d * pv - fees
    );
  }
  if (t.exitPrice) return Math.round(n * (+t.exitPrice - en) * d * pv - fees);
  return 0;
};

export const calcMetrics = (f, bal) => {
  const en = +f.entryPrice || 0;
  const st = +f.stopPrice || 0;
  const tg = +f.targetPrice || 0;
  const n = +f.contracts || 1;
  const pv = getPV(f.instrument);
  const sd = Math.abs(en - st);
  const rr = sd > 0 ? +(Math.abs(tg - en) / sd).toFixed(2) : 0;
  const ra = Math.round(n * sd * pv);
  const rp = bal > 0 ? +((ra / bal) * 100).toFixed(2) : 0;
  return { stopDistance: +sd.toFixed(2), projectedRR: rr, riskAmount: ra, riskPercent: rp };
};

export const calcActualRR = (t) => {
  const en = +t.entryPrice || 0;
  const st = +t.stopPrice || 0;
  const pv = getPV(t.instrument);
  const n = +t.contracts || 1;
  const ra = n * Math.abs(en - st) * pv;
  if (!ra) return 0;
  return +(calcPnl(t) / ra).toFixed(2);
};

export const getStats = (trades) => {
  const cl = (Array.isArray(trades) ? trades : []).filter((t) => t && t.status === "CLOSED" && !t.archived);
  const wins = cl.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");
  const losses = cl.filter((t) => t.outcome === "LOSS");
  const wr = cl.length ? Math.round((wins.length / cl.length) * 100) : 0;
  const totalPnl = cl.reduce((s, t) => s + calcPnl(t), 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + calcPnl(t), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + calcPnl(t), 0) / losses.length) : 1;
  const pf = losses.length ? +((avgWin * wins.length) / (avgLoss * losses.length)).toFixed(2) : 0;
  const avgRR = wins.length
    ? +(wins.reduce((s, t) => s + (t.actualRR || calcActualRR(t)), 0) / wins.length).toFixed(2)
    : 0;
  return { total: cl.length, wins: wins.length, losses: losses.length, wr, totalPnl: Math.round(totalPnl), avgWin: Math.round(avgWin), pf, avgRR };
};

// Sum of closed (non-archived) trade P/L on/after a YYYY-MM-DD date string.
export const periodPnl = (trades, sinceDate) =>
  (Array.isArray(trades) ? trades : []).filter((t) => t && t.status === "CLOSED" && !t.archived && t.date && t.date >= sinceDate)
    .reduce((s, t) => s + calcPnl(t), 0);

// Trading account as its own financial environment — never mixed into personal
// wealth. Daily/weekly/monthly P&L, equity, profit split, win rate, risk.
export const tradingMetrics = (trades, fundedSize = 15000, withdrawals = 0, profitSplit = 80) => {
  const stats = getStats(trades);
  const now = new Date();
  const today = localDateStr(now);
  const ws = new Date(now); ws.setDate(now.getDate() - now.getDay());
  const weekStart = localDateStr(ws);
  const monthStart = `${today.slice(0, 7)}-01`;
  const totalProfit = stats.totalPnl;
  const openRisk = (Array.isArray(trades) ? trades : [])
    .filter((t) => t && t.status === "OPEN" && !t.archived)
    .reduce((s, t) => s + (+t.riskAmount || 0), 0);
  return {
    fundedSize: +fundedSize || 0,
    equity: (+fundedSize || 0) + totalProfit - (+withdrawals || 0),
    dailyPnl: periodPnl(trades, today),
    weeklyPnl: periodPnl(trades, weekStart),
    monthlyPnl: periodPnl(trades, monthStart),
    totalProfit,
    withdrawals: +withdrawals || 0,
    profitSplit: +profitSplit || 0,
    yourShare: Math.round(Math.max(0, totalProfit) * ((+profitSplit || 0) / 100)),
    winRate: stats.wr,
    pf: stats.pf,
    total: stats.total,
    avgRR: stats.avgRR,
    openRisk,
    openRiskPct: fundedSize > 0 ? +((openRisk / fundedSize) * 100).toFixed(2) : 0,
  };
};

export const initForm = () => ({
  date: localDateStr(),
  time: new Date().toTimeString().slice(0, 5),
  instrument: "NQ1!", direction: "LONG", session: "", models: [],
  marketStructure: "", htfBias: "", premiumDiscount: "", liquidityTarget: "",
  smtDivergence: false, smtPair: "", po3Phase: "", htfConfirmed: [],
  intermediateContext: [], entryTimeframe: "",
  ictMacro: "", silverBullet: "", mmModel: "", dealingRangeH: "", dealingRangeL: "",
  dol: "", judasSwing: false,
  entryPrice: "", stopPrice: "", targetPrice: "", contracts: 1, tvUrl: "",
  checklist: [], checklistItems: [], checklistScore: 0, checklistTotal: 0,
  checklistTemplate: "", checklistSkipped: false,
  timeClosed: "", commission: "", swapFees: "", screenshots: "",
  emotionBefore: "", emotionAfter: "", mistakes: "",
  exitPrice: "", hasPartial: false, partialExitPrice: "", partialSize: "0.5",
  remainingExitPrice: "", outcome: "", grade: "", targetReached: "",
  entryQuality: "", exitQuality: "", psychologyTag: "", executionScore: 7,
  notes: "", lessons: "", slippage: 0, status: "OPEN",
});
