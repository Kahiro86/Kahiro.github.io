// The §4.1 questions, re-run against the REBUILT engine.
//
// tests/audit/xp-sweep-legacy.mjs holds the original sweep — it measured the
// pre-revamp engine and is kept as the evidence behind the audit report. This
// file asks the same questions of what replaced it, so the answers stay
// checkable rather than becoming a claim in a document.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const xp = (f) => join(root, "src/shared/xp", f).replace(/\\/g, "/");
const entry = join(here, "_sweep2.js");
writeFileSync(entry, `export * as R from "${xp("run.js")}";
export * as E from "${xp("engine.js")}";
export * as V from "${xp("values.js")}";
export * as D from "${xp("difficulty.js")}";`);
const out = join(mkdtempSync(join(tmpdir(), "sw2-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const { R, E, V, D } = await import(pathToFileURL(out).href);

const TODAY = "2026-08-22";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const H = (id, name, ageDays = 70) => ({ id, name, subtype: "standard", type: "boolean", frequencyType: "daily",
  frequencyDays: null, frequencyCount: null, target: null, targetDirection: "at_least", unit: null,
  routineId: null, archivedAt: null,
  createdAt: `${back(ageDays)}T12:00:00.000Z`, updatedAt: `${back(ageDays)}T12:00:00.000Z`, sortOrder: 0 });
const Ent = (habitId, date) => ({ id: `${habitId}_${date}`, habitId, date, value: 1, note: null, createdAt: "", updatedAt: "" });
const run = (deps) => R.runXp({ deps, ledger: null, derivedTotal: 0, today: TODAY, isScheduledOn: () => true });
const perDay = (res) => { const ks = Object.keys(res.byDay).filter((k) => k >= back(13)); return Math.round(ks.reduce((s, k) => s + res.byDay[k], 0) / Math.max(1, ks.length)); };

let bad = 0;
const line = (label, value, verdict, good) => { if (!good) bad++; console.log(`    ${label.padEnd(46)} ${String(value).padStart(10)}  ${good ? "✓" : "✗"} ${verdict}`); };

console.log("\n═══ §4.1 STEP 3, re-asked of the rebuilt engine ═══\n");

const base = [H("r1", "Deep work 90m"), H("r2", "Read 20 pages"), H("r3", "Cold shower")];
const baseEnt = []; for (const h of base) for (let i = 0; i < 60; i++) baseEnt.push(Ent(h.id, back(i)));
const before = run({ htHabits: base, htEntries: baseEnt });

console.log("Q4  Five trivial habits, completed 14/14 days:");
// Added 13 days ago and hit every day since — the actual farming attempt.
const triv = [1, 2, 3, 4, 5].map((n) => H(`t${n}`, `Trivial ${n}`, 13));
const trivEnt = [...baseEnt]; for (const h of triv) for (let i = 0; i < 14; i++) trivEnt.push(Ent(h.id, back(i)));
const after = run({ htHabits: [...base, ...triv], htEntries: trivEnt });
// The percentage is the wrong measure now: the baseline itself moved, because
// three habits the user never misses are correctly priced as mastered (×0.6).
// What matters is the absolute yield farming buys — pre-revamp it was
// +89 XP/day on a 98/day baseline.
const gain = perDay(after) - perDay(before);
line("daily XP before → after", `${perDay(before)} → ${perDay(after)}`,
  `farming buys +${gain}/day (was +89)`, gain < 89 * 0.5);
line("the trivial habits' own weight", D.difficultyFor({ scheduled: 14, completed: 14 }).weight,
  "decayed to the floor", D.difficultyFor({ scheduled: 14, completed: 14 }).weight === 0.6);
// And the test that actually matters: difficulty beats quantity.
const hardSet = E.priceDay([...Array(5)].map((_, i) => ({ kind: "habit.completed", habitId: `s${i}` })),
  { difficulty: Object.fromEntries([...Array(5)].map((_, i) => [`s${i}`, { weight: 1.4 }])), consistency: 1.5, balance: {} }).total;
const paddedSet = E.priceDay([...Array(12)].map((_, i) => ({ kind: "habit.completed", habitId: `p${i}` })),
  { difficulty: Object.fromEntries([...Array(12)].map((_, i) => [`p${i}`, { weight: 0.6 }])), consistency: 1.5, balance: {} }).total;
line("5 hard habits vs 12 trivial ones", `${hardSet} vs ${paddedSet}`, "difficulty beats quantity", hardSet > paddedSet);

console.log("\nQ2/14  Is XP weighted by how hard a habit is for this user?");
const easy = D.difficultyFor({ scheduled: 60, completed: 57 }).weight;
const hard = D.difficultyFor({ scheduled: 60, completed: 33 }).weight;
const easyXp = E.priceEvent({ kind: "habit.completed" }, { difficulty: easy }).xp;
const hardXp = E.priceEvent({ kind: "habit.completed" }, { difficulty: hard }).xp;
line("95% habit vs 55% habit, per completion", `${easyXp} vs ${hardXp}`, "the harder one pays more", hardXp > easyXp);

console.log("\nQ5  Does merely opening the app award XP?");
line("app.opened", E.priceEvent({ kind: "app.opened" }).xp, "presence pays nothing", E.priceEvent({ kind: "app.opened" }).xp === 0);

console.log("\nQ3/12  One real action tracked twice:");
const days7 = [...Array(7)].map((_, i) => back(i));
const wo = (d) => ({ id: `w${d}`, type: "strength", date: d, exercises: [{ name: "Bench", sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }] });
const th = H("h_train", "Train today");
const woOnly = run({ workouts: days7.map(wo) }).total;
const bothT = run({ workouts: days7.map(wo), htHabits: [th], htEntries: days7.map((d) => Ent("h_train", d)) }).total;
line("workout only vs workout + 'train today' habit", `${woOnly} vs ${bothT}`, "pays once", woOnly === bothT);

console.log("\nQ6  Daily caps:");
line("per-domain caps defined", Object.keys(V.DOMAINS).length, "every domain capped", Object.values(V.DOMAINS).every((d) => d.cap > 0));

console.log("\nQ7  Streak effect:");
line("multiplier at 0 / 7 / 21 / 60 / 3650 days",
  [0, 7, 21, 60, 3650].map(E.consistencyMultiplier).join(" "), "bounded at 1.5",
  Math.max(...[0, 7, 21, 60, 3650].map(E.consistencyMultiplier)) === 1.5);

console.log("\nQ8/10/19/20  XP after a habit is archived or deleted:");
const live = run({ htHabits: base, htEntries: baseEnt });
const gone = R.runXp({ deps: {}, ledger: live.ledger, derivedTotal: 0, today: TODAY, isScheduledOn: () => true });
line("active → all habits deleted", `${live.total} → ${gone.total}`, "banked XP survives", gone.total >= live.total - (live.ledger.days[TODAY]?.total || 0));

console.log("\nQ9  Level curve:");
line("L5 / L10 / L20", [5, 10, 20].map(V.xpForLevel).join(" / "), "matches the spec's 500×n^1.35", Math.abs(V.xpForLevel(10) - 11195) <= 5);

console.log("\nQ11  Modules that award nothing:");
const gate = run({ finance: { withdrawals: [{ id: "w1", date: back(3), split: { vault: 15000 } }], gatesCleared: [{ date: back(2) }] } });
const sleep = run({ sleep: { [back(1)]: 7.5 } });
line("vault contribution + gate month cleared", gate.total, "now paid", gate.total > 0);
line("sleep floor held", sleep.total, "now paid", sleep.total > 0);

console.log("\nQ12  Proportionality:");
line("one-tap habit vs 45-min session", `${E.priceEvent({ kind: "habit.completed" }, { difficulty: 1 }).xp} vs ${E.priceEvent({ kind: "workout.logged" }).xp}`,
  "session pays ≥3× a tap", E.priceEvent({ kind: "workout.logged" }).xp >= 3 * E.priceEvent({ kind: "habit.completed" }, { difficulty: 1 }).xp);

// Criterion 10, structurally rather than by inspection: the retired engine
// still owns achievements and journeys (moving them is Gate 5), but no amount
// from the retired value table may leave it. Nothing renders those numbers
// today — the point is that nothing can start to without this failing.
{
  const eng = readFileSync(join(root, "src/shared/xpEngine.js"), "utf8");
  const achBlock = eng.slice(eng.indexOf("const achievements = ACHIEVEMENTS.map"), eng.indexOf("const newly ="));
  line("achievements leak no xp from the retired engine", /\bxp: /.test(achBlock) ? "leaks" : "clean", "criterion 10 holds structurally", !/\bxp: /.test(achBlock));
  const tierBlock = eng.slice(eng.indexOf("const tiers = j.tiers.map"), eng.indexOf("const done = tiers"));
  line("journey tiers leak no xp either", /\bxp\b/.test(tierBlock) ? "leaks" : "clean", "the ledger is the only thing that prices", !/\bxp\b/.test(tierBlock));
}

console.log("");
console.log(bad ? `${bad} answer(s) still unsatisfactory` : "Every §4.1 finding is now answered the right way.");
process.exit(bad ? 1 : 0);
