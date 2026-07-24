// ── Wealth trajectory — monthly snapshots of where the money stands ──
// Finance otherwise only ever knows the present. This captures a light
// month-stamped snapshot of the top-line wealth figures so the module can
// show a trajectory — net worth over time, savings-rate and passive-income
// trends, and how fast the freedom line is approaching. Snapshots are built
// entirely from the existing rollups (financeSummary + freedomMath), never
// re-deriving wealth logic, and are captured idempotently on load (the same
// read-time-normalise pattern as habitEngine.migrateHabits and
// useConsistencyStart) — never a destructive rewrite.
import { useEffect } from "react";
import { useStorageState } from "../../shared/useStorageState.js";
import { localDateStr } from "../../shared/dates.js";
import { financeSummary } from "./summary.js";
import { incomeAnalytics } from "./income.js";
import { freedomMath } from "../../shared/freedom.js";

export const SNAPSHOTS_KEY = "finance_snapshots";
const YM_RE = /^\d{4}-\d{2}$/;
const nowYm = () => localDateStr().slice(0, 7);
const num = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const pct = (v) => (Number.isFinite(+v) ? Math.max(0, Math.min(100, Math.round(+v))) : 0);

// Drop anything that isn't a real snapshot; keep one per month (last wins),
// sorted oldest→newest, capped so history can't grow without bound.
export function sanitizeSnapshots(raw, cap = 180) {
  if (!Array.isArray(raw)) return [];
  const byYm = new Map();
  for (const s of raw) {
    if (!s || typeof s !== "object" || !YM_RE.test(s.ym)) continue;
    byYm.set(s.ym, {
      ym: s.ym,
      date: typeof s.date === "string" ? s.date : `${s.ym}-01`,
      netWorth: num(s.netWorth), liquid: num(s.liquid), invested: num(s.invested), debt: num(s.debt),
      monthlyPassive: num(s.monthlyPassive), savingsRate: pct(s.savingsRate),
      freedomPct: pct(s.freedomPct), capitalPct: pct(s.capitalPct),
      yearsOut: s.yearsOut == null ? null : (Number.isFinite(+s.yearsOut) ? +s.yearsOut : null),
    });
  }
  return [...byYm.values()].sort((a, b) => a.ym.localeCompare(b.ym)).slice(-cap);
}

// Build the current-month snapshot from live state — pure, reuses the rollups.
export function buildSnapshot(state, firmConfig) {
  const fin = financeSummary(state);
  const freedom = freedomMath(state, firmConfig);
  const inc = incomeAnalytics(Array.isArray(state?.income) ? state.income : []);
  const monthlyIncome = inc.thisMonth || inc.avgMonthly || 0;
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - fin.totalSpent) / monthlyIncome) * 100 : 0;
  return {
    ym: nowYm(), date: localDateStr(),
    netWorth: num(fin.personalNetWorth), liquid: num(fin.totalLiquid), invested: num(fin.totalInvested),
    debt: num(fin.personalDebt), monthlyPassive: num(fin.monthlyPassive), savingsRate: pct(savingsRate),
    freedomPct: pct(freedom.freedomPct), capitalPct: pct(freedom.capitalPct), yearsOut: freedom.yearsOut,
  };
}

// Two snapshots differ "materially" if any top-line figure moved — used to
// decide whether to re-capture the current month rather than rewrite on every
// render.
function changed(a, b) {
  if (!a) return true;
  return a.netWorth !== b.netWorth || a.invested !== b.invested || a.liquid !== b.liquid
    || a.debt !== b.debt || a.monthlyPassive !== b.monthlyPassive || a.savingsRate !== b.savingsRate;
}

export function upsertSnapshot(list, snap) {
  const rest = sanitizeSnapshots(list).filter((s) => s.ym !== snap.ym);
  return sanitizeSnapshots([...rest, snap]);
}

// Hook: keeps this month's snapshot current, idempotently. Returns the
// sanitized history and a manual capture (identical to the auto-capture).
export function useFinanceSnapshots(state, firmConfig) {
  const [raw, setRaw, loaded] = useStorageState(SNAPSHOTS_KEY, []);
  const snapshots = sanitizeSnapshots(raw);

  useEffect(() => {
    if (!loaded) return;
    const fresh = buildSnapshot(state, firmConfig);
    // Skip the empty opening snapshot so a brand-new user with zero data
    // doesn't seed a flat line before they've entered anything.
    if (snapshots.length === 0 && fresh.netWorth === 0 && fresh.invested === 0 && fresh.liquid === 0) return;
    const current = snapshots.find((s) => s.ym === fresh.ym);
    if (changed(current, fresh)) setRaw(upsertSnapshot(raw, fresh));
  }, [loaded, state, firmConfig]); // eslint-disable-line

  const captureNow = () => setRaw((prev) => upsertSnapshot(prev, buildSnapshot(state, firmConfig)));
  return { snapshots, captureNow, loaded };
}

// ── Trajectory helpers (pure) ───────────────────────────────────────
const monthLabel = (ymStr) => {
  if (!YM_RE.test(ymStr || "")) return ymStr || "";
  const [y, m] = ymStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
};

// One chart-ready row per snapshot, with every series pre-labelled.
export function trajectorySeries(list) {
  return sanitizeSnapshots(list).map((s) => ({
    label: monthLabel(s.ym), ym: s.ym,
    netWorth: s.netWorth, invested: s.invested, liquid: s.liquid,
    passive: s.monthlyPassive, savingsRate: s.savingsRate,
    freedomPct: s.freedomPct, yearsOut: s.yearsOut,
  }));
}

// First→last deltas plus the freedom-velocity read (is the line getting
// closer, and how fast). `null` fields where there isn't enough history.
export function trajectoryStats(list) {
  const s = sanitizeSnapshots(list);
  if (!s.length) return { count: 0, first: null, latest: null, netWorthDelta: null, passiveDelta: null, savingsDelta: null, velocity: null, monthsTracked: 0 };
  const first = s[0], latest = s[s.length - 1];
  const prev = s.length > 1 ? s[s.length - 2] : null;
  // Velocity: change in "years to freedom" over the last step — negative means
  // the finish line is getting closer (good).
  let velocity = null;
  if (prev && prev.yearsOut != null && latest.yearsOut != null) velocity = +(latest.yearsOut - prev.yearsOut).toFixed(1);
  return {
    count: s.length, first, latest, prev,
    netWorthDelta: latest.netWorth - first.netWorth,
    netWorthMoM: prev ? latest.netWorth - prev.netWorth : null,
    passiveDelta: latest.monthlyPassive - first.monthlyPassive,
    savingsDelta: prev ? latest.savingsRate - prev.savingsRate : null,
    velocity,
    monthsTracked: s.length,
  };
}
