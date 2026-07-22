// ── Trading Intelligence & Research System — engine ──────────────────
// The methodology-agnostic core. Nothing here assumes ICT, SMC, Wyckoff or
// any mentor's concepts — every strategy, confluence, condition, session and
// instrument is user data. Same durability rule as the rest of the app: a
// trade is self-contained (it snapshots the instrument's pip/value and the
// strategy name/version at log time), so editing a library later never
// rewrites historical trades, and every number derives from stored records.
import { localDateStr, daysBetween } from "../../../shared/dates.js";
import {
  ACCOUNT_TYPES, ACCOUNT_STATUSES, DEFAULT_INSTRUMENTS, DEFAULT_SESSIONS,
  DEFAULT_CONDITIONS, DEFAULT_CONFLUENCES, DEFAULT_STRATEGIES, DEFAULT_MISTAKES,
  DEFAULT_EMOTIONS, DEFAULT_REFLECTION_QUESTIONS, REVIEW_FIELDS, PSYCH_BEFORE,
} from "./defaults.js";

export const uid = (p = "x") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dOf = (v) => (typeof v === "string" && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
const num = (v, min = -Infinity) => (Number.isFinite(+v) ? Math.max(min, +v) : 0);
const posNum = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const arrStr = (v, max = 60) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.slice(0, max)) : []);
const bool = (v) => !!v;
export const fmtMoney = (n) => `$${Math.round(+n || 0).toLocaleString("en-US")}`;

// ── Library sanitizers (named-entry libs used by pickers + analytics) ─
// Stored as { id, name, archived } so entries can be renamed/archived without
// breaking historical trades — trades store the chosen NAME, not the id.
function sanitizeNamedLib(raw, defaults = []) {
  const src = Array.isArray(raw) ? raw : null;
  if (!src) return defaults.map((name) => ({ id: uid("l"), name, archived: false }));
  const out = [];
  for (const e of src) {
    if (typeof e === "string" && e.trim()) { out.push({ id: uid("l"), name: e.slice(0, 60), archived: false }); continue; }
    if (e && typeof e === "object" && typeof e.name === "string" && e.name.trim())
      out.push({ id: e.id ? String(e.id) : uid("l"), name: e.name.slice(0, 60), archived: bool(e.archived) });
  }
  return out;
}
export const sanitizeConditions = (raw) => sanitizeNamedLib(raw, DEFAULT_CONDITIONS);
export const sanitizeConfluences = (raw) => sanitizeNamedLib(raw, DEFAULT_CONFLUENCES);
export const sanitizeMistakes = (raw) => sanitizeNamedLib(raw, DEFAULT_MISTAKES);
export const sanitizeEmotions = (raw) => sanitizeNamedLib(raw, DEFAULT_EMOTIONS);

export function sanitizeInstruments(raw) {
  const src = Array.isArray(raw) ? raw : null;
  if (!src) return DEFAULT_INSTRUMENTS.map((i) => ({ id: uid("i"), ...i, archived: false }));
  const out = [];
  for (const i of src) {
    if (!i || typeof i !== "object" || typeof i.symbol !== "string" || !i.symbol.trim()) continue;
    out.push({
      id: i.id ? String(i.id) : uid("i"),
      symbol: i.symbol.trim().slice(0, 20),
      pipSize: posNum(i.pipSize) || 0.0001,
      valuePerPipPerLot: posNum(i.valuePerPipPerLot) || 10,
      decimals: Number.isFinite(+i.decimals) ? Math.max(0, Math.min(8, +i.decimals)) : 5,
      archived: bool(i.archived),
    });
  }
  return out;
}

export function sanitizeSessions(raw) {
  const src = Array.isArray(raw) ? raw : null;
  if (!src) return DEFAULT_SESSIONS.map((s) => ({ id: uid("s"), ...s, archived: false }));
  const T = /^\d{2}:\d{2}$/;
  const out = [];
  for (const s of src) {
    if (!s || typeof s !== "object" || typeof s.name !== "string" || !s.name.trim()) continue;
    out.push({
      id: s.id ? String(s.id) : uid("s"),
      name: s.name.trim().slice(0, 40),
      start: T.test(s.start) ? s.start : "00:00",
      end: T.test(s.end) ? s.end : "23:59",
      archived: bool(s.archived),
    });
  }
  return out;
}

