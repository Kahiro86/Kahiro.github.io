// ── The Firm — doctrine engine (Wave 8) ──────────────────────────────
// The numeric/structural spine of "The One-Man Trading Firm": a Vault that's
// a one-way door, a Fleet Formula that splits every withdrawal, and a scaling
// gate that only ever earns the right to a second account through proof —
// never the calendar, and never partial credit carried through a bad month.
// Reads across trading + finance + life; writes nothing on its own (the UI
// layer owns the stores). Pure functions only.
import { localDateStr } from "./dates.js";
import { sanitizeReviews, periodSummary } from "../modules/trading/reviews.js";

// ── Withdrawals ───────────────────────────────────────────────────────
// The Fleet Formula ledger: every prop withdrawal, split on the way in.
export function sanitizeWithdrawals(raw) {
  return (Array.isArray(raw) ? raw : []).filter((w) => {
    if (!w || typeof w !== "object" || !w.id || typeof w.date !== "string") return false;
    if (!Number.isFinite(+w.amount) || +w.amount <= 0) return false;
    const s = w.split;
    return s && typeof s === "object" && ["fleet", "vault", "book", "life"].every((k) => Number.isFinite(+s[k]));
  }).map((w) => ({
    id: w.id, date: w.date, amount: +w.amount,
    split: { fleet: +w.split.fleet, vault: +w.split.vault, book: +w.split.book, life: +w.split.life },
  }));
}

export const newWithdrawal = (amount, split) => ({
  id: `wd${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  date: localDateStr(),
  amount: +amount || 0,
  split,
});

export const withdrawalsTotal = (list) => sanitizeWithdrawals(list).reduce((s, w) => s + w.amount, 0);

// ── The Fleet Formula ─────────────────────────────────────────────────
export const DEFAULT_FORMULA = { fleet: 40, vault: 30, book: 20, life: 10 };

export function sanitizeFormula(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FORMULA };
  const out = {};
  for (const k of ["fleet", "vault", "book", "life"]) out[k] = Number.isFinite(+raw[k]) ? Math.max(0, +raw[k]) : DEFAULT_FORMULA[k];
  return out;
}

export function fleetFormulaSplit(amount, formula = DEFAULT_FORMULA) {
  const f = sanitizeFormula(formula);
  const total = f.fleet + f.vault + f.book + f.life || 100;
  const amt = +amount || 0;
  return {
    fleet: Math.round((amt * f.fleet) / total),
    vault: Math.round((amt * f.vault) / total),
    book: Math.round((amt * f.book) / total),
    life: Math.round((amt * f.life) / total),
  };
}

// ── Firm config ───────────────────────────────────────────────────────
// Every number here is a manual constant made editable, so later reweighting
// (the manual shifts the formula toward sovereignty in Year 4) is a setting,
// not a redeploy. `accounts` lets the Fleet's locked cards be named/sized
// before a second account is ever funded.
export const DEFAULT_FIRM_CONFIG = {
  riskPerTradePct: 0.5,
  aggregateExposureCap: 1.5,
  fleetFormula: { ...DEFAULT_FORMULA },
  vaultTargetKsh: 15000000,
  accounts: [{ id: 2, firm: "", size: 0 }, { id: 3, firm: "", size: 0 }],
};

export function sanitizeFirmConfig(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);
  const accounts = Array.isArray(src.accounts)
    ? src.accounts.filter((a) => a && typeof a === "object").map((a, i) => ({
        id: Number.isFinite(+a.id) ? +a.id : i + 2,
        firm: typeof a.firm === "string" ? a.firm.slice(0, 40) : "",
        size: Math.max(0, num(a.size, 0)),
      }))
    : DEFAULT_FIRM_CONFIG.accounts.map((a) => ({ ...a }));
  return {
    riskPerTradePct: num(src.riskPerTradePct, DEFAULT_FIRM_CONFIG.riskPerTradePct),
    aggregateExposureCap: num(src.aggregateExposureCap, DEFAULT_FIRM_CONFIG.aggregateExposureCap),
    fleetFormula: sanitizeFormula(src.fleetFormula),
    vaultTargetKsh: Math.max(1, num(src.vaultTargetKsh, DEFAULT_FIRM_CONFIG.vaultTargetKsh)),
    accounts,
  };
}

export function sanitizeCovenant(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return { signedAt: typeof src.signedAt === "string" ? src.signedAt : null };
}

// ── The Vault ─────────────────────────────────────────────────────────
// Sum of every money-market fund on the books — the one-way door.
export function vaultBalance(financeState) {
  const mmfs = Array.isArray(financeState?.mmfs) ? financeState.mmfs : [];
  return mmfs.reduce((s, m) => s + (Number.isFinite(+m?.balance) ? +m.balance : 0), 0);
}

// ── The scaling gate ──────────────────────────────────────────────────
// "3 consecutive clean withdrawal months" — clean means a written monthly
// review with zero checklist breaches (adherence === 100) AND at least one
// withdrawal recorded that month. A month that fails either test doesn't just
// fail to add — it resets the count, because the fleet grows on proof and
// a breach anywhere means the count starts over, not "minus one." Adherence
// needs real trades, so this takes `trades` alongside reviews/withdrawals
// rather than importing the trading store directly — firm.js stays a pure
// function of its inputs.
export function scalingGate(trades, reviews, withdrawals, need = 3, today = localDateStr()) {
  const rs = sanitizeReviews(reviews);
  const wds = sanitizeWithdrawals(withdrawals);
  const monthLabel = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 15).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  // Walk back over the last `need` full months (the current month is still in
  // progress and can't be judged), most recent first. The streak is anchored
  // at the most recent full month: the count of consecutive clean months from
  // the top, stopping at the first that isn't clean — that month is where the
  // count resets. Not-yet-reviewed and breached both stop the streak; the
  // months array carries the detail so the UI can tell the two apart.
  const months = [];
  let have = 0;
  let streakBroken = false;
  let resetAt = null;
  for (let i = 1; i <= need; i++) {
    const d = new Date(+today.slice(0, 4), +today.slice(5, 7) - 1 - i, 15);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const reviewed = rs.some((r) => r.kind === "monthly" && r.period === ym);
    const adherence = reviewed ? periodSummary(trades, "monthly", ym).adherence : null;
    const withdrew = wds.some((w) => (w.date || "").slice(0, 7) === ym);
    const clean = reviewed && adherence === 100 && withdrew;
    months.unshift({ ym, label: monthLabel(ym), clean, reviewed, withdrew, adherence });
    if (!streakBroken) {
      if (clean) have++;
      else { streakBroken = true; resetAt = { ym, label: monthLabel(ym), reviewed, withdrew, adherence }; }
    }
  }
  const met = have >= need;
  return { have, need, met, months, resetAt: met ? null : resetAt };
}
