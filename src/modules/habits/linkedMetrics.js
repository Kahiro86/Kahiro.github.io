// ── Linked metrics: habits and their counterparts ────────────────────
// A habit called "Sleep well" and the sleep hours logged in the trading
// module are the same fact recorded twice. Before this file they never met:
// ticking the habit moved the habit's streak and nothing else, while
// System Health, the Record's wellbeing trends and the XP engine all read
// the other store and saw an unlogged day.
//
// The rule this file enforces is the one the rest of the app already lives
// by: ONE definition per metric, many writers. The habit tracker becomes a
// writer into the metric's canonical store, and the canonical store writes
// back into the habit, so whichever surface you happen to open is the one
// that works.
//
// What flows which way, and why it stops where it does:
//
//   habit → canonical   only when the habit carries a NUMBER we can convert
//                       (a numeric habit with a readable unit). A boolean
//                       "Sleep well" tick does not become 6.5 hours —
//                       inventing the measurement would poison every average
//                       downstream of it.
//   habit → claim       a boolean tick, or a numeric habit whose unit we
//                       cannot read, records that the day's bar was CLAIMED
//                       met. Claims count toward coverage and consistency;
//                       they never enter an average, because nobody measured
//                       anything.
//   canonical → habit   always. Hours or millilitres already recorded set
//                       the linked habit's entry — the number for a numeric
//                       habit, done/not-done against the bar for a boolean.
//
// Provenance. Every mirrored write is recorded in `hab_link_writes` with the
// value written, so retracting a habit entry only removes a canonical value
// this mirror actually put there. A number typed into the trading module or
// a drink logged as food is never touched.
import { SLEEP_FLOOR_HOURS } from "../../shared/views.js";

export const LINK_WRITES_KEY = "hab_link_writes";
/** ht_meta key holding an explicit habit id (or NO_LINK) for a metric. */
export const metaKeyFor = (metricId) => `link_${metricId}`;
export const NO_LINK = "none";

const round1 = (n) => Math.round(n * 10) / 10;

// ── The registry ─────────────────────────────────────────────────────
// `units` maps what a person actually types into the habit's unit field
// onto the canonical unit. `assume` reads an EMPTY unit field off the
// habit's target, but only inside a band where there is exactly one
// sensible reading — outside it we decline rather than guess.
export const METRICS = [
  {
    id: "sleep",
    label: "Sleep",
    store: "trade_sleep",
    unit: "h",
    bar: SLEEP_FLOOR_HOURS,
    namePattern: /\bsleep|\bslept\b|\brest\s*well/i,
    units: { h: 1, hr: 1, hrs: 1, hour: 1, hours: 1, min: 1 / 60, mins: 1 / 60, minute: 1 / 60, minutes: 1 / 60 },
    // 3–16 in a bare number can only be hours; 480 could be minutes.
    assume: (target) => (target >= 3 && target <= 16 ? 1 : null),
    round: round1,
  },
  {
    id: "hydration",
    label: "Hydration",
    store: "hydration_log",
    unit: "ml",
    bar: 2000,
    namePattern: /hydrat|\bwater\b|\bfluids?\b/i,
    units: {
      ml: 1, mls: 1, millilitre: 1, millilitres: 1, milliliter: 1, milliliters: 1,
      l: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000,
      glass: 250, glasses: 250, cup: 250, cups: 250,
    },
    // ≤ 20 of anything is litres/glasses territory; ≥ 200 is millilitres.
    // Between them (say a target of 60) there is no honest reading.
    assume: (target) => (target > 0 && target <= 20 ? 1000 : target >= 200 ? 1 : null),
    round: Math.round,
  },
  // Read-only links. A workout is a record of exercises and sets, and a day's
  // meals are a list of foods — neither is a number a habit tick could
  // invent, so nothing flows habit → canonical here. The reverse direction
  // still works, and it is the one that matters: a session logged in the gym
  // ticks "Train", instead of the habit calling it a missed day.
  {
    id: "training",
    label: "Training",
    readOnly: true,
    stores: ["athlete_workouts", "gym_sessions"],
    unit: "session",
    bar: 1,
    namePattern: /\btrain|\bworkout|\bgym\b|\blift|\bexercise/i,
    units: {},
    assume: () => null,
    round: Math.round,
  },
  {
    id: "meals",
    label: "Meals",
    readOnly: true,
    stores: ["nutrition_log"],
    unit: "day",
    bar: 1,
    namePattern: /\bmeals?\b|\beat\b|\bnutrition\b|\bfood\b|\bdiet\b/i,
    units: {},
    assume: () => null,
    round: Math.round,
  },
];

