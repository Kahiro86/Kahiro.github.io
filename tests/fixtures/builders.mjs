// ── Builders: one record at a time ───────────────────────────────────
// A builder returns one plausible record with an overrides bag, the pattern
// already proven for the vendored habit domain in tests/habits/factories.ts.
// This extends it past that boundary to the stores the app itself owns.
//
// The rule these exist to enforce: a fixture is correct only if the app's own
// sanitizer hands it back unchanged. Hand-written seeds cannot make that
// promise — two in this suite were quietly wrong (`gymSessions` where the
// reader wants `workouts`, `createdDate` where the field is `createdAt`) and
// produced green tests that asserted nothing. contract.mjs rule 5 checks
// every scenario built from these against the real sanitizers.
import { FOOD_DB } from "../../src/modules/athlete/nutrition.js";
import { iso, ago, TODAY } from "./harness.mjs";

const at = (d) => `${d}T12:00:00.000Z`;

// ── Habits (ht_habits / ht_entries) ──────────────────────────────────
// Field names are the tracker's, not the test factory's: `createdAt`, not
// `createdDate`. localDb.js:144 is the authority.
export function habit(over = {}) {
  const { createdOn = ago(60), ...rest } = over;
  return {
    id: "h1",
    name: "Deep work 90m",
    subtype: "standard",
    icon: null,
    question: null,
    type: "boolean",
    unit: null,
    target: null,
    targetDirection: "at_least",
    frequencyType: "daily",
    frequencyDays: null,
    frequencyCount: null,
    routineId: null,
    sortOrder: 0,
    colour: null,
    notes: null,
    archivedAt: null,
    createdAt: at(createdOn),
    updatedAt: at(createdOn),
    ...rest,
  };
}

/** A numeric habit — the shape partial completion actually needs. */
export const numericHabit = (over = {}) =>
  habit({ id: "h2", name: "Stretch", type: "numeric", unit: "min", target: 15, ...over });

/**
 * One habit-day. `value` 1 is a completion, 0 an explicit miss, and a number
 * is the amount for a numeric habit. An unlogged day has NO entry at all —
 * absence is the representation, and seeding a 0 to mean "unlogged" is the
 * single easiest way to make a test lie.
 */
export function entry(habitId, date, value = 1, over = {}) {
  return {
    id: `e_${habitId}_${date}`,
    habitId,
    date,
    value,
    note: null,
    createdAt: at(date),
    updatedAt: at(date),
    ...over,
  };
}

// ── Meals (nutrition_log) ────────────────────────────────────────────
/**
 * A logged food, with its macros taken from the real FOOD_DB rather than
 * invented. A micronutrient assertion against made-up numbers proves the
 * assertion, not the app.
 */
export function meal(name, grams = 100, over = {}) {
  const food = FOOD_DB.find((f) => f.name.toLowerCase() === String(name).toLowerCase());
  if (!food) {
    throw new Error(`meal("${name}") — not in FOOD_DB. Use a real food, or add one to the library first.`);
  }
  const scale = grams / 100;
  const n = {};
  for (const [k, v] of Object.entries(food.per100)) {
    if (Number.isFinite(+v)) n[k] = Math.round(+v * scale * 10) / 10;
  }
  return {
    id: `m_${food.id}_${grams}`,
    name: food.name,
    slot: "pre_shift",
    grams,
    proc: food.proc ?? 1,
    time: "08:30",
    n,
    ...over,
  };
}

/** The profile the targets derive from. Explicit, because the default goal is
 *  `maintain` and a fat-loss assertion against it silently measures the wrong
 *  thing (nutrition.js:413). */
export const profile = (over = {}) => ({
  age: 27, sex: "male", heightCm: 178, weightKg: 78,
  activity: 1.55, goal: "muscle", favs: [], overrides: null,
  // Present and null, not absent. sanitizeProfile fills it in, so a fixture
  // that omits it is a shape the app rewrites — which is exactly the drift
  // the contract exists to refuse.
  targetWeightKg: null,
  ...over,
});

// ── Training (gym_sessions) ──────────────────────────────────────────
// The store's field names are `entries` and `weightKg` — NOT `exercises` and
// `weight`, which is the *derived* workout shape gymSessionsToWorkouts()
// produces (gymSessions.js:66-74). Getting this wrong yields a session that
// sanitizeSessions drops on the floor, and a silently empty test.
export const set = (weightKg, reps) => ({ weightKg, reps, done: true });

/** `exerciseId` must exist in the catalog or trainingBalance skips the sets
 *  and every discipline reads zero. */
export function exercise(exerciseId, sets = 3, weightKg = 60, reps = 8) {
  return {
    id: `x_${exerciseId}`,
    exerciseId,
    name: exerciseId,
    sets: Array.from({ length: sets }, () => set(weightKg, reps)),
  };
}

export function session(date = TODAY, over = {}) {
  return {
    id: `s_${date}`,
    date,
    startedAt: at(date),
    endedAt: at(date),
    entries: [exercise("barbell-bench-press", 4, 60, 8)],
    ...over,
  };
}

// ── The rest ─────────────────────────────────────────────────────────
export const sleepNight = (date, hours) => [date, hours];
export const water = (date, ml) => [date, ml];
export const pureDay = (date) => [date, { s: "pure", triggers: [] }];
export const relapseDay = (date, hour = 22) => [date, { s: "relapse", triggers: [], t: hour }];

export const journal = (date, text = "Held the line. Slept badly, trained anyway, ate on plan.") => ({
  id: `j_${date}`,
  date,
  title: "",
  text,
  mood: "steady",
  tags: [],
  editedAt: null,
});

export const churchVisit = (date) => ({ id: `c_${date}`, date, title: "Sunday service", notes: "" });
export const verse = (ref, addedOn, reviews = 0, lastOn = null) => ({
  id: `v_${ref.replace(/\W+/g, "")}`, ref, text: "", addedAt: addedOn,
  reviewCount: reviews, lastReviewed: lastOn || addedOn,
});

/** Every scenario needs these two or the first-run chrome covers the screen. */
export const returningUser = () => ({
  onboarding: { overviewSeen: true, done: true },
  whatsnew_seen: "3.1",
});

export const make = {
  habit, numericHabit, entry, meal, profile,
  session, exercise, set, journal, churchVisit, verse,
  sleepNight, water, pureDay, relapseDay, returningUser,
};

export { iso, ago, TODAY };
