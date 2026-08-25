// ── Meal plans ───────────────────────────────────────────────────────
// A plan is a day's eating written down once and reused: meals, each with
// items, each item offering one or more interchangeable foods. It is a
// TEMPLATE, never a log — applying a plan writes ordinary entries into
// nutrition_log, which stays the single source of truth for what was
// actually eaten. Nothing here is ever read as intake.
//
// Three things the shape has to carry, because real plans do:
//
//  1. Choices. "Chicken breast / beef / salmon" is one item with three
//     options, not three foods. The macros shown are the option currently
//     picked, and swapping recomputes rather than re-typing.
//  2. Conditions. "On rest days drop the potatoes" is a property of the
//     item, not a footnote — an item is tagged for every day type it
//     belongs to, so a rest day's plan really is a different plan.
//  3. A band, not a number. "2500-2800 kcal" is the honest target and
//     grading a day against a single figure invents precision the plan
//     itself refused to claim.
import { NUTRIENT_KEYS, scaleNutrients, newEntry, SLOTS } from "./nutrition.js";

const SLOT_IDS = new Set(SLOTS.map((s) => s.id));
export const DAY_TYPES = [
  { id: "any", l: "Every day" },
  { id: "training", l: "Training days" },
  { id: "rest", l: "Rest days" },
];
const DAY_TYPE_IDS = new Set(DAY_TYPES.map((d) => d.id));

const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const num = (v, fb = 0) => (Number.isFinite(+v) ? +v : fb);
const str = (v, fb = "") => (typeof v === "string" ? v : fb);

// ── Shape ────────────────────────────────────────────────────────────
/**
 * A band is [min, max]. A single number becomes [n, n] so every comparison
 * downstream has one shape to handle.
 */
export function sanitizeBand(raw) {
  if (Array.isArray(raw) && raw.length === 2 && raw.every((v) => Number.isFinite(+v))) {
    const [a, b] = raw.map(Number);
    return a <= b ? [a, b] : [b, a];
  }
  if (Number.isFinite(+raw)) return [+raw, +raw];
  return null;
}

function sanitizeOption(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = str(raw.name).trim();
  if (!name) return null;
  return {
    name,
    // A plan states a portion in grams because that is what the log stores.
    // `portion` is the human phrasing kept alongside it ("3 eggs", "1 medium"),
    // never instead of it — losing the grams would make the plan unloggable.
    grams: Math.max(0, num(raw.grams)),
    ...(str(raw.portion) ? { portion: str(raw.portion).trim() } : {}),
    ...(str(raw.foodId) ? { foodId: str(raw.foodId) } : {}),
    ...(raw.per100 && typeof raw.per100 === "object" ? { per100: cleanPer100(raw.per100) } : {}),
  };
}

function cleanPer100(raw) {
  const out = {};
  for (const k of NUTRIENT_KEYS) {
    const v = +raw?.[k];
    if (Number.isFinite(v) && v !== 0) out[k] = v;
  }
  return out;
}

function sanitizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const options = (Array.isArray(raw.options) ? raw.options : []).map(sanitizeOption).filter(Boolean);
  if (!options.length) return null;
  const chosen = Number.isInteger(raw.chosen) && raw.chosen >= 0 && raw.chosen < options.length ? raw.chosen : 0;
  return {
    id: str(raw.id) || uid("pi"),
    options,
    chosen,
    dayType: DAY_TYPE_IDS.has(raw.dayType) ? raw.dayType : "any",
    ...(str(raw.note) ? { note: str(raw.note).trim().slice(0, 160) } : {}),
  };
}

function sanitizeMeal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const items = (Array.isArray(raw.items) ? raw.items : []).map(sanitizeItem).filter(Boolean);
  return {
    id: str(raw.id) || uid("pm"),
    name: str(raw.name).trim().slice(0, 60) || "Meal",
    slot: SLOT_IDS.has(raw.slot) ? raw.slot : "pre_shift",
    items,
  };
}

export function sanitizePlan(raw) {
  if (!raw || typeof raw !== "object") return null;
  const meals = (Array.isArray(raw.meals) ? raw.meals : []).map(sanitizeMeal).filter(Boolean);
  const t = raw.targets && typeof raw.targets === "object" ? raw.targets : {};
  const targets = {};
  for (const k of ["p", "c", "f", "kcal"]) {
    const band = sanitizeBand(t[k]);
    if (band) targets[k] = band;
  }
  return {
    id: str(raw.id) || uid("pl"),
    name: str(raw.name).trim().slice(0, 80) || "Meal plan",
    meals,
    ...(Object.keys(targets).length ? { targets } : {}),
    ...(str(raw.note) ? { note: str(raw.note).trim().slice(0, 400) } : {}),
    createdAt: str(raw.createdAt) || new Date().toISOString(),
  };
}