export const metricById = (id) => METRICS.find((m) => m.id === id) || null;

// ── Resolution: which habit stands for which metric ──────────────────
const live = (h) => h && h.id && !h.archivedAt;

/**
 * metricId → habitId, for every metric that has one. An explicit choice in
 * ht_meta always wins, including the explicit choice to link nothing; only
 * in its absence does the name pattern pick a habit, and then only the
 * oldest match, so adding a second "water" habit never silently steals the
 * link from the one already carrying history.
 */
export function resolveLinks(habits, meta) {
  const list = (Array.isArray(habits) ? habits : []).filter(live);
  const m = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  const out = {};
  for (const metric of METRICS) {
    const explicit = m[metaKeyFor(metric.id)];
    if (explicit === NO_LINK) continue;
    if (explicit) {
      if (list.some((h) => h.id === explicit)) out[metric.id] = explicit;
      continue;
    }
    const matches = list
      .filter((h) => metric.namePattern.test(String(h.name || "")))
      .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    if (matches.length) out[metric.id] = matches[0].id;
  }
  return out;
}

/** The reverse index: habitId → metric, for the write hook's O(1) lookup. */
export function linkedMetricFor(habitId, habits, meta) {
  const links = resolveLinks(habits, meta);
  for (const [metricId, id] of Object.entries(links)) {
    if (id === habitId) return metricById(metricId);
  }
  return null;
}

// ── Conversion ───────────────────────────────────────────────────────
/** The factor turning this habit's numbers into the metric's unit, or null. */
export function factorFor(metric, habit) {
  if (!metric || !habit || habit.type !== "numeric") return null;
  const unit = String(habit.unit || "").trim().toLowerCase();
  if (unit) return metric.units[unit] ?? null;
  const target = Number(habit.target);
  return Number.isFinite(target) ? metric.assume(target) : null;
}

/** The habit's bar for the day, in the metric's unit. */
export function barFor(metric, habit) {
  const f = factorFor(metric, habit);
  const target = Number(habit?.target);
  if (f != null && Number.isFinite(target) && target > 0) return metric.round(target * f);
  return metric.bar;
}

/**
 * What a habit entry says about the metric.
 *   { value }  a real measurement, in the metric's unit
 *   { claim }  the bar was claimed met (true) or explicitly missed (false)
 * A habit that measures nothing and claims nothing returns null.
 */
export function readEntry(metric, habit, value) {
  if (!metric || !habit) return null;
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return null;
  const f = factorFor(metric, habit);
  if (f != null) return { value: metric.round(v * f) };
  return { claim: v >= 1 };
}

// ── Provenance ───────────────────────────────────────────────────────
const emptyWrites = () => ({});

export function sanitizeLinkWrites(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = emptyWrites();
  for (const metric of METRICS) {
    const days = src[metric.id];
    if (!days || typeof days !== "object" || Array.isArray(days)) continue;
    const clean = {};
    for (const [d, v] of Object.entries(days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(+v)) clean[d] = +v;
    }
    if (Object.keys(clean).length) out[metric.id] = clean;
  }
  return out;
}

