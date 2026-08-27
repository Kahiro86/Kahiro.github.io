// §3: Body says what is being neglected and where progression has stalled.
// The interesting property is restraint — with three sets logged all month,
// every discipline is "neglected" and none of it means anything.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (rel) => join(root, rel).replace(/\\/g, "/");
writeFileSync(join(here, "_tb.js"), `export * from "${p("src/modules/gym/trainingBalance.js")}";`);
const r = await build({ entryPoints: [join(here, "_tb.js")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
const out = join(mkdtempSync(join(tmpdir(), "tb-")), "b.mjs");
writeFileSync(out, r.outputFiles[0].text);
const B = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = new Date().toISOString().slice(0, 10);
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const session = (date, exerciseId, sets = 4) => ({
  id: `s-${date}-${exerciseId}`, date, bodyweightKg: 78,
  entries: [{ exerciseId, sets: Array.from({ length: sets }, () => ({ reps: 8, weightKg: 60, bodyweightKg: 78, timestamp: 0 })) }],
});

console.log("\n1. Sets, not sessions");
const mixed = [
  { id: "m1", date: ago(1), bodyweightKg: 78, entries: [
    { exerciseId: "back-squat", sets: Array.from({ length: 19 }, () => ({ reps: 5 })) },
    { exerciseId: "couch-stretch", sets: [{ durationSec: 30 }] },
  ] },
];
const mb = B.trainingBalance({ sessions: mixed, today: TODAY });
const strengthRow = mb.rows.find((x) => x.id === "strength");
const stretchRow = mb.rows.find((x) => x.id === "stretching");
ok("nineteen squat sets count as nineteen", strengthRow.sets === 19);
ok("one stretch set counts as one", stretchRow.sets === 1);
ok("a session with one mobility set is not a mobility day", stretchRow.share < 10);
ok("shares are of all sets in the window", strengthRow.share === 95);

console.log("\n2. Every discipline is reported, including the empty ones");
ok("all nine appear", mb.rows.length === 9);
ok("the untouched ones read zero", mb.rows.filter((x) => x.sets === 0).length === 7);
ok("and carry no last-seen date", mb.rows.filter((x) => x.sets === 0).every((x) => x.lastOn === null));
ok("the ones that happened do", strengthRow.lastOn === ago(1));

console.log("\n3. It refuses to have an opinion on thin data");
ok("three sets all month says nothing",
  B.balanceFindings(B.trainingBalance({ sessions: [session(ago(2), "back-squat", 3)], today: TODAY })).length === 0);
ok("nor does an empty month", B.balanceFindings(B.trainingBalance({ sessions: [], today: TODAY })).length === 0);
ok("the threshold is stated, not buried", B.MIN_SETS_FOR_BALANCE >= 10);

console.log("\n4. With enough training, it names what is missing");
const allLifting = Array.from({ length: 8 }, (_, i) => session(ago(i * 3), "back-squat", 5));
const f = B.balanceFindings(B.trainingBalance({ sessions: allLifting, today: TODAY }));
ok("it speaks now", f.length > 0);
ok("no mobility is called out", f.some((x) => x.id === "missing:mobility"));
ok("no stretching too", f.some((x) => x.id === "missing:stretching"));
ok("every finding is one short sentence", f.every((x) => x.text.length < 90));
ok("at most three", f.length <= 3);

console.log("\n5. All strength and no conditioning");
const noCardio = Array.from({ length: 6 }, (_, i) => session(ago(i), "back-squat", 5));
const f2 = B.balanceFindings(B.trainingBalance({ sessions: noCardio, today: TODAY }));
ok("the imbalance is named", f2.some((x) => x.id === "missing:conditioning"));
const withCardio = [...noCardio, session(ago(1), "jump-rope", 6)];
ok("and goes away once there is some",
  !B.balanceFindings(B.trainingBalance({ sessions: withCardio, today: TODAY })).some((x) => x.id === "missing:conditioning"));

console.log("\n6. Something that stopped");
const stopped = [
  ...Array.from({ length: 6 }, (_, i) => session(ago(i), "back-squat", 5)),
  session(ago(20), "jump-rope", 6),
];
const f3 = B.balanceFindings(B.trainingBalance({ sessions: stopped, today: TODAY }));
ok("a discipline that lapsed is flagged", f3.some((x) => x.id === "stalled:hiit"));
ok("with how long it has been", f3.some((x) => /\d+ days/.test(x.text)));
ok("something logged this week is not called stalled",
  !B.balanceFindings(B.trainingBalance({ sessions: [...noCardio, session(ago(2), "jump-rope", 6)], today: TODAY })).some((x) => x.id === "stalled:hiit"));

console.log("\n7. Only the window counts");
ok("a session outside the window is excluded",
  B.trainingBalance({ sessions: [session(ago(90), "back-squat", 5)], today: TODAY }).totalSets === 0);
ok("an unknown exercise id is skipped rather than crashing",
  B.trainingBalance({ sessions: [session(ago(1), "not-a-real-exercise", 5)], today: TODAY }).totalSets === 0);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Training balance: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
