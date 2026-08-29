// One day score, read by both surfaces.
//
// There were two: the Command Centre averaged three parts over the tracker's
// stores, the Weekly Review four over the tracker merged with the retired
// legacy store — under a comment claiming they were the same. The same day
// scored differently depending on which screen you asked.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
const read = (rel) => readFileSync(join(root, rel), "utf8");

writeFileSync(join(here, "_ds.js"), `
export * as ds from "${p("src/shared/dayScore.js")}";
export * as wr from "${p("src/shared/weekReview.js")}";
`);
const r = await build({ entryPoints: [join(here, "_ds.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "ds-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const { ds, wr } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

console.log("\n1. There is exactly one definition, and both surfaces read it");
{
  const dash = read("src/modules/dashboard/Dashboard.jsx");
  const week = read("src/shared/weekReview.js");
  ok("the Command Centre imports it", /from "\.\.\/\.\.\/shared\/dayScore\.js"/.test(dash));
  ok("the Weekly Review imports it", /from "\.\/dayScore\.js"/.test(week));
  // The old bug was two local `const dayScore = (d) => {` blocks that each
  // summed their own `parts` array. Neither may build one again.
  ok("neither builds its own parts array", !/const parts = \[\];[\s\S]{0,400}parts\.push/.test(dash) && !/const parts = \[\];[\s\S]{0,400}parts\.push/.test(week));
  ok("and the false parity comment is gone", !/same four parts the cockpit's Life Score uses/.test(week));
}

console.log("\n2. The parts are the four a day is actually made of");
{
  ok("all four held is 100", ds.dayScore({ habitRatio: 1, trained: true, ate: true, wrote: true }) === 100);
  ok("nothing at all is 0", ds.dayScore({}) === 0);
  ok("a planned rest day counts as the training part", ds.dayScore({ rested: true }) === ds.dayScore({ trained: true }));
  ok("it grades on four parts", ds.DAY_SCORE_PARTS === 4);
}

console.log("\n3. A day with nothing scheduled is not a day of failure");
{
  // The habit part is dropped, not zeroed: an absence of obligation is not a
  // miss, the same rule the activity feed applies to unlogged days.
  const noHabits = ds.dayScore({ habitRatio: null, trained: true, ate: true, wrote: true });
  const zeroHabits = ds.dayScore({ habitRatio: 0, trained: true, ate: true, wrote: true });
  ok(`nothing scheduled scores ${noHabits}, all missed scores ${zeroHabits}`, noHabits === 100 && zeroHabits === 75);
  ok("a ratio outside 0–1 cannot inflate the score", ds.dayScore({ habitRatio: 5, trained: true, ate: true, wrote: true }) === 100);
}

console.log("\n4. The Weekly Review's number is the shared function's number");
{
  // A Monday, so the elapsed week is exactly one day and the week's average
  // is that day's score — no arithmetic in the test to get wrong.
  const D = "2026-08-17";
  const dow = new Date(`${D}T12:00:00`).getDay();
  ok(`the fixture date is a Monday (getDay ${dow})`, dow === 1);

  const week = wr.buildWeekReview({
    habits: [], workouts: [{ id: "w1", date: D, type: "strength" }],
    nutrition: { [D]: [{ id: "m", name: "X", slot: "pre_shift", grams: 100, n: { kcal: 400 } }] },
    entries: [{ id: "j", date: D, text: "wrote" }],
    purity: {}, restDays: [], ds: D,
    // The injected ratio is the tracker's, which is what WeeklyReview.jsx
    // passes — the same source the Command Centre reads.
    habitRatioOn: (d) => (d === D ? 0.5 : null),
  });
  const expected = ds.dayScore({ habitRatio: 0.5, trained: true, ate: true, wrote: true });
  ok(`the week's score is the shared function's (${week.score} === ${expected})`, week.score === expected);
  ok("and not the three-part number the cockpit used to produce", week.score !== Math.round(((0.5 + 1 + 1) / 3) * 100));

  // Without an injected ratio it must still work — the pure tests call it
  // that way — and must still be the same function underneath.
  const standalone = wr.buildWeekReview({
    habits: [], workouts: [{ id: "w1", date: D, type: "strength" }],
    nutrition: { [D]: [{ id: "m", name: "X", slot: "pre_shift", grams: 100, n: { kcal: 400 } }] },
    entries: [{ id: "j", date: D, text: "wrote" }],
    purity: {}, restDays: [], ds: D,
  });
  ok(`with no habits at all it scores the other three parts (${standalone.score})`,
    standalone.score === ds.dayScore({ habitRatio: null, trained: true, ate: true, wrote: true }));
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Day score: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
