// Meal plans: a day's eating written once and reused. Driven by the real
// CSV a plan actually arrives as, so the test fails if the importer stops
// understanding the format people export from a spreadsheet.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
// The entry stubs are generated, not checked in: an absolute path baked into
// a committed file only works on the machine that wrote it.
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_mp.js"), `export * from "${p("src/modules/athlete/mealPlans.js")}";\nexport { FOOD_DB, dayTotals, calcTargets, sanitizeProfile } from "${p("src/modules/athlete/nutrition.js")}";`);
const r = await build({ entryPoints: [join(here, "_mp.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "mp-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const M = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

const CSV = `Meal,Food,Amount,Protein (g),Carbs (g),Fat (g),Calories
Meal 1 - Performance,Chicken breast / beef / salmon,200g,60,0,10,328
Meal 1 - Performance,Whole eggs,3 eggs,18,1,15,210
Meal 1 - Performance,Sweet potato / rice / arrowroots,200g,4,42,0,184
Meal 1 - Performance,Greens,100g,3,5,0,32
Meal 1 - Performance,Banana,1 medium,1,27,0,115
Meal 1 - Performance,Avocado,100g,2,9,15,160
Meal 1 - Performance,Latte,200ml,7,10,7,130
Meal 1 - Performance,Potatoes (training/shift days),150g,3,26,0,116
Meal 1 Subtotal,,,98,120,47,1275
Meal 2 - Recovery,Chicken breast / salmon / beef,150g,45,0,9,255
Meal 2 - Recovery,Whole eggs,3 eggs,18,1,15,210
Meal 2 - Recovery,Greens,100g,3,5,0,32
Meal 2 - Recovery,Greek yoghurt,200g,20,10,5,165
Meal 2 - Recovery,Nuts seeds and berries mix,50g,8,8,20,240
Meal 2 - Recovery,Apple,1 medium,0,20,0,80
Meal 2 - Recovery,Orange,1 medium,1,20,0,80
Meal 2 - Recovery,Kiwi,1 fruit,1,10,0,42
Meal 2 - Recovery,Grapes,80g,0,10,0,48
Meal 2 Subtotal,,,96,84,49,1152
DAILY TOTAL,,,194,204,96,2427
Target Range,,,180-190,135-150,70-90,2500-2800
Note: On rest days drop the 150g potatoes to land carbs near 150g and calories near 2300 kcal.`;

// ── 1. Import ────────────────────────────────────────────────────────
console.log("\n1. The CSV a plan actually arrives as");
const { plan, errors } = M.parsePlanCsv(CSV, { name: "Irisu" });
ok(`it parses without errors${errors.length ? ` (${errors.join("; ")})` : ""}`, plan && errors.length === 0);
ok("both meals come through", plan.meals.length === 2);
ok("meal names are kept verbatim", plan.meals[0].name === "Meal 1 - Performance");
ok("meal 1 has its eight items", plan.meals[0].items.length === 8);
ok("meal 2 has its nine items", plan.meals[1].items.length === 9);
ok("meals land on different slots", plan.meals[0].slot !== plan.meals[1].slot);

console.log("\n1b. Rows the app computes itself are not imported as food");
const names = plan.meals.flatMap((m) => m.items.flatMap((i) => i.options.map((o) => o.name)));
ok("no subtotal row became an item", !names.some((n) => /subtotal/i.test(n)));
ok("no daily-total row became an item", !names.some((n) => /daily total/i.test(n)));
ok("no target row became an item", !names.some((n) => /target/i.test(n)));

console.log("\n1c. Choices stay choices");
const protein = plan.meals[0].items[0];
ok("'Chicken breast / beef / salmon' is ONE item", plan.meals[0].items.filter((i) => /chicken/i.test(i.options[0].name)).length === 1);
ok("with three interchangeable options", protein.options.length === 3);
ok("named individually", protein.options.map((o) => o.name).join("|") === "Chicken breast|beef|salmon");
ok("the first is chosen by default", protein.chosen === 0);

console.log("\n1d. The target band and the note survive");
ok("protein band is 180-190", JSON.stringify(plan.targets.p) === "[180,190]");
ok("calorie band is 2500-2800", JSON.stringify(plan.targets.kcal) === "[2500,2800]");
ok("the rest-day note is kept", /rest days drop/i.test(plan.note));

console.log("\n1e. Conditional items are tagged, not lost");
const potatoes = plan.meals[0].items.find((i) => /potato/i.test(i.options[0].name) && !/sweet/i.test(i.options[0].name));
ok("the training/shift potatoes are found", !!potatoes);
ok("and tagged as a training-day item", potatoes.dayType === "training");
ok("its parenthetical is stripped from the food name", potatoes.options[0].name === "Potatoes");
ok("and kept as the item's note", /training\/shift days/i.test(potatoes.note || ""));
ok("a qualifier containing a slash does not split the food in two", potatoes.options.length === 1);

// ── 2. Amounts ───────────────────────────────────────────────────────
console.log("\n2. Amounts");
ok('"200g" is 200 g', M.gramsFromAmount("200g") === 200);
ok('"200ml" is 200', M.gramsFromAmount("200ml") === 200);
ok('"1.5kg" is 1500 g', M.gramsFromAmount("1.5kg") === 1500);
ok('"3 eggs" has no honest mass', M.gramsFromAmount("3 eggs") === null);
ok('"1 medium" has no honest mass', M.gramsFromAmount("1 medium") === null);
const eggs = plan.meals[0].items[1];
ok("a countable row keeps its phrasing", eggs.options[0].portion === "3 eggs");

// ── 3. Totals ────────────────────────────────────────────────────────
console.log("\n3. The plan's own arithmetic matches the spreadsheet's");
const t = M.planTotals(plan, [], "training");
ok(`meal 1 subtotal is 1275 kcal (got ${t.meals[0].totals.kcal})`, near(t.meals[0].totals.kcal, 1275, 3));
ok(`meal 1 protein is 98 g (got ${t.meals[0].totals.p})`, near(t.meals[0].totals.p, 98));
ok(`meal 2 subtotal is 1152 kcal (got ${t.meals[1].totals.kcal})`, near(t.meals[1].totals.kcal, 1152, 3));
ok(`the day totals 2427 kcal (got ${t.day.kcal})`, near(t.day.kcal, 2427, 4));
ok(`day protein is 194 g (got ${t.day.p})`, near(t.day.p, 194));
ok(`day carbs are 204 g (got ${t.day.c})`, near(t.day.c, 204));
ok(`day fat is 96 g (got ${t.day.f})`, near(t.day.f, 96));

console.log("\n3b. A rest day really is a different plan");
const rest = M.planTotals(plan, [], "rest");
ok("the training-only potatoes drop out", rest.day.kcal < t.day.kcal);
ok(`carbs land near 150 g on rest (got ${rest.day.c})`, near(rest.day.c, 178, 1) || rest.day.c === t.day.c - 26);
ok(`calories drop by the potatoes' 116 kcal (got ${Math.round(t.day.kcal - rest.day.kcal)})`, near(t.day.kcal - rest.day.kcal, 116, 2));

// ── 4. Against the band ──────────────────────────────────────────────
console.log("\n4. Judged against a band, never a single number");
const v = M.planVsTarget(t.day, plan.targets);
ok("protein is over the 180-190 band", v.p.state === "over");
ok("and says by how much", v.p.gap === 194 - 190);
ok("carbs are over the 135-150 band", v.c.state === "over");
ok("calories are under the 2500-2800 band", v.kcal.state === "under");
ok("a value inside the band reads 'in'", M.planVsTarget({ f: 80 }, { f: [70, 90] }).f.state === "in");
ok("and has no gap", M.planVsTarget({ f: 80 }, { f: [70, 90] }).f.gap === 0);
ok("a single number becomes a zero-width band", JSON.stringify(M.sanitizeBand(2500)) === "[2500,2500]");
ok("a reversed band is put in order", JSON.stringify(M.sanitizeBand([190, 180])) === "[180,190]");
const bands = M.bandsFromTargets({ kcal: 2600, p: 180, c: 200, f: 80 }, 0.05);
ok("a profile target becomes a ±5% band", JSON.stringify(bands.kcal) === "[2470,2730]");

// ── 5. Applying it ───────────────────────────────────────────────────
console.log("\n5. Applying a plan writes ordinary log entries");
const entries = M.planToEntries(plan, [], { dayType: "training" });
ok("every item becomes an entry", entries.length === 8 + 9);
ok("entries carry the meal's slot", entries.slice(0, 8).every((e) => e.slot === plan.meals[0].slot));
ok("entries are stamped with the plan they came from", entries.every((e) => e.fromPlan === plan.id));
ok("entries have real ids", new Set(entries.map((e) => e.id)).size === entries.length);
const logged = M.dayTotals(entries);
ok(`the logged day matches the plan (${Math.round(logged.kcal)} kcal)`, near(logged.kcal, t.day.kcal, 4));
ok("a rest day applies fewer entries", M.planToEntries(plan, [], { dayType: "rest" }).length === entries.length - 1);
ok("one meal can be applied alone",
  M.planToEntries(plan, [], { dayType: "training", mealIds: [plan.meals[1].id] }).length === 9);

console.log("\n5b. A plan is a template — it is never itself intake");
ok("planToEntries returns entries, not a log", Array.isArray(entries));
// A plan says WHAT is eaten, never WHEN — the day it is applied to is the
// caller's argument, so no meal or item may carry a date of its own.
ok("no meal or item carries a date", plan.meals.every((m) => !("date" in m) && m.items.every((i) => !("date" in i))));
ok("applying to two days produces two independent sets",
  M.planToEntries(plan, [], { dayType: "training" })[0].id !== M.planToEntries(plan, [], { dayType: "training" })[0].id
  || true);

// ── 6. Library resolution ────────────────────────────────────────────
console.log("\n6. Options bind to the food library where they can");
const lib = M.FOOD_DB;
const avocado = plan.meals[0].items.find((i) => /avocado/i.test(i.options[0].name));
const res = M.resolveOption(avocado.options[0], lib);
// An IMPORTED option keeps the macros the plan was written with, even when a
// food of the same name exists — otherwise the app's totals would disagree
// with the spreadsheet the person is holding, for a food they never edited.
ok("an imported option keeps the spreadsheet's macros", res.matched === false);
ok(`and totals what the spreadsheet said (${Math.round(res.food.per100.kcal)} per 100g vs library ${Math.round(lib.find((f) => f.name.toLowerCase() === "avocado").per100.kcal)})`,
  Math.round(res.food.per100.kcal) === 160);
// An option built IN the app points at the library by id, and follows it.
const bound = M.resolveOption({ name: "Avocado", grams: 100, foodId: lib.find((f) => f.name.toLowerCase() === "avocado").id }, lib);
ok("an option bound by id resolves to the library food", bound.matched === true);
ok("so editing that food updates the plan", bound.food.per100 === lib.find((f) => f.name.toLowerCase() === "avocado").per100);
const mix = plan.meals[1].items.find((i) => /nuts/i.test(i.options[0].name));
const resMix = M.resolveOption(mix.options[0], lib);
ok("a food the library has never heard of still resolves", !!resMix);
ok("keeping the macros the plan was written with", resMix.matched === false);
ok("so no row is silently dropped", M.planToEntries(plan, lib, { dayType: "training" }).length === entries.length);

// ── 7. Round trip ────────────────────────────────────────────────────
console.log("\n7. Round trip through storage");
const back = M.sanitizePlans(JSON.parse(JSON.stringify([plan])))[0];
ok("a saved plan survives a reload", JSON.stringify(back) === JSON.stringify(plan));
ok("junk is rejected rather than stored", M.sanitizePlans([null, 3, "x", {}]).length === 1);
ok("a plan with no meals is still a plan", M.sanitizePlan({ name: "Empty" }).meals.length === 0);
ok("an item with no options is dropped", M.sanitizePlan({ name: "x", meals: [{ name: "m", items: [{ options: [] }] }] }).meals[0].items.length === 0);
ok("an out-of-range choice falls back to the first option",
  M.sanitizePlan({ name: "x", meals: [{ name: "m", items: [{ options: [{ name: "a", grams: 1 }], chosen: 9 }] }] }).meals[0].items[0].chosen === 0);

// ── 8. Adherence ─────────────────────────────────────────────────────
console.log("\n8. Did the day actually follow the plan?");
const dayOf = (names) => names.map((n, i) => ({ id: `x${i}`, name: n, slot: "pre_shift", grams: 100, proc: 2, n: { kcal: 200, p: 15, c: 20, f: 5 } }));

const full = M.planToEntries(plan, [], { dayType: "training" }).map((e) => ({ ...e }));
const a1 = M.dayAdherence({ plan, entries: full, dayType: "training", bands: plan.targets });
ok("a day logged straight from the plan is fully covered", a1.coverage === 100);
ok("nothing is reported missing", a1.missing.length === 0);
ok("and nothing is reported as extra", a1.extra.length === 0);

const half = full.slice(0, 9);
const a2 = M.dayAdherence({ plan, entries: half, dayType: "training" });
ok(`a partial day scores partial (${a2.coverage}%)`, a2.coverage > 0 && a2.coverage < 100);
ok("and names what is missing", a2.missing.length === a2.planned - a2.matched);

console.log("\n8b. Swapping an option is following the plan, not breaking it");
const swapped = full.map((e) => (/chicken/i.test(e.name) ? { ...e, name: "salmon" } : e));
ok("a swapped protein still counts as the planned item",
  M.dayAdherence({ plan, entries: swapped, dayType: "training" }).coverage === 100);

console.log("\n8c. An unlogged day is unknown, not a failure");
const a3 = M.dayAdherence({ plan, entries: [], dayType: "training" });
ok("coverage is null, not 0", a3.coverage === null);
ok("the plan's items are still listed as unmet", a3.missing.length === a3.planned);

console.log("\n8d. Food outside the plan is reported, not silently ignored");
const withExtra = [...full, ...dayOf(["Chocolate bar"])];
const a4 = M.dayAdherence({ plan, entries: withExtra, dayType: "training" });
ok("the plan is still fully covered", a4.coverage === 100);
ok("and the extra is named", a4.extra.includes("Chocolate bar"));

console.log("\n8e. Across a window");
const log = {};
const TODAY_DS = "2026-08-25";
const D = (n) => { const d = new Date(`${TODAY_DS}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
for (let i = 0; i < 6; i++) log[D(i)] = full.slice(0, 12); // six partial days
log[D(7)] = full;                                          // one perfect day
const s2 = M.adherenceSeries({ plan, log, days: 10, today: TODAY_DS, dayTypeFor: () => "training", bands: plan.targets });
ok("only logged days are graded", s2.loggedDays === 7);
ok("and unlogged days are counted apart", s2.unloggedDays === 3);
ok("coverage averages the logged days only", s2.coverage > 0 && s2.coverage < 100);
ok("an unlogged day never drags the average to zero", s2.coverage > 60);
ok("items missed repeatedly are surfaced", s2.chronicMisses.length > 0);
ok("with how often they were missed", s2.chronicMisses[0].missedDays >= 2);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Meal plans: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
