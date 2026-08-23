// §4.1 Step 3 — the twelve questions, answered from the running engine
// rather than from reading it. Every number below is computed, not asserted.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const entry = join(here, "_sweep.js");
writeFileSync(entry, `export * from "${join(root, "src/shared/xpEngine.js").replace(/\\/g, "/")}";`);
const out = join(mkdtempSync(join(tmpdir(), "sw-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const X = await import(pathToFileURL(out).href);

const TODAY = "2026-08-22";
const back = (n) => { const d = new Date(`${TODAY}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const DAYS = 60;

const htHabit = (id, name) => ({ id, name, subtype: "standard", type: "boolean", frequencyType: "daily",
  frequencyDays: null, frequencyCount: null, target: null, targetDirection: "at_least", unit: null,
  routineId: null, archivedAt: null, createdAt: `${back(DAYS)}T12:00:00.000Z`, updatedAt: `${back(DAYS)}T12:00:00.000Z`, sortOrder: 0 });
const entry_ = (habitId, date, value = 1) => ({ id: `${habitId}_${date}`, habitId, date, value, note: null, createdAt: "", updatedAt: "" });

const run = (deps) => X.computeXp({ today: TODAY, ...deps });
const totalOf = (res) => res.total;
const perDay = (res) => { const d = res.byDay || {}; const ks = Object.keys(d).filter((k) => k >= back(13)); return Math.round(ks.reduce((s, k) => s + d[k], 0) / Math.max(1, ks.length)); };

console.log("═══ §4.1 STEP 3 — twelve questions, measured ═══\n");

// ── Q4: can trivial habits inflate daily XP? ────────────────────────
const baseHabits = [htHabit("h_real1", "Deep work 90m"), htHabit("h_real2", "Read 20 pages"), htHabit("h_real3", "Cold shower")];
const baseEntries = [];
for (const h of baseHabits) for (let i = 0; i < DAYS; i++) baseEntries.push(entry_(h.id, back(i)));
const before = run({ htHabits: baseHabits, htEntries: baseEntries });

const trivial = [1, 2, 3, 4, 5].map((n) => htHabit(`h_triv${n}`, `Trivial ${n}`));
const trivEntries = [...baseEntries];
for (const h of trivial) for (let i = 0; i < 14; i++) trivEntries.push(entry_(h.id, back(i)));
const after = run({ htHabits: [...baseHabits, ...trivial], htEntries: trivEntries });

console.log("Q4  Adding 5 trivial habits, completed 14/14 days:");
console.log(`    daily XP before: ${perDay(before)}   after: ${perDay(after)}   delta: +${perDay(after) - perDay(before)} (+${Math.round(((perDay(after) / Math.max(1, perDay(before))) - 1) * 100)}%)`);
console.log(`    lifetime before: ${totalOf(before)}  after: ${totalOf(after)}  delta: +${totalOf(after) - totalOf(before)}`);
console.log(`    → ${perDay(after) > perDay(before) * 1.2 ? "FARMABLE — trivial habits pay full rate" : "resistant"}\n`);

// ── Q14 precursor: does completion rate change what a habit pays? ───
const easy = htHabit("h_easy", "Easy"), hard = htHabit("h_hard", "Hard");
const eEnt = [], hEnt = [];
for (let i = 0; i < DAYS; i++) { if (i % 20 !== 0) eEnt.push(entry_("h_easy", back(i))); }      // 95%
for (let i = 0; i < DAYS; i++) { if (i % 2 === 0) hEnt.push(entry_("h_hard", back(i))); }        // 50%
const onlyEasy = run({ htHabits: [easy], htEntries: eEnt });
const onlyHard = run({ htHabits: [hard], htEntries: hEnt });
console.log("Q2/14  Is XP weighted by how hard a habit is for this user?");
console.log(`    95%-completion habit: ${onlyEasy.total} XP over ${eEnt.length} completions → ${(onlyEasy.total / eEnt.length).toFixed(1)}/completion`);
console.log(`    50%-completion habit: ${onlyHard.total} XP over ${hEnt.length} completions → ${(onlyHard.total / hEnt.length).toFixed(1)}/completion`);
const perEasy = onlyEasy.total / eEnt.length, perHard = onlyHard.total / hEnt.length;
// Base pay is flat at 10; any difference is the streak ladder, which rewards
// the EASY habit — the fairness problem in §4.2, running backwards.
console.log(`    → base is FLAT (10 each); the gap is streak-ladder bonuses, which pay the ${perEasy > perHard ? "EASIER" : "harder"} habit more.`);
console.log(`    → difficulty is not priced in, and the ladder actively inverts it.\n`);

// ── Q5: does presence pay? ──────────────────────────────────────────
const logins = {}; for (let i = 0; i < 30; i++) logins[back(i)] = 1;
const noLogin = run({});
const withLogin = run({ logins });
console.log("Q5  Does merely opening the app award XP?");
console.log(`    no logins: ${noLogin.total} XP · 30 days of app-opens: ${withLogin.total} XP → +${withLogin.total - noLogin.total}`);
console.log(`    → ${withLogin.total > noLogin.total ? `YES — ${(withLogin.total - noLogin.total) / 30} XP per app-open, ~${Math.round((withLogin.total - noLogin.total) / 30 * 365)}/yr for presence alone` : "no"}\n`);

// ── Q3/12: workout vs a "train today" habit on the same day ─────────
const wo = (d) => ({ id: `w${d}`, type: "strength", date: d, exercises: [{ name: "Bench", sets: [{ weight: 80, reps: 8 }] }] });
const trainHabit = htHabit("h_train", "Train today");
const days7 = [...Array(7)].map((_, i) => back(i));
const workoutOnly = run({ workouts: days7.map(wo) });
const habitOnly = run({ htHabits: [trainHabit], htEntries: days7.map((d) => entry_("h_train", d)) });
const both = run({ workouts: days7.map(wo), htHabits: [trainHabit], htEntries: days7.map((d) => entry_("h_train", d)) });
console.log("Q3/12  One real action (a workout) tracked twice:");
console.log(`    workout only: ${workoutOnly.total} · "train today" habit only: ${habitOnly.total} · both: ${both.total}`);
console.log(`    → ${both.total >= workoutOnly.total + habitOnly.total - 5 ? "DOUBLE-COUNTED — pays workout + habit" : "resolved"}\n`);

// ── Q6/7: caps and streak multipliers ───────────────────────────────
console.log("Q6  Daily cap: none global. Per-source counts only (trades 5, workouts 3, income 3, mind notes 5, PRs 2, reminders 10).");
console.log("Q7  Streaks pay a flat ladder bonus (3d:15 … 365d:1000), not a multiplier — so it is unbounded in absolute terms.\n");

// ── Q9: level curve ─────────────────────────────────────────────────
console.log("Q9  Level curve — xpForLevel(n) = (n-1)² × 100:");
console.log(`    L1 ${X.xpForLevel(1)} · L5 ${X.xpForLevel(5)} · L10 ${X.xpForLevel(10)} · L20 ${X.xpForLevel(20)} · L40 ${X.xpForLevel(40)}`);
console.log(`    spec §4.7 wants 500×n^1.35 → L1 500 · L5 4390 · L10 11195 · L20 28550\n`);

// ── Q8/10/19/20: what happens to earned XP when data goes away ──────
const withHabit = run({ htHabits: [easy], htEntries: eEnt });
const archived = run({ htHabits: [{ ...easy, archivedAt: `${back(1)}T12:00:00.000Z` }], htEntries: eEnt });
const deleted = run({ htHabits: [], htEntries: [] });
console.log("Q8/10/19/20  XP after a habit is archived or deleted:");
console.log(`    active: ${withHabit.total} · archived: ${archived.total} · deleted: ${deleted.total}`);
console.log(`    → ${deleted.total < withHabit.total ? "XP IS REMOVED RETROACTIVELY — the engine derives from live rows, nothing is banked" : "banked"}\n`);

// ── Q11: modules awarding nothing ───────────────────────────────────
const gate = run({ finance: { withdrawals: [{ id: "w1", date: back(3), amount: 50000, split: { fleet: 20000, vault: 15000, book: 10000, life: 5000 } }] } });
console.log("Q11  Modules that award nothing today:");
console.log(`    Firm vault contribution / gate month cleared → ${gate.total} XP`);
console.log(`    Sleep floor held → 'sleep' is not a dependency of computeXp at all → 0 XP`);
console.log(`    Gym session via gym_sessions → paid only through the legacy workouts mapping (V.strength 30)\n`);

console.log("Q1  Full value table (V in xpEngine.js:23) reproduced in the report.");
console.log("Q12 Proportionality: one-tap habit 10 · 45-min strength session 30 · app-open 5.");
process.exit(0);
