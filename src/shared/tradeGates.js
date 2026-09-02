// ── Trading enforcement engine (the rules layer) ─────────────────────
// Turns the journal from a tracker into an enforcement layer. Pure,
// memo-friendly functions that decide whether logging a trade is ALLOWED
// right now, and why not. Every block here is a real disable in the UI, not
// a dismissible warning. Threshold changes take effect the following day —
// a staged `pending` config applies from its date, never mid-session.
//
// Stores:
//   trade_gates  — config (caps, cooldown, sleep thresholds, checklist,
//                  currency toggle, pending next-day changes)
//   trade_sleep  — { [ds]: hoursSlept }  (morning sleep gate input)
// Trades come from ti_trades; R-multiple is actualRR() from tradingIntel.
import { localDateStr } from "./dates.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const tomorrowStr = (ds = localDateStr()) => {
  const [y, m, d] = ds.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + 1));
};

// Default pre-trade checklist — the owner's process rules, all editable.
export const DEFAULT_CHECKLIST = [
  "HTF bias confirmed (daily / 4H aligned)",
  "Killzone / session timing valid",
  "Liquidity + draw on liquidity mapped",
  "Entry model present (FVG / OB / MSS)",
  "Risk ≤ plan, stop placed before entry",
  "Rested and calm — not revenge trading",
];

export const DEFAULT_GATES = {
  dailyCap: 3,
  cooldownMin: 30,          // post-loss lockout window
  sleepThreshold: 6.5,      // below → NO-TRADE (hard block)
  halfSizeThreshold: 7.5,   // between threshold and this → HALF SIZE (flag)
  checklist: [...DEFAULT_CHECKLIST],
  showCurrency: false,      // R-multiple is the default unit; currency opt-in
  pending: null,            // { dailyCap, cooldownMin, sleepThreshold, halfSizeThreshold, from }
  updatedAt: null,
};

export function sanitizeGates(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const num = (v, d, lo, hi) => (Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : d);
  const list = Array.isArray(p.checklist)
    ? p.checklist.filter((x) => typeof x === "string" && x.trim()).map((x) => x.slice(0, 120)).slice(0, 20)
    : [...DEFAULT_CHECKLIST];
  const pend = p.pending && typeof p.pending === "object" && DATE_RE.test(p.pending.from) ? {
    dailyCap: num(p.pending.dailyCap, DEFAULT_GATES.dailyCap, 1, 50),
    cooldownMin: num(p.pending.cooldownMin, DEFAULT_GATES.cooldownMin, 0, 1440),
    sleepThreshold: num(p.pending.sleepThreshold, DEFAULT_GATES.sleepThreshold, 0, 12),
    halfSizeThreshold: num(p.pending.halfSizeThreshold, DEFAULT_GATES.halfSizeThreshold, 0, 12),
    from: p.pending.from,
  } : null;
  return {
    dailyCap: num(p.dailyCap, DEFAULT_GATES.dailyCap, 1, 50),
    cooldownMin: num(p.cooldownMin, DEFAULT_GATES.cooldownMin, 0, 1440),
    sleepThreshold: num(p.sleepThreshold, DEFAULT_GATES.sleepThreshold, 0, 12),
    halfSizeThreshold: num(p.halfSizeThreshold, DEFAULT_GATES.halfSizeThreshold, 0, 12),
    checklist: list.length ? list : [...DEFAULT_CHECKLIST],
    showCurrency: !!p.showCurrency,
    pending: pend,
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null,
  };
}

export function sanitizeSleep(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [d, h] of Object.entries(raw)) if (DATE_RE.test(d) && Number.isFinite(+h) && +h >= 0 && +h <= 24) out[d] = +h;
  return out;
}

// The thresholds in force on `ds` — a staged edit only applies from its date.
export function effectiveGates(cfg, ds = localDateStr()) {
  if (cfg.pending && ds >= cfg.pending.from) {
    const { dailyCap, cooldownMin, sleepThreshold, halfSizeThreshold } = cfg.pending;
    return { ...cfg, dailyCap, cooldownMin, sleepThreshold, halfSizeThreshold, pending: null };
  }
  return cfg;
}

