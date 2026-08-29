// ── Scenarios: whole worlds, not single records ──────────────────────
// A scenario returns a complete localStorage seed. Tests ask for the world
// they need by name instead of assembling one by hand, which is where the
// shape errors came from.
//
// Everything here is deterministic. No Math.random, no `new Date()` beyond
// today's anchor — a fixture that varies run to run turns a real failure into
// "try it again" and a flake into a fact.
import { make, TODAY, ago } from "./builders.mjs";

// ── The sanitizer registry ───────────────────────────────────────────
// Which function the app itself uses to decide a store's shape. A fixture is
// correct exactly when its sanitizer hands it back unchanged; anything not
// listed here is checked only for being valid JSON, and that is a weaker
// promise worth knowing about.
const SANITIZERS = {
  nutrition_log: ["../../src/modules/athlete/nutrition.js", "sanitizeNutrition"],
  nutrition_profile: ["../../src/modules/athlete/nutrition.js", "sanitizeProfile"],
  nutrition_foods: ["../../src/modules/athlete/nutrition.js", "sanitizeFoods"],
  nutrition_plans: ["../../src/modules/athlete/mealPlans.js", "sanitizePlans"],
  purity_log: ["../../src/modules/life/purity.js", "sanitizePurity"],
  gym_sessions: ["../../src/modules/gym/gymSessions.js", "sanitizeSessions"],
  firm_config: ["../../src/shared/firm.js", "sanitizeFirmConfig"],
  athlete_day_marks: ["../../src/shared/dayMarks.js", "sanitizeMarks"],
  goals: ["../../src/shared/goals.js", "sanitizeGoals"],
  wants: ["../../src/shared/wants.js", "sanitizeWants"],
  ict_trades: ["../../src/modules/trading/intel/tradingIntel.js", "sanitizeTrades"],
  ict_reviews: ["../../src/modules/trading/reviews.js", "sanitizeReviews"],
};

const deepEqual = async (a, b) => {
  const { deepStrictEqual } = await import("node:assert");
  // Order-insensitive for object keys, order-sensitive for arrays — which is
  // the right equality here. Several sanitizers rebuild objects and change
  // key order without changing a value, and that is not a fixture error.
  try { deepStrictEqual(a, b); return true; } catch { return false; }
};

/**
 * Returns the list of problems with a seed — empty means every store in it
 * survives the app's own sanitizer unchanged.
 */
export async function validateScenario(seed) {
  const problems = [];
  for (const [key, value] of Object.entries(seed)) {
    // Every store must survive the JSON round trip the storage layer performs.
    let parsed;
    try { parsed = JSON.parse(JSON.stringify(value)); }
    catch { problems.push(`${key}: not JSON-serialisable`); continue; }
    if (!await deepEqual(parsed, value)) { problems.push(`${key}: changed by JSON round-trip`); continue; }

    const reg = SANITIZERS[key];
    if (!reg) continue;
    const [mod, fn] = reg;
    let sanitize;
    try { sanitize = (await import(mod))[fn]; }
    catch (e) { problems.push(`${key}: cannot load ${fn} (${e.message})`); continue; }
    if (typeof sanitize !== "function") { problems.push(`${key}: ${fn} is not a function`); continue; }

    const out = sanitize(value);
    if (!await deepEqual(out, value)) {
      problems.push(`${key}: ${fn}() changed it — the fixture is not a shape the app accepts`);
    }
  }
  return problems;
}

// ─────────────────────────────────────────────────────────────────────
// The worlds
// ─────────────────────────────────────────────────────────────────────

/** Onboarding done, nothing else. The state every empty-state claim is about. */
export const freshInstall = () => ({ ...make.returningUser() });

/**
 * Today, fully logged: two meals, a session, three habits, a clean day, a
 * night's sleep, water, and a journal entry. The world most single-flow
 * tests actually want.
 */
