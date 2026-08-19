// Verifies the new tracker feeds the shared progression system: habitFeed
// maps ht_* data into the signals computeXp rewards, so a logged habit moves
// XP, the Habit Mastery / Perfect Days / Streak journeys, habitCompletions
// (which feeds totalActivities/consistency), and the life-domain day-set the
// Year of Consistency engine reads. Bundles the REAL xpEngine + xpFeed.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const entry = join(here, "_xp-entry.ts");
writeFileSync(entry, `
export { computeXp } from "${join(root, "src/shared/xpEngine.js").replace(/\\/g, "/")}";
export { habitFeed } from "${join(root, "src/modules/habits/xpFeed.js").replace(/\\/g, "/")}";
`);
const out = join(mkdtempSync(join(tmpdir(), "xpfeed-")), "b.mjs");
const res = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, res.outputFiles[0].text);
const { computeXp, habitFeed } = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) pass++; else { fail++; fails.push(n); } };
const eq = (n, g, w) => ok(`${n} (got ${JSON.stringify(g)}, want ${JSON.stringify(w)})`, JSON.stringify(g) === JSON.stringify(w));

const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const today = iso(new Date());

// Two daily boolean habits, both completed on each of the last 5 days → a run
// of perfect days and 10 completions.
const mk = (id, name) => ({ id, name, icon: null, question: null, type: "boolean", unit: null,
  target: null, targetDirection: "at_least", frequencyType: "daily", frequencyDays: null,
  frequencyCount: null, routineId: null, sortOrder: 0, color: null, reminderTime: null,
  archivedAt: null, createdAt: daysAgo(20) + "T12:00:00.000Z", updatedAt: daysAgo(20) + "T12:00:00.000Z" });
const htHabits = [mk("h1", "Read"), mk("h2", "Meditate")];
const htEntries = [];
let eid = 0;
for (let i = 0; i < 5; i++) {
  const d = daysAgo(i);
  for (const h of ["h1", "h2"]) htEntries.push({ id: `e${eid++}`, habitId: h, date: d, value: 1, note: null, createdAt: d, updatedAt: d });
}

// ── habitFeed (pure) ──────────────────────────────────────────────────
const hf = habitFeed(htHabits, htEntries, today);
eq("10 completed habit-days", hf.completions.length, 10);
eq("5 perfect days (2 habits each, all done)", hf.perfectDays.length, 5);
ok(`best streak is 5 (got ${hf.bestStreak})`, hf.bestStreak === 5);
ok("streakHits include a run that reaches 3 (ladder)", hf.streakHits.some((s) => s.run === 3));
ok("empty input is safe", (() => { const e = habitFeed([], [], today); return e.completions.length === 0 && e.bestStreak === 0; })());
ok("archived habits excluded", habitFeed([{ ...mk("h3", "x"), archivedAt: today }], [{ id: "z", habitId: "h3", date: today, value: 1 }], today).completions.length === 0);

// ── computeXp integration ─────────────────────────────────────────────
const xp = computeXp({ htHabits, htEntries });
ok(`total XP > 0 from habits alone (got ${xp.total})`, xp.total > 0);
eq("stats.habitCompletions = 10", xp.stats.habitCompletions, 10);
eq("stats.perfectCount = 5", xp.stats.perfectCount, 5);
ok(`bestStreak reaches habits' 5 (got ${xp.stats.bestStreak})`, xp.stats.bestStreak >= 5);
ok("habit days land in the life-domain set (consistency life-half)", xp.lifeDays instanceof Set && xp.lifeDays.has(today));
ok("Habit Mastery journey present", xp.journeys.some((j) => j.key === "habits"));
ok("Perfect Days journey present", xp.journeys.some((j) => j.key === "perfect"));
const mastery = xp.journeys.find((j) => j.key === "habits");
ok(`Habit Mastery value tracks completions (got ${mastery?.value})`, mastery && mastery.value === 10);
ok("today earned life-category XP", (xp.todayByCat.life || 0) > 0);

// No habits → no habit XP (guards against accidental base award).
const zero = computeXp({ htHabits: [], htEntries: [] });
eq("no habits → habitCompletions 0", zero.stats.habitCompletions, 0);
eq("no habits → perfectCount 0", zero.stats.perfectCount, 0);

console.log(fail ? `\nFAILURES:\n  ${fails.join("\n  ")}` : "");
console.log(`XP feed: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
