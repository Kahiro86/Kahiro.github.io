// Hydration and sleep, end to end: log → completion → trend → consistency,
// and the same numbers on the Command Centre as in the report.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const entry = join(here, "_wb.js");
writeFileSync(entry, `export * from "${join(root, "src/shared/wellbeing.js").replace(/\\/g, "/")}";`);
const out = join(mkdtempSync(join(tmpdir(), "wb-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const W = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-22";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const profile = { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" }; // 2,730 ml target

// 20 of 30 days logged; hits on two thirds of them. Ten days never recorded.
const nutrition = {};
for (let i = 0; i < 30; i++) {
  if (i % 3 === 2) continue;                       // 10 unlogged days
  // Fluid is counted from beverage entries (grams ≈ ml) — that is how the
  // app actually models drinking; an `n.fluidMl` field is ignored.
  nutrition[back(i)] = [
    { id: `m${i}`, name: "Meal", grams: 300, slot: "post_shift", proc: 1, n: { kcal: 700, p: 40, c: 60, f: 20 } },
    { id: `w${i}`, name: "Water", grams: i % 2 === 0 ? 3000 : 1200, slot: "post_shift", proc: 1, bev: true, n: { kcal: 0 } },
  ];
}
const sleep = {};
for (let i = 0; i < 30; i++) { if (i % 5 === 4) continue; sleep[back(i)] = i % 4 === 0 ? 5.4 : 7.6; }

console.log("\n── hydration: log → completion → consistency ──");
const h = W.hydrationSeries({ nutrition, nutritionProfile: profile, today: TODAY, days: 30 });
console.log(`     ${h.loggedDays}/${h.days} logged · ${h.consistency}% consistency · avg ${(h.average / 1000).toFixed(1)} L · target ${h.targetLabel}`);
ok("it reads the real water target from the profile", h.target > 2000 && h.target < 3500);
ok("coverage counts only logged days", h.loggedDays === 20 && h.coverage === 67);
ok("consistency is over logged days, not the whole window", h.consistency === Math.round((h.hits / h.loggedDays) * 100));
ok("an unlogged day is null, never zero", h.rows.some((x) => x.value === null) && !h.rows.some((x) => x.value === 0));
ok("a hit is measured against the target", h.rows.filter((x) => x.value != null).every((x) => x.hit === (x.value >= h.target)));

console.log("\n── sleep: hours → floor → consistency ──");
const s = W.sleepSeries({ sleep, today: TODAY, days: 30 });
console.log(`     ${s.loggedDays}/${s.days} logged · ${s.consistency}% held the floor · avg ${s.average} h`);
ok("the floor is the covenant's 6.5h", s.target === 6.5);
ok("short nights are misses, unlogged nights are not", s.rows.some((x) => x.hit === false) && s.rows.some((x) => x.hit === null));
ok("the average is over logged nights only", s.average > 6 && s.average < 8);

console.log("\n── weekly trend ──");
const wk = W.weeklyBuckets(s, 4);
console.log(`     ${wk.map((b) => `${b.label}:${b.consistency == null ? "—" : b.consistency + "%"}`).join(" ")}`);
ok("four weekly buckets", wk.length === 4);
ok("each carries its own coverage", wk.every((b) => Number.isFinite(b.loggedDays)));

console.log("\n── the Command Centre reads the same function ──");
const todayH = W.todayStatus(W.hydrationSeries({ nutrition, nutritionProfile: profile, today: TODAY, days: 1 }));
const fromSeries = h.rows[h.rows.length - 1];
ok("today's tile matches the series' last day", todayH.value === fromSeries.value && todayH.hit === fromSeries.hit);
const emptyDay = W.todayStatus(W.hydrationSeries({ nutrition: {}, nutritionProfile: profile, today: TODAY, days: 1 }));
ok("an unlogged today reads as unlogged, not as a miss", emptyDay.logged === false && emptyDay.value === null);

console.log("\n── nothing logged at all ──");
const none = W.sleepSeries({ sleep: {}, today: TODAY, days: 30 });
ok("consistency is null, not 0%", none.consistency === null);
ok("average is null, not 0", none.average === null);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Wellbeing: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