export function sanitizePlans(raw) {
  return (Array.isArray(raw) ? raw : []).map(sanitizePlan).filter(Boolean);
}

// ── Resolution ───────────────────────────────────────────────────────
/**
 * The option a plan item is currently set to, resolved against the food
 * library. An option that names a library food takes the library's macros —
 * so editing the food updates every plan that uses it. One that doesn't
 * (a mix, a restaurant dish) keeps the macros the plan was written with,
 * which is better than dropping the row and pretending the food isn't eaten.
 */
export function resolveOption(option, foods) {
  const list = Array.isArray(foods) ? foods : [];

  // An option built inside the app points at a library food by id, and the
  // library stays its source of truth — edit the food, every plan follows.
  const bound = option.foodId ? list.find((f) => f && f.id === option.foodId) : null;
  if (bound) return { food: bound, grams: option.grams, matched: true };

  // An imported option carries the macros the plan was WRITTEN with, and
  // those win over a same-named library entry. The spreadsheet said 328 kcal
  // for that chicken; silently substituting the library's number would make
  // the app's totals disagree with the document the user is holding, for a
  // food they never asked to change.
  if (option.per100) {
    return {
      food: { id: `plan_${option.name}`, name: option.name, proc: 2, per100: option.per100 },
      grams: option.grams,
      matched: false,
    };
  }

  const byName = list.find((f) => f && String(f.name).toLowerCase() === option.name.toLowerCase());
  if (byName) return { food: byName, grams: option.grams, matched: true };
  return null;
}

export const chosenOption = (item) => item.options[item.chosen] ?? item.options[0];

/** Items that apply on a given day type. "any" always applies. */
export function itemsFor(meal, dayType = "any") {
  return meal.items.filter((i) => i.dayType === "any" || i.dayType === dayType);
}

// ── Totals ───────────────────────────────────────────────────────────
const zero = () => {
  const t = {};
  for (const k of NUTRIENT_KEYS) t[k] = 0;
  return t;
};

function addInto(total, n) {
  for (const k of NUTRIENT_KEYS) total[k] += +n?.[k] || 0;
  return total;
}

const round = (t) => {
  for (const k of NUTRIENT_KEYS) t[k] = Math.round(t[k] * 10) / 10;
  return t;
};

/** Per-meal subtotals and the day total, for one day type. */
export function planTotals(plan, foods, dayType = "any") {
  const meals = plan.meals.map((meal) => {
    const total = zero();
    let unmatched = 0;
    for (const item of itemsFor(meal, dayType)) {
      const r = resolveOption(chosenOption(item), foods);
      if (!r) { unmatched += 1; continue; }
      if (!r.matched) unmatched += 0; // resolved from the plan's own macros
      addInto(total, scaleNutrients(r.food.per100, r.grams));
    }
    return { id: meal.id, name: meal.name, slot: meal.slot, totals: round(total), unmatched };
  });
  const day = zero();
  for (const m of meals) addInto(day, m.totals);
  return { meals, day: round(day), unresolved: meals.reduce((s, m) => s + m.unmatched, 0) };
}

/**
 * The plan against its target band. `state` is "under", "in" or "over" —
 * never a score. A plan is a proposal; grading it before it is eaten would
 * be inventing a verdict about a day that has not happened.
 */
export function planVsTarget(dayTotals_, targets) {
  const out = {};
  for (const [k, band] of Object.entries(targets || {})) {
    const b = sanitizeBand(band);
    if (!b) continue;
    const v = Math.round(+dayTotals_?.[k] || 0);
    out[k] = {
      value: v,
      band: b,
      state: v < b[0] ? "under" : v > b[1] ? "over" : "in",
      // Distance to the nearest edge of the band, 0 when inside it.
      gap: v < b[0] ? b[0] - v : v > b[1] ? v - b[1] : 0,
    };
  }
  return out;
}

/** A target band from the profile's computed daily targets, ±the tolerance. */
export function bandsFromTargets(targets, tolerance = 0.05) {
  if (!targets) return {};
  const band = (v) => [Math.round(v * (1 - tolerance)), Math.round(v * (1 + tolerance))];
  return { kcal: band(targets.kcal), p: band(targets.p), c: band(targets.c), f: band(targets.f) };
}

// ── Applying a plan ──────────────────────────────────────────────────
/**
 * Plan → log entries for a date. Returns entries ready to append to
 * nutrition_log; the caller decides whether to replace the day or add to it,
 * because silently wiping a day someone already logged would destroy real
 * data to make room for an intention.
 */
