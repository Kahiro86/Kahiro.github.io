// ── God Mode — one continuous 0–100 discipline score ────────────────
// Not a manual toggle and not a two/three-state label: a single read-out of
// the existing rules engine. Every gate already exposes a queryable status
// (trade cap/cooldown/sleep, nutrition floors/ceiling, the daily checklist,
// recurring pings, the weekly focus and monthly overhead structures). This
// file only *reads* those — it never re-implements gate logic — and folds
// them into one weighted score.
//
//   • Each gate is BINARY: met (its full weight) or not (zero). No partial
//     credit, no soft rounding that inflates the number.
//   • Gates are WEIGHTED, not equal (sleep/trading matter more than a ping).
//   • The score is the weighted sum of passed gates over the weight of all
//     active gates — so over-performing one category can never paper over a
//     real miss in another (each gate is capped at its own weight).
//   • An unset weekly-focus or monthly-overhead structure scores 0, not
//     "not applicable" — silence is a missed structural step, not neutral.
import { localDateStr } from "./dates.js";

// Default gate weights (percent, sum 100). Editable in Settings.
//   trading (cap+cooldown) 25 · sleep 20 · nutrition (floor+ceil) 20 ·
//   checklist 15 · weekly focus 10 · monthly overhead 10 · pings 0
export const DEFAULT_GATE_WEIGHTS = {
  checklist: 15, sleep: 20, nutriFloor: 14, nutriCeil: 6,
  cap: 13, cooldown: 12, weeklyFocus: 10, monthlyOverhead: 10, pings: 0,
};
export const GATE_LABEL = {
  checklist: "Daily checklist", sleep: "Sleep gate", nutriFloor: "Nutrition floor",
  nutriCeil: "Nutrition ceiling", cap: "Trade cap", cooldown: "Post-loss cooldown",
  weeklyFocus: "Weekly focus", monthlyOverhead: "Monthly overhead", pings: "Recurring pings",
};

// Thresholds: what counts as a genuinely strong day vs merely acceptable.
export const DEFAULT_MODE_CFG = {
  checklistCutoffHour: 21,
  weights: { ...DEFAULT_GATE_WEIGHTS },
  strongThreshold: 90, // ≥ this = "full structure" (streak-worthy)
  okThreshold: 70,     // ≥ this = "partial"; below = "low"
};

export function sanitizeModeCfg(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const clamp = (v, d, lo, hi) => { const x = Math.round(+v); return Number.isFinite(x) && x >= lo && x <= hi ? x : d; };
  const w = r.weights && typeof r.weights === "object" && !Array.isArray(r.weights) ? r.weights : {};
  const weights = {};
  for (const k of Object.keys(DEFAULT_GATE_WEIGHTS)) weights[k] = clamp(w[k], DEFAULT_GATE_WEIGHTS[k], 0, 100);
  return {
    checklistCutoffHour: clamp(r.checklistCutoffHour, 21, 0, 23),
    weights,
    strongThreshold: clamp(r.strongThreshold, 90, 50, 100),
    okThreshold: clamp(r.okThreshold, 70, 1, 99),
  };
}

// ── Per-gate status helpers (pure) ───────────────────────────────────
// Each returns "pass" | "fail" | "incomplete" | "off" (not applicable).
// For the binary score, only "pass" earns weight — "incomplete" (still time)
// and "fail" both earn nothing, so the number climbs as gates truly close.
export const sleepStatus = (sflag, entered) => (!entered ? "incomplete" : sflag === "NO-TRADE" ? "fail" : "pass");
export const cooldownStatus = (cooldownMs) => (cooldownMs > 0 ? "fail" : "pass");
export const capStatus = (count, cap) => (count > cap ? "fail" : "pass");
export const pingsStatus = (anyDue) => (anyDue ? "fail" : "pass");

export function checklistStatus(coreCount, coreDone, cutoffPassed) {
  if (coreCount <= 0) return "off";          // no core items defined — nothing to hold
  if (coreDone >= coreCount) return "pass";
  return cutoffPassed ? "fail" : "incomplete"; // grace until the cutoff hour
}

export function nutritionFloorStatus(hardActive, floorsMet, dayClosed) {
  if (!hardActive) return "off";
  if (floorsMet) return "pass";
  return dayClosed ? "fail" : "incomplete";   // still time while the day is open
}

export function nutritionCeilStatus(hardActive, underCeil) {
  if (!hardActive) return "off";
  return underCeil ? "pass" : "fail";          // exceeding the ceiling is immediate
}