export function sanitizeStrategies(raw) {
  const src = Array.isArray(raw) ? raw : null;
  if (!src) return DEFAULT_STRATEGIES.map((s) => ({ id: uid("st"), ...s, archived: false, versions: s.versions.map((v) => ({ ...v, createdAt: localDateStr() })) }));
  const out = [];
  for (const s of src) {
    if (!s || typeof s !== "object" || typeof s.name !== "string" || !s.name.trim()) continue;
    let versions = Array.isArray(s.versions) ? s.versions.filter((v) => v && typeof v === "object") : [];
    versions = versions.map((v, i) => ({
      version: Number.isFinite(+v.version) ? +v.version : i + 1,
      notes: str(v.notes, 500),
      rules: str(v.rules, 4000),
      confluences: arrStr(v.confluences),
      checklist: Array.isArray(v.checklist) ? v.checklist.filter((c) => typeof c === "string" && c.trim()).map((c) => c.slice(0, 200)) : [],
      createdAt: dOf(v.createdAt) || localDateStr(),
    }));
    if (!versions.length) versions = [{ version: 1, notes: "", rules: "", confluences: [], checklist: [], createdAt: localDateStr() }];
    const maxV = Math.max(...versions.map((v) => v.version));
    out.push({
      id: s.id ? String(s.id) : uid("st"),
      name: s.name.trim().slice(0, 80),
      archived: bool(s.archived),
      activeVersion: versions.some((v) => v.version === s.activeVersion) ? s.activeVersion : maxV,
      versions,
    });
  }
  return out;
}

export function sanitizeAccounts(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const a of raw) {
    if (!a || typeof a !== "object" || typeof a.name !== "string" || !a.name.trim()) continue;
    out.push({
      id: a.id ? String(a.id) : uid("a"),
      name: a.name.trim().slice(0, 60),
      type: ACCOUNT_TYPES.includes(a.type) ? a.type : "Demo",
      startBalance: num(a.startBalance),
      goalBalance: num(a.goalBalance),
      status: ACCOUNT_STATUSES.includes(a.status) ? a.status : "Active",
      riskPct: posNum(a.riskPct) || 1,
      createdAt: dOf(a.createdAt) || localDateStr(),
      archived: bool(a.archived),
    });
  }
  return out;
}

const sanitizeMedia = (raw) =>
  (Array.isArray(raw) ? raw : []).filter((m) => m && typeof m === "object" && typeof m.value === "string" && m.value).map((m) => ({
    id: m.id ? String(m.id) : uid("m"),
    category: str(m.category, 40) || "Other",
    kind: m.kind === "url" ? "url" : "image",
    value: m.value.slice(0, 600000),
    label: str(m.label, 80),
  }));

const sanitizeRatings = (raw, fields) => {
  const o = {};
  if (raw && typeof raw === "object") for (const f of fields) if (Number.isFinite(+raw[f])) o[f] = Math.max(0, Math.min(10, +raw[f]));
  return o;
};

