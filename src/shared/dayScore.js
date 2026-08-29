// ── The day score — one definition ───────────────────────────────────
// There were two. The Command Centre averaged three parts over the habit
// tracker's stores; the Weekly Review averaged four over the tracker merged
// with the retired legacy store, under a comment claiming they were "the same
// four parts the cockpit's Life Score uses". They were not, so the same day
// scored differently depending on which screen you asked.
//
// Four parts, because a day is four questions:
//   · did you do what you said you would   (habits)
//   · did you train, or was it a rest day  (body)
//   · did you eat                          (fuel)
//   · did you write anything down          (reflection)
//
// A day with nothing scheduled contributes no habit part rather than a zero —
// grading an absence of obligation as a failure is the same mistake as
// grading an unlogged day as a miss.

/**
 * @param {number|null} habitRatio done/scheduled for the day, or null when
 *   nothing was scheduled.
 * @param {boolean} trained  a session was logged.
 * @param {boolean} rested   the day is a planned rest day — which counts, the
 *   plan being the thing being kept.
 * @param {boolean} ate      any food logged.
 * @param {boolean} wrote    any journal entry.
 * @returns {number} 0–100, rounded.
 */
export function dayScore({ habitRatio = null, trained = false, rested = false, ate = false, wrote = false } = {}) {
  const parts = [];
  if (habitRatio != null && Number.isFinite(+habitRatio)) parts.push(Math.max(0, Math.min(1, +habitRatio)));
  parts.push(trained || rested ? 1 : 0);
  parts.push(ate ? 1 : 0);
  parts.push(wrote ? 1 : 0);
  return Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100);
}

/** The number of parts a day is graded on, so a caller can say so in the UI. */
export const DAY_SCORE_PARTS = 4;