// Weekly focus + monthly overhead are STRUCTURAL — always active. An unset
// goal scores 0 (decay), never "off": leaving the structure blank is itself a
// missed step. When set, they pass only when genuinely on track.
export const weeklyFocusStatus = (isSet, checkedIn) => (!isSet ? "fail" : checkedIn ? "pass" : "incomplete");
export const overheadStatus = (isSet, onPace) => (!isSet ? "fail" : onPace ? "pass" : "fail");

export const cutoffPassed = (cutoffHour, now = new Date()) => now.getHours() >= cutoffHour;

// ── The one score ────────────────────────────────────────────────────
// `statuses` is [{ key, label, status }]. "off" gates are excluded entirely
// (a feature you don't use neither helps nor hurts). Weighted binary: earned
// weight over active weight, ×100. Returns null when nothing is active.
export function godScore(statuses, cfg) {
  const weights = sanitizeModeCfg(cfg).weights;
  const active = (Array.isArray(statuses) ? statuses : []).filter((s) => s && s.status !== "off");
  let earned = 0, total = 0;
  for (const s of active) {
    const w = +weights[s.key] || 0;
    total += w;
    if (s.status === "pass") earned += w; // binary — pending/fail earn nothing
  }
  if (total <= 0) return null;
  return Math.round((earned / total) * 100);
}

// The score cost of each not-yet-passed gate — its weight as a share of the
// active total, so the detail view can show "Sleep gate · −20%".
export function gateImpacts(statuses, cfg) {
  const weights = sanitizeModeCfg(cfg).weights;
  const active = (Array.isArray(statuses) ? statuses : []).filter((s) => s && s.status !== "off");
  const total = active.reduce((sum, s) => sum + (+weights[s.key] || 0), 0);
  if (total <= 0) return {};
  const out = {};
  for (const s of active) out[s.key] = Math.round(((+weights[s.key] || 0) / total) * 100);
  return out;
}

// Which band a score falls in — drives colour + honest "partial vs full"
// language. Only "full" days count toward any streak-style framing.
export function dayTier(score, cfg) {
  if (score == null) return null;
  const c = sanitizeModeCfg(cfg);
  if (score >= c.strongThreshold) return "full";
  if (score >= c.okThreshold) return "partial";
  return "low";
}
export const TIER_META = {
  full: { label: "Full structure", tone: "gold" },
  partial: { label: "Partial", tone: "neutral" },
  low: { label: "Low", tone: "heavy" },
};
// Gold intensity scales with the score (one colour logic, no separate states).
export function scoreColor(score) {
  if (score == null) return "#5b5048";
  const t = Math.max(0, Math.min(1, score / 100));
  // dim brown → full gold as the score climbs.
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  const r = lerp(0x5b, 0xF0), g = lerp(0x50, 0xB4), b = lerp(0x48, 0x29);
  return `rgb(${r},${g},${b})`;
}

// ── Engagement + history ─────────────────────────────────────────────
// Did the day see real engagement? Structural/trivial gates pass on a day the
// owner never touched the app, so only an actual fail or a completed
// actionable gate marks a day worth recording.
const ACTIONABLE = new Set(["sleep", "checklist", "nutriFloor", "nutriCeil", "weeklyFocus", "monthlyOverhead"]);
export function dayEngaged(statuses) {
  return (Array.isArray(statuses) ? statuses : []).some(
    (s) => s.status === "fail" || (ACTIONABLE.has(s.key) && s.status === "pass")
  );
}

// History stores one final SCORE per closed day. Old three-state records are
// backfilled to a representative score so past history isn't lost.
const LEGACY_SCORE = { god: 100, normal: 60, hell: 20 };
export function sanitizeModeHistory(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") continue;
    let score = Number.isFinite(+v.score) ? Math.max(0, Math.min(100, Math.round(+v.score))) : null;
    if (score == null && typeof v.mode === "string" && LEGACY_SCORE[v.mode] != null) score = LEGACY_SCORE[v.mode];
    if (score == null) continue;
    out[k] = { score };
  }
  return out;
}

// Commit a past day's final score exactly once. Pure.
export function commitClosedDay(history, ds, score) {
  const h = sanitizeModeHistory(history);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) || h[ds] || score == null) return h;
  return { ...h, [ds]: { score: Math.max(0, Math.min(100, Math.round(score))) } };
}

// Rolling average of the last `days` days' scores (history + today's live
// score substituted for today). This is what Journals shows by default, so a
// single clean day never visually overwrites a shaky week.
export function weekAverage(history, todayScore, ds = localDateStr(), days = 7) {
  const h = sanitizeModeHistory(history);
  const vals = [];
  const base = new Date(`${ds}T12:00:00`);
  for (let i = 0; i < days; i++) {
    const d = new Date(base); d.setDate(base.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (i === 0 && todayScore != null) vals.push(todayScore);
    else if (h[key]) vals.push(h[key].score);
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

export const todayStr = () => localDateStr();