export function sanitizeTrades(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const t of raw) {
    if (!t || typeof t !== "object" || !t.id) continue;
    out.push({
      id: String(t.id),
      accountId: t.accountId ? String(t.accountId) : "",
      date: dOf(t.date) || localDateStr(),
      time: /^\d{2}:\d{2}$/.test(t.time) ? t.time : "00:00",
      timeClosed: /^\d{2}:\d{2}$/.test(t.timeClosed) ? t.timeClosed : "",
      instrument: str(t.instrument, 20),
      pipSize: posNum(t.pipSize) || 0.0001,
      valuePerPipPerLot: posNum(t.valuePerPipPerLot) || 10,
      direction: t.direction === "Sell" ? "Sell" : "Buy",
      sessions: arrStr(t.sessions), sessionAuto: bool(t.sessionAuto),
      conditions: arrStr(t.conditions),
      strategyId: str(t.strategyId, 40), strategy: str(t.strategy, 80),
      strategyVersion: Number.isFinite(+t.strategyVersion) ? +t.strategyVersion : 1,
      marketModel: str(t.marketModel, 500),
      confluences: arrStr(t.confluences),
      htf: str(t.htf, 200), mtf: str(t.mtf, 200), ltf: str(t.ltf, 200),
      entryTf: str(t.entryTf, 20),
      riskPct: num(t.riskPct, 0),
      lots: posNum(t.lots),
      entry: num(t.entry), stop: num(t.stop), target: num(t.target), exit: t.exit === "" || t.exit == null ? "" : num(t.exit),
      commission: num(t.commission, 0), swap: num(t.swap, 0),
      status: t.status === "CLOSED" ? "CLOSED" : "OPEN",
      psychBefore: sanitizeRatings(t.psychBefore, PSYCH_BEFORE),
      emotions: arrStr(t.emotions),
      reflectionMood: str(t.reflectionMood, 40), reflectionEnergy: str(t.reflectionEnergy, 40), reflectionText: str(t.reflectionText, 2000),
      checklist: Array.isArray(t.checklist) ? t.checklist.filter((c) => c && typeof c === "object" && typeof c.text === "string").map((c) => ({ text: c.text.slice(0, 200), done: bool(c.done) })) : [],
      media: sanitizeMedia(t.media),
      review: sanitizeRatings(t.review, REVIEW_FIELDS),
      wentWell: str(t.wentWell, 1500), mistakesMade: str(t.mistakesMade, 1500), unexpected: str(t.unexpected, 1500),
      lessons: str(t.lessons, 1500), improvements: str(t.improvements, 1500), journalText: str(t.journalText, 4000),
      biggestMistake: str(t.biggestMistake, 500), rootCause: str(t.rootCause, 500), actionableFix: str(t.actionableFix, 500),
      whatRepeat: str(t.whatRepeat, 500), whatStop: str(t.whatStop, 500), focusNext: str(t.focusNext, 500),
      reflectionAnswers: (t.reflectionAnswers && typeof t.reflectionAnswers === "object" && !Array.isArray(t.reflectionAnswers)) ? Object.fromEntries(Object.entries(t.reflectionAnswers).filter(([, v]) => typeof v === "string").map(([k, v]) => [k.slice(0, 200), v.slice(0, 1000)])) : {},
      mistakes: arrStr(t.mistakes),
      createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
      editedAt: typeof t.editedAt === "string" ? t.editedAt : null,
    });
  }
  return out;
}

export function sanitizeReflectionQs(raw) {
  const a = arrStr(raw, 200);
  return a.length ? a : [...DEFAULT_REFLECTION_QUESTIONS];
}

// ── Auto trade-info derivation ───────────────────────────────────────
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function tradeInfo(dateStr) {
  const ds = dOf(dateStr) || localDateStr();
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const jan1 = new Date(y, 0, 1);
  const dayOfYear = Math.floor((dt - jan1) / 86400000) + 1;
  // ISO week number
  const t = new Date(Date.UTC(y, m - 1, d));
  const dayNr = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNr + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return {
    weekday: WEEKDAYS[dt.getDay()], month: MONTHS[m - 1], monthNum: m,
    quarter: Math.floor((m - 1) / 3) + 1, year: y, week, dayOfYear,
  };
}

const toMin = (hhmm) => { const [h, m] = (hhmm || "00:00").split(":").map(Number); return h * 60 + m; };
// Sessions whose window contains the given time (wrap-around aware).
export function detectSessions(sessions, time) {
  const mins = toMin(time);
  return sanitizeSessions(sessions).filter((s) => !s.archived).filter((s) => {
    const a = toMin(s.start), b = toMin(s.end);
    return a <= b ? mins >= a && mins < b : mins >= a || mins < b;
  }).map((s) => s.name);
}

