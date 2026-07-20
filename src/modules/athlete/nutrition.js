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
// `serving` (optional): a realistic single portion { l: label, g: grams },
// so the add panel can offer a one-tap serving-size selector alongside the
// gram editor. Foods without one fall back to 100 g.
const F = (name, proc, n, serving = null) => ({ id: `db_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, name, proc, per100: n, ...(serving ? { serving } : {}) });
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

  // ── Expanded database (per 100 g, with realistic serving sizes) ──────
  // Premium cuts of meat
  F("Sirloin steak (cooked)", 1, { kcal: 206, p: 27, c: 0, f: 10, sat: 4, chol: 80, na: 55, k: 330, ca: 18, mg: 24, fe: 2.3, zn: 4.5, ph: 210, vb: 40, vd: 0.1, h2o: 60 }, { l: "1 steak", g: 200 }),
  F("Beef tenderloin (cooked)", 1, { kcal: 200, p: 26, c: 0, f: 10, sat: 3.8, chol: 75, na: 52, k: 350, ca: 16, mg: 25, fe: 2.6, zn: 4, ph: 220, vb: 38, vd: 0.1, h2o: 61 }, { l: "1 fillet", g: 180 }),
  F("Ribeye steak (cooked)", 1, { kcal: 291, p: 24, c: 0, f: 21, sat: 9, chol: 85, na: 60, k: 300, ca: 12, mg: 22, fe: 2, zn: 5, ph: 195, vb: 40, vd: 0.1, h2o: 52 }, { l: "1 steak", g: 225 }),
  F("Chicken thighs (cooked)", 1, { kcal: 209, p: 26, c: 0, f: 11, sat: 3, chol: 130, na: 88, k: 230, ca: 12, mg: 23, fe: 1.3, zn: 2.5, ph: 180, vb: 30, vd: 0.1, h2o: 62 }, { l: "1 thigh", g: 90 }),
  F("Lamb ribs (cooked)", 1, { kcal: 361, p: 21, c: 0, f: 30, sat: 13, chol: 95, na: 70, k: 250, ca: 16, mg: 20, fe: 1.8, zn: 4, ph: 170, vb: 25, vd: 0.1, h2o: 48 }, { l: "1 serving", g: 150 }),
  F("Pork belly (cooked)", 2, { kcal: 518, p: 9.3, c: 0, f: 53, sat: 19, chol: 72, na: 32, k: 180, ca: 6, mg: 10, fe: 0.7, zn: 1.5, ph: 120, vb: 12, h2o: 37 }, { l: "1 serving", g: 120 }),
  F("Pork chops (cooked)", 1, { kcal: 231, p: 26, c: 0, f: 14, sat: 4.5, chol: 78, na: 62, k: 360, ca: 20, mg: 25, fe: 0.9, zn: 2.4, ph: 220, vb: 40, vd: 0.8, h2o: 57 }, { l: "1 chop", g: 150 }),
  F("Ossobuco (veal shank, braised)", 1, { kcal: 172, p: 27, c: 0, f: 6, sat: 2.3, chol: 100, na: 80, k: 330, ca: 18, mg: 24, fe: 1.2, zn: 4, ph: 200, vb: 30, h2o: 65 }, { l: "1 piece", g: 200 }),
  // Carbs
  F("Quinoa (cooked)", 1, { kcal: 120, p: 4.4, c: 21.3, f: 1.9, fib: 2.8, sug: 0.9, na: 7, k: 172, ca: 17, mg: 64, fe: 1.5, zn: 1.1, ph: 152, vb: 12, ve: 0.6, h2o: 72 }, { l: "1 cup", g: 185 }),
  // Fruits
  F("Pineapple", 1, { kcal: 50, p: 0.5, c: 13.1, f: 0.1, fib: 1.4, sug: 9.9, na: 1, k: 109, ca: 13, mg: 12, fe: 0.3, zn: 0.1, ph: 8, va: 3, vb: 5, vc: 47.8, h2o: 86 }, { l: "1 slice", g: 80 }),
  F("Strawberries", 1, { kcal: 32, p: 0.7, c: 7.7, f: 0.3, fib: 2, sug: 4.9, na: 1, k: 153, ca: 16, mg: 13, fe: 0.4, zn: 0.1, ph: 24, vc: 58.8, vb: 4, vk: 2.2, h2o: 91 }, { l: "1 cup", g: 150 }),
  F("Blueberries", 1, { kcal: 57, p: 0.7, c: 14.5, f: 0.3, fib: 2.4, sug: 10, na: 1, k: 77, ca: 6, mg: 6, fe: 0.3, zn: 0.2, ph: 12, vc: 9.7, vb: 3, ve: 0.6, vk: 19.3, h2o: 84 }, { l: "1 cup", g: 148 }),
  F("Grapes", 1, { kcal: 69, p: 0.7, c: 18.1, f: 0.2, fib: 0.9, sug: 15.5, na: 2, k: 191, ca: 10, mg: 7, fe: 0.4, zn: 0.1, ph: 20, vc: 3.2, vb: 4, vk: 14.6, h2o: 81 }, { l: "1 cup", g: 150 }),
  // Yoghurt variants (Greek plain is above)
  F("Yoghurt (plain)", 1, { kcal: 61, p: 3.5, c: 4.7, f: 3.3, sug: 4.7, sat: 2.1, chol: 13, na: 46, k: 155, ca: 121, mg: 12, zn: 0.6, ph: 95, va: 27, vb: 12, h2o: 88 }, { l: "1 cup", g: 245 }),
  F("Yoghurt (low-fat)", 1, { kcal: 63, p: 5.3, c: 7, f: 1.6, sug: 7, sat: 1, chol: 6, na: 70, k: 234, ca: 183, mg: 17, zn: 0.9, ph: 144, vb: 14, h2o: 85 }, { l: "1 cup", g: 245 }),
  F("Yoghurt (full-fat)", 1, { kcal: 66, p: 3.5, c: 4.7, f: 3.8, sug: 4.7, sat: 2.4, chol: 14, na: 46, k: 155, ca: 121, mg: 12, zn: 0.6, ph: 95, va: 30, vb: 12, h2o: 87 }, { l: "1 cup", g: 245 }),
  F("Yoghurt (vanilla)", 2, { kcal: 85, p: 5, c: 13.8, f: 1.2, sug: 13.8, sat: 0.8, chol: 5, na: 66, k: 210, ca: 170, mg: 16, ph: 130, vb: 10, h2o: 79 }, { l: "1 pot", g: 150 }),
  F("Yoghurt (fruit / flavoured)", 3, { kcal: 99, p: 3.9, c: 18.6, f: 1.4, sug: 18.6, sat: 0.9, chol: 5, na: 58, k: 180, ca: 152, mg: 14, ph: 120, vb: 8, vc: 1, h2o: 77 }, { l: "1 pot", g: 150 }),
  // Drinks
  F("Fresh fruit juice (squeezed)", 2, { kcal: 45, p: 0.7, c: 10.4, f: 0.2, fib: 0.2, sug: 8.4, na: 1, k: 200, ca: 11, mg: 11, fe: 0.2, ph: 17, vc: 50, vb: 6, h2o: 88 }, { l: "1 glass", g: 250 }),

  // ── Round 2 — comprehensive healthy-food coverage ────────────────────
  // Vegetables
  F("Kale (raw)", 1, { kcal: 49, p: 4.3, c: 8.8, f: 0.9, fib: 3.6, sug: 2.3, na: 38, k: 491, ca: 150, mg: 33, fe: 1.5, zn: 0.6, ph: 55, va: 500, vb: 10, vc: 120, ve: 1.5, vk: 704, h2o: 84 }, { l: "1 cup", g: 130 }),
  F("Bell pepper (red)", 1, { kcal: 31, p: 1, c: 6, f: 0.3, fib: 2.1, sug: 4.2, na: 4, k: 211, ca: 7, mg: 12, fe: 0.4, zn: 0.3, ph: 26, va: 157, vb: 6, vc: 128, ve: 1.6, vk: 4.9, h2o: 92 }, { l: "1 medium", g: 120 }),
  F("Cucumber", 1, { kcal: 15, p: 0.7, c: 3.6, f: 0.1, fib: 0.5, sug: 1.7, na: 2, k: 147, ca: 16, mg: 13, fe: 0.3, zn: 0.2, ph: 24, va: 5, vb: 4, vc: 2.8, vk: 16.4, h2o: 95 }, { l: "1 medium", g: 300 }),
  F("Zucchini (cooked)", 1, { kcal: 17, p: 1.2, c: 3.1, f: 0.3, fib: 1, sug: 2.5, na: 2, k: 261, ca: 15, mg: 18, fe: 0.4, zn: 0.3, ph: 33, va: 10, vb: 8, vc: 9, h2o: 94 }, { l: "1 cup", g: 180 }),
  F("Cauliflower (cooked)", 1, { kcal: 23, p: 1.8, c: 4.1, f: 0.5, fib: 2.3, sug: 1.3, na: 15, k: 142, ca: 16, mg: 9, fe: 0.3, zn: 0.3, ph: 33, vb: 8, vc: 44, vk: 15.5, h2o: 92 }, { l: "1 cup", g: 155 }),
  F("Brussels sprouts (cooked)", 1, { kcal: 36, p: 2.6, c: 7.1, f: 0.5, fib: 3.3, sug: 1.9, na: 20, k: 317, ca: 36, mg: 21, fe: 1.1, zn: 0.4, ph: 60, va: 38, vb: 10, vc: 62, vk: 140, h2o: 87 }, { l: "1 cup", g: 155 }),
  F("Asparagus (cooked)", 1, { kcal: 22, p: 2.4, c: 4.1, f: 0.2, fib: 2, sug: 1.3, na: 14, k: 224, ca: 24, mg: 14, fe: 0.9, zn: 0.4, ph: 52, va: 60, vb: 12, vc: 7.7, ve: 1.5, vk: 51, h2o: 92 }, { l: "6 spears", g: 90 }),
  F("Green beans (cooked)", 1, { kcal: 35, p: 1.9, c: 8, f: 0.3, fib: 3.4, sug: 3.3, na: 3, k: 209, ca: 44, mg: 22, fe: 0.9, zn: 0.3, ph: 34, va: 35, vb: 8, vc: 9.7, vk: 43, h2o: 89 }, { l: "1 cup", g: 125 }),
  F("Green peas (cooked)", 1, { kcal: 84, p: 5.4, c: 15.6, f: 0.4, fib: 5.7, sug: 5.9, na: 3, k: 244, ca: 27, mg: 33, fe: 1.5, zn: 1.2, ph: 108, va: 40, vb: 15, vc: 14.2, vk: 25, h2o: 78 }, { l: "1 cup", g: 160 }),
  F("Beetroot (cooked)", 1, { kcal: 44, p: 1.7, c: 10, f: 0.2, fib: 2, sug: 8, na: 77, k: 305, ca: 16, mg: 23, fe: 0.8, zn: 0.4, ph: 38, vb: 8, vc: 3.6, vk: 0.2, h2o: 87 }, { l: "1 medium", g: 82 }),
  F("Butternut squash (cooked)", 1, { kcal: 40, p: 0.9, c: 10.5, f: 0.1, fib: 1.6, sug: 2.2, na: 4, k: 352, ca: 30, mg: 22, fe: 0.5, zn: 0.2, ph: 24, va: 558, vb: 8, vc: 15.5, ve: 1.3, vk: 1.1, h2o: 87 }, { l: "1 cup", g: 205 }),
  F("Pumpkin (cooked)", 1, { kcal: 20, p: 0.7, c: 4.9, f: 0.1, fib: 1.1, sug: 2.1, na: 1, k: 230, ca: 15, mg: 9, fe: 0.6, zn: 0.2, ph: 28, va: 426, vb: 8, vc: 4.7, h2o: 94 }, { l: "1 cup", g: 245 }),
  F("Eggplant (cooked)", 1, { kcal: 35, p: 0.8, c: 8.6, f: 0.2, fib: 2.5, sug: 3.2, na: 1, k: 123, ca: 6, mg: 11, fe: 0.2, zn: 0.1, ph: 15, vb: 6, vc: 1.3, vk: 3.5, h2o: 89 }, { l: "1 cup", g: 99 }),
  F("Okra (cooked)", 1, { kcal: 33, p: 1.9, c: 7.5, f: 0.2, fib: 3.2, sug: 1.5, na: 8, k: 299, ca: 82, mg: 57, fe: 0.6, zn: 0.6, ph: 63, va: 36, vb: 10, vc: 21, vk: 40, h2o: 90 }, { l: "1 cup", g: 160 }),
  F("Celery", 1, { kcal: 14, p: 0.7, c: 3, f: 0.2, fib: 1.6, sug: 1.3, na: 80, k: 260, ca: 40, mg: 11, fe: 0.2, zn: 0.1, ph: 24, va: 22, vb: 5, vc: 3.1, vk: 29.3, h2o: 95 }, { l: "1 stalk", g: 40 }),
  F("Mushrooms (cooked)", 1, { kcal: 28, p: 3.1, c: 5.3, f: 0.5, fib: 1.9, sug: 1.9, na: 4, k: 356, ca: 3, mg: 11, fe: 0.6, zn: 0.8, ph: 97, vb: 25, vd: 0.2, h2o: 90 }, { l: "1 cup", g: 156 }),
  F("Garlic", 1, { kcal: 149, p: 6.4, c: 33, f: 0.5, fib: 2.1, sug: 1, na: 17, k: 401, ca: 181, mg: 25, fe: 1.7, zn: 1.2, ph: 153, vb: 10, vc: 31.2, vk: 1.7, h2o: 59 }, { l: "3 cloves", g: 9 }),
  F("Ginger", 1, { kcal: 80, p: 1.8, c: 17.8, f: 0.8, fib: 2, sug: 1.7, na: 13, k: 415, ca: 16, mg: 43, fe: 0.6, zn: 0.3, ph: 34, vb: 6, vc: 5, h2o: 79 }, { l: "1 tbsp", g: 6 }),
  F("Managu (African nightshade, cooked)", 1, { kcal: 33, p: 3.5, c: 5.5, f: 0.4, fib: 2.8, sug: 1, na: 15, k: 380, ca: 280, mg: 45, fe: 3.5, zn: 0.5, ph: 55, va: 450, vb: 10, vc: 40, vk: 350, h2o: 89 }, { l: "1 serving", g: 120 }),
  F("Terere (amaranth leaves, cooked)", 1, { kcal: 21, p: 2.1, c: 3.7, f: 0.3, fib: 1.8, sug: 0.5, na: 20, k: 611, ca: 209, mg: 65, fe: 2.3, zn: 0.7, ph: 50, va: 366, vb: 12, vc: 28, vk: 900, h2o: 91 }, { l: "1 serving", g: 120 }),
  F("Kunde (cowpea leaves, cooked)", 1, { kcal: 30, p: 4, c: 4.8, f: 0.5, fib: 2, sug: 0.8, na: 12, k: 350, ca: 200, mg: 60, fe: 3, zn: 0.6, ph: 60, va: 300, vb: 10, vc: 30, h2o: 88 }, { l: "1 serving", g: 120 }),
  F("Radish", 1, { kcal: 16, p: 0.7, c: 3.4, f: 0.1, fib: 1.6, sug: 1.9, na: 39, k: 233, ca: 25, mg: 10, fe: 0.3, zn: 0.3, ph: 20, vb: 4, vc: 14.8, vk: 1.3, h2o: 95 }, { l: "1 cup sliced", g: 116 }),
  F("Leeks (cooked)", 1, { kcal: 31, p: 0.8, c: 7.3, f: 0.2, fib: 0.9, sug: 1.9, na: 10, k: 90, ca: 40, mg: 22, fe: 1.1, zn: 0.4, ph: 27, va: 3, vb: 6, vc: 6, vk: 27, h2o: 91 }, { l: "1 cup", g: 124 }),
  F("Lettuce (romaine)", 1, { kcal: 17, p: 1.2, c: 3.3, f: 0.3, fib: 2.1, sug: 1.2, na: 8, k: 247, ca: 33, mg: 14, fe: 1, zn: 0.2, ph: 30, va: 436, vb: 8, vc: 4, vk: 102.5, h2o: 95 }, { l: "1 cup", g: 47 }),
  F("Arugula / rocket", 1, { kcal: 25, p: 2.6, c: 3.7, f: 0.7, fib: 1.6, sug: 2.1, na: 27, k: 369, ca: 160, mg: 47, fe: 1.5, zn: 0.5, ph: 52, va: 119, vb: 10, vc: 15, vk: 108.6, h2o: 92 }, { l: "1 cup", g: 20 }),
  // Fruits
  F("Kiwi", 1, { kcal: 61, p: 1.1, c: 14.7, f: 0.5, fib: 3, sug: 9, na: 3, k: 312, ca: 34, mg: 17, fe: 0.3, zn: 0.1, ph: 34, vc: 92.7, vb: 4, ve: 1.5, vk: 40.3, h2o: 83 }, { l: "1 medium", g: 76 }),
  F("Pear", 1, { kcal: 57, p: 0.4, c: 15.2, f: 0.1, fib: 3.1, sug: 9.8, na: 1, k: 116, ca: 9, mg: 7, fe: 0.2, zn: 0.1, ph: 12, vc: 4.3, vb: 3, vk: 4.5, h2o: 84 }, { l: "1 medium", g: 178 }),
  F("Peach", 1, { kcal: 39, p: 0.9, c: 9.5, f: 0.3, fib: 1.5, sug: 8.4, na: 0, k: 190, ca: 6, mg: 9, fe: 0.3, zn: 0.2, ph: 20, va: 16, vb: 6, vc: 6.6, ve: 0.7, vk: 2.6, h2o: 89 }, { l: "1 medium", g: 150 }),
  F("Plum", 1, { kcal: 46, p: 0.7, c: 11.4, f: 0.3, fib: 1.4, sug: 9.9, na: 0, k: 157, ca: 6, mg: 7, fe: 0.2, zn: 0.1, ph: 16, va: 17, vb: 4, vc: 9.5, h2o: 87 }, { l: "1 medium", g: 66 }),
  F("Papaya (pawpaw)", 1, { kcal: 43, p: 0.5, c: 10.8, f: 0.3, fib: 1.7, sug: 7.8, na: 8, k: 182, ca: 20, mg: 21, fe: 0.3, zn: 0.1, ph: 10, va: 47, vb: 6, vc: 60.9, ve: 0.3, vk: 2.6, h2o: 88 }, { l: "1 cup", g: 145 }),
  F("Passion fruit", 1, { kcal: 97, p: 2.2, c: 23.4, f: 0.7, fib: 10.4, sug: 11.2, na: 28, k: 348, ca: 12, mg: 29, fe: 1.6, zn: 0.1, ph: 68, va: 64, vb: 8, vc: 30, h2o: 73 }, { l: "1 fruit", g: 18 }),
  F("Guava", 1, { kcal: 68, p: 2.6, c: 14.3, f: 1, fib: 5.4, sug: 8.9, na: 2, k: 417, ca: 18, mg: 22, fe: 0.3, zn: 0.2, ph: 40, va: 31, vb: 8, vc: 228.3, h2o: 81 }, { l: "1 fruit", g: 55 }),
  F("Pomegranate (seeds)", 1, { kcal: 83, p: 1.7, c: 18.7, f: 1.2, fib: 4, sug: 13.7, na: 3, k: 236, ca: 10, mg: 12, fe: 0.3, zn: 0.4, ph: 36, vb: 8, vc: 10.2, vk: 16.4, h2o: 78 }, { l: "½ cup", g: 87 }),
  F("Lemon", 1, { kcal: 29, p: 1.1, c: 9.3, f: 0.3, fib: 2.8, sug: 2.5, na: 2, k: 138, ca: 26, mg: 8, fe: 0.6, zn: 0.1, ph: 16, vc: 53, vb: 4, h2o: 89 }, { l: "1 fruit", g: 58 }),
  F("Lime", 1, { kcal: 30, p: 0.7, c: 10.5, f: 0.2, fib: 2.8, sug: 1.7, na: 2, k: 102, ca: 33, mg: 6, fe: 0.6, zn: 0.1, ph: 18, vc: 29.1, vb: 3, h2o: 88 }, { l: "1 fruit", g: 67 }),
  F("Grapefruit", 1, { kcal: 42, p: 0.8, c: 10.7, f: 0.1, fib: 1.6, sug: 6.9, na: 0, k: 166, ca: 12, mg: 9, fe: 0.1, zn: 0.1, ph: 8, va: 46, vb: 5, vc: 33.3, h2o: 88 }, { l: "½ fruit", g: 123 }),
  F("Dates (dried)", 2, { kcal: 277, p: 1.8, c: 75, f: 0.2, fib: 6.7, sug: 66, na: 1, k: 696, ca: 64, mg: 54, fe: 0.9, zn: 0.4, ph: 62, vb: 8, vk: 2.7, h2o: 21 }, { l: "3 dates", g: 75 }),
  F("Figs (fresh)", 1, { kcal: 74, p: 0.8, c: 19.2, f: 0.3, fib: 2.9, sug: 16.3, na: 1, k: 232, ca: 35, mg: 17, fe: 0.4, zn: 0.2, ph: 14, va: 7, vb: 5, vc: 2, vk: 4.7, h2o: 79 }, { l: "2 figs", g: 100 }),
  F("Raisins", 2, { kcal: 299, p: 3.1, c: 79.2, f: 0.5, fib: 3.7, sug: 59.2, na: 11, k: 749, ca: 50, mg: 32, fe: 1.9, zn: 0.2, ph: 101, vb: 6, h2o: 15 }, { l: "1 small box", g: 40 }),
  F("Coconut (fresh, meat)", 2, { kcal: 354, p: 3.3, c: 15.2, f: 33.5, fib: 9, sug: 6.2, sat: 29.7, na: 20, k: 356, ca: 14, mg: 32, fe: 2.4, zn: 1.1, ph: 113, vb: 4, vc: 3.3, h2o: 47 }, { l: "1 cup", g: 80 }),
  F("Tangerine / mandarin", 1, { kcal: 53, p: 0.8, c: 13.3, f: 0.3, fib: 1.8, sug: 10.6, na: 2, k: 166, ca: 37, mg: 12, fe: 0.2, zn: 0.1, ph: 20, va: 34, vb: 6, vc: 26.7, h2o: 85 }, { l: "1 fruit", g: 88 }),
  F("Blackberries", 1, { kcal: 43, p: 1.4, c: 9.6, f: 0.5, fib: 5.3, sug: 4.9, na: 1, k: 162, ca: 29, mg: 20, fe: 0.6, zn: 0.5, ph: 22, vc: 21, vb: 4, ve: 1.2, vk: 19.8, h2o: 88 }, { l: "1 cup", g: 144 }),
  F("Raspberries", 1, { kcal: 52, p: 1.2, c: 11.9, f: 0.7, fib: 6.5, sug: 4.4, na: 1, k: 151, ca: 25, mg: 22, fe: 0.7, zn: 0.4, ph: 29, vc: 26.2, vb: 4, ve: 0.9, vk: 7.8, h2o: 86 }, { l: "1 cup", g: 123 }),
  F("Cherries", 1, { kcal: 63, p: 1.1, c: 16, f: 0.2, fib: 2.1, sug: 12.8, na: 0, k: 222, ca: 13, mg: 11, fe: 0.4, zn: 0.1, ph: 21, va: 3, vb: 4, vc: 7, h2o: 82 }, { l: "1 cup", g: 138 }),
  F("Apricot", 1, { kcal: 48, p: 1.4, c: 11.1, f: 0.4, fib: 2, sug: 9.2, na: 1, k: 259, ca: 13, mg: 10, fe: 0.4, zn: 0.2, ph: 23, va: 96, vb: 6, vc: 10, h2o: 86 }, { l: "3 fruits", g: 105 }),
  // Whole grains & starches
  F("Millet (cooked)", 1, { kcal: 119, p: 3.5, c: 23.7, f: 1, fib: 1.3, sug: 0.2, na: 2, k: 62, ca: 3, mg: 44, fe: 0.6, zn: 1.1, ph: 100, vb: 10, h2o: 71 }, { l: "1 cup", g: 174 }),
  F("Sorghum (cooked)", 1, { kcal: 109, p: 3.6, c: 23.9, f: 1, fib: 1.9, sug: 0.2, na: 2, k: 122, ca: 7, mg: 0, fe: 1.1, zn: 0.4, ph: 0, vb: 8, h2o: 70 }, { l: "1 cup", g: 192 }),
  F("Barley (cooked)", 1, { kcal: 123, p: 2.3, c: 28.2, f: 0.4, fib: 3.8, sug: 0.4, na: 3, k: 93, ca: 11, mg: 22, fe: 1.3, zn: 1, ph: 63, vb: 10, h2o: 69 }, { l: "1 cup", g: 157 }),
  F("Buckwheat (cooked)", 1, { kcal: 92, p: 3.4, c: 19.9, f: 0.6, fib: 2.7, sug: 0.9, na: 1, k: 88, ca: 7, mg: 51, fe: 0.8, zn: 0.7, ph: 70, vb: 8, h2o: 75 }, { l: "1 cup", g: 168 }),
  F("Couscous (cooked)", 2, { kcal: 112, p: 3.8, c: 23.2, f: 0.2, fib: 1.4, sug: 0.1, na: 5, k: 58, ca: 8, mg: 8, fe: 0.4, zn: 0.3, ph: 32, vb: 6, h2o: 73 }, { l: "1 cup", g: 157 }),
  F("Cassava (boiled)", 1, { kcal: 112, p: 0.8, c: 27.1, f: 0.2, fib: 1.4, sug: 1.5, na: 6, k: 172, ca: 12, mg: 22, fe: 0.3, zn: 0.3, ph: 25, vc: 14.4, vb: 8, h2o: 70 }, { l: "1 cup", g: 206 }),
  F("Yam (boiled)", 1, { kcal: 116, p: 1.5, c: 27.5, f: 0.1, fib: 3.9, sug: 0.5, na: 6, k: 670, ca: 17, mg: 21, fe: 0.5, zn: 0.2, ph: 55, vc: 15, vb: 8, h2o: 70 }, { l: "1 cup", g: 150 }),
  F("Arrowroot (nduma, cooked)", 1, { kcal: 98, p: 1.3, c: 23.7, f: 0.1, fib: 3.4, sug: 0.5, na: 11, k: 502, ca: 20, mg: 24, fe: 1, zn: 0.3, ph: 45, vc: 8.2, vb: 6, h2o: 74 }, { l: "1 serving", g: 150 }),
  F("Bulgur wheat (cooked)", 1, { kcal: 83, p: 3.1, c: 18.6, f: 0.2, fib: 4.5, sug: 0.1, na: 5, k: 68, ca: 10, mg: 21, fe: 0.9, zn: 0.5, ph: 36, vb: 8, h2o: 78 }, { l: "1 cup", g: 182 }),
  // Legumes & pulses
  F("Black beans (cooked)", 1, { kcal: 132, p: 8.9, c: 23.7, f: 0.5, fib: 8.7, sug: 0.3, na: 1, k: 355, ca: 27, mg: 70, fe: 2.1, zn: 1.1, ph: 140, vb: 15, h2o: 66 }, { l: "1 cup", g: 172 }),
  F("Kidney beans (cooked)", 1, { kcal: 127, p: 8.7, c: 22.8, f: 0.5, fib: 6.4, sug: 0.3, na: 2, k: 405, ca: 28, mg: 45, fe: 2.9, zn: 1, ph: 140, vb: 15, h2o: 67 }, { l: "1 cup", g: 177 }),
  F("Pinto beans (cooked)", 1, { kcal: 143, p: 9, c: 26.2, f: 0.7, fib: 9, sug: 0.3, na: 1, k: 436, ca: 46, mg: 50, fe: 2.1, zn: 1, ph: 147, vb: 15, h2o: 64 }, { l: "1 cup", g: 171 }),
  F("Split peas (cooked)", 1, { kcal: 118, p: 8.3, c: 21.1, f: 0.4, fib: 8.3, sug: 3.1, na: 2, k: 296, ca: 22, mg: 30, fe: 1.9, zn: 1, ph: 130, vb: 15, h2o: 70 }, { l: "1 cup", g: 196 }),
  F("Edamame (cooked)", 1, { kcal: 121, p: 11.9, c: 8.9, f: 5.2, fib: 5.2, sug: 2.2, sat: 0.6, na: 6, k: 436, ca: 63, mg: 64, fe: 2.3, zn: 1.4, ph: 194, vb: 20, vc: 9.7, vk: 26, h2o: 71 }, { l: "1 cup", g: 155 }),
  F("Green grams (ndengu, cooked)", 1, { kcal: 105, p: 7.5, c: 19.2, f: 0.4, fib: 7.6, sug: 2, na: 4, k: 266, ca: 27, mg: 48, fe: 1.4, zn: 0.8, ph: 99, vb: 15, h2o: 71 }, { l: "1 cup", g: 200 }),
  F("Black-eyed peas / kunde beans (cooked)", 1, { kcal: 116, p: 7.7, c: 20.8, f: 0.5, fib: 6.5, sug: 3.3, na: 4, k: 278, ca: 24, mg: 53, fe: 2.3, zn: 1.3, ph: 145, vb: 18, vc: 0.8, h2o: 70 }, { l: "1 cup", g: 172 }),
  F("Soybeans (cooked)", 1, { kcal: 173, p: 16.6, c: 9.9, f: 9, fib: 6, sug: 2.9, sat: 1.3, o3: 0.3, na: 2, k: 515, ca: 102, mg: 86, fe: 5.1, zn: 1.6, ph: 245, vb: 25, vk: 33, h2o: 63 }, { l: "1 cup", g: 172 }),
  // Nuts & seeds
  F("Walnuts", 1, { kcal: 654, p: 15.2, c: 13.7, f: 65.2, fib: 6.7, sug: 2.6, sat: 6.1, o3: 9.1, na: 2, k: 441, ca: 98, mg: 158, fe: 2.9, zn: 3.1, ph: 346, vb: 20, ve: 0.7, vk: 2.7, h2o: 4 }, { l: "1 handful", g: 28 }),
  F("Cashews", 1, { kcal: 553, p: 18.2, c: 30.2, f: 43.9, fib: 3.3, sug: 5.9, sat: 7.8, na: 12, k: 660, ca: 37, mg: 292, fe: 6.7, zn: 5.8, ph: 593, vb: 15, vk: 34.7, h2o: 5 }, { l: "1 handful", g: 28 }),
  F("Pistachios", 1, { kcal: 560, p: 20.2, c: 27.2, f: 45.3, fib: 10.6, sug: 7.7, sat: 5.4, na: 1, k: 1025, ca: 105, mg: 121, fe: 3.9, zn: 2.2, ph: 490, va: 26, vb: 25, vc: 5.6, ve: 2.9, vk: 13.2, h2o: 4 }, { l: "1 handful", g: 28 }),
  F("Chia seeds", 1, { kcal: 486, p: 16.5, c: 42.1, f: 30.7, fib: 34.4, sat: 3.3, o3: 17.8, na: 16, k: 407, ca: 631, mg: 335, fe: 7.7, zn: 4.6, ph: 860, vb: 15, h2o: 6 }, { l: "1 tbsp", g: 12 }),
  F("Flaxseeds", 1, { kcal: 534, p: 18.3, c: 28.9, f: 42.2, fib: 27.3, sug: 1.6, sat: 3.7, o3: 22.8, na: 30, k: 813, ca: 255, mg: 392, fe: 5.7, zn: 4.3, ph: 642, vb: 20, h2o: 7 }, { l: "1 tbsp", g: 10 }),
  F("Sunflower seeds", 1, { kcal: 584, p: 20.8, c: 20, f: 51.5, fib: 8.6, sug: 2.6, sat: 4.5, na: 9, k: 645, ca: 78, mg: 325, fe: 5.3, zn: 5, ph: 660, vb: 25, ve: 35.2, h2o: 5 }, { l: "1 handful", g: 28 }),
  F("Pumpkin seeds", 1, { kcal: 559, p: 30.2, c: 10.7, f: 49, fib: 6, sug: 1.4, sat: 8.7, na: 7, k: 809, ca: 46, mg: 592, fe: 8.8, zn: 7.8, ph: 1233, vb: 20, vk: 7.3, h2o: 5 }, { l: "1 handful", g: 28 }),
  F("Sesame seeds", 1, { kcal: 573, p: 17.7, c: 23.5, f: 49.7, fib: 11.8, sug: 0.3, sat: 7, na: 11, k: 468, ca: 975, mg: 351, fe: 14.6, zn: 7.8, ph: 629, vb: 15, h2o: 5 }, { l: "1 tbsp", g: 9 }),
  F("Macadamia nuts", 1, { kcal: 718, p: 7.9, c: 13.8, f: 75.8, fib: 8.6, sug: 4.6, sat: 12.1, na: 5, k: 368, ca: 85, mg: 130, fe: 3.7, zn: 1.3, ph: 188, vb: 10, ve: 0.5, h2o: 1.4 }, { l: "1 handful", g: 28 }),
  F("Hazelnuts", 1, { kcal: 628, p: 15, c: 16.7, f: 60.8, fib: 9.7, sug: 4.3, sat: 4.5, na: 0, k: 680, ca: 114, mg: 163, fe: 4.7, zn: 2.5, ph: 290, vb: 20, ve: 15, vk: 14.2, h2o: 5 }, { l: "1 handful", g: 28 }),
  F("Brazil nuts", 1, { kcal: 659, p: 14.3, c: 12.3, f: 67.1, fib: 7.5, sug: 2.3, sat: 15.1, na: 3, k: 659, ca: 160, mg: 376, fe: 2.4, zn: 4.1, ph: 725, vb: 12, ve: 5.7, h2o: 3 }, { l: "3 nuts", g: 15 }),
  // Proteins & seafood
  F("Turkey breast (cooked)", 1, { kcal: 135, p: 30, c: 0, f: 1, sat: 0.3, chol: 65, na: 45, k: 250, ca: 10, mg: 26, fe: 1.2, zn: 1.5, ph: 195, vb: 40, h2o: 66 }, { l: "1 serving", g: 120 }),
  F("Duck breast (cooked)", 1, { kcal: 201, p: 23.5, c: 0, f: 11.2, sat: 3.9, chol: 89, na: 65, k: 270, ca: 11, mg: 18, fe: 2.7, zn: 1.9, ph: 188, vb: 30, h2o: 63 }, { l: "1 breast", g: 150 }),
  F("Shrimp / prawns (cooked)", 1, { kcal: 99, p: 24, c: 0.2, f: 0.3, chol: 189, na: 111, k: 259, ca: 70, mg: 39, fe: 0.5, zn: 1.6, ph: 116, o3: 0.3, vb: 12, h2o: 76 }, { l: "6 large", g: 90 }),
  F("Crab meat (cooked)", 1, { kcal: 97, p: 20.5, c: 0, f: 1.5, sat: 0.2, chol: 78, na: 293, k: 262, ca: 89, mg: 43, fe: 0.7, zn: 4.2, ph: 238, o3: 0.4, vb: 25, h2o: 78 }, { l: "1 cup", g: 120 }),
  F("Mussels (cooked)", 1, { kcal: 172, p: 24, c: 7.4, f: 4.5, sat: 0.9, chol: 56, na: 369, k: 320, ca: 33, mg: 34, fe: 6.7, zn: 2.2, ph: 285, o3: 0.6, vb: 40, h2o: 68 }, { l: "1 cup", g: 145 }),
  F("Octopus (cooked)", 1, { kcal: 164, p: 29.8, c: 4.4, f: 2.1, chol: 96, na: 460, k: 630, ca: 90, mg: 50, fe: 5.3, zn: 2, ph: 233, o3: 0.2, vb: 30, h2o: 68 }, { l: "1 serving", g: 120 }),
  F("Mackerel (cooked)", 1, { kcal: 205, p: 19, c: 0, f: 14, sat: 3.3, o3: 2.6, chol: 70, na: 90, k: 320, ca: 13, mg: 76, fe: 1.6, zn: 0.8, ph: 217, vb: 45, vd: 16.1, h2o: 63 }, { l: "1 fillet", g: 130 }),
  F("Trout (cooked)", 1, { kcal: 168, p: 24, c: 0, f: 7.4, sat: 1.4, o3: 1.1, chol: 63, na: 52, k: 400, ca: 40, mg: 30, fe: 1.4, zn: 0.7, ph: 280, vb: 40, vd: 16.1, h2o: 68 }, { l: "1 fillet", g: 150 }),
  F("Cod (cooked)", 1, { kcal: 105, p: 23, c: 0, f: 0.9, chol: 55, na: 78, k: 344, ca: 16, mg: 32, fe: 0.4, zn: 0.6, ph: 221, o3: 0.2, vb: 25, vd: 1.4, h2o: 76 }, { l: "1 fillet", g: 150 }),
  F("Anchovies (canned in oil)", 3, { kcal: 210, p: 29, c: 0, f: 10, sat: 2.2, o3: 1.4, chol: 85, na: 3668, k: 383, ca: 232, mg: 41, fe: 3.3, zn: 2, ph: 505, vb: 20, h2o: 47 }, { l: "5 fillets", g: 20 }),
  F("Omena / dagaa (dried silver fish)", 2, { kcal: 305, p: 45, c: 0, f: 12, sat: 3, o3: 1.5, chol: 570, na: 500, k: 400, ca: 2000, mg: 100, fe: 6, zn: 3, ph: 1000, vb: 30, h2o: 12 }, { l: "1 serving", g: 30 }),
  F("Tofu (firm)", 2, { kcal: 76, p: 8, c: 1.9, f: 4.8, fib: 0.3, sug: 0.6, sat: 0.7, na: 7, k: 121, ca: 350, mg: 30, fe: 1.6, zn: 0.8, ph: 97, vb: 10, h2o: 85 }, { l: "½ cup", g: 124 }),
  F("Tempeh", 1, { kcal: 192, p: 20.3, c: 7.6, f: 10.8, fib: 9, sat: 2.2, na: 9, k: 412, ca: 111, mg: 81, fe: 2.7, zn: 1.1, ph: 266, vb: 15, h2o: 60 }, { l: "1 serving", g: 100 }),
  F("Cottage cheese", 2, { kcal: 98, p: 11.1, c: 3.4, f: 4.3, sug: 2.7, sat: 2.7, chol: 17, na: 364, k: 104, ca: 83, mg: 8, zn: 0.4, ph: 159, vb: 15, h2o: 80 }, { l: "1 cup", g: 226 }),
  F("Egg whites", 1, { kcal: 52, p: 10.9, c: 0.7, f: 0.2, na: 166, k: 163, ca: 7, mg: 11, ph: 15, vb: 15, h2o: 88 }, { l: "2 whites", g: 66 }),
  // Dairy & alternatives
  F("Mozzarella cheese", 2, { kcal: 280, p: 22.2, c: 2.2, f: 17, sug: 1, sat: 10.9, chol: 79, na: 373, k: 76, ca: 505, mg: 20, zn: 2.9, ph: 354, va: 179, vb: 10, h2o: 50 }, { l: "1 slice", g: 28 }),
  F("Feta cheese", 2, { kcal: 264, p: 14.2, c: 4.1, f: 21.3, sug: 4.1, sat: 15, chol: 89, na: 917, k: 62, ca: 493, mg: 19, zn: 2.9, ph: 337, va: 160, vb: 15, h2o: 55 }, { l: "¼ cup crumbled", g: 38 }),
  F("Parmesan cheese", 2, { kcal: 431, p: 38.5, c: 4.1, f: 29, sug: 0.9, sat: 19.1, chol: 88, na: 1529, k: 92, ca: 1184, mg: 44, zn: 2.8, ph: 694, va: 173, vb: 25, h2o: 30 }, { l: "2 tbsp grated", g: 10 }),
  F("Skim milk", 1, { kcal: 34, p: 3.4, c: 5, f: 0.1, sug: 5, na: 44, k: 156, ca: 122, mg: 11, ph: 101, vb: 12, vd: 1, h2o: 91 }, { l: "1 glass", g: 250 }),
  F("Almond milk (unsweetened)", 2, { kcal: 15, p: 0.6, c: 0.6, f: 1.2, fib: 0.3, na: 63, k: 65, ca: 188, mg: 6, ph: 24, ve: 5.6, h2o: 97 }, { l: "1 glass", g: 250 }),
  F("Soy milk (unsweetened)", 2, { kcal: 33, p: 3.3, c: 1.8, f: 1.8, fib: 0.6, sug: 0.6, na: 51, k: 118, ca: 120, mg: 15, ph: 49, vb: 12, h2o: 92 }, { l: "1 glass", g: 250 }),
  F("Coconut milk (canned)", 2, { kcal: 230, p: 2.3, c: 5.5, f: 23.8, fib: 2.2, sug: 3.3, sat: 21.1, na: 15, k: 263, ca: 16, mg: 37, fe: 1.6, zn: 0.7, ph: 96, vc: 2.1, h2o: 68 }, { l: "¼ cup", g: 60 }),
  F("Kefir (plain)", 2, { kcal: 41, p: 3.8, c: 4.5, f: 1, sug: 4.5, sat: 0.6, chol: 5, na: 40, k: 130, ca: 120, mg: 12, ph: 90, vb: 15, h2o: 89 }, { l: "1 cup", g: 245 }),
  // Healthy fats
  F("Coconut oil", 2, { kcal: 862, p: 0, c: 0, f: 100, sat: 86.5, ve: 0.1, vk: 0.5, h2o: 0 }, { l: "1 tbsp", g: 14 }),
  F("Avocado oil", 2, { kcal: 884, p: 0, c: 0, f: 100, sat: 11.6, ve: 12, vk: 8.6, h2o: 0 }, { l: "1 tbsp", g: 14 }),
  F("Flaxseed oil", 2, { kcal: 884, p: 0, c: 0, f: 100, sat: 9, o3: 53.3, ve: 1.5, vk: 5, h2o: 0 }, { l: "1 tbsp", g: 14 }),
  F("Ghee", 2, { kcal: 900, p: 0, c: 0, f: 100, sat: 62, chol: 256, na: 2, va: 108, ve: 2.8, vk: 8.6, h2o: 0 }, { l: "1 tbsp", g: 13 }),
  F("Butter", 2, { kcal: 717, p: 0.9, c: 0.1, f: 81.1, sat: 51.4, chol: 215, na: 11, va: 684, ve: 2.3, vk: 7, h2o: 16 }, { l: "1 tbsp", g: 14 }),
  F("Tahini", 2, { kcal: 595, p: 17, c: 21.2, f: 53.8, fib: 9.3, sug: 0.5, sat: 7.5, na: 115, k: 414, ca: 426, mg: 95, fe: 4.2, zn: 4.6, ph: 732, vb: 15, h2o: 3 }, { l: "1 tbsp", g: 15 }),
  // Herbs & aromatics
  F("Fresh coriander / cilantro", 1, { kcal: 23, p: 2.1, c: 3.7, f: 0.5, fib: 2.8, sug: 0.9, na: 46, k: 521, ca: 67, mg: 26, fe: 1.8, zn: 0.5, ph: 48, va: 337, vb: 8, vc: 27, vk: 310, h2o: 93 }, { l: "¼ cup", g: 4 }),
  F("Fresh basil", 1, { kcal: 22, p: 3.2, c: 2.7, f: 0.6, fib: 1.6, sug: 0.3, na: 4, k: 295, ca: 177, mg: 64, fe: 3.2, zn: 0.8, ph: 56, va: 264, vb: 8, vc: 18, vk: 415, h2o: 92 }, { l: "¼ cup", g: 6 }),
  F("Fresh parsley", 1, { kcal: 36, p: 3, c: 6.3, f: 0.8, fib: 3.3, sug: 0.9, na: 56, k: 554, ca: 138, mg: 50, fe: 6.2, zn: 1.1, ph: 58, va: 421, vb: 8, vc: 133, vk: 1640, h2o: 88 }, { l: "¼ cup", g: 15 }),
  F("Chili pepper (fresh)", 1, { kcal: 40, p: 1.9, c: 8.8, f: 0.4, fib: 1.5, sug: 5.3, na: 9, k: 322, ca: 14, mg: 23, fe: 1, zn: 0.3, ph: 43, va: 48, vb: 8, vc: 143.7, h2o: 88 }, { l: "1 pepper", g: 45 }),
  // Fermented
  F("Kimchi", 2, { kcal: 15, p: 1.1, c: 2.4, f: 0.5, fib: 1.6, sug: 1, na: 498, k: 160, ca: 33, mg: 12, fe: 0.5, zn: 0.3, ph: 24, va: 20, vb: 6, vc: 10, vk: 24, h2o: 92 }, { l: "½ cup", g: 75 }),
  F("Sauerkraut", 2, { kcal: 19, p: 0.9, c: 4.3, f: 0.1, fib: 2.9, sug: 1.8, na: 661, k: 170, ca: 30, mg: 13, fe: 1.5, zn: 0.3, ph: 20, vb: 5, vc: 14.7, vk: 13, h2o: 92 }, { l: "½ cup", g: 75 }),
];

// Backfill realistic servings onto common existing foods (data-only; keeps
// each food line short). Applied once at module load.
const SERVING_BY_NAME = {
  "Chicken breast (grilled)": { l: "1 breast", g: 120 },
  "Beef (lean, cooked)": { l: "1 serving", g: 150 },
  "Salmon (cooked)": { l: "1 fillet", g: 150 },
  "Tilapia (cooked)": { l: "1 fillet", g: 150 },
  "Nyama choma (grilled goat)": { l: "1 serving", g: 150 },
  "Eggs (whole, cooked)": { l: "1 egg", g: 50 },
  "White rice (cooked)": { l: "1 cup", g: 160 },
  "Brown rice (cooked)": { l: "1 cup", g: 160 },
  "Ugali (maize meal, cooked)": { l: "1 slab", g: 200 },
  "Chapati": { l: "1 chapati", g: 90 },
  "Pasta (cooked)": { l: "1 cup", g: 140 },
  "Pilau rice": { l: "1 plate", g: 250 },
  "Githeri (maize & beans)": { l: "1 plate", g: 250 },
  "Matoke (cooked plantain)": { l: "1 serving", g: 200 },
  "Oats (dry)": { l: "½ cup", g: 40 },
  "Whole-wheat bread": { l: "1 slice", g: 40 },
  "Beans (cooked)": { l: "1 cup", g: 170 },
  "Lentils (cooked)": { l: "1 cup", g: 200 },
  "Whey protein (powder)": { l: "1 scoop", g: 30 },
  "Spinach (cooked)": { l: "1 cup", g: 180 },
  "Broccoli (cooked)": { l: "1 cup", g: 155 },
  "Sukuma wiki (collard greens)": { l: "1 serving", g: 120 },
  "Avocado": { l: "½ avocado", g: 100 },
  "Banana": { l: "1 medium", g: 120 },
  "Apple": { l: "1 medium", g: 180 },
  "Orange": { l: "1 medium", g: 130 },
  "Mango": { l: "1 whole", g: 200 },
  "Watermelon": { l: "1 slice", g: 280 },
  "Greek yogurt (plain)": { l: "1 cup", g: 245 },
  "Whole milk": { l: "1 glass", g: 250 },
  "Cheddar cheese": { l: "1 slice", g: 30 },
  "Peanut butter": { l: "1 tbsp", g: 16 },
  "Almonds": { l: "1 handful", g: 28 },
  "French fries": { l: "1 serving", g: 120 },
  "Fruit juice (packaged)": { l: "1 glass", g: 250 },
  "Soda (cola)": { l: "1 can", g: 330 },
  "Mandazi": { l: "1 piece", g: 60 },
  "Pizza (cheese)": { l: "1 slice", g: 107 },
  "Beef burger (fast food)": { l: "1 burger", g: 150 },
};
for (const f of FOOD_DB) if (!f.serving && SERVING_BY_NAME[f.name]) f.serving = SERVING_BY_NAME[f.name];

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

// One-tap favourites: the (food, portion) pairs eaten most often in the
// last 30 days. Needs 2+ repeats — a habit, not a one-off — so the row
// stays personal and short. Expects a sanitized log.
export function frequentEntries(log, days = 30, limit = 6) {
  const seen = new Map();
  for (let i = 0; i < days; i++) {
    for (const e of dayEntries(log, daysAgoStr(i))) {
      const key = `${e.name}|${e.grams}`;
      const cur = seen.get(key);
      if (cur) cur.count++;
      else seen.set(key, { name: e.name, grams: e.grams, proc: e.proc, n: e.n, count: 1 });
    }
  }
  return [...seen.values()].filter((x) => x.count >= 2).sort((a, b) => b.count - a.count).slice(0, limit);
}

// Which meal slot "now" most likely belongs to — lets one-tap logging
// skip the where question entirely.
export function slotForNow(hour = new Date().getHours()) {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

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
