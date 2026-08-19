// Verifies htToLegacyHabits maps the new tracker into the old v2 shape the
// shared analytical views consume — so isScheduled / isDone / currentStreak
// over the adapter output match what was actually logged in the new tracker.
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const entry = join(here, "_la-entry.js");
writeFileSync(entry, `
export { htToLegacyHabits } from "${join(root, "src/modules/habits/legacyAdapter.js").replace(/\\/g, "/")}";
export * as engine from "${join(root, "src/shared/habitEngine.js").replace(/\\/g, "/")}";
`);
const out = join(mkdtempSync(join(tmpdir(), "legadapt-")), "b.mjs");
const res = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, res.outputFiles[0].text);
const { htToLegacyHabits, engine } = await import(pathToFileURL(out).href);
const { isScheduled, isDone, currentStreak } = engine;

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) pass++; else { fail++; fails.push(n); } };

const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const today = iso(new Date());

const mk = (id, over = {}) => ({ id, name: id, icon: null, question: null, type: "boolean", unit: null,
  target: null, targetDirection: "at_least", frequencyType: "daily", frequencyDays: null, frequencyCount: null,
  routineId: null, sortOrder: 0, color: null, reminderTime: null, archivedAt: null,
  createdAt: daysAgo(30) + "T12:00:00.000Z", updatedAt: daysAgo(30) + "T12:00:00.000Z", ...over });

// Daily habit, completed the last 4 days.
const daily = mk("d1");
const entries = [];
for (let i = 0; i < 4; i++) entries.push({ id: `e${i}`, habitId: "d1", date: daysAgo(i), value: 1, note: null, createdAt: "", updatedAt: "" });

const [leg] = htToLegacyHabits([daily], entries);
ok("id is namespaced ht_*", leg.id === "ht_d1");
ok("category kept out of Spiritual", leg.category === "Personal Growth");
ok("daily → freq daily, all weekdays", leg.freq === "daily" && leg.days.length === 7);
ok("today is scheduled", isScheduled(leg, today));
ok("today reads done from the log", isDone(leg, today));
ok("an unlogged older day is not done", !isDone(leg, daysAgo(10)));
ok(`current streak is 4 (got ${currentStreak(leg)})`, currentStreak(leg) === 4);

// specific_days habit (Mon/Wed/Fri = 1,3,5) maps its weekday set.
const sd = mk("s1", { frequencyType: "specific_days", frequencyDays: [1, 3, 5] });
const [legSd] = htToLegacyHabits([sd], []);
ok("specific_days keeps its weekday set", JSON.stringify(legSd.days) === JSON.stringify([1, 3, 5]));

// numeric at_least: target carries; a value ≥ target is done.
const num = mk("n1", { type: "numeric", target: 30, unit: "min", targetDirection: "at_least" });
const [legNum] = htToLegacyHabits([num], [{ id: "x", habitId: "n1", date: today, value: 45 }]);
ok("numeric target carried", legNum.target === 30);
ok("numeric done when value ≥ target", isDone(legNum, today));
const [legNum2] = htToLegacyHabits([num], [{ id: "y", habitId: "n1", date: today, value: 10 }]);
ok("numeric not done when value < target", !isDone(legNum2, today));

// at_most numeric is excluded (can't map "done = value ≤ target").
ok("at_most numeric habit is dropped", htToLegacyHabits([mk("a1", { type: "numeric", target: 0, targetDirection: "at_most" })], []).length === 0);

// archived habit carries the archived flag (isScheduled then excludes it).
const [legArch] = htToLegacyHabits([mk("z1", { archivedAt: today })], []);
ok("archived flag carried", legArch.archived === true && !isScheduled(legArch, today));

// quota habit maps to weekly (excluded from per-day scheduling like old weekly).
const [legQ] = htToLegacyHabits([mk("q1", { frequencyType: "times_per_week", frequencyCount: 3 })], []);
ok("times_per_week → weekly", legQ.freq === "weekly" && !isScheduled(legQ, today));

console.log(fail ? `\nFAILURES:\n  ${fails.join("\n  ")}` : "");
console.log(`Legacy adapter: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
