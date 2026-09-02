// ── The review record ────────────────────────────────────────────────
// What you *write* in a review. Every number a review shows is computed
// from the trades in its period — see review.js — so nothing numeric is
// stored here and nothing can go stale.
import { localDateStr } from "../ui/dates.js";

export const KINDS = ["daily", "weekly", "monthly"];
export const PLANS = ["Yes", "Mostly", "No"];
export const MOODS = [
  "Calm / Neutral", "Impatient", "Frustrated",
  "FOMO", "Revenge", "Overconfident", "Fearful",
];

export const newReview = (patch = {}) => ({
  id: `rv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  kind: "daily",
  period: "",              // daily YYYY-MM-DD · weekly week-start · monthly YYYY-MM
  followedPlan: "",
  emotionalState: "",
  biggestMistake: "",
  biggestLesson: "",
  notes: "",
  createdAt: localDateStr(),
  ...patch,
});

/**
 * Keeps only records that can be placed on the calendar.
 *
 * A review with no kind or no period cannot be found again by any screen
 * in the app, so it is dropped rather than carried around invisibly.
 */
export const sanitizeReviews = (raw) =>
  (Array.isArray(raw) ? raw : []).filter(
    (r) => r && typeof r === "object" && r.id &&
      KINDS.includes(r.kind) && typeof r.period === "string" && r.period,
  );