// ── Per-trade calculations (all read the trade's own snapshotted values) ─
export const stopDistance = (t) => Math.abs(num(t.entry) - num(t.stop));
export const rewardDistance = (t) => Math.abs(num(t.target) - num(t.entry));
const perPip = (t) => (t.pipSize > 0 ? t.valuePerPipPerLot / t.pipSize : 0); // money per 1.0 price move per lot
export const riskAmount = (t) => Math.round(posNum(t.lots) * stopDistance(t) * perPip(t));
export const projectedRR = (t) => { const sd = stopDistance(t); return sd > 0 ? +(rewardDistance(t) / sd).toFixed(2) : 0; };
export const fees = (t) => num(t.commission, 0) + num(t.swap, 0);
export function grossPnl(t) {
  if (t.exit === "" || t.exit == null) return 0;
  const d = t.direction === "Buy" ? 1 : -1;
  return Math.round(posNum(t.lots) * (num(t.exit) - num(t.entry)) * d * perPip(t));
}
export const netPnl = (t) => (t.status === "CLOSED" ? grossPnl(t) - fees(t) : 0);
export function tradeResult(t) {
  if (t.status !== "CLOSED" || t.exit === "" || t.exit == null) return null;
  const n = netPnl(t), risk = riskAmount(t);
  if (n === 0 || (risk > 0 && Math.abs(n) < 0.05 * risk)) return "BE";
  return n > 0 ? "Win" : "Loss";
}
export const actualRR = (t) => { const risk = riskAmount(t); return risk > 0 ? +(netPnl(t) / risk).toFixed(2) : 0; };
export function holdMinutes(t) {
  if (!t.timeClosed || !t.time) return null;
  const d = toMin(t.timeClosed) - toMin(t.time);
  return d >= 0 ? d : d + 1440;
}
export const RESULT_COLORS = { Win: "#3FB950", Loss: "#F85149", BE: "#E3B341" };

