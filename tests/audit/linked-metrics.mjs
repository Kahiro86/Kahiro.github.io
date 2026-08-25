// Linked metrics: a habit and its counterpart are the same fact, and after
// this they say the same thing on every surface that reads either one.
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
const bundle = async (entry, tag) => {
  writeFileSync(join(here, "_lm.js"), `export * from "${p("src/modules/habits/linkedMetrics.js")}";`);
writeFileSync(join(here, "_lmw.js"), `export * from "${p("src/shared/wellbeing.js")}";`);
const r = await build({ entryPoints: [join(here, entry)], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  const out = join(mkdtempSync(join(tmpdir(), `${tag}-`)), "b.mjs");
  writeFileSync(out, r.outputFiles[0].text);
  return import(pathToFileURL(out).href);
};
writeFileSync(join(here, "_lm.js"), `export * from "${p("src/modules/habits/linkedMetrics.js")}";`);
writeFileSync(join(here, "_lmw.js"), `export * from "${p("src/shared/wellbeing.js")}";`);
const L = await bundle("_lm.js", "lm");
const W = await bundle("_lmw.js", "lmw");

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const sleepM = L.metricById("sleep");
const waterM = L.metricById("hydration");
const TODAY = "2026-08-25";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// ── 1. Resolution ────────────────────────────────────────────────────
console.log("\n1. Which habit stands for which metric");
const habits = [
  { id: "h1", name: "Sleep well", type: "boolean", createdAt: "2026-01-01T00:00:00Z" },
  { id: "h2", name: "Hydration", type: "numeric", unit: "L", target: 3, createdAt: "2026-02-01T00:00:00Z" },
  { id: "h3", name: "Read 20 pages", type: "numeric", unit: "pages", target: 20, createdAt: "2026-03-01T00:00:00Z" },
];
let links = L.resolveLinks(habits, {});
ok("'Sleep well' resolves to the sleep metric", links.sleep === "h1");
ok("'Hydration' resolves to the hydration metric", links.hydration === "h2");
ok("an unrelated habit links to nothing", !Object.values(links).includes("h3"));

ok("an archived habit never holds a link",
  !L.resolveLinks([{ ...habits[0], archivedAt: "2026-05-01" }], {}).sleep);

ok("an explicit ht_meta choice beats the name match",
  L.resolveLinks([...habits, { id: "h9", name: "Nap log", type: "numeric", unit: "h", target: 7, createdAt: "2026-04-01T00:00:00Z" }],
    { link_sleep: "h9" }).sleep === "h9");
ok("an explicit 'none' unlinks the metric entirely",
  L.resolveLinks(habits, { link_sleep: "none" }).sleep === undefined);
ok("a second matching habit does not steal the link from the older one",
  L.resolveLinks([...habits, { id: "h8", name: "Drink water", type: "numeric", unit: "L", target: 2, createdAt: "2026-07-01T00:00:00Z" }], {}).hydration === "h2");
ok("an explicit link to a habit that no longer exists resolves to nothing",
  L.resolveLinks(habits, { link_sleep: "gone" }).sleep === undefined);

// ── 2. Units ─────────────────────────────────────────────────────────
console.log("\n2. Reading the habit's unit");
const numeric = (over) => ({ id: "x", type: "numeric", target: 3, ...over });
ok("litres convert to millilitres", L.factorFor(waterM, numeric({ unit: "L" })) === 1000);
ok("glasses convert at 250 ml", L.factorFor(waterM, numeric({ unit: "glasses" })) === 250);
ok("minutes convert to hours", Math.abs(L.factorFor(sleepM, numeric({ unit: "mins" })) - 1 / 60) < 1e-9);
ok("units are read case-insensitively", L.factorFor(waterM, numeric({ unit: "ML" })) === 1);
ok("an unknown unit refuses to convert", L.factorFor(waterM, numeric({ unit: "sips" })) === null);
ok("a boolean habit never converts", L.factorFor(sleepM, { id: "x", type: "boolean" }) === null);
ok("a bare target of 8 reads as hours", L.factorFor(sleepM, numeric({ unit: "", target: 8 })) === 1);
ok("a bare target of 3 reads as litres", L.factorFor(waterM, numeric({ unit: "", target: 3 })) === 1000);
ok("a bare target of 2500 reads as millilitres", L.factorFor(waterM, numeric({ unit: "", target: 2500 })) === 1);
ok("a bare target of 60 is ambiguous and is declined", L.factorFor(waterM, numeric({ unit: "", target: 60 })) === null);

console.log("\n3. What a habit entry says about the metric");
ok("3 on a litres habit is 3000 ml", L.readEntry(waterM, numeric({ unit: "L" }), 3).value === 3000);
ok("a tick on a boolean habit measures nothing",
  L.readEntry(sleepM, { id: "x", type: "boolean" }, 1).value === undefined);
ok("a tick on a boolean habit claims the bar", L.readEntry(sleepM, { id: "x", type: "boolean" }, 1).claim === true);
ok("a 0 on a boolean habit claims the bar was missed", L.readEntry(sleepM, { id: "x", type: "boolean" }, 0).claim === false);
ok("an unreadable numeric habit falls back to a claim",
  L.readEntry(waterM, numeric({ unit: "sips" }), 4).claim === true);
ok("a negative value says nothing", L.readEntry(sleepM, numeric({ unit: "h" }), -1) === null);
ok("the bar comes from the habit's own target",
  L.barFor(waterM, numeric({ unit: "L", target: 2.5 })) === 2500);
ok("a habit with no readable target falls back to the metric's bar",
  L.barFor(sleepM, { id: "x", type: "boolean" }) === 6.5);

// ── 4. Mirroring, and what it refuses to touch ───────────────────────
console.log("\n4. habit → canonical, and the data it will not overwrite");
let plan = L.planMirror(sleepM, {}, {}, TODAY, { value: 7.5 });
ok("a measured habit value lands in the canonical store", plan.canonical[TODAY] === 7.5);
ok("the mirror records what it wrote", plan.writes.sleep[TODAY] === 7.5);

ok("writing the same value twice is a no-op",
  L.planMirror(sleepM, { [TODAY]: 7.5 }, { sleep: { [TODAY]: 7.5 } }, TODAY, { value: 7.5 }) === null);

ok("a number the user typed elsewhere is never overwritten",
  L.planMirror(sleepM, { [TODAY]: 6 }, {}, TODAY, { value: 7.5 }) === null);

plan = L.planMirror(sleepM, { [TODAY]: 7.5 }, { sleep: { [TODAY]: 7.5 } }, TODAY, null);
ok("retracting the habit entry removes the value the mirror wrote", !(TODAY in plan.canonical));
ok("and drops its provenance record", !plan.writes.sleep);

ok("retracting does not remove a value the user has since changed",
  L.planMirror(sleepM, { [TODAY]: 8 }, { sleep: { [TODAY]: 7.5 } }, TODAY, null).canonical[TODAY] === 8);

ok("retracting a day the mirror never wrote is a no-op",
  L.planMirror(sleepM, { [TODAY]: 6 }, {}, TODAY, null) === null);

ok("a claim-only reading writes no number",
  L.planMirror(sleepM, {}, {}, TODAY, { claim: true }) === null);

// ── 5. Reverse sync ──────────────────────────────────────────────────
console.log("\n5. canonical → habit");
const dates = [back(2), back(1), TODAY];
let rev = L.reverseEntries({
  metric: sleepM, habit: { id: "h1", type: "boolean" },
  canonical: { [back(2)]: 7.5, [back(1)]: 5 }, writes: {}, dates, entries: [],
});
ok("7.5 hours ticks a boolean sleep habit", rev.find((r) => r.date === back(2)).value === 1);
ok("5 hours marks it missed", rev.find((r) => r.date === back(1)).value === 0);
ok("a night never recorded produces no entry at all", !rev.some((r) => r.date === TODAY));

rev = L.reverseEntries({
  metric: waterM, habit: { id: "h2", type: "numeric", unit: "L", target: 3 },
  canonical: { [TODAY]: 2500 }, writes: {}, dates, entries: [],
});
ok("2500 ml comes back to a litres habit as 2.5", rev[0].value === 2.5);

ok("a day the mirror itself wrote is never echoed back",
  L.reverseEntries({ metric: sleepM, habit: { id: "h1", type: "boolean" },
    canonical: { [TODAY]: 7.5 }, writes: { sleep: { [TODAY]: 7.5 } }, dates, entries: [] }).length === 0);

ok("an entry that already agrees is left alone",
  L.reverseEntries({ metric: sleepM, habit: { id: "h1", type: "boolean" },
    canonical: { [TODAY]: 7.5 }, writes: {}, dates,
    entries: [{ habitId: "h1", date: TODAY, value: 1 }] }).length === 0);

ok("a hand-ticked day is not overwritten with a measured miss",
  L.reverseEntries({ metric: sleepM, habit: { id: "h1", type: "boolean" },
    canonical: { [TODAY]: 5 }, writes: {}, dates,
    entries: [{ habitId: "h1", date: TODAY, value: 1 }] }).length === 0);

// ── 6. Claims in the wellbeing series ────────────────────────────────
console.log("\n6. Claims: logged, counted, never averaged");
const claims = L.claimDays({ metric: sleepM, habit: { id: "h1", type: "boolean" },
  entries: [{ habitId: "h1", date: back(1), value: 1 }, { habitId: "h1", date: back(2), value: 0 }] });
ok("a boolean habit produces claims", claims[back(1)] === true && claims[back(2)] === false);
ok("a habit that measures produces none",
  Object.keys(L.claimDays({ metric: waterM, habit: { id: "h2", type: "numeric", unit: "L", target: 3 },
    entries: [{ habitId: "h2", date: TODAY, value: 3 }] })).length === 0);

const s = W.sleepSeries({ sleep: { [back(3)]: 8 }, claims: { [back(1)]: true, [back(2)]: false }, today: TODAY, days: 5 });
ok("a claimed night counts as logged", s.loggedDays === 3);
ok("only the measured night is counted as measured", s.measuredDays === 1);
ok("the average ignores claims entirely", s.average === 8);
ok("consistency counts the claim as a hit", s.consistency === Math.round((2 / 3) * 100));
ok("an unclaimed, unmeasured night stays unlogged", s.rows.filter((r) => r.hit === null).length === 2);
ok("today's status reports a claim as logged",
  W.todayStatus(W.sleepSeries({ sleep: {}, claims: { [TODAY]: true }, today: TODAY, days: 1 })).logged === true);
ok("and flags that nothing was measured",
  W.todayStatus(W.sleepSeries({ sleep: {}, claims: { [TODAY]: true }, today: TODAY, days: 1 })).value === null);

// ── 7. Hydration's two log paths ─────────────────────────────────────
console.log("\n7. Hydration adds its two log paths");
const profile = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" };
const bev = (ml) => [{ id: `e${ml}`, name: "Water", slot: "snack", grams: ml, bev: true, proc: 1, n: {} }];
const h1 = W.hydrationSeries({ nutrition: { [TODAY]: bev(1000) }, nutritionProfile: profile, hydration: { [TODAY]: 1500 }, today: TODAY, days: 1 });
ok("food-logged and habit-logged fluid are added, not chosen between", h1.rows[0].value === 2500);
const h2 = W.hydrationSeries({ nutrition: {}, nutritionProfile: profile, hydration: { [TODAY]: 2000 }, today: TODAY, days: 1 });
ok("water logged with no food at all still counts", h2.rows[0].value === 2000);
const h3 = W.hydrationSeries({ nutrition: {}, nutritionProfile: profile, hydration: {}, today: TODAY, days: 1 });
ok("a day with neither stays unlogged, not zero", h3.rows[0].value === null);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
if (fail) { console.log(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
