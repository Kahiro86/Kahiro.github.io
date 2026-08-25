// Criteria 23 & 28 — every metric has exactly one definition, and null is
// never rendered as zero.
//
// §5A.2: "Analytics must not recompute a metric that the domain engine
// already owns. Where a duplicate is found, the domain engine's version wins
// and the analytics copy is deleted, not reconciled."
import { build } from "esbuild";
import { writeFileSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const entry = join(here, "_metrics.js");
writeFileSync(entry, `export * from "${join(root, "src/shared/habitEngine.js").replace(/\\/g, "/")}";`);
const out = join(mkdtempSync(join(tmpdir(), "met-")), "b.mjs");
const r = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(out, r.outputFiles[0].text);
const H = await import(pathToFileURL(out).href);

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const TODAY = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const back = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return iso(d); };

console.log("\n── 23: analytics does not keep its own copies ──");
const files = [];
(function walk(d) { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) { if (e !== "logic" && e !== "domain") walk(p); } else if (/\.(jsx?)$/.test(e)) files.push(p); } })(join(root, "src"));
const stripComments = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l.trim())).join("\n");

// The rule is specifically about HABIT metrics. A streak over evening reviews
// or want-list contributions is its own metric over its own data, not a second
// opinion about the same thing — so the test asks two questions, not one:
// does this file DEFINE a streak/rate function, and does it reach into habit
// data to do it? Only both together is a duplicate definition.
const OWNERS = ["shared/habitEngine.js", "shared/consistency.js", "shared/streakInsurance.js",
  "modules/habits/", "modules/gym/gymSessions.js", "modules/athlete/nutrition.js",
  "modules/athlete/bodyTargets.js", "modules/gym/bodyTrends.js", "shared/xp/",
  "modules/life/purity.js"]; // its own store; the agreement test below covers it
