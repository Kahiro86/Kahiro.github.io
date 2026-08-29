// A purity day is one fact in two stores, and both have to move.
//
// purity_log owns the CONTENT — the triggers, the hour, the reflection —
// and ht_entries owns the completion signal the XP engine, the streaks and the
// activity feed read. Before this, the Purity screen wrote only the first, and
// the boot migration meant to catch up was idempotent on the DATE. So a day
// corrected from clean to relapse updated the streak on Home and left XP
// paying for the claim the user had just retracted; a day deleted left the
// tracker entry behind entirely.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_pm.js"), `
export * as migrate from "${p("src/modules/habits/migrateDiscipline.js")}";
export * as collect from "${p("src/shared/xp/collect.js")}";
`);
const r = await build({ entryPoints: [join(here, "_pm.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "pm-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const { migrate, collect } = await import(pathToFileURL(out).href);
import { make } from "../fixtures/builders.mjs";

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const D = "2026-08-20";
const TODAY = "2026-08-28";
// Built, not hand-written. A habit literal missing `type` falls through
// isCompleted's numeric branch, where value 0 reads as `0 >= 0` — complete —
// and the test measures its own fixture rather than the app.
const PURITY = make.habit({ id: "sys_purity", name: "Purity", subtype: "abstinence" });
const base = { journal: [], htHabits: [PURITY], everPinned: ["sys_purity", "sys_journal"] };
const entry = (value) => ({ id: "e1", habitId: "sys_purity", date: D, value });

console.log("\n1. The boot migration reconciles by value, not just by date");
{
  const corrected = migrate.planDisciplineMigration({ ...base, purity: { [D]: { s: "relapse", triggers: [] } }, htEntries: [entry(1)] });
  ok("a day corrected to a relapse is corrected in the tracker too", corrected.fixEntries.length === 1);
  ok("to value 0, which is a recorded miss and not an absent day", corrected.fixEntries[0].value === 0);
  ok("and it is not duplicated as a second entry", corrected.addEntries.length === 0);

  const agreeing = migrate.planDisciplineMigration({ ...base, purity: { [D]: { s: "pure", triggers: [] } }, htEntries: [entry(1)] });
  ok("a day the two already agree on is left alone", agreeing.fixEntries.length === 0 && agreeing.addEntries.length === 0);
  ok("and counted as already present", agreeing.report.alreadyPresent === 1);

  const fresh = migrate.planDisciplineMigration({ ...base, purity: { [D]: { s: "pure", triggers: [] } }, htEntries: [] });
  ok("a day the tracker has never seen is added", fresh.addEntries.length === 1 && fresh.fixEntries.length === 0);
}

console.log("\n2. The correction reaches XP");
{
  const paid = (htEntries) => {
    const byDay = collect.collectEvents({ htHabits: [PURITY], htEntries }, TODAY);
    return (byDay[D] || []).filter((e) => e.kind === "purity.dayClaimed").length;
  };
  ok("a clean day is claimed", paid([entry(1)]) === 1);
  ok("a relapse claims nothing", paid([entry(0)]) === 0);
  // The whole point: the correction has to arrive here, not stop at purity_log.
  const corrected = migrate.planDisciplineMigration({ ...base, purity: { [D]: { s: "relapse", triggers: [] } }, htEntries: [entry(1)] });
  const after = [entry(1)].map((e) => corrected.fixEntries.find((f) => f.id === e.id) || e);
  ok("after the migration runs, the retracted day pays nothing", paid(after) === 0);
}

console.log("\n3. The Purity screen writes both stores itself, not just the log");
{
  const src = (await import("node:fs")).readFileSync(join(root, "src/modules/life/PurityTab.jsx"), "utf8");
  ok("it imports the tracker writer", /mirrorPurityToTracker/.test(src));
  // Three places change a day's status: the two buttons, the undo, and the
  // month grid's cycle. All three have to write through, or the gap reopens
  // in whichever one was missed.
  const calls = (src.match(/mirrorPurityToTracker\(/g) || []).length;
  ok(`every status-changing path mirrors (${calls} call sites)`, calls >= 3);

  const w = (await import("node:fs")).readFileSync(join(root, "src/modules/habits/disciplineWriters.js"), "utf8");
  ok("clearing a day removes the entry rather than writing a zero", /status === null \|\| status === undefined/.test(w));
  ok("and the note and created date survive a correction", /note: prev\?\.note/.test(w) && /createdAt: prev\?\.createdAt/.test(w));
}

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Purity mirror: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
