// ── Monthly overhead — standing priority signals ─────────────────────
// Reads the same monthly_overhead target and the same actual spend the today
// surface already uses; adds three derived signals, all pure: how far into the
// ceiling you are, a linear month-end projection, and which alert checkpoints
// the spend has crossed (fire-once-per-month). No parallel tracking.
import { localDateStr } from "./dates.js";

export const ALERTS_KEY = "overhead_alerts";     // { "YYYY-MM": [50,80,110,…] } — fired this month
export const ARCHIVE_KEY = "overhead_archive";   // [{ month, target, actual, fired:[…] }]
export const OVERHEAD_CFG_KEY = "overhead_cfg";  // { checkpoints:[50,80,100] }
export const DEFAULT_CHECKPOINTS = [50, 80, 100];

export const monthKey = (ds = localDateStr()) => ds.slice(0, 7);
const daysInMonthOf = (ds) => { const [y, m] = ds.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const dayOfMonthOf = (ds) => +ds.slice(8, 10);

// Configured checkpoints (1–100), de-duped and sorted; falls back to default.
export function getCheckpoints(cfg) {
  const raw = Array.isArray(cfg?.checkpoints) ? cfg.checkpoints.map((n) => Math.round(+n || 0)).filter((n) => n > 0 && n <= 100) : [];
  const uniq = [...new Set(raw)].sort((a, b) => a - b);
  return uniq.length ? uniq : DEFAULT_CHECKPOINTS;
}

// Every threshold `actual` has reached: the configured ones up to 100, then
// overage steps (110, 120, …) once past the ceiling.
export function crossedLevels(target, actual, cfg) {
  if (!(target > 0) || !(actual > 0)) return [];
  const pct = (actual / target) * 100;
  const base = getCheckpoints(cfg).filter((c) => pct >= c);
  const over = [];
  if (pct >= 110) for (let l = 110; l <= Math.floor(pct / 10) * 10 && l <= 1000; l += 10) over.push(l);
  return [...new Set([...base, ...over])].sort((a, b) => a - b);
}

// Linear month-end projection from spend-to-date. Meaningful when `actual` is
// cumulative month-to-date spend.
export function projection(target, actual, ds = localDateStr()) {
  const dim = daysInMonthOf(ds), dom = dayOfMonthOf(ds);
  if (dom <= 0 || !(actual > 0)) return null;
  const proj = Math.round((actual / dom) * dim);
  return { proj, onPace: target > 0 && proj > target, daysLeft: dim - dom };
}

export function overheadStatus(target, actual, cfg, ds = localDateStr()) {
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
  return { target, actual, pct, over: target > 0 && actual > target, levels: crossedLevels(target, actual, cfg), projection: projection(target, actual, ds) };
}

// Crossed levels not yet fired this month (each fires once).
export function newAlerts(firedMap, target, actual, cfg, ds = localDateStr()) {
  const fired = new Set(Array.isArray(firedMap?.[monthKey(ds)]) ? firedMap[monthKey(ds)] : []);
  return crossedLevels(target, actual, cfg).filter((l) => !fired.has(l));
}

export function recordAlerts(firedMap, levels, ds = localDateStr()) {
  const mk = monthKey(ds);
  const base = firedMap && typeof firedMap === "object" && !Array.isArray(firedMap) ? firedMap : {};
  const cur = new Set(Array.isArray(base[mk]) ? base[mk] : []);
  levels.forEach((l) => cur.add(l));
  return { ...base, [mk]: [...cur].sort((a, b) => a - b) };
}

// Human label for an alert level (100 = ceiling reached, >100 = overage).
export const levelLabel = (l) => (l < 100 ? `${l}% of the overhead ceiling` : l === 100 ? "the overhead ceiling reached" : `${l - 100}% over the overhead ceiling`);
