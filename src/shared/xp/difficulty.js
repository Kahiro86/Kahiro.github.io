// ── Empirical difficulty (spec §4.3) ─────────────────────────────────
// A habit's weight comes from the user's own completion rate with it, not
// from a difficulty slider. Self-assessment drifts and can be gamed; the
// record cannot.
//
// Why this is the anti-farming mechanism rather than a cap: adding five easy
// habits raises yield for about two weeks, then each of them crosses 90%
// completion and drops to 0.6. Farming decays on its own, without anything
// being taken away from the user.
import { DIFFICULTY_BANDS, DIFFICULTY_MIN_OCCURRENCES, DIFFICULTY_WINDOW_DAYS } from "./values.js";
import { localDateStr } from "../dates.js";

const back = (today, n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return localDateStr(d); };

export const bandFor = (rate) => DIFFICULTY_BANDS.find((b) => rate >= b.min) || DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1];

/**
 * Difficulty for one habit.
 *
 * `scheduled` and `completed` are counts over the trailing window, supplied
 * by the habit engine — this module never recomputes scheduling, so there is
 * exactly one definition of "was this habit due" in the codebase.
 *
 * Under DIFFICULTY_MIN_OCCURRENCES the habit sits at baseline 1.0: a habit
 * with three data points has no measurable rate, and guessing at one would
 * make new habits either free money or worthless.
 */
export function difficultyFor({ scheduled, completed }) {
  const s = Math.max(0, Math.floor(scheduled || 0));
  const c = Math.max(0, Math.min(s, Math.floor(completed || 0)));
  if (s < DIFFICULTY_MIN_OCCURRENCES) {
    return {
      weight: 1.0, rate: s > 0 ? c / s : null, scheduled: s, completed: c,
      band: { w: 1.0, l: "Settling in", why: `Needs ${DIFFICULTY_MIN_OCCURRENCES} scheduled days before its weight is measured. ${s} so far.` },
      provisional: true,
    };
  }
  const rate = c / s;
  const band = bandFor(rate);
  return { weight: band.w, rate, scheduled: s, completed: c, band, provisional: false };
}

/**
 * Difficulty for every habit, from raw ht_* rows. Returns a map keyed by
 * habit id, plus the window it measured, so the UI can state both.
 */
export function difficultyMap({ habits, entries, isScheduledOn, today = localDateStr() } = {}) {
  const list = Array.isArray(habits) ? habits.filter(Boolean) : [];
  const rows = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const from = back(today, DIFFICULTY_WINDOW_DAYS - 1);

  const done = new Map();
  for (const e of rows) {
    const d = String(e.date || "").slice(0, 10);
    if (d < from || d > today) continue;
    if (Number(e.value) <= 0) continue; // an explicit miss is not a completion
    if (!done.has(e.habitId)) done.set(e.habitId, new Set());
    done.get(e.habitId).add(d);
  }

  const out = {};
  for (const h of list) {
    const created = String(h.createdAt || "").slice(0, 10);
    let scheduled = 0;
    for (let i = 0; i < DIFFICULTY_WINDOW_DAYS; i++) {
      const ds = back(today, i);
      // A day before the habit existed was never an opportunity to miss.
      if (created && ds < created) continue;
      if (isScheduledOn && !isScheduledOn(h, ds)) continue;
      scheduled++;
    }
    out[h.id] = difficultyFor({ scheduled, completed: (done.get(h.id) || new Set()).size });
  }
  return { byHabit: out, window: DIFFICULTY_WINDOW_DAYS, from, to: today };
}