export function oneDay() {
  const h1 = make.habit({ id: "h1", name: "Deep work 90m" });
  const h2 = make.numericHabit({ id: "h2", name: "Stretch", target: 15 });
  const h3 = make.habit({ id: "h3", name: "Read 20 pages" });
  return {
    ...make.returningUser(),
    nutrition_profile: make.profile(),
    nutrition_log: { [TODAY]: [make.meal("Oats (dry)", 100), make.meal("Chicken breast (grilled)", 200, { slot: "mid_shift", time: "13:00" })] },
    gym_sessions: [make.session(TODAY)],
    ht_habits: [h1, h2, h3],
    ht_entries: [
      make.entry("h1", TODAY, 1),
      make.entry("h2", TODAY, 15),
      // h3 has no entry: unlogged, which is not the same as missed.
    ],
    trade_sleep: Object.fromEntries([make.sleepNight(TODAY, 7.2)]),
    hydration_log: Object.fromEntries([make.water(TODAY, 2400)]),
    purity_log: Object.fromEntries([make.pureDay(TODAY)]),
    journal_entries: [make.journal(TODAY)],
  };
}

/**
 * A habit started and not finished — the state the whole partial-completion
 * work exists for, and the one a boolean-shaped fixture cannot express.
 */
export function partialDay() {
  const h = make.numericHabit({ id: "h2", name: "Stretch", target: 15 });
  return {
    ...make.returningUser(),
    ht_habits: [h],
    ht_entries: [make.entry("h2", TODAY, 5)], // 5 of 15 — 33%, neither done nor missed
  };
}

/**
 * Thirty days of plausible use. Deterministic by construction: the pattern is
 * stated in the code rather than drawn from a generator, so a failure on day
 * 17 is reproducible and explainable.
 *
 *   · habits    every day except every 5th (a real user misses)
 *   · training  Mon/Wed/Fri by index
 *   · meals     every day
 *   · sleep     6.2–7.8h on a fixed cycle, dipping below the 6.5 floor twice a week
 *   · purity    clean, with one relapse on day 12
 */
export function activeMonth({ days = 30 } = {}) {
  const h1 = make.habit({ id: "h1", name: "Deep work 90m", createdOn: ago(days) });
  const h2 = make.numericHabit({ id: "h2", name: "Stretch", target: 15, createdOn: ago(days) });

  const entries = [];
  const nutrition = {};
  const sessions = [];
  const sleep = {};
  const water = {};
  const purity = {};
  const journal = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = ago(i);
    if (i % 5 !== 0) {
      entries.push(make.entry("h1", d, 1));
      entries.push(make.entry("h2", d, i % 3 === 0 ? 8 : 15)); // a third of them fall short
    }
    if (i % 7 === 0 || i % 7 === 2 || i % 7 === 4) sessions.push(make.session(d));
    nutrition[d] = [make.meal("Ugali (maize meal, cooked)", 250), make.meal("Beef (lean, cooked)", 150, { slot: "post_shift", time: "19:30" })];
    sleep[d] = [7.2, 6.8, 6.1, 7.5, 6.4, 7.8, 6.9][i % 7];
    water[d] = 2000 + (i % 4) * 300;
    purity[d] = i === 12 ? { s: "relapse", triggers: ["late night"], t: 23 } : { s: "pure", triggers: [] };
    if (i % 4 === 0) journal.push(make.journal(d));
  }

  return {
    ...make.returningUser(),
    nutrition_profile: make.profile(),
    nutrition_log: nutrition,
    gym_sessions: sessions,
    ht_habits: [h1, h2],
    ht_entries: entries,
    trade_sleep: sleep,
    hydration_log: water,
    purity_log: purity,
    journal_entries: journal,
    faith_church: [make.churchVisit(ago(7)), make.churchVisit(ago(14))],
    faith_scripture: [make.verse("Psalm 23:1", ago(20), 3, ago(4))],
  };
}

