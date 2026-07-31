// ── "Who I Am" — the five-year identity ──────────────────────────────
// A written vision of the five-year self, re-read until it becomes belief.
// Not a goals list, not gamified, never auto-generated. Plain text, local-
// first, and backed up like the most important data in the app. Every edit
// is kept as a dated revision — words are added to, never overwritten.
import { localDateStr } from "./dates.js";

export const WHO_KEY = "who_i_am";            // { text, updatedAt }
export const WHO_REVISIONS_KEY = "who_i_am_revisions"; // [{ text, savedAt }]
export const WHO_META_KEY = "who_i_am_meta";  // { lastShownDs }

// Starting embers — scaffolding prompts only. The words have to be the
// owner's; these are never inserted into the text, only shown faintly while
// the canvas is empty.
export const EMBERS = [
  "In five years, I am …",
  "The man who no longer …",
  "Money moves through my life like …",
  "My body …",
  "In the kitchen, I …",
  "My faith …",
  "When people meet me they see …",
  "The version of me writing this in five years would tell today's me: …",
];

export function sanitizeWho(raw) {
  if (!raw || typeof raw !== "object") return { text: "", updatedAt: null };
  return {
    text: typeof raw.text === "string" ? raw.text : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function sanitizeRevisions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object" && typeof r.text === "string")
    .map((r) => ({ text: r.text, savedAt: typeof r.savedAt === "string" ? r.savedAt : "" }))
    .sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
}

export function sanitizeWhoMeta(raw) {
  if (!raw || typeof raw !== "object") return { lastShownDs: "" };
  return { lastShownDs: typeof raw.lastShownDs === "string" ? raw.lastShownDs : "" };
}

export const hasVision = (who) => !!(sanitizeWho(who).text || "").trim();

// Append the current text as a revision if it differs from the newest one.
// Never overwrites — history only grows.
export function pushRevision(revisions, text) {
  const list = sanitizeRevisions(revisions);
  const clean = (text || "").trim();
  if (!clean) return list;
  if (list.length && (list[0].text || "").trim() === clean) return list; // unchanged
  return [{ text, savedAt: new Date().toISOString() }, ...list];
}

// Daily surface: auto-show once per day, only when a vision has been written.
export function shouldAutoShow(who, meta, ds = localDateStr()) {
  if (!hasVision(who)) return false;
  return sanitizeWhoMeta(meta).lastShownDs !== ds;
}

// Present-tense nudge: flag a single gentle suggestion when future tense
// creeps in. Non-blocking — the caller shows it once and moves on.
export function futureTenseHint(text) {
  return /\bI will\b|\bI'll\b|\bwill be\b|\bgoing to\b|\bsomeday\b|\bone day\b/i.test(text || "");
}

// One line tying today's real discipline to the five-year self. Built from
// actual signals (a streak, a gate) — never invented motivation.
export function todayVisionLine({ streak = 0, cleanDays = 0, gatePct = null } = {}) {
  if (Number.isFinite(gatePct) && gatePct != null && gatePct < 100) {
    return `Today the gate stands at ${Math.round(gatePct)}%. The man in five years is built at gates like this.`;
  }
  if (cleanDays > 0) {
    return `${cleanDays} clean ${cleanDays === 1 ? "day" : "days"} behind you. This is how that man eats.`;
  }
  if (streak > 0) {
    return `Day ${streak} of showing up. The man writing back to you remembers this one.`;
  }
  return "Today is a page in that book. Write it as if it is already true.";
}
