// §4 at the domain level: the four states, and the two habit kinds where a
// percentage would be a lie.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_cmp.js"), `export * from "${p("src/modules/habits/logic/completion.ts")}";`);
const r = await build({ entryPoints: [join(here, "_cmp.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "cmp-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const C = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const stretch = { id: "h", name: "Stretch", type: "numeric", unit: "min", target: 15, targetDirection: "at_least" };
const at = (v) => C.completionOf(stretch, { habitId: "h", date: "2026-08-25", value: v });

console.log("\n1. The ladder the brief specifies");
ok("5 of 15 is 33% partial", at(5).pct === 33 && at(5).status === "partial");
ok("15 of 15 is 100% complete", at(15).pct === 100 && at(15).status === "complete");
ok("20 of 15 is 133% exceeded", at(20).pct === 133 && at(20).status === "exceeded");
ok("0 of 15 is 0% none", at(0).pct === 0 && at(0).status === "none");
ok("no row at all is unlogged", C.completionOf(stretch, null).status === "unlogged");

console.log("\n1b. The raw value is never destroyed");
for (const v of [0, 1, 5, 14, 15, 40]) ok(`${v} survives as ${v}`, at(v).actual === v);
ok("the target rides along", at(5).target === 15);
ok("so does the unit", at(5).unit === "min");
ok("exceeding is not clamped to 100", at(30).pct === 200);

console.log("\n2. done still means what it meant");
ok("partial is not done", at(5).done === false);
ok("complete is done", at(15).done === true);
ok("exceeded is done", at(20).done === true);

console.log("\n3. A boolean habit has no magnitude to report");
const bool = { id: "b", name: "Pray", type: "boolean", unit: null, target: null, targetDirection: "at_least" };
const b1 = C.completionOf(bool, { habitId: "b", date: "x", value: 1 });
const b0 = C.completionOf(bool, { habitId: "b", date: "x", value: 0 });
ok("a tick is complete at 100%", b1.status === "complete" && b1.pct === 100);
ok("an explicit 0 is 'none', not unlogged", b0.status === "none" && b0.pct === 0);

console.log("\n4. 'No more than N' refuses a percentage");
const cap = { id: "c", name: "Scrolling", type: "numeric", unit: "min", target: 30, targetDirection: "at_most" };
const under = C.completionOf(cap, { habitId: "c", date: "x", value: 10 });
const over = C.completionOf(cap, { habitId: "c", date: "x", value: 45 });
ok("under the ceiling is complete", under.status === "complete" && under.done);
ok("and reports NO percentage", under.pct === null && under.ratio === null);
ok("because 10 of a maximum 30 is not 'a third of an achievement'", under.pct !== 33);
ok("over the ceiling is not complete", over.status === "none" && !over.done);
ok("but the amount is still recorded", over.actual === 45);

console.log("\n5. A habit with no usable target says so rather than dividing by zero");
const noTarget = { id: "n", name: "Walk", type: "numeric", unit: "km", target: 0, targetDirection: "at_least" };
const n = C.completionOf(noTarget, { habitId: "n", date: "x", value: 3 });
ok("no percentage is invented", n.pct === null && n.ratio === null);
ok("and the value is kept", n.actual === 3);
ok("nothing is NaN or Infinity", Number.isFinite(n.actual) && !Number.isNaN(n.actual));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Completion ratio: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
