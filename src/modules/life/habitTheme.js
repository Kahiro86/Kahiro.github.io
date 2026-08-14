// ── Habit-screens palette + score rule (redesign spec §1/§2) ─────────────
// These are the EXACT tokens from the redesign spec, scoped to the Habits &
// Routines screens only (list → detail → calendar). They are intentionally
// their own constants rather than the global designTokens: the spec mandates
// these precise values ("no substitutions"). Every Habits screen imports the
// palette and getScoreColor from here so the score-color rule is defined once
// and reused across list, detail and calendar — never reimplemented per view.
import { isWeekly } from "../../shared/habitEngine.js";

export const HT = {
  bgPage: "#0A0908",       // screen background
  bgCard: "#141110",       // card surfaces
  border: "#2A251D",       // card borders, dividers
  gold: "#D4A843",         // primary accent — active states, gold bars/lines, CTAs
  textPrimary: "#F0EBE0",  // headings, primary labels
  textSecondary: "#8A8378",// muted labels, timestamps, helper text
  green: "#7BC862",        // scores ≥70%, positive deltas
  red: "#E05252",          // scores <40%, delete actions
  cellEmpty: "#241F18",    // unlogged / missed day cells
};

// Calendar-only heatmap ramp, light→dark logged intensity (5 steps). Kept for
// any generic use; per-habit screens use habitRamp() below instead.
export const HEATMAP_RAMP = ["#1A1611", "#3D3116", "#6B4F1A", "#A67D1F", "#D4A843"];

// Loop tints every one of a habit's surfaces in the habit's OWN colour. This
// derives a 5-step intensity ramp from that colour via increasing alpha over
// the near-black page, which reads as faint→saturated shades of the colour.
export function habitRamp(color) {
  return [`${color}12`, `${color}33`, `${color}66`, `${color}AA`, color];
}

// The single source of truth for the score→color rule (spec §2). A % anywhere
// in the Habits screens must colour through this function.
export function getScoreColor(score) {
  if (score >= 70) return HT.green;
  if (score >= 40) return HT.gold;
  return HT.red;
}

// Human frequency label for a habit ("every day" / "3×/week"), driven by the
// habit's real scheduling config — never hardcoded.
export function frequencyLabel(h) {
  if (isWeekly(h)) return `${h.weeklyTarget || 1}×/week`;
  const days = Array.isArray(h.days) ? h.days : [];
  if (days.length >= 7) return "every day";
  if (days.length === 0) return "unscheduled";
  return `${days.length}×/week`;
}

// Compact unit suffix for numeric cells ("50p", "1.2mi"). Known units get a
// tight abbreviation; anything else falls back to the first two characters.
const UNIT_ABBR = {
  pages: "p", page: "p", pg: "p",
  miles: "mi", mile: "mi", mi: "mi", km: "km", m: "m",
  min: "m", minute: "m", minutes: "m", mins: "m", h: "h", hr: "h", hrs: "h", hours: "h",
  reps: "r", rep: "r", sets: "s", steps: "st",
  l: "L", ml: "ml", oz: "oz", g: "g", kg: "kg", cal: "c", kcal: "c", glasses: "g",
};
export function unitAbbr(unit) {
  if (!unit) return "";
  const key = String(unit).trim().toLowerCase();
  return UNIT_ABBR[key] ?? key.slice(0, 2);
}

// A logged numeric value formatted tight for a small cell: integers as-is,
// fractions to one decimal, with the unit abbreviation appended.
export function fmtCellValue(v, unit) {
  const n = Number(v) || 0;
  const num = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${num}${unitAbbr(unit)}`;
}