/**
 * Every store filled, every screen on its full render path. Two audits —
 * console-clean and mobile-layout — carried byte-identical copies of this
 * world, and both carried the same defect in it: sessions shaped
 * `{ id, date, sets }` when the store's shape is
 * `{ id, date, entries: [{ exerciseId, sets }] }`. sanitizeSessions dropped
 * all ten, so both audits walked the Body facet with nothing in it while
 * their own comments claimed "real-shaped data everywhere".
 *
 * The habit names are load-bearing: "Sleep well" and "Hydration" are what
 * the linked-metric resolver matches on, so this world exercises the mirror.
 */
export function richWorld() {
  const NAMES = ["Sleep well", "Hydration", "Train", "Read", "Pray", "Journal"];
  const habits = NAMES.map((name, i) => make.habit({
    id: `h${i}`, name, icon: "✅", createdOn: ago(120),
    ...(i === 1 ? { type: "numeric", unit: "L", target: 3 } : {}),
  }));
  const entries = [];
  for (const h of habits) for (let i = 0; i < 60; i++) entries.push(make.entry(h.id, ago(i), i % 4 ? 1 : 0));

  const nutrition = {};
  for (let i = 0; i < 40; i++) {
    nutrition[ago(i)] = [
      make.meal("Chicken breast (grilled)", 200),
      make.meal("Ginger lime black tea, sugared", 500, { slot: "mid_shift", time: "13:00" }),
    ];
  }
  const sleep = {}; for (let i = 0; i < 60; i++) sleep[ago(i)] = 6 + (i % 4);

  return {
    ...make.returningUser(),
    dash_show_more: true,
    dash_show_money: true,
    ht_habits: habits,
    ht_entries: entries,
    nutrition_log: nutrition,
    nutrition_profile: make.profile(),
    trade_sleep: sleep,
    ti_trades: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, date: ago(i), status: "CLOSED", outcome: i % 3 ? "WIN" : "LOSS", pnl: i % 3 ? 1200 : -600, checklistTotal: 5, checklistScore: 5, accountId: "a1" })),
    ti_accounts: [{ id: "a1", name: "Main", startingBalance: 10000 }],
    ti_settings: { activeAccountId: "a1" },
    finance_state: {
      accounts: [{ id: "f1", name: "Main", balance: 250000, kind: "cash" }],
      income: [{ id: "i1", date: ago(2), amount: 40000, source: "Salary" }],
      bills: [{ id: "b1", name: "Rent", amount: 30000 }],
    },
    journal_entries: Array.from({ length: 20 }, (_, i) => make.journal(ago(i), "Some reflection.")),
    purity_log: Object.fromEntries(Array.from({ length: 40 }, (_, i) => (i % 7 ? make.pureDay(ago(i)) : make.relapseDay(ago(i))))),
    athlete_measurements: Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, date: ago(i * 7), weightKg: 78 - i * 0.2 })),
    gym_sessions: Array.from({ length: 10 }, (_, i) => make.session(ago(i * 2), {
      id: `s${i}`, bodyweightKg: 78, entries: [make.exercise("back-squat", 5, 100, 5)],
    })),
  };
}

/** The scenarios that must round-trip. */
export const SCENARIOS = { freshInstall, oneDay, partialDay, activeMonth, richWorld };

// ── Adversarial ──────────────────────────────────────────────────────
/**
 * Wrong shapes on purpose, for the blank-page harness. This one must NOT
 * round-trip — a "corrupt" fixture the sanitizers happily accept is testing
 * nothing at all, so the contract asserts it genuinely is rejected.
 */
export function corrupt() {
  return {
    ...make.returningUser(),
    nutrition_log: { "not-a-date": "a string where a list belongs" },
    nutrition_profile: { age: "old", sex: 7, weightKg: -5 },
    purity_log: { [TODAY]: { s: "maybe" } },
    gym_sessions: [null, 5, { id: "x" }],
    ht_habits: [{ nope: true }],
    ht_entries: "not an array",
  };
}

export const ADVERSARIAL = { corrupt };
