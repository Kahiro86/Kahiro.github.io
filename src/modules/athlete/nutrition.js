// ── Nutrition engine ─────────────────────────────────────────────────
// A food-intelligence layer, not a calorie counter. Everything derives
// from one dated log of eaten items whose absolute nutrients are computed
// at log time (per-100g × grams) and re-derived on every edit:
//   nutrition_log     { "YYYY-MM-DD": [ { id, slot, time, name, grams, n:{…}, proc } ] }
//   nutrition_foods   [ { id, name, per100:{…}, proc } ]      (custom foods & recipes)
//   nutrition_profile { age, sex, heightCm, weightKg, activity, goal, favs:[], overrides }
// Values in the built-in database are honest approximations (USDA-style,
// per 100 g); the tracker's power is in trends, not lab precision.
import { localDateStr, daysAgoStr } from "../../shared/dates.js";

// ── Nutrient registry: key, label, unit, daily target (RDA-ish) ──────
// `vb` aggregates the B-complex as % of a full day's coverage.
export const NUTRIENTS = [
  { k: "kcal", l: "Calories",      u: "kcal", rda: null },
  { k: "p",    l: "Protein",       u: "g",    rda: null },
  { k: "c",    l: "Carbs",         u: "g",    rda: null },
  { k: "f",    l: "Fat",           u: "g",    rda: null },
  { k: "fib",  l: "Fiber",         u: "g",    rda: 30 },
  { k: "sug",  l: "Sugars",        u: "g",    rda: 50 },   // upper bound, not a goal
  { k: "sat",  l: "Saturated fat", u: "g",    rda: 22 },   // upper bound
  { k: "o3",   l: "Omega-3",       u: "g",    rda: 1.6 },
  { k: "chol", l: "Cholesterol",   u: "mg",   rda: 300 },  // upper bound
  { k: "na",   l: "Sodium",        u: "mg",   rda: 2300 }, // upper bound
  { k: "k",    l: "Potassium",     u: "mg",   rda: 3400 },
  { k: "ca",   l: "Calcium",       u: "mg",   rda: 1000 },
  { k: "mg",   l: "Magnesium",     u: "mg",   rda: 400 },
  { k: "fe",   l: "Iron",          u: "mg",   rda: 8 },
  { k: "zn",   l: "Zinc",          u: "mg",   rda: 11 },
  { k: "ph",   l: "Phosphorus",    u: "mg",   rda: 700 },
  { k: "va",   l: "Vitamin A",     u: "µg",   rda: 900 },
  { k: "vb",   l: "B-complex",     u: "%",    rda: 100 },
  { k: "vc",   l: "Vitamin C",     u: "mg",   rda: 90 },
  { k: "vd",   l: "Vitamin D",     u: "µg",   rda: 15 },
  { k: "ve",   l: "Vitamin E",     u: "mg",   rda: 15 },
  { k: "vk",   l: "Vitamin K",     u: "µg",   rda: 120 },
  { k: "h2o",  l: "Water content", u: "g",    rda: null },
];
export const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.k);
// Micros tracked for coverage/deficiency (targets are minimums).
export const MICROS = ["fib", "o3", "k", "ca", "mg", "fe", "zn", "ph", "va", "vb", "vc", "vd", "ve", "vk"];
// "More is worse" nutrients — never count toward coverage.
export const LIMITS = ["sug", "sat", "chol", "na"];