export function planToEntries(plan, foods, { dayType = "any", mealIds = null } = {}) {
  const out = [];
  for (const meal of plan.meals) {
    if (mealIds && !mealIds.includes(meal.id)) continue;
    for (const item of itemsFor(meal, dayType)) {
      const r = resolveOption(chosenOption(item), foods);
      if (!r || r.grams <= 0) continue;
      out.push({ ...newEntry(r.food, r.grams, meal.slot, ""), fromPlan: plan.id });
    }
  }
  return out;
}

// ── Building a plan ──────────────────────────────────────────────────
export const newPlan = (name = "New plan") => sanitizePlan({ name, meals: [] });

export const newMeal = (name = "Meal", slot = "pre_shift") => sanitizeMeal({ name, slot, items: [] });

/**
 * An item built in the app binds to a library food by id, so editing that
 * food's macros updates every plan using it. Grams default to the food's own
 * realistic serving where it has one — 100 g is a unit, not a portion.
 */
export function newItem(food, grams = null) {
  return sanitizeItem({
    options: [optionFromFood(food, grams)],
    chosen: 0,
    dayType: "any",
  });
}

export function optionFromFood(food, grams = null) {
  const g = Number.isFinite(+grams) && +grams > 0 ? +grams : (food?.serving?.g || 100);
  return {
    name: String(food?.name || "Food"),
    grams: g,
    foodId: String(food?.id || ""),
    ...(food?.serving?.l ? { portion: `${food.serving.l}` } : {}),
  };
}

/** Immutably replace one meal inside a plan. `fn` receives the meal. */
export function patchMeal(plan, mealId, fn) {
  return sanitizePlan({ ...plan, meals: plan.meals.map((m) => (m.id === mealId ? fn(m) : m)) });
}

/** Immutably replace one item inside a meal. */
export function patchItem(plan, mealId, itemId, fn) {
  return patchMeal(plan, mealId, (m) => ({ ...m, items: m.items.map((i) => (i.id === itemId ? fn(i) : i)) }));
}

/** A copy under a new name and new ids, so editing it cannot touch the original. */
export function duplicatePlan(plan) {
  return sanitizePlan({
    ...plan,
    id: uid("pl"),
    name: `${plan.name} (copy)`,
    createdAt: new Date().toISOString(),
    meals: plan.meals.map((m) => ({ ...m, id: uid("pm"), items: m.items.map((i) => ({ ...i, id: uid("pi") })) })),
  });
}

/**
 * A day you already logged, turned into a plan. This is how most plans will
 * really be born: you eat a good day, and you want it again. Entries are
 * grouped by their slot, and each becomes an item bound to the library food
 * it was logged from where the name still matches.
 */
export function planFromDay(entries, foods, { name = "Saved day" } = {}) {
  const bySlot = new Map();
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !e.name) continue;
    if (!bySlot.has(e.slot)) bySlot.set(e.slot, []);
    bySlot.get(e.slot).push(e);
  }
  const list = Array.isArray(foods) ? foods : [];
  const meals = Array.from(bySlot.entries()).map(([slot, es]) => ({
    name: SLOTS.find((x) => x.id === slot)?.l || "Meal",
    slot,
    items: es.map((e) => {
      const food = list.find((f) => f && String(f.name).toLowerCase() === String(e.name).toLowerCase());
      return {
        options: [food
          ? optionFromFood(food, e.grams)
          // The food is gone from the library, or was named freehand. Keep the
          // macros the entry was logged with rather than dropping the row —
          // the person ate it, and a plan that quietly omits it is wrong.
          : { name: e.name, grams: e.grams, per100: unscale(e.n, e.grams) }],
        chosen: 0,
        dayType: "any",
      };
    }),
  }));
  return sanitizePlan({ name, meals });
}

// An entry stores absolute nutrients for its grams; a plan option stores
// per-100 g. This is the one conversion between them.
function unscale(n, grams) {
  const g = +grams || 0;
  if (g <= 0) return {};
  const out = {};
  for (const k of NUTRIENT_KEYS) {
    const v = +n?.[k];
    if (Number.isFinite(v) && v !== 0) out[k] = (v / g) * 100;
  }
  return out;
}

// ── CSV import ───────────────────────────────────────────────────────
// The columns a plan exported from a spreadsheet actually has:
//   Meal, Food, Amount, Protein (g), Carbs (g), Fat (g), Calories
// Subtotal and total rows are recognised and skipped — they are arithmetic
// the app does itself, and importing them would double every number. A
// "Target Range" row becomes the plan's band.
const SUBTOTAL_RE = /subtotal|daily total|^total$/i;
const TARGET_RE = /target/i;
const NOTE_RE = /^note\b/i;

