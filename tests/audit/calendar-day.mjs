// §6 — the Calendar is a lens over the activity feed, not a second dataset.
// Only a browser audit covered it until now, which meant the day drawer's
// arithmetic was checked by reading pixels. These are the properties that
// have to hold whatever the UI does with them.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_cal.js"), `
export * as C from "${p("src/shared/calendar.js")}";
export * as A from "${p("src/shared/activity.js")}";
`);
const r = await build({ entryPoints: [join(here, "_cal.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "cal-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const { C, A } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const DAY = "2026-08-13";
const OTHER = "2026-08-12";

const feedFrom = (deps) => A.buildActivityFeed(deps);
const S = (deps, extra = {}) => ({ feed: feedFrom(deps), trades: [], measurements: [], bills: [], ...extra });
const lineFor = (lines, key) => lines.find((l) => l.key === key);

const PROFILE = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" };

console.log("\n1. A day with nothing on it says nothing");
{
  const s = S({});
  const d = C.dayDomains(DAY, s);
  ok("no dots fire", C.activeDots(d).length === 0);
  ok("no lines are written", C.dayLines(DAY, s).length === 0);
  ok("sleep is null, not zero", d.sleep === null);
}

console.log("\n2. Sleep and fluid reach the day drawer");
{
  const s = S({ sleep: { [DAY]: 6.2 }, hydration: { [DAY]: 1800 }, nutritionProfile: PROFILE });
  const lines = C.dayLines(DAY, s);
  const sleep = lineFor(lines, "sleep");
  ok("sleep gets a line", !!sleep);
  ok(`it carries the hours (${sleep?.detail})`, /6\.2 h/.test(sleep?.detail || ""));
  ok("and names the floor it was measured against", /floor/.test(sleep?.detail || ""));
  const water = lineFor(lines, "water");
  ok("hydration gets a line", !!water);
  ok(`in litres, against the target (${water?.detail})`, /1\.8 L of \d/.test(water?.detail || ""));
  // Nine domains already show as dots. These two are read on the day, not
  // scanned across the month, so they must NOT add a tenth and eleventh.
  const dots = C.activeDots(C.dayDomains(DAY, s));
  ok("neither adds a dot to the grid", !dots.includes("sleep") && !dots.includes("water"));
}

console.log("\n3. Unlogged is not zero");
{
  const s = S({ sleep: { [OTHER]: 7 } });
  const d = C.dayDomains(DAY, s);
  ok("a night logged on another day does not leak into this one", d.sleep === null);
  ok("and writes no line", !lineFor(C.dayLines(DAY, s), "sleep"));
}

console.log("\n4. Fuel: the calendar reports what the feed computed");
{
  const nutrition = { [DAY]: [
    { id: "a", name: "Oats", slot: "pre_shift", grams: 100, n: { kcal: 379, p: 13.2, c: 67.7, f: 6.5 } },
    { id: "b", name: "Eggs", slot: "pre_shift", grams: 100, n: { kcal: 155, p: 13, c: 1.1, f: 11 } },
  ] };
  const s = S({ nutrition, nutritionProfile: PROFILE });
  const d = C.dayDomains(DAY, s);
  ok(`kcal is the day's total, not a meal count (${d.meal})`, d.meal === 534);
  const meal = lineFor(C.dayLines(DAY, s), "meal");
  ok("the Fuel line says kcal logged", /534 kcal logged/.test(meal?.detail || ""));
  ok("and opens Nutrition, not Body", meal?.nav === "nutrition:today");
}

console.log("\n5. A partly-done habit is named, with its real numbers");
{
  const habits = [{ id: "h1", name: "Stretch", type: "numeric", unit: "min", target: 15, targetDirection: "at_least", frequencyType: "daily", archivedAt: null, createdDate: "2026-01-01" }];
  const entries = [{ habitId: "h1", date: DAY, value: 5, completed: false }];
  const s = S({ htHabits: habits, htEntries: entries });
  const lines = C.dayLines(DAY, s);
  const summary = lineFor(lines, "habits");
  ok("the summary counts it as partial, not done", /0\/1 done · 1 partial/.test(summary?.detail || ""));
  const own = lines.find((l) => l.key.startsWith("habit:"));
  ok("the habit gets its own line", !!own);
  ok(`with the amount and the percentage (${own?.detail})`, /5 min of 15 min · 33%/.test(own?.detail || ""));
  ok("and the dot still fires — something happened", C.activeDots(C.dayDomains(DAY, s)).includes("habits"));
}

console.log("\n6. Every dot in the legend is one a day can actually fire");
{
  const s = S({
    htHabits: [{ id: "h1", name: "Pray", type: "boolean", target: null, targetDirection: "at_least", frequencyType: "daily", archivedAt: null, createdDate: "2026-01-01" }],
    htEntries: [{ habitId: "h1", date: DAY, value: null, completed: true }],
    workouts: [{ id: "s1", date: DAY, type: "Push", sets: [] }],
    nutrition: { [DAY]: [{ id: "a", name: "Oats", slot: "pre_shift", grams: 100, n: { kcal: 379, p: 13 } }] },
    nutritionProfile: PROFILE,
    entries: [{ id: "j1", date: DAY, text: "wrote" }],
    purity: { [DAY]: { s: "pure" } },
    church: [{ id: "c1", date: DAY, title: "Service" }],
  }, {
    trades: [{ id: "t1", date: DAY }],
    measurements: [{ id: "m1", date: DAY, weightKg: 78 }],
  });
  const fired = new Set(C.activeDots(C.dayDomains(DAY, s)));
  const missing = C.CAL_DOMAINS.map((d) => d.key).filter((k) => k !== "bill" && !fired.has(k));
  ok(`every domain but bills fires on a full day${missing.length ? ` (missing ${missing.join(", ")})` : ""}`, missing.length === 0);
  ok("bills stay quiet — nothing was due", !fired.has("bill"));
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Calendar day: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
