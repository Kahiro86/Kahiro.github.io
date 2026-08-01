// ── Evening Shutdown — the end-of-day closeout ritual ────────────────
// One record per day: how the day went (1–5), a win, a lesson, and the three
// things that matter tomorrow. Tomorrow's three surface as "today's focus"
// the next morning, closing the loop. Pure + corruption-tolerant.
import { localDateStr, daysAgoStr } from "./dates.js";

export const REVIEW_KEY = "evening_review";

const clampRating = (r) => { const n = Math.round(+r || 0); return n >= 1 && n <= 5 ? n : 0; };
const cleanLine = (s) => (typeof s === "string" ? s.trim().slice(0, 200) : "");
const cleanTop = (arr) => (Array.isArray(arr) ? arr : []).map(cleanLine).filter(Boolean).slice(0, 3);

// Normalise the whole { [ds]: entry } map, dropping anything malformed.
export function sanitizeReviews(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [ds, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) || !v || typeof v !== "object") continue;
    out[ds] = {
      rating: clampRating(v.rating),
      win: cleanLine(v.win),
      lesson: cleanLine(v.lesson),
      tomorrow: cleanTop(v.tomorrow),
      at: typeof v.at === "string" ? v.at : "",
    };
  }
  return out;
}

export const getReview = (reviews, ds = localDateStr()) => sanitizeReviews(reviews)[ds] || null;

// The three priorities set during last night's shutdown — this morning's focus.
export function todayFocus(reviews) {
  const prev = sanitizeReviews(reviews)[daysAgoStr(1)];
  return prev && Array.isArray(prev.tomorrow) ? prev.tomorrow : [];
}

// Current shutdown streak — consecutive days (ending today or yesterday) with
// a completed review. Encourages the nightly habit without punishing one miss.
export function shutdownStreak(reviews) {
  const map = sanitizeReviews(reviews);
  const done = (d) => { const r = map[d]; return !!(r && (r.rating || r.win || r.lesson || r.tomorrow.length)); };
  const start = done(localDateStr()) ? 0 : done(daysAgoStr(1)) ? 1 : -1;
  if (start < 0) return 0;
  let n = 0;
  for (let i = start; i < 400; i++) { if (done(daysAgoStr(i))) n++; else break; }
  return n;
}