export function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** "200g" → 200 · "3 eggs" → null (a count, not a mass) · "200ml" → 200 */
export function gramsFromAmount(amount) {
  const m = String(amount || "").match(/([\d.]+)\s*(g|kg|ml|l)\b/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return null;
  const unit = m[2].toLowerCase();
  return unit === "kg" || unit === "l" ? v * 1000 : v;
}

/**
 * Parses one plan out of CSV text. Rows whose amount is a count ("3 eggs")
 * still import: the row's own macros become the option's per100, scaled to a
 * nominal 100 g, so the totals come out right even though the app has no way
 * to know what an egg weighs.
 */
export function parsePlanCsv(text, { name = "Imported plan" } = {}) {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { plan: null, errors: ["The file is empty."] };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (re) => header.findIndex((h) => re.test(h));
  const iMeal = col(/^meal/), iFood = col(/^food/), iAmt = col(/^amount/);
  const iP = col(/protein/), iC = col(/carb/), iF = col(/fat/), iK = col(/calorie|kcal/);
  if (iMeal < 0 || iFood < 0) {
    return { plan: null, errors: ["Expected at least a Meal and a Food column."] };
  }

  const errors = [];
  const notes = [];
  const mealsByName = new Map();
  let targets = null;

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const mealName = cells[iMeal] || "";
    const foodName = cells[iFood] || "";

    if (NOTE_RE.test(mealName) || NOTE_RE.test(line)) { notes.push(line.replace(/^"?note:?\s*/i, "").replace(/,+$/, "")); continue; }
    if (TARGET_RE.test(mealName)) {
      targets = {};
      for (const [k, i] of [["p", iP], ["c", iC], ["f", iF], ["kcal", iK]]) {
        const band = parseBandCell(cells[i]);
        if (band) targets[k] = band;
      }
      continue;
    }
    if (SUBTOTAL_RE.test(mealName) || !foodName) continue;

    const grams = gramsFromAmount(cells[iAmt]);
    const kcal = +cells[iK] || 0;
    const p = +cells[iP] || 0;
    const c = +cells[iC] || 0;
    const f = +cells[iF] || 0;
    // Without a mass we cannot state per-100 g macros, so the row is logged
    // as a nominal 100 g carrying its own totals — the day's arithmetic is
    // then correct even though "1 medium banana" has no honest gram weight.
    const basis = grams && grams > 0 ? grams : 100;
    const per100 = {
      kcal: (kcal / basis) * 100,
      p: (p / basis) * 100,
      c: (c / basis) * 100,
      f: (f / basis) * 100,
    };

    // The qualifier comes off FIRST. "Potatoes (training/shift days)" carries
    // a slash inside its parenthetical, and splitting on slashes before
    // removing it turns one conditional food into two nonsense ones.
    const qualifier = (foodName.match(/\(([^)]*)\)/) || [])[1] || "";
    const bare = foodName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    const dayType = /rest day/i.test(qualifier) || /rest day/i.test(cells[iAmt] || "") ? "rest"
      : /training|shift/i.test(qualifier) ? "training" : "any";

    // "Chicken breast / beef / salmon" is one item with three options.
    const optionNames = bare.split("/").map((x) => x.trim()).filter(Boolean);

    const item = {
      options: optionNames.map((n) => ({
        name: n,
        grams: basis,
        ...(cells[iAmt] ? { portion: cells[iAmt] } : {}),
        per100,
      })),
      chosen: 0,
      dayType,
      ...(qualifier ? { note: qualifier } : {}),
    };

    if (!mealsByName.has(mealName)) mealsByName.set(mealName, { name: mealName, items: [] });
    mealsByName.get(mealName).items.push(item);
  }

  const meals = Array.from(mealsByName.values());
  if (!meals.length) return { plan: null, errors: ["No food rows found."] };

  // Meals land on shift slots in the order they appear — the plan says
  // "Meal 1", "Meal 2", and only the person eating knows when that is.
  const order = ["pre_shift", "mid_shift", "post_shift", "tasting"];
  const plan = sanitizePlan({
    name,
    meals: meals.map((m, i) => ({ ...m, slot: order[i] ?? "post_shift" })),
    ...(targets ? { targets } : {}),
    ...(notes.length ? { note: notes.join(" ") } : {}),
  });
  return { plan, errors };
}

/** "180-190" → [180, 190] · "2500" → [2500, 2500] */
export function parseBandCell(cell) {
  const s = String(cell || "").trim();
  const range = s.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/);
  if (range) return sanitizeBand([parseFloat(range[1]), parseFloat(range[2])]);
  return sanitizeBand(s);
}
