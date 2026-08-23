// Gate 1's guarantee, re-proved on the Gate 3 ledger.
//
// Purity and Journal are pinned habits since Gate 1. They must pay ONCE — as
// habit completions through the tracker — never again as separate abstinence
// or journal events. Before Gate 3 that was enforced by suppression flags in
// the old engine; now it holds because there is only one collection path.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const xp = (f) => join(root, "src/shared/xp", f).replace(/\\/g, "/");
const entry = join(here, "_ndc.js");
writeFileSync(entry, `export * as R from "${xp("run.js")}";\nexport * as C from "${xp("collect.js")}";`);
const out = join(mkdtempSync(join(tmpdir(), "ndc-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const { R, C } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-22";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const H = (id, name, subtype) => ({ id, name, subtype, type: "boolean", frequencyType: "daily",
  frequencyDays: null, frequencyCount: null, target: null, targetDirection: "at_least", unit: null,
  routineId: null, archivedAt: null, createdAt: `${back(40)}T12:00:00.000Z`, updatedAt: `${back(40)}T12:00:00.000Z`, sortOrder: 0 });
const E = (habitId, date) => ({ id: `${habitId}_${date}`, habitId, date, value: 1, note: null, createdAt: "", updatedAt: "" });

const days = [...Array(10)].map((_, i) => back(i + 1));
const habits = [H("sys_purity", "Purity", "abstinence"), H("sys_journal", "Journal", "journal"), H("h1", "Deep work", "standard")];
const entries = days.flatMap((d) => [E("sys_purity", d), E("sys_journal", d), E("h1", d)]);
// The legacy stores still hold the same days — untouched by Gate 1, by design.
const purity = Object.fromEntries(days.map((d) => [d, { s: "pure", triggers: [] }]));
const journal = days.map((d) => ({ id: `j${d}`, date: d, text: "w ".repeat(30).trim() }));
const journalTextByDate = Object.fromEntries(days.map((d) => [d, "w ".repeat(30).trim()]));

console.log("\n── each pinned habit produces exactly one event per day ──");
const events = C.collectEvents({ htHabits: habits, htEntries: entries, purity, journal, journalTextByDate }, TODAY);
const d0 = events[days[0]];
const purityEvents = d0.filter((e) => e.habitId === "sys_purity" || e.kind === "purity.dayClaimed");
const journalEvents = d0.filter((e) => e.habitId === "sys_journal" || e.kind === "journal.entry");
ok(`one purity event on the day (got ${purityEvents.length})`, purityEvents.length === 1);
ok(`one journal event on the day (got ${journalEvents.length})`, journalEvents.length === 1);
ok("purity is priced as a purity day, not a generic habit", purityEvents[0].kind === "purity.dayClaimed");
ok("journal is priced as a journal entry", journalEvents[0].kind === "journal.entry");

console.log("\n── the legacy stores cannot add a second payment ──");
const withLegacy = R.runXp({ deps: { htHabits: habits, htEntries: entries, purity, journal, journalTextByDate },
  ledger: null, derivedTotal: 0, today: TODAY, isScheduledOn: () => true });
const withoutLegacy = R.runXp({ deps: { htHabits: habits, htEntries: entries, journalTextByDate },
  ledger: null, derivedTotal: 0, today: TODAY, isScheduledOn: () => true });
console.log(`     with purity_log + journal_entries present: ${withLegacy.total}`);
console.log(`     with only the habit rows:                  ${withoutLegacy.total}`);
ok("the legacy stores contribute nothing extra", withLegacy.total === withoutLegacy.total);

console.log("\n── a workout and a 'train today' habit still pay once ──");
const trainHabits = [...habits, H("h_train", "Train today", "standard")];
const trainEntries = [...entries, ...days.map((d) => E("h_train", d))];
const workouts = days.map((d) => ({ id: `w${d}`, type: "strength", date: d, name: "Push",
  exercises: [{ name: "Bench", sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }] }));
const woOnly = R.runXp({ deps: { htHabits: habits, htEntries: entries, workouts, journalTextByDate }, ledger: null, derivedTotal: 0, today: TODAY, isScheduledOn: () => true });
const both = R.runXp({ deps: { htHabits: trainHabits, htEntries: trainEntries, workouts, journalTextByDate }, ledger: null, derivedTotal: 0, today: TODAY, isScheduledOn: () => true });
console.log(`     workouts only: ${woOnly.total} · workouts + "Train today" habit: ${both.total}`);
ok("adding a habit that tracks the same action adds nothing", both.total === woOnly.total);

console.log("\n── and nothing that was banked ever goes down ──");
const first = R.runXp({ deps: { htHabits: trainHabits, htEntries: trainEntries, workouts, journalTextByDate }, ledger: null, derivedTotal: 1000, today: TODAY, isScheduledOn: () => true });
const wiped = R.runXp({ deps: {}, ledger: first.ledger, derivedTotal: 1000, today: TODAY, isScheduledOn: () => true });
ok(`every store emptied → total holds (${first.total} → ${wiped.total})`, wiped.total >= first.total - (first.ledger.days[TODAY]?.total || 0));
for (const [ds, day] of Object.entries(first.ledger.days)) {
  if (ds >= TODAY) continue;
  if ((wiped.ledger.days[ds]?.total ?? -1) !== day.total) { ok(`sealed day ${ds} unchanged`, false); break; }
}
ok("every sealed day is byte-for-byte unchanged",
   Object.entries(first.ledger.days).filter(([ds]) => ds < TODAY)
     .every(([ds, d]) => wiped.ledger.days[ds]?.total === d.total));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Double-count guard: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