// ── The mirror ───────────────────────────────────────────────────────
/**
 * Pure planner: given the metric's current canonical map, what this mirror
 * previously wrote, and the habit's new reading, return the next canonical
 * map and the next provenance map. Returns null when nothing changes, so
 * callers can skip the write entirely and never loop.
 *
 * `reading` is readEntry's result, or null to retract the day.
 */
export function planMirror(metric, canonical, writes, date, reading) {
  if (metric.readOnly) return null; // nothing a habit tick could honestly write
  const cur = canonical && typeof canonical === "object" && !Array.isArray(canonical) ? canonical : {};
  const mine = (writes && writes[metric.id]) || {};
  const had = Object.prototype.hasOwnProperty.call(mine, date);
  const next = { ...cur };
  const nextMine = { ...mine };

  const wanted = reading && reading.value != null ? metric.round(reading.value) : null;

  if (wanted == null) {
    // Retract — but only a value this mirror wrote and nobody has since
    // changed. A number the user typed elsewhere outlives the habit.
    if (!had) return null;
    if (Number(cur[date]) === Number(mine[date])) delete next[date];
    delete nextMine[date];
  } else {
    const held = Number(cur[date]);
    if (held === wanted && had && Number(mine[date]) === wanted) return null;
    // Someone else's number for this day stands unless the mirror owns it.
    if (Number.isFinite(held) && held > 0 && !had) return null;
    next[date] = wanted;
    nextMine[date] = wanted;
  }

  const nextWrites = { ...(writes || {}) };
  if (Object.keys(nextMine).length) nextWrites[metric.id] = nextMine;
  else delete nextWrites[metric.id];
  return { canonical: next, writes: nextWrites };
}

// ── Reverse sync: canonical → habit ──────────────────────────────────
/**
 * The habit entries a canonical map implies, over `dates`. Numeric habits
 * get the measurement converted back into their own unit; boolean habits
 * get 1 or 0 against the bar. Days the mirror itself wrote are skipped —
 * they came FROM the habit, and echoing them back is how loops start.
 *
 * Returns [{ habitId, date, value }], for the caller to apply through the
 * Db. Days with no canonical value produce nothing: an unrecorded day stays
 * unrecorded rather than being written as a miss.
 */
export function reverseEntries({ metric, habit, canonical, writes, dates, entries }) {
  if (!metric || !habit) return [];
  const cur = canonical && typeof canonical === "object" && !Array.isArray(canonical) ? canonical : {};
  const mine = (writes && writes[metric.id]) || {};
  const f = factorFor(metric, habit);
  const bar = barFor(metric, habit);
  const have = new Map();
  for (const e of Array.isArray(entries) ? entries : []) {
    if (e && e.habitId === habit.id && e.date) have.set(e.date, Number(e.value));
  }

  const out = [];
  for (const date of dates) {
    const raw = Number(cur[date]);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    if (Object.prototype.hasOwnProperty.call(mine, date)) continue;
    const value = habit.type === "numeric" && f
      ? metric.round((raw / f) * 100) / 100
      : (raw >= bar ? 1 : 0);
    if (have.has(date) && have.get(date) === value) continue;
    // A hand-entered "done" is not overwritten with a measured miss; the
    // person was there and the log wasn't. Only silence gets filled in.
    if (have.has(date) && habit.type !== "numeric" && have.get(date) === 1 && value === 0) continue;
    out.push({ habitId: habit.id, date, value });
  }
  return out;
}

/**
 * Days on which a linked habit CLAIMS the metric's bar was met without
 * measuring it — what the wellbeing series folds in as covered-but-unmeasured.
 * Only boolean habits (and unreadable numeric ones) produce claims; a habit
 * that writes real numbers has nothing left to claim.
 */
export function claimDays({ metric, habit, entries }) {
  if (!metric || !habit || factorFor(metric, habit) != null) return {};
  const out = {};
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || e.habitId !== habit.id || !e.date) continue;
    const v = Number(e.value);
    if (!Number.isFinite(v)) continue;
    out[e.date] = v >= 1;
  }
  return out;
}
