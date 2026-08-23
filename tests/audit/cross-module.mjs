// Criteria 38, 39, 40 — cross-module insights compute from real data, the
// Firm reads habit data through a view, and sleep has one source.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const entry = join(here, "_cm.js");
writeFileSync(entry, `export * from "${join(root, "src/shared/crossModule.js").replace(/\\/g, "/")}";
export * as V from "${join(root, "src/shared/views.js").replace(/\\/g, "/")}";`);
const out = join(mkdtempSync(join(tmpdir(), "cm-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const C = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-22";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

// A month where short sleep really does track worse habit days, protein lands
// on training days and not rest days, and two nights breach the floor.
const legacyHabits = [
  { id: "h1", name: "Deep work", freq: "daily", target: 1, days: [0,1,2,3,4,5,6], createdAt: back(40), log: {} },
  { id: "h2", name: "Read", freq: "daily", target: 1, days: [0,1,2,3,4,5,6], createdAt: back(40), log: {} },
];
const sleep = {}, nutrition = {}, gymSessions = [];
for (let i = 0; i < 30; i++) {
  const d = back(i);
  const shortNight = i % 5 === 0;
  sleep[d] = shortNight ? 5.2 : 7.6;
  // After a short night, one of two habits lands; otherwise both.
  legacyHabits[0].log[d] = { v: 1 };
  legacyHabits[1].log[d] = { v: shortNight ? 0 : 1 };
  const trained = i % 3 === 0;
  if (trained) gymSessions.push({ id: `g${i}`, date: d, startedAt: 0, finishedAt: 55 * 60000, bodyweightKg: 78,
    entries: [{ exerciseId: "bench", name: "Bench", sets: [{ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 }] }] });
  nutrition[d] = [{ id: `m${i}`, name: "Meal", grams: 400, slot: "post_shift", proc: 1,
    n: { kcal: 2400, p: trained ? 180 : 90, c: 250, f: 70 } }];
}
const profile = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" };

console.log("\n── 38: at least three insights compute from real data ──");
const res = C.crossModuleInsights({ legacyHabits, sleep, nutrition, nutritionProfile: profile, gymSessions, today: TODAY });
for (const i of res.insights) console.log(`     [${i.status}] ${i.id}: ${i.text}`);
ok(`three or more computed (${res.computed})`, res.computed >= 3);
ok("each carries its own evidence", res.insights.every((i) => typeof i.evidence === "string" && i.evidence.length > 10));
ok("each cites a Law or a named rule", res.insights.every((i) => (i.law && i.law.title) || i.rule));
ok("the sleep insight cites Law 7", res.insights.find((i) => i.id === "sleep-discipline")?.law?.n === 7);
ok("the gate insight cites Law 9", res.insights.find((i) => i.id === "gate-habits")?.law?.n === 9);

console.log("\n── the findings are real, not decorative ──");
const sd = res.insights.find((i) => i.id === "sleep-discipline");
ok(`short nights track worse habit days (gap ${sd.gap} points)`, sd.status === "computed" && sd.gap > 5);
const pt = res.insights.find((i) => i.id === "protein-training");
ok(`protein lands on training days more (gap ${pt.gap} points)`, pt.status === "computed" && pt.gap > 8);
ok("and it states the rule that protein does not drop on rest days", /does not drop on a rest day/.test(pt.text));

console.log("\n── thin data says so instead of inventing a finding ──");
const thin = C.crossModuleInsights({ legacyHabits, sleep: { [back(1)]: 7 }, today: TODAY });
ok("insufficient insights are kept, not hidden", thin.insights.length === 3);
ok("and are marked insufficient", thin.insights.some((i) => i.status === "insufficient"));
ok("an unlogged night is never counted as a breach",
   C.V.sleepView({}).heldFloorOn(back(1)) === null);
ok("a logged short night is", C.V.sleepView({ [back(1)]: 5 }).heldFloorOn(back(1)) === false);

console.log("\n── 39: the Firm reads habit data through a view ──");
const files = [];
(function walk(d) { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(e)) files.push(p); } })(join(root, "src/modules/firm"));
const stripComments = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim())).join("\n");
const direct = files.filter((f) => /useStorageState\(\s*["'](ht_habits|ht_entries|habits)["']/.test(stripComments(readFileSync(f, "utf8"))))
  .map((f) => f.slice(root.length + 1));
ok(`no Firm file reads a habit store directly${direct.length ? ` (${direct.join(", ")})` : ""}`, direct.length === 0);
ok("a discipline view exists for it to read through", /export function disciplineView/.test(read("src/shared/views.js")));
ok("and the view is read-only", !/writeStore|setItem|localStorage\.set/.test(stripComments(read("src/shared/views.js"))));

console.log("\n── 40: sleep has exactly one authoritative source ──");
const allFiles = [];
(function walk(d) { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(e)) allFiles.push(p); } })(join(root, "src"));
const sleepKeys = new Set();
for (const f of allFiles) {
  for (const m of stripComments(readFileSync(f, "utf8")).matchAll(/useStorageState\(\s*["']([a-z_0-9]*sleep[a-z_0-9]*)["']/g)) sleepKeys.add(m[1]);
}
console.log(`     sleep stores in use: ${[...sleepKeys].join(", ") || "none"}`);
ok("exactly one sleep store", sleepKeys.size === 1 && sleepKeys.has("trade_sleep"));
ok("the floor is defined once", /SLEEP_FLOOR_HOURS = 6\.5/.test(read("src/shared/views.js")));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Cross-module: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
