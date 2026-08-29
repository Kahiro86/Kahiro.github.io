// ── Dates for fixtures ───────────────────────────────────────────────
// Local-timezone, matching src/shared/dates.js:4 exactly. A test that builds
// dates with toISOString() is off by a day for anyone west of UTC, and the
// failure only appears on their machine.
//
// Kept apart from harness.mjs so a pure audit can import a builder without
// pulling in playwright.
export const iso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
export const TODAY = iso();

/** The full accessible name of a day cell, for addressing the calendar grid
 *  by date rather than by the digits on the tile — the month view repeats day
 *  numbers in its padding rows, so "27" matches twice. */
export const dayLabel = (d = new Date()) =>
  d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