const DEFINES = /function\s+\w*(?:[Ss]treak|CompletionRate|Adherence)\w*\s*\(|const\s+\w*(?:[Ss]treak|CompletionRate|Adherence)\w*\s*=\s*(?:\(|function|async)/;
const READS_HABIT_DATA = /isScheduled\s*\(|isDone\s*\(|isSkipped\s*\(|valueOn\s*\(|\.log\s*\[|\.log\?\.\[/;
const offenders = [];
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, "/").replace(/^src\//, "");
  if (OWNERS.some((o) => rel.startsWith(o))) continue;
  const code = stripComments(readFileSync(f, "utf8"));
  if (DEFINES.test(code) && READS_HABIT_DATA.test(code)) offenders.push(rel);
}
ok(`no view defines its own streak or rate maths${offenders.length ? ` (${offenders.join(", ")})` : ""}`, offenders.length === 0);

const an = stripComments(read("src/shared/analytics.js"));
ok("analytics imports the engine's completion rate", /completionRate/.test(an));
ok("analytics no longer walks the log itself for a rate", !/let sched = 0, done = 0/.test(an));

console.log("\n── the two definitions used to disagree — check they no longer can ──");
// Legacy habit shape: scheduling is a weekday array, not a freq string.
const mk = (id, createdAt, log) => ({ id, name: id, freq: "daily", target: 1, days: [0,1,2,3,4,5,6], createdAt, log });
// Scheduled 10 days, done 5, one of the misses explicitly skipped.
const log = {};
for (let i = 0; i < 10; i++) log[back(i)] = i < 5 ? { v: 1 } : (i === 6 ? { s: true } : { v: 0 });
const h = mk("h1", back(9), log);
const cr = H.completionRate([h], back(9), back(0));
console.log(`     scheduled ${cr.scheduled} · done ${cr.done} · skipped ${cr.skipped} · ${cr.pct}%`);
ok("a streak-safe skip is not counted as a miss", cr.skipped === 1 && cr.scheduled === 9);
ok("the rate reflects that", cr.pct === Math.floor((5 / 9) * 100));

console.log("\n── 28: null and zero stay different ──");
const young = mk("h2", back(2), { [back(0)]: { v: 1 } });
const beforeItExisted = H.completionRate([young], back(30), back(10));
ok("a period predating the habit returns null, not 0", beforeItExisted.pct === null);
ok("and reports nothing scheduled rather than everything missed", beforeItExisted.scheduled === 0);
ok("no habits at all also returns null", H.completionRate([], back(9), back(0)).pct === null);
const real = H.completionRate([young], back(2), back(0));
ok("a real zero is still zero when days were genuinely missed",
   H.completionRate([mk("h3", back(4), { [back(0)]: { v: 0 } })], back(4), back(0)).pct === 0);
ok("and a real rate is a real rate", real.pct !== null);

console.log("\n── 26: purity has one streak, whichever store you ask ──");
// Gate 1 made purity a habit but left purity_log as the source of truth for
// content, so two things can compute a clean streak. They are mirrored on
// every write; this proves they cannot disagree about the same days.
const pEntry = join(here, "_purity.js");
writeFileSync(pEntry, `export { purityStats, sanitizePurity } from "${join(root, "src/modules/life/purity.js").replace(/\\/g, "/")}";
export { habitFeed } from "${join(root, "src/modules/habits/xpFeed.js").replace(/\\/g, "/")}";`);
const pOut = join(mkdtempSync(join(tmpdir(), "pur-")), "p.mjs");
const pr = await build({ entryPoints: [pEntry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
writeFileSync(pOut, pr.outputFiles[0].text);
const P = await import(pathToFileURL(pOut).href);

const cleanDays = [0, 1, 2, 3, 4, 5, 6, 7].map(back);
const purityLog = Object.fromEntries(cleanDays.map((d) => [d, { s: "pure", triggers: [] }]));
purityLog[back(8)] = { s: "relapse", t: 22, triggers: [] };
const pStats = P.purityStats(purityLog, iso(TODAY));
const htEntries = cleanDays.map((d) => ({ id: `e${d}`, habitId: "sys_purity", date: d, value: 1, note: null, createdAt: "", updatedAt: "" }));
htEntries.push({ id: "r", habitId: "sys_purity", date: back(8), value: 0, note: null, createdAt: "", updatedAt: "" });
const habitSide = P.habitFeed(
  [{ id: "sys_purity", name: "Purity", subtype: "abstinence", type: "boolean", frequencyType: "daily",
     frequencyDays: null, frequencyCount: null, target: null, targetDirection: "at_least", unit: null,
     routineId: null, archivedAt: null, createdAt: `${back(30)}T12:00:00.000Z`, updatedAt: "", sortOrder: 0 }],
  htEntries, iso(TODAY));
console.log(`     purity_log says ${pStats.current} clean days · the habit records ${habitSide.completions.length} completions`);
ok("both stores see the same clean days", habitSide.completions.length === cleanDays.length);
ok("and the same relapse", !habitSide.completions.some((c) => c.d === back(8)));
ok("the purity streak matches the mirrored habit run", pStats.current === cleanDays.length);

console.log("\n── 27: every average discloses its coverage ──");
const anSrc = read("src/modules/analytics/AnalyticsOS.jsx");
ok("a Coverage element exists", /function Coverage\(/.test(anSrc));
ok("it says how many of how many", /from \{of\} of \{out\}/.test(anSrc));
ok("thin coverage is called out, not just shown", /too thin to trust/.test(anSrc));
ok("complete coverage discloses nothing (no noise)", /if \(of >= out\) return null/.test(anSrc));
ok("the calorie average carries coverage", /coverage=\{cur\.coverage\?\.nutriKcal\}/.test(anSrc));
ok("the adherence average carries coverage", /coverage=\{cur\.coverage\?\.adherence\}/.test(anSrc));
ok("analytics computes coverage for its averages", /coverage: \{/.test(read("src/shared/analytics.js")));

console.log("\n── 30: no report presents an under-target as an achievement ──");
ok("target-relative quantities can be rendered neutrally", /neutral = false/.test(anSrc));
ok("calorie intake is one of them", /neutral coverage=\{cur\.coverage\?\.nutriKcal\}/.test(anSrc));
ok("and the reason is on the record", /present eating less than planned as an achievement/.test(anSrc));
// The Coach already refuses this; re-checked here so the rule holds app-wide.
const coach = read("src/modules/athlete/bodyCoach.js");
ok("the Coach still frames under-eating as a question", /opposite fixes/.test(coach));

console.log("\n── one level curve, one XP definition ──");
const he = stripComments(read("src/shared/habitEngine.js"));
ok("habitEngine defines no XP", !/export function xpOf|export const levelOf|export const xpForLevel/.test(he));
const curves = files.filter((f) => {
  const rel = f.slice(root.length + 1).replace(/\\/g, "/");
  return !rel.startsWith("src/shared/xp/") && /xpForLevel\s*=|levelOf\s*=/.test(stripComments(readFileSync(f, "utf8")));
});
ok(`exactly one level curve in the codebase${curves.length ? ` (extra: ${curves.join(", ")})` : ""}`, curves.length === 0);

console.log("\n── one source per measured fact ──");
// This exact bug has now been fixed three times in three places: a screen
// looks sleep or water up against the LEGACY wellness habits while another
// screen reads the authoritative store, and the two disagree about the same
// day. It is easy to write and invisible until someone compares two numbers,
// so it gets a guard rather than another round of noticing.
//
// isWellness/valueOn are only legitimate for EXCLUDING a wellness habit from
// a habit percentage; reading a value out of one is the bug.
const WELLNESS_OK = new Set([
  // Excludes sleep from the habit percentage, then reads hours from
  // trade_sleep. The exclusion is the point.
  "src/shared/analytics.js",
  // The legacy quick-log surface, which is about the legacy habits.
  "src/shared/QuickLog.jsx",
  // The projection layer that maps legacy habits into the shared views.
  "src/shared/views.js",
]);
const wellnessReaders = files
  .map((f) => f.slice(root.length + 1).replace(/\\/g, "/"))
  .filter((rel) => rel !== "src/shared/habitEngine.js" && !WELLNESS_OK.has(rel))
  .filter((rel) => /isWellness\s*\(/.test(stripComments(read(rel))));
ok(`no screen reads sleep or water off a wellness habit${wellnessReaders.length ? ` (${wellnessReaders.join(", ")})` : ""}`,
  wellnessReaders.length === 0);

// analytics.js is already read above as `an`.
ok("the weekly sleep average comes from the sleep log", /sleepLog\[ds\]/.test(an));
ok("and not from a habit's logged value", !/valueOn\(sleep/.test(an));
const dash = stripComments(read("src/modules/dashboard/Dashboard.jsx"));
ok("System Health reads the shared wellbeing series", /hydrationSeries|sleepSeries/.test(dash));
ok("and no longer looks up a wellness habit", !/isWellness/.test(dash));

console.log("");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Metric definitions: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