// ── Account metrics (derived live from its trades) ───────────────────
export function accountMetrics(account, allTrades) {
  const trades = sanitizeTrades(allTrades).filter((t) => t.accountId === account.id && !t.archived);
  const closed = trades.filter((t) => t.status === "CLOSED" && t.exit !== "" && t.exit != null);
  const results = closed.map(tradeResult);
  const wins = results.filter((r) => r === "Win").length;
  const losses = results.filter((r) => r === "Loss").length;
  const decided = wins + losses;
  const netTotal = closed.reduce((s, t) => s + netPnl(t), 0);
  const rrs = closed.map(actualRR).filter((r) => Number.isFinite(r) && r !== 0);
  const current = account.startBalance + netTotal;
  const goalGap = account.goalBalance - account.startBalance;
  return {
    total: trades.length, closed: closed.length, open: trades.length - closed.length,
    wins, losses, wr: decided ? Math.round((wins / decided) * 100) : 0,
    avgRR: rrs.length ? +(rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(2) : 0,
    netPnl: Math.round(netTotal), currentBalance: Math.round(current),
    progress: goalGap > 0 ? Math.max(0, Math.min(100, Math.round(((current - account.startBalance) / goalGap) * 100))) : 0,
  };
}

// ── Portfolio / analytics ────────────────────────────────────────────
const closedOf = (trades, accountId) =>
  sanitizeTrades(trades).filter((t) => t.status === "CLOSED" && t.exit !== "" && t.exit != null && !t.archived && (!accountId || t.accountId === accountId));

export function overallStats(trades, accountId = "") {
  const cl = closedOf(trades, accountId);
  const withRes = cl.map((t) => ({ t, r: tradeResult(t), net: netPnl(t) }));
  const wins = withRes.filter((x) => x.r === "Win");
  const losses = withRes.filter((x) => x.r === "Loss");
  const decided = wins.length + losses.length;
  const grossWin = wins.reduce((s, x) => s + x.net, 0);
  const grossLoss = Math.abs(losses.reduce((s, x) => s + x.net, 0));
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const wr = decided ? wins.length / decided : 0;
  const holds = cl.map(holdMinutes).filter((m) => m != null);
  const rrs = cl.map(actualRR).filter((r) => Number.isFinite(r) && r !== 0);
  return {
    count: cl.length, wins: wins.length, losses: losses.length,
    wr: Math.round(wr * 100),
    avgRR: rrs.length ? +(rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(2) : 0,
    avgWin: Math.round(avgWin), avgLoss: Math.round(avgLoss),
    expectancy: Math.round(wr * avgWin - (1 - wr) * avgLoss),
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : (grossWin > 0 ? Infinity : 0),
    net: Math.round(cl.reduce((s, t) => s + netPnl(t), 0)),
    largestWin: wins.length ? Math.max(...wins.map((x) => x.net)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map((x) => x.net)) : 0,
    avgHold: holds.length ? Math.round(holds.reduce((a, b) => a + b, 0) / holds.length) : 0,
  };
}

// Equity + drawdown across closed trades in date/time order, from a base.
export function equityCurve(trades, base = 0, accountId = "") {
  const cl = closedOf(trades, accountId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  let eq = base, peak = base;
  const pts = [{ i: 0, equity: base, dd: 0 }];
  cl.forEach((t, i) => {
    eq += netPnl(t);
    peak = Math.max(peak, eq);
    pts.push({ i: i + 1, equity: Math.round(eq), dd: Math.round(peak - eq), date: t.date });
  });
  const maxDD = Math.max(0, ...pts.map((p) => p.dd));
  return { points: pts, maxDD };
}

// Generic breakdown. `multi` groups a trade under every value in an array
// field (conditions/confluences/mistakes/emotions); otherwise a single key.
export function breakdown(trades, keyFn, { multi = false, accountId = "" } = {}) {
  const cl = closedOf(trades, accountId);
  const groups = new Map();
  for (const t of cl) {
    const keys = multi ? keyFn(t) : [keyFn(t)];
    for (const k of keys) {
      if (k == null || k === "") continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
  }
  const rows = [...groups.entries()].map(([key, list]) => {
    const res = list.map(tradeResult);
    const wins = res.filter((r) => r === "Win").length;
    const losses = res.filter((r) => r === "Loss").length;
    const decided = wins + losses;
    const net = list.reduce((s, t) => s + netPnl(t), 0);
    const rrs = list.map(actualRR).filter((r) => Number.isFinite(r) && r !== 0);
    const winNet = list.filter((t) => tradeResult(t) === "Win").reduce((s, t) => s + netPnl(t), 0);
    const lossNet = Math.abs(list.filter((t) => tradeResult(t) === "Loss").reduce((s, t) => s + netPnl(t), 0));
    const wr = decided ? wins / decided : 0;
    const avgWin = wins ? winNet / wins : 0, avgLoss = losses ? lossNet / losses : 0;
    return {
      key, sample: list.length, wins, losses,
      wr: Math.round(wr * 100),
      avgRR: rrs.length ? +(rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(2) : 0,
      net: Math.round(net),
      pf: lossNet > 0 ? +(winNet / lossNet).toFixed(2) : (winNet > 0 ? Infinity : 0),
      expectancy: Math.round(wr * avgWin - (1 - wr) * avgLoss),
    };
  });
  return rows.sort((a, b) => b.net - a.net);
}

export const byStrategy = (trades, o) => breakdown(trades, (t) => t.strategy || "—", o);
export const byPair = (trades, o) => breakdown(trades, (t) => t.instrument || "—", o);
export const bySession = (trades, o) => breakdown(trades, (t) => (t.sessions.length ? t.sessions : ["—"]), { ...o, multi: true });
export const byCondition = (trades, o) => breakdown(trades, (t) => t.conditions, { ...o, multi: true });
export const byConfluence = (trades, o) => breakdown(trades, (t) => t.confluences, { ...o, multi: true });
export const byMistake = (trades, o) => breakdown(trades, (t) => t.mistakes, { ...o, multi: true });

// Psychology correlation: for each pre-trade dimension, WR/net when the trader
// rated themselves high (≥7) vs low (≤4).
export function psychCorrelation(trades, accountId = "") {
  const cl = closedOf(trades, accountId);
  return PSYCH_BEFORE.map((dim) => {
    const rated = cl.filter((t) => Number.isFinite(+t.psychBefore?.[dim]));
    const hi = rated.filter((t) => t.psychBefore[dim] >= 7);
    const lo = rated.filter((t) => t.psychBefore[dim] <= 4);
    const wrOf = (list) => { const r = list.map(tradeResult); const w = r.filter((x) => x === "Win").length; const d = w + r.filter((x) => x === "Loss").length; return d ? Math.round((w / d) * 100) : null; };
    return { dim, sample: rated.length, hiWr: wrOf(hi), hiNet: Math.round(hi.reduce((s, t) => s + netPnl(t), 0)), loWr: wrOf(lo), loNet: Math.round(lo.reduce((s, t) => s + netPnl(t), 0)) };
  }).filter((x) => x.sample > 0);
}

// ── XP extractor — feeds the shared engine alongside legacy ict_trades ─
// One award per distinct trade (on its date) + a bonus when a structured
// review exists. Idempotent: derived purely from stored, immutable records.
export function tiTradeStats(rawTrades) {
  const trades = sanitizeTrades(rawTrades).filter((t) => !t.archived);
  let tradeCount = 0, reviewCount = 0;
  const byDate = {};
  for (const t of trades) {
    if (t.status !== "CLOSED") continue;
    tradeCount++;
    const hasReview = Object.keys(t.review).length > 0 || !!t.journalText || !!t.lessons;
    if (hasReview) reviewCount++;
    byDate[t.date] = byDate[t.date] || { count: 0, reviews: 0 };
    byDate[t.date].count++;
    if (hasReview) byDate[t.date].reviews++;
  }
  return { tradeCount, reviewCount, byDate };
}

// ── Lesson Library (Wave 2) ──────────────────────────────────────────
// Lessons turn trades into reusable knowledge. A lesson stores what was
// learned plus the context it applies to (strategy / pair / condition), a
// reinforcement count, and the trades it was drawn from — so the journal can
// surface the right lesson again the next time that context comes up.
export function sanitizeLessons(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const l of raw) {
    if (!l || typeof l !== "object" || typeof l.title !== "string" || !l.title.trim()) continue;
    out.push({
      id: l.id ? String(l.id) : uid("le"),
      title: l.title.trim().slice(0, 120),
      description: str(l.description, 2000),
      strategy: str(l.strategy, 80),
      pair: str(l.pair, 20),
      condition: str(l.condition, 40),
      dateLearned: dOf(l.dateLearned) || localDateStr(),
      reinforcementCount: Math.max(0, Math.round(num(l.reinforcementCount, 0))),
      linkedTrades: arrStr(l.linkedTrades, 40),
      createdAt: typeof l.createdAt === "string" ? l.createdAt : new Date().toISOString(),
      archived: bool(l.archived),
    });
  }
  return out;
}

export const newLesson = (patch = {}) => sanitizeLessons([{ id: uid("le"), title: "", dateLearned: localDateStr(), reinforcementCount: 0, linkedTrades: [], ...patch }])[0];

// Lessons relevant to a trade context — matched on strategy, pair or any
// condition, ranked by how strongly reinforced they are. Used in the form.
export function recommendLessons(rawLessons, { strategy = "", instrument = "", conditions = [] } = {}, limit = 3) {
  const conds = Array.isArray(conditions) ? conditions : [];
  return sanitizeLessons(rawLessons)
    .filter((l) => !l.archived)
    .map((l) => {
      let score = 0;
      if (l.strategy && l.strategy === strategy) score += 3;
      if (l.pair && l.pair === instrument) score += 2;
      if (l.condition && conds.includes(l.condition)) score += 2;
      return { l, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.l.reinforcementCount - a.l.reinforcementCount)
    .slice(0, limit)
    .map((x) => x.l);
}

// ── Comparative analytics (Wave 2) ───────────────────────────────────
// Filter closed trades to one value of a dimension, so the UI can run
// overallStats on two subsets and lay them side by side.
export function filterByDim(trades, dim, key) {
  const cl = sanitizeTrades(trades).filter((t) => t.status === "CLOSED" && t.exit !== "" && t.exit != null && !t.archived);
  const match = {
    strategy: (t) => (t.strategy || "—") === key,
    pair: (t) => (t.instrument || "—") === key,
    session: (t) => t.sessions.includes(key),
    account: (t) => t.accountId === key,
    month: (t) => t.date.slice(0, 7) === key,
  }[dim] || (() => false);
  return cl.filter(match);
}

// The distinct keys present for a dimension (for the comparator's pickers).
export function dimKeys(trades, dim, accounts = []) {
  const cl = sanitizeTrades(trades).filter((t) => t.status === "CLOSED" && t.exit !== "" && t.exit != null && !t.archived);
  const set = new Set();
  for (const t of cl) {
    if (dim === "strategy") set.add(t.strategy || "—");
    else if (dim === "pair") set.add(t.instrument || "—");
    else if (dim === "session") t.sessions.forEach((s) => set.add(s));
    else if (dim === "account") set.add(t.accountId);
    else if (dim === "month") set.add(t.date.slice(0, 7));
  }
  const keys = [...set].filter(Boolean);
  if (dim === "account") return keys.map((id) => ({ key: id, label: accounts.find((a) => a.id === id)?.name || id }));
  return keys.sort().map((k) => ({ key: k, label: k }));
}

// ── Evolution — trader growth month over month (Wave 2) ──────────────
// Discipline reads from the structured-review ratings (Discipline / Rule
// Adherence / Emotional Control) so the chart tracks the trader, not just
// the P&L. Returns chronological months that actually have closed trades.
export function evolutionSeries(trades, accountId = "") {
  const cl = sanitizeTrades(trades).filter((t) => t.status === "CLOSED" && t.exit !== "" && t.exit != null && !t.archived && (!accountId || t.accountId === accountId));
  const byMonth = new Map();
  for (const t of cl) { const m = t.date.slice(0, 7); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(t); }
  const DISC = ["Discipline", "Rule Adherence", "Emotional Control"];
  return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, list]) => {
    const o = overallStats(list, "");
    const dd = equityCurve(list, 0, "").maxDD;
    const discVals = list.map((t) => { const vals = DISC.filter((k) => Number.isFinite(+t.review?.[k])).map((k) => t.review[k]); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; }).filter((v) => v != null);
    return {
      month, sample: list.length, wr: o.wr, avgRR: o.avgRR, pf: o.profitFactor,
      expectancy: o.expectancy, net: o.net, maxDD: dd,
      discipline: discVals.length ? +(discVals.reduce((a, b) => a + b, 0) / discVals.length).toFixed(1) : null,
    };
  }).slice(-12);
}

// ── Mistake Intelligence (Wave 2) ────────────────────────────────────
// Frequency, cost, and whether each mistake is happening less over time
// (second half of the record vs the first). Ranked costliest-first.
export function mistakeIntelligence(trades, accountId = "") {
  const cl = sanitizeTrades(trades).filter((t) => t.status === "CLOSED" && t.exit !== "" && t.exit != null && !t.archived && (!accountId || t.accountId === accountId))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const half = Math.floor(cl.length / 2);
  const older = cl.slice(0, half), recent = cl.slice(half);
  const rate = (list, m) => (list.length ? list.filter((t) => t.mistakes.includes(m)).length / list.length : 0);
  const names = [...new Set(cl.flatMap((t) => t.mistakes))].filter(Boolean);
  const rows = names.map((m) => {
    const tagged = cl.filter((t) => t.mistakes.includes(m));
    const impact = tagged.reduce((s, t) => s + netPnl(t), 0);
    const olderRate = rate(older, m), recentRate = rate(recent, m);
    return {
      name: m, count: tagged.length, impact: Math.round(impact),
      avgImpact: Math.round(impact / tagged.length),
      olderRate: Math.round(olderRate * 100), recentRate: Math.round(recentRate * 100),
      improving: cl.length >= 6 ? recentRate < olderRate : null,
    };
  });
  return rows.sort((a, b) => a.impact - b.impact);
}

// ── Doctrine adapter ─────────────────────────────────────────────────
// Project new-journal trades into the legacy trade shape the Firm's Doctrine
// engines (firm.js scalingGate, helpers.js tradingMetrics/getStats/periodSummary)
// consume, so the prop-firm progression runs off real logged trades instead of
// the retired ict_trades store. `accountIds` (a Set) scopes to the real-money
// accounts — demo/backtest trades never inflate the funded-account doctrine.
// Checklist adherence is derived from each trade's own checklist array.
export function tiToLegacyTrades(rawTrades, accountIds = null) {
  const RES = { Win: "WIN", Loss: "LOSS", BE: "BE" };
  return sanitizeTrades(rawTrades)
    .filter((t) => !t.archived && (accountIds == null || accountIds.has(t.accountId)))
    .map((t) => {
      const closed = t.status === "CLOSED" && t.exit !== "" && t.exit != null;
      return {
        id: t.id,
        date: t.date,
        status: closed ? "CLOSED" : "OPEN",
        archived: false,
        outcome: closed ? (RES[tradeResult(t)] || "BE") : "",
        pnl: closed ? netPnl(t) : 0,
        actualRR: closed ? actualRR(t) : null,
        riskAmount: riskAmount(t),
        checklistTotal: t.checklist.length,
        checklistScore: t.checklist.filter((c) => c.done).length,
      };
    });
}