const tradeDay = (t) => (typeof t?.createdAt === "string" ? t.createdAt.slice(0, 10) : (t?.date || "").slice(0, 10));

// Trades logged today (by when they were entered into the journal).
export const todayTradeCount = (trades, ds = localDateStr()) =>
  (Array.isArray(trades) ? trades : []).filter((t) => t && tradeDay(t) === ds).length;

// Milliseconds remaining on the post-loss cooldown, 0 if none. A "loss" is a
// closed trade whose net P&L is negative; the window runs from when it was
// logged (createdAt), so the discipline is on the logging act.
export function cooldownRemainingMs(trades, cfg, netPnlOf, now = Date.now()) {
  if (!cfg.cooldownMin) return 0;
  let latest = 0;
  for (const t of Array.isArray(trades) ? trades : []) {
    if (!t || t.status !== "CLOSED") continue;
    if (netPnlOf(t) >= 0) continue;
    const at = t.createdAt ? new Date(t.createdAt).getTime() : 0;
    if (at > latest) latest = at;
  }
  if (!latest) return 0;
  return Math.max(0, cfg.cooldownMin * 60000 - (now - latest));
}

export function sleepFlag(hours, cfg) {
  if (!Number.isFinite(+hours)) return null;       // no input yet → no flag
  if (+hours < cfg.sleepThreshold) return "NO-TRADE";
  if (+hours < cfg.halfSizeThreshold) return "HALF SIZE";
  return null;
}

// The single verdict the UI reads. `checklistDone` is this session's flag.
// Returns real blocks (each disables logging) and non-blocking flags.
export function evalGates({ trades, cfg, sleepHours, checklistDone, netPnlOf, now = Date.now(), ds = localDateStr() }) {
  const g = effectiveGates(sanitizeGates(cfg), ds);
  const count = todayTradeCount(trades, ds);
  const cooldownMs = cooldownRemainingMs(trades, g, netPnlOf, now);
  const sflag = sleepFlag(sleepHours, g);

  const blocks = [];
  if (sflag === "NO-TRADE") blocks.push({ id: "sleep", reason: `NO-TRADE — ${(+sleepHours).toFixed(1)}h sleep is below the ${g.sleepThreshold}h floor.`, lifts: "Tomorrow, with enough rest." });
  if (count >= g.dailyCap) blocks.push({ id: "cap", reason: `Daily cap reached — ${count}/${g.dailyCap} trades logged today.`, lifts: "Midnight (local)." });
  if (cooldownMs > 0) blocks.push({ id: "cooldown", reason: `Post-loss cooldown — ${Math.ceil(cooldownMs / 60000)} min left.`, lifts: `In ${Math.ceil(cooldownMs / 60000)} min.` });
  if (!checklistDone) blocks.push({ id: "checklist", reason: "Complete the pre-trade checklist to unlock logging.", lifts: "When the checklist is done." });

  const flags = [];
  if (sflag === "HALF SIZE") flags.push({ id: "halfsize", reason: `HALF SIZE — ${(+sleepHours).toFixed(1)}h sleep is under the ${g.halfSizeThreshold}h mark.` });

  return {
    cfg: g, canLog: blocks.length === 0, blocks, flags,
    count, cap: g.dailyCap, cooldownMs, sleep: sflag,
  };
}

// Threshold edits stage for the next day; a lowering isn't special here (any
// change waits until tomorrow so no rule can be softened mid-session).
export function proposeGateChange(cfg, next, today = localDateStr()) {
  const c = sanitizeGates(cfg);
  const from = tomorrowStr(today);
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);
  return {
    ...c,
    pending: {
      dailyCap: num(next.dailyCap, c.dailyCap),
      cooldownMin: num(next.cooldownMin, c.cooldownMin),
      sleepThreshold: num(next.sleepThreshold, c.sleepThreshold),
      halfSizeThreshold: num(next.halfSizeThreshold, c.halfSizeThreshold),
      from,
    },
    updatedAt: new Date().toISOString(),
    from,
  };
}