// ── Built-in food database (per 100 g, approximate) ──────────────────
// proc: 1 whole food · 2 lightly processed · 3 processed · 4 ultra-processed
// Curated for this user's kitchen: global basics + Kenyan staples.
const F = (name, proc, n) => ({ id: `db_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, name, proc, per100: n });
export const FOOD_DB = [
  // Staples & grains
  F("Ugali (maize meal, cooked)", 2, { kcal: 112, p: 3, c: 23.5, f: 0.5, fib: 1.2, sug: 0.2, sat: 0.1, na: 2, k: 80, ca: 3, mg: 32, fe: 0.6, zn: 0.6, ph: 70, vb: 6, h2o: 72 }),
  F("White rice (cooked)", 2, { kcal: 130, p: 2.7, c: 28, f: 0.3, fib: 0.4, sug: 0.1, sat: 0.1, na: 1, k: 35, ca: 10, mg: 12, fe: 0.2, zn: 0.5, ph: 43, vb: 5, h2o: 68 }),
  F("Brown rice (cooked)", 1, { kcal: 123, p: 2.7, c: 25.6, f: 1, fib: 1.6, sug: 0.2, sat: 0.3, na: 4, k: 86, ca: 3, mg: 39, fe: 0.6, zn: 0.7, ph: 103, vb: 10, ve: 0.2, h2o: 70 }),
  F("Chapati", 3, { kcal: 300, p: 7.8, c: 46, f: 9.2, fib: 3.9, sug: 2.7, sat: 2.3, na: 400, k: 150, ca: 30, mg: 38, fe: 2.5, zn: 1, ph: 120, vb: 12, ve: 1, h2o: 33 }),
  F("Oats (dry)", 1, { kcal: 379, p: 13.2, c: 67.7, f: 6.5, fib: 10.1, sug: 1, sat: 1.1, o3: 0.1, na: 6, k: 362, ca: 52, mg: 138, fe: 4.2, zn: 3.6, ph: 410, vb: 25, ve: 0.4, vk: 2, h2o: 10 }),
  F("Whole-wheat bread", 3, { kcal: 247, p: 13, c: 41, f: 3.4, fib: 6.8, sug: 4.3, sat: 0.7, na: 450, k: 250, ca: 107, mg: 76, fe: 2.4, zn: 1.8, ph: 212, vb: 18, ve: 0.6, vk: 8, h2o: 37 }),
  F("Pasta (cooked)", 2, { kcal: 158, p: 5.8, c: 31, f: 0.9, fib: 1.8, sug: 0.6, sat: 0.2, na: 1, k: 44, ca: 7, mg: 18, fe: 0.5, zn: 0.5, ph: 58, vb: 6, h2o: 62 }),
  F("Potato (boiled)", 1, { kcal: 87, p: 1.9, c: 20, f: 0.1, fib: 1.8, sug: 0.9, na: 4, k: 379, ca: 5, mg: 22, fe: 0.3, zn: 0.3, ph: 44, vb: 10, vc: 13, h2o: 77 }),
  F("Sweet potato (boiled)", 1, { kcal: 76, p: 1.4, c: 17.7, f: 0.1, fib: 2.5, sug: 5.7, na: 27, k: 230, ca: 27, mg: 18, fe: 0.7, zn: 0.2, ph: 32, va: 787, vb: 8, vc: 13, ve: 0.9, vk: 2, h2o: 80 }),
  F("Matoke (cooked plantain)", 1, { kcal: 116, p: 0.8, c: 31, f: 0.2, fib: 2.3, sug: 14, na: 5, k: 465, ca: 2, mg: 32, fe: 0.5, zn: 0.1, ph: 28, va: 45, vb: 12, vc: 11, h2o: 67 }),
  F("Githeri (maize & beans)", 1, { kcal: 140, p: 7, c: 25, f: 1.5, fib: 6, sug: 1.5, sat: 0.3, na: 120, k: 350, ca: 40, mg: 50, fe: 2.2, zn: 1.2, ph: 140, vb: 12, vc: 3, h2o: 65 }),
  F("Pilau rice", 3, { kcal: 185, p: 5, c: 27, f: 6, fib: 1, sug: 1, sat: 1.5, chol: 15, na: 380, k: 120, ca: 20, mg: 20, fe: 1, zn: 0.8, ph: 80, vb: 8, h2o: 60 }),
  // Proteins
  F("Chicken breast (grilled)", 1, { kcal: 165, p: 31, c: 0, f: 3.6, sat: 1, chol: 85, na: 74, k: 256, ca: 15, mg: 29, fe: 1, zn: 1, ph: 228, vb: 40, vd: 0.1, ve: 0.3, h2o: 65 }),
  F("Beef (lean, cooked)", 1, { kcal: 250, p: 26, c: 0, f: 15, sat: 6, chol: 90, na: 72, k: 318, ca: 18, mg: 21, fe: 2.6, zn: 6.3, ph: 198, vb: 45, vd: 0.1, h2o: 57 }),
  F("Nyama choma (grilled goat)", 1, { kcal: 143, p: 27, c: 0, f: 3, sat: 0.9, chol: 75, na: 82, k: 344, ca: 17, mg: 0, fe: 3.7, zn: 4.5, ph: 201, vb: 35, h2o: 68 }),
  F("Tilapia (cooked)", 1, { kcal: 128, p: 26, c: 0, f: 2.7, sat: 0.9, o3: 0.2, chol: 57, na: 56, k: 380, ca: 14, mg: 34, fe: 0.7, zn: 0.4, ph: 204, vb: 30, vd: 3.7, ve: 0.8, h2o: 71 }),
  F("Salmon (cooked)", 1, { kcal: 206, p: 22, c: 0, f: 12, sat: 2.5, o3: 2.2, chol: 63, na: 61, k: 384, ca: 15, mg: 30, fe: 0.3, zn: 0.4, ph: 252, vb: 55, vd: 13, ve: 1.1, h2o: 64 }),
  F("Sardines (canned)", 2, { kcal: 208, p: 25, c: 0, f: 11.5, sat: 1.5, o3: 1.5, chol: 142, na: 307, k: 397, ca: 382, mg: 39, fe: 2.9, zn: 1.3, ph: 490, vb: 50, vd: 4.8, ve: 2, h2o: 60 }),
  F("Tuna (canned in water)", 2, { kcal: 116, p: 26, c: 0, f: 0.8, sat: 0.2, o3: 0.3, chol: 47, na: 247, k: 237, ca: 11, mg: 27, fe: 1.5, zn: 0.8, ph: 217, vb: 35, vd: 1.7, h2o: 74 }),
  F("Eggs (whole, cooked)", 1, { kcal: 155, p: 13, c: 1.1, f: 11, sat: 3.3, o3: 0.1, chol: 373, na: 124, k: 126, ca: 50, mg: 10, fe: 1.2, zn: 1, ph: 172, va: 149, vb: 30, vd: 2.2, ve: 1, vk: 0.3, h2o: 75 }),
  F("Whey protein (powder)", 3, { kcal: 400, p: 80, c: 8, f: 5, fib: 1, sug: 5, sat: 3, chol: 150, na: 350, k: 500, ca: 500, mg: 60, fe: 1, zn: 2, ph: 300, vb: 20, h2o: 4 }),
  F("Beans (cooked)", 1, { kcal: 127, p: 8.7, c: 22.8, f: 0.5, fib: 6.4, sug: 0.3, na: 2, k: 405, ca: 28, mg: 45, fe: 2.1, zn: 1, ph: 140, vb: 15, vk: 6, h2o: 66 }),
  F("Lentils (cooked)", 1, { kcal: 116, p: 9, c: 20, f: 0.4, fib: 7.9, sug: 1.8, na: 2, k: 369, ca: 19, mg: 36, fe: 3.3, zn: 1.3, ph: 180, vb: 20, vc: 1.5, h2o: 70 }),
  F("Chickpeas (cooked)", 1, { kcal: 164, p: 8.9, c: 27.4, f: 2.6, fib: 7.6, sug: 4.8, sat: 0.3, na: 7, k: 291, ca: 49, mg: 48, fe: 2.9, zn: 1.5, ph: 168, vb: 18, ve: 0.4, vk: 4, h2o: 60 }),
  // Dairy
  F("Whole milk", 1, { kcal: 61, p: 3.2, c: 4.8, f: 3.3, sug: 5.1, sat: 1.9, chol: 10, na: 43, k: 132, ca: 113, mg: 10, fe: 0, zn: 0.4, ph: 84, va: 46, vb: 12, vd: 1.3, h2o: 88 }),
  F("Greek yogurt (plain)", 2, { kcal: 59, p: 10, c: 3.6, f: 0.4, sug: 3.2, sat: 0.1, chol: 5, na: 36, k: 141, ca: 110, mg: 11, fe: 0.1, zn: 0.5, ph: 135, vb: 15, h2o: 85 }),
  F("Cheddar cheese", 2, { kcal: 403, p: 25, c: 1.3, f: 33, sug: 0.5, sat: 21, chol: 105, na: 621, k: 98, ca: 721, mg: 28, fe: 0.7, zn: 3.1, ph: 512, va: 265, vb: 12, vd: 0.6, ve: 0.7, vk: 2.9, h2o: 37 }),
  // Vegetables
  F("Sukuma wiki (collard greens)", 1, { kcal: 33, p: 3, c: 5.4, f: 0.6, fib: 4, sug: 0.5, na: 17, k: 213, ca: 232, mg: 27, fe: 0.5, zn: 0.2, ph: 25, va: 380, vb: 10, vc: 35, ve: 1.7, vk: 437, h2o: 90 }),
  F("Spinach (cooked)", 1, { kcal: 23, p: 3, c: 3.8, f: 0.3, fib: 2.4, sug: 0.4, na: 70, k: 466, ca: 136, mg: 87, fe: 3.6, zn: 0.8, ph: 56, va: 524, vb: 15, vc: 10, ve: 2.1, vk: 494, h2o: 91 }),
  F("Broccoli (cooked)", 1, { kcal: 35, p: 2.4, c: 7.2, f: 0.4, fib: 3.3, sug: 1.4, na: 41, k: 293, ca: 40, mg: 21, fe: 0.7, zn: 0.5, ph: 67, va: 77, vb: 12, vc: 65, ve: 1.5, vk: 141, h2o: 89 }),
  F("Cabbage (cooked)", 1, { kcal: 23, p: 1.3, c: 5.5, f: 0.1, fib: 1.9, sug: 2.8, na: 8, k: 196, ca: 48, mg: 15, fe: 0.2, zn: 0.2, ph: 33, va: 4, vb: 8, vc: 37, vk: 109, h2o: 92 }),
  F("Tomato", 1, { kcal: 18, p: 0.9, c: 3.9, f: 0.2, fib: 1.2, sug: 2.6, na: 5, k: 237, ca: 10, mg: 11, fe: 0.3, zn: 0.2, ph: 24, va: 42, vb: 6, vc: 14, ve: 0.5, vk: 8, h2o: 94 }),
  F("Carrot", 1, { kcal: 41, p: 0.9, c: 9.6, f: 0.2, fib: 2.8, sug: 4.7, na: 69, k: 320, ca: 33, mg: 12, fe: 0.3, zn: 0.2, ph: 35, va: 835, vb: 8, vc: 6, ve: 0.7, vk: 13, h2o: 88 }),
  F("Onion", 1, { kcal: 40, p: 1.1, c: 9.3, f: 0.1, fib: 1.7, sug: 4.2, na: 4, k: 146, ca: 23, mg: 10, fe: 0.2, zn: 0.2, ph: 29, vb: 6, vc: 7, vk: 0.4, h2o: 89 }),
  F("Avocado", 1, { kcal: 160, p: 2, c: 8.5, f: 14.7, fib: 6.7, sug: 0.7, sat: 2.1, o3: 0.1, na: 7, k: 485, ca: 12, mg: 29, fe: 0.6, zn: 0.6, ph: 52, va: 7, vb: 18, vc: 10, ve: 2.1, vk: 21, h2o: 73 }),
  // Fruits
  F("Banana", 1, { kcal: 89, p: 1.1, c: 22.8, f: 0.3, fib: 2.6, sug: 12.2, na: 1, k: 358, ca: 5, mg: 27, fe: 0.3, zn: 0.2, ph: 22, va: 3, vb: 15, vc: 8.7, ve: 0.1, vk: 0.5, h2o: 75 }),
  F("Mango", 1, { kcal: 60, p: 0.8, c: 15, f: 0.4, fib: 1.6, sug: 13.7, na: 1, k: 168, ca: 11, mg: 10, fe: 0.2, zn: 0.1, ph: 14, va: 54, vb: 8, vc: 36, ve: 0.9, vk: 4, h2o: 83 }),
  F("Orange", 1, { kcal: 47, p: 0.9, c: 11.8, f: 0.1, fib: 2.4, sug: 9.4, na: 0, k: 181, ca: 40, mg: 10, fe: 0.1, zn: 0.1, ph: 14, va: 11, vb: 8, vc: 53, ve: 0.2, h2o: 87 }),
  F("Apple", 1, { kcal: 52, p: 0.3, c: 13.8, f: 0.2, fib: 2.4, sug: 10.4, na: 1, k: 107, ca: 6, mg: 5, fe: 0.1, zn: 0, ph: 11, va: 3, vb: 3, vc: 4.6, ve: 0.2, vk: 2.2, h2o: 86 }),
  F("Watermelon", 1, { kcal: 30, p: 0.6, c: 7.6, f: 0.2, fib: 0.4, sug: 6.2, na: 1, k: 112, ca: 7, mg: 10, fe: 0.2, zn: 0.1, ph: 11, va: 28, vb: 4, vc: 8.1, h2o: 91 }),
  // Fats, nuts, extras
  F("Peanut butter", 3, { kcal: 588, p: 25, c: 20, f: 50, fib: 6, sug: 9, sat: 10, na: 426, k: 649, ca: 43, mg: 154, fe: 1.9, zn: 2.5, ph: 358, vb: 25, ve: 9, vk: 0.6, h2o: 1 }),
  F("Almonds", 1, { kcal: 579, p: 21, c: 21.6, f: 49.9, fib: 12.5, sug: 4.4, sat: 3.8, na: 1, k: 733, ca: 269, mg: 270, fe: 3.7, zn: 3.1, ph: 481, vb: 20, ve: 25.6, h2o: 4 }),
  F("Olive oil", 2, { kcal: 884, p: 0, c: 0, f: 100, sat: 13.8, o3: 0.8, na: 2, ve: 14.4, vk: 60, h2o: 0 }),
  F("Dark chocolate (70%)", 3, { kcal: 598, p: 7.8, c: 45.9, f: 42.6, fib: 10.9, sug: 24, sat: 24.5, na: 20, k: 715, ca: 73, mg: 228, fe: 11.9, zn: 3.3, ph: 308, vb: 6, vk: 7.3, h2o: 1 }),
  F("Honey", 2, { kcal: 304, p: 0.3, c: 82.4, f: 0, sug: 82.1, na: 4, k: 52, ca: 6, mg: 2, fe: 0.4, zn: 0.2, ph: 4, vb: 2, vc: 0.5, h2o: 17 }),
  // Processed / treats (logged honestly)
  F("Mandazi", 4, { kcal: 350, p: 6, c: 45, f: 16, fib: 1.5, sug: 8, sat: 7, chol: 20, na: 250, k: 90, ca: 40, mg: 15, fe: 1.5, zn: 0.5, ph: 80, vb: 6, h2o: 30 }),
  F("French fries", 4, { kcal: 312, p: 3.4, c: 41, f: 15, fib: 3.8, sug: 0.3, sat: 2.3, na: 210, k: 579, ca: 12, mg: 27, fe: 0.7, zn: 0.4, ph: 100, vb: 10, vc: 4, ve: 1.6, vk: 16, h2o: 39 }),
  F("Beef burger (fast food)", 4, { kcal: 254, p: 12.2, c: 30, f: 9.7, fib: 1.5, sug: 6, sat: 3.5, chol: 30, na: 497, k: 190, ca: 100, mg: 20, fe: 2.4, zn: 2, ph: 120, vb: 12, h2o: 45 }),
  F("Pizza (cheese)", 4, { kcal: 266, p: 11, c: 33, f: 10, fib: 2.3, sug: 3.6, sat: 4.5, chol: 17, na: 598, k: 172, ca: 188, mg: 20, fe: 2.5, zn: 1.4, ph: 205, va: 74, vb: 12, ve: 0.7, vk: 4, h2o: 42 }),
  F("Soda (cola)", 4, { kcal: 42, p: 0, c: 10.6, f: 0, sug: 10.6, na: 4, k: 2, ph: 10, h2o: 89 }),
  F("Fruit juice (packaged)", 4, { kcal: 46, p: 0.5, c: 11, f: 0.1, fib: 0.2, sug: 9.5, na: 5, k: 150, ca: 10, mg: 10, fe: 0.2, vb: 4, vc: 30, h2o: 88 }),
  F("Tea with milk & sugar", 3, { kcal: 40, p: 1, c: 6.5, f: 1.1, sug: 6, sat: 0.7, chol: 3, na: 15, k: 60, ca: 40, mg: 4, ph: 30, vb: 3, h2o: 91 }),
];

export const SLOTS = [
  { id: "breakfast", l: "Breakfast", icon: "🌅" },
  { id: "lunch",     l: "Lunch",     icon: "☀️" },
  { id: "dinner",    l: "Dinner",    icon: "🌙" },
  { id: "snack",     l: "Snacks",    icon: "🍎" },
];

// ── Goals & targets (Mifflin-St Jeor + goal presets) ─────────────────
export const ACTIVITY = [
  { id: 1.2,   l: "Sedentary" },
  { id: 1.375, l: "Light (1-3×/wk)" },
  { id: 1.55,  l: "Moderate (3-5×/wk)" },
  { id: 1.725, l: "Very active (6-7×/wk)" },
  { id: 1.9,   l: "Athlete (2×/day)" },
];
export const GOALS = [
  { id: "muscle",      l: "Muscle gain",   kcalAdj: 0.10,  gkg: 2.0, fatPct: 0.25 },
  { id: "bulk",        l: "Clean bulk",    kcalAdj: 0.07,  gkg: 1.8, fatPct: 0.25 },
  { id: "cut",         l: "Fat loss",      kcalAdj: -0.20, gkg: 2.2, fatPct: 0.25 },
  { id: "maintain",    l: "Maintenance",   kcalAdj: 0,     gkg: 1.6, fatPct: 0.28 },
  { id: "performance", l: "Athletic performance", kcalAdj: 0.05, gkg: 1.8, fatPct: 0.25 },
  { id: "endurance",   l: "Endurance",     kcalAdj: 0.10,  gkg: 1.6, fatPct: 0.22 },
  { id: "strength",    l: "Strength",      kcalAdj: 0.08,  gkg: 2.0, fatPct: 0.28 },
  { id: "health",      l: "General health", kcalAdj: 0,    gkg: 1.2, fatPct: 0.30 },
];

export const DEFAULT_PROFILE = {
  age: 25, sex: "male", heightCm: 175, weightKg: 70,
  activity: 1.55, goal: "maintain", favs: [], overrides: null,
};

export function sanitizeProfile(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const num = (v, d, lo, hi) => (Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : d);
  return {
    age: num(p.age, 25, 10, 100),
    sex: p.sex === "female" ? "female" : "male",
    heightCm: num(p.heightCm, 175, 100, 250),
    weightKg: num(p.weightKg, 70, 30, 250),
    activity: ACTIVITY.some((a) => a.id === +p.activity) ? +p.activity : 1.55,
    goal: GOALS.some((g) => g.id === p.goal) ? p.goal : "maintain",
    favs: Array.isArray(p.favs) ? p.favs.filter((x) => typeof x === "string") : [],
    overrides: p.overrides && typeof p.overrides === "object" && !Array.isArray(p.overrides) ? p.overrides : null,
  };
}

export function calcTargets(profileRaw) {
  const p = sanitizeProfile(profileRaw);
  const goal = GOALS.find((g) => g.id === p.goal);
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
  const kcal = Math.round(bmr * p.activity * (1 + goal.kcalAdj));
  const protein = Math.round(goal.gkg * p.weightKg);
  const fat = Math.round((kcal * goal.fatPct) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const o = p.overrides || {};
  const pick = (key, calc) => (Number.isFinite(+o[key]) && +o[key] > 0 ? Math.round(+o[key]) : calc);
  const outKcal = pick("kcal", kcal);
  return {
    kcal: outKcal, p: pick("p", protein), c: pick("c", carbs), f: pick("f", fat),
    fib: Math.max(20, Math.round((outKcal / 1000) * 14)),
    waterMl: Math.round(p.weightKg * 35),
  };
}

// ── Log sanitation & derivation ──────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_IDS = new Set(SLOTS.map((s) => s.id));

export function sanitizeFoods(raw) {
  return (Array.isArray(raw) ? raw : []).filter(
    (f) => f && typeof f === "object" && typeof f.id === "string" && typeof f.name === "string"
      && f.per100 && typeof f.per100 === "object" && !Array.isArray(f.per100)
  );
}

const cleanN = (n) => {
  const out = {};
  if (n && typeof n === "object" && !Array.isArray(n)) {
    for (const k of NUTRIENT_KEYS) if (Number.isFinite(+n[k])) out[k] = +n[k];
  }
  return out;
};

export function sanitizeNutrition(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [d, entries] of Object.entries(raw)) {
    if (!DATE_RE.test(d) || !Array.isArray(entries)) continue;
    const clean = entries.filter((e) => e && typeof e === "object" && e.id && typeof e.name === "string")
      .map((e) => ({
        id: String(e.id),
        slot: SLOT_IDS.has(e.slot) ? e.slot : "snack",
        time: typeof e.time === "string" ? e.time : "",
        name: e.name,
        grams: Number.isFinite(+e.grams) && +e.grams > 0 ? +e.grams : 0,
        proc: [1, 2, 3, 4].includes(+e.proc) ? +e.proc : 2,
        ...(e.ai ? { ai: true } : {}),
        n: cleanN(e.n),
      }));
    if (clean.length) out[d] = clean;
  }
  return out;
}

// Absolute nutrients for `grams` of a per-100g food. This runs at log time
// AND on every edit, so totals always recompute from source values.
export function scaleNutrients(per100, grams) {
  const f = grams / 100;
  const out = {};
  for (const k of NUTRIENT_KEYS) {
    const v = +per100?.[k];
    if (Number.isFinite(v) && v !== 0) out[k] = Math.round(v * f * 10) / 10;
  }
  return out;
}

export const newEntry = (food, grams, slot, time) => ({
  id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  slot, time: time || "", name: food.name, grams: +grams || 0,
  proc: food.proc || 2, n: scaleNutrients(food.per100, +grams || 0),
});

export function dayTotals(entries) {
  const t = {};
  for (const k of NUTRIENT_KEYS) t[k] = 0;
  for (const e of entries || []) for (const k of NUTRIENT_KEYS) t[k] += +e.n?.[k] || 0;
  for (const k of NUTRIENT_KEYS) t[k] = Math.round(t[k] * 10) / 10;
  t.netC = Math.max(0, Math.round((t.c - t.fib) * 10) / 10);
  t.unsat = Math.max(0, Math.round((t.f - t.sat) * 10) / 10);
  return t;
}

// Coverage of a "more is better" micro vs its daily target, capped at 100.
export const coverage = (totals, key) => {
  const def = NUTRIENTS.find((n) => n.k === key);
  if (!def?.rda) return null;
  return Math.min(100, Math.round(((+totals[key] || 0) / def.rda) * 100));
};

// ── Nutrition score (0-100) — the honest daily grade ─────────────────
// Only graded once something is logged. Penalties, never bonuses:
// kcal drift beyond ±10% of target, protein shortfall, fiber shortfall,
// sugar/sodium excess, and thin micronutrient coverage.
export function nutritionScore(totals, targets) {
  if (!totals || (totals.kcal || 0) <= 0) return null;
  let score = 100;
  const drift = Math.abs(totals.kcal - targets.kcal) / targets.kcal;
  if (drift > 0.1) score -= Math.min(25, Math.round((drift - 0.1) * 100));
  if (totals.p < targets.p) score -= Math.min(25, Math.round((1 - totals.p / targets.p) * 25));
  if (totals.fib < targets.fib) score -= Math.min(15, Math.round((1 - totals.fib / targets.fib) * 15));
  if (totals.sug > 50) score -= Math.min(10, Math.round((totals.sug - 50) / 10));
  if (totals.na > 2300) score -= Math.min(10, Math.round((totals.na - 2300) / 300));
  const covs = MICROS.map((k) => coverage(totals, k)).filter((c) => c != null);
  const avgCov = covs.length ? covs.reduce((s, c) => s + c, 0) / covs.length : 0;
  if (avgCov < 60) score -= Math.min(15, Math.round(((60 - avgCov) / 60) * 15));
  return Math.max(0, Math.min(100, score));
}

// ── Meal / day quality suggestions — actionable, never preachy ───────
export function qualitySuggestions(totals, targets, entries = []) {
  if (!totals || (totals.kcal || 0) <= 0) return [];
  const out = [];
  if (totals.p < targets.p * 0.8) out.push({ icon: "🥩", text: `Protein is at ${Math.round(totals.p)}g of ${targets.p}g — add a palm-sized serving of chicken, fish, eggs or beans.` });
  if (totals.fib < targets.fib * 0.6) out.push({ icon: "🥬", text: `Fiber is low (${Math.round(totals.fib)}g / ${targets.fib}g) — sukuma wiki, beans or fruit close the gap fast.` });
  if (totals.na > 2300) out.push({ icon: "🧂", text: `Sodium is over ${Math.round(totals.na)}mg — go light on salt and processed food for the rest of the day.` });
  if (totals.sug > 50) out.push({ icon: "🍬", text: `Sugars hit ${Math.round(totals.sug)}g — swap the next sweet drink for water or fruit.` });
  if (totals.sat > 22) out.push({ icon: "🧈", text: `Saturated fat is high (${Math.round(totals.sat)}g) — favour fish, avocado or olive oil next meal.` });
  if ((coverage(totals, "o3") ?? 100) < 40) out.push({ icon: "🐟", text: "Omega-3 is thin today — sardines, salmon or tilapia would cover it." });
  const avgProc = entries.length ? entries.reduce((s, e) => s + (e.proc || 2), 0) / entries.length : 0;
  if (avgProc >= 3) out.push({ icon: "🏭", text: "Most of today's food is processed — one whole-food meal shifts the balance." });
  if (totals.kcal > targets.kcal * 1.15) out.push({ icon: "⚖️", text: `${Math.round(totals.kcal - targets.kcal)} kcal over target — a lighter dinner keeps the week on track.` });
  if (!out.length) out.push({ icon: "✅", text: "Well balanced — protein, fiber and micros are all in range. Keep this template." });
  return out.slice(0, 4);
}

// ── Trends & streaks ─────────────────────────────────────────────────
export const dayEntries = (log, ds) => log[ds] || [];

export function nutritionSeries(log, targets, days = 14) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = daysAgoStr(i);
    const t = dayTotals(dayEntries(log, ds));
    out.push({
      label: i === 0 ? "Today" : ds.slice(5),
      kcal: t.kcal || null, protein: t.p || null,
      score: nutritionScore(t, targets),
    });
  }
  return out;
}

// A "healthy day": logged, score ≥ 70. The nutrition streak everything
// else (XP, achievements) keys off.
export function healthyStreaks(log, targets, today = localDateStr()) {
  let current = 0;
  for (let i = statusScore(log, targets, today) != null ? 0 : 1; i < 800; i++) {
    const s = statusScore(log, targets, daysAgoStr(i));
    if (s != null && s >= 70) current++;
    else break;
  }
  let best = 0, run = 0;
  for (let i = 799; i >= 0; i--) {
    const s = statusScore(log, targets, daysAgoStr(i));
    if (s != null && s >= 70) { run++; if (run > best) best = run; }
    else if (daysAgoStr(i) !== today) run = 0;
  }
  return { current, best: Math.max(best, current) };
}
const statusScore = (log, targets, ds) => {
  const entries = log[ds];
  if (!entries?.length) return null;
  return nutritionScore(dayTotals(entries), targets);
};

// ── AI meal estimation ───────────────────────────────────────────────
// Free-text description → Claude estimates the full nutrient panel as
// absolute amounts for the described portion. The user always previews
// and confirms before anything is logged; entries carry ai:true so the
// provenance stays visible, and everything remains editable afterwards.
export const AI_MEAL_SYSTEM = `You are a nutrition estimator for a personal tracker used in Nairobi, Kenya (local dishes are common: ugali, sukuma wiki, githeri, chapati, nyama choma, pilau, mandazi, matoke).
Given a meal description, estimate TOTAL nutrients for the described portion (not per 100 g).
Reply with ONLY a JSON object, no prose, no markdown fences:
{"name": short meal name (max 40 chars), "grams": estimated total weight in grams, "proc": processing level 1-4 (1 whole food, 4 ultra-processed),
 "n": {"kcal": number, "p": protein g, "c": carbs g, "f": fat g, "fib": fiber g, "sug": sugars g, "sat": saturated fat g, "o3": omega-3 g, "chol": cholesterol mg, "na": sodium mg, "k": potassium mg, "ca": calcium mg, "mg": magnesium mg, "fe": iron mg, "zn": zinc mg, "ph": phosphorus mg, "va": vitamin A µg RAE, "vb": B-complex as % of a full day, "vc": vitamin C mg, "vd": vitamin D µg, "ve": vitamin E mg, "vk": vitamin K µg, "h2o": water content g}}
Omit any nutrient you cannot reasonably estimate. Round to 1 decimal. Be realistic about typical serving sizes.`;

export function parseAiEstimate(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let raw;
  try { raw = JSON.parse(m[0]); } catch { return null; }
  if (!raw || typeof raw !== "object") return null;
  const n = cleanN(raw.n);
  if (!(n.kcal > 0) || n.kcal > 6000) return null;
  // clamp everything to sane single-meal ranges — a bad guess must not poison totals
  for (const [k, v] of Object.entries(n)) n[k] = Math.max(0, Math.min(v, k === "kcal" ? 6000 : k === "na" || k === "k" ? 8000 : 3000));
  return {
    name: (typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "AI-estimated meal").slice(0, 40),
    grams: Number.isFinite(+raw.grams) && +raw.grams > 0 ? Math.min(3000, Math.round(+raw.grams)) : 0,
    proc: [1, 2, 3, 4].includes(+raw.proc) ? +raw.proc : 2,
    n,
  };
}

// ── Reports (trailing window) ────────────────────────────────────────
export function nutritionReport(log, targets, days = 7) {
  const dayList = [];
  for (let i = 0; i < days; i++) {
    const ds = daysAgoStr(i);
    const entries = dayEntries(log, ds);
    if (!entries.length) continue;
    const t = dayTotals(entries);
    dayList.push({ ds, t, score: nutritionScore(t, targets), meals: entries.length });
  }
  if (!dayList.length) return { logged: 0 };
  const avg = (fn) => Math.round(dayList.reduce((s, d) => s + fn(d), 0) / dayList.length);
  const avgKcal = avg((d) => d.t.kcal), avgP = avg((d) => d.t.p);
  const avgC = avg((d) => d.t.c), avgF = avg((d) => d.t.f);
  const macroKcal = avgP * 4 + avgC * 4 + avgF * 9 || 1;
  const foodCount = {};
  for (let i = 0; i < days; i++) for (const e of dayEntries(log, daysAgoStr(i))) foodCount[e.name] = (foodCount[e.name] || 0) + 1;
  const topFoods = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const scored = dayList.filter((d) => d.score != null).sort((a, b) => b.score - a.score);
  // deficiencies: micros averaging under 60% coverage across logged days
  const deficiencies = MICROS.map((k) => {
    const cov = Math.round(dayList.reduce((s, d) => s + (coverage(d.t, k) || 0), 0) / dayList.length);
    return { k, l: NUTRIENTS.find((n) => n.k === k).l, cov };
  }).filter((x) => x.cov < 60).sort((a, b) => a.cov - b.cov);
  return {
    logged: dayList.length, days,
    avgKcal, avgP, avgC, avgF,
    split: { p: Math.round((avgP * 4 / macroKcal) * 100), c: Math.round((avgC * 4 / macroKcal) * 100), f: Math.round((avgF * 9 / macroKcal) * 100) },
    avgScore: Math.round(dayList.reduce((s, d) => s + (d.score || 0), 0) / dayList.length),
    proteinHitPct: Math.round((dayList.filter((d) => d.t.p >= targets.p).length / dayList.length) * 100),
    avgMeals: Math.round(dayList.reduce((s, d) => s + d.meals, 0) / dayList.length * 10) / 10,
    topFoods,
    best: scored[0] || null,
    worst: scored.length > 1 ? scored[scored.length - 1] : null,
    deficiencies: deficiencies.slice(0, 5),
  };
}
