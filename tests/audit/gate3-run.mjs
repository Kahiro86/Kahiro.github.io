// Gate 3 — the collection + ledger pipeline end to end, on realistic stores.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const p = (f) => join(root, "src/shared/xp", f).replace(/\\/g, "/");
const entry = join(here, "_g3r.js");
writeFileSync(entry, `export * as R from "${p("run.js")}";
export * as C from "${p("collect.js")}";
export * as L from "${p("ledger.js")}";
export * as E from "${p("engine.js")}";`);
const out = join(mkdtempSync(join(tmpdir(), "g3r-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const { R, C, L, E } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = "2026-08-22";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const habit = (id, name) => ({ id, name, subtype: id === "sys_purity" ? "abstinence" : id === "sys_journal" ? "journal" : "standard",
  type: "boolean", frequencyType: "daily", frequencyDays: null, frequencyCount: null, target: null, targetDirection: "at_least",
  unit: null, routineId: null, archivedAt: null, createdAt: `${back(80)}T12:00:00.000Z`, updatedAt: `${back(80)}T12:00:00.000Z`, sortOrder: 0 });
const ent = (habitId, date, value = 1) => ({ id: `${habitId}_${date}`, habitId, date, value, note: null, createdAt: "", updatedAt: "" });

// A month of real use: three habits, a "Train today" habit, workouts on the
// same days, meals, sleep, a vault contribution and a cleared gate.
const habits = [habit("h1", "Deep work 90m"), habit("h2", "Read 20 pages"), habit("h_train", "Train today")];
const entries = [];
for (let i = 0; i < 30; i++) { entries.push(ent("h1", back(i))); if (i % 3) entries.push(ent("h2", back(i))); }
const trainDays = [0, 2, 4, 7, 9, 11, 14];
for (const d of trainDays) entries.push(ent("h_train", back(d)));
const workouts = trainDays.map((d) => ({ id: `w${d}`, type: "strength", date: back(d), name: "Push",
  exercises: [{ name: "Bench", sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }] }));
const nutrition = {}; for (let i = 0; i < 20; i++) nutrition[back(i)] = [{ id: `m${i}`, name: "Meal", grams: 400, slot: "post_shift", proc: 1, n: { kcal: 900, p: 70, c: 90, f: 25 } }];
const sleep = {}; for (let i = 0; i < 20; i++) sleep[back(i)] = i % 5 === 0 ? 5.5 : 7.5;
// The month before today — a completed month, which is the only kind that
// can be clean.
const GATE_MONTH = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
const deps = {
  htHabits: habits, htEntries: entries, workouts, nutrition,
  nutritionProfile: { age: 27, sex: "male", heightCm: 178, weightKg: 78, activity: 1.55, goal: "muscle" },
  sleep,
  finance: { withdrawals: [{ id: "w1", date: back(6), amount: 50000, split: { fleet: 20000, vault: 15000, book: 10000, life: 5000 } }] },
  // A genuinely clean month, not a `gatesCleared` row. That array was what
  // this fixture used to seed, and nothing in the app writes it — so this
  // assertion passed against data no user could ever produce, which is
  // exactly how the award stayed unreachable without anyone noticing.
  // Clean now means what the Firm's own gate means: reviewed, checklist
  // held, withdrawal taken.
  reviews: [
    { id: "rw", date: back(7), kind: "weekly" },
    { id: "rm", date: back(4), kind: "monthly", period: GATE_MONTH },
  ],
  trades: [{ id: "t1", date: `${GATE_MONTH}-10`, status: "CLOSED", outcome: "WIN", checklistTotal: 5, checklistScore: 5 }],
  firmWithdrawals: [{ id: "fw1", date: `${GATE_MONTH}-28`, amount: 50000, split: { fleet: 20000, vault: 15000, book: 10000, life: 5000 } }],
};
const isScheduledOn = () => true;

console.log("\n── presence is not collected at all ──");
const events = C.collectEvents(deps, TODAY);
const allKinds = new Set(Object.values(events).flat().map((e) => e.kind));
ok(`no app.* event exists (${[...allKinds].length} kinds collected)`, ![...allKinds].some((k) => k.startsWith("app.")));
ok("no trade.logged event exists", !allKinds.has("trade.logged"));
ok("but the day-review does", allKinds.has("review.weekly"));

console.log("\n── criterion 12: one action, one payment ──");
// Collect TAGS the group; priceDay decides the winner, because that is the
// only place difficulty, consistency and balance exist. Ranking at collect
// time meant ranking on the bare base value, which is finding 7.
const trainDay = events[back(2)];
ok("both the session and the habit are collected", trainDay.some((e) => e.habitId === "h_train") && trainDay.some((e) => e.kind === "workout.logged"));
ok("both are tagged as the same real-world action", trainDay.filter((e) => e.group === "training").length === 2);
ok("and collect does not decide between them", !trainDay.some((e) => e.supersededBy));

const pricedTrain = E.priceDay(trainDay, {});
const habitLine = pricedTrain.lines.find((l) => l.label === "Train today");
const sessionLine = pricedTrain.lines.find((l) => l.kind === "workout.logged");
ok(`the cheaper one is superseded once priced (${habitLine.reason || "-"})`, habitLine.awarded === 0 && habitLine.satisfied === true);
ok("the session is what pays", sessionLine.awarded > 0);
const restDay = events[back(1)];
ok("on a non-training day nothing is superseded", !E.priceDay(restDay, {}).lines.some((l) => l.satisfied));

console.log("\n── criterion 40: sleep has one source, and it pays ──");
ok("sleep events collected from trade_sleep only", allKinds.has("sleep.floorHeld"));
ok("a sub-floor night produces no event", !(events[back(5)] || []).some((e) => e.kind === "sleep.floorHeld"));

console.log("\n── previously unrewarded modules now pay ──");
ok("vault contribution", allKinds.has("vault.contribution"));
ok("gate month cleared", allKinds.has("gate.monthCleared"));

console.log("\n── the ledger runs, banks and seals ──");
const first = R.runXp({ deps, ledger: null, derivedTotal: 4830, today: TODAY, isScheduledOn });
console.log(`     opening ${first.opening.xp} · banked days ${Object.keys(first.byDay).length} · total ${first.total} · L${first.level} ${first.rank.l}`);
ok("the pre-revamp total is carried forward", first.opening.xp === 4830);
ok("the total is opening plus banked days", first.total === 4830 + Object.values(first.byDay).reduce((s, v) => s + v, 0));
ok("past days are sealed", Object.entries(first.ledger.days).filter(([ds]) => ds < TODAY).every(([, d]) => d.sealedAt));
ok("today is not sealed", first.ledger.days[TODAY].sealedAt === null);
ok("a rank comes from the Covenant", typeof first.rank.from === "string" && first.rank.from.length > 10);
ok("distance to the next level is exposed", first.toNext > 0 && first.nextLevelXp > first.total);

console.log("\n── re-running is stable, and history cannot move ──");
const second = R.runXp({ deps, ledger: first.ledger, derivedTotal: 4830, today: TODAY, isScheduledOn });
ok(`a second run yields the same total (${second.total})`, second.total === first.total);
const stripped = R.runXp({ deps: { ...deps, htHabits: [], htEntries: [] }, ledger: first.ledger, derivedTotal: 4830, today: TODAY, isScheduledOn });
console.log(`     every habit deleted → ${stripped.total} (was ${first.total})`);
ok("deleting every habit does not reduce banked XP", stripped.total >= first.total - (first.ledger.days[TODAY]?.total || 0));
const archived = R.runXp({ deps: { ...deps, htHabits: habits.map((h) => ({ ...h, archivedAt: `${back(1)}T12:00:00.000Z` })) }, ledger: first.ledger, derivedTotal: 4830, today: TODAY, isScheduledOn });
ok("archiving every habit does not reduce banked XP", archived.total >= first.total - (first.ledger.days[TODAY]?.total || 0));

console.log("\n── the ledger explains itself ──");
const aSealed = Object.entries(first.ledger.days).find(([ds, d]) => ds < TODAY && d.lines.length);
ok("sealed days carry their lines", !!aSealed);
if (aSealed) {
  const l = aSealed[1].lines[0];
  console.log(`     ${aSealed[0]}: ${aSealed[1].lines.map((x) => `${x.l} ${x.x}`).join(" · ")}`);
  ok("each line names the action, base and every multiplier",
     l.l && Number.isFinite(l.b) && Number.isFinite(l.d) && Number.isFinite(l.c) && Number.isFinite(l.x));
}

console.log("\n── difficulty is measured and inspectable (criterion 29) ──");
const d1 = first.difficulty.byHabit.h1;
console.log(`     h1 rate ${(d1.rate * 100).toFixed(0)}% → weight ${d1.weight} (${d1.band.l})`);
ok("every habit has a weight", Object.keys(first.difficulty.byHabit).length === habits.length);
ok("the driving completion rate is exposed", Number.isFinite(d1.rate));
ok("the band explains itself in words", typeof d1.band.why === "string" && d1.band.why.length > 10);
ok("the window is stated", first.difficulty.window === 60 && first.difficulty.from < first.difficulty.to);

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Gate 3 ledger pipeline: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
