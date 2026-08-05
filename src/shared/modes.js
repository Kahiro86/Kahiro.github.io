// ── God / Normal / Hell — derived day-state ──────────────────────────
// Not a manual toggle: a read-out of the existing rules engine. Every gate
// already exposes a queryable status (trade cap/cooldown/sleep from
// tradeGates, nutrition floors/ceiling from nutritionHard, the daily
// checklist, recurring pings). This file only *reads* those — it never
// re-implements gate logic — and collapses them into one of three states.
//
//   God    — every active gate clean, nothing pending.
//   Hell   — `hellThreshold`+ gates failing at once (default 2).
//   Normal — everything in between (most days).
//
// A gate that never had a chance to be evaluated today (e.g. the sleep gate
// with no morning entry) is "incomplete": it keeps the day out of God, but
// never counts toward Hell. Thresholds are configurable, never hardcoded.
import { localDateStr } from "./dates.js";

export const DEFAULT_MODE_CFG = { hellThreshold: 2, checklistCutoffHour: 21 };

export function sanitizeModeCfg(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const clamp = (v, d, lo, hi) => { const x = Math.round(+v); return Number.isFinite(x) && x >= lo && x <= hi ? x : d; };
  return {
    hellThreshold: clamp(r.hellThreshold, 2, 2, 6),
    checklistCutoffHour: clamp(r.checklistCutoffHour, 21, 0, 23),
  };
}

// ── Per-gate status helpers (pure) ───────────────────────────────────
// Each returns "pass" | "fail" | "incomplete" | "off" (not applicable).
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

export const cutoffPassed = (cutoffHour, now = new Date()) => now.getHours() >= cutoffHour;

// ── Collapse the gate list into one state ────────────────────────────
// `statuses` is [{ key, label, status }]. "off" gates are excluded entirely.
export function evalMode(statuses, cfg) {
  const c = sanitizeModeCfg(cfg);
  const active = (Array.isArray(statuses) ? statuses : []).filter((s) => s && s.status !== "off");
  const fails = active.filter((s) => s.status === "fail");
  const incompletes = active.filter((s) => s.status === "incomplete");
  const clean = active.filter((s) => s.status === "pass");

  let mode = "normal";
  if (fails.length >= c.hellThreshold) mode = "hell";
  else if (fails.length === 0 && incompletes.length === 0 && clean.length > 0) mode = "god";

  // Borderline: exactly at the Hell threshold with gates still pending. Flag
  // it so the closing commit can prefer the plainer label instead of guessing.
  const ambiguous = fails.length === c.hellThreshold && incompletes.length > 0;
  return { mode, fails, incompletes, clean, ambiguous, threshold: c.hellThreshold };
}

// Did the day see real engagement? Cap/cooldown/pings pass trivially on a day
// the owner never touched the app, so they don't count — only an actual fail or
// a completed actionable gate (sleep entered, checklist done, nutrition logged)
// marks a day worth recording in history.
const ACTIONABLE = new Set(["sleep", "checklist", "nutriFloor", "nutriCeil"]);
export function dayEngaged(statuses) {
  return (Array.isArray(statuses) ? statuses : []).some(
    (s) => s.status === "fail" || (ACTIONABLE.has(s.key) && s.status === "pass")
  );
}

// At day-close: prefer the plainer label on an ambiguous boundary, and record
// the ambiguity for later review rather than silently resolving it.
export function resolveClosingMode(result) {
  if (!result) return { mode: "normal", ambiguous: false };
  if (result.ambiguous) return { mode: "normal", ambiguous: true };
  return { mode: result.mode, ambiguous: false };
}

// ── Single-spectrum God score (0–100) ───────────────────────────────
// One continuous number instead of a two/three-state label: how clean the
// day's active gates are. A pass is full credit, a still-pending gate half
// (there's time), a failure none — so the score climbs through the day as
// gates close. 100 = every active gate clean (God); low = gates failing.
// Returns null when no gate is active (nothing to score yet).
export function godScore(statuses) {
  const active = (Array.isArray(statuses) ? statuses : []).filter((s) => s && s.status !== "off");
  if (!active.length) return null;
  const credit = active.reduce((s, g) => s + (g.status === "pass" ? 1 : g.status === "incomplete" ? 0.5 : 0), 0);
  return Math.round((credit / active.length) * 100);
}

// The tone tier a score falls in — drives colour only; the veil/detail still
// use the discrete `mode`. High = gold (near-God), low = heavy (near-Hell).
export function scoreTier(score) {
  if (score == null) return "normal";
  if (score >= 85) return "god";
  if (score >= 50) return "normal";
  return "hell";
}

// ── Mode metadata for the UI (labels + restrained treatment) ─────────
export const MODE_META = {
  god: { label: "GOD", glyph: "◆", tone: "gold" },
  normal: { label: "NORMAL", glyph: "◈", tone: "neutral" },
  hell: { label: "HELL", glyph: "◇", tone: "heavy" },
};

// ── History (one final state per closed day) ─────────────────────────
export function sanitizeModeHistory(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") continue;
    const mode = ["god", "normal", "hell"].includes(v.mode) ? v.mode : "normal";
    out[k] = { mode, ambiguous: !!v.ambiguous };
  }
  return out;
}

// Commit yesterday's (or any past day's) final state exactly once. Pure:
// returns the next history map, or the same reference when nothing changed.
export function commitClosedDay(history, ds, closingResult) {
  const h = sanitizeModeHistory(history);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) || h[ds]) return h; // already recorded / invalid
  const { mode, ambiguous } = resolveClosingMode(closingResult);
  return { ...h, [ds]: { mode, ambiguous } };
}

export const todayStr = () => localDateStr();
